import Foundation
import UIKit
import UserNotifications

/// DooPush SDK 主管理类
@objc public class DooPushManager: NSObject {
    /// 单例实例
    @objc public static let shared = DooPushManager()

    /// 配置信息
    private var config: DooPushConfig?

    /// 代理
    @objc public weak var delegate: DooPushDelegate?

    /// 网络管理器
    private lazy var networking = DooPushNetworking()

    /// 本地存储
    private lazy var storage = DooPushStorage()

    /// 设备信息管理器
    private lazy var deviceManager = DooPushDevice()

    /// WebSocket 连接管理器（首次 connectToGateway 时创建）
    private var wsConnection: DooPushWebSocketConnection?

    /// 统计管理器
    private lazy var statisticsManager = DooPushStatistics.shared

    private override init() {
        super.init()
        setupApplicationLifecycleNotifications()
    }

    // MARK: - 配置管理

    /// 配置 DooPush SDK
    /// - Parameters:
    ///   - appId: 应用ID
    ///   - apiKey: API密钥
    ///   - baseURL: 服务器基础URL，默认为 https://doopush.com/api/v1
    ///
    /// 注意：当 `baseURL` 为空字符串时，将自动回退到默认值，便于 Objective‑C 侧传入空字符串。
    @objc public func configure(
        appId: String,
        apiKey: String,
        baseURL: String = "https://doopush.com/api/v1"
    ) {
        let cleanedBaseURL = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedBaseURL = cleanedBaseURL.isEmpty ? "https://doopush.com/api/v1" : cleanedBaseURL

        self.config = DooPushConfig(
            appId: appId,
            apiKey: apiKey,
            baseURL: resolvedBaseURL
        )

        // 保存配置到本地
        storage.saveConfig(config!)

        // 配置网络管理器
        networking.configure(with: config!)

        // 配置统计管理器
        statisticsManager.configure(config: config!, networking: networking)

        // 默认启用自动通知事件采集
        enableAutomaticNotificationTracking()

        // 检查是否需要更新设备信息
        checkAndUpdateDeviceInfoIfNeeded()

        DooPushLogger.info("DooPush SDK 配置完成 - AppID: \(appId), BaseURL: \(resolvedBaseURL)")
    }

    /// Objective‑C 便捷配置方法：允许省略 `baseURL` 参数（使用默认 https://doopush.com/api/v1）
    /// - Parameters:
    ///   - appId: 应用ID
    ///   - apiKey: API密钥
    @objc public func configure(appId: String, apiKey: String) {
        self.configure(appId: appId, apiKey: apiKey, baseURL: "https://doopush.com/api/v1")
    }

    // MARK: - 推送注册

    /// 注册推送通知
    /// - Parameter completion: 完成回调，返回设备token或错误
    @objc public func registerForPushNotifications(completion: @escaping (String?, Error?) -> Void) {
        guard let _ = config else {
            let error = DooPushError.notConfigured
            completion(nil, error)
            return
        }

        // 请求推送权限
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { [weak self] granted, error in

            DispatchQueue.main.async {
                if let error = error {
                    DooPushLogger.error("推送权限请求失败: \(error)")
                    completion(nil, error)
                    return
                }

                if granted {
                    DooPushLogger.info("推送权限获取成功")
                    UIApplication.shared.registerForRemoteNotifications()
                    self?.storage.setPushPermissionGranted(true)
                } else {
                    DooPushLogger.warning("用户拒绝了推送权限")
                    let error = DooPushError.pushPermissionDenied
                    completion(nil, error)
                    self?.storage.setPushPermissionGranted(false)
                }
            }
        }

        // 保存完成回调
        self.registrationCompletion = completion
    }

    /// 设备token注册完成回调
    private var registrationCompletion: ((String?, Error?) -> Void)?

    /// 待重试的设备token（用于网络权限申请后的重试）
    private var pendingDeviceToken: String? = nil

    /// 处理设备token注册成功
    /// - Parameter deviceToken: 设备token数据
    @objc public func didRegisterForRemoteNotifications(with deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()

        DooPushLogger.info("获取到设备token: \(tokenString)")

        // 注册设备到服务器
        registerDeviceToServer(token: tokenString)
    }

    /// 处理设备token注册失败
    /// - Parameter error: 错误信息
    @objc public func didFailToRegisterForRemoteNotifications(with error: Error) {
        DooPushLogger.error("设备token注册失败: \(error)")

        registrationCompletion?(nil, error)
        registrationCompletion = nil

        delegate?.dooPush(self, didFailWithError: error)
    }

    // MARK: - 设备管理

    /// 注册设备到服务器
    /// - Parameter token: 设备token
    private func registerDeviceToServer(token: String) {
        guard let config = config else {
            let error = DooPushError.notConfigured
            registrationCompletion?(nil, error)
            return
        }

        let deviceInfo = deviceManager.getCurrentDeviceInfo()

        networking.registerDevice(
            appId: config.appId,
            token: token,
            deviceInfo: deviceInfo
        ) { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let deviceId):
                DooPushLogger.info("设备注册成功，设备ID: \(deviceId)")

                // 保存设备信息
                self.storage.saveDeviceToken(token)
                self.storage.saveDeviceId(String(deviceId))

                // 连接 WebSocket Gateway
                self.connectToGateway(token: token)

                // 调用回调
                self.registrationCompletion?(token, nil)
                self.registrationCompletion = nil

                // 通知代理
                self.delegate?.dooPush(self, didRegisterWithToken: token)

            case .failure(let error):
                DooPushLogger.error("设备注册失败: \(error)")

                // 调用回调
                self.registrationCompletion?(nil, error)
                self.registrationCompletion = nil

                // 如果是网络错误，保存token用于重试
                if error.isNetworkError {
                    self.pendingDeviceToken = token
                }

                // 通知代理
                self.delegate?.dooPush(self, didFailWithError: error)
            }
        }
    }

    /// 更新设备信息到服务器
    @objc public func updateDeviceInfo() {
        guard let config = config,
              let deviceToken = storage.getDeviceToken() else {
            DooPushLogger.warning("无法更新设备信息：配置或设备token缺失")
            return
        }

        let deviceInfo = deviceManager.getCurrentDeviceInfo()

        networking.updateDevice(
            appId: config.appId,
            token: deviceToken,
            deviceInfo: deviceInfo
        ) { [weak self] result in
            switch result {
            case .success:
                DooPushLogger.info("设备信息更新成功")
                self?.storage.saveLastDeviceUpdateTime()
                self?.delegate?.dooPushDidUpdateDeviceInfo?(self!)
            case .failure(let error):
                DooPushLogger.error("设备信息更新失败: \(error)")
                self?.delegate?.dooPush(self!, didFailWithError: error)
            }
        }
    }

    /// 检查并在需要时更新设备信息
    private func checkAndUpdateDeviceInfoIfNeeded() {
        // 如果没有设备token，无需更新
        guard storage.getDeviceToken() != nil else {
            DooPushLogger.debug("没有设备token，跳过自动更新")
            return
        }

        // 检查是否需要更新（默认24小时更新一次）
        if storage.shouldUpdateDeviceInfo(intervalHours: 24) {
            DooPushLogger.info("检测到需要更新设备信息，开始自动更新")
            updateDeviceInfo()
        } else {
            DooPushLogger.debug("设备信息更新间隔未到，跳过更新")
        }
    }

    // MARK: - 通知处理

    /// 处理推送通知
    /// - Parameter userInfo: 通知数据
    /// - Returns: 是否处理了该通知
    @objc public func handleNotification(_ userInfo: [AnyHashable: Any]) -> Bool {
        DooPushLogger.info("收到推送通知: \(userInfo)")

        // 解析推送数据
        let pushData = DooPushNotificationParser.parse(userInfo)

        // 通知代理
        delegate?.dooPush(self, didReceiveNotification: userInfo)

        // 统计推送接收
        recordNotificationReceived(pushData)

        return true
    }

    /// 记录推送接收统计
    /// - Parameter pushData: 推送数据
    private func recordNotificationReceived(_ pushData: DooPushNotificationData) {
        statisticsManager.recordNotificationReceived(pushData: pushData, userInfo: pushData.rawData)
    }

    /// 处理推送通知点击事件
    /// - Parameter userInfo: 通知数据
    /// - Returns: 是否处理了该通知
    @objc public func handleNotificationClick(_ userInfo: [AnyHashable: Any]) -> Bool {
        DooPushLogger.info("处理推送通知点击: \(userInfo)")

        // 解析推送数据
        let pushData = DooPushNotificationParser.parse(userInfo)

        // 记录点击统计
        statisticsManager.recordNotificationClick(pushData: pushData, userInfo: userInfo)

        return true
    }

    /// 处理推送通知导致的应用打开事件
    /// - Parameter userInfo: 通知数据
    /// - Returns: 是否处理了该通知
    @objc public func handleNotificationOpen(_ userInfo: [AnyHashable: Any]) -> Bool {
        DooPushLogger.info("处理推送导致的应用打开: \(userInfo)")

        // 解析推送数据
        let pushData = DooPushNotificationParser.parse(userInfo)

        // 记录打开统计
        statisticsManager.recordNotificationOpen(pushData: pushData, userInfo: userInfo)

        return true
    }

    /// 立即上报统计数据
    @objc public func reportStatistics() {
        statisticsManager.reportPendingEvents()
    }

    // MARK: - 工具方法

    /// 获取当前SDK版本
    @objc public static var sdkVersion: String {
        return "1.0.0"
    }

    /// 获取设备token
    @objc public func getDeviceToken() -> String? {
        return storage.getDeviceToken()
    }

    /// 获取设备ID
    @objc public func getDeviceId() -> String? {
        return storage.getDeviceId()
    }

    /// 检查推送权限状态
    @objc public func checkPushPermissionStatus(completion: @escaping (UNAuthorizationStatus) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                completion(settings.authorizationStatus)
            }
        }
    }

    // MARK: - 角标管理

    /// 设置应用角标数字
    /// - Parameters:
    ///   - number: 角标数字，0表示清除角标
    ///   - completion: 完成回调，可选
    @objc public func setBadgeNumber(_ number: Int, completion: ((Error?) -> Void)? = nil) {
        let clampedNumber = max(0, number)

        DispatchQueue.main.async { [weak self] in
            // 首先保存到本地存储
            self?.storage.saveBadgeCount(clampedNumber)

            // 根据iOS版本选择合适的API
            if #available(iOS 17.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(clampedNumber) { error in
                    if let error = error {
                        DooPushLogger.error("设置应用角标失败: \(error.localizedDescription)")
                        completion?(error)
                    } else {
                        DooPushLogger.info("设置应用角标数字: \(clampedNumber)")
                        completion?(nil)
                    }
                }
            } else {
                // iOS 17以下版本使用旧API
                UIApplication.shared.applicationIconBadgeNumber = clampedNumber
                DooPushLogger.info("设置应用角标数字: \(clampedNumber)")
                completion?(nil)
            }
        }
    }

    /// 清除应用角标
    /// - Parameter completion: 完成回调，可选
    @objc public func clearBadge(completion: ((Error?) -> Void)? = nil) {
        setBadgeNumber(0, completion: completion)
        DooPushLogger.info("清除应用角标")
    }

    /// 获取当前应用角标数字
    /// - Returns: 当前角标数字（优先从系统获取，失败则从本地存储获取）
    @objc public func getCurrentBadgeNumber() -> Int {
        // 优先尝试从系统获取badge数字
        if Thread.isMainThread {
            let systemBadge = UIApplication.shared.applicationIconBadgeNumber
            // 如果系统badge和本地存储不一致，更新本地存储以保持同步
            let storedBadge = storage.getBadgeCount()
            if systemBadge != storedBadge {
                storage.saveBadgeCount(systemBadge)
                DooPushLogger.debug("同步系统badge到本地存储: \(systemBadge)")
            }
            return systemBadge
        } else {
            // 非主线程时，从本地存储获取
            return storage.getBadgeCount()
        }
    }

    /// 增加角标数字
    /// - Parameters:
    ///   - increment: 增加的数量，默认为1
    ///   - completion: 完成回调，可选
    @objc public func incrementBadgeNumber(by increment: Int = 1, completion: ((Error?) -> Void)? = nil) {
        let currentBadge = getCurrentBadgeNumber()
        let newBadge = max(0, currentBadge + increment)
        setBadgeNumber(newBadge, completion: completion)
        DooPushLogger.info("角标数字增加 \(increment)，当前: \(newBadge)")
    }

    /// 减少角标数字
    /// - Parameters:
    ///   - decrement: 减少的数量，默认为1
    ///   - completion: 完成回调，可选
    @objc public func decrementBadgeNumber(by decrement: Int = 1, completion: ((Error?) -> Void)? = nil) {
        let currentBadge = getCurrentBadgeNumber()
        let newBadge = max(0, currentBadge - decrement)
        setBadgeNumber(newBadge, completion: completion)
        DooPushLogger.info("角标数字减少 \(decrement)，当前: \(newBadge)")
    }

    // MARK: - WebSocket 连接管理

    /// 设置应用生命周期通知
    private func setupApplicationLifecycleNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillTerminate),
            name: UIApplication.willTerminateNotification,
            object: nil
        )
    }

    /// 连接到 WebSocket Gateway
    /// - Parameters:
    ///   - token: 设备 APNs token（用作鉴权凭据）
    private func connectToGateway(token: String) {
        guard let config = config else {
            DooPushLogger.error("SDK配置缺失，无法连接Gateway")
            return
        }

        DooPushLogger.info("准备连接 WebSocket Gateway - \(config.baseURL)")

        // 断开旧连接（如有）
        wsConnection?.disconnect()

        let ws = DooPushWebSocketConnection(
            baseUrl: config.baseURL,
            appId: config.appId,
            appKey: config.apiKey,
            token: token
        )
        ws.listener = self
        wsConnection = ws
        ws.connect()
    }

    /// 手动连接 WebSocket
    @objc public func connectWebSocket() {
        guard let token = storage.getDeviceToken() else {
            DooPushLogger.warning("无法连接 WebSocket：设备token缺失")
            return
        }
        connectToGateway(token: token)
    }

    /// 手动断开 WebSocket
    @objc public func disconnectWebSocket() {
        wsConnection?.disconnect()
        wsConnection = nil
    }

    // MARK: - 应用生命周期处理

    @objc private func applicationDidBecomeActive() {
        DooPushLogger.info("应用变为活跃状态")

        // 确保自动采集处于启用状态（若外部更改了 delegate，这里会重新包裹并转发）
        enableAutomaticNotificationTracking()

        // 检查是否需要重试设备注册（网络权限申请后）
        if let pendingToken = pendingDeviceToken {
            pendingDeviceToken = nil
            DooPushLogger.info("检测到未完成的设备注册，尝试重新注册")
            registerDeviceToServer(token: pendingToken)
            return
        }

        // 前台恢复时，若已有连接对象则重连（WebSocket 后台通常会被系统断开）
        if let ws = wsConnection {
            ws.disconnect()
            wsConnection = nil
        }
        if let token = storage.getDeviceToken(), config != nil {
            connectToGateway(token: token)
        }
    }

    @objc private func applicationWillResignActive() {
        DooPushLogger.info("应用即将变为非活跃状态")
        // iOS 后台限制：主动断开 WebSocket，等前台恢复后重连
        wsConnection?.disconnect()
        wsConnection = nil
    }

    @objc private func applicationWillTerminate() {
        DooPushLogger.info("应用即将终止")
        wsConnection?.disconnect()
        wsConnection = nil

        // 移除通知观察者
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - 析构

    deinit {
        NotificationCenter.default.removeObserver(self)
        wsConnection?.disconnect()
    }
}

// MARK: - WebSocket 连接事件

extension DooPushManager: DooPushWebSocketConnection.Listener {

    public func wsDidOpen() {
        DooPushLogger.info("WebSocket 连接已建立")
    }

    public func wsDidClose(code: Int, reason: String?) {
        DooPushLogger.info("WebSocket 连接关闭 code=\(code) reason=\(reason ?? "-")")
    }

    public func wsDidFail(_ error: Error) {
        DooPushLogger.error("WebSocket 连接错误: \(error)")
        delegate?.dooPush(self, didFailWithError: error)
    }
}

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
    public weak var delegate: DooPushDelegate?
    
    /// 网络管理器
    private lazy var networking = DooPushNetworking()
    
    /// 本地存储
    private lazy var storage = DooPushStorage()
    
    /// 设备信息管理器
    private lazy var deviceManager = DooPushDevice()
    
    /// TCP 连接管理器
    private lazy var tcpConnection = DooPushTCPConnection()
    
    /// 统计管理器
    private lazy var statisticsManager = DooPushStatistics.shared
    
    private override init() {
        super.init()
        setupTCPConnection()
        setupApplicationLifecycleNotifications()
    }
    
    // MARK: - 配置管理
    
    /// 配置 DooPush SDK
    /// - Parameters:
    ///   - appId: 应用ID
    ///   - apiKey: API密钥
    ///   - baseURL: 服务器基础URL，默认为 https://doopush.com/api/v1
    @objc public func configure(
        appId: String,
        apiKey: String,
        baseURL: String = "https://doopush.com/api/v1"
    ) {
        self.config = DooPushConfig(
            appId: appId,
            apiKey: apiKey,
            baseURL: baseURL
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
        
        DooPushLogger.info("DooPush SDK 配置完成 - AppID: \(appId), BaseURL: \(baseURL)")
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
            case .success(let response):
                DooPushLogger.info("设备注册成功: \(response)")
                
                // 保存设备信息
                self.storage.saveDeviceToken(token)
                self.storage.saveDeviceId(String(response.id))
                
                // 配置并连接TCP Gateway
                self.connectToGateway(response: response, token: token)
                
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
    /// - Parameter number: 角标数字，0表示清除角标
    @objc public func setBadgeNumber(_ number: Int) {
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = number
            DooPushLogger.info("设置应用角标数字: \(number)")
        }
    }
    
    /// 清除应用角标
    @objc public func clearBadge() {
        setBadgeNumber(0)
        DooPushLogger.info("清除应用角标")
    }
    
    /// 获取当前应用角标数字
    /// - Returns: 当前角标数字
    @objc public func getCurrentBadgeNumber() -> Int {
        return UIApplication.shared.applicationIconBadgeNumber
    }
    
    /// 增加角标数字
    /// - Parameter increment: 增加的数量，默认为1
    @objc public func incrementBadgeNumber(by increment: Int = 1) {
        let currentBadge = getCurrentBadgeNumber()
        let newBadge = max(0, currentBadge + increment)
        setBadgeNumber(newBadge)
        DooPushLogger.info("角标数字增加 \(increment)，当前: \(newBadge)")
    }
    
    /// 减少角标数字
    /// - Parameter decrement: 减少的数量，默认为1
    @objc public func decrementBadgeNumber(by decrement: Int = 1) {
        let currentBadge = getCurrentBadgeNumber()
        let newBadge = max(0, currentBadge - decrement)
        setBadgeNumber(newBadge)
        DooPushLogger.info("角标数字减少 \(decrement)，当前: \(newBadge)")
    }
    
    // MARK: - TCP 连接管理
    
    /// 设置TCP连接
    private func setupTCPConnection() {
        tcpConnection.delegate = self
    }
    
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
    
    /// 连接到Gateway
    /// - Parameters:
    ///   - response: 设备注册响应
    ///   - token: 设备token
    private func connectToGateway(response: DeviceRegistrationResponse, token: String) {
        guard let config = config else {
            DooPushLogger.error("SDK配置缺失，无法连接Gateway")
            return
        }
        
        let gatewayConfig = response.gatewayConfig
        DooPushLogger.info("准备连接Gateway - \(gatewayConfig.host):\(gatewayConfig.port)")
        
        tcpConnection.configure(
            config: gatewayConfig,
            appId: config.appId,
            deviceToken: token
        )
        tcpConnection.connect()
    }
    
    /// 获取TCP连接状态
    @objc public func getTCPConnectionState() -> DooPushTCPState {
        return tcpConnection.state
    }
    
    /// 手动连接TCP
    @objc public func connectTCP() {
        tcpConnection.connect()
    }
    
    /// 手动断开TCP
    @objc public func disconnectTCP() {
        tcpConnection.disconnect()
    }
    
    // MARK: - 应用生命周期处理
    
    @objc private func applicationDidBecomeActive() {
        DooPushLogger.info("应用变为活跃状态")
        tcpConnection.applicationDidBecomeActive()
        
        // 确保自动采集处于启用状态（若外部更改了 delegate，这里会重新包裹并转发）
        enableAutomaticNotificationTracking()
        
        // 检查是否需要重试设备注册（网络权限申请后）
        if let pendingToken = pendingDeviceToken {
            pendingDeviceToken = nil
            DooPushLogger.info("检测到未完成的设备注册，尝试重新注册")
            registerDeviceToServer(token: pendingToken)
        }
    }
    
    @objc private func applicationWillResignActive() {
        DooPushLogger.info("应用即将变为非活跃状态")
        tcpConnection.applicationWillResignActive()
    }
    
    @objc private func applicationWillTerminate() {
        DooPushLogger.info("应用即将终止")
        tcpConnection.applicationWillTerminate()
        
        // 移除通知观察者
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - 析构
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        tcpConnection.disconnect()
    }
}

// MARK: - TCP连接代理

extension DooPushManager: DooPushTCPConnectionDelegate {
    
    public func tcpConnection(_ connection: DooPushTCPConnection, didChangeState state: DooPushTCPState) {
        DooPushLogger.info("TCP连接状态变化: \(state)")
        
        // 通知代理TCP连接状态变化
        delegate?.dooPushTCPConnectionStateChanged?(self, state: state)
    }
    
    public func tcpConnection(_ connection: DooPushTCPConnection, didRegisterSuccessfully message: DooPushTCPMessage) {
        DooPushLogger.info("TCP设备注册成功")
        
        // 通知代理TCP注册成功
        delegate?.dooPushTCPDidRegister?(self)
    }
    
    public func tcpConnection(_ connection: DooPushTCPConnection, didReceiveError error: Error, message: String) {
        DooPushLogger.error("TCP连接错误: \(message)")
        
        // 通知代理TCP连接错误
        delegate?.dooPush(self, didFailWithError: error)
    }
    
    public func tcpConnection(_ connection: DooPushTCPConnection, didReceiveHeartbeatResponse message: DooPushTCPMessage) {
        DooPushLogger.debug("TCP心跳响应")
        
        // 通知代理心跳响应
        delegate?.dooPushTCPHeartbeatReceived?(self)
    }
    
    public func tcpConnection(_ connection: DooPushTCPConnection, didReceivePushMessage message: DooPushTCPMessage) {
        DooPushLogger.info("通过TCP收到推送消息")
        
        // 解析推送消息
        if let pushData = try? JSONSerialization.jsonObject(with: message.data) as? [AnyHashable: Any] {
            // 处理推送消息（类似于普通推送处理）
            delegate?.dooPush(self, didReceiveNotification: pushData)
            
            // 统计推送接收
            let notificationData = DooPushNotificationParser.parse(pushData)
            recordNotificationReceived(notificationData)
        } else {
            DooPushLogger.warning("TCP推送消息解析失败")
        }
    }
}

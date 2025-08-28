import Foundation

/// 本地存储管理类
public class DooPushStorage {
    
    /// UserDefaults 键名常量
    private struct Keys {
        static let config = "DooPushSDK.Config"
        static let deviceToken = "DooPushSDK.DeviceToken"
        static let deviceId = "DooPushSDK.DeviceId"
        static let pushPermissionGranted = "DooPushSDK.PushPermissionGranted"
        static let lastDeviceUpdate = "DooPushSDK.LastDeviceUpdate"
        static let installationId = "DooPushSDK.InstallationId"
        static let sdkVersion = "DooPushSDK.SDKVersion"
        static let badgeCount = "DooPushSDK.BadgeCount"
    }
    
    /// UserDefaults 实例
    private let userDefaults = UserDefaults.standard
    
    /// JSON 编码器
    private let encoder = JSONEncoder()
    
    /// JSON 解码器
    private let decoder = JSONDecoder()
    
    public init() {
        // 初始化时检查SDK版本更新
        checkSDKVersionUpdate()
    }
    
    // MARK: - 配置管理
    
    /// 保存配置信息
    /// - Parameter config: 配置对象
    public func saveConfig(_ config: DooPushConfig) {
        do {
            let data = try encoder.encode(config)
            userDefaults.set(data, forKey: Keys.config)
            userDefaults.synchronize()
            
            DooPushLogger.debug("配置信息已保存")
        } catch {
            DooPushLogger.error("保存配置失败: \(error)")
        }
    }
    
    /// 获取配置信息
    /// - Returns: 配置对象
    public func getConfig() -> DooPushConfig? {
        guard let data = userDefaults.data(forKey: Keys.config) else {
            return nil
        }
        
        do {
            let config = try decoder.decode(DooPushConfig.self, from: data)
            return config
        } catch {
            DooPushLogger.error("读取配置失败: \(error)")
            return nil
        }
    }
    
    /// 清除配置信息
    public func clearConfig() {
        userDefaults.removeObject(forKey: Keys.config)
        userDefaults.synchronize()
    }
    
    // MARK: - 设备信息管理
    
    /// 保存设备token
    /// - Parameter token: 设备token
    public func saveDeviceToken(_ token: String) {
        userDefaults.set(token, forKey: Keys.deviceToken)
        userDefaults.synchronize()
        
        DooPushLogger.debug("设备token已保存: \(token)")
    }
    
    /// 获取设备token
    /// - Returns: 设备token
    public func getDeviceToken() -> String? {
        return userDefaults.string(forKey: Keys.deviceToken)
    }
    
    /// 清除设备token
    public func clearDeviceToken() {
        userDefaults.removeObject(forKey: Keys.deviceToken)
        userDefaults.synchronize()
    }
    
    /// 保存设备ID
    /// - Parameter deviceId: 设备ID
    public func saveDeviceId(_ deviceId: String) {
        userDefaults.set(deviceId, forKey: Keys.deviceId)
        userDefaults.synchronize()
        
        DooPushLogger.debug("设备ID已保存: \(deviceId)")
    }
    
    /// 获取设备ID
    /// - Returns: 设备ID
    public func getDeviceId() -> String? {
        return userDefaults.string(forKey: Keys.deviceId)
    }
    
    /// 清除设备ID
    public func clearDeviceId() {
        userDefaults.removeObject(forKey: Keys.deviceId)
        userDefaults.synchronize()
    }
    
    // MARK: - 推送权限管理
    
    /// 设置推送权限状态
    /// - Parameter granted: 是否已授权
    public func setPushPermissionGranted(_ granted: Bool) {
        userDefaults.set(granted, forKey: Keys.pushPermissionGranted)
        userDefaults.synchronize()
    }
    
    /// 获取推送权限状态
    /// - Returns: 是否已授权
    public func isPushPermissionGranted() -> Bool {
        return userDefaults.bool(forKey: Keys.pushPermissionGranted)
    }
    
    // MARK: - 设备更新时间管理
    
    /// 保存最后设备更新时间
    public func saveLastDeviceUpdateTime() {
        let timestamp = Date().timeIntervalSince1970
        userDefaults.set(timestamp, forKey: Keys.lastDeviceUpdate)
        userDefaults.synchronize()
    }
    
    /// 获取最后设备更新时间
    /// - Returns: 更新时间
    public func getLastDeviceUpdateTime() -> Date? {
        let timestamp = userDefaults.double(forKey: Keys.lastDeviceUpdate)
        return timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }
    
    /// 检查是否需要更新设备信息
    /// - Parameter intervalHours: 更新间隔（小时）
    /// - Returns: 是否需要更新
    public func shouldUpdateDeviceInfo(intervalHours: Double = 24) -> Bool {
        guard let lastUpdate = getLastDeviceUpdateTime() else {
            return true // 如果没有记录，则需要更新
        }
        
        let now = Date()
        let timeDifference = now.timeIntervalSince(lastUpdate)
        let hoursDifference = timeDifference / 3600
        
        return hoursDifference >= intervalHours
    }
    
    // MARK: - 安装标识管理
    
    /// 获取或生成安装标识
    /// - Returns: 安装标识
    public func getInstallationId() -> String {
        if let existingId = userDefaults.string(forKey: Keys.installationId) {
            return existingId
        }
        
        let newId = UUID().uuidString
        userDefaults.set(newId, forKey: Keys.installationId)
        userDefaults.synchronize()
        
        DooPushLogger.debug("生成新的安装标识: \(newId)")
        return newId
    }
    
    // MARK: - SDK版本管理
    
    /// 检查SDK版本更新
    private func checkSDKVersionUpdate() {
        let currentVersion = DooPushManager.sdkVersion
        let savedVersion = userDefaults.string(forKey: Keys.sdkVersion)
        
        if savedVersion != currentVersion {
            DooPushLogger.info("SDK版本更新: \(savedVersion ?? "未知") -> \(currentVersion)")
            
            // 更新版本信息
            userDefaults.set(currentVersion, forKey: Keys.sdkVersion)
            userDefaults.synchronize()
            
            // 如果是首次安装或版本更新，可能需要清理某些缓存
            if savedVersion == nil {
                DooPushLogger.info("首次安装SDK")
            }
        }
    }
    
    /// 获取当前保存的SDK版本
    /// - Returns: SDK版本
    public func getSavedSDKVersion() -> String? {
        return userDefaults.string(forKey: Keys.sdkVersion)
    }
    
    // MARK: - 数据清理
    
    /// 清除所有存储的数据
    public func clearAllData() {
        let keys = [
            Keys.config,
            Keys.deviceToken,
            Keys.deviceId,
            Keys.pushPermissionGranted,
            Keys.lastDeviceUpdate,
            Keys.installationId,
            Keys.sdkVersion
        ]
        
        for key in keys {
            userDefaults.removeObject(forKey: key)
        }
        
        userDefaults.synchronize()
        
        DooPushLogger.info("已清除所有本地数据")
    }
    
    /// 清除设备相关数据（保留配置）
    public func clearDeviceData() {
        let keys = [
            Keys.deviceToken,
            Keys.deviceId,
            Keys.pushPermissionGranted,
            Keys.lastDeviceUpdate
        ]
        
        for key in keys {
            userDefaults.removeObject(forKey: key)
        }
        
        userDefaults.synchronize()
        
        DooPushLogger.info("已清除设备相关数据")
    }
    
    // MARK: - 调试信息
    
    /// 获取存储状态信息
    /// - Returns: 状态信息
    public func getStorageStatus() -> [String: Any] {
        return [
            "hasConfig": getConfig() != nil,
            "hasDeviceToken": getDeviceToken() != nil,
            "hasDeviceId": getDeviceId() != nil,
            "pushPermissionGranted": isPushPermissionGranted(),
            "lastDeviceUpdate": getLastDeviceUpdateTime()?.description ?? "无",
            "installationId": getInstallationId(),
            "sdkVersion": getSavedSDKVersion() ?? "无"
        ]
    }
    
    /// 打印存储状态
    public func printStorageStatus() {
        let status = getStorageStatus()
        DooPushLogger.debug("存储状态: \(status)")
    }
    
    // MARK: - Badge管理
    
    /// 保存角标数字
    /// - Parameter count: 角标数字
    public func saveBadgeCount(_ count: Int) {
        userDefaults.set(count, forKey: Keys.badgeCount)
        userDefaults.synchronize()
        DooPushLogger.debug("角标数字已保存: \(count)")
    }
    
    /// 获取保存的角标数字
    /// - Returns: 角标数字，默认为0
    public func getBadgeCount() -> Int {
        return userDefaults.integer(forKey: Keys.badgeCount)
    }
    
    /// 清除保存的角标数字
    public func clearBadgeCount() {
        userDefaults.removeObject(forKey: Keys.badgeCount)
        userDefaults.synchronize()
        DooPushLogger.debug("已清除保存的角标数字")
    }
}

import Foundation

/// DooPush SDK 代理协议
@objc public protocol DooPushDelegate: AnyObject {
    
    /// 设备注册成功
    /// - Parameters:
    ///   - manager: DooPush管理器实例
    ///   - token: 设备token
    @objc func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String)
    
    /// 收到推送通知
    /// - Parameters:
    ///   - manager: DooPush管理器实例
    ///   - userInfo: 通知数据
    @objc func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any])
    
    /// 发生错误
    /// - Parameters:
    ///   - manager: DooPush管理器实例
    ///   - error: 错误信息
    @objc func dooPush(_ manager: DooPushManager, didFailWithError error: Error)
    
    /// 设备信息更新成功（可选实现）
    /// - Parameter manager: DooPush管理器实例
    @objc optional func dooPushDidUpdateDeviceInfo(_ manager: DooPushManager)
    
    /// 推送权限status变更（可选实现）
    /// - Parameters:
    ///   - manager: DooPush管理器实例
    ///   - status: 权限状态
    @objc optional func dooPush(_ manager: DooPushManager, didChangePermissionStatus status: Int)
    
    // MARK: - TCP连接相关代理方法（可选实现）
    
    /// TCP连接状态变化
    /// - Parameters:
    ///   - manager: DooPush管理器实例
    ///   - state: 连接状态
    @objc optional func dooPushTCPConnectionStateChanged(_ manager: DooPushManager, state: DooPushTCPState)
    
    /// TCP设备注册成功
    /// - Parameter manager: DooPush管理器实例
    @objc optional func dooPushTCPDidRegister(_ manager: DooPushManager)
    
    /// TCP心跳响应
    /// - Parameter manager: DooPush管理器实例
    @objc optional func dooPushTCPHeartbeatReceived(_ manager: DooPushManager)
}

// MARK: - 推送通知数据解析

/// 推送通知数据结构
public struct DooPushNotificationData {
    /// 推送ID
    public let pushId: String?
    
    /// 标题
    public let title: String?
    
    /// 内容
    public let content: String?
    
    /// 自定义数据
    public let payload: [String: Any]?
    
    /// 角标数量
    public let badge: Int?
    
    /// 声音
    public let sound: String?
    
    /// 原始数据
    public let rawData: [AnyHashable: Any]
    
    /// 初始化
    /// - Parameter userInfo: 推送通知原始数据
    public init(userInfo: [AnyHashable: Any]) {
        self.rawData = userInfo
        
        // 解析 APNs 格式数据
        if let aps = userInfo["aps"] as? [String: Any] {
            if let alert = aps["alert"] as? [String: Any] {
                self.title = alert["title"] as? String
                self.content = alert["body"] as? String
            } else if let alertString = aps["alert"] as? String {
                self.title = nil
                self.content = alertString
            } else {
                self.title = nil
                self.content = nil
            }
            
            self.badge = aps["badge"] as? Int
            self.sound = aps["sound"] as? String
        } else {
            // 兼容其他格式
            self.title = userInfo["title"] as? String
            self.content = userInfo["content"] as? String ?? userInfo["body"] as? String
            self.badge = userInfo["badge"] as? Int
            self.sound = userInfo["sound"] as? String
        }
        
        // 解析自定义数据
        var customPayload: [String: Any] = [:]
        for (key, value) in userInfo {
            if let keyString = key as? String,
               keyString != "aps" {
                customPayload[keyString] = value
            }
        }
        self.payload = customPayload.isEmpty ? nil : customPayload
        
        // 推送ID（如果存在）
        self.pushId = userInfo["push_id"] as? String ?? userInfo["id"] as? String
    }
    
    /// 是否包含自定义数据
    public var hasCustomPayload: Bool {
        return payload != nil && !payload!.isEmpty
    }
    
    /// 获取自定义数据中的特定值
    /// - Parameter key: 键名
    /// - Returns: 对应的值
    public func customValue(for key: String) -> Any? {
        return payload?[key]
    }
}

/// 推送通知数据解析器
public struct DooPushNotificationParser {
    
    /// 解析推送通知数据
    /// - Parameter userInfo: 原始通知数据
    /// - Returns: 解析后的通知数据
    public static func parse(_ userInfo: [AnyHashable: Any]) -> DooPushNotificationData {
        return DooPushNotificationData(userInfo: userInfo)
    }
    
    /// 检查是否为DooPush发送的通知
    /// - Parameter userInfo: 通知数据
    /// - Returns: 是否为DooPush通知
    public static func isDooPushNotification(_ userInfo: [AnyHashable: Any]) -> Bool {
        // 检查是否包含DooPush特有的标识
        return userInfo["doopush"] != nil || 
               userInfo["push_id"] != nil ||
               userInfo["dp_source"] != nil
    }
    
    /// 提取推送统计需要的数据
    /// - Parameter userInfo: 通知数据
    /// - Returns: 统计数据
    public static func extractAnalyticsData(_ userInfo: [AnyHashable: Any]) -> [String: Any]? {
        var analyticsData: [String: Any] = [:]
        
        if let pushId = userInfo["push_id"] as? String {
            analyticsData["push_id"] = pushId
        }
        
        if let campaignId = userInfo["campaign_id"] as? String {
            analyticsData["campaign_id"] = campaignId
        }
        
        if let source = userInfo["dp_source"] as? String {
            analyticsData["source"] = source
        }
        
        return analyticsData.isEmpty ? nil : analyticsData
    }
}

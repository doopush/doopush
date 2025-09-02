//
//  PushNotificationManager.swift
//  DooPushSDKExample
//
//  Created by 韦一 on 2025/8/25.
//

import Foundation
import SwiftUI
import DooPushSDK
import UserNotifications

/// 推送通知管理器 - 实现DooPushDelegate
class PushNotificationManager: NSObject, DooPushDelegate, ObservableObject {
    
    // MARK: - Published Properties
    @Published var sdkStatus: SDKStatus = .notConfigured
    @Published var pushPermissionStatus: UNAuthorizationStatus = .notDetermined
    @Published var deviceToken: String?
    @Published var deviceId: String?
    @Published var lastError: String?
    @Published var notifications: [NotificationInfo] = []
    @Published var isLoading = false
    @Published var isUpdatingDevice = false
    @Published var updateMessage: String?
    
    // MARK: - SDK Status
    enum SDKStatus {
        case notConfigured
        case configured
        case registering
        case registered
        case failed
        
        var displayText: String {
            switch self {
            case .notConfigured:
                return "未配置"
            case .configured:
                return "已配置"
            case .registering:
                return "注册中..."
            case .registered:
                return "已注册"
            case .failed:
                return "注册失败"
            }
        }
        
        var statusColor: Color {
            switch self {
            case .notConfigured, .failed:
                return .red
            case .configured, .registering:
                return .orange
            case .registered:
                return .green
            }
        }
    }
    
    // MARK: - Notification Info
    struct NotificationInfo: Identifiable, Equatable {
        let id = UUID()
        let title: String?
        let content: String?
        let payload: [String: Any]?
        let dedupKey: String?
        let receivedAt: Date
        
        static func == (lhs: NotificationInfo, rhs: NotificationInfo) -> Bool {
            lhs.id == rhs.id
        }
    }
    
    override init() {
        super.init()
        checkPermissionStatus()
        updateSDKStatus()
    }
    
    /// SDK配置完成后检查是否需要自动注册
    func checkAutoRegister() {
        // 检查是否之前已经注册过
        if let _ = DooPushManager.shared.getDeviceToken() {
            // 如果有本地token，自动重新注册以恢复连接
            registerForPushNotifications()
        }
    }
    
    // MARK: - Public Methods
    
    /// 注册推送通知
    func registerForPushNotifications() {
        isLoading = true
        sdkStatus = .registering
        lastError = nil
        
        DooPushManager.shared.registerForPushNotifications { [weak self] token, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let error = error {
                    self?.handleRegistrationError(error)
                } else if let token = token {
                    self?.handleRegistrationSuccess(token)
                }
            }
        }
    }
    
    /// 更新设备信息
    func updateDeviceInfo() {
        isUpdatingDevice = true
        updateMessage = "正在更新设备信息..."
        
        DooPushManager.shared.updateDeviceInfo()
        
        // 设置超时
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            if self?.isUpdatingDevice == true {
                self?.isUpdatingDevice = false
                self?.updateMessage = nil
                self?.lastError = "更新超时"
            }
        }
    }
    
    /// 检查权限状态
    func checkPermissionStatus() {
        DooPushManager.shared.checkPushPermissionStatus { [weak self] status in
            DispatchQueue.main.async {
                self?.pushPermissionStatus = status
                self?.updateSDKStatus()
            }
        }
    }
    
    /// 清除通知历史
    func clearNotifications() {
        notifications.removeAll()
    }
    
    /// 手动上报统计数据
    func reportStatistics() {
        DooPushManager.shared.reportStatistics()
        Logger.info("📊 手动触发统计数据上报")
    }
    
    // MARK: - Private Methods
    
    private func updateSDKStatus() {
        deviceToken = DooPushManager.shared.getDeviceToken()
        deviceId = DooPushManager.shared.getDeviceId()
        
        if deviceToken != nil {
            sdkStatus = .registered
        } else {
            sdkStatus = .configured
        }
    }
    
    private func handleRegistrationSuccess(_ token: String) {
        deviceToken = token
        deviceId = DooPushManager.shared.getDeviceId()
        sdkStatus = .registered
        lastError = nil
        checkPermissionStatus()
    }
    
    private func handleRegistrationError(_ error: Error) {
        sdkStatus = .failed
        lastError = DooPushErrorHandler.userFriendlyMessage(for: error)
        checkPermissionStatus()
    }
    
    // MARK: - DooPushDelegate
    
    func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String) {
        DispatchQueue.main.async {
            Logger.info("🎯 设备注册成功: \(token)")
            self.handleRegistrationSuccess(token)
        }
    }
    
    func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any]) {
        DispatchQueue.main.async {
            Logger.info("📱 收到推送通知: \(userInfo)")
            
            let parser = DooPushNotificationParser.parse(userInfo)
            let incoming = NotificationInfo(
                title: parser.title,
                content: parser.content,
                payload: parser.payload,
                dedupKey: parser.dedupKey,
                receivedAt: Date()
            )
            
            // 使用 dedupKey 去重
            if let key = incoming.dedupKey {
                let exists = self.notifications.contains { $0.dedupKey == key }
                if !exists {
                    self.notifications.insert(incoming, at: 0)
                }
            } else {
                // 无 dedupKey 时不做去重
                self.notifications.insert(incoming, at: 0)
            }
            
            // 限制通知历史数量
            if self.notifications.count > 50 {
                self.notifications.removeLast()
            }
        }
    }
    
    func dooPush(_ manager: DooPushManager, didFailWithError error: Error) {
        DispatchQueue.main.async {
            Logger.error("❌ 发生错误: \(error)")
            
            // 如果正在更新设备信息时出错
            if self.isUpdatingDevice {
                self.isUpdatingDevice = false
                self.updateMessage = nil
                self.lastError = "设备信息更新失败: \(DooPushErrorHandler.userFriendlyMessage(for: error))"
            } else {
                self.handleRegistrationError(error)
            }
        }
    }
    
    // MARK: - Optional Delegate Methods
    
    func dooPushDidUpdateDeviceInfo(_ manager: DooPushManager) {
        DispatchQueue.main.async {
            Logger.info("✅ 设备信息更新成功")
            self.isUpdatingDevice = false
            self.updateMessage = "设备信息更新成功"
            
            // 3秒后清除更新消息
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                self?.updateMessage = nil
            }
        }
    }
    
    func dooPush(_ manager: DooPushManager, didChangePermissionStatus status: Int) {
        DispatchQueue.main.async {
            Logger.info("🔔 权限状态变更: \(status)")
            self.checkPermissionStatus()
        }
    }
}

// MARK: - Extensions

extension UNAuthorizationStatus {
    var displayText: String {
        switch self {
        case .notDetermined:
            return "未确定"
        case .denied:
            return "已拒绝"
        case .authorized:
            return "已授权"
        case .provisional:
            return "临时授权"
        case .ephemeral:
            return "短期授权"
        @unknown default:
            return "未知"
        }
    }
    
    var statusColor: Color {
        switch self {
        case .denied:
            return .red
        case .notDetermined, .provisional, .ephemeral:
            return .orange
        case .authorized:
            return .green
        @unknown default:
            return .gray
        }
    }
}

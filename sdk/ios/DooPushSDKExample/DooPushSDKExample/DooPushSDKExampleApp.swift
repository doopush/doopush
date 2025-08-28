//
//  DooPushSDKExampleApp.swift
//  DooPushSDKExample
//
//  Created by 韦一 on 2025/8/25.
//

import SwiftUI
import DooPushSDK
import UserNotifications

class ApplicationDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        DooPushManager.shared.didRegisterForRemoteNotifications(with: deviceToken)
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        DooPushManager.shared.didFailToRegisterForRemoteNotifications(with: error)
    }
}

@main
struct DooPushSDKExampleApp: App {
    @UIApplicationDelegateAdaptor(ApplicationDelegate.self) var appDelegate
    @StateObject private var notificationDelegate = NotificationDelegate()
    @StateObject private var pushManager = PushNotificationManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(pushManager)
                .onAppear {
                    configurePushSDK()
                    UNUserNotificationCenter.current().delegate = notificationDelegate
                }
        }
    }
    
    private func configurePushSDK() {
        DooPushManager.shared.configure(
            appId: AppConfig.appId,
            apiKey: AppConfig.apiKey,
            baseURL: AppConfig.baseURL
        )
        
        DooPushManager.shared.delegate = pushManager
        
        // 检查是否需要自动注册
        pushManager.checkAutoRegister()
        
        // 使用配置文件的方法输出配置信息
        AppConfig.printConfiguration()
    }
}

// MARK: - NotificationDelegate for handling notifications

class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate, ObservableObject {
    
    // 前台收到推送通知时调用
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo
        
        // 让DooPush SDK处理通知（记录接收统计）
        _ = DooPushManager.shared.handleNotification(userInfo)
        
        // 在前台也显示通知
        completionHandler([.banner, .sound, .badge])
    }
    
    // 用户点击推送通知时调用
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        
        // 根据操作类型处理不同的统计事件
        switch response.actionIdentifier {
        case UNNotificationDefaultActionIdentifier:
            // 用户点击了通知本身，记录点击统计
            _ = DooPushManager.shared.handleNotificationClick(userInfo)
            
            // 同时记录应用打开统计（因为点击通知会打开应用）
            _ = DooPushManager.shared.handleNotificationOpen(userInfo)
            
        case UNNotificationDismissActionIdentifier:
            // 用户划掉了通知，只记录点击统计
            _ = DooPushManager.shared.handleNotificationClick(userInfo)
            
        default:
            // 其他自定义操作，记录点击统计
            _ = DooPushManager.shared.handleNotificationClick(userInfo)
        }
        
        completionHandler()
    }
}

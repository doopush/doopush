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

// MARK: - NotificationDelegate (示例保留，占位用，具体处理由 SDK 代理转发)

class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate, ObservableObject {}

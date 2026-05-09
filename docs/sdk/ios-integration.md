# iOS SDK 集成指南

DooPush iOS SDK 为您的 iOS 应用提供简单易用的推送通知功能。本指南将帮助您在 30 分钟内完成 SDK 集成并开始接收推送通知。

## 📋 系统要求

- **iOS 版本**：iOS 13.0 或更高版本
- **Xcode 版本**：Xcode 16.0 或更高版本
- **Swift 版本**：Swift 5.5 或更高版本
- **开发者账号**：Apple 开发者账号（用于推送证书配置）

## 📦 安装 SDK

### 方式一：Framework 集成（推荐）

1. 前往 [DooPush iOS SDK 发布页](https://github.com/doopush/doopush-ios-sdk/releases) 下载最新版 `DooPushSDK.framework`
2. 将 framework 拖拽到您的 Xcode 项目中
3. 在 **"Frameworks, Libraries, and Embedded Content"** 中确保设置为 **"Embed & Sign"**

### 方式二：Swift Package Manager

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/doopush/doopush-ios-sdk.git", from: "1.2.0")
]
```

或在 Xcode 中：
1. **File** → **Add Package Dependencies**
2. 输入：`https://github.com/doopush/doopush-ios-sdk.git`
3. 点击 **Add Package**

### 方式三：CocoaPods

```ruby
# Podfile
target 'YourApp' do
  pod 'DooPushSDK', '~> 1.2'
end
```

```bash
pod install
```

## ⚙️ 基础配置

### 1. 导入 SDK

在需要使用 SDK 的文件中导入：

```swift
import DooPushSDK
```

### 2. 配置推送权限

在 `Info.plist` 中添加推送权限说明：

```xml
<key>NSUserNotificationCenterDelegate</key>
<true/>
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

### 3. 配置推送环境

确保您的应用配置了正确的推送证书：

- **开发环境**：使用开发推送证书
- **生产环境**：使用分发推送证书

## 🚀 快速开始

### 1. SDK 初始化

在 `AppDelegate` 或 `App` 结构中初始化 SDK：

```swift
import SwiftUI
import DooPushSDK

@main
struct YourApp: App {
    init() {
        // 配置 DooPush SDK
        DooPushManager.shared.configure(
            appId: "your_app_id_here",
            apiKey: "your_api_key_here"
        )
        
        // 设置代理
        DooPushManager.shared.delegate = PushNotificationManager.shared
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### 2. 创建推送管理器

创建一个管理器来处理推送相关的回调：

```swift
import DooPushSDK
import UserNotifications

class PushNotificationManager: NSObject, ObservableObject, DooPushDelegate {
    static let shared = PushNotificationManager()
    
    @Published var isRegistered = false
    @Published var deviceToken: String?
    @Published var deviceId: String?
    @Published var lastError: Error?
    @Published var notifications: [NotificationInfo] = []
    
    override init() {
        super.init()
        setupNotificationCenter()
    }
    
    private func setupNotificationCenter() {
        UNUserNotificationCenter.current().delegate = self
    }
    
    // MARK: - 推送注册
    
    func registerForPushNotifications() {
        DooPushManager.shared.registerForPushNotifications { [weak self] token, error in
            DispatchQueue.main.async {
                if let token = token {
                    self?.deviceToken = token
                    self?.isRegistered = true
                    print("✅ 推送注册成功: \(token)")
                } else if let error = error {
                    self?.lastError = error
                    print("❌ 推送注册失败: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // MARK: - DooPushDelegate
    
    func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String) {
        DispatchQueue.main.async {
            self.deviceToken = token
            self.deviceId = manager.getDeviceId()
            self.isRegistered = true
            print("✅ 设备注册成功: \(token)")
        }
    }
    
    func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any]) {
        DispatchQueue.main.async {
            let notification = NotificationInfo(userInfo: userInfo)
            self.notifications.insert(notification, at: 0)
            print("📱 接收到推送: \(notification.title ?? "无标题")")
        }
    }
    
    func dooPush(_ manager: DooPushManager, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.lastError = error
            print("❌ 推送服务错误: \(error.localizedDescription)")
        }
    }
    
    func dooPushDidUpdateDeviceInfo(_ manager: DooPushManager) {
        DispatchQueue.main.async {
            self.deviceId = manager.getDeviceId()
            print("🔄 设备信息已更新")
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension PushNotificationManager: UNUserNotificationCenterDelegate {
    
    // 应用在前台时收到通知
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // 显示通知横幅和声音
        completionHandler([.banner, .sound, .badge])
    }
    
    // 用户点击通知时调用
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        
        // 处理自定义载荷
        if let customData = userInfo["custom_data"] as? [String: Any] {
            handleCustomAction(customData)
        }
        
        completionHandler()
    }
    
    private func handleCustomAction(_ customData: [String: Any]) {
        // 根据自定义数据执行相应操作
        if let action = customData["action"] as? String {
            switch action {
            case "open_page":
                if let page = customData["page"] as? String {
                    print("📱 打开页面: \(page)")
                    // 导航到指定页面
                }
            case "open_url":
                if let urlString = customData["url"] as? String,
                   let url = URL(string: urlString) {
                    print("🔗 打开链接: \(url)")
                    // 打开外部链接
                }
            default:
                print("🤷‍♂️ 未知操作: \(action)")
            }
        }
    }
}
```

### 3. 通知数据模型

创建一个数据模型来管理通知信息：

```swift
import Foundation

struct NotificationInfo: Identifiable, Hashable {
    let id = UUID()
    let title: String?
    let body: String?
    let badge: Int?
    let sound: String?
    let customData: [String: Any]?
    let receivedAt: Date
    
    init(userInfo: [AnyHashable: Any]) {
        self.receivedAt = Date()
        
        if let aps = userInfo["aps"] as? [String: Any] {
            if let alert = aps["alert"] as? [String: Any] {
                self.title = alert["title"] as? String
                self.body = alert["body"] as? String
            } else if let alertString = aps["alert"] as? String {
                self.title = nil
                self.body = alertString
            } else {
                self.title = nil
                self.body = nil
            }
            
            self.badge = aps["badge"] as? Int
            self.sound = aps["sound"] as? String
        } else {
            self.title = nil
            self.body = nil
            self.badge = nil
            self.sound = nil
        }
        
        // 提取自定义数据
        var custom: [String: Any] = [:]
        for (key, value) in userInfo {
            if let keyString = key as? String, keyString != "aps" {
                custom[keyString] = value
            }
        }
        self.customData = custom.isEmpty ? nil : custom
    }
    
    // 实现 Hashable
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: NotificationInfo, rhs: NotificationInfo) -> Bool {
        lhs.id == rhs.id
    }
}
```

## 🎛️ 核心功能

### 推送注册

```swift
// 注册推送通知
DooPushManager.shared.registerForPushNotifications { token, error in
    if let token = token {
        print("注册成功: \(token)")
        // 保存 token 或更新 UI
    } else if let error = error {
        print("注册失败: \(error.localizedDescription)")
        // 处理错误
    }
}
```

### 获取设备信息

```swift
// 获取设备 Token（注册成功后才有值）
let deviceToken = DooPushManager.shared.getDeviceToken()

// 获取设备 ID（服务端分配的内部 ID，注册成功后才有值）
let deviceId = DooPushManager.shared.getDeviceId()

// 检查是否已注册：以是否拿到了 deviceToken 判定
let isRegistered = (DooPushManager.shared.getDeviceToken() != nil)
```

### 角标管理

```swift
// 设置角标数量（completion 可选）
DooPushManager.shared.setBadgeNumber(5)

// 清除角标
DooPushManager.shared.clearBadge()

// 增加角标（默认 +1）
DooPushManager.shared.incrementBadgeNumber()

// 减少角标（默认 -1，最小 0）
DooPushManager.shared.decrementBadgeNumber()

// 获取当前角标
let current = DooPushManager.shared.getCurrentBadgeNumber()
```

### 推送权限检查

```swift
DooPushManager.shared.checkPushPermissionStatus { status in
    switch status {
    case .authorized:
        print("✅ 推送权限已授权")
    case .denied:
        print("❌ 推送权限被拒绝")
    case .notDetermined:
        print("🤔 推送权限未确定")
    case .provisional:
        print("⚠️ 临时推送权限")
    case .ephemeral:
        print("📱 临时应用推送权限")
    @unknown default:
        print("❓ 未知推送权限状态")
    }
}
```

## 📱 界面集成示例

### SwiftUI 主界面

```swift
import SwiftUI
import DooPushSDK

struct ContentView: View {
    @StateObject private var pushManager = PushNotificationManager.shared
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                // SDK 状态卡片
                statusCard
                
                // 操作按钮
                actionButtons
                
                // 通知历史
                notificationHistory
                
                Spacer()
            }
            .padding()
            .navigationTitle("DooPush 示例")
        }
    }
    
    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("SDK 状态")
                .font(.headline)
            
            HStack {
                Text("注册状态:")
                Spacer()
                Text(pushManager.isRegistered ? "✅ 已注册" : "❌ 未注册")
                    .foregroundColor(pushManager.isRegistered ? .green : .red)
            }
            
            if let deviceToken = pushManager.deviceToken {
                HStack {
                    Text("设备 Token:")
                    Spacer()
                    Text("\(String(deviceToken.prefix(16)))...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            if let deviceId = pushManager.deviceId {
                HStack {
                    Text("设备 ID:")
                    Spacer()
                    Text(deviceId)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
    
    private var actionButtons: some View {
        VStack(spacing: 15) {
            Button("注册推送通知") {
                pushManager.registerForPushNotifications()
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.blue)
            .foregroundColor(.white)
            .cornerRadius(10)
            
            HStack(spacing: 15) {
                Button("设置角标 (5)") {
                    DooPushManager.shared.setBadgeNumber(5)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.orange)
                .foregroundColor(.white)
                .cornerRadius(8)
                
                Button("清除角标") {
                    DooPushManager.shared.clearBadge()
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.gray)
                .foregroundColor(.white)
                .cornerRadius(8)
            }
        }
    }
    
    private var notificationHistory: some View {
        VStack(alignment: .leading) {
            Text("通知历史 (\(pushManager.notifications.count))")
                .font(.headline)
            
            List(pushManager.notifications) { notification in
                VStack(alignment: .leading, spacing: 5) {
                    if let title = notification.title {
                        Text(title)
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }
                    
                    if let body = notification.body {
                        Text(body)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Text(notification.receivedAt, style: .time)
                        .font(.caption2)
                        .foregroundColor(.tertiary)
                }
            }
            .frame(maxHeight: 200)
        }
    }
}
```

## 🔧 高级配置

### 1. 自定义服务器地址

```swift
DooPushManager.shared.configure(
    appId: "your_app_id",
    apiKey: "your_api_key",
    baseURL: "https://your-custom-server.com/api/v1"
)
```

### 2. 调试模式

通过 `DooPushLogger` 调整 SDK 日志级别（`.verbose` / `.debug` / `.info` / `.warning` / `.error`）：

```swift
// 在 configure 之前设置，建议 Debug 构建用 .debug，Release 用 .warning
DooPushLogger.logLevel = .debug

// 也可以接管日志输出（例如转发到 Crashlytics / 公司日志系统）
DooPushLogger.logCallback = { level, tag, message in
    // 自行处理
}
```

## 📋 API 参考

### DooPushManager

#### 配置方法

```swift
// 完整配置（baseURL 默认 https://doopush.com/api/v1）
func configure(appId: String, apiKey: String, baseURL: String = "https://doopush.com/api/v1")

// Objective-C 友好的便捷重载
func configure(appId: String, apiKey: String)
```

#### 推送注册

```swift
// 注册推送通知
func registerForPushNotifications(completion: @escaping (String?, Error?) -> Void)

// 检查推送权限
func checkPushPermissionStatus(completion: @escaping (UNAuthorizationStatus) -> Void)

// APNs 系统回调（在 AppDelegate 中转发）
func didRegisterForRemoteNotifications(with deviceToken: Data)
func didFailToRegisterForRemoteNotifications(with error: Error)
```

#### 设备信息

```swift
// 设备 Token（注册成功后非 nil）
func getDeviceToken() -> String?

// 服务端分配的设备 ID（注册成功后非 nil）
func getDeviceId() -> String?

// 主动同步最新设备信息到服务端
func updateDeviceInfo()

// SDK 版本（静态属性）
static var sdkVersion: String { get }
```

#### 角标管理

```swift
// 设置 / 清除 / 增减角标（completion 可选）
func setBadgeNumber(_ number: Int, completion: ((Error?) -> Void)? = nil)
func clearBadge(completion: ((Error?) -> Void)? = nil)
func incrementBadgeNumber(by increment: Int = 1, completion: ((Error?) -> Void)? = nil)
func decrementBadgeNumber(by decrement: Int = 1, completion: ((Error?) -> Void)? = nil)
func getCurrentBadgeNumber() -> Int
```

#### 推送通知事件

```swift
// 通知到达时调用，用于触发统计上报
func handleNotification(_ userInfo: [AnyHashable: Any]) -> Bool

// 用户点击 / 打开通知时调用
func handleNotificationClick(_ userInfo: [AnyHashable: Any]) -> Bool
func handleNotificationOpen(_ userInfo: [AnyHashable: Any]) -> Bool

// 主动批量上报排队中的统计事件
func reportStatistics()
```

#### WebSocket 长连接

```swift
// 主动建立 / 关闭与 Gateway 的 WebSocket 连接
// 当前作用：维护设备「在线」状态信号；server→client 推送尚未实现
func connectWebSocket()
func disconnectWebSocket()
```

### DooPushDelegate

```swift
@objc public protocol DooPushDelegate: AnyObject {
    // 注册成功
    @objc func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String)

    // 收到推送通知
    @objc func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any])

    // 发生错误
    @objc func dooPush(_ manager: DooPushManager, didFailWithError error: Error)

    // 设备信息更新成功（可选）
    @objc optional func dooPushDidUpdateDeviceInfo(_ manager: DooPushManager)

    // 推送权限状态变更（可选，传入 UNAuthorizationStatus 的 rawValue）
    @objc optional func dooPush(_ manager: DooPushManager, didChangePermissionStatus status: Int)

    // 用户点击通知（可选）— v1.2.0+
    @objc optional func dooPush(_ manager: DooPushManager, didClickNotification userInfo: [AnyHashable: Any])

    // 通知导致应用打开（可选）— v1.2.0+
    @objc optional func dooPush(_ manager: DooPushManager, didOpenNotification userInfo: [AnyHashable: Any])

    // Gateway WebSocket 已连接（可选）— v1.2.0+
    @objc optional func dooPushGatewayDidOpen(_ manager: DooPushManager)

    // Gateway WebSocket 已关闭（可选）— v1.2.0+
    @objc optional func dooPush(_ manager: DooPushManager, gatewayDidCloseWithCode code: Int, reason: String?)

    // Gateway WebSocket 连接失败（可选）— v1.2.0+
    @objc optional func dooPush(_ manager: DooPushManager, gatewayDidFailWithError error: Error)
}
```

## 🤝 第三方 SDK 共存（v1.1.0+）

如果你已经在用 `expo-notifications`、`react-native-firebase`、自定义 APNs 集成或其它推送 SDK，可以让 DooPush 切到 **passive 模式**：不请求权限、不接管 `UNUserNotificationCenterDelegate`、不调 `registerForRemoteNotifications`，由调用方拿到 token 后通过 `registerDevice(withToken:vendor:completion:)` 完成 DooPush 服务端注册。

```swift
// 切到 passive 模式（默认 .active）
DooPushManager.shared.setNotificationManagementMode(.passive)

// 用调用方拿到的 token（APNs hex 字符串）直接注册到 DooPush
DooPushManager.shared.registerDevice(
    withToken: tokenFromHostSDK,
    vendor: "apns" // iOS 端传 nil 也会默认按 "apns" 处理
) { deviceId, error in
    if let deviceId = deviceId {
        print("DooPush 已注册，deviceId=\(deviceId)")
    } else if let error = error {
        print("DooPush 注册失败: \(error.localizedDescription)")
    }
}
```

> 切换模式只决定 SDK 是否自动安装通知 delegate / 请求权限 / 调系统注册接口；统计上报、Gateway WebSocket、角标 API 在两种模式下都可用。

## 🔍 调试和测试

### 1. 检查集成状态

```swift
// 通过是否拿到 deviceToken 判断 SDK 是否完成注册
if let token = DooPushManager.shared.getDeviceToken() {
    print("✅ SDK 已注册，token 前缀: \(token.prefix(12))…")
} else {
    print("❌ SDK 未注册（请确认已调用 configure 与 registerForPushNotifications）")
}

// 获取 SDK 版本（静态属性）
print("SDK 版本: \(DooPushManager.sdkVersion)")
```

### 2. 推送测试

1. 在应用中获取设备 Token
2. 复制 Token 到 DooPush 管理后台
3. 发送测试推送
4. 检查应用是否收到推送

### 3. 常见问题排查

**推送注册失败**：
- 检查应用是否配置了推送证书
- 确认设备网络连接正常
- 验证 API Key 和 App ID 是否正确

**收不到推送**：
- 确认用户已授权推送权限
- 检查设备 Token 是否有效
- 验证推送证书是否匹配当前环境

## ❓ 常见问题

### Q: SDK 支持哪些 iOS 版本？
A: DooPush SDK 支持 iOS 13.0 及以上版本。

### Q: 如何获取推送证书？
A: 请参考 [推送配置文档](/guide/settings.md#ios-推送配置) 了解详细步骤。

### Q: 可以在模拟器上测试推送吗？
A: 不可以。推送通知需要在真实设备上测试。

### Q: 如何处理推送点击事件？
A: 实现 `UNUserNotificationCenterDelegate` 的 `didReceive response` 方法。

### Q: SDK 会自动上报推送统计吗？
A: 是的，SDK 会自动上报推送接收和点击统计。

---

*通过以上步骤，您可以成功集成 DooPush iOS SDK 并开始接收推送通知。如有问题，请参考示例项目或联系技术支持。*

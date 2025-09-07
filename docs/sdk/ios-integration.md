# iOS SDK 集成指南

DooPush iOS SDK 为您的 iOS 应用提供简单易用的推送通知功能。本指南将帮助您在 30 分钟内完成 SDK 集成并开始接收推送通知。

## 📋 系统要求

- **iOS 版本**：iOS 14.0 或更高版本
- **Xcode 版本**：Xcode 13.0 或更高版本
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
    .package(url: "https://github.com/doopush/doopush-ios-sdk.git", from: "1.0.0")
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
  pod 'DooPushSDK', '~> 1.0'
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
            self.deviceId = manager.deviceId
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
            self.deviceId = manager.deviceId
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
// 获取设备 Token
let deviceToken = DooPushManager.shared.deviceToken

// 获取设备 ID
let deviceId = DooPushManager.shared.deviceId

// 检查注册状态
let isRegistered = DooPushManager.shared.isRegistered
```

### 角标管理

```swift
// 设置角标数量
DooPushManager.shared.setBadgeNumber(5)

// 清除角标
DooPushManager.shared.clearBadge()

// 增加角标
DooPushManager.shared.incrementBadge()

// 减少角标
DooPushManager.shared.decrementBadge()
```

### 推送权限检查

```swift
DooPushManager.shared.checkNotificationPermission { status in
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

```swift
// 启用调试日志
DooPushManager.shared.setDebugMode(true)
```

### 3. 配置文件方式

创建 `DooPushConfig.plist` 文件：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>APP_ID</key>
    <string>your_app_id_here</string>
    <key>API_KEY</key>
    <string>your_api_key_here</string>
    <key>BASE_URL</key>
    <string>https://doopush.com/api/v1</string>
    <key>DEBUG_MODE</key>
    <true/>
</dict>
</plist>
```

然后在代码中加载配置：

```swift
DooPushManager.shared.configureFromPlist()
```

## 📋 API 参考

### DooPushManager

#### 配置方法

```swift
// 基础配置
func configure(appId: String, apiKey: String)

// 完整配置
func configure(appId: String, apiKey: String, baseURL: String?)

// 从配置文件加载
func configureFromPlist(fileName: String = "DooPushConfig")
```

#### 推送注册

```swift
// 注册推送通知
func registerForPushNotifications(completion: @escaping (String?, Error?) -> Void)

// 检查权限状态
func checkNotificationPermission(completion: @escaping (UNAuthorizationStatus) -> Void)
```

#### 设备信息

```swift
// 设备 Token（只读）
var deviceToken: String? { get }

// 设备 ID（只读）
var deviceId: String? { get }

// 注册状态（只读）
var isRegistered: Bool { get }
```

#### 角标管理

```swift
// 设置角标数量
func setBadgeNumber(_ number: Int)

// 清除角标
func clearBadge()

// 增加角标
func incrementBadge()

// 减少角标
func decrementBadge()
```

#### 调试功能

```swift
// 设置调试模式
func setDebugMode(_ enabled: Bool)

// 获取 SDK 版本
var sdkVersion: String { get }
```

### DooPushDelegate

```swift
protocol DooPushDelegate: AnyObject {
    // 注册成功回调
    func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String)
    
    // 接收推送通知
    func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any])
    
    // 错误回调
    func dooPush(_ manager: DooPushManager, didFailWithError error: Error)
    
    // 设备信息更新回调
    func dooPushDidUpdateDeviceInfo(_ manager: DooPushManager)
}
```

## 🔍 调试和测试

### 1. 检查集成状态

```swift
// 检查 SDK 是否正确配置
if DooPushManager.shared.isConfigured {
    print("✅ SDK 已配置")
} else {
    print("❌ SDK 未配置")
}

// 获取配置信息
print("App ID: \(DooPushManager.shared.appId ?? "未设置")")
print("SDK 版本: \(DooPushManager.shared.sdkVersion)")
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
A: DooPush SDK 支持 iOS 14.0 及以上版本。

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

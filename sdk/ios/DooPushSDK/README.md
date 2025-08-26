# DooPushSDK for iOS

[![Swift](https://img.shields.io/badge/Swift-5.9+-orange.svg)](https://swift.org)
[![Platform](https://img.shields.io/badge/Platform-iOS%2012.0+-blue.svg)](https://developer.apple.com/ios/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

简单易用的 iOS 推送通知 SDK，为移动应用提供统一的推送解决方案。

## 系统要求

- iOS 12.0+
- Xcode 16.0+
- Swift 5.9+

## 集成方式

### Framework 集成 (推荐)

1. 生成 Framework
```bash
./scripts/build.sh
```

2. 将 `DooPushSDK.framework` 拖拽到项目中，设置为 "Embed & Sign"

### Swift Package Manager（开发环境推荐）

在 Xcode 中：File → Add Package Dependencies，输入本地路径或 Git URL

### CocoaPods

```ruby
pod 'DooPushSDK', :path => 'path/to/DooPushSDK'
```

## 快速开始

### 1. 配置 SDK

```swift
import DooPushSDK

func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // 配置 DooPushSDK
    DooPushManager.shared.configure(
        appId: "your_app_id",
        apiKey: "your_api_key",
        baseURL: "http://localhost:5002/api/v1" // 可选，用于本地开发
    )
    
    // 设置代理
    DooPushManager.shared.delegate = self
    
    // 启用开发模式日志（可选）
    DooPushLogger.enableDevelopmentMode()
    
    return true
}
```

### 2. 注册推送通知

```swift
DooPushManager.shared.registerForPushNotifications { token, error in
    if let token = token {
        print("推送注册成功，设备token: \(token)")
    } else if let error = error {
        print("推送注册失败: \(error.localizedDescription)")
    }
}
```

### 3. 处理推送通知

在 `AppDelegate` 中添加：

```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    DooPushManager.shared.didRegisterForRemoteNotifications(with: deviceToken)
}

func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    DooPushManager.shared.didFailToRegisterForRemoteNotifications(with: error)
}

func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) {
    DooPushManager.shared.handleNotification(userInfo)
}

// MARK: - DooPush 代理方法
extension AppDelegate: DooPushDelegate {
    func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String) {
        print("✅ 设备注册成功: \(token)")
    }
    
    func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any]) {
        print("🔔 收到推送通知: \(userInfo)")
    }
    
    func dooPush(_ manager: DooPushManager, didFailWithError error: Error) {
        print("❌ DooPush 错误: \(error.localizedDescription)")
    }
}
```

## 高级功能

### 日志配置

```swift
// 开发模式
DooPushLogger.enableDevelopmentMode()

// 生产模式
DooPushLogger.enableProductionMode()
```

### 设备管理

```swift
// 手动更新设备信息
DooPushManager.shared.updateDeviceInfo()

// 获取设备 token
let token = DooPushManager.shared.getDeviceToken()

// 检查推送权限
DooPushManager.shared.checkPushPermissionStatus { status in
    // 处理权限状态
}
```

## API 参考

### DooPushManager

- `configure(appId:apiKey:baseURL:)` - 配置 SDK
- `registerForPushNotifications(completion:)` - 注册推送通知
- `handleNotification(_:)` - 处理推送通知
- `updateDeviceInfo()` - 更新设备信息
- `getDeviceToken()` - 获取设备 token

### DooPushDelegate

- `dooPush(_:didRegisterWithToken:)` - 设备注册成功
- `dooPush(_:didReceiveNotification:)` - 收到推送通知
- `dooPush(_:didFailWithError:)` - 发生错误

## 开发工具

```bash
# Framework构建
./scripts/build.sh

# 运行测试
swift test

# CocoaPods验证
pod spec lint DooPushSDK.podspec --verbose
```

## 许可证

MIT 许可证，详见 [LICENSE](LICENSE) 文件。
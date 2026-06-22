# DooPushSDK for iOS

[![Swift](https://img.shields.io/badge/Swift-5.9+-orange.svg)](https://swift.org)
[![Platform](https://img.shields.io/badge/Platform-iOS%2013.0+-blue.svg)](https://developer.apple.com/ios/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

简单易用的 iOS 推送通知 SDK，为移动应用提供统一的推送解决方案。

## 系统要求

- iOS 13.0+
- Xcode 16.0+
- Swift 5.9+

## 集成方式

### Framework 集成 (推荐)

1. 生成 Framework
```bash
./scripts/build.sh
```
或者前往 [DooPush iOS SDK 发布页](https://github.com/doopush/doopush-ios-sdk/releases) 下载最新版 `DooPushSDK.framework`

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
        baseURL: "http://localhost:5001/api/v1" // 可选，用于本地开发
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

// 获取设备ID
let deviceId = DooPushManager.shared.getDeviceId()

// 检查推送权限
DooPushManager.shared.checkPushPermissionStatus { status in
    // 处理权限状态
}
```

### 角标管理

```swift
// 设置角标数字
DooPushManager.shared.setBadgeNumber(5)

// 清除角标
DooPushManager.shared.clearBadge()

// 角标增减操作
DooPushManager.shared.incrementBadgeNumber()  // +1
DooPushManager.shared.decrementBadgeNumber()  // -1

// 获取当前角标
let currentBadge = DooPushManager.shared.getCurrentBadgeNumber()
```

## API 参考

### DooPushManager

#### 核心方法
- `configure(appId:apiKey:baseURL:)` - 配置 SDK
- `registerForPushNotifications(completion:)` - 注册推送通知
- `handleNotification(_:) -> Bool` - 处理推送通知，返回是否处理成功
- `updateDeviceInfo()` - 更新设备信息

#### 设备信息
- `getDeviceToken() -> String?` - 获取设备 token
- `getDeviceId() -> String?` - 获取设备唯一标识
- `checkPushPermissionStatus(completion:)` - 检查推送权限状态

#### 角标管理
- `setBadgeNumber(_:)` - 设置应用角标数字
- `clearBadge()` - 清除应用角标
- `getCurrentBadgeNumber() -> Int` - 获取当前角标数字
- `incrementBadgeNumber(by:)` - 增加角标数字
- `decrementBadgeNumber(by:)` - 减少角标数字

#### 系统回调处理
- `didRegisterForRemoteNotifications(with:)` - 处理系统推送注册成功回调
- `didFailToRegisterForRemoteNotifications(with:)` - 处理系统推送注册失败回调

### DooPushDelegate

#### 必需方法
- `dooPush(_:didRegisterWithToken:)` - 设备注册成功
- `dooPush(_:didReceiveNotification:)` - 收到推送通知
- `dooPush(_:didFailWithError:)` - 发生错误

#### 可选方法
- `dooPushDidUpdateDeviceInfo(_:)` - 设备信息更新成功
- `dooPush(_:didChangePermissionStatus:)` - 推送权限状态变更
- `dooPush(_:didClickNotification:)` - 用户点击通知（v1.2.0+）
- `dooPush(_:didOpenNotification:)` - 通知导致应用打开（v1.2.0+）
- `dooPushGatewayDidOpen(_:)` - Gateway WebSocket 已连接（v1.2.0+）
- `dooPush(_:gatewayDidCloseWithCode:reason:)` - Gateway WebSocket 已关闭（v1.2.0+）
- `dooPush(_:gatewayDidFailWithError:)` - Gateway WebSocket 连接失败（v1.2.0+）

## 开发工具

```bash
# Framework构建
./scripts/build.sh

# 运行测试
swift test

# CocoaPods验证
pod spec lint DooPushSDK.podspec --verbose
```
## 更新日志

### v1.2.1
- **Fix**：加固 Gateway WebSocket 连接生命周期，使连接建立与断开更稳健，并让 teardown 幂等，避免重复拆除时进入异常状态（`harden websocket gateway connection lifecycle` / `make websocket gateway teardown idempotent`）。

### v1.2.0
- 新增 5 个 `DooPushDelegate` 可选方法：通知点击 / 打开（`didClickNotification` / `didOpenNotification`），以及 Gateway WebSocket 连接 / 关闭 / 失败（`dooPushGatewayDidOpen` / `gatewayDidCloseWithCode:reason:` / `gatewayDidFailWithError:`）。
- 与 Android SDK v1.2.0 对齐 `updateDeviceInfo` / 角标 / 权限 API（这些 API 已在更早版本可用，此版本主要是跨端统一）。
- 与 React Native SDK v0.5.0 对齐底座版本。

### v1.1.2
- **chore**：发版流水线连通性测试（无功能变更）。验证 monorepo `sync-ios-sdk.yml` → `doopush-ios-sdk` 公仓 → `auto-build-release.yml` → GitHub Release 全链路。

### v1.1.1
- 修复 podspec 与 React Native（CocoaPods 静态库链接 + Swift module）的兼容性：移除自定义 `module_map`、不存在的 LICENSE 文件引用、`public_header_files` 直接暴露 ObjC 头（Swift `@objc` 已自动暴露）

### v1.1.0
- 新增 `DooPushNotificationManagementMode`（active/passive）以支持第三方 SDK 共存
- 新增 `setNotificationManagementMode(_:)` 切换运行模式
- 新增 `registerDevice(withToken:vendor:completion:)` 用于外部 token（如 expo-notifications）的服务端注册
- 通知代理增加 KVO 自动重装：被第三方替换后自动恢复并向上转发

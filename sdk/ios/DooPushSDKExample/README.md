# DooPush SDK iOS 示例应用

演示 DooPush SDK 完整功能的 iOS 示例应用，包含推送注册、状态监控、通知历史等核心特性。

## 主要功能

- **SDK状态监控**：实时显示SDK配置状态、注册状态、推送权限
- **设备管理**：自动获取设备Token、设备ID，实时更新设备信息
- **推送注册**：一键注册推送通知，支持权限检查和状态反馈
- **通知历史**：接收推送历史记录，支持去重和详情查看
- **角标管理**：应用角标数字的设置、增减、清除操作
- **设置页面**：详细的配置信息展示和调试工具

## 快速开始

### 1. 运行应用
```bash
open DooPushSDKExample.xcodeproj
```

### 2. 配置参数

#### DooPushLocalConfig.plist 配置

在 `DooPushSDKExample/` 目录下创建 `DooPushLocalConfig.plist` 文件：

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
    <string>https://your-server.com/api/v1</string>
</dict>
</plist>
```

**配置说明：**
- `APP_ID`: DooPush 应用ID
- `API_KEY`: DooPush API密钥
- `BASE_URL`: 服务器基础URL（包含API版本路径）

**注意：** 此文件已添加到 `.gitignore`，不会被版本控制。

### 3. 基本流程
1. 启动应用，SDK自动初始化
2. 点击"注册推送通知"并授权权限
3. 查看设备信息和推送状态
4. 通过 DooPush 后台发送测试推送
5. 在通知历史中查看接收的推送

## 代码结构

```
DooPushSDKExample/
├── DooPushSDKExampleApp.swift      # 应用入口和SDK配置
├── ContentView.swift               # 主界面 - 状态展示和操作
├── SettingsView.swift              # 设置页面 - 配置和调试信息
├── NotificationDetailView.swift    # 通知详情页面 - 推送内容查看
├── PushNotificationManager.swift   # 推送管理器 - SDK代理实现
├── Config.swift                    # 配置管理 - 多级配置支持
└── Logger.swift                    # 日志管理
```

## 核心实现

**PushNotificationManager**: 实现 `DooPushDelegate` 协议，处理所有SDK回调：
- 设备注册成功/失败
- 推送通知接收
- 权限状态变更
- 设备信息更新

## 测试推送

1. 登录 DooPush 管理后台
2. 选择应用 > 推送配置 > iOS配置
3. 使用示例应用中的设备Token发送测试推送
4. 在应用中查看推送接收状态和通知详情

## SDK集成示例

```swift
import DooPushSDK

// 1. 配置SDK
DooPushManager.shared.configure(
    appId: "your_app_id",
    apiKey: "your_api_key"
)

// 2. 设置代理
DooPushManager.shared.delegate = self

// 3. 注册推送通知
DooPushManager.shared.registerForPushNotifications { token, error in
    if let token = token {
        print("注册成功: \(token)")
    } else if let error = error {
        print("注册失败: \(error.localizedDescription)")
    }
}
```

```swift
// 4. 实现代理方法
extension YourClass: DooPushDelegate {

    // 注册成功回调
    func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String) {
        print("设备注册成功: \(token)")
    }

    // 接收推送通知
    func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any]) {
        // 处理推送通知
        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: Any],
           let title = alert["title"] as? String,
           let body = alert["body"] as? String {
            print("收到推送: \(title) - \(body)")
        }
    }

    // 注册失败回调
    func dooPush(_ manager: DooPushManager, didFailWithError error: Error) {
        print("推送服务错误: \(error.localizedDescription)")
    }

    // 设备信息更新回调
    func dooPushDidUpdateDeviceInfo(_ manager: DooPushManager) {
        print("设备信息已更新")
    }
}
```

## 技术要求

- iOS 14.0+
- Xcode 13.0+
- Swift 5.5+
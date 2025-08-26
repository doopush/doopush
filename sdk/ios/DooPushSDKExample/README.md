# DooPush SDK iOS 示例应用

演示如何集成和使用 DooPush SDK 的完整 iOS 示例应用。

## 应用配置

通过DooPush后台创建应用，获取应用ID、API密钥、服务器地址、Bundle ID。

## 快速开始

### 1. 运行应用
```bash
open DooPushSDKExample.xcodeproj
```

### 2. 基本流程
1. 启动应用，SDK自动初始化
2. 点击"注册推送通知"并授权权限
3. 通过 DooPush 后台发送测试推送
4. 查看接收到的推送历史

## 代码结构

```
DooPushSDKExample/
├── DooPushSDKExampleApp.swift      # 应用入口和SDK配置
├── ContentView.swift               # 主界面
├── PushNotificationManager.swift  # 推送管理器
├── SettingsView.swift              # 设置页面
└── NotificationDetailView.swift    # 通知详情
```

### 关键实现

**PushNotificationManager**: 实现 `DooPushDelegate` 协议，处理SDK回调和推送管理。

## 测试推送

1. 登录 DooPush 管理后台
2. 选择应用 (App ID: 1)
3. 找到注册的设备并发送测试消息

## 集成到你的应用

```swift
import DooPushSDK

// 配置SDK
DooPushManager.shared.configure(
    appId: "your_app_id",
    apiKey: "your_api_key", 
    baseURL: "your_server_url"
)

// 注册推送
DooPushManager.shared.registerForPushNotifications { token, error in
    // 处理结果
}
```

## 技术要求

- iOS 14.0+
- Xcode 13.0+
- Swift 5.5+
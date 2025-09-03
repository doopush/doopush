# DooPush SDK Objective-C 示例应用

演示 DooPush SDK Objective-C 版本的完整功能，包含推送注册、状态监控、通知历史等核心特性。

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
open DooPushSDKExample-ObjC.xcodeproj
```

### 2. 配置参数

#### DooPushLocalConfig.plist 配置

在 `DooPushSDKExample-ObjC/` 目录下创建 `DooPushLocalConfig.plist` 文件：

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
DooPushSDKExample-ObjC/
├── AppDelegate.h/m                         # 应用入口和SDK配置
├── ViewController.h/m                      # 主界面 - 状态展示和操作
├── SettingsViewController.h/m              # 设置页面 - 配置和调试信息
├── NotificationDetailViewController.h/m    # 通知详情页面 - 推送内容查看
├── PushNotificationManager.h/m             # 推送管理器 - SDK代理实现
├── AppConfig.h/m                           # 配置管理 - 多级配置支持
├── Logger.h/m                              # 日志管理
└── NotificationInfo.h                      # 通知信息模型
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

```objc
#import "AppDelegate.h"
@import DooPushSDK;

// 1. 配置SDK
- (void)configurePushSDK {
    [DooPushManager.shared configureWithAppId:@"your_app_id" apiKey:@"your_api_key"];

    // 2. 设置代理
    DooPushManager.shared.delegate = self;

    // 3. 注册推送通知
    [DooPushManager.shared registerForPushNotificationsWithCompletion:^(NSString * _Nullable token, NSError * _Nullable error) {
        if (token) {
            NSLog(@"注册成功: %@", token);
        } else {
            NSLog(@"注册失败: %@", error.localizedDescription);
        }
    }];
}
```

```objc
// 4. 实现代理方法
@interface YourViewController () <DooPushDelegate>
@end

@implementation YourViewController

// 注册成功回调
- (void)dooPush:(DooPushManager *)manager didRegisterWithToken:(NSString *)token {
    NSLog(@"设备注册成功: %@", token);
}

// 接收推送通知
- (void)dooPush:(DooPushManager *)manager didReceiveNotification:(NSDictionary *)userInfo {
    // 处理推送通知
    NSDictionary *aps = userInfo[@"aps"];
    if (aps) {
        NSDictionary *alert = aps[@"alert"];
        NSString *title = alert[@"title"];
        NSString *body = alert[@"body"];
        NSLog(@"收到推送: %@ - %@", title, body);
    }
}

// 注册失败回调
- (void)dooPush:(DooPushManager *)manager didFailWithError:(NSError *)error {
    NSLog(@"推送服务错误: %@", error.localizedDescription);
}

// 设备信息更新回调
- (void)dooPushDidUpdateDeviceInfo:(DooPushManager *)manager {
    NSLog(@"设备信息已更新");
}

@end
```

## 技术要求

- iOS 12.0+
- Xcode 12.0+
- DooPush SDK（通过 Swift Package Manager 导入）

# DooPush SDK Objective-C Example

这是 DooPush SDK 的 Objective-C 版本示例应用，对应 Swift 版本的 DooPushSDKExample。

## 项目结构

### 核心类文件

- **AppConfig.h/m** - 配置管理类，统一管理 App ID、API Key、服务器地址等配置
- **Logger.h/m** - 日志管理类，提供统一的日志输出功能
- **PushNotificationManager.h/m** - 推送管理器，实现 DooPushDelegate 协议，管理推送状态和通知历史
- **NotificationInfo** - 通知信息模型类，封装推送通知的详细信息

### 界面控制器

- **ViewController.h/m** - 主界面控制器，显示 SDK 状态、设备信息、操作按钮和通知历史
- **SettingsViewController.h/m** - 设置页面，显示详细的配置信息、设备信息和角标管理
- **NotificationDetailViewController.h/m** - 通知详情页面，显示推送通知的完整信息

### 应用配置

- **AppDelegate.h/m** - 应用代理，配置 DooPush SDK 并处理推送回调
- **SceneDelegate.h/m** - 场景代理（保持原有配置）

## 功能特性

### 主界面功能
- 显示 SDK 状态和推送权限状态
- 显示设备信息（Token、设备 ID、型号、系统版本）
- 推送注册和设备信息更新
- 权限检查和设置跳转
- 通知历史列表（最多显示 5 条）
- 下拉刷新功能
- Toast 提示消息

### 设置页面功能
- SDK 配置信息查看和复制
- 详细设备信息展示
- 调试信息查看
- 角标管理（设置、增减、清除）
- 操作功能（重新注册、更新设备、清空历史）
- 关于信息

### 通知详情功能
- 显示推送通知的完整信息
- 附加数据的格式化显示
- 时间信息（绝对时间和相对时间）
- 复制功能（完整信息、JSON 格式）

## 与 Swift 版本的对应关系

| Swift 版本 | Objective-C 版本 | 说明 |
|-----------|------------------|------|
| DooPushSDKExampleApp.swift | AppDelegate.m | 应用入口和 SDK 配置 |
| ContentView.swift | ViewController.m | 主界面UI和交互 |
| SettingsView.swift | SettingsViewController.m | 设置页面 |
| NotificationDetailView.swift | NotificationDetailViewController.m | 通知详情页面 |
| PushNotificationManager.swift | PushNotificationManager.m | 推送管理器 |
| Config.swift | AppConfig.m | 配置管理 |
| Logger.swift | Logger.m | 日志管理 |

## 技术实现

### UI架构
- 使用 UIKit 和 Storyboard（需要手动创建界面约束）
- TableView 用于设置页面和通知详情页面
- 自定义 Toast 视图用于消息提示
- 支持下拉刷新和自适应布局

### 数据管理
- 使用单例模式管理推送状态
- 回调机制更新UI状态
- 通知历史本地存储（最多50条）

### 推送集成
- 实现 DooPushDelegate 协议
- 处理推送注册和接收回调
- 错误处理和用户友好提示

## 开发注意事项

### 需要完成的工作

1. **Storyboard 配置** - 需要在 Main.storyboard 中创建界面布局和 IBOutlet 连接
2. **项目配置** - 确保 Swift Package Manager 正确导入 DooPushSDK
3. **推送权限** - 配置推送权限和证书
4. **测试** - 验证各功能模块的正常工作

### 关键连接点

ViewController.m 中定义了大量的 IBOutlet，需要在 Storyboard 中进行连接：

```objc
// 需要连接的 IBOutlet
@property (weak, nonatomic) IBOutlet UIScrollView *scrollView;
@property (weak, nonatomic) IBOutlet UIImageView *appIconImageView;
@property (weak, nonatomic) IBOutlet UILabel *titleLabel;
// ... 等等
```

### 代码风格

- 遵循 Objective-C 命名规范
- 使用 ARC 内存管理
- 详细的错误处理和日志记录
- 中文本地化支持

## 运行要求

- iOS 12.0+
- Xcode 12.0+
- DooPush SDK（通过 Swift Package Manager 导入）

---

**注意**: 此项目已完成所有 Objective-C 代码的转换工作，但仍需要手动配置 Storyboard 界面布局才能正常运行。

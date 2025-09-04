# Android SDK（开发中）

DooPush Android SDK 正在紧张开发中，即将为 Android 应用提供强大的推送通知功能。

## 🚧 开发状态

**当前状态**：开发中  
**预计发布**：敬请期待  
**支持平台**：Android 5.0+ (API Level 21)

## 📱 iOS SDK 现已可用

如果您的应用支持 iOS 平台，可以立即开始使用我们的 iOS SDK：

👉 [**iOS SDK 集成指南**](./ios-integration.md)

## 🎯 Android SDK 预期功能

Android SDK 将提供与 iOS SDK 相同的强大功能：

### 📨 推送通知
- **多厂商支持** - FCM、华为HMS、小米、OPPO、VIVO、荣耀、三星等
- **智能路由** - 根据设备厂商自动选择最佳推送通道
- **统一API** - 一套代码适配所有厂商推送服务

### 🔧 核心功能
- ✅ **设备注册** - 自动注册设备到 DooPush 平台
- ✅ **推送接收** - 接收和处理推送通知
- ✅ **权限管理** - 智能处理推送权限申请
- ✅ **离线消息** - 支持设备离线时的消息缓存
- ✅ **自定义声音** - 支持自定义通知声音和震动
- ✅ **富媒体推送** - 支持图片、视频等富媒体内容

### 📊 数据统计
- ✅ **送达统计** - 实时推送送达率统计
- ✅ **点击分析** - 用户推送点击行为分析
- ✅ **转化追踪** - 推送带来的用户行为转化

### 🎨 界面定制
- ✅ **通知样式** - 自定义通知外观和布局
- ✅ **角标管理** - 应用图标角标数字管理
- ✅ **分组显示** - 通知分组和折叠显示

## 🔧 预期集成方式

### Gradle 依赖（预览）
```groovy
dependencies {
    implementation 'com.doopush:android-sdk:1.0.0'
}
```

### 基础初始化（预览）
```java
// Java
DooPushManager.getInstance()
    .setAppId("your_app_id")
    .setApiKey("your_api_key")
    .initialize(this);
```

```kotlin
// Kotlin
DooPushManager.getInstance()
    .setAppId("your_app_id")
    .setApiKey("your_api_key")
    .initialize(this)
```

### 推送接收（预览）
```java
public class MyPushReceiver extends DooPushReceiver {
    @Override
    public void onNotificationReceived(Context context, DooPushMessage message) {
        // 处理推送消息
        String title = message.getTitle();
        String content = message.getContent();
        Map<String, String> extras = message.getExtras();
    }
    
    @Override
    public void onNotificationClicked(Context context, DooPushMessage message) {
        // 处理推送点击
    }
}
```

## 🏭 厂商推送支持

Android SDK 将支持以下推送通道：

| 厂商 | 推送服务 | 状态 | 说明 |
|------|----------|------|------|
| **Google** | FCM (Firebase Cloud Messaging) | 🔄 开发中 | 海外设备主要通道 |
| **华为** | HMS Push Kit | 🔄 开发中 | 华为设备专用通道 |
| **小米** | 小米推送 | 🔄 开发中 | 小米设备专用通道 |
| **OPPO** | ColorOS 推送 | 🔄 开发中 | OPPO设备专用通道 |
| **VIVO** | vivo 推送 | 🔄 开发中 | VIVO设备专用通道 |
| **荣耀** | 荣耀推送 | 🔄 开发中 | 荣耀设备专用通道 |
| **三星** | Samsung Push | 📋 计划中 | 三星设备专用通道 |

### 智能路由策略

```
设备检测 → 厂商识别 → 通道选择 → 推送发送
    ↓           ↓          ↓         ↓
  手机型号   →  华为HMS   →  华为通道  →  高送达率
  系统信息   →  小米MIUI  →  小米通道  →  低延迟
  应用环境   →  FCM可用   →  FCM通道   →  海外覆盖
```

## 📋 开发计划

### 第一阶段：核心功能
- 🔄 基础SDK框架搭建
- 🔄 FCM推送集成
- 🔄 设备注册和管理
- 🔄 推送接收和处理

### 第二阶段：厂商集成
- 📋 华为HMS Push集成
- 📋 小米推送集成
- 📋 OPPO推送集成
- 📋 VIVO推送集成

### 第三阶段：高级功能
- 📋 富媒体推送支持
- 📋 推送模板系统
- 📋 智能推送策略
- 📋 A/B测试支持

### 第四阶段：优化完善
- 📋 性能优化
- 📋 兼容性测试
- 📋 文档完善
- 📋 示例应用

## 🔔 获取更新通知

想要第一时间了解 Android SDK 的发布进展？

### 1. 关注项目
⭐ **GitHub 仓库**：[DooPush Android SDK](https://github.com/doopush/doopush-android-sdk)

### 2. 邮件订阅
📧 **开发通知**：发送邮件到 [sdk@doopush.com](mailto:sdk@doopush.com) 订阅开发进展

### 3. 技术交流
💬 **开发者群组**：加入我们的开发者社区获取最新消息

## 🤝 参与开发

### Beta 测试计划
我们将在 Android SDK 开发完成后启动 Beta 测试计划：

- **测试时间**：SDK 开发完成后
- **参与方式**：通过邮件或 GitHub Issues 报名
- **测试内容**：核心功能、兼容性、性能测试
- **测试福利**：优先技术支持、功能定制建议权

### 需求反馈
欢迎提前反馈您的需求和建议：

- 📧 **邮件**：[feedback@doopush.com](mailto:feedback@doopush.com)
- 🐛 **GitHub Issues**：[提交功能建议](https://github.com/doopush/doopush/issues)
- 💬 **在线咨询**：通过官网联系我们

## 🎯 目前推荐方案

在 Android SDK 开发完成之前，您可以考虑以下方案：

### 1. 混合开发
- **iOS 应用**：立即使用 DooPush iOS SDK
- **Android 应用**：使用原生厂商推送服务，后期迁移到 DooPush

### 2. 服务端集成
- 使用 DooPush **API 接口** 发送推送
- 客户端使用原生推送服务接收
- 参考：[推送 API 文档](/api/push-apis.md)

### 3. Web 推送
- 如果您有 Web 应用，可以考虑 Web Push 方案
- DooPush 未来也将支持 Web 推送

## ❓ 常见问题

### Q: Android SDK 什么时候发布？
A: 我们正在加快开发进度，具体发布时间请关注官方公告和 GitHub 项目更新。

### Q: 会支持哪些 Android 版本？
A: 计划支持 Android 5.0+ (API Level 21) 及以上版本，覆盖 95% 以上的设备。

### Q: 是否会支持海外推送？
A: 是的，将通过 FCM 支持海外 Android 设备推送。

### Q: 可以提前准备推送证书吗？
A: 可以提前在各厂商开发者平台申请推送服务，SDK 发布后可直接配置使用。

### Q: Android SDK 是否免费？
A: Android SDK 将与 iOS SDK 采用相同的计费策略，具体请参考官网定价说明。

---

*感谢您对 DooPush Android SDK 的关注！我们正在努力为您带来最好的 Android 推送解决方案。*

## 📞 联系我们

如有任何问题或建议，欢迎随时联系：

- 🌐 **官网**：[https://doopush.com](https://doopush.com)
- 📧 **邮箱**：[support@doopush.com](mailto:support@doopush.com)
- 💬 **在线客服**：通过官网右下角聊天窗口
- 🐛 **GitHub**：[https://github.com/doopush/doopush](https://github.com/doopush/doopush)

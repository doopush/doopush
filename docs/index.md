---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "DooPush"
  text: "推送平台帮助文档"
  tagline: 简单易用的推送通知管理平台，支持 iOS 和 Android 多厂商智能推送
  image:
    src: /logo.svg
    alt: DooPush
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 查看 API
      link: /api/authentication

features:
  - title: 🚀 快速接入
    details: 10分钟内完成账号注册、应用创建和首次推送，简单快捷的操作流程让您快速上手
  - title: 📱 多厂商推送
    details: 支持 iOS APNs、Android 多厂商推送（FCM、HMS、小米、OPPO、VIVO），智能路由，统一管理
  - title: 🛠 功能丰富
    details: 支持单推、批量推送、广播推送、定时推送，提供完整的设备管理和推送统计功能
  - title: 🔑 API 接口
    details: 提供完整的 REST API，支持 API Key 认证，让您轻松实现自动化推送
  - title: 📊 数据统计
    details: 详细的推送统计和分析数据，帮助您了解推送效果和用户行为
  - title: 🔒 安全可靠
    details: 企业级安全保障，完整的权限管理和审计日志，确保数据安全
---

## 开始使用

### 🎯 新用户快速入门

如果您是首次使用 DooPush，建议按以下顺序阅读文档：

1. [**快速开始**](/guide/quick-start) - 10分钟完成首次推送
2. [**应用管理**](/guide/apps) - 创建和配置您的应用
3. [**推送功能**](/guide/push) - 学习如何发送推送通知
4. [**iOS SDK 接入**](/sdk/ios-integration) - 在 iOS 应用中集成推送功能
5. [**Android SDK 接入**](/sdk/android-integration) - 在 Android 应用中集成推送功能

### 👨‍💻 开发者资源

- [**API 认证**](/api/authentication) - 了解如何使用 API Key
- [**推送接口**](/api/push-apis) - 完整的推送 API 文档
- [**设备接口**](/api/device-apis) - 设备管理相关接口
- [**数据接口**](/api/data-apis) - 统计数据查询接口

### 📱 平台支持状态

| 平台 | 状态 | 说明 |
|------|------|------|
| iOS | ✅ 已支持 | 完整的 APNs 推送支持，SDK 可用 |
| Android | ✅ 已支持 | 多厂商推送支持，SDK 可用 |

### 🔥 Android 多厂商推送支持

| 厂商 | 状态 | 设备覆盖 |
|------|------|----------|
| Google FCM | ✅ 已支持 | 所有 Android 设备（默认通道）|
| 华为 HMS | ✅ 已支持 | 华为/荣耀设备（国内外）|
| 小米推送 | ✅ 已支持 | 小米/红米设备（MIUI 优化）|
| OPPO推送 | ✅ 已支持 | OPPO/OnePlus 设备（ColorOS 优化）|
| VIVO推送 | ✅ 已支持 | VIVO/iQOO 设备（Origin OS 优化）|

### 🆘 需要帮助？

- 📖 查看 [功能使用指南](/guide/console) 了解详细操作
- 🔗 访问 [GitHub 仓库](https://github.com/doopush/doopush) 查看源码
- 💬 如有问题，请在 GitHub 提交 [Issue](https://github.com/doopush/doopush/issues)

---

**DooPush 是一个现代化的推送通知管理平台，支持 iOS 和 Android 多厂商智能推送，致力于为开发者提供简单易用、功能强大的推送解决方案。**

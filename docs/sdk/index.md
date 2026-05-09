# SDK 接入文档

DooPush 为移动应用提供完整的跨平台推送解决方案，支持 iOS、Android 与 React Native。

## 📱 平台支持

| 平台 | 状态 | SDK 版本 | 说明 |
|------|------|----------|------|
| **iOS** | ✅ 已支持 | v1.2.0 | 原生 APNs 集成，生产可用 |
| **Android** | ✅ 已支持 | v1.2.0 | 多厂商推送支持，生产可用 |
| **React Native** | ✅ 已支持 | v0.5.0 | 基于 Expo Modules 的 RN/Expo 接入层，支持 APNs、FCM 与 6 类 Android OEM 通道，生产可用 |

## 📖 iOS SDK 文档

### 🚀 快速集成
- [**iOS 集成指南**](./ios-integration.md) - 完整的 iOS SDK 集成文档

### 📋 集成方式
- **Framework** - 直接集成预编译框架（推荐）
- **Swift Package Manager** - SPM 包管理器集成
- **CocoaPods** - Pod 依赖管理集成

### ⚡ 核心功能
- ✅ APNs 推送通知注册和接收
- ✅ 设备 Token 管理和更新
- ✅ 推送权限智能处理
- ✅ 角标（Badge）管理
- ✅ 推送统计自动上报
- ✅ 错误处理和调试工具

## 🤖 Android SDK 文档

### 🚀 快速集成
- [**Android 集成指南**](./android-integration.md) - 完整的 Android SDK 集成文档

### 🏭 多厂商推送支持
| 推送服务 | 支持状态 | 适用设备 |
|----------|----------|----------|
| **Google FCM** | ✅ 完全支持 | 所有 Android 设备 |
| **华为 HMS Push** | ✅ 完全支持 | 华为设备专用 |
| **荣耀推送** | ✅ 完全支持 | 荣耀设备专用 |
| **小米推送** | ✅ 完全支持 | 小米/Redmi 设备专用 |
| **OPPO推送** | ✅ 完全支持 | OPPO/OnePlus 设备专用 |
| **VIVO推送** | ✅ 完全支持 | VIVO/iQOO 设备专用 |
| **魅族推送** | ✅ 完全支持 | 魅族设备专用 |

### ⚡ 核心功能
- ✅ 智能厂商推送路由，自动选择最优通道
- ✅ 统一推送 API，一套代码适配所有厂商
- ✅ 推送通知注册和接收处理
- ✅ 设备 Token 管理和同步
- ✅ 角标（Badge）管理（支持主流桌面）
- ✅ WebSocket 长连接维持设备「在线」状态（OkHttp 实现，server→client 实时消息暂未实现）
- ✅ 推送统计和性能监控
- ✅ 完善的错误处理和调试工具

### 🔧 高级特性
- ✅ 零配置启动，自动读取厂商配置文件
- ✅ Fallback 机制，厂商服务异常时自动降级
- ✅ 应用生命周期感知，优化资源使用
- ✅ 网络状态检测，智能推送重试

## ⚛️ React Native SDK 文档

### 🚀 快速集成
- [**React Native 集成指南**](./react-native-integration.md) - Expo / bare RN 项目接入文档

### 📋 集成方式
- **Expo（managed/prebuild）** - npm 包 `doopush-react-native-sdk` + Expo config plugin（推荐）
- **bare React Native** - 同一 npm 包，autolinking 自动接入 iOS / Android bridge

### ⚡ 核心功能
- ✅ 命令式 API：`DooPush.configure / register / registerWithToken / getDeviceToken / getDeviceId / getDeviceInfo / updateDeviceInfo / reportStatistics / checkPermissionStatus`
- ✅ 角标 API：`setBadge / clearBadge / getBadge`
- ✅ React Hooks：`useDooPush()` / `useDooPushMessage()`
- ✅ 事件订阅：注册 / 注册错误 / 消息 / 通知点击 / 通知打开 / Gateway open/closed/error
- ✅ Config Plugin：iOS entitlement + background mode、Android FCM/HMS/Honor/Xiaomi/OPPO/VIVO/Meizu 配置文件复制、Gradle plugin/dependency 注入、manifest placeholders 合并
- ✅ 第三方共存：`setNotificationManagementMode('active'|'passive')`、`setExpoNotificationRelayEnabled`、`setNotificationDisplayEnabled`

### 🔧 高级特性
- ✅ 与 `expo-notifications` 通过 delegate forwarding（iOS）+ relay broadcast（Android）共存
- ✅ 与 `@react-native-firebase/messaging` 通过 `registerWithToken(token, 'fcm')` passive 模式协作

## 🛠 开发指南

### 系统要求
- **iOS**: iOS 13.0+, Xcode 16.0+, Swift 5.9+
- **Android**: Android 8.0+ (API 26+), Java 8+ / Kotlin
- **React Native**: Expo SDK 50+ 或 RN 0.73+（推荐 Expo SDK 54+）

### 获取支持
- 📖 查看详细的集成文档
- 🐛 在 [GitHub Issues](https://github.com/doopush/doopush/issues) 报告问题
- 💬 参与社区讨论

---

*SDK 文档基于当前实际可用的功能，确保集成指南准确可靠。*

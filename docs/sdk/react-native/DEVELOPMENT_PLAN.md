# React Native SDK 继续开发计划

更新时间：2026-05-07

## 1. 当前实际状态

`sdk/react-native/` 目前包含两个项目：

- `DooPushSDK/`：npm 包源码，包名 `doopush-react-native-sdk`，当前版本 `0.1.2`。
- `DooPushSDKExample/`：基于 Expo SDK 54 的示例 App，通过 `file:../DooPushSDK` 引用 SDK。

已验证：

- `cd sdk/react-native/DooPushSDK && pnpm build` 通过。
- `cd sdk/react-native/DooPushSDK && pnpm test` 通过，当前只有 config plugin 单元测试：3 个 suite / 10 个 test。
- 仓库工作区在检查时无未提交改动。

## 2. 已完成能力

### JS / TypeScript API

已提供最小 imperative API：

- `DooPush.configure(config)`
- `DooPush.register()`
- `DooPush.registerWithToken(token, vendor)`
- `DooPush.getDeviceToken()`
- `DooPush.getDeviceId()`
- 事件监听：
  - `addRegisterListener`
  - `addRegisterErrorListener`
  - `addMessageListener`

### iOS bridge

- 通过 Expo Modules API 暴露 native module。
- `ExpoAppDelegateSubscriber` 已接入，能把 APNs 注册 / 失败 / 远程通知回调转发给原生 iOS SDK。
- `configure`、`register`、`registerWithToken`、`getDeviceToken`、`getDeviceId` 已接到 iOS 原生 SDK。
- 消息事件已做 APNs `userInfo` 到 JS `DooPushMessage` 的基础归一化。

### Android bridge

- 通过 Expo Modules API 暴露 native module。
- `configure`、`register`、`registerWithToken`、消息事件已接入 Android 原生 SDK。
- 当前默认 FCM active 模式，OEM 通道尚未在 RN plugin / JS config 层完整暴露。

### Expo config plugin

- iOS：注入 `UIBackgroundModes=remote-notification` 和 `aps-environment` entitlement。
- Android：
  - 添加 JitPack / `mavenLocal()` 仓库。
  - FCM 启用时应用 `com.google.gms.google-services`。
  - 复制 `google-services.json`。
  - 注入 DooPush Android SDK 依赖。
  - 预置 OEM manifest placeholders，但尚未按实际 vendor config 完整配置。

### 发布链路

- monorepo 内已有 `.github/workflows/sync-rn-sdk.yml`，用于同步 `sdk/react-native/DooPushSDK/**` 到独立仓库。
- RN SDK 独立仓库内已有 `auto-publish-release.yml`，会按版本号自动创建 tag / GitHub Release / npm publish。

## 3. 主要未完成项 / 风险

### P0：Android 注册结果不完整

- `DooPush.register()` 的 TypeScript 类型声明返回 `{ token, deviceId, vendor }`。
- Android bridge 当前 `deviceId` 返回空字符串；`getDeviceToken()` / `getDeviceId()` 返回 `null`。
- 根因在 Android 原生 SDK 的 `DooPushRegisterCallback` / `DooPushNetworking.RegisterDeviceCallback` 只回传 token / success，不回传服务端 deviceId；`cachedToken` 也没有公开 getter。

### P0：Android 依赖坐标可能需要统一确认

- RN bridge 的 `android/build.gradle` 使用：`com.github.doopush:doopush-android-sdk:1.1.+`。
- README 写的是 `com.github.doopush:doopush-android-sdk:v1.1.0`。
- 需要确认 JitPack 实际 artifact 坐标与 tag 格式，并固定版本，避免 `1.1.+` 带来不可复现构建。

### P0：真实端到端验证仍不足

当前只有 TypeScript/plugin 测试通过；还缺少：

- Android 示例 App `expo prebuild/run:android` 真机验证。
- iOS 示例 App `expo prebuild/run:ios` 真机验证。
- 实际推送发送后的前台 / 后台 / 点击场景验证。

### P1：通知管理模式与第三方共存 API 未暴露

README 已提到 v0.5.0+ 的能力，但当前 JS API 未提供：

- `setExpoNotificationRelayEnabled(true)`
- active / passive 管理模式
- FCM 展示开关

这会影响和 `expo-notifications`、`@react-native-firebase/messaging` 的明确共存策略。

### P1：Android OEM 通道未完成 RN 封装

原生 Android SDK 已有 HMS / Honor / Xiaomi / OPPO / VIVO / Meizu 相关实现；RN 层目前：

- `DooPushVendor` 类型包含 OEM vendor。
- plugin schema 只支持 `fcm.googleServicesFile`。
- Android plugin 只预置空 placeholders，没有复制 OEM 配置文件、注入 vendor 插件/仓库/依赖、向 `configure` 传 vendor config。

### P1：事件 surface 还不完整

当前只暴露注册和消息：

- 缺少通知点击 / 打开事件。
- 缺少 WebSocket gateway 状态事件。
- 缺少权限状态、设备信息更新、统计上报结果等事件。

### P1：示例 App 仍偏模板化

- 仍保留较多 Expo 默认模板页面和组件。
- 凭证需要同时修改 `app.json` 和 `app/(tabs)/index.tsx`，容易不一致。
- Android FCM plugin 配置示例没有在 `app.json` 当前文件中启用。

### P2：测试覆盖不足

- JS API 没有 mock native module 单测。
- iOS / Android bridge 没有编译级 CI 验证。
- config plugin 测试只检查 mod 注册形状，未验证实际文件内容变更。

### P2：包工程化需要收尾

- `node_modules/` 当前存在于 `DooPushSDK/` 工作目录但被 `.gitignore` 忽略，不影响提交；发布包 `files` 配置基本正确。
- `build/`、`plugin/build/` 是构建产物，当前仓库里存在文件，需要明确是否继续纳入同步/发布源，或只在 publish 阶段生成。
- README 的 v0.1.x / v0.5.0 表述需要随着实现推进同步更新。

## 4. 推荐开发路线

### 阶段 1：把 v0.1.x alpha 做到“真实可交付”

目标：不扩大 API 面，先修正当前 API 的不一致和端到端可用性。

1. Android 原生 SDK 补齐注册返回信息
   - 修改 `DooPushNetworking.RegisterDeviceCallback`，从服务端注册响应解析并返回 `deviceId`。
   - 修改 `DooPushRegisterCallback`，支持返回 `token + deviceId + channel/vendor`，或新增不破坏兼容的 callback/data class。
   - 增加 `getDeviceToken()`、`getDeviceId()` public getter。
   - 保持旧 API 兼容，避免原生 Android SDK 现有用户破坏性升级。

2. RN Android bridge 接入真实值
   - `register()` 返回真实 `deviceId`。
   - `registerWithToken()` 返回真实 `deviceId`。
   - `getDeviceToken()` / `getDeviceId()` 返回真实值。
   - `vendor` 从注册路径或 `cachedDeviceInfo.channel` 获取，而不是固定 `fcm`。

3. 固定并验证 Android SDK 依赖版本
   - 将 RN bridge 依赖固定到已发布版本，例如 `v1.1.x` 对应的实际 JitPack 坐标。
   - README、plugin 注入依赖、native build.gradle 三处保持一致。

4. 示例 App 最小化改造
   - 增加统一配置文件或环境变量读取，避免 `app.json` / JS 双处硬编码不一致。
   - 在 UI 上显示 token、deviceId、vendor、getter 返回值和最近错误。
   - 在 `app.json` 示例里补充 Android FCM 配置注释或示例块。

5. 真机验收
   - iOS 真机：授权、APNs token、服务端注册 deviceId、前台/后台消息。
   - Android 真机/模拟器：FCM token、服务端注册 deviceId、前台/后台消息。
   - 记录验证步骤和已知限制到 README。

交付版本建议：`0.1.3` 或 `0.2.0-alpha`。

### 阶段 2：补齐第三方共存和通知事件

目标：让 RN SDK 在 Expo / bare RN 生态中更可控。

1. JS API 增加通知管理能力
   - `setNotificationManagementMode('active' | 'passive')`
   - `setExpoNotificationRelayEnabled(enabled: boolean)`
   - `setNotificationDisplayEnabled(enabled: boolean)`（Android FCM 展示开关；iOS 视原生支持情况决定）

2. iOS / Android bridge 对齐实现
   - Android 调用原生 `setNotificationManagementMode`、`setFCMNotificationDisplayEnabled`、`setExpoNotificationRelayEnabled`。
   - iOS 调用 `setNotificationManagementMode`，必要时增加原生 SDK 的显式 enable/disable delegate API 暴露。

3. 增加事件
   - `onNotificationClick`
   - `onNotificationOpen`
   - `onPermissionChange`
   - `onGatewayOpen` / `onGatewayClosed` / `onGatewayError`

4. 文档明确三种集成模式
   - DooPush active 独占模式。
   - 与 `expo-notifications` 共存模式。
   - 与 `@react-native-firebase/messaging` passive 模式。

交付版本建议：`0.3.x-alpha`。

### 阶段 3：Android OEM 通道 RN 化

目标：让 RN/Expo 用户可以配置国产 Android 厂商通道。

1. 扩展 plugin schema
   - `android.vendors.hms`
   - `android.vendors.honor`
   - `android.vendors.xiaomi`
   - `android.vendors.oppo`
   - `android.vendors.vivo`
   - `android.vendors.meizu`

2. config plugin 自动化
   - 添加必要 Maven 仓库和 Gradle 插件。
   - 复制 `agconnect-services.json`、`mcs-services.json` 或各厂商 assets 配置文件。
   - 按 vendor 注入 manifest placeholders。
   - 避免未启用厂商时引入多余依赖。

3. Android bridge configure 传入 OEM config
   - 将 JS config / plugin config 的 vendor 信息转为 `DooPushConfig.*Config`。
   - 注册结果返回真实 vendor/channel。

4. OEM 真机矩阵验证
   - Huawei / Honor / Xiaomi / OPPO / VIVO / Meizu 至少各做注册 + 收消息基本验证。

交付版本建议：`0.5.0-beta`。

### 阶段 4：Beta 质量与发布收尾

目标：达到可公开推荐集成。

1. 测试
   - JS API 单测：mock `requireNativeModule`。
   - plugin 内容级测试：实际运行 mod 后断言 Gradle / plist / entitlement 内容。
   - Android bridge compile check。
   - iOS pod install / xcodebuild compile check。

2. CI
   - RN SDK 独立仓库 PR 上运行 build + test。
   - 可选增加 example prebuild smoke test。
   - 发布前校验 npm pack 内容。

3. 文档和版本策略
   - README 更新为当前真实能力，不提前承诺未实现 API。
   - 增加迁移指南和 troubleshooting。
   - 明确 alpha / beta / latest dist-tag 策略。

4. 发布
   - npm beta 发布。
   - GitHub Release notes。
   - monorepo docs 增加 RN SDK 页面。

交付版本建议：`0.5.0-beta` 到 `1.0.0`。

## 5. 建议优先级清单

| 优先级 | 工作项 | 依赖 | 验收标准 |
|---|---|---|---|
| P0 | Android 原生 SDK 返回 `deviceId` 和公开 getter | Android SDK | RN Android `register()` / getter 返回真实值 |
| P0 | RN Android bridge 接入真实注册结果 | P0 原生 SDK | 示例 App 显示真实 token/deviceId/vendor |
| P0 | 固定 Android SDK 依赖坐标 | 发布/JitPack | clean build 可复现 |
| P0 | iOS + Android 真机 E2E 验证 | 真实凭证/设备 | README 记录通过场景 |
| P1 | 第三方共存 API | 原生 active/passive 能力 | expo-notifications / RNFirebase 方案可跑通 |
| P1 | 点击/打开/gateway 事件 | 原生事件 | JS listener 能收到事件 |
| P1 | OEM plugin schema 和配置注入 | Android 原生 OEM | 至少一个 OEM 真机跑通后逐个扩展 |
| P2 | JS/API/plugin 内容级测试 | 无 | CI 覆盖核心 API 和 plugin 输出 |
| P2 | 文档和 example 清理 | 无 | 用户按文档 30 分钟内完成 demo |

## 6. 下一步建议

下一次开发建议直接从 P0 开始：先修改 Android 原生 SDK 的注册回调与 getter，再回到 `sdk/react-native/DooPushSDK/android` 接 bridge。这个路径能最快消除当前 TS 类型、README 承诺与 Android 实际行为不一致的问题。

---

## 7. 本轮 0.5.0 开发落地记录

本轮已按 0.5.0 目标完成以下代码改动：

- Android 原生 SDK
  - 新增 `DooPushRegisterResult(token, deviceId, vendor)`。
  - `DooPushNetworking.registerDevice` 从服务端响应 `id` / `device_id` / `deviceId` 提取服务端设备 ID。
  - `DooPushManager` 缓存并公开 `getDeviceToken()`、`getDeviceId()`、`getCurrentVendor()`。
  - `registerDeviceToServer` 成功后回传完整注册结果。
- iOS 原生 SDK
  - `DooPushDelegate` 增加通知点击、通知打开、Gateway open/closed/error 可选回调。
  - `DooPushManager` 在统计事件和 WebSocket 状态变化时转发 delegate 事件。
- React Native SDK
  - 版本升级到 `0.5.0`。
  - Android / iOS bridge 增加：通知点击、通知打开、Gateway 事件。
  - 新增 JS API：
    - `setNotificationManagementMode('active' | 'passive')`
    - `setExpoNotificationRelayEnabled(enabled)`
    - `setNotificationDisplayEnabled(enabled)`
    - `connectGateway()` / `disconnectGateway()`
    - 点击 / 打开 / Gateway listener
  - Android bridge 的 `register()` / `registerWithToken()` / getter 已接入真实 `deviceId` / token。
- Expo config plugin
  - schema 增加 HMS / Honor / Xiaomi / OPPO / VIVO / Meizu 配置入口。
  - Android plugin 支持复制 FCM / HMS / Honor / OEM services 文件。
  - Android plugin 按 vendor 注入 manifest placeholders 和可选 vendor 依赖。
- Example / 文档
  - Example 页面显示 v0.5.0、getter 结果、通知事件和 Gateway 事件。
  - README 更新为 v0.5.0 beta 能力与 changelog。

本地已验证：

- `cd sdk/react-native/DooPushSDK && pnpm build && pnpm test` 通过。
- `cd sdk/android/DooPushSDK && ./gradlew :lib:testDebugUnitTest --no-daemon` 通过。
- `git diff --check` 通过。

未在本地完成：

- iOS bridge / iOS SDK 编译验证：当前环境是 Linux，缺少 Xcode / iOS SDK。
- Expo example TypeScript 检查：example 未安装 `node_modules`，`npx tsc --noEmit` 无法调用本地 TypeScript。
- iOS / Android 真机端到端推送验证：需要真实 DooPush 凭证、Firebase / APNs 配置和设备。

发布前必须补做：

1. 在 macOS 上执行 `pod install` / `expo run:ios`，确认 iOS bridge 新增 delegate 方法编译通过。
2. Android example 使用真实 `google-services.json` 和 DooPush 凭证跑 `expo run:android`。
3. iOS / Android 各发一条前台、后台、点击推送，确认 JS listener 收到事件。
4. 确认 Android 原生 SDK `1.2.0` 与 iOS 原生 SDK `1.2.0` 已发布后，再发布 RN SDK `0.5.0`。

# DooPush React Native SDK 设计

| 项 | 值 |
|------|------|
| 状态 | Draft |
| 日期 | 2026-05-06 |
| 影响范围 | 新增 RN SDK；前置变更 iOS / Android native SDK v1.1.0；Android SDK 加 JitPack 发布 |

## 1. 目标

在现有 iOS Swift SDK、Android Kotlin SDK 之外，**新增一个 React Native SDK**，让 RN / Expo 应用能用同一套 DooPush 推送平台。命名为 `doopush-react-native-sdk`（不冠 expo-，避免被误认为只服务 Expo 用户），但实现技术采用 Expo Modules API（业界推荐写法，同时兼容 Expo managed、Expo bare、纯 RN）。

### 1.1 关键决策（已对齐）

1. **覆盖 Android 全部 7 个厂商通道**（FCM + HMS + Honor + Xiaomi + OPPO + VIVO + Meizu）。
2. **Expo SDK 与现有 native SDK 关系**：薄包装。RN 端 native 桥接通过包依赖引用现有 native SDK，不复制代码。
3. **Android Maven 发布**：JitPack（最低成本，消费者无需 PAT，可后续再上 Maven Central）。
4. **与 expo-notifications 共存策略**：DooPush 默认拥有 `UNUserNotificationCenterDelegate` 和 `FirebaseMessagingService`，但 iOS 通过 **delegate forwarding** 模式（参考 `react-native-firebase` 实现）让 expo-notifications 仍能收到事件；Android 通过 **broadcast relay** 实现等价效果。这是行业主流（OneSignal / Braze / react-native-firebase 都是 SDK 自管），不偏离用户预期。
5. **JS API 风格**：命令式 API + React Hooks 双层，hooks 是命令式 API 的薄封装；保持单例。
6. **厂商打包策略**：plugin opt-in。Plugin 配置中未声明的厂商完全不打入产物（gradle 依赖、Maven repo、运行时 service 都不引入）。
7. **敏感配置**（appKey/secret 等）：plugin 只接受 plain object，不内置 secret 抽象，文档示范两种用法（直接写 `app.json` vs `app.config.js + process.env + EAS Secret`）。

### 1.2 非目标（v1 明确不做）

- 多 DooPush 实例（保持单例与现有 native 一致）
- iOS Notification Service Extension / Content Extension 自动配置（v1.1+ 再补）
- Web 推送（Expo Web）
- 服务端 SDK
- DooPush 平台账号 / 应用管理 API 暴露

## 2. 仓库与发布拓扑

```
doopush/                              ← 当前 monorepo
└── sdk/
    ├── ios/DooPushSDK/               ← 既有，sync→ doopush-ios-sdk
    ├── android/DooPushSDK/           ← 既有，sync→ doopush-android-sdk
    └── react-native/DooPushSDK/      ← 新增，sync→ doopush-react-native-sdk

doopush-ios-sdk         (公开仓)  → GitHub Release: framework.zip + podspec; SPM via tag
doopush-android-sdk     (公开仓)  → GitHub Release: aar + build.gradle
                                  → 新增：jitpack.io/com/github/doopush/doopush-android-sdk/vX.Y.Z
doopush-react-native-sdk(新公开仓) → GitHub Release + npm publish: doopush-react-native-sdk@X.Y.Z
```

### 2.1 RN SDK 包结构

```
sdk/react-native/DooPushSDK/
├── package.json                          ← name: doopush-react-native-sdk
├── expo-module.config.json
├── tsconfig.json
├── plugin/                               ← Config plugin (TS 源码)
│   ├── src/
│   │   ├── index.ts                      ← withDooPush 顶层
│   │   ├── schema.ts                     ← TS 类型 + zod 校验
│   │   ├── ios/
│   │   │   ├── withIOS.ts
│   │   │   ├── withInfoPlist.ts
│   │   │   └── withEntitlements.ts
│   │   └── android/
│   │       ├── withAndroid.ts
│   │       ├── withRootBuildGradle.ts
│   │       ├── withAppBuildGradle.ts
│   │       ├── withGoogleServices.ts
│   │       ├── withAgConnect.ts
│   │       └── vendors/
│   │           ├── fcm.ts
│   │           ├── hms.ts
│   │           ├── xiaomi.ts
│   │           ├── oppo.ts
│   │           ├── vivo.ts
│   │           ├── meizu.ts
│   │           └── honor.ts
│   ├── tsconfig.json
│   └── build/                            ← 编译产物（npm 包内含）
├── src/                                  ← TS API 层
│   ├── DooPushModule.ts                  ← requireNativeModule 桥接
│   ├── DooPush.ts                        ← 命令式 API
│   ├── hooks.ts                          ← useDooPush / useDooPushToken / ...
│   ├── events.ts                         ← EventEmitter 事件类型
│   └── types.ts
├── ios/
│   ├── DooPushReactNativeSDK.podspec     ← s.dependency 'DooPushSDK', '~> 1.1'
│   └── DooPushReactNativeSDKModule.swift
├── android/
│   ├── build.gradle                      ← implementation 'com.github.doopush:doopush-android-sdk:1.1.+'
│   └── src/main/java/com/doopush/reactnative/DooPushReactNativeSDKModule.kt
├── example/                              ← Expo SDK 53+ 演示 app
│   ├── app.json
│   ├── App.tsx
│   ├── eas.json
│   └── ...
├── README.md
└── .github/workflows/auto-build-release.yml
```

### 2.2 版本同步策略

- RN SDK 自有 semver（`package.json` 里的 `version`），不强行追平 native SDK 版本
- 在 `peerDependencies`（隐式，由 podspec/gradle 锁定）声明所需的 native SDK 最低版本
- v1.0 起：iOS DooPushSDK ≥ 1.1.0，Android DooPushSDK ≥ 1.1.0

### 2.3 npm 包名

`doopush-react-native-sdk`（与 `doopush-android-sdk` / `doopush-ios-sdk` 命名风格一致，未使用 npm scope）。如未来需要多包发布（如分包 `*/expo-notifications`），可平滑迁移到 `@doopush/react-native-sdk`。

## 3. JS API 表面

### 3.1 模块入口

```ts
import * as DooPush from 'doopush-react-native-sdk';

import {
  DooPushProvider,
  useDooPush,
  useDooPushToken,
  useDooPushMessage,
  useDooPushGatewayState,
} from 'doopush-react-native-sdk';

import type {
  DooPushConfig,
  DooPushMessage,
  DooPushVendor,           // 'apns'|'fcm'|'hms'|'honor'|'xiaomi'|'oppo'|'vivo'|'meizu'
  DooPushPermissionStatus, // 'authorized'|'denied'|'provisional'|'ephemeral'|'notDetermined'
  DooPushDeviceInfo,
  DooPushGatewayState,     // 'idle'|'connecting'|'connected'|'reconnecting'|'closed'
} from 'doopush-react-native-sdk';
```

### 3.2 命令式 API

```ts
DooPush.configure(config: DooPushConfig): void

type DooPushConfig = {
  appId: string;
  apiKey: string;
  baseURL?: string;
  log?: 'debug'|'info'|'warning'|'error'|'off';
  ios?: {
    /** 是否抢占 UNUserNotificationCenter.delegate（默认 true）。
     *  抢占时会保存先前的 delegate 并向上转发——与 react-native-firebase 同款。 */
    takeNotificationCenterDelegate?: boolean;
  };
  android?: {
    /** OEM 通道收到消息时是否由 DooPush 展示通知（默认 true） */
    handleOEMNotificationDisplay?: boolean;
    /** FCM 通道是否由 DooPush 展示通知（默认 true）。
     *  设 false 时 DooPush 仅处理 token / 服务端注册 / 统计。 */
    handleFCMNotificationDisplay?: boolean;
  };
};

// 权限
DooPush.requestPermission(opts?): Promise<DooPushPermissionStatus>
DooPush.getPermissionStatus(): Promise<DooPushPermissionStatus>

// 注册（默认：内部完成"申请权限 → 取 APNs/FCM/OEM token → 上报服务端"）
DooPush.register(): Promise<{ token: string; deviceId: string; vendor: DooPushVendor }>

// 高阶：调用方已有 token（例如先用 expo-notifications 拿到）时的注册入口
DooPush.registerWithToken(token: string, vendor?: DooPushVendor): Promise<{ deviceId: string }>

// 设备/状态
DooPush.getDeviceToken(): Promise<string | null>
DooPush.getDeviceId(): Promise<string | null>
DooPush.getDeviceInfo(): Promise<DooPushDeviceInfo>
DooPush.updateDeviceInfo(): Promise<void>
DooPush.getActiveVendor(): Promise<DooPushVendor>

// 通知 UI
DooPush.setForegroundPresentationOptions(opts: {
  alert?: boolean; badge?: boolean; sound?: boolean; banner?: boolean; list?: boolean;
}): Promise<void>
DooPush.createNotificationChannel(channel: AndroidChannel): Promise<void>  // Android only
DooPush.deleteNotificationChannel(id: string): Promise<void>

// WebSocket Gateway
DooPush.connectGateway(): Promise<void>
DooPush.disconnectGateway(): Promise<void>
DooPush.getGatewayState(): Promise<DooPushGatewayState>

// 角标
DooPush.setBadgeCount(n: number): Promise<void>
DooPush.clearBadge(): Promise<void>
DooPush.getBadgeCount(): Promise<number>

// 统计
DooPush.reportStatistics(): Promise<void>
DooPush.recordNotificationClick(payload: object): Promise<void>
DooPush.recordNotificationOpen(payload: object): Promise<void>
```

### 3.3 事件订阅

```ts
DooPush.addRegisterListener((e: { token; deviceId; vendor }) => void): EventSubscription
DooPush.addRegisterErrorListener((e: { code; message }) => void): EventSubscription
DooPush.addMessageListener((msg: DooPushMessage) => void): EventSubscription
//   ↑ 覆盖 APNs + FCM + 6 个 OEM 通道，统一字段
DooPush.addNotificationClickListener((e: { message; actionId? }) => void): EventSubscription
DooPush.addNotificationPresentListener((e: { message }) => void): EventSubscription
DooPush.addGatewayMessageListener((msg: DooPushMessage) => void): EventSubscription
DooPush.addGatewayStateListener((state: DooPushGatewayState) => void): EventSubscription
```

### 3.4 React Hooks

Provider 可选——所有 hooks 不强制要 Provider，无 Provider 时 hooks 直接读单例状态。

```tsx
<DooPushProvider config={{ appId, apiKey }}>
  <App />
</DooPushProvider>

// 无 Provider 也可直接用：
const { token, deviceId, error, status } = useDooPushToken();
//   status: 'idle' | 'registering' | 'registered' | 'failed'

const { lastMessage } = useDooPushMessage();         // 全通道
const { lastMessage } = useDooPushGatewayMessage();  // WebSocket only
const { state } = useDooPushGatewayState();
const dp = useDooPush();  // 整个命令式 API 的引用
```

### 3.5 错误模型

```ts
class DooPushError extends Error {
  code: 'NOT_CONFIGURED' | 'PERMISSION_DENIED' | 'NETWORK' | 'INVALID_TOKEN'
      | 'GATEWAY_DISCONNECTED' | 'VENDOR_UNAVAILABLE' | 'UNKNOWN';
  vendor?: DooPushVendor;
  underlying?: { domain: string; code: number; message: string };
}
```

## 4. Native 桥接层

### 4.1 Native SDK 前置改动（v1.1.0）

为支持 RN bridge 与 expo-notifications 共存，**iOS / Android native SDK 需要先发布 v1.1.0**，包含：

#### iOS（`sdk/ios/DooPushSDK`）

| 文件 | 改动 |
|------|------|
| `DooPushNotificationAutoTracker.swift` | 改为 KVO 监听 `UNUserNotificationCenter.delegate`，安装时保存原 delegate；所有 delegate 方法实现 forwarding（先调 DooPush 自己处理，再调原 delegate）；KVO 监听 delegate 被替换时重新装回自己 |
| `DooPushManager.swift` | 新增 `setNotificationManagementMode(_ mode: NotificationManagementMode)`（`active` / `passive`），passive 下不安装 delegate、不调 `registerForRemoteNotifications` |
| `DooPushManager.swift` | 新增 `registerDevice(withToken: String, vendor: DooPushVendor?, completion:)`——直接用调用方已有 token 完成服务端注册，跳过 SDK 内部权限/token 流程 |

#### Android（`sdk/android/DooPushSDK`）

| 类 | 改动 |
|----|------|
| `DooPushManager.kt` | 新增 `setNotificationManagementMode(mode: NotificationManagementMode)` |
| `DooPushManager.kt` | 新增 `registerDevice(token, vendor, callback)` |
| `DooPushManager.kt` | 新增 `setFCMNotificationDisplayEnabled(enabled: Boolean)` |
| `DooPushManager.kt` | 新增 `setExpoNotificationRelayEnabled(enabled: Boolean)` |
| `DooPushFirebaseMessagingService.kt` | 新增 `relayToExpoNotifications(remoteMessage)`：依配置在自己处理完后主动 broadcast 一个 expo-notifications 兼容的 Intent，让 expo-notifications 也能拿到事件；不依赖 expo-notifications 的私有 API |
| `XiaomiService.kt` / `OppoService.kt` / `VivoService.kt` / `MeizuService.kt` / `HMSService.kt` / `HonorService.kt` | 启动时检查对应 manifestPlaceholder 值是否为空字符串；若为空则该厂商 service noop（不初始化、不注册 token）。这是 plugin opt-in 安全语义的运行时保障——见 §5.4 |

#### Android Maven 发布

- 在 `sdk/android/DooPushSDK` 的现有 `lib/build.gradle` 已配 `maven-publish` 插件
- 在 `doopush-android-sdk` 仓库根新增 `jitpack.yml`：

  ```yaml
  jdk:
    - openjdk17
  install:
    - ./gradlew :lib:assembleRelease :lib:publishToMavenLocal
  ```

- JitPack 监听 GitHub tag，自动构建并暴露 `com.github.doopush:doopush-android-sdk:vX.Y.Z`
- 消费者 gradle：
  ```gradle
  repositories { maven { url 'https://jitpack.io' } }
  dependencies { implementation 'com.github.doopush:doopush-android-sdk:1.1.+' }
  ```

### 4.2 iOS Bridge 模块

```swift
// sdk/react-native/DooPushSDK/ios/DooPushReactNativeSDKModule.swift
import ExpoModulesCore
import DooPushSDK

public class DooPushReactNativeSDKModule: Module, DooPushDelegate {
  public func definition() -> ModuleDefinition {
    Name("DooPushReactNativeSDK")

    Events(
      "onRegister", "onRegisterError",
      "onMessage", "onNotificationClick", "onNotificationPresent",
      "onGatewayMessage", "onGatewayState"
    )

    OnCreate {
      // 默认 active 模式（与 native 一致）
      DooPushManager.shared.delegate = self
    }

    Function("configure") { (configRaw: [String: Any]) in
      let config = parseConfig(configRaw)
      DooPushManager.shared.configure(
        appId: config.appId, apiKey: config.apiKey, baseURL: config.baseURL ?? ""
      )
      if config.ios.takeNotificationCenterDelegate {
        DooPushManager.shared.enableAutomaticNotificationTracking()
      }
    }

    AsyncFunction("requestPermission") { (opts: [String: Bool]?, promise: Promise) in ... }
    AsyncFunction("register") { (promise: Promise) in
      DooPushManager.shared.registerForPushNotifications { token, error in
        if let error = error { promise.reject("E_REGISTER", error.localizedDescription) }
        else { promise.resolve(["token": token!, ...]) }
      }
    }
    AsyncFunction("registerWithToken") { (token: String, vendor: String?, promise: Promise) in
      DooPushManager.shared.registerDevice(withToken: token, vendor: vendor) { ... }
    }
    AsyncFunction("connectGateway") { (promise: Promise) in ... }
    Function("setBadgeCount") { (n: Int) in DooPushManager.shared.setBadgeNumber(n) }
    // ... 其余 API
  }

  // DooPushDelegate → JS 事件
  public func dooPush(_ m: DooPushManager, didRegisterWithToken t: String) {
    sendEvent("onRegister", ["token": t, "deviceId": m.getDeviceId() ?? "", "vendor": "apns"])
  }
  public func dooPush(_ m: DooPushManager, didReceiveNotification info: [AnyHashable: Any]) {
    sendEvent("onMessage", normalize(info))
  }
  public func dooPush(_ m: DooPushManager, didFailWithError err: Error) {
    sendEvent("onRegisterError", ["code": "UNKNOWN", "message": err.localizedDescription])
  }
}
```

### 4.3 iOS Delegate Forwarding 实现要点

```swift
// DooPushNotificationAutoTracker.swift（修订）
class DooPushNotificationAutoTracker: NSObject, UNUserNotificationCenterDelegate {
  private weak var previousDelegate: UNUserNotificationCenterDelegate?
  private var kvoToken: NSKeyValueObservation?

  func install() {
    let center = UNUserNotificationCenter.current()
    self.previousDelegate = center.delegate
    center.delegate = self
    self.kvoToken = center.observe(\.delegate, options: [.new]) { [weak self] c, _ in
      guard let self else { return }
      if c.delegate !== self {
        self.previousDelegate = c.delegate
        c.delegate = self
      }
    }
  }

  func userNotificationCenter(_ c: UNUserNotificationCenter,
                              willPresent n: UNNotification,
                              withCompletionHandler h: @escaping (UNNotificationPresentationOptions) -> Void) {
    let myOpts = self.handleWillPresent(n)
    if let prev = previousDelegate,
       prev.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
      prev.userNotificationCenter?(c, willPresent: n) { theirOpts in
        h(myOpts.union(theirOpts))
      }
    } else {
      h(myOpts)
    }
  }

  func userNotificationCenter(_ c: UNUserNotificationCenter,
                              didReceive r: UNNotificationResponse,
                              withCompletionHandler h: @escaping () -> Void) {
    let group = DispatchGroup()
    group.enter()
    self.handleDidReceive(r) { group.leave() }
    if let prev = previousDelegate,
       prev.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
      group.enter()
      prev.userNotificationCenter?(c, didReceive: r) { group.leave() }
    }
    group.notify(queue: .main) { h() }
  }
}
```

### 4.4 Android Bridge 模块

```kotlin
// sdk/react-native/DooPushSDK/android/.../DooPushReactNativeSDKModule.kt
class DooPushReactNativeSDKModule : Module(), DooPushCallback {
  override fun definition() = ModuleDefinition {
    Name("DooPushReactNativeSDK")

    Events(
      "onRegister", "onRegisterError",
      "onMessage", "onNotificationClick", "onNotificationPresent",
      "onGatewayMessage", "onGatewayState"
    )

    OnCreate {
      DooPushManager.getInstance().setCallback(this@DooPushReactNativeSDKModule)
    }

    Function("configure") { configRaw: Map<String, Any> ->
      val config = parseConfig(configRaw)
      DooPushManager.getInstance().configure(
        context = appContext.reactContext!!,
        appId = config.appId, apiKey = config.apiKey, baseUrl = config.baseURL
      )
      DooPushManager.getInstance().setFCMNotificationDisplayEnabled(
        config.android.handleFCMNotificationDisplay
      )
      DooPushManager.getInstance().setExpoNotificationRelayEnabled(true)
    }

    AsyncFunction("register") { promise: Promise -> ... }
    AsyncFunction("registerWithToken") { token: String, vendor: String?, promise: Promise -> ... }
    Function("setBadgeCount") { n: Int -> DooPushManager.getInstance().setBadgeCount(n) }
    // ...
  }

  override fun onRegisterSuccess(token: String) {
    sendEvent("onRegister", mapOf("token" to token, "deviceId" to DooPushManager.getInstance().deviceId, ...))
  }
  override fun onMessageReceived(msg: PushMessage) {
    sendEvent("onMessage", msg.toMap())
  }
  // ...
}
```

### 4.5 Passive Mode 角色

不再是 RN bridge 默认行为，作为高阶能力保留。RN 用户显式设 `ios.takeNotificationCenterDelegate: false` 或 `android.handleFCMNotificationDisplay: false` 时，bridge 内部启用 passive。文档"高级用法 / 共存场景"专节描述。

## 5. Config Plugin

### 5.1 Plugin 输入 schema

```json
{
  "plugins": [
    ["doopush-react-native-sdk", {
      "appId": "your_doopush_app_id",
      "apiKey": "your_doopush_api_key",
      "baseURL": "https://doopush.com/api/v1",
      "ios": {
        "mode": "production"
      },
      "android": {
        "vendors": {
          "fcm":   { "googleServicesFile": "./google-services.json" },
          "hms":   { "agConnectServicesFile": "./agconnect-services.json" },
          "xiaomi":{ "appId": "xxx", "appKey": "xxx" },
          "oppo":  { "appKey": "xxx", "appSecret": "xxx" },
          "vivo":  { "appId": "xxx", "apiKey": "xxx" },
          "meizu": { "appId": "xxx", "appKey": "xxx" },
          "honor": { "appId": "xxx", "developerId": "xxx" }
        }
      }
    }]
  ]
}
```

未在 `vendors` 出现的厂商**完全不打入产物**——其 gradle 依赖、Maven repo 都不引入；运行时 native SDK 检查到对应厂商 placeholder 为空字符串则该厂商 service noop。

### 5.2 iOS 注入

| Mod | 写入位置 | 内容 |
|------|---------|------|
| Podspec dep | `ios/DooPushReactNativeSDK.podspec` | `s.dependency 'DooPushSDK', '~> 1.1'` |
| `withInfoPlist` | `ios/<App>/Info.plist` | `UIBackgroundModes` += `remote-notification` |
| `withEntitlements` | `ios/<App>/<App>.entitlements` | `aps-environment` = `"development"` 或 `"production"` |
| Capability | Xcode project | `Push Notifications` capability |

### 5.3 Android 注入（按厂商）

| 厂商 | Maven repo | gradle 运行时 dep | manifestPlaceholders | apply plugin | 文件复制 |
|------|-----------|------|---------|---------|---------|
| **fcm** | `google()` 已默认 | `com.google.firebase:firebase-messaging-ktx`（AAR 已含） | — | `com.google.gms.google-services` | `google-services.json` → `android/app/` |
| **hms** | `https://developer.huawei.com/repo/` | `com.huawei.hms:push:6.11.0.300` | — | `com.huawei.agconnect` | `agconnect-services.json` → `android/app/` |
| **xiaomi** | mavenCentral 默认 | `com.umeng.umsdk:xiaomi-push:6.0.1` | `DOOPUSH_MI_APP_ID`, `DOOPUSH_MI_APP_KEY` | — | — |
| **oppo** | mavenCentral 默认 | `com.umeng.umsdk:oppo-push:3.5.3` | `DOOPUSH_OPPO_APP_KEY`, `DOOPUSH_OPPO_APP_SECRET` | — | — |
| **vivo** | mavenCentral 默认 | `com.umeng.umsdk:vivo-push:4.0.6.0` | `DOOPUSH_VIVO_APP_ID`, `DOOPUSH_VIVO_API_KEY` | — | — |
| **meizu** | mavenCentral 默认 | `com.umeng.umsdk:meizu-push:5.0.3` | `DOOPUSH_MEIZU_APP_ID`, `DOOPUSH_MEIZU_APP_KEY` | — | — |
| **honor** | `https://developer.hihonor.com/repo` | `com.hihonor.mcs:push:8.0.12.307` | `DOOPUSH_HONOR_APP_ID`, `DOOPUSH_HONOR_DEVELOPER_ID` | — | — |

公共一行：`implementation 'com.github.doopush:doopush-android-sdk:1.1.+'` 进 `android/app/build.gradle`。

### 5.4 厂商禁用的安全保障链

现有 Android AAR 的 AndroidManifest 已写有所有厂商的 receiver/service/meta-data 与占位符 `${DOOPUSH_MI_APP_ID}` 等。Plugin 通过三层保障让"未启用的厂商完全不影响运行"：

1. **Manifest 占位符**：Plugin 总是注入所有 7 个厂商的 manifestPlaceholders。**未启用的厂商给空字符串**——若不注入，manifest merger 会因占位符未替换而失败。
2. **Runtime 依赖**：未启用厂商**不引入运行时 gradle dep**。AAR 中的 `compileOnly` 依赖只在编译期可见，运行时 classpath 中没有 vendor SDK 类——**vendor receiver 类自身因继承的 vendor 基类不在 classpath，class 加载会失败**，但因为 vendor SDK 也没初始化，receiver 不会被触发，所以不影响运行。
3. **Native service 自检**（§4.1 已列）：每个 `XiaomiService` / `OppoService` 等启动时检查空 appId 主动 noop，即使将来设计调整也能保底。

收益：native SDK 无需拆 manifest 片段，无需重构；plugin 实现简单。

**注意**：手机厂商商店上传时若 lint 工具检查 manifest 中所有声明类的可达性，可能告警（实际不影响 install/run）。如未来出现告警，再考虑 §4.1 中拆 manifest 片段的方案。

### 5.5 Plugin 执行顺序

- `expo-modules-autolinking` 自动处理 podspec / build.gradle 关联
- 与 `expo-notifications` 修改的 manifest 节点不重叠，无序无关
- 与 `@react-native-firebase/messaging` 冲突：两者都想声明 `FirebaseMessagingService`。文档明确**二选一**——若用户已用 react-native-firebase，应禁用 DooPush 的 `fcm` vendor，由前者拿 token 后调 `DooPush.registerWithToken(token, 'fcm')`

### 5.6 敏感值处理

文档示范两种方式：
- **方案 A**（直接写 `app.json`）：开源仓库慎用
- **方案 B**（`app.config.js` + `process.env` + EAS Secret）：CI / 多环境推荐

Plugin 自身只读 plain object，不内置 secret 抽象。

### 5.7 Plugin 单测

每个 mod 输入 mock `ExpoConfig`，输出修改后对象/字符串结果，用 Jest snapshot 比对。覆盖：

- 单一厂商启用（每厂商一组）
- 多厂商组合（fcm + hms + 1～2 OEM）
- 厂商禁用反向断言
- iOS development / production mode 切换
- 缺失必填字段时 plugin 抛可读错误

## 6. Example App

```
sdk/react-native/DooPushSDK/example/
├── app.json                ← 完整启用 7 厂商示范（开发用占位 key）
├── App.tsx                 ← configure + register + 角标 + 消息列表 UI + WebSocket 状态
├── eas.json                ← EAS Build 配置（dev / preview / production）
├── ios/                    ← prebuild 产物（gitignored）
└── android/                ← prebuild 产物（gitignored）
```

`App.tsx` 演示：
- `DooPush.configure` 初始化
- `DooPushProvider` + `useDooPushToken()` 显示 token / deviceId
- `useDooPushMessage()` 列表显示收到的推送
- 按钮：`requestPermission` / `register` / `setBadgeCount(5)` / `connectGateway` / `disconnectGateway`
- `useDooPushGatewayState()` 显示 WebSocket 状态
- 同时 import `expo-notifications` 注册一个 listener，验证 delegate forwarding 真的双发

测试覆盖矩阵：

| 场景 | 模拟器 | 真机 |
|------|------|------|
| Configure / hooks 渲染 | ✅ | ✅ |
| iOS APNs 注册 | ❌ | ✅ Apple |
| Android FCM | ✅ Google API | ✅ |
| OEM（HMS/Honor/Xiaomi/OPPO/VIVO/Meizu） | ❌ | ✅ 各品牌 |
| WebSocket Gateway | ✅ | ✅ |
| Badge | ⚠️ 部分 | ✅ |

## 7. 文档

新增 `docs/sdk/react-native-integration.md`，章节：

- 系统要求（iOS 13+, Android 8+ API 26）
- 安装（npm + plugin）
- Expo Managed (prebuild) 集成
- 纯 RN 集成（手动 Manifest / Podfile）
- 与 expo-notifications 共存说明
- 与 react-native-firebase 共存说明
- API 参考（命令式 + hooks）
- Config Plugin 字段参考
- 厂商配置（每厂商一节，AppKey 怎么申请）
- 调试与日志
- 常见问题
- 升级指南

`docs/sdk/index.md` 与 `docs/index.md` 的 SDK 矩阵新增 React Native 列。

API 参考 v1 手写主表面（更可读），v1.1+ 再考虑 TypeDoc 补充。

## 8. CI / 自动发布

### 8.1 `doopush-react-native-sdk` 仓库 workflow

`.github/workflows/auto-build-release.yml`，1:1 镜像现有 iOS/Android workflow 模式：

| 步骤 | 现行 | RN |
|------|------|------|
| Trigger | `push: main` + `workflow_dispatch` | 同 |
| 提取版本号 | `lib/build.gradle` / `DooPushSDK.podspec` | `package.json` |
| 检查/清理已存在 release | `gh release view` / `delete` | 同 |
| 构建 | `gradlew assembleRelease` / `scripts/build.sh` | `pnpm install` → `pnpm build`（编译 plugin TS）→ `pnpm test` |
| Verify | 检查 AAR / Framework 存在 | 检查 `build/`、`plugin/build/` 存在 |
| 发布 | 上传产物到 Release | `npm publish --access=public` + 上传 tarball 到 Release |
| Tag | `git tag vX.Y.Z` / push | 同 |
| GitHub Release | 同款 release notes 模板 | 同款，包含安装 snippet + native SDK 兼容矩阵 |

需要 secrets：`NPM_TOKEN`（npm）+ `GITHUB_TOKEN`（自动）

### 8.2 本地开发流程

```bash
cd sdk/react-native/DooPushSDK
pnpm install
pnpm build         # 编译 plugin TS、生成 d.ts
pnpm example:start # 启动 example app
pnpm example:ios   # prebuild + 跑 iOS
pnpm example:android
```

### 8.3 Sync 机制

monorepo 是 source of truth，发布时 sync `sdk/react-native/DooPushSDK/` 到 `doopush-react-native-sdk` 公仓库（人工或脚本）。v1 不复杂化此机制。

## 9. 路线图

| 版本 | 目标 | 说明 |
|------|------|------|
| **Native iOS SDK v1.1.0** | Delegate forwarding + passive mode + `registerDevice(withToken:)` | RN SDK 前置依赖；独立 PR |
| **Native Android SDK v1.1.0** | Passive mode + `registerDevice(token, vendor)` + `relayToExpoNotifications` + `setFCMNotificationDisplayEnabled` + JitPack 发布 | RN SDK 前置依赖；独立 PR |
| **RN SDK v0.1.0**（alpha） | iOS APNs + Android FCM 跑通完整链路；plugin 仅支持 fcm vendor | 验证 Expo Module + delegate forwarding + 服务端注册流程 |
| **RN SDK v0.5.0**（beta） | 全部 7 厂商 plugin opt-in；example app 完整化；docs 主体；与 expo-notifications 双发验证 | 内部测试可用 |
| **RN SDK v1.0.0** | 完整 API 表面（§3）；TypeDoc API 文档；CI 完善；npm 发布 | 公开发布 |
| RN SDK v1.1.x+ | 富通知（attachments、action buttons、Notification Service Extension）、TurboModule 兼容验证、性能优化 | 增强 |

## 10. 风险与应对

| 风险 | 应对 |
|------|------|
| Expo Modules API 升级破坏兼容（如 RN 强制 TurboModule） | example app pin SDK 版本；CI 加 SDK 51/52/53 三版本矩阵 |
| JitPack 偶发构建失败 | 显式指定 JDK 17；监控；两次失败时文档提示备选下载 AAR 手动集成 |
| OEM SDK 升级（Umeng 等） | native SDK 升级时同步 plugin 中硬编码 dep 版本 |
| 与 `@react-native-firebase` 用户的 FCM Service 冲突 | 文档明确"如已用 react-native-firebase 请禁用 DooPush 的 fcm vendor，由前者取 token 后调 `registerWithToken`" |
| iOS delegate KVO 在 SwiftUI 应用某些场景失效 | KVO 写法严格按 react-native-firebase 实测过的写法；单测覆盖 |
| Android FCM relay broadcast 协议被 expo-notifications 上游改动 | 协议变化时最坏情况 expo-notifications 收不到，DooPush 仍工作；CI 集成测试覆盖 |
| 厂商 SDK 在新 Android 版本下行为变化 | 跟踪 Umeng / 厂商 SDK 升级；example app 在 Android 14/15 真机测试 |

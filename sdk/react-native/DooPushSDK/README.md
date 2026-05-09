# DooPush React Native SDK

> React Native / Expo SDK，支持 APNs、FCM、Android 6 类 OEM 通道、Hooks、通知事件、WebSocket Gateway、角标、统计和第三方共存控制。

[DooPush](https://doopush.com) 推送通知服务的 React Native SDK。基于 Expo Modules API 实现，可在 Expo（managed / prebuild）和 bare React Native 项目里使用。

## 功能

- ✅ `DooPush.configure(config)`
- ✅ `DooPush.register()` —— iOS APNs / Android FCM 或 OEM 自动流程
- ✅ `DooPush.registerWithToken(token, vendor)` —— 调用方已有 token 时的 passive 模式
- ✅ `DooPush.getDeviceToken()` / `getDeviceId()` / `getDeviceInfo()` —— iOS 与 Android 均返回原生 SDK 缓存值
- ✅ `DooPush.updateDeviceInfo()` / `reportStatistics()` / `checkPermissionStatus()`
- ✅ 角标 API：`setBadge()` / `clearBadge()` / `getBadge()`
- ✅ React Hooks：`useDooPush()` / `useDooPushMessage()`
- ✅ 事件监听：注册、注册错误、消息、通知点击、通知打开、Gateway 状态
- ✅ 第三方共存控制：`setNotificationManagementMode`、`setExpoNotificationRelayEnabled`、`setNotificationDisplayEnabled`
- ✅ Config Plugin：iOS entitlement / background mode、Android FCM/HMS/Honor 配置文件、OEM 配置文件生成、Gradle plugin/dependency 注入和 manifest placeholders 合并
- ✅ Android OEM 通道：HMS / Honor / Xiaomi / OPPO / VIVO / Meizu

## 前置条件

- iOS 原生 SDK ≥ **1.2.0**（monorepo 本地开发可路径引用未发布版本）
- Android 原生 SDK ≥ **1.2.0**（monorepo 本地开发可走 mavenLocal 用未发布版本）
- Expo SDK 50+（或 RN 0.73+ bare）。**新项目推荐 Expo SDK 54+**

## 快速安装

```bash
npx expo install doopush-react-native-sdk
```

`app.json` 配 plugin：

```json
{
  "expo": {
    "plugins": [
      [
        "doopush-react-native-sdk",
        {
          "appId": "your_app_id",
          "apiKey": "your_api_key",
          "baseURL": "https://doopush.com/api/v1",
          "ios": { "mode": "production" },
          "android": {
            "vendors": {
              "fcm": { "googleServicesFile": "./google-services.json" },
              "hms": { "agconnectServicesFile": "./agconnect-services.json" },
              "honor": {
                "mcsServicesFile": "./mcs-services.json"
              },
              "xiaomi": { "appId": "mi_app_id", "appKey": "mi_app_key" },
              "oppo": { "appKey": "oppo_app_key", "appSecret": "oppo_app_secret" },
              "vivo": { "appId": "vivo_app_id", "apiKey": "vivo_api_key" },
              "meizu": { "appId": "meizu_app_id", "appKey": "meizu_app_key" }
            }
          }
        }
      ]
    ]
  }
}
```

> OEM 配置支持两种方式：传 `servicesFile`/`mcsServicesFile`/`agconnectServicesFile` 复制厂商 JSON；或对 Xiaomi / OPPO / VIVO / Meizu / Honor 传内联凭证，prebuild 时会生成对应 `android/app/src/main/assets/*-services.json`。HMS 仍需 `agconnect-services.json` 文件。

```bash
npx expo prebuild --clean
npx expo run:android   # 或 run:ios
```

## 用法

```tsx
import { useEffect } from 'react';
import { DooPush, useDooPush, type DooPushMessage } from 'doopush-react-native-sdk';

export default function App() {
  const { token, deviceId, register, lastMessage, error } = useDooPush();

  useEffect(() => {
    DooPush.configure({
      appId: 'your_app_id',
      apiKey: 'your_api_key',
    });
    const sub = DooPush.addMessageListener((m: DooPushMessage) => {
      console.log('收到推送', m);
    });
    const clickSub = DooPush.addNotificationClickListener((m) => {
      console.log('点击推送', m);
    });
    return () => { sub.remove(); clickSub.remove(); };
  }, []);

  const handleRegister = async () => {
    try {
      const { token, deviceId } = await register();
      console.log('注册成功', token, deviceId);
    } catch (e) {
      console.error('注册失败', e);
    }
  };

  // 也可以直接使用 hook 暴露的状态：token / deviceId / lastMessage / error
  console.log({ token, deviceId, lastMessage, error });
}

// 常用补充 API：
async function maintenance() {
  await DooPush.setBadge(3);
  await DooPush.clearBadge();
  await DooPush.reportStatistics();
  const permission = await DooPush.checkPermissionStatus();
  console.log(permission);
}
```

## 本地开发

本包是 [doopush monorepo](https://github.com/doopush/doopush) 的一部分，跟 iOS / Android 原生 SDK 平级。本地开发流程：

```bash
# 1) 编译 SDK
cd sdk/react-native/DooPushSDK
pnpm install
pnpm build
pnpm test                   # plugin Jest 测试

# 2) 用同级的 demo app 验证
cd ../DooPushSDKExample
npm install
npm install file:../DooPushSDK --install-links   # 用拷贝替代 symlink，避开 Metro 解析坑
npx expo run:ios            # 模拟器，或 --device "<设备名>"
npx expo run:android        # 模拟器，或 --device <id>
```

详细的真机跑步骤、故障排查、Mac LAN IP 注入等见 `../DooPushSDKExample/README.md`。

仓库结构跟 iOS / Android SDK 对齐：

```
sdk/react-native/
├── DooPushSDK/         ← SDK 源（npm 包 doopush-react-native-sdk）
│   ├── src/            #  JS API 层
│   ├── plugin/         #  Expo config plugin（编译期 native 配置注入）
│   ├── ios/            #  iOS 原生 bridge + AppDelegate subscriber
│   └── android/        #  Android 原生 bridge
└── DooPushSDKExample/  ← 用 SDK 的 demo（与 iOS/Android example 平级）
```

## 与第三方共存

### 与 `expo-notifications`

默认兼容。iOS 上 DooPush 接管 `UNUserNotificationCenterDelegate` 但走 delegate-forwarding，`expo-notifications` 的监听依然能收到。Android 上 DooPush 接管 `FirebaseMessagingService`，如果你也想让 `expo-notifications` 收到 FCM 消息，调（v0.5.0+）：

```ts
DooPush.setNotificationManagementMode('active');
// relay 是独立开关；setNotificationManagementMode 不会覆盖该值。
DooPush.setExpoNotificationRelayEnabled(true);
```

> `setNotificationDisplayEnabled` 仅控制 Android FCM 由 DooPush 自管展示通知的开关；iOS 端是 no-op。`setExpoNotificationRelayEnabled` 是独立开关，不会被 active/passive 模式切换重置。若 iOS 需要让位给其它通知库，请使用 `setNotificationManagementMode('passive')`。

### 与 `@react-native-firebase/messaging`

**二选一** —— 两个库都声明 `FirebaseMessagingService`，manifest merger 只能留一个。如果你已经在用 `react-native-firebase`，就在 DooPush plugin 里**省略 fcm 厂商**，用 `react-native-firebase` 拿 token 后再交给 DooPush：

```ts
import messaging from '@react-native-firebase/messaging';
import { DooPush } from 'doopush-react-native-sdk';

const token = await messaging().getToken();
const { deviceId } = await DooPush.registerWithToken(token, 'fcm');
```

## License

MIT

## CHANGELOG

### v0.5.1
- **Fix (Android)**：`expo prebuild` 流程缺失 `google-services` Gradle 插件 classpath 注入，原生工程 sync 失败；config plugin 现在补齐 `withRootBuildGradle` / `withSettingsGradle` / `withGradleProperties`，prebuild 全流程跑通。
- **Fix (config plugin)**：`zod` 等 plugin 运行时依赖错误地放在 `devDependencies` 里，用户 `npx expo prebuild` 时 plugin 解析失败；改为生产依赖。
- **Fix (iOS)**：`normalizePermissionStatus` 在 `AsyncFunction` 闭包里少了 `self.` 前缀，调用 permission 相关 API 时崩溃；同步修复。
- **Dev**：example app 的 Podfile 在 monorepo 中可自动指向同仓库 `sdk/ios/DooPushSDK`，便于联动调试本地原生 SDK。
- **Install**：默认 npm dist-tag 改为 `latest`（不再要求 `@beta`），`npm install doopush-react-native-sdk` 直接安装最新版。

### v0.5.0
- **能力补齐**：Android `register()` / `registerWithToken()` 返回真实 `deviceId`，`getDeviceToken()` / `getDeviceId()` / `getDeviceInfo()` 接入原生缓存。
- **新增 Hooks**：`useDooPush()`、`useDooPushMessage()`。
- **新增 API**：角标、权限状态、设备信息更新、统计上报。
- **新增事件**：通知点击、通知打开、Gateway open/closed/error；`connectGateway()` 在缺少 token 时会拒绝。
- **共存控制**：新增 active/passive 管理模式、Expo relay、通知展示开关。
- **Config Plugin**：扩展 Android OEM vendor 配置入口；支持内联凭证生成 services JSON，HMS/Honor Gradle plugin 注入，HMS/Honor services 文件同时复制到 app 根目录和 assets。
- **依赖底座**：iOS / Android 原生 SDK 对齐到 v1.2.0。

### v0.1.2
- **chore**：发版流水线连通性测试（无功能变更）。验证 monorepo `sync-rn-sdk.yml` → `doopush-react-native-sdk` 公仓 → `auto-publish-release.yml` → GitHub Release + npm publish 全链路。dist-tag 应解析为 `alpha`（0.1.x ≤ 0.4.x）。

### v0.1.1
- **修复 (iOS)**：通过 `ExpoAppDelegateSubscriber` 转发 APNs delegate 回调。在此之前，Expo 应用里 AppDelegate 拿到 device token 后没通路回 `DooPushManager.shared.didRegisterForRemoteNotifications(with:)`，导致 `DooPush.register()` 在用户授权后**永远 hang**。新增 `DooPushAppDelegateSubscriber`，并在 `expo-module.config.json` 里注册（autolinking 把它写进 `ExpoModulesProvider`）。同时转发 `didFailToRegister` 与 `didReceiveRemoteNotification:fetchCompletionHandler:`。
- **依赖底座**：iOS 原生 SDK 升级到 v1.1.1（podspec 兼容性修复，移除自定义 module_map / 不存在的 LICENSE 引用 / 多余的 public_header_files）。
- **结构整理**：删除嵌套的 `DooPushSDK/example/` workspace，demo 移到同级的 `sdk/react-native/DooPushSDKExample/`，跟 iOS/Android example 对齐。

### v0.1.0
- 首个 alpha。`configure`、`register`、`registerWithToken`、消息 / 注册监听器。仅 iOS APNs（active 模式）+ Android FCM。Config plugin 注入 FCM google-services。

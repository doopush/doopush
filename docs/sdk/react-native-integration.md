# React Native SDK 集成指南

DooPush React Native SDK 基于 Expo Modules API 实现，可在 Expo（managed/prebuild）和 bare React Native 项目中使用。底层复用 iOS / Android 原生 SDK，并提供命令式 API、React Hooks、事件订阅、Expo config plugin 自动配置等能力。

## 🚀 功能特性

### 📱 通道支持
- ✅ **iOS APNs**
- ✅ **Android FCM**
- ✅ **HMS / Honor / Xiaomi / OPPO / VIVO / Meizu** — 完整 plugin 配置 + bridge 链路

### ⚡ 核心功能
- ✅ 命令式 API：`configure / register / registerWithToken / getDeviceToken / getDeviceId / getDeviceInfo / updateDeviceInfo / reportStatistics / checkPermissionStatus`
- ✅ 角标 API：`setBadge / clearBadge / getBadge`
- ✅ React Hooks：`useDooPush()` / `useDooPushMessage()`
- ✅ 事件订阅：注册 / 注册错误 / 消息 / 通知点击 / 通知打开 / Gateway open/closed/error
- ✅ Config Plugin：iOS entitlement + background mode、Android FCM/HMS/Honor/Xiaomi/OPPO/VIVO/Meizu 配置文件复制、Gradle plugin/dependency 注入、manifest placeholders 合并
- ✅ 第三方共存控制：active / passive 模式切换、Expo relay、FCM 通知展示开关

## 📋 系统要求

- **iOS**：iOS 13.0+，原生 SDK ≥ 1.2.0
- **Android**：Android 8.0+ (API 26+)，原生 SDK ≥ 1.2.0（JitPack `com.github.doopush:doopush-android-sdk:1.2.0`）
- **React Native**：RN 0.73+ 或 Expo SDK 50+。**新项目推荐 Expo SDK 54+**

## 🛠 快速集成

### 1. 安装

```bash
# 走 npm @beta dist-tag 通道
npx expo install doopush-react-native-sdk@beta
# 或精确版本
npx expo install doopush-react-native-sdk@0.5.0
```

> v0.5.x 在 npm 走 `@beta` dist-tag；v1.x 起转 `@latest`。安装命令请显式带 `@beta` 或精确版本，省略 tag 不会装到 v0.5.x。
> 也支持 git tag 安装作为兜底：`npm install github:doopush/doopush-react-native-sdk#v0.5.0`

### 2. 配置 Expo plugin

在 `app.json` / `app.config.ts` 的 `expo.plugins` 中加入 `doopush-react-native-sdk`：

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
              "fcm": { "googleServicesFile": "./google-services.json" }
            }
          }
        }
      ]
    ]
  }
}
```

### 3. 注入原生工程

```bash
npx expo prebuild --clean
npx expo run:android   # 或 run:ios
```

`prebuild --clean` 会：
- iOS 端：写入 `aps-environment` entitlement + `UIBackgroundModes=remote-notification`
- Android 端：注入 DooPush Android SDK 依赖、`com.google.gms.google-services` plugin、复制 `google-services.json`、合并 `manifestPlaceholders`

## ⚙️ Android OEM 通道配置

Android OEM vendor 在 `app.json` 的 `android.vendors` 下分别配置。**支持两种方式**：

| Vendor | 方式 A（services file） | 方式 B（内联凭证） |
|---|---|---|
| **fcm** | `googleServicesFile`（必需） | — |
| **hms** | `agconnectServicesFile`（**必需**，HMS Gradle 插件依赖此文件） | — |
| **honor** | `mcsServicesFile`（推荐） | `appId` + `developerId`，或 `clientId` + `clientSecret` |
| **xiaomi** | `servicesFile` | `appId` + `appKey` |
| **oppo** | `servicesFile` | `appKey` + `appSecret` |
| **vivo** | `servicesFile` | `appId` + `apiKey` |
| **meizu** | `servicesFile` | `appId` + `appKey` |

### 完整示例

```json
{
  "expo": {
    "plugins": [
      [
        "doopush-react-native-sdk",
        {
          "appId": "your_app_id",
          "apiKey": "your_api_key",
          "android": {
            "vendors": {
              "fcm":    { "googleServicesFile": "./google-services.json" },
              "hms":    { "agconnectServicesFile": "./agconnect-services.json" },
              "honor":  { "mcsServicesFile": "./mcs-services.json" },
              "xiaomi": { "appId": "mi_app_id", "appKey": "mi_app_key" },
              "oppo":   { "appKey": "oppo_app_key", "appSecret": "oppo_app_secret" },
              "vivo":   { "appId": "vivo_app_id", "apiKey": "vivo_api_key" },
              "meizu":  { "appId": "meizu_app_id", "appKey": "meizu_app_key" }
            }
          }
        }
      ]
    ]
  }
}
```

> 内联凭证模式下，plugin 会在 `prebuild` 时把凭证序列化为 `android/app/src/main/assets/<vendor>-services.json`，DooPush 原生 SDK 在运行期从 assets 读取。HMS / Honor 的 services file 同时也会被复制到 `android/app/` 根目录，以满足各自 Gradle 插件的查找路径。
>
> ⚠️ **凭证安全**：把 `*-services.json` 加入 `.gitignore`，不要将厂商凭证提交到版本库。

## 📝 基础用法

### 命令式 API

```tsx
import { useEffect } from 'react';
import { DooPush, type DooPushMessage } from 'doopush-react-native-sdk';

export default function App() {
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
      const { token, deviceId, vendor } = await DooPush.register();
      console.log('注册成功', token, deviceId, vendor);
    } catch (e) {
      console.error('注册失败', e);
    }
  };

  // ...
}
```

### React Hooks

`useDooPush()` 把"注册状态 + 设备 token/deviceId/vendor + 权限状态 + 最近一条消息/点击/打开 + 错误"打包成单一 hook，覆盖大多数 host 的需求：

```tsx
import { useDooPush } from 'doopush-react-native-sdk';

export default function PushScreen() {
  const {
    token,
    deviceId,
    vendor,
    permissionStatus,
    lastMessage,
    lastNotificationClick,
    error,
    isRegistering,
    register,
  } = useDooPush();

  return (
    <View>
      <Button title="注册" onPress={register} disabled={isRegistering} />
      <Text>token: {token ?? '(未注册)'}</Text>
      <Text>vendor: {vendor ?? '-'}</Text>
      <Text>permission: {permissionStatus}</Text>
      {lastMessage && <Text>最近一条推送: {lastMessage.title}</Text>}
      {error && <Text style={{ color: 'red' }}>错误: {error.message}</Text>}
    </View>
  );
}
```

如果只需要历史消息列表，用更轻量的 `useDooPushMessage`：

```tsx
import { useDooPushMessage } from 'doopush-react-native-sdk';

const { messages, lastMessage, lastNotificationClick, clearMessages } =
  useDooPushMessage({ maxMessages: 100 });
```

### 角标 / 权限 / 统计

```tsx
import { DooPush } from 'doopush-react-native-sdk';

await DooPush.setBadge(3);
await DooPush.clearBadge();
const badge = await DooPush.getBadge();

const permission = await DooPush.checkPermissionStatus();
// 'authorized' | 'denied' | 'notDetermined' | 'provisional' | 'ephemeral' | 'unknown'

await DooPush.reportStatistics();
const info = await DooPush.getDeviceInfo();
await DooPush.updateDeviceInfo();
```

### Gateway / WebSocket 事件

注册成功后 SDK 自动维护 Gateway 连接（用于设备「在线」状态）。host 可以监听连接状态变化：

```tsx
import { DooPush } from 'doopush-react-native-sdk';

const openSub = DooPush.addGatewayOpenListener(() => {
  console.log('gateway connected');
});
const closedSub = DooPush.addGatewayClosedListener((e) => {
  console.log('gateway closed', e.code, e.reason);
});
const errorSub = DooPush.addGatewayErrorListener((e) => {
  console.warn('gateway error', e.message);
});

// 极少数场景下手动控制（注册后通常不需要）
await DooPush.connectGateway();
await DooPush.disconnectGateway();
```

## 🤝 第三方共存

### 与 `expo-notifications`

iOS 上 DooPush 通过 delegate forwarding 接管 `UNUserNotificationCenterDelegate`，`expo-notifications` 自己的监听不受影响。Android 上需要显式开启 relay：

```tsx
DooPush.setNotificationManagementMode('active');     // 默认即 active
DooPush.setExpoNotificationRelayEnabled(true);        // Android 把 FCM 消息再 broadcast 给 expo-notifications
```

> `setNotificationDisplayEnabled` 仅控制 Android FCM 的 SDK 自管展示开关；iOS 端为 no-op，使用 `setNotificationManagementMode('passive')` 关闭 DooPush 的 delegate tracking。

### 与 `@react-native-firebase/messaging`

`@react-native-firebase/messaging` 与 DooPush FCM 通道**二选一** —— 两个库都声明 `FirebaseMessagingService`，manifest merger 只能保留一个。已经使用 `react-native-firebase` 的项目，在 plugin 配置里**省略 `fcm` 厂商**，由 `react-native-firebase` 拿 token，再交给 DooPush passive 注册：

```tsx
import messaging from '@react-native-firebase/messaging';
import { DooPush } from 'doopush-react-native-sdk';

const token = await messaging().getToken();
const { deviceId } = await DooPush.registerWithToken(token, 'fcm');
```

## 📖 完整 API 参考

详细的方法签名、事件类型、Hooks 返回值结构请参见 npm 包内的 README：[doopush-react-native-sdk](https://www.npmjs.com/package/doopush-react-native-sdk)。

## 🐛 故障排查

- **`registering…` 一直转**（用户已点 Allow）—— iOS 上检查是否使用了 v0.1.1+，更早版本未注册 `ExpoAppDelegateSubscriber`，APNs token 不会回到 DooPush。
- **Android `expo prebuild` 报 `manifestPlaceholders` 找不到字段** —— 检查 `app.json` 里 OEM 凭证是否齐全（schema 校验会要求 servicesFile 或对应内联字段）。
- **HMS / Honor 真机注册失败** —— 确认 `agconnect-services.json` / `mcs-services.json` 真机可读、`app.json` 的 `bundleIdentifier` 与 services file 中的 `package_name` 一致。
- **`Unable to resolve "doopush-react-native-sdk"`** —— monorepo 本地开发用 `file:` 依赖时加 `--install-links`，避免 npm 默认软链导致 Metro 解析失败。

## 📦 版本与发布

- npm 包：`doopush-react-native-sdk`，dist-tag `@beta`（v0.5.x）/ `@latest`（v1.x 起）
- monorepo 源码：`sdk/react-native/DooPushSDK/`
- 公仓 mirror：`https://github.com/doopush/doopush-react-native-sdk`（由 `sync-rn-sdk.yml` 自动同步）

---

*文档基于 React Native SDK v0.5.0，与 iOS SDK v1.2.0 / Android SDK v1.2.0 对齐。*

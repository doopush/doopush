# DooPush React Native SDK

> **v0.1.1 alpha** —— 最小 API surface，端到端真实可用。
> 仅支持 FCM (Android) + APNs (iOS)。OEM 通道、React Hooks 在 v0.5.0 beta。

[DooPush](https://doopush.com) 推送通知服务的 React Native SDK。基于 Expo Modules API 实现，可在 Expo（managed / prebuild）和 bare React Native 项目里使用。

## v0.1.x alpha 提供什么

- ✅ `DooPush.configure(config)`
- ✅ `DooPush.register()` —— iOS APNs / Android FCM 自动流程
- ✅ `DooPush.registerWithToken(token, vendor)` —— 调用方已经有 token 时（如配合 expo-notifications 共存）
- 🟡 `DooPush.getDeviceToken()` / `getDeviceId()` —— 当前都返回 `null`，原生 getter 还没暴露，v0.5.0 上线
- ✅ 事件监听：`addRegisterListener`、`addRegisterErrorListener`、`addMessageListener`
- ✅ Config 插件：FCM 厂商（google-services.json）、iOS entitlement
- ✅ Android Active 模式：DooPush 接管通知 UI；与 `expo-notifications` 通过广播 relay 共存（opt-in，JS bridge 在 v0.5.0）

### v0.1 已知限制

- `register()` 返回 `{token, deviceId, vendor}`，但 Android 端 `deviceId` 当前是空字符串（服务端 deviceId 还没在 bridge 层捕获，v0.5.0 修）。`token` 和 `vendor` 字段是对的。
- `getDeviceToken()` / `getDeviceId()` 在 Android 上一直返回 `null`（底层 SDK 还没公开 getter）。

## v0.1 不包含（v0.5.0+ 才有）

- React Hooks（`useDooPush`、`useDooPushToken`）
- OEM 通道（HMS / Honor / Xiaomi / OPPO / VIVO / Meizu）
- WebSocket gateway 的 JS API
- 统计 / 角标 / 通道相关的 JS API
- npm 发布（当前用 git tag）

## 前置条件

- iOS 原生 SDK ≥ **1.1.1**（SPM tag `v1.1.1` of `doopush-ios-sdk`，或路径方式本地引用）
- Android 原生 SDK ≥ **1.1.0**（JitPack `com.github.doopush:doopush-android-sdk:v1.1.0`，或本地 mavenLocal）
- Expo SDK 50+（或 RN 0.73+ bare）。**新项目推荐 Expo SDK 54+**

## 快速安装（公开发布后）

```bash
npx expo install doopush-react-native-sdk
```

> v0.1.x alpha **暂未发到 npm**，公开仓走 git tag：
> `npm install github:doopush/doopush-react-native-sdk#v0.1.1`

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
              "fcm": { "googleServicesFile": "./google-services.json" }
            }
          }
        }
      ]
    ]
  }
}
```

```bash
npx expo prebuild --clean
npx expo run:android   # 或 run:ios
```

## 用法

```tsx
import { useEffect, useState } from 'react';
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
    return () => sub.remove();
  }, []);

  const handleRegister = async () => {
    try {
      const { token, deviceId } = await DooPush.register();
      console.log('注册成功', token, deviceId);
    } catch (e) {
      console.error('注册失败', e);
    }
  };

  // ...
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
DooPush.setExpoNotificationRelayEnabled(true);
```

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

### v0.1.1
- **修复 (iOS)**：通过 `ExpoAppDelegateSubscriber` 转发 APNs delegate 回调。在此之前，Expo 应用里 AppDelegate 拿到 device token 后没通路回 `DooPushManager.shared.didRegisterForRemoteNotifications(with:)`，导致 `DooPush.register()` 在用户授权后**永远 hang**。新增 `DooPushAppDelegateSubscriber`，并在 `expo-module.config.json` 里注册（autolinking 把它写进 `ExpoModulesProvider`）。同时转发 `didFailToRegister` 与 `didReceiveRemoteNotification:fetchCompletionHandler:`。
- **依赖底座**：iOS 原生 SDK 升级到 v1.1.1（podspec 兼容性修复，移除自定义 module_map / 不存在的 LICENSE 引用 / 多余的 public_header_files）。
- **结构整理**：删除嵌套的 `DooPushSDK/example/` workspace，demo 移到同级的 `sdk/react-native/DooPushSDKExample/`，跟 iOS/Android example 对齐。

### v0.1.0
- 首个 alpha。`configure`、`register`、`registerWithToken`、消息 / 注册监听器。仅 iOS APNs（active 模式）+ Android FCM。Config plugin 注入 FCM google-services。

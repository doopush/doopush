# DooPush React Native SDK

> **v0.1.0 alpha** — Minimal API surface for end-to-end validation.
> FCM (Android) + APNs (iOS) only. OEM channels and React Hooks coming in v0.5.0 beta.

React Native SDK for [DooPush](https://doopush.com) push notification service. Built with Expo Modules API; works in Expo (managed / prebuild) and bare React Native.

## What's in v0.1.0 alpha

- ✅ `DooPush.configure(config)`
- ✅ `DooPush.register()` — APNs (iOS) / FCM (Android) auto flow
- ✅ `DooPush.registerWithToken(token, vendor)` — for callers with a token already
- 🟡 `DooPush.getDeviceToken()` / `getDeviceId()` — both return `null` in v0.1.0 (native getters not yet exposed; arrives in v0.5.0)
- ✅ Event listeners: `addRegisterListener`, `addRegisterErrorListener`, `addMessageListener`
- ✅ Config plugin: FCM vendor (google-services.json), iOS entitlements
- ✅ Active mode (Android): DooPush owns notification UI; coexistence with `expo-notifications` via broadcast relay (opt-in, JS bridge in v0.5.0)

### Known v0.1 limitations

- `register()` resolves `{token, deviceId, vendor}` but `deviceId` is currently the empty string on Android (server-side deviceId not yet captured by the bridge — wired up in v0.5.0). The `token` and `vendor` fields are correct.
- `getDeviceToken()` / `getDeviceId()` always return `null` on Android (no public getter on the underlying SDK yet).

## Not in v0.1.0 (coming in v0.5.0+)

- React hooks (`useDooPush`, `useDooPushToken`)
- OEM vendors (HMS / Honor / Xiaomi / OPPO / VIVO / Meizu)
- WebSocket gateway JS API
- Statistics / badge / channel JS API
- npm publication (use git tag for now)

## Prerequisites

- iOS native SDK ≥ 1.1.0 (SPM tag `v1.1.0` of `doopush-ios-sdk`, OR path-based dev dependency)
- Android native SDK ≥ 1.1.0 (JitPack `com.github.doopush:doopush-android-sdk:v1.1.0`, OR mavenLocal)
- Expo SDK 50+ (or RN 0.73+ bare)

## Quick install (once published)

```bash
npx expo install doopush-react-native-sdk
```

In `app.json`:

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
npx expo run:android   # or run:ios
```

## Usage

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
      console.log('push received', m);
    });
    return () => sub.remove();
  }, []);

  const handleRegister = async () => {
    try {
      const { token, deviceId } = await DooPush.register();
      console.log('registered', token, deviceId);
    } catch (e) {
      console.error('register failed', e);
    }
  };

  // ...
}
```

## Local development

This package is part of the [doopush monorepo](https://github.com/doopush/doopush). To develop:

```bash
# 1) Build the SDK
cd sdk/react-native/DooPushSDK
pnpm install
pnpm build
pnpm test                   # plugin Jest tests

# 2) Use the sibling demo app
cd ../DooPushSDKExample
npm install
npm install file:../DooPushSDK --install-links   # copy SDK (avoid symlink so Metro resolves)
npx expo run:ios            # iOS sim or --device "<device name>"
npx expo run:android        # Android emulator or --device <id>
```

The demo lives at `sdk/react-native/DooPushSDKExample/` (peer of the SDK, not nested), keeping the same shape as the iOS / Android native examples in this monorepo.

## Coexistence

### With `expo-notifications`

Compatible by default. DooPush owns `UNUserNotificationCenterDelegate` (iOS) but uses delegate-forwarding to keep `expo-notifications` listeners working. On Android, DooPush owns `FirebaseMessagingService`; if you need `expo-notifications` to also receive FCM messages, call (in v0.5.0+):

```ts
DooPush.setExpoNotificationRelayEnabled(true);
```

### With `@react-native-firebase/messaging`

**Choose one** — both libraries declare `FirebaseMessagingService` and only one wins manifest merger. If you already use `react-native-firebase`, omit the FCM vendor from the DooPush plugin and use `react-native-firebase`'s token API:

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
- **Fix (iOS)**: Forward APNs delegate callbacks via `ExpoAppDelegateSubscriber`. Without this, on Expo apps the device token never reached `DooPushManager.shared.didRegisterForRemoteNotifications(with:)` and `DooPush.register()` hung forever after the user granted permission. Adds `DooPushAppDelegateSubscriber` registered in `expo-module.config.json`.
- **Repo hygiene**: removed nested `DooPushSDK/example/` workspace; the demo lives at `sdk/react-native/DooPushSDKExample/` (peer of the SDK), aligning with the iOS / Android example layout.

### v0.1.0
- Initial alpha. `configure`, `register`, `registerWithToken`, message / register listeners. iOS APNs (active mode) + Android FCM only. Config plugin with FCM google-services injection.

# DooPush React Native SDK 示例 App

基于 Expo SDK 54 的最小 demo，import 同级目录的 `doopush-react-native-sdk`（路径：`../DooPushSDK/`），用来真实验证：

- `DooPush.configure({...})` 配置
- `DooPush.register()` —— 真机走完整 APNs / FCM token + 服务端注册流程
- `DooPush.addMessageListener(...)` —— 收前/后台推送

它是 monorepo 里 `sdk/ios/DooPushSDKExample/`、`sdk/android/DooPushSDKExample/` 的 RN 对应版本。

---

## 前置条件

- Mac（iOS）或 Linux/Mac（Android）
- Node 18+
- Xcode 15+（iOS 真机/模拟器）+ Apple Developer Team（真机签名要）
- Android Studio + Android SDK（Android 端）+ 一台带 Google Play Services 的设备/模拟器（FCM 要 GMS）
- 一组真实的 DooPush `appId` / `apiKey` + 服务端 baseURL

## 1）装依赖

```bash
cd sdk/react-native/DooPushSDKExample
npm install

# 把 SDK 装成真实拷贝（不是 symlink，否则 Metro 解析不到）
# SDK 源在上一级目录 ../DooPushSDK
npm install file:../DooPushSDK --install-links
```

**如果 `--install-links` 在你的 npm 版本上不生效**（`node_modules/doopush-react-native-sdk` 仍然是软链），用以下兜底命令直接复制：

```bash
DST=node_modules/doopush-react-native-sdk
SRC=../DooPushSDK
rm -rf "$DST"
mkdir -p "$DST"
cp -R "$SRC/build" "$SRC/ios" "$SRC/android" "$SRC/plugin" \
      "$SRC/package.json" "$SRC/expo-module.config.json" "$SRC/app.plugin.js" \
      "$DST/"
```

> 改了 `../DooPushSDK/src` 或 `../DooPushSDK/ios` 之后，要重跑上面的 install/cp 才能让改动进 example 的 `node_modules`。

## 2）填真实凭证

两个文件都要填，**Both 都必须**（plugin 配 native 编译期，runtime configure 是 JS 用的运行时值）：

**a. `app.json`** —— config plugin（填 iOS entitlement / Android 清单 / 编译期配置）

```json
"plugins": [
  ...,
  ["doopush-react-native-sdk", {
    "appId": "your_app_id",                  // ← 替换
    "apiKey": "your_api_key",                // ← 替换
    "baseURL": "https://doopush.com/api/v1", // ← 替换
    "ios": { "mode": "development" }         // 或 "production"
  }]
]
```

**b. `app/(tabs)/index.tsx`** —— `DooPush.configure({...})` 的运行时值

```ts
DooPush.configure({
  appId: 'your_app_id',
  apiKey: 'your_api_key',
  baseURL: 'https://doopush.com/api/v1',
});
```

### Android FCM（可选）

要跑 Android 端推送，还得提供一个 Firebase 项目的 `google-services.json`，放在本目录根：

```bash
cp /path/to/your/google-services.json ./google-services.json
```

`google-services.json` 已被 `.gitignore` 排除，**不要**把它 commit 进版本库。

## 3）跑 iOS 模拟器

```bash
# 凭证填好之后
npx expo run:ios
```

第一次 build 5–10 分钟（CocoaPods + Xcode）。后续走缓存很快。

> ⚠️ 模拟器**拿不到真 APNs token**，所以授权完之后 `register()` 会一直 hang。要端到端验证推送必须用真机。

## 4）跑 iPhone 真机

1. USB 连接（或 Xcode → Devices and Simulators 里 Wi-Fi 配对）
2. 确保 iPhone 和 Mac **在同一 Wi-Fi**
3. 注入 Mac 的 LAN IP，让真机能找到 Metro：

```bash
export REACT_NATIVE_PACKAGER_HOSTNAME=<你的_Mac_LAN_IP>     # 比如 192.168.1.42
npx expo run:ios --device "<设备名 用引号包住>"
```

> 第一次跑完，iPhone 会要求**信任开发者证书**：去 *设置 → 通用 → VPN 与设备管理* 里手动信任 → 回到 app 重启。

## 5）跑 Android（模拟器或真机）

```bash
# 先确认 google-services.json 已经放好（步骤 2）
npx expo run:android
```

真机要打开 USB 调试，跟 Mac 同 Wi-Fi。

---

## 故障排查

- **红框 `Registered callable JavaScript modules (n = 0)`** —— Metro 模式不对。在跑 `expo start` 的终端里按 `s` 切到 "development build"（custom dev build 不能跑在 Expo Go 里）。
- **`Unable to resolve "doopush-react-native-sdk"`** —— `node_modules/doopush-react-native-sdk` 是个 symlink（npm 7+ 装 `file:` 依赖默认行为）。重装时加 `--install-links`，或者用上面的 `cp -R` 兜底。
- **真机红框 `Could not connect to development server`** —— 检查 `REACT_NATIVE_PACKAGER_HOSTNAME` 是 Mac 的实际 LAN IP（不是 `localhost`），iPhone 跟 Mac 要在同一 Wi-Fi。
- **`registering…` 一直转**（点了 Allow 但 token 不出来）—— 你用的 SDK 版本早于 v0.1.1。v0.1.1 加了 `ExpoAppDelegateSubscriber`，把 APNs 回调从 AppDelegate 转回 SDK。升级 SDK 即可。
- **真机 `bundle URL = null` 红屏** —— 缺 `expo-dev-client` 包。装上 `npx expo install expo-dev-client` 后重 prebuild + 重 build。

## 项目结构

```
DooPushSDKExample/
├── app/                   # expo-router 路由
│   ├── _layout.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx      # demo 页 —— Configure + Register 按钮 + 消息列表
│   │   └── explore.tsx
│   └── modal.tsx
├── assets/                # 图标 / 启动图
├── components/            # ThemedText、ParallaxScrollView 等（Expo 默认模板）
├── app.json               # Expo 配置 + DooPush plugin
├── package.json
└── README.md              # 本文件
```

## License

MIT（与 SDK 一致）。

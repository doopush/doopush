---
name: releasing-doopush-sdk-version
description: Use when bumping a DooPush SDK version (iOS / Android / React Native) and shipping a new release from the doopush monorepo. Triggers include "release SDK", "发版", "ship vX.Y.Z", "bump iOS SDK", "publish RN SDK to npm", "更新 SDK 版本", or any time package.json/podspec/build.gradle SDK_VERSION is being changed.
---

# 发布 DooPush SDK 版本

## Overview

DooPush 在 monorepo 里维护三个 SDK，每个自动同步到独立公仓 + 自动产出 release。**发版只需要：改版本号 + 改 CHANGELOG + commit + merge dev → main**。剩下全自动。

| SDK | 源目录 | 公仓 | 发布渠道 |
|---|---|---|---|
| iOS | `sdk/ios/DooPushSDK/` | `doopush/doopush-ios-sdk` | GitHub Release（framework.zip + podspec）+ SwiftPM |
| Android | `sdk/android/DooPushSDK/` | `doopush/doopush-android-sdk` | GitHub Release（AAR）+ JitPack |
| React Native | `sdk/react-native/DooPushSDK/` | `doopush/doopush-react-native-sdk` | npm + GitHub Release |

## 版本号位置（按 SDK）

每个 SDK 有 **2 处**版本号必须同步改，漏一个会导致运行时 `sdkVersion` 跟实际产物不一致。

| SDK | 文件 1（构建/分发） | 文件 2（运行时常量） |
|---|---|---|
| iOS | `DooPushSDK.podspec` → `spec.version` | `Sources/DooPushSDK/DooPushManager.swift` → `sdkVersion` |
| Android | `lib/build.gradle` → `SDK_VERSION` 与 `version`（在 publishing 块） | 同 SDK_VERSION，由 BuildConfig 读 |
| RN | `package.json` → `version` | （无独立运行时常量） |

CHANGELOG 在每个 SDK 的 `README.md` 末尾追加，iOS 用 `## 更新日志`，RN/Android 用 `## CHANGELOG`：

```markdown
### vX.Y.Z
- **Fix/Feat (作用域)**：一句话写"为什么"，附"做了什么"。
- 关联其他 SDK 的版本依赖变化（例如 RN v0.1.1 跟 iOS v1.1.1 必须配对）。
```

## 流水线触发条件

监听 `main` 分支 + 路径过滤。**只 push 到 dev 不会触发任何东西**——必须 merge → main。

| Workflow（在 monorepo） | 路径 | 干啥 |
|---|---|---|
| `.github/workflows/sync-ios-sdk.yml` | `sdk/ios/DooPushSDK/**` | 推到 iOS 公仓 main |
| `.github/workflows/sync-android-sdk.yml` | `sdk/android/DooPushSDK/**` | 推到 Android 公仓 main |
| `.github/workflows/sync-rn-sdk.yml` | `sdk/react-native/DooPushSDK/**` | 推到 RN 公仓 main |

每个公仓内自带的 `auto-build-release.yml`（iOS/Android）或 `auto-publish-release.yml`（RN）会自动跑：tag → Release → 上传产物 → npm publish（仅 RN）。

## 标准发版步骤（10 分钟）

```bash
# 0) 在 dev 分支
git checkout dev && git pull origin dev

# 1) 改版本号 + CHANGELOG（按上表 2 处必须同步）

# 2) 单 commit 一刀切，每个 SDK 独立 commit
git add sdk/<platform>/DooPushSDK/
git commit -m "fix(<scope>): 一句话; bump A.B.C -> A.B.D

简短解释为什么。
"

# scope 规约：
#   ios-sdk           - iOS 原生 SDK
#   android-sdk       - Android 原生 SDK
#   rn-sdk            - RN SDK（共同）
#   rn-sdk-ios        - RN SDK 仅 iOS 部分
#   rn-sdk-android    - RN SDK 仅 Android 部分
#   rn-sdk-example    - DooPushSDKExample demo

# 3) 推 dev（备份用）
git push origin dev

# 4) 合并到 main 触发流水线
git checkout main
git merge --ff-only dev
git push origin main
```

## 验证（按 SDK 等待时间）

| SDK | 看哪里 | 等多久 | 标志 |
|---|---|---|---|
| iOS | https://github.com/doopush/doopush-ios-sdk/actions | 5-10 分钟 | "Auto Build and Release" 绿勾 + Releases 页有新 vX.Y.Z |
| Android（GitHub） | https://github.com/doopush/doopush-android-sdk/actions | 3-5 分钟 | 同上，Release 带 AAR |
| Android（JitPack） | 用浏览器**主动访问** `https://jitpack.io/com/github/doopush/doopush-android-sdk/vX.Y.Z/doopush-android-sdk-vX.Y.Z.pom` | 5-10 分钟 | https://jitpack.io/#doopush/doopush-android-sdk 显示绿勾 |
| RN GitHub | https://github.com/doopush/doopush-react-native-sdk/releases | 3-5 分钟 | tag vX.Y.Z + Release |
| RN npm | https://www.npmjs.com/package/doopush-react-native-sdk | 同上 | 新版本可见，dist-tag 正确 |

**JitPack 必须主动访问 pom URL 触发**——它是 lazy build，不会自动监听 GitHub tag。这是手动步骤。

## RN npm dist-tag 推断（auto-publish-release.yml 自动逻辑）

| 版本号 pattern | dist-tag | 用户安装命令 |
|---|---|---|
| `0.0.x` – `0.4.x` | `alpha` | `npm install doopush-react-native-sdk@alpha` |
| `0.5.x` – `0.9.x` | `beta` | `npm install doopush-react-native-sdk@beta` |
| `*-rc.*` | `rc` | `npm install doopush-react-native-sdk@rc` |
| `1.0.0` 及以上 | `latest` | `npm install doopush-react-native-sdk` |

避免 alpha/beta 意外占据 `@latest` 误导新用户。

## 必备 secrets（已配，仅作清单）

| 仓库 | secret | 用途 |
|---|---|---|
| monorepo | `IOS_SDK_DEPLOY_KEY` | sync-ios-sdk.yml SSH push |
| monorepo | `ANDROID_SDK_DEPLOY_KEY` | sync-android-sdk.yml SSH push |
| monorepo | `RN_SDK_DEPLOY_KEY` | sync-rn-sdk.yml SSH push |
| `doopush-react-native-sdk` | `NPM_TOKEN` | npm publish |

## 常见错误

| 现象 | 原因 | 修法 |
|---|---|---|
| Workflow 不触发 | push 在 dev 分支 | merge 到 main 才触发 |
| 改了版本但运行时 `sdkVersion` 仍是旧值 | 只改了 podspec/gradle，没改 Swift/Kotlin 常量 | 两处必须同步改（看上表"运行时常量"列） |
| RN 流水线跑了但 `npm publish` 跳过 | git tag vX.Y.Z 已存在（之前手动打过） | 删公仓的 tag，或 bump 到下个 patch |
| JitPack 显示 "Build not found" | 还没人访问过 pom URL 触发 | 浏览器手动打开 pom URL |
| RN 第一次发布失败 "package name taken" | npmjs.com 上 `doopush-react-native-sdk` 被占 | 改 SDK package.json 的 name 用 scope（`@doopush/react-native-sdk`），公仓 README 同步改 |
| iOS 真机收不到 token（v0.1.0 已知 bug） | 缺 `ExpoAppDelegateSubscriber`（v0.1.1 修了） | RN SDK 升 ≥ 0.1.1 |
| RN demo 红框 `n=0 callable modules` | Metro 在 Expo Go 模式下发的 bundle 跟 dev build 不兼容 | `expo start` 终端按 `s` 切到 development build；或 `expo start --dev-client` |
| RN demo "Unable to resolve doopush-react-native-sdk" | npm 7+ `file:` 装成了 symlink，Metro 解析不到 | 重装时加 `--install-links`，或 `cp -R ../DooPushSDK node_modules/doopush-react-native-sdk` 兜底 |

## 跨 SDK 联动版本要求

发版时，如果 **RN SDK 依赖某个 iOS/Android 原生 SDK 的新特性**，必须**先发原生 SDK，再发 RN**：

1. 先 commit + merge iOS/Android 的 patch（让 native v1.X.Y release 出来）
2. 再改 RN SDK 的 `README.md` 把 "Prerequisites" 里的原生 SDK 最低版本号顶上去
3. RN SDK 自己也 bump 一个 patch（说明 "依赖 native vX.Y.Z+"）
4. commit + merge RN 部分

iOS 原生 SDK 的 podspec `s.dependency 'DooPushSDK'` 不带版本号——本地路径开发用，发布到 CocoaPods Trunk 时再加 `, '~> X.Y'`。

## 红线（不要做）

- ❌ **直接在 main 分支改代码 commit**——破坏 dev → main 评审节奏
- ❌ **手动 git tag 然后 push**——流水线自己会打 tag，手动 tag 会让 `auto-publish` 检测到 "tag exists" 跳过
- ❌ **跳过版本号文件 1**（podspec / build.gradle）只改文件 2（常量）——分发产物不会带新版本号，依赖方拉不到
- ❌ **同一个 PR 里 bump 多个 SDK 但 commit message 只写一个**——`paths` 过滤都会被触发但语义混乱，issue tracker 也理不清
- ❌ **alpha 阶段把 dist-tag 设成 latest**——会污染默认 `npm install` 用户的依赖

## 真实参考（最近一次发版的 commit）

```
2268036 fix(ios-sdk): podspec compat for RN/CocoaPods consumers; bump 1.1.0 -> 1.1.1
7a5693d fix(rn-sdk-ios): forward APNs callbacks via ExpoAppDelegateSubscriber; bump 0.1.0 -> 0.1.1
```

这两个 commit 是真机 token 跑通后回头补的修复 + 版本 bump，可以当 commit message + CHANGELOG 写法的样板。

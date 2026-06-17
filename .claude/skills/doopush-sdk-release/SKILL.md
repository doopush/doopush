---
name: doopush-sdk-release
description: Use when bumping a DooPush SDK version (iOS / Android / React Native) and shipping a new release from the doopush monorepo. Triggers include "release SDK", "发版", "ship vX.Y.Z", "bump iOS SDK", "publish RN SDK to npm", "更新 SDK 版本", or any time package.json/podspec/build.gradle SDK_VERSION is being changed.
---

# 发布 DooPush SDK 版本

## Overview

DooPush 在 monorepo 里维护三个 SDK，每个自动同步到独立公仓 + 自动产出 release。**发版只需要在干净的 main 分支上：改版本号 + 改 CHANGELOG + commit + push main**。剩下全自动。

| SDK | 源目录 | 公仓 | 发布渠道 |
|---|---|---|---|
| iOS | `sdk/ios/DooPushSDK/` | `doopush/doopush-ios-sdk` | GitHub Release（framework.zip + podspec）+ SwiftPM |
| Android | `sdk/android/DooPushSDK/` | `doopush/doopush-android-sdk` | GitHub Release（AAR）+ JitPack |
| React Native | `sdk/react-native/DooPushSDK/` | `doopush/doopush-react-native-sdk` | npm + GitHub Release |

主线流程（依次读）：§ Step 0：诊断 → § 标准发版步骤 → § 同步 docs 站点 → § 验证。下方"参考"部分按需回查。

## Step 0：诊断（必须先跑）

```bash
bash .claude/skills/doopush-sdk-release/scripts/diagnose.sh
```

precheck（任一失败立即 `exit 1`）：

- **当前分支必须是 `main`** — 发版是机械的 bump + CHANGELOG，没有"评审"语义；dev/feature 分支的工作要先合并进 main 再来发版
- **工作区必须干净** — `git status --porcelain` 必须为空（包括未追踪文件）；防止把无关改动混进 release commit

输出两段：

1. **Per-SDK** — 每个 SDK 自上次 bump 以来的 commit 数和建议
   - `→ SKIP`：**这次不要发这个 SDK**。不改版本号、不写 CHANGELOG、不动它任何文件。
   - `→ RELEASE (patch/minor/major, suggest X.Y.Z)`：按建议版本 bump；如果实际改动语义更激进（比如有 BREAKING），自己提到 minor/major。
2. **Cross-SDK coupling** — RN 在 README "Prerequisites" 里写的 native 最低版本号 vs 仓库里 native 实际版本
   - `✗ (bump iOS first)` / `✗ (bump Android first)`：**先发底层那个**，等公仓出 release 后再回来发 RN。背景见 § 跨 SDK 联动版本要求。

### 诊断 → 决策

| 输出特征 | 行动 |
|---|---|
| precheck 失败 | 按错误提示先把分支/工作区整理好，再回来跑 |
| 全 SKIP | 没有要发的 SDK，**本次发版结束**。不要为了"流水线联通性"硬 bump。 |
| 一个或多个 RELEASE，无 ✗ | 走 § 标准发版步骤 |
| 有 ✗ | 先发底层 SDK 走完一轮，再重跑诊断决定上层 |

## 标准发版步骤（5 分钟）

```bash
# 1) 对每个 RELEASE 的 SDK：改版本号（按 § 版本号位置 的 2 处）+ 在 README 末尾加 CHANGELOG

# 2) 每个 RELEASE 的 SDK 一个独立 commit
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

# 3) 同步 docs 站点（见 § 同步 docs 站点）—— 单独 commit
git add docs/sdk/
git commit -m "docs: bump SDK references for <list of bumped SDKs>"

# 4) 推 main 触发流水线
git push origin main
```

## 同步 docs 站点

`docs/` 站点不在 sync workflow 监听路径里，但里面有硬编码版本号。SDK bump 后按下表更新，**独立 commit**。

| 文件 | 何时改 | 字段 |
|---|---|---|
| `docs/sdk/index.md` | 任意 SDK bump | 首页 SDK 状态表里对应 SDK 那行的 `vX.Y.Z` |
| `docs/sdk/ios-integration.md` | iOS bump | SwiftPM `from: "X.Y.Z"` 那行 |
| `docs/sdk/android-integration.md` | Android bump | "方式二：JitPack" 段里 `implementation 'com.github.doopush:doopush-android-sdk:X.Y.Z'` 那行 |
| `docs/sdk/react-native-integration.md` | 原生 SDK 有 breaking change 时 | Prerequisites 两行（iOS / Android 最低版本） |

`docs/.vitepress/config.ts` 没有版本号，不动。

## 验证（按 SDK 等待时间）

| SDK | 看哪里 | 等多久 | 标志 |
|---|---|---|---|
| iOS | https://github.com/doopush/doopush-ios-sdk/actions | 5-10 分钟 | "Auto Build and Release" 绿勾 + Releases 页有新 vX.Y.Z |
| Android（GitHub） | https://github.com/doopush/doopush-android-sdk/actions | 3-5 分钟 | 同上，Release 带 AAR |
| Android（JitPack） | 公仓 `auto-build-release.yml` 自带 curl ping，通常 5-10 分钟自动构建好；卡住可手动访问 `https://jitpack.io/com/github/doopush/doopush-android-sdk/vX.Y.Z/doopush-android-sdk-vX.Y.Z.pom` | 5-10 分钟 | https://jitpack.io/#doopush/doopush-android-sdk 显示绿勾 |
| RN GitHub | https://github.com/doopush/doopush-react-native-sdk/releases | 3-5 分钟 | tag vX.Y.Z + Release |
| RN npm | https://www.npmjs.com/package/doopush-react-native-sdk | 同上 | 新版本可见，dist-tag 正确 |

---

## 参考

### 版本号位置（按 SDK）

漏改任何一处会导致运行时 `sdkVersion` 跟产物不一致。

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

### 流水线触发条件

监听 `main` 分支 + 路径过滤。

| Workflow（在 monorepo） | 路径 | 干啥 |
|---|---|---|
| `.github/workflows/sync-ios-sdk.yml` | `sdk/ios/DooPushSDK/**` | 推到 iOS 公仓 main |
| `.github/workflows/sync-android-sdk.yml` | `sdk/android/DooPushSDK/**` | 推到 Android 公仓 main |
| `.github/workflows/sync-rn-sdk.yml` | `sdk/react-native/DooPushSDK/**` | 推到 RN 公仓 main |

每个公仓内自带的 `auto-build-release.yml`（iOS/Android）或 `auto-publish-release.yml`（RN）会自动跑：tag → Release → 上传产物 → npm publish（仅 RN）。

### 跨 SDK 联动版本要求（Step 0 输出 ✗ 时回看这里）

发版时，如果 **RN SDK 依赖某个 iOS/Android 原生 SDK 的新特性**，必须**先发原生 SDK，再发 RN**：

1. 先 commit + push iOS/Android 的 patch（让 native v1.X.Y release 出来）
2. 等公仓 `auto-build-release.yml` 跑完、Release 真的可拉
3. 再改 RN SDK 的 `README.md` 把 "Prerequisites" 里的原生 SDK 最低版本号顶上去
4. RN SDK 自己也 bump 一个 patch（说明 "依赖 native vX.Y.Z+"），commit + push

iOS 原生 SDK 的 podspec `s.dependency 'DooPushSDK'` 不带版本号——本地路径开发用，发布到 CocoaPods Trunk 时再加 `, '~> X.Y'`。

### 必备 secrets（已配，仅作清单）

| 仓库 | secret | 用途 |
|---|---|---|
| monorepo | `IOS_SDK_DEPLOY_KEY` | sync-ios-sdk.yml SSH push |
| monorepo | `ANDROID_SDK_DEPLOY_KEY` | sync-android-sdk.yml SSH push |
| monorepo | `RN_SDK_DEPLOY_KEY` | sync-rn-sdk.yml SSH push |
| `doopush-react-native-sdk` | `NPM_TOKEN` | npm publish |

### 常见错误

| 现象 | 原因 | 修法 |
|---|---|---|
| Workflow 不触发 | push 到非 main 分支（绕过 precheck 跑 skill） | 把对应 commit 合到 main 再 push origin main |
| 改了版本但运行时 `sdkVersion` 仍是旧值 | 只改了 podspec/gradle，没改 Swift/Kotlin 常量 | 两处必须同步改（看 § 版本号位置 的"运行时常量"列） |
| RN 流水线跑了但 `npm publish` 跳过 | git tag vX.Y.Z 已存在（之前手动打过） | 删公仓的 tag，或 bump 到下个 patch |
| JitPack 显示 "Build not found" | 还没人访问过 pom URL 触发 | 浏览器手动打开 pom URL |
| RN 第一次发布失败 "package name taken" | npmjs.com 上 `doopush-react-native-sdk` 被占 | 改 SDK package.json 的 name 用 scope（`@doopush/react-native-sdk`），公仓 README 同步改 |
| iOS 真机收不到 token（v0.1.0 已知 bug） | 缺 `ExpoAppDelegateSubscriber`（v0.1.1 修了） | RN SDK 升 ≥ 0.1.1 |
| RN demo 红框 `n=0 callable modules` | Metro 在 Expo Go 模式下发的 bundle 跟 dev build 不兼容 | `expo start` 终端按 `s` 切到 development build；或 `expo start --dev-client` |
| RN demo "Unable to resolve doopush-react-native-sdk" | npm 7+ `file:` 装成了 symlink，Metro 解析不到 | 重装时加 `--install-links`，或 `cp -R ../DooPushSDK node_modules/doopush-react-native-sdk` 兜底 |

### 红线（不要做）

- ❌ **跳过 Step 0 诊断**直接 bump——你不知道哪些 SDK 真有改动，容易发空版本或漏 cross-SDK coupling
- ❌ **诊断说 SKIP 还硬 bump 那个 SDK**——污染版本历史，让用户分不清哪些版本有实质内容；要做联通性测试就在 commit message 里明确写"无功能变更"，但优先选别的方式（比如直接 workflow_dispatch 手动触发）
- ❌ **把 docs 站点改动塞进 SDK release commit**——sync workflow 把整个 SDK 目录推到公仓，但你 docs 改动不会跟去；commit 语义也乱
- ❌ **在非 main 分支或脏工作区跑 skill**——precheck 会拦下来，硬绕过等于把 dev/feature 工作混进 release commit
- ❌ **手动 git tag 然后 push**——流水线自己会打 tag，手动 tag 会让 `auto-publish` 检测到 "tag exists" 跳过
- ❌ **跳过版本号文件 1**（podspec / build.gradle）只改文件 2（常量）——分发产物不会带新版本号，依赖方拉不到
- ❌ **同一个 PR 里 bump 多个 SDK 但 commit message 只写一个**——`paths` 过滤都会被触发但语义混乱，issue tracker 也理不清

### Commit message 格式样板

发版 commit 用 `<scope>: <subject>; bump A.B.C -> A.B.D` 格式。两个推荐样板：

```
fix(ios-sdk): podspec compat for RN/CocoaPods consumers; bump 1.1.0 -> 1.1.1
fix(rn-sdk-ios): forward APNs callbacks via ExpoAppDelegateSubscriber; bump 0.1.0 -> 0.1.1
```

scope 列表见 § 标准发版步骤。

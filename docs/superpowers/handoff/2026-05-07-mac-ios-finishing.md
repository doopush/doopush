# Mac 端续作提示词 — RN SDK v0.1.0 alpha 收尾

> 复制 `===PROMPT START===` 到 `===PROMPT END===` 之间的内容，粘贴给 Mac 上的 AI。

---

===PROMPT START===

完成 doopush React Native SDK v0.1.0 alpha 的 iOS 部分 + 发布同步。在 dev 分支工作，**不要用 git worktree**。严格 TDD：失败测试 → 跑测试期望失败 → 实现 → 跑测试期望通过 → commit。

## 真理来源

两份 plan 文件包含全部 verbatim 代码、命令、commit message。**直接 copy 不要改**：

- `docs/superpowers/plans/2026-05-06-native-sdk-v1.1.0.md`（"Part A — iOS" 章节，4 个 task）
- `docs/superpowers/plans/2026-05-06-rn-sdk-v0.1.0-alpha.md`（"Task 4: iOS Swift bridge module" 章节）

如果有 `superpowers:subagent-driven-development` 插件，invoke 它来执行 task。

## 状态校验

```bash
git log --oneline | head -1
```

应该是 `ff75824 docs(handoff): ...`。如果不是，先 `git pull origin dev`。

跳过的 P1 task：iOS Tasks 1-4（Swift code）。已完成的 task：Android Tasks 5-11、RN SDK Tasks 1-3、5-12。不要重做已完成的。

## 1. P1 iOS Tasks 1-4

按 plan "Part A — iOS" 顺序跑：
- Task 1: `NotificationManagementMode` enum + setter
- Task 2: `DooPushNotificationProxy` 加 KVO 重装（现有 proxy 已实现 forwarding，只缺 KVO）
- Task 3: `registerDevice(withToken:vendor:completion:)`（复用现有 `networking.registerDevice()`）
- Task 4: 版本号 1.0.0→1.1.0 + README CHANGELOG

测试：`cd sdk/ios/DooPushSDK && swift test`

## 2. P2 RN SDK iOS Swift Bridge

按 plan "Task 4: iOS Swift bridge module" 创建：
- `sdk/react-native/DooPushSDK/ios/DooPushReactNativeSDK.podspec`
- `sdk/react-native/DooPushSDK/ios/DooPushReactNativeSDKModule.swift`

commit: `feat(rn-sdk-ios): Expo Module bridge to DooPushSDK v1.1.0`

## 3. 撤销 Linux 端的 iOS-deferral 防守（不在 plan 里，必须做）

之前因 iOS 没做临时改了两处，现在撤回。

`sdk/react-native/DooPushSDK/expo-module.config.json` 改成：

```json
{
  "platforms": ["apple", "android"],
  "apple": { "modules": ["DooPushReactNativeSDKModule"] },
  "android": { "modules": ["com.doopush.reactnative.DooPushReactNativeSDKModule"] }
}
```

`sdk/react-native/DooPushSDK/README.md` 删除三处：
1. `🟡 iOS support: deferred to v0.1.1...` 整行
2. 整个 `## iOS support` 章节
3. `## Coexistence` 标题下的 `> **Note:** the iOS-specific behavior...` 引用块

commit: `feat(rn-sdk): re-enable iOS platform after Swift bridge lands`

## 4. e2e 验证

```bash
cd sdk/react-native/DooPushSDK
pnpm install && pnpm build && pnpm test    # 10 plugin tests 全绿
cd example
pnpm install
npx expo prebuild --clean                    # 同时生成 ios/ 和 android/
npx expo run:ios
npx expo run:android
```

`pod install` 找不到 `DooPushSDK` 时（iOS SDK 还没发到 SPM/CocoaPods），编辑 `example/ios/Podfile` 加：
```ruby
pod 'DooPushSDK', :path => '../../../../ios/DooPushSDK'
```
然后 `cd example/ios && pod install` 重跑。

`git push origin dev`

## 5. 发布同步

三个公仓库（`doopush-ios-sdk`、`doopush-android-sdk`、`doopush-react-native-sdk`）。前两个是已存在的，第三个可能需要先在 GitHub 建空仓库。

每个仓库的同步流程一样：rsync 内容 → commit → push → 等 `auto-build-release.yml`（在仓库内）自动出 release。

### iOS

```bash
cd <doopush-ios-sdk>
git checkout main && git pull
rsync -av --delete --exclude='.git' <monorepo>/sdk/ios/DooPushSDK/ ./
git add -A && git commit -m "sync v1.1.0 from monorepo" && git push origin main
```

监控 actions 等绿勾，结果 = GitHub Release `v1.1.0` + `DooPushSDK.framework.zip` + podspec。SPM 通过 git tag 立即可用。

### Android

```bash
cd <doopush-android-sdk>
git pull
rsync -av --delete --exclude='.git' <monorepo>/sdk/android/DooPushSDK/ ./
git add -A && git commit -m "sync v1.1.0 from monorepo" && git push origin main
```

等绿勾后**关键一步**：浏览器访问

```
https://jitpack.io/com/github/doopush/doopush-android-sdk/v1.1.0/doopush-android-sdk-v1.1.0.pom
```

触发 JitPack 拉 tag + 跑 `jitpack.yml`。等到 `https://jitpack.io/#doopush/doopush-android-sdk` v1.1.0 显示绿色 ✓。**没绿就别走** —— RN SDK Android dep 拉不到。

### RN SDK

```bash
cd <doopush-react-native-sdk>    # 仓库不存在就先 GitHub 建空仓库再 clone
rsync -av --delete \
  --exclude='.git' --exclude='node_modules' --exclude='build' \
  --exclude='plugin/build' --exclude='example/ios' --exclude='example/android' \
  --exclude='example/.expo' --exclude='example/google-services.json' \
  <monorepo>/sdk/react-native/DooPushSDK/ ./
git add -A && git commit -m "sync v0.1.0 alpha from monorepo"
git tag v0.1.0
git push origin main --tags
```

v0.1 alpha 不上 npm。早期用户安装：`npm install github:doopush/doopush-react-native-sdk#v0.1.0`

## 完成判定

- iOS SDK v1.1.0 在 GitHub Release
- Android SDK v1.1.0 在 GitHub Release
- JitPack v1.1.0 绿标
- `doopush-react-native-sdk` 有 `v0.1.0` tag
- monorepo dev 分支推到 origin

===PROMPT END===

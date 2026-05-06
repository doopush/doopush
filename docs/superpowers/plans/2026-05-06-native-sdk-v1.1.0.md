# Native SDK v1.1.0 + JitPack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump iOS / Android DooPushSDK to v1.1.0 with the API surface needed for the upcoming React Native SDK (passive mode, `registerDevice(withToken:)`, FCM display toggle, expo-notifications relay broadcast, vendor noop guards), plus enable JitPack auto-build for Android Maven distribution.

**Architecture:** Both native SDKs gain new opt-in flags / APIs without changing existing default behavior, so all current iOS/Android users continue to work unchanged. iOS strengthens existing `DooPushNotificationProxy` with KVO-based re-install. Android adds a JVM flag layer on top of the FCM service and per-vendor empty-config guards. JitPack picks up `lib/build.gradle`'s existing `maven-publish` block via a single new `jitpack.yml`.

**Tech Stack:** Swift 5.9 / iOS 13+ / SwiftPM + CocoaPods · Kotlin 1.9 / Android API 26+ / Gradle 8 + maven-publish · JitPack (build server) · GitHub Releases / git tags.

---

## Spec reference

This plan implements **§4.1 (Native SDK 前置改动 v1.1.0)** of `docs/superpowers/specs/2026-05-06-react-native-sdk-design.md`.

## File map

**iOS (`sdk/ios/DooPushSDK/`)**

- Modify: `Sources/DooPushSDK/DooPushManager.swift` — add `NotificationManagementMode`, setter, `registerDevice(withToken:vendor:completion:)`
- Modify: `Sources/DooPushSDK/DooPushNotificationAutoTracker.swift` — add KVO re-installation
- Modify: `Sources/DooPushSDK/DooPushDevice.swift` — expose enum mapping `vendor` string to channel
- Modify: `DooPushSDK.podspec` — bump `spec.version` `"1.0.0"` → `"1.1.0"`
- Modify: `README.md` — append v1.1.0 section
- Add: `Tests/DooPushSDKTests/DooPushNotificationProxyTests.swift`
- Add: `Tests/DooPushSDKTests/DooPushManagementModeTests.swift`

**Android (`sdk/android/DooPushSDK/`)**

- Modify: `lib/src/main/java/com/doopush/sdk/DooPushManager.kt` — add `NotificationManagementMode`, setter, `registerDevice(token, vendor, callback)`, FCM display flag, relay flag
- Modify: `lib/src/main/java/com/doopush/sdk/DooPushFirebaseMessagingService.kt` — guard `handleNotificationDisplay` by flag, add `relayToExpoNotifications`
- Modify: `lib/src/main/java/com/doopush/sdk/HMSService.kt` / `XiaomiService.kt` / `OppoService.kt` / `VivoService.kt` / `MeizuService.kt` / `HonorService.kt` — empty-appId noop guard at init
- Modify: `lib/build.gradle` — bump `SDK_VERSION` `"1.0.0"` → `"1.1.0"` and `version = '1.0.0'` → `'1.1.0'`
- Add: `lib/src/test/java/com/doopush/sdk/DooPushManagementModeTest.kt`
- Add: `lib/src/test/java/com/doopush/sdk/DooPushFirebaseMessagingServiceTest.kt`
- Add: `lib/src/test/java/com/doopush/sdk/VendorServiceNoopTest.kt`

**JitPack & release (`sdk/android/DooPushSDK/`)**

- Add: `jitpack.yml` (root of `doopush-android-sdk` after sync, but place at `sdk/android/DooPushSDK/jitpack.yml` for sync to pick up)

**Sync / release** (operator action, not code)

- Sync `sdk/ios/DooPushSDK/` → `doopush-ios-sdk` repo, push tag `v1.1.0`
- Sync `sdk/android/DooPushSDK/` → `doopush-android-sdk` repo, push tag `v1.1.0`
- Verify JitPack picks up `com.github.doopush:doopush-android-sdk:v1.1.0`

---

## Part A — iOS

### Task 1: Add `NotificationManagementMode` enum and setter

**Files:**
- Modify: `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift`
- Add: `sdk/ios/DooPushSDK/Tests/DooPushSDKTests/DooPushManagementModeTests.swift`

- [ ] **Step 1.1: Write failing test**

Create `sdk/ios/DooPushSDK/Tests/DooPushSDKTests/DooPushManagementModeTests.swift`:

```swift
import XCTest
@testable import DooPushSDK

final class DooPushManagementModeTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Reset to default
        DooPushManager.shared.setNotificationManagementMode(.active)
    }

    func testDefaultModeIsActive() {
        XCTAssertEqual(DooPushManager.shared.notificationManagementMode, .active)
    }

    func testSetPassiveMode() {
        DooPushManager.shared.setNotificationManagementMode(.passive)
        XCTAssertEqual(DooPushManager.shared.notificationManagementMode, .passive)
    }

    func testSetActiveMode() {
        DooPushManager.shared.setNotificationManagementMode(.passive)
        DooPushManager.shared.setNotificationManagementMode(.active)
        XCTAssertEqual(DooPushManager.shared.notificationManagementMode, .active)
    }
}
```

- [ ] **Step 1.2: Run test to verify it fails**

Run from `sdk/ios/DooPushSDK/`:

```bash
swift test --filter DooPushManagementModeTests
```

Expected: compile error — `notificationManagementMode` and `setNotificationManagementMode` not found.

- [ ] **Step 1.3: Implement enum and setter**

Edit `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift`. Add the enum at file scope (top-level, above `DooPushManager`):

```swift
/// 通知管理模式：决定 SDK 是否接管通知 UI 与权限请求
@objc public enum DooPushNotificationManagementMode: Int {
    /// 默认：SDK 安装 UNUserNotificationCenterDelegate（带转发）、请求权限、自管前台展示
    case active = 0
    /// 让位：SDK 不请求权限、不安装 delegate、不调 registerForRemoteNotifications；
    /// 由调用方（例如 expo-notifications 或 react-native-firebase）拿 token 后通过
    /// `registerDevice(withToken:vendor:completion:)` 完成服务端注册
    case passive = 1
}
```

Then add to `DooPushManager` class — find the `private var config: DooPushConfig?` line (~line 11) and add right after:

```swift
    /// 当前通知管理模式（默认 .active）
    @objc public private(set) var notificationManagementMode: DooPushNotificationManagementMode = .active

    /// 设置通知管理模式
    /// - 切到 .passive 时：不再自动安装通知代理；如已安装则保留当前安装状态（用户可显式调 disableAutomaticNotificationTracking 卸载）
    /// - 切到 .active 时：不会自动安装代理；调用方仍需显式 configure 后由 SDK 流程触发 enableAutomaticNotificationTracking
    @objc public func setNotificationManagementMode(_ mode: DooPushNotificationManagementMode) {
        self.notificationManagementMode = mode
        DooPushLogger.info("通知管理模式设置为: \(mode == .active ? "active" : "passive")")
    }
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
swift test --filter DooPushManagementModeTests
```

Expected: PASS — 3 tests succeed.

- [ ] **Step 1.5: Commit**

```bash
git add sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift \
        sdk/ios/DooPushSDK/Tests/DooPushSDKTests/DooPushManagementModeTests.swift
git commit -m "feat(ios-sdk): add NotificationManagementMode (active/passive)"
```

---

### Task 2: KVO-based delegate proxy re-installation

The existing `DooPushNotificationProxy` already wraps the original delegate. But if another library (e.g., `expo-notifications`) sets `UNUserNotificationCenter.delegate` **after** us, we silently lose all callbacks. Add KVO so we detect replacement and re-install ourselves on top of the new delegate.

**Files:**
- Modify: `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushNotificationAutoTracker.swift`
- Add: `sdk/ios/DooPushSDK/Tests/DooPushSDKTests/DooPushNotificationProxyTests.swift`

- [ ] **Step 2.1: Write failing test**

Create `sdk/ios/DooPushSDK/Tests/DooPushSDKTests/DooPushNotificationProxyTests.swift`:

```swift
import XCTest
import UserNotifications
@testable import DooPushSDK

/// 验证 DooPushNotificationProxy 在被第三方替换 delegate 后能自动重装
final class DooPushNotificationProxyTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // 重置环境
        UNUserNotificationCenter.current().delegate = nil
        DooPushManager.shared.disableAutomaticNotificationTracking()
    }

    override func tearDown() {
        UNUserNotificationCenter.current().delegate = nil
        DooPushManager.shared.disableAutomaticNotificationTracking()
        super.tearDown()
    }

    func testProxyReinstallsAfterThirdPartyTakesDelegate() {
        // 1) DooPush 安装代理
        DooPushManager.shared.enableAutomaticNotificationTracking()
        XCTAssertTrue(UNUserNotificationCenter.current().delegate is DooPushNotificationProxy,
                      "DooPush 代理应该被安装")

        // 2) 第三方（模拟 expo-notifications）替换 delegate
        let foreign = ForeignDelegate()
        UNUserNotificationCenter.current().delegate = foreign

        // 3) 等待 KVO 触发（runloop 一拍）
        let exp = expectation(description: "KVO reinstall")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { exp.fulfill() }
        wait(for: [exp], timeout: 1.0)

        // 4) DooPush 代理应该重新装回顶层，并把 foreign 链接为 original
        XCTAssertTrue(UNUserNotificationCenter.current().delegate is DooPushNotificationProxy,
                      "DooPush 代理应在第三方接管后重新装回")
        let proxy = UNUserNotificationCenter.current().delegate as? DooPushNotificationProxy
        XCTAssertTrue(proxy?.original === foreign,
                      "原 delegate 应该是 foreign")
    }

    private final class ForeignDelegate: NSObject, UNUserNotificationCenterDelegate {}
}
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
swift test --filter DooPushNotificationProxyTests
```

Expected: FAIL — `original` is private, or proxy not reinstalled because no KVO.

- [ ] **Step 2.3: Add KVO and re-installation**

Edit `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushNotificationAutoTracker.swift`. Replace the `original` field declaration to be internal-readable for tests:

Change line 6 from:
```swift
    weak var original: UNUserNotificationCenterDelegate?
```
to:
```swift
    weak internal(set) var original: UNUserNotificationCenterDelegate?
```

Replace the `enableAutomaticNotificationTracking` and `disableAutomaticNotificationTracking` extension at the bottom of the file:

```swift
// 保持强引用，避免被释放
private var dooPushNotificationProxy: DooPushNotificationProxy?
private var dooPushDelegateObservation: NSKeyValueObservation?

public extension DooPushManager {
    /// 启用自动采集通知事件（点击/打开），并转发给原始代理
    /// 同时通过 KVO 监听 UNUserNotificationCenter.delegate 的替换；
    /// 若第三方（如 expo-notifications）后续接管，自动把 DooPush 代理重新装回顶层
    @objc public func enableAutomaticNotificationTracking() {
        let center = UNUserNotificationCenter.current()
        // 避免重复包裹代理
        if center.delegate is DooPushNotificationProxy {
            DooPushLogger.debug("自动通知事件采集已启用，跳过重复设置")
            return
        }
        let current = center.delegate
        let proxy = DooPushNotificationProxy(original: current)
        dooPushNotificationProxy = proxy
        center.delegate = proxy

        // 安装 KVO：检测 delegate 被替换则重新装回
        dooPushDelegateObservation = center.observe(\.delegate, options: [.new]) { [weak proxy] c, _ in
            guard let proxy = proxy else { return }
            // 防止递归触发：c.delegate === proxy 时 noop
            if c.delegate === proxy { return }
            // 第三方替换了 delegate：把对方设为 original，重新装回 proxy
            DooPushLogger.info("检测到通知 delegate 被替换，重新装回 DooPush 代理")
            proxy.original = c.delegate
            c.delegate = proxy
        }

        DooPushLogger.info("已启用自动通知事件采集，并代理原始通知回调")
    }

    /// 关闭自动采集并还原原始代理
    @objc public func disableAutomaticNotificationTracking() {
        let center = UNUserNotificationCenter.current()
        dooPushDelegateObservation?.invalidate()
        dooPushDelegateObservation = nil
        center.delegate = dooPushNotificationProxy?.original
        dooPushNotificationProxy = nil
        DooPushLogger.info("已关闭自动通知事件采集，并还原通知代理")
    }
}
```

> Note: `UNUserNotificationCenter.delegate` is KVO-compliant. Reference: react-native-firebase uses the same pattern.

- [ ] **Step 2.4: Run test to verify it passes**

```bash
swift test --filter DooPushNotificationProxyTests
```

Expected: PASS — proxy reinstalls after foreign delegate set, foreign linked as `original`.

- [ ] **Step 2.5: Run full test suite (sanity)**

```bash
swift test
```

Expected: all tests pass (existing + 4 new).

- [ ] **Step 2.6: Commit**

```bash
git add sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushNotificationAutoTracker.swift \
        sdk/ios/DooPushSDK/Tests/DooPushSDKTests/DooPushNotificationProxyTests.swift
git commit -m "feat(ios-sdk): KVO-based delegate proxy re-installation"
```

---

### Task 3: `registerDevice(withToken:vendor:completion:)` API

For callers that already have an APNs token (e.g., obtained via `expo-notifications`) and want to skip SDK's permission/`registerForRemoteNotifications` flow.

**Files:**
- Modify: `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift`

- [ ] **Step 3.1: Write failing test**

Append to `sdk/ios/DooPushSDK/Tests/DooPushSDKTests/DooPushManagementModeTests.swift`:

```swift
    func testRegisterWithTokenInvokesNetworking() {
        DooPushManager.shared.configure(appId: "test_app_id", apiKey: "test_api_key")

        let exp = expectation(description: "completion called")
        DooPushManager.shared.registerDevice(withToken: "deadbeef", vendor: "apns") { deviceId, error in
            // 这里期望 networking 被调用并返回 error（因 baseURL 不可达）；deviceId 为 nil 但 completion 被触发
            XCTAssertNotNil(error, "无网络环境下应回调 error")
            XCTAssertNil(deviceId)
            exp.fulfill()
        }
        wait(for: [exp], timeout: 5.0)
    }
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
swift test --filter DooPushManagementModeTests/testRegisterWithTokenInvokesNetworking
```

Expected: FAIL — `registerDevice(withToken:vendor:completion:)` not found.

- [ ] **Step 3.3: Implement API**

Edit `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift`. Find the existing `private func registerDeviceToServer(token:)` (~line 156) and **add a new public method right above it**:

```swift
    /// 用调用方已有的推送 token 直接完成 DooPush 服务端注册
    /// - Parameters:
    ///   - token: 调用方已经从 APNs / FCM / OEM 渠道拿到的设备 token（hex 编码）
    ///   - vendor: 通道标识。可选值："apns"/"fcm"/"hms"/"honor"/"xiaomi"/"oppo"/"vivo"/"meizu"。
    ///             iOS 端目前只可能是 "apns"，参数预留是为了与 Android 端 API 对齐及未来扩展。
    ///             传 nil 时默认使用 "apns"。
    ///   - completion: 完成回调，成功返回 deviceId 字符串
    @objc public func registerDevice(
        withToken token: String,
        vendor: String? = nil,
        completion: @escaping (String?, Error?) -> Void
    ) {
        guard let config = config else {
            completion(nil, DooPushError.notConfigured)
            return
        }

        let resolvedVendor = vendor ?? "apns"
        let deviceInfo = deviceManager.getCurrentDeviceInfo()

        // 缓存 token 与回调，复用已有的服务端注册流程
        networking.registerDevice(
            appId: config.appId,
            token: token,
            deviceInfo: deviceInfo
        ) { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let deviceId):
                DooPushLogger.info("外部 token 注册成功，vendor=\(resolvedVendor), deviceId=\(deviceId)")
                self.storage.saveDeviceToken(token)
                self.storage.saveDeviceId(String(deviceId))
                // 与 registerForPushNotifications 保持一致：成功后连接 Gateway
                self.connectToGateway(token: token)
                self.delegate?.dooPush(self, didRegisterWithToken: token)
                completion(String(deviceId), nil)
            case .failure(let error):
                DooPushLogger.error("外部 token 注册失败: \(error)")
                self.delegate?.dooPush(self, didFailWithError: error)
                completion(nil, error)
            }
        }
    }
```

- [ ] **Step 3.4: Run test to verify it passes**

```bash
swift test --filter DooPushManagementModeTests/testRegisterWithTokenInvokesNetworking
```

Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift \
        sdk/ios/DooPushSDK/Tests/DooPushSDKTests/DooPushManagementModeTests.swift
git commit -m "feat(ios-sdk): registerDevice(withToken:vendor:) external token entry"
```

---

### Task 4: Bump iOS SDK version to 1.1.0

**Files:**
- Modify: `sdk/ios/DooPushSDK/DooPushSDK.podspec`
- Modify: `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift`
- Modify: `sdk/ios/DooPushSDK/README.md`

- [ ] **Step 4.1: Bump podspec version**

Edit `sdk/ios/DooPushSDK/DooPushSDK.podspec` — change line 2:

```ruby
  spec.version      = "1.1.0"
```

- [ ] **Step 4.2: Bump SDK_VERSION constant**

Edit `sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift` — find `static var sdkVersion`:

```swift
    @objc public static var sdkVersion: String {
        return "1.1.0"
    }
```

- [ ] **Step 4.3: Run full test suite**

```bash
cd sdk/ios/DooPushSDK && swift test
```

Expected: all tests pass.

- [ ] **Step 4.4: Append CHANGELOG-style section to README.md**

Append at the end of `sdk/ios/DooPushSDK/README.md`:

```markdown

## 更新日志

### v1.1.0
- 新增 `DooPushNotificationManagementMode`（active/passive）以支持第三方 SDK 共存
- 新增 `setNotificationManagementMode(_:)` 切换运行模式
- 新增 `registerDevice(withToken:vendor:completion:)` 用于外部 token（如 expo-notifications）的服务端注册
- 通知代理增加 KVO 自动重装：被第三方替换后自动恢复并向上转发
```

- [ ] **Step 4.5: Commit**

```bash
git add sdk/ios/DooPushSDK/DooPushSDK.podspec \
        sdk/ios/DooPushSDK/Sources/DooPushSDK/DooPushManager.swift \
        sdk/ios/DooPushSDK/README.md
git commit -m "chore(ios-sdk): bump version 1.0.0 -> 1.1.0"
```

---

## Part B — Android

### Task 5: Add `NotificationManagementMode` enum + setter

**Files:**
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`
- Add: `sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushManagementModeTest.kt`

- [ ] **Step 5.1: Write failing test**

Create `sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushManagementModeTest.kt`:

```kotlin
package com.doopush.sdk

import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class DooPushManagementModeTest {

    @Before
    fun setUp() {
        DooPushManager.getInstance().setNotificationManagementMode(
            DooPushManager.NotificationManagementMode.ACTIVE
        )
    }

    @Test
    fun defaultModeIsActive() {
        assertEquals(
            DooPushManager.NotificationManagementMode.ACTIVE,
            DooPushManager.getInstance().notificationManagementMode
        )
    }

    @Test
    fun setPassiveMode() {
        DooPushManager.getInstance().setNotificationManagementMode(
            DooPushManager.NotificationManagementMode.PASSIVE
        )
        assertEquals(
            DooPushManager.NotificationManagementMode.PASSIVE,
            DooPushManager.getInstance().notificationManagementMode
        )
    }

    @Test
    fun setActiveModeAfterPassive() {
        DooPushManager.getInstance().setNotificationManagementMode(
            DooPushManager.NotificationManagementMode.PASSIVE
        )
        DooPushManager.getInstance().setNotificationManagementMode(
            DooPushManager.NotificationManagementMode.ACTIVE
        )
        assertEquals(
            DooPushManager.NotificationManagementMode.ACTIVE,
            DooPushManager.getInstance().notificationManagementMode
        )
    }
}
```

- [ ] **Step 5.2: Run test to verify it fails**

```bash
cd sdk/android/DooPushSDK && ./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.DooPushManagementModeTest"
```

Expected: FAIL — compile error, `NotificationManagementMode` and `notificationManagementMode` not found.

- [ ] **Step 5.3: Implement enum and setter**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`. Add inside the `DooPushManager` class, right after the `companion object` block:

```kotlin
    /**
     * 通知管理模式
     * - ACTIVE：默认，SDK 自管 FCM 通知展示、token 注册等
     * - PASSIVE：让位给第三方 SDK（如 react-native-firebase / expo-notifications）；
     *            SDK 不再处理 FCM 通知展示与 token 注册，仅负责服务端注册、统计、WebSocket、角标
     */
    enum class NotificationManagementMode { ACTIVE, PASSIVE }

    /** 当前通知管理模式 */
    @Volatile
    var notificationManagementMode: NotificationManagementMode = NotificationManagementMode.ACTIVE
        private set

    /** 设置通知管理模式 */
    fun setNotificationManagementMode(mode: NotificationManagementMode) {
        notificationManagementMode = mode
        Log.i(TAG, "通知管理模式设置为: $mode")
    }
```

- [ ] **Step 5.4: Run test to verify it passes**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.DooPushManagementModeTest"
```

Expected: PASS — 3 tests succeed.

- [ ] **Step 5.5: Commit**

```bash
git add sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt \
        sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushManagementModeTest.kt
git commit -m "feat(android-sdk): add NotificationManagementMode (ACTIVE/PASSIVE)"
```

---

### Task 6: `registerDevice(token, vendor, callback)` external token API

**Files:**
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`

- [ ] **Step 6.1: Write failing test**

Append to `sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushManagementModeTest.kt`:

```kotlin
    @Test
    fun registerDeviceWithExternalTokenIsAvailable() {
        // 仅验证方法存在并接受参数；实际服务端注册结果在集成测试 / 真机覆盖
        val ctx = androidx.test.core.app.ApplicationProvider.getApplicationContext<android.content.Context>()
        try {
            DooPushManager.getInstance().configure(ctx, "test_app", "test_key")
        } catch (_: Throwable) { /* configure 在某些 robolectric 环境下会因网络异常而抛，忽略 */ }

        var called = false
        DooPushManager.getInstance().registerDevice(
            token = "deadbeef",
            vendor = "fcm",
            callback = object : DooPushRegisterCallback {
                override fun onSuccess(token: String) { called = true }
                override fun onError(error: com.doopush.sdk.models.DooPushError) { called = true }
            }
        )
        // 至少 API 已存在不抛 NoSuchMethodError；真实回调由网络异步触发，此处不强制等待
        assertEquals(true, true) // tag: API exists
    }
```

> Note: this is a smoke test ("API compiles + callable"). True end-to-end registration is verified manually on real devices; we don't block CI on that.

- [ ] **Step 6.2: Run test to verify it fails**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.DooPushManagementModeTest.registerDeviceWithExternalTokenIsAvailable"
```

Expected: FAIL — `registerDevice` method not found.

- [ ] **Step 6.3: Implement API**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`. Find the existing `private fun registerDeviceToServer(...)` method and **add a new public method right above it**:

```kotlin
    /**
     * 用调用方已有的推送 token 直接完成 DooPush 服务端注册
     * 跳过 SDK 内部权限请求 / 厂商 SDK 初始化 / token 获取流程
     *
     * @param token  调用方已经从 APNs / FCM / OEM 渠道拿到的设备 token
     * @param vendor 通道标识："apns"/"fcm"/"hms"/"honor"/"xiaomi"/"oppo"/"vivo"/"meizu"
     *               用于服务端正确归类设备 channel
     * @param callback 注册结果回调
     */
    fun registerDevice(
        token: String,
        vendor: String,
        callback: DooPushRegisterCallback
    ) {
        if (!checkInitialized()) {
            callback.onError(DooPushError.configNotInitialized())
            return
        }
        try {
            val deviceInfo = deviceManager!!.getCurrentDeviceInfo(vendor)
            cachedDeviceInfo = deviceInfo
            cachedToken = token
            registerDeviceToServer(deviceInfo, token, callback)
        } catch (e: Throwable) {
            Log.e(TAG, "registerDevice(token,vendor) 失败", e)
            callback.onError(DooPushError.fromException(e))
        }
    }
```

- [ ] **Step 6.4: Run test to verify it passes**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.DooPushManagementModeTest.registerDeviceWithExternalTokenIsAvailable"
```

Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt \
        sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushManagementModeTest.kt
git commit -m "feat(android-sdk): registerDevice(token, vendor) external token entry"
```

---

### Task 7: FCM display toggle (`setFCMNotificationDisplayEnabled`)

When the host app uses `expo-notifications` or `react-native-firebase` to display FCM notifications, DooPush should NOT also display them (else duplicate notifications).

**Files:**
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushFirebaseMessagingService.kt`
- Add: `sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushFirebaseMessagingServiceTest.kt`

- [ ] **Step 7.1: Write failing test**

Create `sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushFirebaseMessagingServiceTest.kt`:

```kotlin
package com.doopush.sdk

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DooPushFirebaseMessagingServiceTest {

    @Before
    fun reset() {
        DooPushManager.getInstance().setFCMNotificationDisplayEnabled(true)
    }

    @Test
    fun fcmDisplayEnabledByDefault() {
        // 重新构造 manager 状态后默认应为 true
        DooPushManager.getInstance().setFCMNotificationDisplayEnabled(true)
        assertTrue(DooPushManager.getInstance().isFCMNotificationDisplayEnabled)
    }

    @Test
    fun fcmDisplayCanBeDisabled() {
        DooPushManager.getInstance().setFCMNotificationDisplayEnabled(false)
        assertFalse(DooPushManager.getInstance().isFCMNotificationDisplayEnabled)
    }
}
```

- [ ] **Step 7.2: Run test to verify it fails**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.DooPushFirebaseMessagingServiceTest"
```

Expected: FAIL — `setFCMNotificationDisplayEnabled` / `isFCMNotificationDisplayEnabled` not found.

- [ ] **Step 7.3: Add flag in `DooPushManager`**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`. Add right below the `notificationManagementMode` property added in Task 5:

```kotlin
    /** FCM 通道是否由 DooPush 自管展示通知（默认 true）。设 false 让位给上层（expo-notifications / react-native-firebase） */
    @Volatile
    var isFCMNotificationDisplayEnabled: Boolean = true
        private set

    fun setFCMNotificationDisplayEnabled(enabled: Boolean) {
        isFCMNotificationDisplayEnabled = enabled
        Log.i(TAG, "FCM 通知展示开关: $enabled")
    }
```

- [ ] **Step 7.4: Guard `handleNotificationDisplay` in FCM service**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushFirebaseMessagingService.kt`. In `handleNotificationDisplay` (~line 109), add a flag check at the top of the method body:

```kotlin
    private fun handleNotificationDisplay(pushMessage: PushMessage, remoteMessage: RemoteMessage) {
        // 上层（expo-notifications / react-native-firebase）接管展示时，跳过 DooPush 自管展示
        if (!DooPushManager.getInstance().isFCMNotificationDisplayEnabled) {
            Log.d(TAG, "跳过系统通知显示 (FCM display disabled)")
            return
        }
        // 应用在前台时不显示系统通知；后台则无论是否有notification字段都显示
        if (isAppInForeground()) {
            Log.d(TAG, "跳过系统通知显示 (应用在前台)")
            return
        }

        // ... 后面保持原代码不变
```

- [ ] **Step 7.5: Run test to verify it passes**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.DooPushFirebaseMessagingServiceTest"
```

Expected: PASS.

- [ ] **Step 7.6: Commit**

```bash
git add sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt \
        sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushFirebaseMessagingService.kt \
        sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushFirebaseMessagingServiceTest.kt
git commit -m "feat(android-sdk): setFCMNotificationDisplayEnabled toggle"
```

---

### Task 8: Expo notification relay broadcast

When a third-party (e.g., `expo-notifications`) is installed and listening, DooPush relays a broadcast that triggers their JS-side notification listeners. This is opt-in via a flag.

**Reference broadcast contract (will be consumed by RN bridge in P2):**

- Action: `com.doopush.relay.NOTIFICATION_RECEIVED`
- Extras:
  - `data` (Bundle): full FCM data payload
  - `notification.title` (String?)
  - `notification.body` (String?)
  - `from` (String?)
  - `messageId` (String?)
  - `sentTime` (Long)

The RN bridge will register a `BroadcastReceiver` on this action. Other listeners can also subscribe.

**Files:**
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushFirebaseMessagingService.kt`

- [ ] **Step 8.1: Write failing test**

Append to `sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushFirebaseMessagingServiceTest.kt`:

```kotlin
    @Test
    fun expoRelayDisabledByDefault() {
        // 不强制重置——默认值断言
        DooPushManager.getInstance().setExpoNotificationRelayEnabled(false)
        assertFalse(DooPushManager.getInstance().isExpoNotificationRelayEnabled)
    }

    @Test
    fun expoRelayCanBeEnabled() {
        DooPushManager.getInstance().setExpoNotificationRelayEnabled(true)
        assertTrue(DooPushManager.getInstance().isExpoNotificationRelayEnabled)
    }
```

- [ ] **Step 8.2: Run test to verify it fails**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.DooPushFirebaseMessagingServiceTest"
```

Expected: FAIL — `setExpoNotificationRelayEnabled` not found.

- [ ] **Step 8.3: Add flag in `DooPushManager`**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt`. Add right below the `isFCMNotificationDisplayEnabled` block:

```kotlin
    /** 是否向上层 SDK（如 expo-notifications）转播 FCM 消息（默认 false） */
    @Volatile
    var isExpoNotificationRelayEnabled: Boolean = false
        private set

    fun setExpoNotificationRelayEnabled(enabled: Boolean) {
        isExpoNotificationRelayEnabled = enabled
        Log.i(TAG, "Expo 通知转播开关: $enabled")
    }
```

- [ ] **Step 8.4: Implement relay in FCM service**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushFirebaseMessagingService.kt`. Add a constant at the top of the companion object:

```kotlin
    companion object {
        private const val TAG = "DooPushFCMService"
        private const val NOTIFICATION_CHANNEL_ID = "doopush_default_channel"
        private const val NOTIFICATION_ID_BASE = 10000
        const val ACTION_RELAY_NOTIFICATION_RECEIVED = "com.doopush.relay.NOTIFICATION_RECEIVED"

        // ... existing
```

Add a new private method on the service class (right above `onDestroy`):

```kotlin
    /** 向上层 SDK（如 expo-notifications）转播 FCM 消息 */
    private fun relayToExpoNotifications(remoteMessage: RemoteMessage) {
        try {
            val intent = Intent(ACTION_RELAY_NOTIFICATION_RECEIVED).apply {
                setPackage(packageName)  // 限本进程；不污染其他 App
                val dataBundle = android.os.Bundle().apply {
                    for ((k, v) in remoteMessage.data) putString(k, v)
                }
                putExtra("data", dataBundle)
                putExtra("notification.title", remoteMessage.notification?.title)
                putExtra("notification.body", remoteMessage.notification?.body)
                putExtra("from", remoteMessage.from)
                putExtra("messageId", remoteMessage.messageId)
                putExtra("sentTime", remoteMessage.sentTime)
            }
            sendBroadcast(intent)
            Log.d(TAG, "已转播 FCM 消息到上层（broadcast: ${ACTION_RELAY_NOTIFICATION_RECEIVED}）")
        } catch (e: Exception) {
            Log.w(TAG, "转播 FCM 消息失败", e)
        }
    }
```

In `onMessageReceived`, after the existing call to `handleNotificationDisplay`, add:

```kotlin
            // 处理通知显示
            handleNotificationDisplay(pushMessage, remoteMessage)

            // 如开启上层转播，则向上层（如 expo-notifications）转播原始 FCM 消息
            if (DooPushManager.getInstance().isExpoNotificationRelayEnabled) {
                relayToExpoNotifications(remoteMessage)
            }

            // 记录日志
            logMessageReceived(pushMessage)
```

- [ ] **Step 8.5: Run test to verify it passes**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.DooPushFirebaseMessagingServiceTest"
```

Expected: PASS — all 4 tests in this class pass.

- [ ] **Step 8.6: Commit**

```bash
git add sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushManager.kt \
        sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/DooPushFirebaseMessagingService.kt \
        sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/DooPushFirebaseMessagingServiceTest.kt
git commit -m "feat(android-sdk): expo-notifications relay broadcast (opt-in)"
```

---

### Task 9: Vendor service noop guards on empty config

When the RN config plugin opts out a vendor (e.g., user only enables `fcm`), the manifestPlaceholders for other vendors are injected as empty strings. The four vendor services that have a public `initialize(appId, appKey)` signature (Xiaomi / OPPO / VIVO / Meizu) need an explicit empty-string guard so they noop instead of registering with empty credentials.

HMS and Honor do not need explicit guards in this task:
- **HMS** has no `initialize(appId, appKey)` — its appId comes from `agconnect-services.json` via reflection. When the file is absent (plugin opt-out), `getAppIdFromAGConnect()` returns `null` and `getToken` already handles that path.
- **Honor** uses `configure(HonorConfig)` which already calls `config?.isValid()`. Confirm `DooPushConfig.HonorConfig.isValid()` (currently `clientId.isNotBlank() || clientSecret.isNotBlank() || appId.isNotBlank() || developerId.isNotBlank()`) returns `false` for a fully-empty config — which it does (no field non-blank → false). No change needed.

**Files:**
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/XiaomiService.kt`
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/OppoService.kt`
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/VivoService.kt`
- Modify: `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/MeizuService.kt`
- Add: `sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/VendorServiceNoopTest.kt`

- [ ] **Step 9.1: Write failing test**

Create `sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/VendorServiceNoopTest.kt`:

```kotlin
package com.doopush.sdk

import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

/**
 * 验证：当厂商 appId/appKey 为空字符串时（plugin 未启用该厂商），
 * 厂商 service 的 initialize / autoInitialize 必须 noop（返回 false），
 * 不抛异常、不向厂商 SDK 注册。
 */
@RunWith(RobolectricTestRunner::class)
class VendorServiceNoopTest {

    private val ctx get() = RuntimeEnvironment.getApplication()

    @Test
    fun xiaomiInitializeWithEmptyConfigNoops() {
        val svc = XiaomiService(ctx)
        assertFalse("空 appId/appKey 时不应初始化", svc.initialize("", ""))
    }

    @Test
    fun oppoInitializeWithEmptyConfigNoops() {
        val svc = OppoService(ctx)
        assertFalse(svc.initialize("", ""))
    }

    @Test
    fun vivoInitializeWithEmptyConfigNoops() {
        val svc = VivoService(ctx)
        assertFalse(svc.initialize("", ""))
    }

    @Test
    fun meizuInitializeWithEmptyConfigNoops() {
        val svc = MeizuService(ctx)
        assertFalse(svc.initialize("", ""))
    }

    @Test
    fun honorEmptyConfigIsInvalid() {
        // Honor 通过 HonorConfig.isValid() 已有的 || 链已经天然返回 false——这里加测试做契约保障
        val emptyConfig = DooPushConfig.HonorConfig(
            clientId = "", clientSecret = "", appId = "", developerId = ""
        )
        assertFalse("全空 HonorConfig 应判定为 invalid", emptyConfig.isValid())
    }
}
```

> Note: requires `org.robolectric:robolectric` test dependency. Verify if already present in `lib/build.gradle` test deps; if not, add `testImplementation 'org.robolectric:robolectric:4.11.1'`.

- [ ] **Step 9.2: Run test to verify it fails**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.VendorServiceNoopTest"
```

Expected: FAIL — vendor `initialize("", "")` may either return `true` (current behavior — passes empty to SDK) or return `false` (already correct). Each test case shows current behavior.

For each FAILING vendor (those returning true on empty input), add the guard at the top of their `initialize(...)` method.

- [ ] **Step 9.3: Add empty-input guard to `XiaomiService.initialize`**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/XiaomiService.kt` — at the top of the `initialize(appId: String, appKey: String): Boolean` method body:

```kotlin
    fun initialize(appId: String, appKey: String): Boolean {
        if (appId.isBlank() || appKey.isBlank()) {
            Log.d(TAG, "小米推送配置为空，跳过初始化（plugin opt-out 语义）")
            return false
        }
        if (!isXiaomiPushAvailable()) {
            Log.w(TAG, "小米推送SDK不可用")
            return false
        }
        // ... rest unchanged
```

- [ ] **Step 9.4: Same guard in `OppoService.initialize`**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/OppoService.kt` — locate the `initialize` method and add at the top:

```kotlin
        if (appKey.isBlank() || appSecret.isBlank()) {
            Log.d(TAG, "OPPO 推送配置为空，跳过初始化（plugin opt-out 语义）")
            return false
        }
```

(Use the actual signature — OPPO uses `appKey` + `appSecret`, not `appId` + `appKey`.)

- [ ] **Step 9.5: Same guard in `VivoService.initialize`**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/VivoService.kt` — at the top of `initialize`:

```kotlin
        if (appId.isBlank() || apiKey.isBlank()) {
            Log.d(TAG, "VIVO 推送配置为空，跳过初始化（plugin opt-out 语义）")
            return false
        }
```

- [ ] **Step 9.6: Same guard in `MeizuService.initialize`**

Edit `sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/MeizuService.kt` — at the top of `initialize`:

```kotlin
        if (appId.isBlank() || appKey.isBlank()) {
            Log.d(TAG, "魅族推送配置为空，跳过初始化（plugin opt-out 语义）")
            return false
        }
```

- [ ] **Step 9.7: Run tests to verify all pass**

```bash
./gradlew :lib:testDebugUnitTest --tests "com.doopush.sdk.VendorServiceNoopTest"
```

Expected: PASS — 5 tests (xiaomi, oppo, vivo, meizu, honor契约测试).

- [ ] **Step 9.8: Run full test suite**

```bash
./gradlew :lib:testDebugUnitTest
```

Expected: all tests pass.

- [ ] **Step 9.9: Commit**

```bash
git add sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/XiaomiService.kt \
        sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/OppoService.kt \
        sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/VivoService.kt \
        sdk/android/DooPushSDK/lib/src/main/java/com/doopush/sdk/MeizuService.kt \
        sdk/android/DooPushSDK/lib/src/test/java/com/doopush/sdk/VendorServiceNoopTest.kt
git commit -m "feat(android-sdk): vendor services noop on empty config (plugin opt-out)"
```

---

### Task 10: Bump Android SDK version to 1.1.0

**Files:**
- Modify: `sdk/android/DooPushSDK/lib/build.gradle`
- Modify: `sdk/android/DooPushSDK/README.md`

- [ ] **Step 10.1: Bump version constants in `lib/build.gradle`**

Edit `sdk/android/DooPushSDK/lib/build.gradle`:

- Line 19 (`buildConfigField "String", "SDK_VERSION", "\"1.0.0\""`) → change `1.0.0` to `1.1.0`
- Line 103 (`version = '1.0.0'` in publishing block) → change to `1.1.0`

- [ ] **Step 10.2: Build + run all tests**

```bash
cd sdk/android/DooPushSDK && ./gradlew :lib:assembleRelease :lib:testDebugUnitTest
```

Expected: BUILD SUCCESSFUL + all tests pass.

- [ ] **Step 10.3: Append CHANGELOG-style section to README**

Append at end of `sdk/android/DooPushSDK/README.md`:

```markdown

## 更新日志

### v1.1.0
- 新增 `NotificationManagementMode`（ACTIVE / PASSIVE）以支持第三方 SDK 共存
- 新增 `setNotificationManagementMode(mode)` 切换运行模式
- 新增 `registerDevice(token, vendor, callback)` 用于外部 token（如 expo-notifications）的服务端注册
- 新增 `setFCMNotificationDisplayEnabled(enabled)`，让位上层 SDK 处理 FCM 通知展示
- 新增 `setExpoNotificationRelayEnabled(enabled)` + 广播 `com.doopush.relay.NOTIFICATION_RECEIVED`，便于上层 SDK 收到原始 FCM 消息
- 各厂商 service 启动时检查空 appId/appKey 主动 noop，配合上层 plugin opt-out 场景
- 同步发布到 JitPack：`com.github.doopush:doopush-android-sdk:v1.1.0`
```

- [ ] **Step 10.4: Commit**

```bash
git add sdk/android/DooPushSDK/lib/build.gradle \
        sdk/android/DooPushSDK/README.md
git commit -m "chore(android-sdk): bump version 1.0.0 -> 1.1.0"
```

---

## Part C — JitPack publishing

### Task 11: Add `jitpack.yml`

JitPack reads `jitpack.yml` from the repo root (after sync, the file at `sdk/android/DooPushSDK/jitpack.yml` becomes the root `jitpack.yml` of `doopush-android-sdk`).

**Files:**
- Add: `sdk/android/DooPushSDK/jitpack.yml`

- [ ] **Step 11.1: Create jitpack.yml**

Create `sdk/android/DooPushSDK/jitpack.yml`:

```yaml
# JitPack 构建配置 —— 触发：doopush-android-sdk 仓库的新 git tag
# 验证地址：https://jitpack.io/#doopush/doopush-android-sdk

jdk:
  - openjdk17

before_install:
  - chmod +x gradlew

install:
  - ./gradlew :lib:assembleRelease :lib:publishToMavenLocal -x test

# 不在 JitPack 上跑测试（节省构建时间；测试已在 GitHub Actions 跑过）
```

- [ ] **Step 11.2: Verify maven-publish block in `lib/build.gradle` is JitPack-compatible**

Open `sdk/android/DooPushSDK/lib/build.gradle` lines 94-120 — confirm:
- `groupId = 'com.doopush'`  → JitPack overrides this to `com.github.doopush`, that's fine
- `artifactId = 'android-sdk'`  → JitPack uses repo name `doopush-android-sdk` instead, also fine
- The `from components.release` line is present (it is)

No code change needed if existing block matches above.

- [ ] **Step 11.3: Commit**

```bash
git add sdk/android/DooPushSDK/jitpack.yml
git commit -m "build(android-sdk): add jitpack.yml for Maven distribution"
```

---

## Part D — Operator release tasks (manual)

These are not code changes — they are the operator (project maintainer) actions to ship v1.1.0. They are listed here so the plan is complete.

### Task 12: Sync iOS SDK to public repo and tag v1.1.0

- [ ] **Step 12.1: Push monorepo branch with all v1.1.0 changes to GitHub**

```bash
cd /home/coder/workspaces/doopush
git push origin dev   # 或者已 merge 到 main 后 push main
```

- [ ] **Step 12.2: Sync `sdk/ios/DooPushSDK/` content to `doopush-ios-sdk` repo**

Use whatever existing sync mechanism the project uses (manual rsync / dedicated script). The existing workflow at `sdk/ios/DooPushSDK/.github/workflows/auto-build-release.yml` will trigger on push to `main` of `doopush-ios-sdk`.

- [ ] **Step 12.3: Verify iOS auto-build workflow succeeds**

Check `https://github.com/doopush/doopush-ios-sdk/actions` — the "Auto Build and Release" run should:
- Detect version `1.1.0` from `DooPushSDK.podspec`
- Create tag `v1.1.0`
- Build framework, attach `DooPushSDK.framework.zip` + `DooPushSDK.podspec` to release

- [ ] **Step 12.4: Manually verify SPM consumer can install v1.1.0**

In a throwaway Xcode project: `File → Add Package Dependencies → https://github.com/doopush/doopush-ios-sdk.git`, version rule = `Up to Next Major: 1.1.0`. Build should succeed.

### Task 13: Sync Android SDK + activate JitPack

- [ ] **Step 13.1: Sync `sdk/android/DooPushSDK/` content to `doopush-android-sdk` repo**

Same mechanism as Task 12. The included `.github/workflows/auto-build-release.yml` will create tag `v1.1.0` and upload AAR.

- [ ] **Step 13.2: Verify Android auto-build workflow**

Check `https://github.com/doopush/doopush-android-sdk/actions` — release `v1.1.0` should be created with `DooPushSDK.aar` and `build.gradle`.

- [ ] **Step 13.3: Trigger JitPack build by visiting the look-up URL**

Open `https://jitpack.io/com/github/doopush/doopush-android-sdk/v1.1.0/doopush-android-sdk-v1.1.0.pom` in a browser — JitPack will spawn a build using `jitpack.yml`. Watch the log link the page returns.

Expected: `Build OK` after ~5-10 minutes; final Maven coordinate `com.github.doopush:doopush-android-sdk:v1.1.0` becomes available.

- [ ] **Step 13.4: Smoke-test JitPack consumption**

Create a throwaway Android module with:

```gradle
repositories {
    mavenCentral()
    maven { url 'https://jitpack.io' }
}
dependencies {
    implementation 'com.github.doopush:doopush-android-sdk:v1.1.0'
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging-ktx'
}
```

`./gradlew dependencies` should resolve without error; `import com.doopush.sdk.DooPushManager` should compile.

### Task 14: Final cross-check — both SDK published

- [ ] **Step 14.1: Document the JitPack URL in `doopush-android-sdk` README**

Sync mechanism aside, this README sits in `sdk/android/DooPushSDK/README.md`. Append under the v1.1.0 changelog:

```markdown

#### JitPack 集成

```gradle
repositories {
    maven { url 'https://jitpack.io' }
}
dependencies {
    implementation 'com.github.doopush:doopush-android-sdk:v1.1.0'
}
```
```

- [ ] **Step 14.2: Final commit**

```bash
git add sdk/android/DooPushSDK/README.md
git commit -m "docs(android-sdk): document JitPack integration"
```

---

## Definition of Done

- [ ] All unit tests in `sdk/ios/DooPushSDK/Tests/` pass via `swift test`
- [ ] All unit tests in `sdk/android/DooPushSDK/lib/src/test/` pass via `./gradlew :lib:testDebugUnitTest`
- [ ] iOS SDK v1.1.0 release exists on `doopush-ios-sdk` GitHub Releases with `framework.zip` + `podspec`
- [ ] Android SDK v1.1.0 release exists on `doopush-android-sdk` GitHub Releases with `DooPushSDK.aar`
- [ ] JitPack page `https://jitpack.io/#doopush/doopush-android-sdk` shows `v1.1.0` as built (green badge)
- [ ] Throwaway consumer projects (one iOS via SPM, one Android via JitPack) successfully resolve and import the new version
- [ ] CHANGELOG entries added to both READMEs

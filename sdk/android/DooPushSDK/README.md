# DooPushSDK for Android

[![Kotlin](https://img.shields.io/badge/Kotlin-1.9+-purple.svg)](https://kotlinlang.org)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0+-green.svg)](https://developer.android.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

简单易用的 Android 推送通知 SDK，支持 Google FCM 和华为 HMS Push，为移动应用提供统一的推送解决方案。

## 系统要求

- Android 8.0+ (API 26+)
- Kotlin 1.9+
- Android Gradle Plugin 8.0+

## 支持的推送服务

- ✅ **Google FCM** - Firebase Cloud Messaging
- ✅ **华为 HMS Push** - Huawei Mobile Services
- 🔄 SDK 自动检测设备类型并选择合适的推送服务

## 集成方式

### JitPack（推荐）

在项目根目录的 `build.gradle` 仓库列表里加 JitPack 与厂商仓库：

```kotlin
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://developer.huawei.com/repo/' } // 华为仓库
        maven { url 'https://developer.hihonor.com/repo' } // 荣耀仓库
        maven { url 'https://jitpack.io' }                  // JitPack
    }
}
```

在 app 模块的 `build.gradle` 中添加：

```kotlin
dependencies {
    // DooPush SDK
    implementation 'com.github.doopush:doopush-android-sdk:1.2.0'

    // 必需：FCM
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging-ktx'

    // 可选：厂商通道（按需）
    implementation 'com.huawei.hms:push'
    implementation 'com.hihonor.mcs:push'
    implementation 'com.umeng.umsdk:xiaomi-push'
    implementation 'com.umeng.umsdk:oppo-push'
    implementation 'com.umeng.umsdk:vivo-push'
    implementation 'com.umeng.umsdk:meizu-push'

    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
}
```

> 如果 Gradle 报 `Could not find com.github.doopush:doopush-android-sdk:X.Y.Z`，浏览器访问对应 pom URL 触发一次（JitPack 是 lazy build）。

### 手动 AAR / 源码集成

需要离线集成或修改源码的场景，参考[Android 集成指南](https://doopush.com/docs/sdk/android-integration.html)的"方式一"和"方式三"。

### 权限配置

在 `AndroidManifest.xml` 中添加必要权限：

```xml
<!-- 网络权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- 推送通知权限 -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- 角标权限 -->
<uses-permission android:name="com.huawei.android.launcher.permission.CHANGE_BADGE" />
<uses-permission android:name="com.oppo.launcher.permission.READ_SETTINGS" />
<uses-permission android:name="com.oppo.launcher.permission.WRITE_SETTINGS" />
```

## 快速开始

### 1. 配置 SDK

```kotlin
import com.doopush.sdk.DooPushManager
import com.doopush.sdk.models.DooPushCallback

class MyApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // 配置 DooPush SDK
        DooPushManager.getInstance().configure(
            context = this,
            appId = "your_app_id",
            apiKey = "your_api_key", 
            baseUrl = "https://your-server.com/api/v1" // 可选
        )
    }
}
```

### 2. 注册推送服务

```kotlin
class MainActivity : AppCompatActivity(), DooPushCallback {
    
    private val dooPushManager = DooPushManager.getInstance()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 设置回调监听器
        dooPushManager.setCallback(this)
        
        // 注册推送通知
        dooPushManager.registerForPushNotifications()
    }
    
    // 注册成功回调
    override fun onRegisterSuccess(token: String) {
        Log.d("DooPush", "推送注册成功: $token")
        // 处理注册成功逻辑
    }
    
    // 注册失败回调
    override fun onRegisterError(error: DooPushError) {
        Log.e("DooPush", "推送注册失败: ${error.message}")
    }
    
    // 接收推送消息
    override fun onMessageReceived(message: PushMessage) {
        Log.d("DooPush", "收到推送消息: ${message.title}")
        // 处理推送消息
    }
    
    // 通知点击回调
    override fun onNotificationClick(notificationData: DooPushNotificationHandler.NotificationData) {
        Log.d("DooPush", "用户点击了通知")
        // 处理通知点击
    }
}
```

## 高级功能

### 设备信息获取

```kotlin
// 获取推送 Token
val token = dooPushManager.getPushToken()

// 获取设备信息
val deviceInfo = dooPushManager.getDeviceInfo()

// 获取设备厂商信息
val vendorInfo = dooPushManager.getDeviceVendorInfo()
```

### 角标管理

```kotlin
// 设置角标数量
val success = dooPushManager.setBadgeCount(5)

// 清除角标
val success = dooPushManager.clearBadge()
```

### 推送服务状态

```kotlin
// 检查推送服务可用性
dooPushManager.checkServiceAvailability()

// 测试网络连接
dooPushManager.testConnection()
```

## 推送服务配置

### Google FCM 配置

1. 在 Firebase Console 创建项目
2. 下载 `google-services.json` 文件到 `app/` 目录
3. 在项目中添加 Firebase 插件：

```kotlin
// 项目级 build.gradle
plugins {
    id 'com.google.gms.google-services' version '4.3.15' apply false
}

// app 级 build.gradle
plugins {
    id 'com.google.gms.google-services'
}
```

### 华为 HMS Push 配置

1. 在华为开发者联盟创建应用
2. 下载 `agconnect-services.json` 文件到 `app/` 目录
3. 在项目中添加 AGConnect 插件：

```kotlin
// 项目级 build.gradle
plugins {
    id 'com.huawei.agconnect' version '1.9.1.301' apply false
}

// app 级 build.gradle
plugins {
    id 'com.huawei.agconnect'
}
```

## API 参考

### DooPushManager

#### 核心方法
- `configure(context, appId, apiKey, baseUrl?)` - 配置 SDK
- `setCallback(callback)` - 设置回调监听器
- `registerForPushNotifications(callback?)` - 走 SDK 内部 token 获取流程注册
- `registerDevice(token, vendor, callback)` - 用调用方已有 token 直接注册（共存模式，v1.1.0+）

#### 注册信息读取（v1.2.0+）
- `getDeviceToken() -> String?` - 当前推送 token（FCM/HMS/OEM）
- `getDeviceId() -> String?` - 服务端分配的 DooPush 设备 ID
- `getCurrentVendor() -> String?` - 当前注册通道（`fcm`/`hms`/`honor`/`xiaomi`/`oppo`/`vivo`/`meizu`）

#### 设备信息
- `getBestPushToken(callback)` - 获取最适合当前设备的推送 Token（异步）
- `getDeviceInfo() -> DeviceInfo?` - 获取设备信息
- `getDeviceVendorInfo() -> DooPushDeviceVendor.DeviceVendorInfo` - 设备厂商信息
- `getSupportedPushServices() -> List<...PushService>` - 当前设备支持的推送服务列表
- `updateDeviceInfo(callback?)` - 主动把设备信息上报到服务端（v1.2.0+）

#### 角标管理
- `setBadgeCount(count: Int) -> Boolean` - 设置应用角标数量
- `clearBadge() -> Boolean` - 清除应用角标
- `getBadgeCount() -> Int` - 读取最近一次设置成功的角标值（v1.2.0+）

#### 共存控制（v1.1.0+）
- `setNotificationManagementMode(mode)` - ACTIVE / PASSIVE 模式标记
- `setFCMNotificationDisplayEnabled(enabled)` - 是否由 DooPush 自管展示 FCM 通知
- `setExpoNotificationRelayEnabled(enabled)` - 启用 FCM 消息 relay 广播

#### 工具方法
- `isFirebaseAvailable()` / `isHMSAvailable()` / `isXiaomiAvailable()` / `isOppoAvailable()` / `isVivoAvailable()` / `isMeizuAvailable()` - 检查各推送服务可用性
- `testNetworkConnection(callback)` - 测试网络连接
- `reportStatistics()` - 立即上报排队中的统计事件（v1.2.0+）
- `clearCache()` - 清除内存缓存与持久化注册信息（v1.2.0+）
- `release()` - 释放运行时资源（不清除持久化注册信息）

### DooPushCallback

#### 必需方法
- `onRegisterSuccess(token: String)` - 推送注册成功（旧签名，兼容保留）
- `onRegisterSuccess(result: DooPushRegisterResult)` - v1.2.0+：含服务端 `deviceId` 与 `vendor`
- `onRegisterError(error: DooPushError)` - 推送注册失败
- `onMessageReceived(message: PushMessage)` - 接收推送消息

#### 可选方法
- `onTokenReceived(token: String)` / `onTokenError(error)` - FCM Token 状态
- `onNotificationClick(notificationData)` - 通知点击事件
- `onNotificationOpen(notificationData)` - 通知打开事件
- `onWebSocketOpen()` / `onWebSocketClosed(code, reason)` / `onWebSocketFailure(t)` - WebSocket 长连接状态

## 常见问题

### Q: 华为设备无法接收推送？
A: 请确保已添加 HMS Push 依赖和 `agconnect-services.json` 配置文件，并在华为开发者后台启用推送服务。

### Q: 角标不显示？
A: 请确保已添加角标权限，并在设备设置中开启应用角标功能。部分第三方桌面可能不支持角标。

### Q: 如何调试推送问题？
A: SDK 提供了详细的日志输出，使用 `adb logcat -s DooPushManager` 查看相关日志。

## 开发工具

```bash
# 编译项目
./gradlew build

# 运行测试
./gradlew test

# 生成文档
./gradlew dokkaHtml
```

## 技术支持

如有问题请提交 Issue 或联系技术支持团队。

## 更新日志

### v1.2.1
- **Fix**：WebSocket Gateway 增加前台守卫（foreground guard），仅在应用处于前台时维持网关连接，避免进入后台后无谓的重连尝试。
- `BuildConfig.SDK_VERSION` / `DooPushDevice.SDK_VERSION` → `1.2.1`。

### v1.2.0
- 注册回调新增 `onRegisterSuccess(result: DooPushRegisterResult)`，一次拿到 `token` / 服务端 `deviceId` / `vendor`；旧 `onRegisterSuccess(token)` 默认委托给新签名，源码兼容。
- 新增持久化（SharedPreferences）：`getDeviceToken()` / `getDeviceId()` / `getCurrentVendor()`，冷启后仍可读。
- 新增 `updateDeviceInfo(callback)` 主动把当前设备信息上报到服务端。
- 新增 `getBadgeCount()` 读取最近一次设置成功的角标值。
- `clearCache()` 现在同时清除内存缓存与持久化注册信息。
- `BuildConfig.SDK_VERSION` / `DooPushDevice.SDK_VERSION` → `1.2.0`，与 iOS SDK / React Native SDK v0.5.0 对齐。

### v1.1.1
- **chore**：发版流水线连通性测试（无功能变更）。验证 monorepo `sync-android-sdk.yml` → `doopush-android-sdk` 公仓 → `auto-build-release.yml` → GitHub Release 全链路；JitPack 需手动访问 pom URL 触发构建。

### v1.1.0
- 新增 `NotificationManagementMode`（ACTIVE / PASSIVE）以支持第三方 SDK 共存
- 新增 `setNotificationManagementMode(mode)` 切换运行模式
- 新增 `registerDevice(token, vendor, callback)` 用于外部 token（如 expo-notifications）的服务端注册
- 新增 `setFCMNotificationDisplayEnabled(enabled)`，让位上层 SDK 处理 FCM 通知展示
- 新增 `setExpoNotificationRelayEnabled(enabled)` + 广播 `com.doopush.relay.NOTIFICATION_RECEIVED`，便于上层 SDK 收到原始 FCM 消息
- 各厂商 service 启动时检查空 appId/appKey 主动 noop，配合上层 plugin opt-out 场景
- 同步发布到 JitPack：`com.github.doopush:doopush-android-sdk:v1.1.0`

#### Relay Broadcast 协议

当 `setExpoNotificationRelayEnabled(true)` 启用后，DooPush 会在 FCM 收到推送时发送一条**同包**广播，便于上层 SDK（如 expo-notifications）或自定义 BroadcastReceiver 拦截原始消息。

**Action：** `com.doopush.relay.NOTIFICATION_RECEIVED`
（也可通过 `DooPushFirebaseMessagingService.ACTION_RELAY_NOTIFICATION_RECEIVED` 引用）

**Extras（一律使用 `DooPushFirebaseMessagingService.EXTRA_*` 常量）：**

| Key | 类型 | 说明 |
|---|---|---|
| `EXTRA_DATA` | `Bundle` | FCM data payload，键值对全为 `String` |
| `EXTRA_NOTIFICATION_TITLE` | `String?` | FCM notification.title |
| `EXTRA_NOTIFICATION_BODY` | `String?` | FCM notification.body |
| `EXTRA_FROM` | `String?` | FCM from 字段 |
| `EXTRA_MESSAGE_ID` | `String?` | FCM messageId |
| `EXTRA_SENT_TIME` | `Long` | FCM sentTime |

**接收者注册示例：**

```kotlin
val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val data = intent.getBundleExtra(DooPushFirebaseMessagingService.EXTRA_DATA)
        val title = intent.getStringExtra(DooPushFirebaseMessagingService.EXTRA_NOTIFICATION_TITLE)
        // ...
    }
}
val filter = IntentFilter(DooPushFirebaseMessagingService.ACTION_RELAY_NOTIFICATION_RECEIVED)
context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
```

> **同包限定**：DooPush 通过 `intent.setPackage(packageName)` 限定接收范围，仅本应用 UID 注册的 BroadcastReceiver 可以收到。其他 App 不会收到此广播，无需 `<permission>` 声明。

# DooPushSDK for Android

[![Kotlin](https://img.shields.io/badge/Kotlin-1.9+-purple.svg)](https://kotlinlang.org)
[![Platform](https://img.shields.io/badge/Platform-Android%2021+-green.svg)](https://developer.android.com)
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

### Gradle 集成 (推荐)

在项目根目录的 `build.gradle` 中添加：

```kotlin
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://developer.huawei.com/repo/' } // 华为仓库
    }
}
```

在 app 模块的 `build.gradle` 中添加：

```kotlin
dependencies {
    implementation project(':doopush-sdk')
    
    // FCM 支持
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    
    // 华为 HMS Push 支持
    implementation 'com.huawei.hms:push:6.11.0.300'
}
```

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
- `registerForPushNotifications()` - 注册推送通知
- `setCallback(callback)` - 设置回调监听器

#### 设备信息
- `getBestPushToken(callback: DooPushTokenCallback)` - 获取最适合当前设备的推送 Token（异步）
- `getDeviceInfo() -> DeviceInfo?` - 获取设备信息
- `getDeviceVendorInfo() -> DooPushDeviceVendor.DeviceVendorInfo` - 获取设备厂商信息
- `getSupportedPushServices() -> List<DooPushDeviceVendor.PushService>` - 获取当前设备支持的推送服务列表

#### 角标管理
- `setBadgeCount(count: Int) -> Boolean` - 设置应用角标数量
- `clearBadge() -> Boolean` - 清除应用角标

#### 工具方法
- `isFirebaseAvailable() / isHMSAvailable() / isXiaomiAvailable() / isOppoAvailable() / isVivoAvailable() / isMeizuAvailable()` - 检查各推送服务可用性
- `testNetworkConnection(callback: (Boolean) -> Unit)` - 测试网络连接
- `clearCache()` - 清除缓存数据

### DooPushCallback

#### 必需方法
- `onRegisterSuccess(token: String)` - 推送注册成功
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

### v1.1.1
- **chore**：发版流水线连通性测试（无功能变更）。验证 monorepo `sync-android-sdk.yml` → `doopush-android-sdk` 公仓 → `auto-build-release.yml` → GitHub Release 全链路；JitPack 需手动访问 pom URL 触发构建。

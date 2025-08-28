# DooPushSDK for Android

[![Android](https://img.shields.io/badge/Android-API%2021+-green.svg)](https://developer.android.com/about/versions/android-5.0)
[![Kotlin](https://img.shields.io/badge/Kotlin-1.8+-blue.svg)](https://kotlinlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

简单易用的 Android 推送通知 SDK，为移动应用提供统一的推送解决方案，支持多厂商推送服务。

## 系统要求

- Android API 21+ (Android 5.0+)
- Kotlin 1.8+
- Gradle 7.0+

## 支持的推送厂商

- ✅ **小米推送** - 已实现
- 🚧 **华为推送** - 预留接口
- 🚧 **OPPO推送** - 预留接口
- 🚧 **VIVO推送** - 预留接口
- 🚧 **魅族推送** - 预留接口
- 🚧 **FCM推送** - 预留接口

## 集成方式

### 1. 添加依赖

在项目的 `build.gradle` 文件中添加：

```gradle
dependencies {
    implementation project(':DooPushSDK')
    // 或者使用 AAR 文件
    // implementation files('libs/DooPushSDK-1.0.0.aar')
}
```

### 2. 配置权限

在 `AndroidManifest.xml` 中添加必要权限（SDK已自动包含）：

```xml
<!-- 网络权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

<!-- 设备信息权限 -->
<uses-permission android:name="android.permission.READ_PHONE_STATE" />

<!-- 小米推送权限 -->
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

### 3. 配置推送厂商参数

在 `AndroidManifest.xml` 的 `<application>` 标签中添加：

```xml
<application>
    <!-- 渠道信息 -->
    <meta-data
        android:name="CHANNEL"
        android:value="your_channel_name" />
    
    <!-- 小米推送配置 -->
    <meta-data
        android:name="XIAOMI_APP_ID"
        android:value="your_xiaomi_app_id" />
    <meta-data
        android:name="XIAOMI_APP_KEY"
        android:value="your_xiaomi_app_key" />
</application>
```

## 快速开始

### 1. 初始化 SDK

在 `Application` 类中初始化：

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // 配置 DooPushSDK
        val config = DooPushConfig.development(
            appId = "your_app_id",
            apiKey = "your_api_key",
            baseURL = "http://localhost:5002/api/v1" // 可选，用于本地开发
        )
        
        // 初始化 SDK
        DooPushManager.instance.initialize(this, config)
        
        // 添加事件监听器
        DooPushManager.instance.addListener(object : DooPushListener {
            override fun onDeviceRegistered(deviceToken: String) {
                Log.i("DooPush", "设备注册成功: $deviceToken")
            }
            
            override fun onMessageReceived(message: DooPushMessage) {
                Log.i("DooPush", "收到推送消息: ${message.title}")
                // 处理推送消息
            }
            
            override fun onError(error: DooPushError) {
                Log.e("DooPush", "DooPush 错误: ${error.message}")
            }
        })
    }
}
```

### 2. 注册推送通知

在主 Activity 中注册推送：

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // 注册推送通知
        DooPushManager.instance.registerForPushNotifications { deviceToken, error ->
            if (deviceToken != null) {
                Log.i("DooPush", "推送注册成功: $deviceToken")
            } else {
                Log.e("DooPush", "推送注册失败: ${error?.message}")
            }
        }
    }
}
```

### 3. 处理推送消息

推送消息会自动通过 `DooPushListener.onMessageReceived()` 回调处理。

## 高级功能

### 设备管理

```kotlin
// 手动更新设备信息
DooPushManager.instance.updateDeviceInfo()

// 获取设备 token
val deviceToken = DooPushManager.instance.getDeviceToken()

// 获取设备 ID
val deviceId = DooPushManager.instance.getDeviceId()
```

### TCP 连接管理

```kotlin
// 获取 TCP 连接状态
val tcpState = DooPushManager.instance.getTCPConnectionState()

// 手动连接 TCP
DooPushManager.instance.connectTCP()

// 手动断开 TCP
DooPushManager.instance.disconnectTCP()
```

### 推送厂商管理

```kotlin
// 监听推送厂商事件
DooPushManager.instance.addListener(object : DooPushListener {
    override fun onVendorInitialized(vendor: String) {
        Log.i("DooPush", "推送厂商初始化成功: $vendor")
    }
    
    override fun onVendorInitializationFailed(vendor: String, error: DooPushError) {
        Log.e("DooPush", "推送厂商初始化失败: $vendor - ${error.message}")
    }
    
    // 其他回调方法...
})
```

### 日志配置

```kotlin
// 启用开发模式日志
DooPushLogger.enableDevelopmentMode()

// 启用生产模式日志
DooPushLogger.enableProductionMode()

// 设置自定义日志监听器
DooPushLogger.setCustomLogListener { level, tag, message ->
    // 自定义日志处理
}
```

## 配置选项

### DooPushConfig

```kotlin
// 开发环境配置
val devConfig = DooPushConfig.development(
    appId = "your_app_id",
    apiKey = "your_api_key",
    baseURL = "http://localhost:5002/api/v1"
)

// 生产环境配置
val prodConfig = DooPushConfig.production(
    appId = "your_app_id",
    apiKey = "your_api_key",
    baseURL = "https://doopush.com/api/v1"
)

// 自定义配置
val customConfig = DooPushConfig(
    appId = "your_app_id",
    apiKey = "your_api_key",
    baseURL = "https://your-server.com/api/v1",
    environment = DooPushEnvironment.CUSTOM,
    debugEnabled = true
)
```

## 推送消息格式

### DooPushMessage

```kotlin
data class DooPushMessage(
    val messageId: String,           // 消息ID
    val title: String?,              // 标题
    val content: String?,            // 内容
    val payload: Map<String, Any>?,  // 自定义数据
    val vendor: String,              // 推送厂商
    val messageType: DooPushMessageType, // 消息类型
    val badge: Int?,                 // 角标数量
    val sound: String?,              // 声音
    val icon: String?,               // 图标
    val bigPicture: String?,         // 大图URL
    val clickAction: String?,        // 点击动作
    val channelId: String?,          // 通知渠道ID
    val receivedAt: Date,            // 接收时间
    val rawData: Map<String, Any>?   // 原始数据
)
```

### 消息类型

```kotlin
enum class DooPushMessageType {
    NOTIFICATION,    // 通知消息（显示在通知栏）
    PASS_THROUGH,    // 透传消息（不显示通知）
    HYBRID           // 混合消息（既显示通知又传递给应用）
}
```

## 错误处理

### DooPushError

SDK 定义了详细的错误类型：

```kotlin
// 配置相关错误
DooPushError.NotConfigured
DooPushError.InvalidConfiguration

// 权限相关错误
DooPushError.PushPermissionDenied
DooPushError.PushNotificationNotSupported

// 网络相关错误
DooPushError.NetworkError
DooPushError.ServerError
DooPushError.Unauthorized

// 设备相关错误
DooPushError.DeviceRegistrationFailed
DooPushError.DeviceTokenInvalid

// 推送厂商相关错误
DooPushError.VendorNotSupported
DooPushError.VendorInitializationFailed

// TCP连接相关错误
DooPushError.TCPConnectionFailed
DooPushError.TCPRegistrationFailed
```

### 错误处理工具

```kotlin
// 获取用户友好的错误消息
val friendlyMessage = DooPushErrorHandler.getUserFriendlyMessage(error)

// 检查错误是否可以重试
val canRetry = DooPushErrorHandler.isRetryable(error)

// 获取建议的重试延时
val retryDelay = DooPushErrorHandler.getRetryDelay(error)
```

## 调试和诊断

### 日志查看

```kotlin
// 获取日志历史
val logHistory = DooPushLogger.getLogHistory()

// 搜索日志
val searchResults = DooPushLogger.searchLogs("error")

// 导出日志
val logString = DooPushLogger.exportLogsAsString()

// 获取日志统计
val logStats = DooPushLogger.getLogStats()
```

### 设备信息查看

```kotlin
// 获取完整设备信息（调试用）
val deviceInfo = deviceInfoManager.getFullDeviceInfo()

// 获取推送厂商信息
val vendorInfo = vendorManager.getAllVendorInfo()

// 获取存储统计
val storageStats = storage.getStorageStats()
```

## 混淆配置

SDK 已包含必要的混淆规则，会自动应用到您的应用中。如需自定义，请参考 `consumer-rules.pro` 文件。

## 常见问题

### Q: 如何添加新的推送厂商支持？

A: 继承 `PushVendor` 抽象类并实现相关方法，然后在 `PushVendorManager` 中注册。

### Q: 推送消息没有收到怎么办？

1. 检查设备是否成功注册：`DooPushManager.instance.getDeviceToken()`
2. 检查推送权限是否授予
3. 查看日志输出：`DooPushLogger.exportLogsAsString()`
4. 确认推送厂商是否正确初始化

### Q: 如何自定义推送通知样式？

推送通知的显示由各厂商的推送服务控制，可以通过推送消息的 `payload` 传递自定义参数。

### Q: TCP连接断开怎么办？

SDK 会自动重连，您可以通过 `DooPushListener.onTCPConnectionStateChanged()` 监听连接状态变化。

## 示例项目

完整的示例项目请参考 `DooPushSDKExample` 目录。

## 技术支持

如有问题，请提交 Issue 或联系技术支持。

## 更新日志

### v1.0.0
- 初始版本发布
- 支持小米推送
- 实现TCP长连接
- 完整的错误处理和日志系统
- 可扩展的推送厂商架构

## 许可证

MIT License
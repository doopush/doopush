# Android SDK 集成指南

DooPush Android SDK 为 Android 应用提供统一的推送通知解决方案，支持多个主流厂商推送服务的智能路由和管理。

## 🚀 功能特性

### 📱 多厂商推送支持
- ✅ **Google FCM** - Firebase Cloud Messaging，海外和国内通用
- ✅ **华为 HMS Push** - Huawei Mobile Services，华为设备专用
- ✅ **荣耀推送** - Honor Push Service，荣耀设备专用
- ✅ **小米推送** - 小米设备专用通道，MIUI深度优化
- ✅ **OPPO推送** - OPPO/OnePlus设备专用，ColorOS优化
- ✅ **VIVO推送** - VIVO/iQOO设备专用，Origin OS优化
- ✅ **魅族推送** - 魅族设备专用，Flyme OS优化

### 🧠 智能推送路由
- **自动厂商识别** - 根据设备品牌自动选择最优推送通道
- **Fallback机制** - 厂商服务不可用时自动降级到FCM
- **零配置启动** - 支持从配置文件自动读取推送参数

### 🔧 核心功能
- ✅ **设备注册** - 自动注册设备到 DooPush 平台
- ✅ **推送接收** - 统一的推送消息接收和处理
- ✅ **权限管理** - 智能处理推送权限申请
- ✅ **角标管理** - 支持应用图标角标设置和清除
- ✅ **统计事件去重** - SDK 上报点击 / 打开统计时按 `(push_log_id 或 dedup_key, event_type)` 去重，避免同一事件多次入库
- ✅ **统计上报** - 自动统计推送送达和点击数据

### 📊 高级特性
- ✅ **WebSocket 长连接** - 基于 OkHttp WebSocket 的 Gateway 长连接，当前用于实时维护设备「在线」状态（server→client 推送暂未实现）
- ✅ **设备信息** - 详细的设备厂商和能力检测
- ✅ **网络检测** - 推送服务可用性检测
- ✅ **生命周期** - 应用前后台状态感知

## 📋 系统要求

- **Android版本**: 8.0+ (API Level 26)
- **开发语言**: Kotlin 1.9+ / Java 8+
- **构建工具**: Android Gradle Plugin 8.0+
- **依赖管理**: Gradle

## 🛠 快速集成

### 1. 添加依赖

在项目根目录的 `build.gradle` 中添加仓库：

```kotlin
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://developer.huawei.com/repo/' } // 华为仓库
        maven { url 'https://developer.hihonor.com/repo' } // 荣耀仓库
    }
}
```

#### 方式一：JitPack（推荐）

无需手动下载 AAR，Gradle 直接从 JitPack 拉取已发布版本，自动管理版本与更新。

在项目根目录的 `build.gradle` 仓库列表里加 JitPack：

```kotlin
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://developer.huawei.com/repo/' }
        maven { url 'https://developer.hihonor.com/repo' }
        maven { url 'https://jitpack.io' } // JitPack 仓库
    }
}
```

在 app 模块的 `build.gradle` 加依赖（版本号请对照 [Releases 页](https://github.com/doopush/doopush-android-sdk/releases)）：

```kotlin
dependencies {
    // DooPush SDK - JitPack
    implementation 'com.github.doopush:doopush-android-sdk:1.2.0'

    // 必需：Firebase Cloud Messaging
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging-ktx'

    // 可选：华为 HMS Push （华为设备）
    implementation 'com.huawei.hms:push'

    // 可选：荣耀推送 （荣耀设备）
    implementation 'com.hihonor.mcs:push'

    // 可选：小米推送 （小米设备）
    implementation 'com.umeng.umsdk:xiaomi-push'

    // 可选：OPPO推送 （OPPO设备）
    implementation 'com.umeng.umsdk:oppo-push'

    // 可选：VIVO推送 （VIVO设备）
    implementation 'com.umeng.umsdk:vivo-push'

    // 可选：魅族推送 （魅族设备）
    implementation 'com.umeng.umsdk:meizu-push'

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
}
```

> 如果 Gradle 报 `Could not find com.github.doopush:doopush-android-sdk:X.Y.Z`，浏览器访问对应 pom URL 触发一次（JitPack 是 lazy build）。

#### 方式二：手动下载发布的 AAR 包

适合内网/离线等无法访问 JitPack 的环境。

1. 访问 [DooPush Android SDK Releases](https://github.com/doopush/doopush-android-sdk/releases)
2. 下载最新版本的 `DooPushSDK.aar` 文件
3. 将AAR文件放置到你的应用模块的 `libs` 目录下（如：`app/libs/`）
4. 在 app 模块的 `build.gradle` 中添加：

```kotlin
dependencies {
    // DooPush SDK - 使用本地AAR文件
    implementation files('libs/DooPushSDK.aar')

    // Firebase / 各厂商推送依赖同方式一（JitPack）
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging-ktx'
    // …其余厂商推送依赖同方式一
}
```

> 手动 AAR 方式需自行下载并替换文件来升级，无自动版本管理，仅作兜底。

#### 方式三：源码集成（开发调试）

如果你需要修改SDK源码或进行深度定制，可以直接集成源码：

1. 将 DooPush SDK 源码添加到你的项目中
2. 在 `settings.gradle` 中添加模块引用：

```kotlin
include ':lib'
project(':lib').projectDir = new File('path/to/doopush-sdk/lib')
```

3. 在 app 模块的 `build.gradle` 中添加：

```kotlin
dependencies {
    // DooPush SDK - 源码模块
    implementation project(':lib')
    
    // 其他依赖同上...
}
```

### 2. 权限配置

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
<uses-permission android:name="com.vivo.notification.permission.BADGE_ICON" />
<uses-permission android:name="com.meizu.flyme.permission.PUSH" />

<!-- 自启动权限（部分厂商需要） -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### 3. 推送服务配置

#### Google FCM 配置

1. 在 [Firebase Console](https://console.firebase.google.com) 创建项目
2. 下载 `google-services.json` 文件到 `app/` 目录
3. 在项目中添加 Google Services 插件：

```kotlin
// 项目级 build.gradle
plugins {
    id 'com.google.gms.google-services' version '4.4.0' apply false
}

// app 级 build.gradle
plugins {
    id 'com.google.gms.google-services'
}
```

#### 华为 HMS Push 配置

1. 在 [华为开发者联盟](https://developer.huawei.com) 创建应用
2. 下载 `agconnect-services.json` 文件到 `app/` 目录
3. 在项目中添加 AGConnect 插件：

```kotlin
// 项目级 build.gradle
dependencies {
    classpath 'com.huawei.agconnect:agcp:1.9.3.302'
}

// app 级 build.gradle
plugins {
    id 'com.huawei.agconnect'
}
```

#### 荣耀推送配置

1. 在 [荣耀开发者服务平台](https://developer.hihonor.com) 创建应用
2. 下载 `mcs-services.json` 文件到 `app/` 目录
3. 添加荣耀推送插件：

```kotlin
// 项目级 build.gradle
dependencies {
    classpath 'com.hihonor.mcs:asplugin:2.0.1.300'
}

// app 级 build.gradle
plugins {
    id 'com.hihonor.mcs.asplugin'
}
```

#### 小米推送配置

1. 在 [小米开放平台](https://dev.mi.com/console/) 创建应用
2. 获取 AppID 和 AppKey
3. 创建 `assets/xiaomi-services.json` 文件：

```json
{
    "app_id": "your_xiaomi_app_id",
    "app_key": "your_xiaomi_app_key"
}
```

#### OPPO推送配置

1. 在 [OPPO开放平台](https://open.oppomobile.com) 创建应用
2. 获取 AppKey 和 AppSecret
3. 创建 `assets/oppo-services.json` 文件：

```json
{
    "app_key": "your_oppo_app_key",
    "app_secret": "your_oppo_app_secret"
}
```

**说明**：OPPO推送直接通过 Gradle 依赖集成，无需额外配置。

#### VIVO推送配置

1. 在 [VIVO开放平台](https://dev.vivo.com.cn) 创建应用
2. 获取 AppID、AppKey 和 AppSecret
3. 创建 `assets/vivo-services.json` 文件：

```json
{
    "app_id": "your_vivo_app_id",
    "api_key": "your_vivo_api_key"
}
```

**说明**：
- 客户端 SDK 只需要 `app_id` 和 `api_key` 两个参数
- `app_secret` 仅在服务端推送时使用，确保客户端安全
- 需要在 VIVO 开发者平台申请推送权限并通过审核

#### 魅族推送配置

1. 在 [魅族开放平台](https://open.flyme.cn) 创建应用
2. 获取 AppID、AppKey 和 AppSecret
3. 创建 `assets/meizu-services.json` 文件：

```json
{
    "app_id": "your_meizu_app_id",
    "app_key": "your_meizu_app_key"
}
```

**说明**：
- 客户端 SDK 只需要 `app_id` 和 `app_key` 两个参数
- `app_secret` 仅在服务端推送时使用，确保客户端安全
- 需要在魅族开放平台申请推送权限并通过审核

### 4. SDK初始化

在 Application 类中初始化 SDK：

```kotlin
import com.doopush.sdk.DooPushManager
import com.doopush.sdk.DooPushCallback
import com.doopush.sdk.DooPushRegisterResult
import com.doopush.sdk.models.DooPushError
import com.doopush.sdk.models.PushMessage

class MyApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // 初始化 DooPush SDK
        try {
            DooPushManager.getInstance().configure(
                context = this,
                appId = "your_app_id",           // DooPush 应用ID
                apiKey = "your_api_key",         // DooPush API Key
                baseURL = "https://doopush.com/api/v1" // 可选，默认为官方服务
            )
            
            Log.d("DooPush", "SDK 初始化成功")
        } catch (e: Exception) {
            Log.e("DooPush", "SDK 初始化失败", e)
        }
    }
}
```

### 5. 注册推送通知

在主 Activity 中注册推送：

```kotlin
class MainActivity : AppCompatActivity(), DooPushCallback {
    
    private val dooPushManager = DooPushManager.getInstance()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // 设置回调监听器
        dooPushManager.setCallback(this)
        
        // 注册推送通知（SDK会自动选择最佳推送服务）
        dooPushManager.registerForPushNotifications()
    }
    
    // 注册成功回调（v1.2+ 推荐使用 result 重载，可拿到服务端 deviceId 与通道）
    override fun onRegisterSuccess(result: DooPushRegisterResult) {
        Log.d(
            "DooPush",
            "推送注册成功，token=${result.token.take(12)}…, deviceId=${result.deviceId}, vendor=${result.vendor}"
        )
        // 处理注册成功逻辑，如更新UI状态
    }

    // 旧版 onRegisterSuccess(token) 仍然兼容；如果同时实现了 result 重载，
    // 默认情况下只会进入 result 重载，不会再额外回调 token 重载。
    
    // 注册失败回调
    override fun onRegisterError(error: DooPushError) {
        Log.e("DooPush", "推送注册失败: ${error.message}")
        // 处理注册失败逻辑，如显示错误提示
    }
    
    // 接收推送消息
    override fun onMessageReceived(message: PushMessage) {
        Log.d("DooPush", "收到推送消息: ${message.getDisplayTitle()}")
        // 处理推送消息，如显示自定义通知或更新应用数据
        
        // 获取自定义数据
        val customData = message.getDataValue("custom_key")
        val actionType = message.getDataValue("action")
        
        // 根据消息类型处理不同逻辑
        when (actionType) {
            "open_page" -> {
                // 打开指定页面
                val pageUrl = message.getDataValue("url")
                // 处理页面跳转逻辑
            }
            "update_data" -> {
                // 更新应用数据
                // 处理数据更新逻辑
            }
        }
    }
    
    // 通知点击回调
    override fun onNotificationClick(notificationData: DooPushNotificationHandler.NotificationData) {
        Log.d("DooPush", "用户点击了通知")
        // 处理通知点击，如跳转到指定页面
        
        // 获取点击的推送消息信息
        val message = notificationData.message
        val actionUrl = message.getDataValue("url")
        
        if (!actionUrl.isNullOrEmpty()) {
            // 根据URL跳转到对应页面
            // 实现页面路由逻辑
        }
    }
    
    // 可选：WebSocket 长连接状态回调
    override fun onWebSocketOpen() {
        Log.d("DooPush", "WebSocket 已连接")
    }

    override fun onWebSocketClosed(code: Int, reason: String) {
        Log.d("DooPush", "WebSocket 关闭: code=$code, reason=$reason")
    }

    override fun onWebSocketFailure(t: Throwable) {
        Log.w("DooPush", "WebSocket 异常", t)
    }
}
```

## 🔧 高级功能

### 设备信息获取

```kotlin
// 获取设备厂商信息
val vendorInfo = dooPushManager.getDeviceVendorInfo()
Log.d("DooPush", "设备厂商: ${vendorInfo.manufacturer}, 推荐服务: ${vendorInfo.preferredService}")

// 获取详细设备信息
val deviceInfo = dooPushManager.getDeviceInfo()
deviceInfo?.let {
    Log.d("DooPush", "设备型号: ${it.model}, 系统版本: ${it.osVersion}")
}

// 获取当前推送Token
dooPushManager.getBestPushToken(object : DooPushTokenCallback {
    override fun onSuccess(token: String) {
        Log.d("DooPush", "当前推送Token: ${token.substring(0, 12)}...")
    }
    
    override fun onError(error: DooPushError) {
        Log.e("DooPush", "获取Token失败: ${error.message}")
    }
})
```

### 注册信息读取（v1.2.0+）

注册结果会写入 SharedPreferences 持久化，下次冷启 SDK 后这些 getter 仍能拿到上次的值：

```kotlin
val token   = dooPushManager.getDeviceToken()    // 推送 token（FCM/HMS/OEM）
val devId   = dooPushManager.getDeviceId()       // 服务端分配的 DooPush 设备 ID
val vendor  = dooPushManager.getCurrentVendor()  // 注册通道：fcm/hms/honor/xiaomi/oppo/vivo/meizu

if (token.isNullOrEmpty()) {
    // 还没注册过，调用 registerForPushNotifications(...)
}
```

### 主动更新设备信息

```kotlin
dooPushManager.updateDeviceInfo { success, error ->
    if (success) {
        Log.d("DooPush", "设备信息已上报到服务端")
    } else {
        Log.w("DooPush", "设备信息更新失败: ${error?.message}")
    }
}
```

> 内部复用注册接口，后端按 token 识别并刷新现有设备记录。需要先完成过一次注册（缓存里有 token）才能使用。

### 角标管理

```kotlin
// 设置应用角标数量
val success = dooPushManager.setBadgeCount(5)
if (success) {
    Log.d("DooPush", "角标设置成功")
} else {
    Log.w("DooPush", "角标设置失败，可能不支持或权限不足")
}

// 清除角标
val cleared = dooPushManager.clearBadge()
Log.d("DooPush", "角标清除${if (cleared) "成功" else "失败"}")

// 读取最近一次设置成功的角标值（v1.2.0+，从 SharedPreferences 读取）
val current = dooPushManager.getBadgeCount()
```

#### 厂商支持

SDK 内部按机型分派到对应的厂商方案：

| 厂商 | 实现方式 | 备注 |
|------|----------|------|
| 华为 | ContentProvider (`com.huawei.android.launcher`) | 需启用桌面角标权限 |
| 荣耀 | ContentProvider (`com.hihonor.android.launcher`) | 需启用桌面角标权限 |
| 小米 | NotificationChannel + 通知数 | MIUI < 11 走反射 `setMessageCount` |
| vivo | ContentProvider (Origin OS) / 广播 (Funtouch OS) | 自动按系统识别 |
| 魅族 | ContentProvider (`com.meizu.flyme.launcher.app_extras`) | — |
| OPPO | 广播 `com.oppo.unsettledevent` | 部分 ROM 限制第三方角标，效果以系统为准 |
| 其他 | 通用广播 `android.intent.action.BADGE_COUNT_UPDATE` | 取决于桌面是否监听 |

### 推送服务状态检测

```kotlin
// 检查各推送服务可用性
val fcmAvailable = dooPushManager.isFirebaseAvailable()
val hmsAvailable = dooPushManager.isHMSAvailable() 
val xiaomiAvailable = dooPushManager.isXiaomiAvailable()
val oppoAvailable = dooPushManager.isOppoAvailable()
val vivoAvailable = dooPushManager.isVivoAvailable()
val meizuAvailable = dooPushManager.isMeizuAvailable()

Log.d("DooPush", """
    推送服务可用性:
    FCM: $fcmAvailable
    HMS: $hmsAvailable  
    小米: $xiaomiAvailable
    OPPO: $oppoAvailable
    VIVO: $vivoAvailable
    魅族: $meizuAvailable
""".trimIndent())

// 获取支持的推送服务列表
val supportedServices = dooPushManager.getSupportedPushServices()
Log.d("DooPush", "支持的推送服务: $supportedServices")

// 测试网络连接
dooPushManager.testNetworkConnection { isConnected ->
    Log.d("DooPush", "网络连接${if (isConnected) "正常" else "异常"}")
}
```

### 第三方推送 SDK 共存（v1.1.0+）

如果项目已经在用 `expo-notifications`、`react-native-firebase` 或自管 FCM 流程，可以让 DooPush 让位：跳过 token 获取，由调用方拿到 token 后通过 `registerDevice(token, vendor, callback)` 完成 DooPush 服务端注册。

```kotlin
// 1) 标记 PASSIVE 模式（marker，不直接改变 SDK 行为，配合下面其它开关使用）
DooPushManager.getInstance().setNotificationManagementMode(
    DooPushManager.NotificationManagementMode.PASSIVE
)

// 2) 让位：FCM 通知不再由 DooPush 自管展示（默认 true）
DooPushManager.getInstance().setFCMNotificationDisplayEnabled(false)

// 3) 启用 relay 广播：让上层 SDK（expo-notifications 等）也能收到原始 FCM 消息
DooPushManager.getInstance().setExpoNotificationRelayEnabled(true)

// 4) 拿调用方已有的 token 完成 DooPush 服务端注册
DooPushManager.getInstance().registerDevice(
    token = tokenFromHostSDK,
    vendor = "fcm", // 可选值: "apns"/"fcm"/"hms"/"honor"/"xiaomi"/"oppo"/"vivo"/"meizu"
    callback = object : DooPushRegisterCallback {
        override fun onSuccess(result: DooPushRegisterResult) {
            Log.d("DooPush", "外部 token 注册成功，deviceId=${result.deviceId}")
        }
        override fun onSuccess(token: String) { /* 兼容旧签名 */ }
        override fun onError(error: DooPushError) {
            Log.e("DooPush", "外部 token 注册失败: ${error.message}")
        }
    }
)
```

#### Relay 广播协议

启用 `setExpoNotificationRelayEnabled(true)` 后，DooPush 收到 FCM 消息时会发送一条**同包**广播（`intent.setPackage(packageName)`），上层 SDK / 自定义 BroadcastReceiver 可直接拦截：

| 字段 | 类型 | 说明 |
|------|------|------|
| Action | `String` | `DooPushFirebaseMessagingService.ACTION_RELAY_NOTIFICATION_RECEIVED`（即 `com.doopush.relay.NOTIFICATION_RECEIVED`） |
| `EXTRA_DATA` | `Bundle` | FCM data payload，键值对全为 `String` |
| `EXTRA_NOTIFICATION_TITLE` / `EXTRA_NOTIFICATION_BODY` | `String?` | FCM notification 标题 / 正文 |
| `EXTRA_FROM` / `EXTRA_MESSAGE_ID` | `String?` | FCM `from` / `messageId` |
| `EXTRA_SENT_TIME` | `Long` | FCM `sentTime` |

```kotlin
val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val data = intent.getBundleExtra(DooPushFirebaseMessagingService.EXTRA_DATA)
        // ...
    }
}
val filter = IntentFilter(DooPushFirebaseMessagingService.ACTION_RELAY_NOTIFICATION_RECEIVED)
context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
```

### 主动上报统计

```kotlin
// 立即把本地排队的推送送达 / 点击 / 打开统计上报到服务端
DooPushManager.getInstance().reportStatistics()
```

### 应用生命周期处理

```kotlin
class MyApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        // SDK初始化...
        
        // 注册应用生命周期监听
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {
                // 应用进入前台（清通知 + 重置角标）
                DooPushManager.getInstance().applicationDidBecomeActive(activity.applicationContext)
            }
            
            override fun onActivityPaused(activity: Activity) {
                // 应用进入后台
                DooPushManager.getInstance().applicationWillResignActive()
                // 断开 WebSocket 长连接
                DooPushManager.getInstance().applicationWillTerminate()
            }
            
            // 其他生命周期方法...
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
    }
    
    override fun onTerminate() {
        super.onTerminate()
        // 应用终止时清理资源
        DooPushManager.getInstance().applicationWillTerminate()
        DooPushManager.getInstance().release()
    }
}
```

## 🔍 调试和故障排查

### 调试日志

```kotlin
// 获取SDK状态信息
val sdkStatus = dooPushManager.getSDKStatus()
Log.d("DooPush", "SDK状态:\n$sdkStatus")

// 获取设备调试信息
val deviceDebugInfo = DooPushDeviceVendor.getDeviceDebugInfo()
Log.d("DooPush", "设备信息:\n$deviceDebugInfo")
```

### 常见问题

#### Q: demo无法编译报错?
A: 
1. 将org.jetbrains.kotlin.android更改为1.9.21及以上
```
plugins {
    id 'org.jetbrains.kotlin.android' version '1.9.23' apply false
}
```

#### Q: 华为设备无法接收推送？
A: 
1. 确保已添加 HMS Push 依赖和 `agconnect-services.json` 配置文件
2. 在华为开发者后台启用推送服务
3. 检查应用是否在华为应用市场上架或已添加测试白名单
4. 检查SHA256证书/公钥指纹是否正确

#### Q: 小米设备推送不稳定？
A: 
1. 检查 `xiaomi-services.json` 配置文件是否正确
2. 确保应用已添加自启动权限
3. 在小米开放平台检查推送配额和限制

#### Q: OPPO设备无法注册推送？
A: 
1. 确保已添加OPPO推送SDK依赖：`com.umeng.umsdk:oppo-push:3.5.3`
2. 确保 `oppo-services.json` 配置正确
3. 检查应用包名是否与OPPO后台配置一致
4. 验证应用签名是否匹配

#### Q: VIVO设备推送支持情况？
A: 
✅ **VIVO推送已完全支持！** VIVO/iQOO设备会自动使用VIVO推送服务，提供更好的消息送达率和电量优化。需要在VIVO开发者平台申请推送权限并配置相应参数。

#### Q: 各厂商推送支持状态？
A: 
- ✅ **FCM**: 完全支持，所有Android设备默认通道
- ✅ **华为HMS**: 完全支持，华为设备自动识别
- ✅ **荣耀推送**: 完全支持，荣耀设备自动识别
- ✅ **小米推送**: 完全支持，小米设备自动识别
- ✅ **OPPO推送**: 完全支持，OPPO设备自动识别
- ✅ **VIVO推送**: 完全支持，VIVO设备自动识别
- ✅ **魅族推送**: 完全支持，魅族设备自动识别

#### Q: VIVO设备无法接收推送？
A: 
1. 确保已添加 VIVO 推送依赖和 `vivo-services.json` 配置文件
2. 在 VIVO 开发者平台申请推送权限并通过审核
3. 检查应用包名和签名是否与 VIVO 后台配置一致
4. 确认 `app_id` 和 `api_key` 配置正确

#### Q: 魅族设备推送支持情况？
A: 
✅ **魅族推送已完全支持！** 魅族设备会自动使用魅族推送服务，提供针对Flyme OS的专门优化。

#### Q: 魅族设备无法接收推送？
A: 
1. 确保已添加魅族推送依赖和 `meizu-services.json` 配置文件
2. 在魅族开放平台申请推送权限并通过审核
3. 检查应用包名和签名是否与魅族后台配置一致
4. 确认 `app_id` 和 `app_key` 配置正确
5. 验证是否为真正的魅族设备（非刷机或第三方ROM）

#### Q: 荣耀设备推送支持情况？
A: 
✅ **荣耀推送已完全支持！** 荣耀设备会自动使用荣耀推送服务，提供针对Magic OS系统的专门优化。

**配置要点：**
1. 添加荣耀推送依赖：`com.hihonor.mcs:push:8.0.12.307`
2. 检查配置文件 `mcs-services.json` 内容是否正确
3. 在荣耀开发者服务平台申请推送权限并通过审核
4. 添加荣耀推送插件：`com.hihonor.mcs.asplugin`

**支持设备：**
- 荣耀品牌所有设备（Honor独立后）
- Magic OS系统设备

#### Q: 荣耀设备无法接收推送？
A: 
1. 确保已添加荣耀推送依赖和 `mcs-services.json` 配置文件
2. 在荣耀开发者服务平台申请推送权限并通过审核
3. 检查应用包名和签名是否与荣耀后台配置一致
4. 确保添加了荣耀推送插件

#### Q: 角标不显示？
A: 
1. 确保已添加角标相关权限
2. 在设备设置中开启应用角标功能
3. 注意部分第三方桌面可能不支持角标
4. OPPO 部分 ROM 限制第三方应用设置角标，效果以厂商系统为准

#### Q: 通知栏不显示消息？
A: 
需要代码调用通知权限授权
    
#### Q: FCM获取TOKEN失败？
A: 
设备需要登录谷歌账号

#### Q: 如何调试推送问题？
A: 
```bash
# 查看DooPush相关日志
adb logcat -s DooPushManager

# 查看所有推送相关日志
adb logcat | grep -i "push\|doopush\|fcm\|hms\|honor\|oppo\|vivo\|meizu"

# 查看特定厂商推送日志
adb logcat -s VivoService      # VIVO推送日志
adb logcat -s MeizuService     # 魅族推送日志
adb logcat -s HonorService     # 荣耀推送日志
adb logcat -s HMSService       # 华为推送日志
```

### 性能优化建议

1. **延迟初始化**: 可以在应用启动后延迟初始化推送服务
2. **权限请求**: 合适的时机请求推送权限，提升用户同意率
3. **网络检测**: 在网络状态良好时进行推送注册
4. **错误重试**: 注册失败时实现指数退避重试机制

## 📚 API 参考

### DooPushManager 核心方法

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `configure()` | 配置 SDK | void |
| `setCallback()` | 设置回调监听器 | void |
| `registerForPushNotifications(callback?)` | 走 SDK 内部 token 获取流程注册 | void |
| `registerDevice(token, vendor, callback)` | 用调用方已有 token 直接注册（共存模式） | void |
| `getBestPushToken()` | 获取最适合的推送 Token | void |
| `getDeviceToken() / getDeviceId() / getCurrentVendor()` | 读取持久化的注册信息（v1.2.0+） | String? |
| `getDeviceInfo()` | 获取设备信息 | DeviceInfo? |
| `updateDeviceInfo(callback?)` | 主动把设备信息上报到服务端（v1.2.0+） | void |
| `setBadgeCount(count) / clearBadge() / getBadgeCount()` | 角标设置 / 清除 / 读取（v1.2.0+） | Boolean / Boolean / Int |
| `reportStatistics()` | 立即上报排队中的统计事件（v1.2.0+） | void |
| `setNotificationManagementMode(mode)` | ACTIVE / PASSIVE 共存标记（v1.1.0+） | void |
| `setFCMNotificationDisplayEnabled(enabled)` | 是否由 DooPush 自管展示 FCM 通知（v1.1.0+） | void |
| `setExpoNotificationRelayEnabled(enabled)` | 启用 FCM 消息 relay 广播（v1.1.0+） | void |
| `clearCache()` | 清除内存缓存与持久化注册信息（v1.2.0+） | void |
| `release()` | 释放运行时资源（不清除持久化注册信息） | void |

### DooPushCallback 接口

| 方法 | 描述 | 参数 |
|------|------|------|
| `onRegisterSuccess(token)` | 注册成功（旧签名，兼容保留） | token: String |
| `onRegisterSuccess(result)` | 注册成功（v1.2.0+，包含服务端 deviceId 与通道） | result: DooPushRegisterResult |
| `onRegisterError()` | 注册失败回调 | error: DooPushError |
| `onMessageReceived()` | 消息接收回调 | message: PushMessage |
| `onTokenReceived()` | FCM Token 获取成功 | token: String |
| `onTokenError()` | FCM Token 获取失败 | error: DooPushError |
| `onNotificationClick()` | 通知点击回调 | notificationData |
| `onNotificationOpen()` | 通知打开应用 | notificationData |
| `onWebSocketOpen()` | WebSocket 连接建立 | — |
| `onWebSocketClosed()` | WebSocket 连接关闭 | code: Int, reason: String |
| `onWebSocketFailure()` | WebSocket 异常 | t: Throwable |

## 🔗 相关链接

- [iOS SDK 集成指南](./ios-integration.md)
- [推送 API 文档](/api/push-apis.md)
- [设备管理 API](/api/device-apis.md)
- [DooPush 控制台](https://console.doopush.com)

## 💡 最佳实践

1. **推送权限申请**: 在合适的时机（如用户完成关键操作后）申请推送权限
2. **消息处理**: 根据推送消息的 `action` 字段实现不同的业务逻辑
3. **错误处理**: 实现完整的错误处理逻辑，提供友好的用户提示
4. **性能监控**: 定期检查推送送达率和点击率，优化推送策略
5. **隐私保护**: 遵循用户隐私保护规范，合理使用推送功能

---

*通过以上步骤，您可以成功集成 DooPush Android SDK 并开始接收推送通知。如有问题，请参考示例项目或联系技术支持。*
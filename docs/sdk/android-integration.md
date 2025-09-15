# Android SDK 集成指南

DooPush Android SDK 为 Android 应用提供统一的推送通知解决方案，支持多个主流厂商推送服务的智能路由和管理。

## 🚀 功能特性

### 📱 多厂商推送支持
- ✅ **Google FCM** - Firebase Cloud Messaging，海外和国内通用
- ✅ **华为 HMS Push** - Huawei Mobile Services，华为设备专用
- ✅ **小米推送** - 小米设备专用通道，MIUI深度优化
- ✅ **OPPO推送** - OPPO/OnePlus设备专用，ColorOS优化
- 📋 **VIVO推送** - VIVO/iQOO设备专用（开发计划中）

### 🧠 智能推送路由
- **自动厂商识别** - 根据设备品牌自动选择最优推送通道
- **Fallback机制** - 厂商服务不可用时自动降级到FCM
- **零配置启动** - 支持从配置文件自动读取推送参数

### 🔧 核心功能
- ✅ **设备注册** - 自动注册设备到 DooPush 平台
- ✅ **推送接收** - 统一的推送消息接收和处理
- ✅ **权限管理** - 智能处理推送权限申请
- ✅ **角标管理** - 支持应用图标角标设置和清除
- ✅ **消息去重** - 防止重复推送处理
- ✅ **统计上报** - 自动统计推送送达和点击数据

### 📊 高级特性
- ✅ **TCP长连接** - Gateway长连接支持实时消息
- ✅ **设备信息** - 详细的设备厂商和能力检测
- ✅ **网络检测** - 推送服务可用性检测
- ✅ **生命周期** - 应用前后台状态感知

## 📋 系统要求

- **Android版本**: 5.0+ (API Level 21)
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
    }
}
```

#### 方式一：使用发布的AAR包（推荐）

1. 访问 [DooPush Android SDK Releases](https://github.com/doopush/doopush-android-sdk/releases)
2. 下载最新版本的 `DooPushSDK.aar` 文件
3. 将AAR文件放置到你的应用模块的 `libs` 目录下（如：`app/libs/`）
4. 在 app 模块的 `build.gradle` 中添加：

```kotlin
dependencies {
    // DooPush SDK - 使用本地AAR文件
    implementation files('libs/DooPushSDK.aar')
    
    // 必需：Firebase Cloud Messaging
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging-ktx'
    
    // 可选：华为 HMS Push （华为设备）
    implementation 'com.huawei.hms:push:6.11.0.300'
    
    // 可选：小米推送 （小米设备）
    implementation 'com.umeng.umsdk:xiaomi-push:6.0.1'
    
    // 可选：OPPO推送 （OPPO设备）
    implementation 'com.umeng.umsdk:oppo-push:3.5.3'
}
```

#### 方式二：源码集成（开发调试）

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
    id 'com.google.gms.google-services' version '4.3.15' apply false
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
plugins {
    id 'com.huawei.agconnect' version '1.9.1.301' apply false
}

// app 级 build.gradle
plugins {
    id 'com.huawei.agconnect'
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

### 4. SDK初始化

在 Application 类中初始化 SDK：

```kotlin
import com.doopush.sdk.DooPushManager
import com.doopush.sdk.DooPushCallback
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
                baseURL = "https://api.doopush.com/api/v1" // 可选，默认为官方服务
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
    
    // 注册成功回调
    override fun onRegisterSuccess(token: String) {
        Log.d("DooPush", "推送注册成功，Token: ${token.substring(0, 12)}...")
        // 处理注册成功逻辑，如更新UI状态
    }
    
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
    
    // 可选：TCP连接状态变化
    override fun onTCPStateChanged(state: DooPushTCPState) {
        Log.d("DooPush", "TCP连接状态: ${state.description}")
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
```

### 推送服务状态检测

```kotlin
// 检查各推送服务可用性
val fcmAvailable = dooPushManager.isFirebaseAvailable()
val hmsAvailable = dooPushManager.isHMSAvailable() 
val xiaomiAvailable = dooPushManager.isXiaomiAvailable()
val oppoAvailable = dooPushManager.isOppoAvailable()

Log.d("DooPush", """
    推送服务可用性:
    FCM: $fcmAvailable
    HMS: $hmsAvailable  
    小米: $xiaomiAvailable
    OPPO: $oppoAvailable
""".trimIndent())

// 获取支持的推送服务列表
val supportedServices = dooPushManager.getSupportedPushServices()
Log.d("DooPush", "支持的推送服务: $supportedServices")

// 测试网络连接
dooPushManager.testNetworkConnection { isConnected ->
    Log.d("DooPush", "网络连接${if (isConnected) "正常" else "异常"}")
}
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
                // 应用进入前台
                DooPushManager.getInstance().applicationDidBecomeActive()
            }
            
            override fun onActivityPaused(activity: Activity) {
                // 应用进入后台
                DooPushManager.getInstance().applicationWillResignActive()
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

#### Q: 华为设备无法接收推送？
A: 
1. 确保已添加 HMS Push 依赖和 `agconnect-services.json` 配置文件
2. 在华为开发者后台启用推送服务
3. 检查应用是否在华为应用市场上架或已添加测试白名单

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
VIVO推送目前尚未实现，VIVO设备会自动fallback到FCM推送通道。VIVO推送功能在开发计划中，具体发布时间请关注项目更新。

#### Q: 各厂商推送支持状态？
A: 
- ✅ **FCM**: 完全支持，所有Android设备默认通道
- ✅ **华为HMS**: 完全支持，华为设备自动识别
- ✅ **小米推送**: 完全支持，小米设备自动识别
- ✅ **OPPO推送**: 完全支持，OPPO设备自动识别
- 📋 **VIVO推送**: 开发计划中，目前使用FCM

#### Q: 角标不显示？
A: 
1. 确保已添加角标相关权限
2. 在设备设置中开启应用角标功能
3. 注意部分第三方桌面可能不支持角标

#### Q: 如何调试推送问题？
A: 
```bash
# 查看DooPush相关日志
adb logcat -s DooPushManager

# 查看所有推送相关日志
adb logcat | grep -i "push\|doopush\|fcm\|hms"
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
| `configure()` | 配置SDK | void |
| `setCallback()` | 设置回调监听器 | void |
| `registerForPushNotifications()` | 注册推送通知 | void |
| `getBestPushToken()` | 获取最适合的推送Token | void |
| `getDeviceInfo()` | 获取设备信息 | DeviceInfo? |
| `setBadgeCount()` | 设置角标数量 | Boolean |
| `clearBadge()` | 清除角标 | Boolean |

### DooPushCallback 接口

| 方法 | 描述 | 参数 |
|------|------|------|
| `onRegisterSuccess()` | 注册成功回调 | token: String |
| `onRegisterError()` | 注册失败回调 | error: DooPushError |
| `onMessageReceived()` | 消息接收回调 | message: PushMessage |
| `onNotificationClick()` | 通知点击回调 | notificationData |

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
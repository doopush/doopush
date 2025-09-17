# DooPush SDK Android 示例应用

演示 DooPush SDK 完整功能的 Android 示例应用，包含推送注册、状态监控、通知历史、角标管理等核心特性。

## 主要功能

- **SDK状态监控**：实时显示SDK配置状态、注册状态、推送权限
- **设备管理**：自动获取设备Token、设备信息，支持华为、荣耀、小米、OPPO、VIVO和FCM多厂商推送服务
- **推送注册**：一键注册推送通知，自动检测最佳推送服务（HMS/HONOR/FCM/MIPUSH/OPPO/VIVO）
- **通知历史**：接收推送历史记录，支持详情查看和状态跟踪
- **角标管理**：应用角标数字的设置和清除操作，支持多厂商设备
- **设置页面**：详细的配置信息展示和服务器连接测试

## 快速开始

### 1. 导入项目
```bash
cd sdk/android/DooPushSDKExample
./gradlew build
```

### 2. 配置参数

#### doopush-services.json 配置

在 `app/` 目录下创建 `doopush-services.json` 文件：

```json
{
  "app_id": "your_app_id_here",
  "api_key": "your_api_key_here", 
  "base_url": "https://your-server.com/api/v1",
  "debug_enabled": true
}
```

**配置说明：**
- `app_id`: DooPush 应用ID
- `api_key`: DooPush API密钥  
- `base_url`: 服务器基础URL（包含API版本路径）
- `debug_enabled`: 调试模式开关

#### xiaomi-services.json 配置

在 `app/` 目录下创建 `xiaomi-services.json` 文件（小米推送配置）：

```json
{
  "app_id": "your_xiaomi_app_id",
  "app_key": "your_xiaomi_app_key"
}
```

**配置说明：**
- `app_id`: 小米开发者平台的应用ID  
- `app_key`: 小米开发者平台的应用Key

**重要特性：**
- ✅ **自动配置**: SDK 会自动从 `xiaomi-services.json` 读取配置
- ✅ **智能启用**: 在小米设备上自动启用小米推送服务
- ✅ **零代码集成**: 无需在代码中手动配置小米推送参数

**注意：** 客户端SDK只需要 `app_id` 和 `app_key`，`app_secret` 仅用于服务端API调用。

**注意：** 配置文件已添加到 `.gitignore`，不会被版本控制。如果文件不存在或字段为空，SDK将使用内置默认配置。

#### oppo-services.json 配置

在 `app/` 目录下创建 `oppo-services.json` 文件（OPPO推送配置）：

```json
{
  "app_key": "your_oppo_app_key",
  "app_secret": "your_oppo_app_secret"
}
```

**配置说明：**
- `app_key`: OPPO开发者平台的应用Key  
- `app_secret`: OPPO开发者平台的应用Secret（服务端推送必需）

**重要特性：**
- ✅ **自动配置**: SDK 会自动从 `oppo-services.json` 读取配置
- ✅ **智能启用**: 在OPPO/OnePlus设备上自动启用OPPO推送服务
- ✅ **零代码集成**: 无需在代码中手动配置OPPO推送参数
- 🔐 **安全性**: `app_secret` 仅用于服务端，客户端SDK不暴露敏感信息

**支持设备：**
- OPPO手机 (ColorOS)
- OnePlus手机 (OxygenOS/ColorOS)

**注意：** 客户端侧集成 OPPO 推送仅需 `app_key` 与 `app_secret`；`app_secret` 主要用于服务端API认证，客户端不会上传。

#### vivo-services.json 配置

在 `app/` 目录下创建 `vivo-services.json` 文件（VIVO推送配置）：

```json
{
  "app_id": "your_vivo_app_id",
  "api_key": "your_vivo_api_key"
}
```

**配置说明：**
- `app_id`: VIVO开发者平台的应用ID
- `api_key`: VIVO开发者平台的应用ApiKey（客户端SDK使用）

**重要特性：**
- ✅ **自动配置**: SDK 会自动从 `vivo-services.json` 读取配置
- ✅ **智能启用**: 在VIVO/iQOO设备上自动启用VIVO推送服务
- ✅ **零代码集成**: 无需在代码中手动配置VIVO推送参数
- 🔐 **安全设计**: 客户端只需要`app_id`和`api_key`，敏感的`app_key`和`app_secret`仅在服务端使用

**支持设备：**
- VIVO手机 (Funtouch OS/Origin OS)
- iQOO手机 (Origin OS/Funtouch OS)

**注意：** 客户端SDK只需要`app_id`和`api_key`即可工作。服务端API推送时需要完整的三个参数（`app_id`、`app_key`、`app_secret`）。

#### mcs-services.json 配置

在 `app/` 目录下创建 `mcs-services.json` 文件（荣耀推送配置）：

```json
{
  "client_id": "your_honor_client_id",
  "client_secret": "your_honor_client_secret"
}
```

**配置说明：**
- `client_id`: 荣耀开发者平台的应用客户端ID
- `client_secret`: 荣耀开发者平台的应用客户端密钥

**重要特性：**
- ✅ **自动配置**: SDK 会自动从 `mcs-services.json` 读取配置
- ✅ **智能启用**: 在荣耀设备上自动启用荣耀推送服务
- ✅ **零代码集成**: 无需在代码中手动配置荣耀推送参数
- 🔐 **OAuth 2.0认证**: 使用OAuth 2.0 client_credentials流程进行服务认证

**支持设备：**
- 荣耀手机（Honor独立后的设备）
- Magic OS系统设备

**注意：** 荣耀推送使用OAuth 2.0认证机制，需要`client_id`和`client_secret`来获取访问令牌进行API调用。

#### 推送服务配置

1. **FCM配置**: 将 `google-services.json` 放在 `app/` 目录下
2. **HMS配置**: 将 `agconnect-services.json` 放在 `app/` 目录下
3. **小米推送配置**: 在 DooPush 平台后台配置小米推送参数（App ID、App Key、App Secret）
4. **OPPO推送配置**: 在 DooPush 平台后台配置OPPO推送参数（App ID、App Key、App Secret）
5. **VIVO推送配置**: 在 DooPush 平台后台配置VIVO推送参数（App ID、App Key、App Secret）
6. **荣耀推送配置**: 在 DooPush 平台后台配置荣耀推送参数（Client ID、Client Secret）

### 3. 依赖配置

如需使用荣耀推送功能，请确保在项目的 `build.gradle` 文件中添加荣耀推送依赖：

**项目级 build.gradle（根目录）**:
```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://developer.huawei.com/repo/' }
        maven { url 'https://developer.hihonor.com/repo' }  // 荣耀推送仓库
    }
}
```

**settings.gradle**:
```gradle
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://developer.huawei.com/repo/' }
        maven { url 'https://developer.hihonor.com/repo' }  // 荣耀推送仓库
    }
}
```

**应用级 build.gradle（app目录）**:
```gradle
dependencies {
    // 荣耀推送 SDK
    implementation 'com.hihonor.mcs:push:8.0.0.300'
    
    // 其他推送服务依赖...
    implementation 'com.huawei.hms:push:6.11.0.300'           // 华为推送
    implementation 'com.umeng.umsdk:xiaomi-push:6.0.1'        // 小米推送
    implementation 'com.umeng.umsdk:oppo-push:3.5.3'          // OPPO推送
    implementation 'com.umeng.umsdk:vivo-push:4.0.6.0'        // VIVO推送
}
```

### 4. 基本流程
1. 启动应用，SDK自动初始化并检测推送服务
2. 点击"配置SDK"完成初始化
3. 点击"注册推送"并授权通知权限
4. 查看设备信息和Token状态
5. 通过 DooPush 后台发送测试推送
6. 在推送历史中查看接收的推送

## 项目结构

```
DooPushSDKExample/
├── app/src/main/java/com/doopush/DooPushSDKExample/
│   ├── MainActivity.kt                 # 主界面 - SDK操作和状态展示
│   ├── PushHistoryActivity.kt         # 推送历史页面 - 消息记录
│   ├── SettingsActivity.kt            # 设置页面 - 配置和调试
│   └── ExampleApplication.kt          # 应用入口 - SDK初始化
├── app/src/main/res/
│   ├── layout/                        # 界面布局文件
│   ├── values/                        # 资源文件
│   └── drawable/                      # 图标资源
└── app/
    ├── google-services.json           # FCM配置文件
    ├── agconnect-services.json        # HMS配置文件
    ├── doopush-services.json          # DooPush配置文件
    ├── xiaomi-services.json           # 小米推送配置文件
    ├── oppo-services.json             # OPPO推送配置文件
    ├── vivo-services.json             # VIVO推送配置文件
    └── mcs-services.json              # 荣耀推送配置文件
```

## 核心实现

### MainActivity
实现 `DooPushCallback` 接口，处理所有SDK回调：
- SDK配置和推送服务注册
- 设备Token获取和显示
- 推送消息接收和状态更新
- 角标测试功能

### 关键代码示例

```kotlin
class MainActivity : AppCompatActivity(), DooPushCallback {
    
    private val dooPushManager = DooPushManager.getInstance()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 设置SDK回调
        dooPushManager.setCallback(this)
        
        // 配置SDK（从配置文件读取参数）
        configureSDK()
    }
    
    // 配置SDK
    private fun configureSDK() {
        dooPushManager.configure(
            context = this,
            appId = globalAppId.ifEmpty { "default_app_id" },
            apiKey = globalApiKey.ifEmpty { "default_api_key" },
            baseUrl = globalBaseUrl.ifEmpty { "http://localhost:5002/api/v1" }
        )
    }
    
    // 注册推送服务
    private fun registerForPushNotifications() {
        dooPushManager.registerForPushNotifications()
    }
    
    // 角标测试
    private fun testBadgeFunction(count: Int) {
        val success = dooPushManager.setBadgeCount(count)
        showToast(if (success) "角标设置成功" else "角标设置失败")
    }
}
```

### 配置管理

应用支持多级配置优先级：
1. `doopush-services.json` 文件配置（推荐）
2. 全局变量默认值
3. SDK内置默认配置

```kotlin
// 从JSON文件读取配置
private fun loadConfigFromAssets() {
    try {
        val inputStream = assets.open("doopush-services.json")
        val json = inputStream.bufferedReader().readText()
        val config = JSONObject(json)
        
        globalAppId = config.optString("app_id", "")
        globalApiKey = config.optString("api_key", "") 
        globalBaseUrl = config.optString("base_url", "")
    } catch (e: Exception) {
        Log.w(TAG, "配置文件读取失败，使用默认配置: ${e.message}")
    }
}
```

## 测试推送

### 1. 设备注册
1. 启动应用并完成SDK配置
2. 点击"注册推送"按钮
3. 授权通知权限
4. 记录显示的设备Token

### 2. 发送测试推送
1. 登录 DooPush 管理后台
2. 选择对应应用 > 推送管理 > 发送推送
3. 使用示例应用的设备Token发送测试消息
4. 观察应用中的推送接收状态

### 3. 角标测试
1. 点击"设置角标"按钮测试角标功能
2. 观察应用图标上的数字变化
3. 点击"清除角标"按钮清除显示

## 推送服务兼容性

### 华为设备
- 自动使用 HMS Push 服务
- 支持角标显示
- 需要 `agconnect-services.json` 配置文件

### 荣耀设备
- 自动使用荣耀推送服务
- 支持Magic OS角标显示
- 需要 `mcs-services.json` 配置文件
- 使用OAuth 2.0认证机制

### 小米/红米设备
- 自动使用小米推送服务
- 支持MIUI角标显示
- 需要在 DooPush 平台配置小米推送参数

### OPPO/OnePlus设备
- 自动使用OPPO推送服务（HeytapPush）
- 支持ColorOS角标显示
- 需要在 DooPush 平台配置OPPO推送参数
- OnePlus设备统一使用OPPO推送通道

### VIVO/iQOO设备
- 自动使用VIVO推送服务
- 支持Funtouch OS/Origin OS角标显示
- 需要在 DooPush 平台配置VIVO推送参数
- iQOO设备统一使用VIVO推送通道

### Google Play 设备
- 自动使用 FCM 服务
- 需要 `google-services.json` 配置文件
- 角标支持因厂商而异

### 设备厂商角标支持
- ✅ **华为**: EMUI/HarmonyOS原生支持
- ✅ **荣耀**: Magic OS原生支持
- ✅ **小米**: MIUI系统桌面支持
- ✅ **OPPO/一加**: ColorOS支持  
- ✅ **VIVO**: FunTouchOS/OriginOS支持
- ⚠️ **其他厂商**: 部分支持

## 调试技巧

### 日志查看
```bash
# 查看DooPush相关日志
adb logcat -s DooPushManager

# 查看角标管理日志
adb logcat -s DooPush_BadgeManager

# 查看OPPO推送日志
adb logcat -s OppoService

# 查看VIVO推送日志
adb logcat -s VivoService

# 查看应用完整日志
adb logcat | grep DooPushSDKExample
```

### 常见问题排查
1. **推送注册失败**: 检查网络连接和配置文件
2. **Token获取失败**: 确认推送服务配置正确
3. **角标不显示**: 检查设备权限和桌面兼容性
4. **华为推送异常**: 确认 HMS Core 版本和配置
5. **荣耀推送异常**: 确认荣耀推送SDK集成和client_id/client_secret配置
6. **小米推送异常**: 确认小米推送SDK集成和配置参数
7. **OPPO推送异常**: 确认OPPO开发者平台配置和app_secret正确性
8. **VIVO推送异常**: 确认VIVO开发者平台配置，客户端需要app_id和api_key
9. **设备推送服务检测失败**: 检查设备系统版本和推送服务可用性

### 荣耀推送特殊说明
- **OAuth 2.0认证**: 荣耀推送使用OAuth 2.0 client_credentials流程进行认证
- **独立服务**: 荣耀推送是独立于HMS的推送服务，需要单独配置
- **Magic OS支持**: 专为Magic OS系统优化，提供更好的推送体验
- **应用审核**: 确保应用已在荣耀开发者平台通过审核才能正常推送

### OPPO推送特殊说明
- **应用签名**: OPPO推送对应用签名有严格要求，确保使用正确的签名文件
- **权限配置**: 确认已添加OPPO推送所需的权限和组件
- **调试模式**: 开发阶段可使用debug模式，生产环境务必关闭
- **消息分类**: OPPO推送支持不同消息类型（通知消息、透传消息），选择合适类型

### VIVO推送特殊说明
- **客户端配置**: 客户端SDK只需要`app_id`和`api_key`，服务端API需要完整的三个参数
- **应用白名单**: 需要在VIVO开发者平台申请推送权限并通过审核
- **消息分类**: 支持系统消息（classification=1）和运营消息（classification=0）
- **权限申请**: 应用需要申请推送权限，用户同意后才能正常推送
- **安全设计**: `app_key`和`app_secret`仅在服务端API调用时使用，客户端不暴露
- **UPS支持**: 支持统一推送服务（Unified Push Service）标准

## SDK集成示例

完整的SDK集成示例代码，可直接参考本项目的实现：

```kotlin
// 1. Application中配置
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        DooPushManager.getInstance().configure(/*...*/)
    }
}

// 2. Activity中使用
class MainActivity : AppCompatActivity(), DooPushCallback {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DooPushManager.getInstance().apply {
            setCallback(this@MainActivity)
            registerForPushNotifications()
        }
    }
    
    override fun onRegisterSuccess(token: String) {
        // 处理注册成功
    }
    
    override fun onMessageReceived(message: PushMessage) {
        // 处理推送消息
    }
}
```

## 技术要求

- Android 5.0+ (API 21+)
- Kotlin 1.9+
- Android Studio 2022.3+
- Gradle 8.0+
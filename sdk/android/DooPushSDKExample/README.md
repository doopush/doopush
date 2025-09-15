# DooPush SDK Android 示例应用

演示 DooPush SDK 完整功能的 Android 示例应用，包含推送注册、状态监控、通知历史、角标管理等核心特性。

## 主要功能

- **SDK状态监控**：实时显示SDK配置状态、注册状态、推送权限
- **设备管理**：自动获取设备Token、设备信息，支持华为、小米、OPPO和FCM多厂商推送服务
- **推送注册**：一键注册推送通知，自动检测最佳推送服务（HMS/FCM/MIPUSH/OPPO）
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

#### 推送服务配置

1. **FCM配置**: 将 `google-services.json` 放在 `app/` 目录下
2. **HMS配置**: 将 `agconnect-services.json` 放在 `app/` 目录下
3. **小米推送配置**: 在 DooPush 平台后台配置小米推送参数（App ID、App Key、App Secret）
4. **OPPO推送配置**: 在 DooPush 平台后台配置OPPO推送参数（App ID、App Key、App Secret）

### 3. 基本流程
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
    └── oppo-services.json             # OPPO推送配置文件
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

### 华为/荣耀设备
- 自动使用 HMS Push 服务
- 支持角标显示
- 需要 `agconnect-services.json` 配置文件

### 小米/红米设备
- 自动使用小米推送服务
- 支持MIUI角标显示
- 需要在 DooPush 平台配置小米推送参数

### OPPO/OnePlus设备
- 自动使用OPPO推送服务（HeytapPush）
- 支持ColorOS角标显示
- 需要在 DooPush 平台配置OPPO推送参数
- OnePlus设备统一使用OPPO推送通道

### Google Play 设备
- 自动使用 FCM 服务
- 需要 `google-services.json` 配置文件
- 角标支持因厂商而异

### 设备厂商角标支持
- ✅ **华为/荣耀**: 原生支持
- ✅ **小米**: 系统桌面支持
- ✅ **OPPO/一加**: ColorOS支持  
- ✅ **VIVO**: FunTouchOS支持
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

# 查看应用完整日志
adb logcat | grep DooPushSDKExample
```

### 常见问题排查
1. **推送注册失败**: 检查网络连接和配置文件
2. **Token获取失败**: 确认推送服务配置正确
3. **角标不显示**: 检查设备权限和桌面兼容性
4. **华为推送异常**: 确认 HMS Core 版本和配置
5. **小米推送异常**: 确认小米推送SDK集成和配置参数
6. **OPPO推送异常**: 确认OPPO开发者平台配置和app_secret正确性
7. **设备推送服务检测失败**: 检查设备系统版本和推送服务可用性

### OPPO推送特殊说明
- **应用签名**: OPPO推送对应用签名有严格要求，确保使用正确的签名文件
- **权限配置**: 确认已添加OPPO推送所需的权限和组件
- **调试模式**: 开发阶段可使用debug模式，生产环境务必关闭
- **消息分类**: OPPO推送支持不同消息类型（通知消息、透传消息），选择合适类型

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
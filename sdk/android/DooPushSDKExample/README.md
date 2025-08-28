# DooPush SDK Android 示例应用

演示如何集成和使用 DooPush SDK 的完整 Android 示例应用。

## 准备工作

通过 DooPush 后台创建应用，获取应用ID、API密钥、服务器地址。

## 快速开始

### 1. 运行应用
```bash
open DooPushSDKExample.xcodeproj
```

### 2. 修改配置
修改 `AppConfig.kt` 文件中的 `appId`、`apiKey`、`baseURL`。

### 3. 基本流程
1. 启动应用，SDK自动初始化
2. 点击"注册推送通知"并授权权限
3. 通过 DooPush 后台发送测试推送
4. 查看接收到的推送历史

## 代码结构

```
DooPushSDKExample/
├── DooPushApplication.kt          # 应用入口和SDK配置
├── AppConfig.kt                   # 应用配置
├── PushNotificationManager.kt     # 推送管理器
├── MainActivity.kt                # 主界面
└── ui/theme/                      # 主题配置
```

### 关键实现

**PushNotificationManager**: 实现推送状态管理、历史记录和SDK事件处理。

## 配置说明

📖 **详细配置指南**: 请查看 [PUSH_VENDOR_CONFIG.md](PUSH_VENDOR_CONFIG.md) 获取完整的厂商配置说明。

### 快速配置

### 1. 权限配置

在 `AndroidManifest.xml` 中已配置必要的权限：

```xml
<!-- 网络权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- 设备信息权限 -->
<uses-permission android:name="android.permission.READ_PHONE_STATE" />

<!-- 小米推送权限 -->
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

### 2. 小米推送配置

#### 获取小米推送配置

1. **注册小米开放平台账号**
   - 访问 [小米开放平台](https://dev.mi.com/)
   - 注册开发者账号

2. **创建应用**
   - 登录小米开放平台
   - 创建新应用，选择"推送服务"
   - 填写应用信息

3. **获取AppID和AppKey**
   - 在应用详情页面找到"推送服务"
   - 查看AppID和AppSecret
   - AppKey即为AppSecret

#### 配置到项目中

在 `AndroidManifest.xml` 的 `<application>` 标签中配置：

```xml
<!-- 小米推送配置 -->
<meta-data
    android:name="XIAOMI_APP_ID"
    android:value="你的小米AppID" />
<meta-data
    android:name="XIAOMI_APP_KEY"
    android:value="你的小米AppSecret" />
```

**注意：**
- 示例项目中使用了测试用的AppID和AppKey
- 生产环境必须使用你在小米开放平台申请的真实配置
- 确保应用的包名与小米开放平台配置一致

### 3. 其他厂商配置（预留）

```xml
<!-- 华为推送配置 -->
<meta-data
    android:name="HUAWEI_APP_ID"
    android:value="your_huawei_app_id" />
<meta-data
    android:name="HUAWEI_APP_KEY"
    android:value="your_huawei_app_key" />

<!-- OPPO推送配置 -->
<meta-data
    android:name="OPPO_APP_ID"
    android:value="your_oppo_app_id" />
<meta-data
    android:name="OPPO_APP_KEY"
    android:value="your_oppo_app_key" />

<!-- 其他厂商配置类似... -->
```

## 集成到你的应用

### 1. 添加依赖

在项目的 `build.gradle` 文件中添加：

```gradle
dependencies {
    implementation project(':DooPushSDK')
    // 或者使用 AAR 文件
    // implementation files('libs/DooPushSDK-1.0.0.aar')
}
```

### 2. 配置模块

在 `settings.gradle` 中添加：

```gradle
include(":app")
include(":DooPushSDK")
project(":DooPushSDK").projectDir = file("../DooPushSDK")
```

### 3. 创建 Application 类

```kotlin
class MyApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // 配置 DooPushSDK
        val config = DooPushConfig.development(
            appId = "your_app_id",
            apiKey = "your_api_key",
            baseURL = "http://localhost:5002/api/v1"
        )

        // 初始化 SDK
        DooPushManager.instance.initialize(this, config)

        // 添加事件监听器（可选）
        DooPushManager.instance.addListener(object : DooPushListener {
            override fun onDeviceRegistered(deviceToken: String) {
                Log.i("DooPush", "设备注册成功: $deviceToken")
            }

            override fun onMessageReceived(message: DooPushMessage) {
                Log.i("DooPush", "收到推送消息: ${message.title}")
            }

            override fun onError(error: DooPushError) {
                Log.e("DooPush", "错误: ${error.message}")
            }
        })
    }
}
```

### 4. 更新 AndroidManifest.xml

```xml
<application
    android:name=".MyApplication"
    android:allowBackup="true"
    android:dataExtractionRules="@xml/data_extraction_rules"
    android:fullBackupContent="@xml/backup_rules"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/Theme.MyApp"
    tools:targetApi="31">
```

## 主要功能

### 1. SDK 状态监控
- 实时显示 SDK 初始化状态
- 推送权限状态检查
- 错误信息实时显示

### 2. 设备信息展示
- 设备 Token 显示
- 设备 ID 显示
- TCP 连接状态
- 系统信息

### 3. 操作功能
- 注册推送通知
- 更新设备信息
- 重新注册推送
- 打开系统设置

### 4. 通知历史
- 接收到的推送消息历史
- 通知详情查看
- 历史记录管理

### 5. 设置页面
- SDK 配置信息
- 设备详细信息
- 调试信息
- 操作按钮

## 测试推送

1. 登录 DooPush 管理后台
2. 选择应用 > 推送配置 > 小米推送配置
3. 填写测试设备ID(Device Token)，点击发送测试推送。

## UI 特色

- 现代化的 Material Design 3 设计
- 响应式布局，支持不同屏幕尺寸
- 实时状态更新和动画效果
- Toast 提示和对话框交互
- 设置页面提供详细信息查看

## 技术要求

- Android API 21+ (Android 5.0+)
- Kotlin 1.8+
- Gradle 7.0+
- Compose BOM 2023.10.01+
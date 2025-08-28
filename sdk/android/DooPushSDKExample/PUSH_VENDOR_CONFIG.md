# Android 推送厂商配置指南

本文档详细说明如何为 Android DooPush SDK 配置各个推送厂商。

## 📱 支持的推送厂商

### ✅ 已实现厂商
- **小米推送** - 完全支持

### 🚧 预留接口（需要额外配置）
- **华为推送** (HMS)
- **OPPO推送**
- **VIVO推送**
- **魅族推送**
- **荣耀推送**
- **FCM推送**

## 🔧 小米推送配置

### 1. 注册小米开放平台

1. 访问 [小米开放平台](https://dev.mi.com/)
2. 注册开发者账号
3. 登录开发者控制台

### 2. 创建应用

1. 点击"创建应用"
2. 选择应用类型（Android应用）
3. 填写应用信息：
   - 应用名称
   - 包名（必须与你的Android应用包名一致）
   - 应用签名（用于验证）

### 3. 启用推送服务

1. 在应用详情页面，找到"推送服务"
2. 点击"启用"
3. 配置推送服务信息

### 4. 获取配置信息

1. 在推送服务页面，查看以下信息：
   - **AppID**: 应用的唯一标识符
   - **AppSecret**: 应用密钥（即AppKey）

### 5. 配置到应用中

在 `AndroidManifest.xml` 中添加：

```xml
<application>
    <!-- 小米推送配置 -->
    <meta-data
        android:name="XIAOMI_APP_ID"
        android:value="你的AppID" />
    <meta-data
        android:name="XIAOMI_APP_KEY"
        android:value="你的AppSecret" />
</application>
```

### 6. 获取应用签名

小米推送需要验证应用签名，你可以通过以下方式获取：

#### 方法1：使用Android Studio
1. 打开Android Studio
2. Build -> Generate Signed Bundle/APK
3. 选择APK或Bundle
4. 选择签名配置
5. 查看签名信息

#### 方法2：使用命令行
```bash
# 获取APK签名
keytool -printcert -jarfile your-app.apk

# 或者获取证书指纹
keytool -list -v -keystore your-keystore.jks
```

## 🔧 其他厂商配置

### 华为推送 (HMS)

1. **注册华为开发者联盟**
   - 访问 [华为开发者联盟](https://developer.huawei.com/)
   - 注册开发者账号

2. **创建应用**
   - 创建新应用
   - 启用Push Kit服务

3. **配置签名证书**
   - 上传应用的签名证书
   - 获取App ID和App Secret

4. **配置到应用中**
```xml
<meta-data
    android:name="HUAWEI_APP_ID"
    android:value="your_huawei_app_id" />
<meta-data
    android:name="HUAWEI_APP_KEY"
    android:value="your_huawei_app_secret" />
```

### OPPO 推送

1. **注册OPPO开放平台**
   - 访问 [OPPO开放平台](https://open.oppomobile.com/)
   - 注册开发者账号

2. **创建应用**
   - 创建新应用
   - 填写应用信息

3. **配置到应用中**
```xml
<meta-data
    android:name="OPPO_APP_ID"
    android:value="your_oppo_app_id" />
<meta-data
    android:name="OPPO_APP_KEY"
    android:value="your_oppo_app_key" />
```

### VIVO 推送

1. **注册VIVO开放平台**
   - 访问 [VIVO开放平台](https://dev.vivo.com/)
   - 注册开发者账号

2. **创建应用**
   - 创建新应用
   - 配置推送服务

3. **配置到应用中**
```xml
<meta-data
    android:name="VIVO_APP_ID"
    android:value="your_vivo_app_id" />
<meta-data
    android:name="VIVO_APP_KEY"
    android:value="your_vivo_app_key" />
```

## 🔍 故障排除

### "不支持的推送厂商: 没有可用的推送厂商"

**可能原因：**

1. **未配置厂商信息**
   - 检查AndroidManifest.xml中是否正确配置了厂商的AppID和AppKey
   - 确认配置的key名称是否正确

2. **设备厂商不匹配**
   - SDK会根据设备厂商自动选择推送服务
   - 如果你的测试设备不是小米设备，可能会出现此错误

3. **厂商服务未安装**
   - 小米设备需要安装小米推送服务
   - 检查设备上是否安装了相应厂商的推送服务

**解决方案：**

1. **确认配置正确性**
```xml
<!-- 检查配置是否正确 -->
<meta-data
    android:name="XIAOMI_APP_ID"
    android:value="2882303761520111111" />
<meta-data
    android:name="XIAOMI_APP_KEY"
    android:value="5112011111111" />
```

2. **使用正确的设备测试**
   - 小米推送需要在小米设备上测试
   - 或者使用小米模拟器

3. **查看日志输出**
   - 查看Android Studio的Logcat输出
   - 搜索"DooPush"相关的日志信息

### "厂商初始化失败"

**可能原因：**
1. AppID或AppKey配置错误
2. 应用签名不匹配
3. 网络连接问题

**解决方案：**
1. 确认AppID和AppKey正确
2. 验证应用签名配置
3. 检查网络连接

## 📊 厂商支持情况

| 厂商 | 状态 | 备注 |
|------|------|------|
| 小米 | ✅ 完全支持 | 需要小米设备或安装小米推送服务 |
| 华为 | 🚧 预留接口 | 需要额外实现 |
| OPPO | 🚧 预留接口 | 需要额外实现 |
| VIVO | 🚧 预留接口 | 需要额外实现 |
| 魅族 | 🚧 预留接口 | 需要额外实现 |
| 荣耀 | 🚧 预留接口 | 需要额外实现 |
| FCM | 🚧 预留接口 | Google Play Services可用时自动启用 |

## 🔄 设备厂商检测

SDK会根据设备信息自动检测支持的推送厂商：

- **小米设备**: 检测制造商或品牌包含"xiaomi"、"redmi"
- **华为设备**: 检测制造商或品牌包含"huawei"
- **OPPO设备**: 检测制造商或品牌包含"oppo"、"oneplus"
- **VIVO设备**: 检测制造商或品牌包含"vivo"、"iqoo"
- **魅族设备**: 检测制造商或品牌包含"meizu"
- **荣耀设备**: 检测制造商或品牌包含"honor"

如果检测到多个支持的厂商，会按优先级尝试初始化。

## 🎯 测试建议

1. **使用真实设备**: 在对应品牌的设备上测试效果最佳
2. **配置签名**: 确保应用签名与开放平台配置一致
3. **网络环境**: 确保设备可以访问推送服务
4. **权限检查**: 确保应用具有必要的权限

## 📞 技术支持

如果配置过程中遇到问题，请：

1. 查看Android Studio的Logcat日志
2. 确认配置信息是否正确
3. 检查设备和网络环境
4. 提交Issue描述问题

---

**注意**: 示例项目中的AppID和AppKey仅用于演示，请在生产环境中使用真实的配置信息。

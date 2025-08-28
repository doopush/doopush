# DooPush Android 通知渠道使用指南

## 概述

Android 8.0 (API level 26) 引入了通知渠道功能，允许用户更精细地控制应用的通知行为。DooPush SDK 现已集成完整的通知渠道管理功能，让开发者可以轻松创建和管理通知渠道。

## 功能特性

### ✅ 已实现功能

- 📱 **通知渠道管理** - 创建、删除、查询通知渠道
- 📂 **通知渠道分组** - 支持渠道分组管理
- ⚙️ **渠道配置** - 完整的渠道属性配置（重要性、声音、震动等）
- 🔍 **状态检查** - 检查渠道是否存在、是否被禁用
- 📊 **统计信息** - 获取渠道使用统计数据
- 🚀 **快速创建** - 预定义的渠道模板（默认、高重要性、静音、紧急）
- 🔗 **系统集成** - 跳转到系统通知设置页面
- 💾 **向下兼容** - 自动处理 Android 8.0 以下版本的兼容性

## 快速开始

### 1. 基础设置

确保 DooPush SDK 已正确初始化：

```kotlin
// 在 Application.onCreate() 中
val config = DooPushConfig.development(
    appId = "your_app_id",
    apiKey = "your_api_key"
)

DooPushManager.instance.initialize(application, config)
```

### 2. 检查支持状态

```kotlin
val dooPushManager = DooPushManager.instance

// 检查是否支持通知渠道功能 (Android 8.0+)
if (dooPushManager.isNotificationChannelSupported()) {
    // 设备支持通知渠道
    println("支持通知渠道功能")
} else {
    // 设备不支持，使用传统通知方式
    println("不支持通知渠道功能")
}
```

### 3. 创建基本通知渠道

```kotlin
import com.doopush.sdk.notification.DooPushNotificationChannel

// 创建默认渠道
val defaultChannel = DooPushNotificationChannel.createDefault()
val result = dooPushManager.createNotificationChannel(defaultChannel)

// 创建高重要性渠道
val importantChannel = DooPushNotificationChannel.createHighImportance(
    id = "important_messages",
    name = "重要消息",
    description = "重要的推送通知"
)
dooPushManager.createNotificationChannel(importantChannel)

// 创建静音渠道
val silentChannel = DooPushNotificationChannel.createSilent(
    id = "background_sync",
    name = "后台同步",
    description = "后台数据同步通知"
)
dooPushManager.createNotificationChannel(silentChannel)
```

### 4. 创建自定义通知渠道

```kotlin
val customChannel = DooPushNotificationChannel(
    id = "custom_notifications",
    name = "自定义通知",
    description = "这是一个自定义的通知渠道",
    importance = NotificationManager.IMPORTANCE_DEFAULT,
    enableVibration = true,
    enableLights = true,
    lightColor = 0xFF0000FF.toInt(), // 蓝色指示灯
    vibrationPattern = longArrayOf(0, 500, 250, 500), // 自定义震动模式
    showBadge = true,
    soundUri = null // 使用默认声音
)

val result = dooPushManager.createNotificationChannel(customChannel)
if (result) {
    println("自定义渠道创建成功")
} else {
    println("自定义渠道创建失败")
}
```

## 高级功能

### 1. 创建通知渠道分组

```kotlin
import com.doopush.sdk.notification.DooPushNotificationChannelGroup

// 创建系统分组
val systemGroup = DooPushNotificationChannelGroup.createSystemGroup()
dooPushManager.createNotificationChannelGroup(systemGroup)

// 创建自定义分组
val customGroup = DooPushNotificationChannelGroup(
    id = "social_media",
    name = "社交媒体",
    description = "社交媒体相关通知"
)
dooPushManager.createNotificationChannelGroup(customGroup)

// 创建属于分组的渠道
val socialChannel = DooPushNotificationChannel(
    id = "friend_messages",
    name = "好友消息",
    description = "好友聊天消息",
    importance = NotificationManager.IMPORTANCE_HIGH,
    groupId = "social_media" // 指定分组
)
dooPushManager.createNotificationChannel(socialChannel)
```

### 2. 批量创建通知渠道

```kotlin
val channels = listOf(
    DooPushNotificationChannel.createDefault(),
    DooPushNotificationChannel.createHighImportance(
        "alerts", "警报", "重要警报通知"
    ),
    DooPushNotificationChannel.createSilent(
        "updates", "更新", "应用更新通知"
    )
)

val successCount = dooPushManager.createNotificationChannels(channels)
println("成功创建 $successCount/${channels.size} 个通知渠道")
```

### 3. 检查和管理现有渠道

```kotlin
// 检查渠道是否存在
val channelExists = dooPushManager.isNotificationChannelExists("important_messages")

// 检查渠道是否被用户禁用
val isBlocked = dooPushManager.isNotificationChannelBlocked("important_messages")

// 获取所有通知渠道
val allChannels = dooPushManager.getAllNotificationChannels()
println("当前共有 ${allChannels.size} 个通知渠道")

// 获取所有分组
val allGroups = dooPushManager.getAllNotificationChannelGroups()
println("当前共有 ${allGroups.size} 个通知渠道分组")

// 获取统计信息
val stats = dooPushManager.getNotificationChannelStats()
stats.forEach { (key, value) ->
    println("$key: $value")
}
```

### 4. 打开系统设置

```kotlin
// 打开应用的通知设置页面
dooPushManager.openNotificationSettings()

// 打开特定渠道的设置页面
dooPushManager.openNotificationChannelSettings("important_messages")
```

### 5. 删除通知渠道

```kotlin
// 删除单个渠道
val deleteResult = dooPushManager.deleteNotificationChannel("old_channel")

// 删除渠道分组（会同时删除分组下的所有渠道）
val deleteGroupResult = dooPushManager.deleteNotificationChannelGroup("old_group")

// 注意：删除渠道是永久性的，用户需要重新安装应用或清除应用数据才能恢复
```

## 最佳实践

### 1. 初始化时机

建议在应用首次启动时创建所有需要的通知渠道：

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // 初始化 DooPush SDK
        val config = DooPushConfig.development(...)
        DooPushManager.instance.initialize(this, config)
        
        // 延迟创建通知渠道，确保 SDK 完全初始化
        Handler(Looper.getMainLooper()).postDelayed({
            initializeNotificationChannels()
        }, 1000)
    }
    
    private fun initializeNotificationChannels() {
        val dooPushManager = DooPushManager.instance
        
        if (dooPushManager.isNotificationChannelSupported()) {
            // 创建默认渠道
            createDefaultChannels(dooPushManager)
            
            // 创建业务相关渠道
            createBusinessChannels(dooPushManager)
        }
    }
}
```

### 2. 渠道命名规范

```kotlin
// 推荐的渠道 ID 命名规范
const val CHANNEL_DEFAULT = "doopush_default"
const val CHANNEL_IMPORTANT = "doopush_important"
const val CHANNEL_CHAT = "chat_messages"
const val CHANNEL_SYSTEM = "system_notifications"
const val CHANNEL_PROMOTION = "promotions"
const val CHANNEL_BACKGROUND = "background_sync"

// 推荐的分组 ID 命名规范
const val GROUP_PERSONAL = "personal"
const val GROUP_WORK = "work"
const val GROUP_SYSTEM = "system"
```

### 3. 渠道重要性级别选择

```kotlin
// 根据消息类型选择合适的重要性级别
when (messageType) {
    "emergency" -> NotificationManager.IMPORTANCE_MAX    // 紧急：会发出声音并弹出
    "chat" -> NotificationManager.IMPORTANCE_HIGH        // 高：发出声音
    "news" -> NotificationManager.IMPORTANCE_DEFAULT     // 默认：发出声音
    "promotion" -> NotificationManager.IMPORTANCE_LOW    // 低：不发出声音
    "background" -> NotificationManager.IMPORTANCE_MIN   // 最小：不发出声音，不显示在状态栏
}
```

### 4. 用户体验优化

```kotlin
// 检查重要渠道是否被禁用，提醒用户开启
fun checkImportantChannelsAndPromptUser(context: Context) {
    val dooPushManager = DooPushManager.instance
    val importantChannels = listOf("doopush_important", "chat_messages", "system_notifications")
    
    val blockedChannels = importantChannels.filter { channelId ->
        dooPushManager.isNotificationChannelExists(channelId) &&
        dooPushManager.isNotificationChannelBlocked(channelId)
    }
    
    if (blockedChannels.isNotEmpty()) {
        // 显示提示对话框
        AlertDialog.Builder(context)
            .setTitle("通知权限提醒")
            .setMessage("检测到重要通知渠道被禁用，可能会错过重要消息，是否前往设置开启？")
            .setPositiveButton("去设置") { _, _ ->
                dooPushManager.openNotificationSettings()
            }
            .setNegativeButton("稍后", null)
            .show()
    }
}
```

## 推送消息中指定渠道

### 1. 在推送消息中指定渠道 ID

```kotlin
// DooPushMessage 已经支持 channelId 字段
val message = DooPushMessageBuilder()
    .messageId("msg_001")
    .title("重要通知")
    .content("这是一条重要消息")
    .channelId("doopush_important") // 指定使用的通知渠道
    .build()

// SDK 会自动使用指定的渠道显示通知
dooPushManager.handlePushMessage(message)
```

### 2. 动态选择渠道

```kotlin
fun getChannelIdForMessage(messageType: String, priority: String): String {
    return when {
        messageType == "emergency" -> "emergency_alerts"
        messageType == "chat" -> "chat_messages"
        messageType == "system" && priority == "high" -> "doopush_important"
        messageType == "promotion" -> "promotions"
        else -> "doopush_default"
    }
}
```

## 示例应用

项目中提供了完整的示例应用，展示了通知渠道的各种用法：

1. **NotificationChannelExample.kt** - 完整的功能演示类
2. **NotificationChannelActivity.kt** - 专门的通知渠道管理界面
3. **MainActivity.kt** - 集成了通知渠道管理入口

运行示例应用后，可以通过"通知渠道管理"按钮进入专门的管理界面，体验各种通知渠道功能。

## 常见问题

### Q: 如何处理 Android 8.0 以下版本？

A: SDK 会自动处理版本兼容性。在不支持通知渠道的设备上，所有渠道相关操作会安全地被忽略，使用传统的通知方式。

```kotlin
// SDK 内部会自动检查版本
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    // 使用通知渠道
} else {
    // 使用传统通知方式
}
```

### Q: 用户禁用了通知渠道怎么办？

A: 可以通过检查渠道状态来提醒用户：

```kotlin
if (dooPushManager.isNotificationChannelBlocked("important_channel")) {
    // 提醒用户开启重要通知
    showChannelDisabledPrompt()
}
```

### Q: 如何更新已存在的通知渠道？

A: 通知渠道一旦创建，其重要性级别等关键属性就不能被应用修改，只能由用户在系统设置中修改。如果需要更改，只能删除旧渠道并创建新渠道，但这会导致用户之前的设置丢失。

### Q: 应该创建多少个通知渠道？

A: 建议根据实际需求创建渠道，不要过多也不要过少：
- 太少：用户无法精细控制
- 太多：用户设置复杂，体验不佳
- 建议：3-8 个渠道比较合适

### Q: 通知渠道分组有什么用？

A: 分组主要用于：
1. **多账号应用** - 为每个账号创建独立分组
2. **功能分类** - 将相关功能的渠道归为一组
3. **提升用户体验** - 让设置界面更加整洁有序

## 技术支持

如果您在使用过程中遇到问题，可以：

1. 查看 SDK 日志输出
2. 检查 Android 版本兼容性
3. 确认通知权限已授权
4. 参考示例应用的实现

更多技术支持请联系 DooPush 团队。

package com.doopush.sdk.notification

import android.app.NotificationChannel
import android.app.NotificationChannelGroup
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi
import com.doopush.sdk.internal.DooPushLogger
import java.util.concurrent.CopyOnWriteArrayList

/**
 * DooPush 通知渠道管理器
 * 负责创建、管理和删除通知渠道
 */
class DooPushNotificationChannelManager(private val context: Context) {
    
    private val notificationManager: NotificationManager by lazy {
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }
    
    private val registeredChannels = CopyOnWriteArrayList<String>()
    private val registeredGroups = CopyOnWriteArrayList<String>()
    
    /**
     * 检查是否支持通知渠道（Android 8.0+）
     */
    fun isNotificationChannelSupported(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
    }
    
    /**
     * 创建通知渠道
     */
    fun createNotificationChannel(channelConfig: DooPushNotificationChannel): Boolean {
        if (!isNotificationChannelSupported()) {
            DooPushLogger.warning("当前Android版本不支持通知渠道功能")
            return false
        }
        
        return try {
            createNotificationChannelInternal(channelConfig)
            true
        } catch (e: Exception) {
            DooPushLogger.error("创建通知渠道失败: $e")
            false
        }
    }
    
    /**
     * 批量创建通知渠道
     */
    fun createNotificationChannels(channelConfigs: List<DooPushNotificationChannel>): Int {
        if (!isNotificationChannelSupported()) {
            DooPushLogger.warning("当前Android版本不支持通知渠道功能")
            return 0
        }
        
        var successCount = 0
        for (config in channelConfigs) {
            if (createNotificationChannel(config)) {
                successCount++
            }
        }
        
        DooPushLogger.info("批量创建通知渠道完成，成功: $successCount，总数: ${channelConfigs.size}")
        return successCount
    }
    
    /**
     * 创建通知渠道分组
     */
    fun createNotificationChannelGroup(groupConfig: DooPushNotificationChannelGroup): Boolean {
        if (!isNotificationChannelSupported()) {
            DooPushLogger.warning("当前Android版本不支持通知渠道功能")
            return false
        }
        
        return try {
            createNotificationChannelGroupInternal(groupConfig)
            true
        } catch (e: Exception) {
            DooPushLogger.error("创建通知渠道分组失败: $e")
            false
        }
    }
    
    /**
     * 删除通知渠道
     */
    fun deleteNotificationChannel(channelId: String): Boolean {
        if (!isNotificationChannelSupported()) {
            DooPushLogger.warning("当前Android版本不支持通知渠道功能")
            return false
        }
        
        return try {
            notificationManager.deleteNotificationChannel(channelId)
            registeredChannels.remove(channelId)
            DooPushLogger.info("通知渠道已删除: $channelId")
            true
        } catch (e: Exception) {
            DooPushLogger.error("删除通知渠道失败: $e")
            false
        }
    }
    
    /**
     * 删除通知渠道分组
     */
    fun deleteNotificationChannelGroup(groupId: String): Boolean {
        if (!isNotificationChannelSupported()) {
            DooPushLogger.warning("当前Android版本不支持通知渠道功能")
            return false
        }
        
        return try {
            notificationManager.deleteNotificationChannelGroup(groupId)
            registeredGroups.remove(groupId)
            DooPushLogger.info("通知渠道分组已删除: $groupId")
            true
        } catch (e: Exception) {
            DooPushLogger.error("删除通知渠道分组失败: $e")
            false
        }
    }
    
    /**
     * 获取通知渠道信息
     */
    fun getNotificationChannel(channelId: String): NotificationChannel? {
        if (!isNotificationChannelSupported()) {
            return null
        }
        
        return try {
            notificationManager.getNotificationChannel(channelId)
        } catch (e: Exception) {
            DooPushLogger.error("获取通知渠道信息失败: $e")
            null
        }
    }
    
    /**
     * 获取所有通知渠道
     */
    fun getAllNotificationChannels(): List<NotificationChannel> {
        if (!isNotificationChannelSupported()) {
            return emptyList()
        }
        
        return try {
            notificationManager.notificationChannels ?: emptyList()
        } catch (e: Exception) {
            DooPushLogger.error("获取所有通知渠道失败: $e")
            emptyList()
        }
    }
    
    /**
     * 获取所有通知渠道分组
     */
    fun getAllNotificationChannelGroups(): List<NotificationChannelGroup> {
        if (!isNotificationChannelSupported()) {
            return emptyList()
        }
        
        return try {
            notificationManager.notificationChannelGroups ?: emptyList()
        } catch (e: Exception) {
            DooPushLogger.error("获取所有通知渠道分组失败: $e")
            emptyList()
        }
    }
    
    /**
     * 检查通知渠道是否存在
     */
    fun isChannelExists(channelId: String): Boolean {
        return getNotificationChannel(channelId) != null
    }
    
    /**
     * 检查通知渠道是否被用户禁用
     */
    fun isChannelBlocked(channelId: String): Boolean {
        if (!isNotificationChannelSupported()) {
            return false
        }
        
        val channel = getNotificationChannel(channelId)
        return channel?.importance == NotificationManager.IMPORTANCE_NONE
    }
    
    /**
     * 获取已注册的渠道ID列表
     */
    fun getRegisteredChannelIds(): List<String> {
        return registeredChannels.toList()
    }
    
    /**
     * 获取已注册的分组ID列表
     */
    fun getRegisteredGroupIds(): List<String> {
        return registeredGroups.toList()
    }
    
    /**
     * 初始化默认通知渠道
     */
    fun initializeDefaultChannels() {
        if (!isNotificationChannelSupported()) {
            return
        }
        
        try {
            // 创建默认渠道
            val defaultChannel = DooPushNotificationChannel.createDefault()
            createNotificationChannel(defaultChannel)
            
            // 创建高重要性渠道
            val importantChannel = DooPushNotificationChannel.createHighImportance(
                id = "doopush_important",
                name = "重要通知",
                description = "紧急和重要的推送通知"
            )
            createNotificationChannel(importantChannel)
            
            // 创建静音渠道
            val silentChannel = DooPushNotificationChannel.createSilent(
                id = "doopush_silent",
                name = "静音通知",
                description = "不会发出声音和震动的通知"
            )
            createNotificationChannel(silentChannel)
            
            DooPushLogger.info("默认通知渠道初始化完成")
            
        } catch (e: Exception) {
            DooPushLogger.error("初始化默认通知渠道失败: $e")
        }
    }
    
    /**
     * 打开系统通知设置页面
     */
    fun openNotificationSettings() {
        try {
            val intent = android.content.Intent().apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    action = android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS
                    putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
                } else {
                    action = android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                    data = android.net.Uri.parse("package:${context.packageName}")
                }
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            DooPushLogger.error("打开通知设置页面失败: $e")
        }
    }
    
    /**
     * 打开特定渠道的设置页面
     */
    fun openChannelSettings(channelId: String) {
        if (!isNotificationChannelSupported()) {
            openNotificationSettings()
            return
        }
        
        try {
            val intent = android.content.Intent(android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
                putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
                putExtra(android.provider.Settings.EXTRA_CHANNEL_ID, channelId)
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            DooPushLogger.error("打开渠道设置页面失败: $e")
            openNotificationSettings()
        }
    }
    
    /**
     * 获取通知渠道使用统计
     */
    fun getChannelStats(): Map<String, Any> {
        val stats = mutableMapOf<String, Any>()
        
        try {
            stats["notification_channels_supported"] = isNotificationChannelSupported()
            stats["registered_channels_count"] = registeredChannels.size
            stats["registered_groups_count"] = registeredGroups.size
            
            if (isNotificationChannelSupported()) {
                val allChannels = getAllNotificationChannels()
                val allGroups = getAllNotificationChannelGroups()
                
                stats["total_channels_count"] = allChannels.size
                stats["total_groups_count"] = allGroups.size
                
                // 统计各重要性级别的渠道数量
                val importanceCount = mutableMapOf<String, Int>()
                for (channel in allChannels) {
                    val importance = NotificationImportance.fromValue(channel.importance)
                    importanceCount[importance.displayName] = importanceCount.getOrDefault(importance.displayName, 0) + 1
                }
                stats["channels_by_importance"] = importanceCount
                
                // 统计被禁用的渠道
                val blockedChannels = allChannels.filter { it.importance == NotificationManager.IMPORTANCE_NONE }
                stats["blocked_channels_count"] = blockedChannels.size
                stats["blocked_channel_ids"] = blockedChannels.map { it.id }
            }
            
        } catch (e: Exception) {
            DooPushLogger.error("获取通知渠道统计失败: $e")
            stats["error"] = e.message ?: "unknown error"
        }
        
        return stats
    }
    
    // MARK: - 私有方法
    
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createNotificationChannelInternal(channelConfig: DooPushNotificationChannel) {
        val channel = NotificationChannel(
            channelConfig.id,
            channelConfig.name,
            channelConfig.importance
        ).apply {
            description = channelConfig.description
            setShowBadge(channelConfig.showBadge)
            enableVibration(channelConfig.enableVibration)
            enableLights(channelConfig.enableLights)
            lockscreenVisibility = channelConfig.lockscreenVisibility
            
            channelConfig.vibrationPattern?.let { vibrationPattern = it }
            channelConfig.lightColor?.let { lightColor = it }
            channelConfig.soundUri?.let { setSound(it, channelConfig.audioAttributes) }
            channelConfig.groupId?.let { group = it }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                setBypassDnd(channelConfig.bypassDnd)
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                channelConfig.conversationId?.let { conversationId ->
                    // 这里需要额外的对话相关设置
                }
            }
        }
        
        notificationManager.createNotificationChannel(channel)
        registeredChannels.add(channelConfig.id)
        
        DooPushLogger.info("通知渠道已创建: ${channelConfig.id} - ${channelConfig.name}")
    }
    
    @RequiresApi(Build.VERSION_CODES.O)
    private fun createNotificationChannelGroupInternal(groupConfig: DooPushNotificationChannelGroup) {
        val group = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            NotificationChannelGroup(groupConfig.id, groupConfig.name).apply {
                description = groupConfig.description
            }
        } else {
            NotificationChannelGroup(groupConfig.id, groupConfig.name)
        }
        
        notificationManager.createNotificationChannelGroup(group)
        registeredGroups.add(groupConfig.id)
        
        DooPushLogger.info("通知渠道分组已创建: ${groupConfig.id} - ${groupConfig.name}")
    }
}

package com.doopush.sdk.notification

import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.annotation.RequiresApi

/**
 * DooPush 通知渠道配置类
 * 封装了 Android 通知渠道的创建和管理
 */
data class DooPushNotificationChannel(
    /**
     * 渠道ID（在应用包内必须唯一）
     */
    val id: String,
    
    /**
     * 渠道名称（用户可见）
     */
    val name: String,
    
    /**
     * 渠道描述（用户可见）
     */
    val description: String? = null,
    
    /**
     * 重要性级别
     * NotificationManager.IMPORTANCE_NONE = 0
     * NotificationManager.IMPORTANCE_MIN = 1
     * NotificationManager.IMPORTANCE_LOW = 2
     * NotificationManager.IMPORTANCE_DEFAULT = 3
     * NotificationManager.IMPORTANCE_HIGH = 4
     * NotificationManager.IMPORTANCE_MAX = 5
     */
    val importance: Int = NotificationManager.IMPORTANCE_DEFAULT,
    
    /**
     * 是否显示角标
     */
    val showBadge: Boolean = true,
    
    /**
     * 是否启用震动
     */
    val enableVibration: Boolean = true,
    
    /**
     * 震动模式
     */
    val vibrationPattern: LongArray? = null,
    
    /**
     * 是否启用指示灯
     */
    val enableLights: Boolean = true,
    
    /**
     * 指示灯颜色
     */
    val lightColor: Int? = null,
    
    /**
     * 锁屏可见性
     * NotificationCompat.VISIBILITY_PUBLIC = 1
     * NotificationCompat.VISIBILITY_PRIVATE = 0
     * NotificationCompat.VISIBILITY_SECRET = -1
     */
    val lockscreenVisibility: Int = 1, // VISIBILITY_PUBLIC
    
    /**
     * 通知声音URI
     */
    val soundUri: Uri? = null,
    
    /**
     * 音频属性
     */
    val audioAttributes: AudioAttributes? = null,
    
    /**
     * 渠道分组ID
     */
    val groupId: String? = null,
    
    /**
     * 是否绕过免打扰模式
     */
    val bypassDnd: Boolean = false,
    
    /**
     * 对话快捷方式ID
     */
    val conversationId: String? = null,
    
    /**
     * 是否为重要对话
     */
    val isImportantConversation: Boolean = false
) {
    
    companion object {
        /**
         * 创建默认渠道
         */
        fun createDefault(): DooPushNotificationChannel {
            return DooPushNotificationChannel(
                id = "doopush_default",
                name = "默认通知",
                description = "应用的默认通知渠道",
                importance = NotificationManager.IMPORTANCE_DEFAULT
            )
        }
        
        /**
         * 创建高重要性渠道
         */
        fun createHighImportance(id: String, name: String, description: String? = null): DooPushNotificationChannel {
            return DooPushNotificationChannel(
                id = id,
                name = name,
                description = description,
                importance = NotificationManager.IMPORTANCE_HIGH,
                enableVibration = true,
                enableLights = true
            )
        }
        
        /**
         * 创建低重要性渠道
         */
        fun createLowImportance(id: String, name: String, description: String? = null): DooPushNotificationChannel {
            return DooPushNotificationChannel(
                id = id,
                name = name,
                description = description,
                importance = NotificationManager.IMPORTANCE_LOW,
                enableVibration = false,
                enableLights = false,
                showBadge = false
            )
        }
        
        /**
         * 创建静音渠道
         */
        fun createSilent(id: String, name: String, description: String? = null): DooPushNotificationChannel {
            return DooPushNotificationChannel(
                id = id,
                name = name,
                description = description,
                importance = NotificationManager.IMPORTANCE_LOW,
                enableVibration = false,
                enableLights = false,
                soundUri = null,
                showBadge = true
            )
        }
        
        /**
         * 创建紧急渠道
         */
        fun createUrgent(id: String, name: String, description: String? = null): DooPushNotificationChannel {
            return DooPushNotificationChannel(
                id = id,
                name = name,
                description = description,
                importance = NotificationManager.IMPORTANCE_MAX,
                enableVibration = true,
                vibrationPattern = longArrayOf(0, 500, 250, 500),
                enableLights = true,
                bypassDnd = true
            )
        }
    }
}

/**
 * DooPush 通知渠道分组配置类
 */
data class DooPushNotificationChannelGroup(
    /**
     * 分组ID（在应用包内必须唯一）
     */
    val id: String,
    
    /**
     * 分组名称（用户可见）
     */
    val name: String,
    
    /**
     * 分组描述（用户可见）
     */
    val description: String? = null
) {
    
    companion object {
        /**
         * 创建个人账号分组
         */
        fun createPersonalGroup(): DooPushNotificationChannelGroup {
            return DooPushNotificationChannelGroup(
                id = "personal",
                name = "个人",
                description = "个人账号相关通知"
            )
        }
        
        /**
         * 创建工作账号分组
         */
        fun createWorkGroup(): DooPushNotificationChannelGroup {
            return DooPushNotificationChannelGroup(
                id = "work",
                name = "工作",
                description = "工作账号相关通知"
            )
        }
        
        /**
         * 创建系统分组
         */
        fun createSystemGroup(): DooPushNotificationChannelGroup {
            return DooPushNotificationChannelGroup(
                id = "system",
                name = "系统",
                description = "系统通知和重要消息"
            )
        }
    }
}

/**
 * 通知渠道重要性级别枚举
 */
enum class NotificationImportance(val value: Int, val displayName: String) {
    NONE(NotificationManager.IMPORTANCE_NONE, "无"),
    MIN(NotificationManager.IMPORTANCE_MIN, "最低"),
    LOW(NotificationManager.IMPORTANCE_LOW, "低"),
    DEFAULT(NotificationManager.IMPORTANCE_DEFAULT, "默认"),
    HIGH(NotificationManager.IMPORTANCE_HIGH, "高"),
    MAX(NotificationManager.IMPORTANCE_MAX, "紧急");
    
    companion object {
        fun fromValue(value: Int): NotificationImportance {
            return values().find { it.value == value } ?: DEFAULT
        }
    }
}

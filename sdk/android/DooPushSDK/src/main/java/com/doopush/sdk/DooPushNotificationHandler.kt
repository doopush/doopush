package com.doopush.sdk

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.doopush.sdk.models.PushMessage
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

/**
 * DooPush 推送通知处理器
 * 
 * 负责处理推送通知的各种事件，包括接收、点击、打开等
 * 参考iOS SDK的实现，提供统一的推送事件处理机制
 */
object DooPushNotificationHandler {
    
    private const val TAG = "NotificationHandler"
    
    // Intent extra 键名
    private const val EXTRA_PUSH_LOG_ID = "push_log_id"
    private const val EXTRA_DEDUP_KEY = "dedup_key"
    private const val EXTRA_PUSH_TITLE = "push_title"
    private const val EXTRA_PUSH_BODY = "push_body"
    private const val EXTRA_PUSH_DATA_PREFIX = "push_data_"
    private const val EXTRA_NOTIFICATION_CLICKED = "doopush_notification_clicked"
    
    /**
     * 推送通知数据结构
     * 对应iOS SDK的DooPushNotificationData
     */
    data class NotificationData(
        @SerializedName("push_id")
        val pushId: String? = null,
        
        @SerializedName("push_log_id") 
        val pushLogId: String? = null,
        
        @SerializedName("dedup_key")
        val dedupKey: String? = null,
        
        @SerializedName("title")
        val title: String? = null,
        
        @SerializedName("body")
        val body: String? = null,
        
        @SerializedName("payload")
        val payload: Map<String, Any> = emptyMap(),
        
        @SerializedName("badge")
        val badge: Int? = null,
        
        @SerializedName("sound")
        val sound: String? = null,
        
        @SerializedName("raw_data")
        val rawData: Map<String, Any> = emptyMap()
    ) {
        
        companion object {
            /**
             * 从FCM RemoteMessage创建NotificationData
             */
            fun fromPushMessage(pushMessage: PushMessage): NotificationData {
                return NotificationData(
                    pushId = pushMessage.pushId,
                    pushLogId = pushMessage.pushLogId,
                    dedupKey = pushMessage.dedupKey,
                    title = pushMessage.title,
                    body = pushMessage.body,
                    payload = pushMessage.data.mapValues { it.value as Any }, // 类型转换
                    rawData = pushMessage.rawData
                )
            }
            
            /**
             * 从Intent创建NotificationData
             */
            fun fromIntent(intent: Intent): NotificationData? {
                return try {
                    val extras = intent.extras ?: return null
                    
                    // 检查是否是推送点击意图
                    if (!extras.getBoolean(EXTRA_NOTIFICATION_CLICKED, false)) {
                        return null
                    }
                    
                    // 提取推送数据
                    val payload = mutableMapOf<String, Any>()
                    for (key in extras.keySet()) {
                        if (key.startsWith(EXTRA_PUSH_DATA_PREFIX)) {
                            val dataKey = key.removePrefix(EXTRA_PUSH_DATA_PREFIX)
                            val value = extras.get(key)
                            if (value != null) {
                                payload[dataKey] = value
                            }
                        }
                    }
                    
                    NotificationData(
                        pushLogId = extras.getString(EXTRA_PUSH_LOG_ID),
                        dedupKey = extras.getString(EXTRA_DEDUP_KEY),
                        title = extras.getString(EXTRA_PUSH_TITLE),
                        body = extras.getString(EXTRA_PUSH_BODY),
                        payload = payload
                    )
                } catch (e: Exception) {
                    Log.e(TAG, "解析Intent中的推送数据失败", e)
                    null
                }
            }
        }
        
        /**
         * 获取用于显示的内容
         */
        fun getDisplayContent(): String {
            return body ?: title ?: "推送消息"
        }
    }
    
    /**
     * 处理推送通知接收事件
     * 对应iOS SDK的handleNotification
     */
    fun handleNotification(pushMessage: PushMessage): Boolean {
        try {
            val notificationData = NotificationData.fromPushMessage(pushMessage)
            Log.d(TAG, "处理推送通知接收: ${notificationData.title}")
            
            // 记录推送接收统计
            recordNotificationReceived(notificationData)
            
            // 通知DooPushManager
            val manager = DooPushManager.getInstance()
            if (DooPushManager.isInitialized()) {
                // 通过现有的回调机制传递消息
                manager.getInternalCallback()?.onMessageReceived(pushMessage)
            }
            
            return true
        } catch (e: Exception) {
            Log.e(TAG, "处理推送通知接收失败", e)
            return false
        }
    }
    
    /**
     * 处理推送通知点击事件
     * 对应iOS SDK的handleNotificationClick
     */
    fun handleNotificationClick(context: Context, intent: Intent): Boolean {
        try {
            val notificationData = NotificationData.fromIntent(intent)
            if (notificationData == null) {
                Log.d(TAG, "Intent中无推送点击数据")
                return false
            }
            
            Log.d(TAG, "处理推送通知点击: ${notificationData.title}")
            
            // 记录推送点击统计
            recordNotificationClick(notificationData)
            
            // 通知DooPushManager
            val manager = DooPushManager.getInstance()
            if (DooPushManager.isInitialized()) {
                manager.getInternalCallback()?.onNotificationClick(notificationData)
            }
            
            return true
        } catch (e: Exception) {
            Log.e(TAG, "处理推送通知点击失败", e)
            return false
        }
    }
    
    /**
     * 处理推送通知打开事件
     * 对应iOS SDK的handleNotificationOpen
     */
    fun handleNotificationOpen(context: Context, intent: Intent): Boolean {
        try {
            val notificationData = NotificationData.fromIntent(intent)
            if (notificationData == null) {
                Log.d(TAG, "Intent中无推送打开数据")
                return false
            }
            
            Log.d(TAG, "处理推送通知打开: ${notificationData.title}")
            
            // 记录推送打开统计
            recordNotificationOpen(notificationData)
            
            // 通知DooPushManager
            val manager = DooPushManager.getInstance()
            if (DooPushManager.isInitialized()) {
                manager.getInternalCallback()?.onNotificationOpen(notificationData)
            }
            
            return true
        } catch (e: Exception) {
            Log.e(TAG, "处理推送通知打开失败", e)
            return false
        }
    }
    
    /**
     * 检查Intent是否包含推送点击数据
     */
    fun isNotificationClickIntent(intent: Intent?): Boolean {
        if (intent?.extras == null) return false
        return intent.extras!!.getBoolean(EXTRA_NOTIFICATION_CLICKED, false)
    }
    
    /**
     * 向Intent添加推送点击标记
     * 在FirebaseMessagingService中调用
     */
    fun addNotificationClickData(intent: Intent, pushMessage: PushMessage) {
        try {
            intent.apply {
                // 添加点击标记
                putExtra(EXTRA_NOTIFICATION_CLICKED, true)
                
                // 添加推送消息数据
                pushMessage.pushLogId?.let { putExtra(EXTRA_PUSH_LOG_ID, it) }
                pushMessage.dedupKey?.let { putExtra(EXTRA_DEDUP_KEY, it) }
                pushMessage.title?.let { putExtra(EXTRA_PUSH_TITLE, it) }
                pushMessage.body?.let { putExtra(EXTRA_PUSH_BODY, it) }
                
                // 添加自定义数据（FCM data都是String类型）
                for ((key, value) in pushMessage.data) {
                    putExtra("${EXTRA_PUSH_DATA_PREFIX}$key", value)
                }
            }
            
            Log.d(TAG, "已添加推送点击数据到Intent")
        } catch (e: Exception) {
            Log.e(TAG, "添加推送点击数据失败", e)
        }
    }
    
    // MARK: - 统计功能
    
    /**
     * 记录推送接收统计
     */
    private fun recordNotificationReceived(notificationData: NotificationData) {
        try {
            DooPushStatistics.recordNotificationReceived(notificationData)
        } catch (e: Exception) {
            Log.e(TAG, "记录推送接收统计失败", e)
        }
    }
    
    /**
     * 记录推送点击统计
     */
    private fun recordNotificationClick(notificationData: NotificationData) {
        try {
            DooPushStatistics.recordNotificationClick(notificationData)
        } catch (e: Exception) {
            Log.e(TAG, "记录推送点击统计失败", e)
        }
    }
    
    /**
     * 记录推送打开统计
     */
    private fun recordNotificationOpen(notificationData: NotificationData) {
        try {
            DooPushStatistics.recordNotificationOpen(notificationData)
        } catch (e: Exception) {
            Log.e(TAG, "记录推送打开统计失败", e)
        }
    }
}

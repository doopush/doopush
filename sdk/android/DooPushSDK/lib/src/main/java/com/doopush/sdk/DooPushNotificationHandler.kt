package com.doopush.sdk

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.app.NotificationManager
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
                    if (!isClickFlagSet(extras)) {
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
            dispatchClick(notificationData)
            return true
        } catch (e: Exception) {
            Log.e(TAG, "处理推送通知点击失败", e)
            return false
        }
    }

    /**
     * 分发厂商推送接收器回调的通知点击（小米、OPPO、vivo、荣耀、魅族）
     * 与点击中转页共用暂存补发与去重逻辑
     */
    internal fun dispatchVendorClick(notificationData: NotificationData) {
        Log.d(TAG, "处理厂商通知点击: ${notificationData.title}")
        dispatchClick(notificationData)
    }

    // 冷启动点击时 SDK 尚未配置或宿主尚未设置回调：暂存最近一次点击，就绪后补发
    private var pendingClick: NotificationData? = null

    // 同一条推送的点击可能同时经点击中转页与厂商接收器到达，短时间内只分发一次
    private const val CLICK_DEDUP_WINDOW_MS = 10_000L
    private var lastClickKey: String? = null
    private var lastClickAt = 0L

    private fun isDuplicateClick(notificationData: NotificationData): Boolean {
        val key = notificationData.pushLogId?.takeIf { it.isNotEmpty() }
            ?: notificationData.dedupKey?.takeIf { it.isNotEmpty() }
            ?: return false
        val now = SystemClock.elapsedRealtime()
        if (key == lastClickKey && now - lastClickAt < CLICK_DEDUP_WINDOW_MS) {
            return true
        }
        lastClickKey = key
        lastClickAt = now
        return false
    }

    private fun dispatchClick(notificationData: NotificationData, checkDuplicate: Boolean = true) {
        synchronized(this) {
            if (checkDuplicate && isDuplicateClick(notificationData)) {
                Log.d(TAG, "重复的推送点击，忽略")
                return
            }
            if (!DooPushManager.isInitialized() || !DooPushManager.hasActiveCallback()) {
                Log.d(TAG, "SDK 未就绪，暂存推送点击")
                pendingClick = notificationData
                return
            }
        }
        // 记录推送点击统计
        recordNotificationClick(notificationData)
        DooPushManager.getInstance().getInternalCallback()?.onNotificationClick(notificationData)
    }

    /**
     * 补发暂存的推送点击（SDK 配置完成、设置回调后调用）
     */
    internal fun flushPendingClick() {
        val notificationData = synchronized(this) {
            if (!DooPushManager.isInitialized() || !DooPushManager.hasActiveCallback()) return
            pendingClick.also { pendingClick = null }
        } ?: return
        try {
            // 暂存时已做过去重
            dispatchClick(notificationData, checkDuplicate = false)
        } catch (e: Exception) {
            Log.e(TAG, "补发推送点击失败", e)
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
        val extras = intent?.extras ?: return false
        return isClickFlagSet(extras)
    }

    // 点击标记：intent URI 下发为 Boolean；魅族 parameters 只能下发字符串 "true"
    private fun isClickFlagSet(extras: Bundle): Boolean {
        return when (val flag = extras.get(EXTRA_NOTIFICATION_CLICKED)) {
            is Boolean -> flag
            is String -> flag.equals("true", ignoreCase = true)
            else -> false
        }
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

    /**
     * 清除所有通知栏消息
     * @param context Android 上下文
     * @return 是否清除成功
     */
    fun clearNotifications(context: Context): Boolean {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            // 通用通知清除
            notificationManager.cancelAll()

            // 厂商特定通知清除（可扩展）
            // TODO 考虑用于通知或者触发特点厂商自己的清除逻辑？
            when (DooPushDeviceVendor.getDeviceVendorInfo().preferredService) {
                DooPushDeviceVendor.PushService.MIPUSH -> {
                    // XiaomiService(context).clearNotifications()
                }
                DooPushDeviceVendor.PushService.OPPO -> {
                    // OppoService(context).clearNotifications()
                }
                else -> {
                    Log.d(TAG, "执行通用通知清除")
                }
            }

            Log.d(TAG, "通知栏消息清除成功")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "通知栏消息清除失败", e)
            return false
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

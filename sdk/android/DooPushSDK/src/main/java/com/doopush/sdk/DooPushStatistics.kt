package com.doopush.sdk

import android.util.Log
import com.doopush.sdk.models.DooPushError
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * DooPush 推送统计管理器
 * 
 * 负责收集和上报推送相关的统计数据，包括接收、点击、打开等事件
 * 对应iOS SDK的DooPushStatistics
 */
object DooPushStatistics {
    
    private const val TAG = "DooPushStatistics"
    
    // 批量上报阈值
    private const val BATCH_REPORT_THRESHOLD = 10
    
    // 统计事件队列
    private val statisticsQueue = ConcurrentLinkedQueue<StatisticsEvent>()
    
    // 网络管理器
    private var networking: DooPushNetworking? = null
    
    // 设备Token获取回调
    private var deviceTokenProvider: (() -> String?)? = null
    
    // 上报中标记，避免并发上报
    @Volatile
    private var isReporting = false
    
    /**
     * 配置统计管理器
     */
    fun configure(networking: DooPushNetworking, deviceTokenProvider: () -> String?) {
        this.networking = networking
        this.deviceTokenProvider = deviceTokenProvider
        Log.d(TAG, "统计管理器已配置")
    }
    
    /**
     * 统计事件类型
     */
    enum class EventType(val value: String) {
        RECEIVED("received"),       // 推送接收
        CLICKED("clicked"),         // 推送点击
        OPENED("opened"),           // 推送打开应用
        DISMISSED("dismissed");     // 推送被忽略
    }
    
    /**
     * 统计事件数据结构
     */
    data class StatisticsEvent(
        @SerializedName("event_type")
        val eventType: EventType,
        
        @SerializedName("push_log_id")
        val pushLogId: String?,
        
        @SerializedName("dedup_key")
        val dedupKey: String?,
        
        @SerializedName("timestamp")
        val timestamp: Long = System.currentTimeMillis(),
        
        @SerializedName("app_id")
        val appId: String? = null,
        
        @SerializedName("device_token")
        val deviceToken: String? = null,
        
        @SerializedName("extra_data")
        val extraData: Map<String, Any> = emptyMap()
    )
    
    /**
     * 记录推送接收事件
     */
    fun recordNotificationReceived(notificationData: DooPushNotificationHandler.NotificationData) {
        try {
            val event = StatisticsEvent(
                eventType = EventType.RECEIVED,
                pushLogId = notificationData.pushLogId,
                dedupKey = notificationData.dedupKey,
                appId = DooPushManager.getInstance().getConfig()?.appId,
                extraData = mapOf(
                    "title" to (notificationData.title ?: ""),
                    "body" to (notificationData.body ?: "")
                )
            )
            
            addEvent(event)
            Log.d(TAG, "记录推送接收事件: ${notificationData.pushLogId}")
        } catch (e: Exception) {
            Log.e(TAG, "记录推送接收事件失败", e)
        }
    }
    
    /**
     * 记录推送点击事件
     */
    fun recordNotificationClick(notificationData: DooPushNotificationHandler.NotificationData) {
        try {
            val event = StatisticsEvent(
                eventType = EventType.CLICKED,
                pushLogId = notificationData.pushLogId,
                dedupKey = notificationData.dedupKey,
                appId = DooPushManager.getInstance().getConfig()?.appId,
                extraData = mapOf(
                    "title" to (notificationData.title ?: ""),
                    "body" to (notificationData.body ?: "")
                )
            )
            
            addEvent(event)
            Log.d(TAG, "记录推送点击事件: ${notificationData.pushLogId}")
        } catch (e: Exception) {
            Log.e(TAG, "记录推送点击事件失败", e)
        }
    }
    
    /**
     * 记录推送打开应用事件
     */
    fun recordNotificationOpen(notificationData: DooPushNotificationHandler.NotificationData) {
        try {
            val event = StatisticsEvent(
                eventType = EventType.OPENED,
                pushLogId = notificationData.pushLogId,
                dedupKey = notificationData.dedupKey,
                appId = DooPushManager.getInstance().getConfig()?.appId,
                extraData = mapOf(
                    "title" to (notificationData.title ?: ""),
                    "body" to (notificationData.body ?: "")
                )
            )
            
            addEvent(event)
            Log.d(TAG, "记录推送打开事件: ${notificationData.pushLogId}")
        } catch (e: Exception) {
            Log.e(TAG, "记录推送打开事件失败", e)
        }
    }
    
    /**
     * 添加统计事件到队列
     */
    private fun addEvent(event: StatisticsEvent) {
        // 避免重复事件（基于去重键和事件类型）
        if (isDuplicateEvent(event)) {
            Log.d(TAG, "重复统计事件，跳过: ${event.dedupKey}-${event.eventType.value}")
            return
        }
        
        statisticsQueue.offer(event)
        
        // 如果队列过大，移除旧事件
        while (statisticsQueue.size > 100) {
            statisticsQueue.poll()
        }
        
        Log.d(TAG, "统计事件已添加到队列: ${event.eventType.value}")
        
        // 如果事件数量超过阈值，立即上报
        if (statisticsQueue.size >= BATCH_REPORT_THRESHOLD) {
            reportStatistics()
        }
    }
    
    /**
     * 检查是否是重复事件
     */
    private fun isDuplicateEvent(newEvent: StatisticsEvent): Boolean {
        return statisticsQueue.any { existingEvent ->
            existingEvent.dedupKey == newEvent.dedupKey && 
            existingEvent.eventType == newEvent.eventType
        }
    }
    
    /**
     * 立即上报统计数据
     */
    fun reportStatistics() {
        // 并发保护：避免重复上报
        if (isReporting) {
            Log.d(TAG, "统计数据正在上报中，跳过")
            return
        }
        
        try {
            if (statisticsQueue.isEmpty()) {
                Log.d(TAG, "没有待上报的统计事件")
                return
            }
            
            val networking = this.networking
            if (networking == null) {
                Log.w(TAG, "网络管理器未配置，无法上报统计数据")
                return
            }
            
            val deviceToken = deviceTokenProvider?.invoke()
            if (deviceToken == null) {
                Log.w(TAG, "设备Token缺失，无法上报统计数据")
                return
            }
            
            // 拷贝事件快照（最多50个）
            val events = mutableListOf<StatisticsEvent>()
            repeat(minOf(50, statisticsQueue.size)) {
                statisticsQueue.poll()?.let { events.add(it) }
            }
            
            if (events.isEmpty()) {
                return
            }
            
            isReporting = true
            Log.i(TAG, "开始上报 ${events.size} 个统计事件")
            
            reportEventsToServer(networking, events, deviceToken) { success ->
                isReporting = false
                if (!success) {
                    // 上报失败时，将事件重新添加到队列
                    for (event in events) {
                        statisticsQueue.offer(event)
                    }
                }
            }
            
        } catch (e: Exception) {
            isReporting = false
            Log.e(TAG, "上报统计数据失败", e)
        }
    }
    
    /**
     * 上报事件到服务器
     */
    private fun reportEventsToServer(
        networking: DooPushNetworking, 
        events: List<StatisticsEvent>, 
        deviceToken: String,
        callback: (Boolean) -> Unit
    ) {
        try {
            networking.reportStatistics(
                events, 
                object : DooPushNetworking.StatisticsReportCallback {
                    override fun onSuccess() {
                        Log.i(TAG, "统计数据上报成功")
                        callback(true)
                    }
                    
                    override fun onError(error: DooPushError) {
                        Log.e(TAG, "统计数据上报失败: ${error.message}")
                        callback(false)
                    }
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "统计数据上报异常", e)
            callback(false)
        }
    }
    
    /**
     * 获取当前统计队列大小
     */
    fun getQueueSize(): Int {
        return statisticsQueue.size
    }
    
    /**
     * 清空统计队列
     */
    fun clearQueue() {
        statisticsQueue.clear()
        Log.d(TAG, "统计队列已清空")
    }
    
    /**
     * 获取统计信息摘要
     */
    fun getStatisticsSummary(): String {
        return "推送统计队列: ${statisticsQueue.size} 个待上报事件"
    }
}

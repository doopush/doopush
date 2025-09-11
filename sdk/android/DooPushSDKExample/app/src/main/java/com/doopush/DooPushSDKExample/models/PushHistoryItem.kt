package com.doopush.DooPushSDKExample.models

import com.doopush.sdk.models.PushMessage
import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.*

/**
 * 推送历史记录项
 * 
 * 用于存储和展示接收到的推送消息
 */
data class PushHistoryItem(
    @SerializedName("id")
    val id: String = UUID.randomUUID().toString(),
    
    @SerializedName("title")
    val title: String?,
    
    @SerializedName("body")
    val body: String?,
    
    @SerializedName("data")
    val data: Map<String, String>?,
    
    @SerializedName("push_log_id")
    val pushLogId: String?,
    
    @SerializedName("dedup_key")
    val dedupKey: String?,
    
    @SerializedName("received_at")
    val receivedAt: Long = System.currentTimeMillis(),
    
    @SerializedName("is_read")
    var isRead: Boolean = false,
    
    @SerializedName("status")
    val status: PushStatus = PushStatus.RECEIVED
) {
    
    companion object {
        private val timeFormatter = SimpleDateFormat("HH:mm", Locale.getDefault())
        private val dateFormatter = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault())
        private val fullDateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        
        /**
         * 从PushMessage创建历史记录项
         */
        fun fromPushMessage(message: PushMessage): PushHistoryItem {
            return PushHistoryItem(
                title = message.title ?: "无标题",
                body = message.body ?: "无内容",
                data = message.data,
                pushLogId = message.pushLogId,
                dedupKey = message.dedupKey
            )
        }
    }
    
    /**
     * 推送状态枚举
     */
    enum class PushStatus(val displayName: String) {
        @SerializedName("received")
        RECEIVED("已接收"),
        
        @SerializedName("clicked")
        CLICKED("已点击"),
        
        @SerializedName("dismissed")
        DISMISSED("已忽略")
    }
    
    /**
     * 获取格式化的时间字符串
     */
    fun getFormattedTime(): String {
        return timeFormatter.format(Date(receivedAt))
    }
    
    /**
     * 获取格式化的日期时间字符串
     */
    fun getFormattedDateTime(): String {
        val now = System.currentTimeMillis()
        val diff = now - receivedAt
        
        return when {
            diff < 24 * 60 * 60 * 1000 -> "今天 ${timeFormatter.format(Date(receivedAt))}"
            diff < 7 * 24 * 60 * 60 * 1000 -> dateFormatter.format(Date(receivedAt))
            else -> fullDateFormatter.format(Date(receivedAt))
        }
    }
    
    /**
     * 获取显示标题
     */
    fun getDisplayTitle(): String {
        return when {
            !title.isNullOrBlank() -> title
            !body.isNullOrBlank() -> body.take(20) + if (body.length > 20) "..." else ""
            else -> "推送消息"
        }
    }
    
    /**
     * 获取显示内容
     */
    fun getDisplayBody(): String {
        return when {
            !body.isNullOrBlank() -> body
            !title.isNullOrBlank() -> title
            else -> "无内容"
        }
    }
    
    /**
     * 获取推送ID显示文本
     */
    fun getPushIdDisplay(): String {
        return pushLogId?.let { "ID: $it" } ?: "ID: 未知"
    }
    
    /**
     * 获取扩展信息
     */
    fun getExtendedInfo(): String {
        val info = StringBuilder()
        
        info.append("接收时间: ${fullDateFormatter.format(Date(receivedAt))}\n")
        info.append("推送ID: ${pushLogId ?: "未知"}\n")
        info.append("去重键: ${dedupKey ?: "无"}\n")
        info.append("状态: ${status.displayName}\n")
        info.append("已读: ${if (isRead) "是" else "否"}\n")
        
        if (!data.isNullOrEmpty()) {
            info.append("\n自定义数据:\n")
            data.entries.forEach { (key, value) ->
                info.append("  $key: $value\n")
            }
        }
        
        return info.toString().trim()
    }
    
    /**
     * 标记为已读
     */
    fun markAsRead() {
        isRead = true
    }
    
    /**
     * 更新状态
     */
    fun updateStatus(newStatus: PushStatus): PushHistoryItem {
        return copy(status = newStatus)
    }
    
    /**
     * 是否为今天的消息
     */
    fun isToday(): Boolean {
        val today = Calendar.getInstance()
        val messageDate = Calendar.getInstance().apply { timeInMillis = receivedAt }
        
        return today.get(Calendar.YEAR) == messageDate.get(Calendar.YEAR) &&
                today.get(Calendar.DAY_OF_YEAR) == messageDate.get(Calendar.DAY_OF_YEAR)
    }
}

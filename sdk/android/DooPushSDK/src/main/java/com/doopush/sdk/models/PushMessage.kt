package com.doopush.sdk.models

import com.google.gson.annotations.SerializedName

/**
 * 推送消息数据类
 * 
 * 封装从FCM接收到的推送消息数据
 */
data class PushMessage(
    
    /**
     * 推送ID
     */
    @SerializedName("push_id")
    val pushId: String? = null,
    
    /**
     * 推送日志ID，用于统计
     */
    @SerializedName("push_log_id")
    val pushLogId: String? = null,
    
    /**
     * 去重键，用于防止重复处理
     */
    @SerializedName("dedup_key")
    val dedupKey: String? = null,
    
    /**
     * 推送标题
     */
    @SerializedName("title")
    val title: String? = null,
    
    /**
     * 推送内容
     */
    @SerializedName("body")
    val body: String? = null,
    
    /**
     * 自定义数据
     */
    @SerializedName("data")
    val data: Map<String, String> = emptyMap(),
    
    /**
     * 消息ID (FCM分配)
     */
    @SerializedName("message_id")
    val messageId: String? = null,
    
    /**
     * 消息类型
     */
    @SerializedName("message_type")
    val messageType: String? = null,
    
    /**
     * 发送时间戳
     */
    @SerializedName("sent_time")
    val sentTime: Long? = null,
    
    /**
     * TTL (Time To Live)
     */
    @SerializedName("ttl")
    val ttl: Int? = null,
    
    /**
     * 原始FCM数据
     */
    val rawData: Map<String, Any> = emptyMap()
) {
    
    companion object {
        
        /**
         * 从FCM RemoteMessage创建PushMessage对象
         * 
         * @param remoteMessage FCM RemoteMessage对象
         * @return PushMessage实例
         */
        fun fromFCMRemoteMessage(remoteMessage: com.google.firebase.messaging.RemoteMessage): PushMessage {
            val data = remoteMessage.data
            val notification = remoteMessage.notification
            
            return PushMessage(
                pushId = data["push_id"] ?: data["id"],
                pushLogId = data["push_log_id"],
                dedupKey = data["dedup_key"],
                title = notification?.title ?: data["title"],
                body = notification?.body ?: data["body"],
                data = data,
                messageId = remoteMessage.messageId,
                messageType = remoteMessage.messageType,
                sentTime = remoteMessage.sentTime,
                ttl = remoteMessage.ttl,
                rawData = data.toMap()
            )
        }
        
        /**
         * 从数据Map创建PushMessage对象
         * 
         * @param data 推送数据Map
         * @return PushMessage实例
         */
        fun fromDataMap(data: Map<String, String>): PushMessage {
            return PushMessage(
                pushId = data["push_id"] ?: data["id"],
                pushLogId = data["push_log_id"],
                dedupKey = data["dedup_key"],
                title = data["title"],
                body = data["body"],
                data = data,
                messageId = data["message_id"],
                messageType = data["message_type"],
                sentTime = data["sent_time"]?.toLongOrNull(),
                ttl = data["ttl"]?.toIntOrNull(),
                rawData = data.toMap()
            )
        }
        
        /**
         * 从HMS推送消息创建PushMessage对象
         * 
         * @param hmsMessageData HMS推送数据
         * @return PushMessage实例
         */
        fun fromHMSMessage(hmsMessageData: Map<String, String>): PushMessage {
            return PushMessage(
                pushId = hmsMessageData["push_id"] ?: hmsMessageData["id"],
                pushLogId = hmsMessageData["push_log_id"],
                dedupKey = hmsMessageData["dedup_key"],
                title = hmsMessageData["title"],
                body = hmsMessageData["body"],
                data = hmsMessageData,
                messageId = hmsMessageData["msgId"] ?: hmsMessageData["message_id"],
                messageType = "hms",
                sentTime = hmsMessageData["sentTime"]?.toLongOrNull(),
                ttl = hmsMessageData["ttl"]?.toIntOrNull(),
                rawData = hmsMessageData.toMap()
            )
        }
    }
    
    /**
     * 是否有通知内容
     */
    fun hasNotification(): Boolean {
        return !title.isNullOrEmpty() || !body.isNullOrEmpty()
    }
    
    /**
     * 是否有自定义数据
     */
    fun hasData(): Boolean {
        return data.isNotEmpty()
    }
    
    /**
     * 是否有统计信息
     */
    fun hasStatistics(): Boolean {
        return !pushLogId.isNullOrEmpty()
    }
    
    /**
     * 获取自定义数据中的值
     * 
     * @param key 键名
     * @return 键值，如果不存在则返回null
     */
    fun getDataValue(key: String): String? {
        return data[key]
    }
    
    /**
     * 获取显示用的标题
     * 优先使用notification的title，然后是data中的title
     */
    fun getDisplayTitle(): String? {
        return title ?: data["title"]
    }
    
    /**
     * 获取显示用的内容
     * 优先使用notification的body，然后是data中的body
     */
    fun getDisplayBody(): String? {
        return body ?: data["body"]
    }
    
    /**
     * 转换为简化的显示字符串
     */
    fun toDisplayString(): String {
        val displayTitle = getDisplayTitle()
        val displayBody = getDisplayBody()
        
        return when {
            !displayTitle.isNullOrEmpty() && !displayBody.isNullOrEmpty() -> 
                "$displayTitle: $displayBody"
            !displayTitle.isNullOrEmpty() -> displayTitle
            !displayBody.isNullOrEmpty() -> displayBody
            hasData() -> "数据推送 (${data.size}个字段)"
            else -> "空推送消息"
        }
    }
}

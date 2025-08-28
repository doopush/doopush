package com.doopush.sdk.model

import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * DooPush 推送消息数据模型
 */
data class DooPushMessage(
    /**
     * 消息ID
     */
    @SerializedName("message_id")
    val messageId: String,
    
    /**
     * 消息标题
     */
    @SerializedName("title")
    val title: String?,
    
    /**
     * 消息内容
     */
    @SerializedName("content")
    val content: String?,
    
    /**
     * 自定义数据载荷
     */
    @SerializedName("payload")
    val payload: Map<String, Any>? = null,
    
    /**
     * 推送厂商
     */
    @SerializedName("vendor")
    val vendor: String,
    
    /**
     * 消息类型
     */
    @SerializedName("message_type")
    val messageType: DooPushMessageType = DooPushMessageType.NOTIFICATION,
    
    /**
     * 角标数量
     */
    @SerializedName("badge")
    val badge: Int? = null,
    
    /**
     * 声音
     */
    @SerializedName("sound")
    val sound: String? = null,
    
    /**
     * 图标
     */
    @SerializedName("icon")
    val icon: String? = null,
    
    /**
     * 大图URL
     */
    @SerializedName("big_picture")
    val bigPicture: String? = null,
    
    /**
     * 点击动作
     */
    @SerializedName("click_action")
    val clickAction: String? = null,
    
    /**
     * 通知渠道ID（Android 8.0+）
     */
    @SerializedName("channel_id")
    val channelId: String? = null,
    
    /**
     * 消息接收时间
     */
    @SerializedName("received_at")
    val receivedAt: Date = Date(),
    
    /**
     * 原始数据
     */
    @SerializedName("raw_data")
    val rawData: Map<String, Any>? = null
) {
    
    /**
     * 是否包含自定义数据
     */
    val hasCustomPayload: Boolean
        get() = payload != null && payload.isNotEmpty()
    
    /**
     * 是否为透传消息
     */
    val isPassThrough: Boolean
        get() = messageType == DooPushMessageType.PASS_THROUGH
    
    /**
     * 是否为通知消息
     */
    val isNotification: Boolean
        get() = messageType == DooPushMessageType.NOTIFICATION
    
    /**
     * 获取自定义数据中的特定值
     * @param key 键名
     * @return 对应的值
     */
    fun getCustomValue(key: String): Any? {
        return payload?.get(key)
    }
    
    /**
     * 获取自定义数据中的字符串值
     * @param key 键名
     * @param defaultValue 默认值
     * @return 字符串值
     */
    fun getCustomString(key: String, defaultValue: String = ""): String {
        return payload?.get(key)?.toString() ?: defaultValue
    }
    
    /**
     * 获取自定义数据中的整数值
     * @param key 键名
     * @param defaultValue 默认值
     * @return 整数值
     */
    fun getCustomInt(key: String, defaultValue: Int = 0): Int {
        return when (val value = payload?.get(key)) {
            is Int -> value
            is Number -> value.toInt()
            is String -> value.toIntOrNull() ?: defaultValue
            else -> defaultValue
        }
    }
    
    /**
     * 获取自定义数据中的布尔值
     * @param key 键名
     * @param defaultValue 默认值
     * @return 布尔值
     */
    fun getCustomBoolean(key: String, defaultValue: Boolean = false): Boolean {
        return when (val value = payload?.get(key)) {
            is Boolean -> value
            is String -> value.toBoolean()
            else -> defaultValue
        }
    }
    
    /**
     * 转换为Map格式（用于统计上报等）
     */
    fun toMap(): Map<String, Any?> {
        return mapOf(
            "message_id" to messageId,
            "title" to title,
            "content" to content,
            "vendor" to vendor,
            "message_type" to messageType.name,
            "has_payload" to hasCustomPayload,
            "received_at" to receivedAt.time
        )
    }
    
    override fun toString(): String {
        return "DooPushMessage(id='$messageId', title='$title', vendor='$vendor', type=$messageType)"
    }
}

/**
 * 推送消息类型
 */
enum class DooPushMessageType {
    /**
     * 通知消息（显示在通知栏）
     */
    @SerializedName("notification")
    NOTIFICATION,
    
    /**
     * 透传消息（不显示通知，直接传递给应用）
     */
    @SerializedName("pass_through")
    PASS_THROUGH,
    
    /**
     * 混合消息（既显示通知又传递给应用）
     */
    @SerializedName("hybrid")
    HYBRID
}

/**
 * 推送消息构建器
 */
class DooPushMessageBuilder {
    private var messageId: String = ""
    private var title: String? = null
    private var content: String? = null
    private var payload: MutableMap<String, Any>? = null
    private var vendor: String = ""
    private var messageType: DooPushMessageType = DooPushMessageType.NOTIFICATION
    private var badge: Int? = null
    private var sound: String? = null
    private var icon: String? = null
    private var bigPicture: String? = null
    private var clickAction: String? = null
    private var channelId: String? = null
    private var rawData: Map<String, Any>? = null
    
    fun messageId(messageId: String) = apply { this.messageId = messageId }
    fun title(title: String?) = apply { this.title = title }
    fun content(content: String?) = apply { this.content = content }
    fun vendor(vendor: String) = apply { this.vendor = vendor }
    fun messageType(type: DooPushMessageType) = apply { this.messageType = type }
    fun badge(badge: Int?) = apply { this.badge = badge }
    fun sound(sound: String?) = apply { this.sound = sound }
    fun icon(icon: String?) = apply { this.icon = icon }
    fun bigPicture(bigPicture: String?) = apply { this.bigPicture = bigPicture }
    fun clickAction(clickAction: String?) = apply { this.clickAction = clickAction }
    fun channelId(channelId: String?) = apply { this.channelId = channelId }
    fun rawData(rawData: Map<String, Any>?) = apply { this.rawData = rawData }
    
    fun addPayload(key: String, value: Any) = apply {
        if (payload == null) {
            payload = mutableMapOf()
        }
        payload!![key] = value
    }
    
    fun payload(payload: Map<String, Any>?) = apply {
        this.payload = payload?.toMutableMap()
    }
    
    fun build(): DooPushMessage {
        return DooPushMessage(
            messageId = messageId,
            title = title,
            content = content,
            payload = payload,
            vendor = vendor,
            messageType = messageType,
            badge = badge,
            sound = sound,
            icon = icon,
            bigPicture = bigPicture,
            clickAction = clickAction,
            channelId = channelId,
            rawData = rawData
        )
    }
}

/**
 * 推送消息解析器
 */
object DooPushMessageParser {
    
    /**
     * 从Intent解析推送消息
     */
    fun parseFromIntent(intent: android.content.Intent): DooPushMessage? {
        return try {
            val extras = intent.extras ?: return null
            parseFromBundle(extras)
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * 从Bundle解析推送消息
     */
    fun parseFromBundle(bundle: android.os.Bundle): DooPushMessage? {
        return try {
            val builder = DooPushMessageBuilder()
            
            // 解析基本字段
            builder.messageId(bundle.getString("message_id", ""))
            builder.title(bundle.getString("title"))
            builder.content(bundle.getString("content") ?: bundle.getString("body"))
            builder.vendor(bundle.getString("vendor", "unknown"))
            
            // 解析消息类型
            val typeString = bundle.getString("message_type", "notification")
            val messageType = try {
                DooPushMessageType.valueOf(typeString.uppercase())
            } catch (e: Exception) {
                DooPushMessageType.NOTIFICATION
            }
            builder.messageType(messageType)
            
            // 解析其他字段
            bundle.getInt("badge", -1).takeIf { it >= 0 }?.let { builder.badge(it) }
            builder.sound(bundle.getString("sound"))
            builder.icon(bundle.getString("icon"))
            builder.bigPicture(bundle.getString("big_picture"))
            builder.clickAction(bundle.getString("click_action"))
            builder.channelId(bundle.getString("channel_id"))
            
            // 解析自定义数据
            val payload = mutableMapOf<String, Any>()
            for (key in bundle.keySet()) {
                if (!isSystemKey(key)) {
                    bundle.get(key)?.let { value ->
                        payload[key] = value
                    }
                }
            }
            if (payload.isNotEmpty()) {
                builder.payload(payload)
            }
            
            builder.build()
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * 检查是否为系统保留字段
     */
    private fun isSystemKey(key: String): Boolean {
        return key in setOf(
            "message_id", "title", "content", "body", "vendor", "message_type",
            "badge", "sound", "icon", "big_picture", "click_action", "channel_id"
        )
    }
}
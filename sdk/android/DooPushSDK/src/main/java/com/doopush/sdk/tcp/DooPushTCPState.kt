package com.doopush.sdk.tcp

/**
 * TCP连接状态枚举
 */
enum class DooPushTCPState {
    /**
     * 已断开连接
     */
    DISCONNECTED,
    
    /**
     * 正在连接
     */
    CONNECTING,
    
    /**
     * 已连接
     */
    CONNECTED,
    
    /**
     * 正在注册设备
     */
    REGISTERING,
    
    /**
     * 设备已注册
     */
    REGISTERED,
    
    /**
     * 连接失败
     */
    FAILED;
    
    /**
     * 获取状态描述
     */
    fun getDescription(): String {
        return when (this) {
            DISCONNECTED -> "已断开连接"
            CONNECTING -> "正在连接"
            CONNECTED -> "已连接"
            REGISTERING -> "正在注册设备"
            REGISTERED -> "设备已注册"
            FAILED -> "连接失败"
        }
    }
    
    /**
     * 是否为连接状态
     */
    fun isConnected(): Boolean {
        return this == CONNECTED || this == REGISTERING || this == REGISTERED
    }
    
    /**
     * 是否为活跃状态
     */
    fun isActive(): Boolean {
        return this == REGISTERED
    }
    
    /**
     * 是否可以发送消息
     */
    fun canSendMessage(): Boolean {
        return this == CONNECTED || this == REGISTERING || this == REGISTERED
    }
}

/**
 * TCP消息类型
 */
enum class DooPushTCPMessageType(val value: Byte) {
    /**
     * 心跳请求
     */
    PING(0x01),
    
    /**
     * 心跳响应
     */
    PONG(0x02),
    
    /**
     * 设备注册
     */
    REGISTER(0x03),
    
    /**
     * 注册确认
     */
    ACK(0x04),
    
    /**
     * 推送消息
     */
    PUSH(0x05),
    
    /**
     * 错误消息
     */
    ERROR(0xFF.toByte());
    
    companion object {
        /**
         * 根据字节值获取消息类型
         */
        fun fromByte(value: Byte): DooPushTCPMessageType? {
            return values().find { it.value == value }
        }
    }
}

/**
 * TCP消息数据结构
 */
data class DooPushTCPMessage(
    /**
     * 消息类型
     */
    val type: DooPushTCPMessageType,
    
    /**
     * 消息数据
     */
    val data: ByteArray,
    
    /**
     * 消息ID（可选）
     */
    val messageId: String? = null,
    
    /**
     * 时间戳
     */
    val timestamp: Long = System.currentTimeMillis()
) {
    
    /**
     * 获取数据长度
     */
    val dataLength: Int
        get() = data.size
    
    /**
     * 获取数据字符串（UTF-8编码）
     */
    fun getDataAsString(): String {
        return try {
            String(data, Charsets.UTF_8)
        } catch (e: Exception) {
            ""
        }
    }
    
    /**
     * 序列化为字节数组
     * 格式: [类型(1字节)] + [数据]
     * 注: 移除长度字段，与服务器期望格式保持一致
     */
    fun toByteArray(): ByteArray {
        val result = ByteArray(1 + data.size)
        var offset = 0

        // 消息类型
        result[offset] = type.value
        offset += 1

        // 数据（直接附加，无需长度字段）
        System.arraycopy(data, 0, result, offset, data.size)

        return result
    }
    
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        
        other as DooPushTCPMessage
        
        if (type != other.type) return false
        if (!data.contentEquals(other.data)) return false
        if (messageId != other.messageId) return false
        
        return true
    }
    
    override fun hashCode(): Int {
        var result = type.hashCode()
        result = 31 * result + data.contentHashCode()
        result = 31 * result + (messageId?.hashCode() ?: 0)
        return result
    }
    
    override fun toString(): String {
        return "DooPushTCPMessage(type=$type, dataLength=$dataLength, messageId=$messageId, timestamp=$timestamp)"
    }
    
    companion object {
        /**
         * 从字节数组反序列化
         * 格式: [类型(1字节)] + [数据]
         */
        fun fromByteArray(bytes: ByteArray): DooPushTCPMessage? {
            if (bytes.size < 1) { // 至少需要类型(1)
                return null
            }

            var offset = 0

            // 解析消息类型
            val typeValue = bytes[offset]
            val type = DooPushTCPMessageType.fromByte(typeValue) ?: return null
            offset += 1

            // 解析数据（剩余所有字节）
            val dataLength = bytes.size - offset
            val data: ByteArray // Declare data here
            if (dataLength > 0) {
                data = ByteArray(dataLength) // Initialize data
                System.arraycopy(bytes, offset, data, 0, dataLength)
            } else {
                data = ByteArray(0) // 空数据
            }

            return DooPushTCPMessage(type, data)
        }
        
        /**
         * 创建心跳请求消息
         * 参考iOS实现：只有消息类型，没有额外数据
         */
        fun createPingMessage(): DooPushTCPMessage {
            return DooPushTCPMessage(
                type = DooPushTCPMessageType.PING,
                data = ByteArray(0) // 空数据，与iOS一致
            )
        }

        /**
         * 创建心跳响应消息
         * 参考iOS实现：只有消息类型，没有额外数据
         */
        fun createPongMessage(): DooPushTCPMessage {
            return DooPushTCPMessage(
                type = DooPushTCPMessageType.PONG,
                data = ByteArray(0) // 空数据，与iOS一致
            )
        }
        
        /**
         * 创建设备注册消息
         */
        fun createRegisterMessage(appId: String, deviceToken: String): DooPushTCPMessage {
            // 将appId转换为Int类型，与iOS保持一致
            val appIdInt = try {
                appId.toInt()
            } catch (e: NumberFormatException) {
                0
            }

            val registerData = mapOf(
                "app_id" to appIdInt,           // Int类型，与iOS一致
                "token" to deviceToken,         // 使用"token"而不是"device_token"
                "platform" to "android"         // 平台标识
            )

            val jsonData = com.google.gson.Gson().toJson(registerData)

            return DooPushTCPMessage(
                type = DooPushTCPMessageType.REGISTER,
                data = jsonData.toByteArray(Charsets.UTF_8)
            )
        }
        
        /**
         * 创建确认消息
         */
        fun createAckMessage(originalMessageId: String? = null): DooPushTCPMessage {
            val ackData = mapOf(
                "status" to "ok",
                "original_message_id" to originalMessageId,
                "timestamp" to System.currentTimeMillis()
            )
            
            val jsonData = com.google.gson.Gson().toJson(ackData)
            
            return DooPushTCPMessage(
                type = DooPushTCPMessageType.ACK,
                data = jsonData.toByteArray(Charsets.UTF_8)
            )
        }
        
        /**
         * 创建错误消息
         */
        fun createErrorMessage(errorCode: Int, errorMessage: String): DooPushTCPMessage {
            val errorData = mapOf(
                "error_code" to errorCode,
                "error_message" to errorMessage,
                "timestamp" to System.currentTimeMillis()
            )
            
            val jsonData = com.google.gson.Gson().toJson(errorData)
            
            return DooPushTCPMessage(
                type = DooPushTCPMessageType.ERROR,
                data = jsonData.toByteArray(Charsets.UTF_8)
            )
        }
    }
}
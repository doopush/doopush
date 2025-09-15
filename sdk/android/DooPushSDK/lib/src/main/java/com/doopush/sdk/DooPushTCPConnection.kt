package com.doopush.sdk

import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import com.doopush.sdk.models.DooPushError
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.io.*
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory
import kotlin.math.pow

/**
 * TCP 连接状态枚举
 */
enum class DooPushTCPState(val value: Int, val description: String) {
    DISCONNECTED(0, "已断开"),
    CONNECTING(1, "连接中"),
    CONNECTED(2, "已连接"),
    REGISTERING(3, "注册中"), 
    REGISTERED(4, "已注册"),
    FAILED(5, "连接失败");
    
    companion object {
        fun fromValue(value: Int): DooPushTCPState? {
            return DooPushTCPState.entries.find { it.value == value }
        }
    }
}

/**
 * Gateway 配置信息
 */
data class DooPushGatewayConfig(
    @SerializedName("host")
    val host: String,
    
    @SerializedName("port")
    val port: Int,
    
    @SerializedName("ssl")
    val ssl: Boolean = false
) {
    override fun toString(): String {
        return "$host:$port${if (ssl) " (SSL)" else ""}"
    }
}

/**
 * TCP 消息结构
 */
data class DooPushTCPMessage(
    val type: Byte,
    val data: ByteArray
) {
    /**
     * 消息类型枚举
     */
    enum class MessageType(val value: Byte) {
        PING(0x01.toByte()),        // 心跳请求
        PONG(0x02.toByte()),        // 心跳响应
        REGISTER(0x03.toByte()),    // 设备注册
        ACK(0x04.toByte()),         // 注册确认
        PUSH(0x05.toByte()),        // 推送消息
        ERROR(0xFF.toByte());       // 错误消息
        
        companion object {
            fun fromValue(value: Byte): MessageType? {
                return MessageType.entries.find { it.value == value }
            }
        }
    }
    
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        
        other as DooPushTCPMessage
        
        if (type != other.type) return false
        if (!data.contentEquals(other.data)) return false
        
        return true
    }
    
    override fun hashCode(): Int {
        var result = type.toInt()
        result = 31 * result + data.contentHashCode()
        return result
    }
}

/**
 * TCP 连接代理接口
 */
interface DooPushTCPConnectionDelegate {
    /**
     * 连接状态变化
     */
    fun onStateChanged(connection: DooPushTCPConnection, state: DooPushTCPState)
    
    /**
     * 注册成功
     */
    fun onRegisterSuccessfully(connection: DooPushTCPConnection, message: DooPushTCPMessage)
    
    /**
     * 收到错误
     */
    fun onReceiveError(connection: DooPushTCPConnection, error: DooPushError, message: String)
    
    /**
     * 收到心跳响应
     */
    fun onReceiveHeartbeatResponse(connection: DooPushTCPConnection, message: DooPushTCPMessage)
    
    /**
     * 收到推送消息
     */
    fun onReceivePushMessage(connection: DooPushTCPConnection, message: DooPushTCPMessage)
}

/**
 * TCP 连接管理器
 * 
 * 负责与 DooPush Gateway 的TCP连接管理，包括连接建立、消息收发、心跳维持、自动重连等功能
 */
class DooPushTCPConnection {
    
    companion object {
        private const val TAG = "DooPushTCPConnection"
        
        // 超时配置
        private const val SOCKET_TIMEOUT = 30_000 // 30秒socket超时
        private const val CONNECT_TIMEOUT = 15_000 // 15秒连接超时
        
        // 心跳配置
        private const val HEARTBEAT_INTERVAL = 30_000L // 30秒心跳间隔
        
        // 重连配置
        private const val MAX_RECONNECT_DELAY = 15_000L // 最大重连延迟15秒
        private const val MAX_RECONNECT_ATTEMPTS = 0 // 0表示无限重连
    }
    
    // Gateway配置
    private var gatewayConfig: DooPushGatewayConfig? = null
    
    // 应用配置
    private var appId: String? = null
    private var deviceToken: String? = null
    
    // 连接相关
    private var socket: Socket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null
    
    // 工作线程
    private val tcpThread = HandlerThread("DooPushTCP")
    private val tcpHandler: Handler
    private val mainHandler = Handler(Looper.getMainLooper())
    
    // 连接状态
    @Volatile
    var state: DooPushTCPState = DooPushTCPState.DISCONNECTED
        private set(value) {
            if (field != value) {
                field = value
                DooPushLogger.d(TAG, "TCP状态变更: ${value.description}")
                mainHandler.post {
                    delegate?.onStateChanged(this, value)
                }
            }
        }
    
    // 错误信息
    @Volatile
    var lastError: DooPushError? = null
        private set
    
    // 代理
    var delegate: DooPushTCPConnectionDelegate? = null
    
    // 控制标志
    private val isRunning = AtomicBoolean(false)
    private val shouldReconnect = AtomicBoolean(true)
    
    // 重连相关
    private var reconnectAttempts = 0
    
    // 消息缓冲区
    private val messageBuffer = ByteArrayOutputStream()
    
    // JSON处理
    private val gson = Gson()
    
    init {
        tcpThread.start()
        tcpHandler = Handler(tcpThread.looper)
        DooPushLogger.d(TAG, "DooPushTCPConnection 初始化")
    }
    
    /**
     * 配置 Gateway 连接
     */
    fun configure(config: DooPushGatewayConfig, appId: String, deviceToken: String) {
        this.gatewayConfig = config
        this.appId = appId
        this.deviceToken = deviceToken
        
        DooPushLogger.i(TAG, "TCP连接已配置 - ${config}, AppID: $appId")
    }
    
    /**
     * 连接到 Gateway
     */
    fun connect() {
        val config = gatewayConfig
        if (config == null) {
            DooPushLogger.e(TAG, "TCP连接未配置")
            lastError = DooPushError.configNotInitialized()
            state = DooPushTCPState.FAILED
            return
        }
        
        tcpHandler.post {
            connectInternal(config)
        }
    }
    
    /**
     * 断开连接
     */
    fun disconnect() {
        shouldReconnect.set(false)
        
        tcpHandler.post {
            disconnectInternal()
        }
    }
    
    /**
     * 应用进入前台
     */
    fun applicationDidBecomeActive() {
        val config = gatewayConfig
        if (config == null) {
            DooPushLogger.i(TAG, "应用进入前台，TCP连接未配置，不进行状态检查")
            return 
        }
        
        DooPushLogger.i(TAG, "应用进入前台，当前连接状态: ${state.description}")
        
        when (state) {
            DooPushTCPState.REGISTERED -> {
                // 已注册状态，检查连接是否真的可用
                DooPushLogger.i(TAG, "连接已注册，验证连接健康状态")
                if (!isConnectionHealthy()) {
                    DooPushLogger.w(TAG, "连接不健康，重新连接")
                    shouldReconnect.set(true)
                    reconnectAttempts = 0
                    connect()
                } else {
                    // 发送心跳测试连接
                    sendHeartbeat()
                }
            }
            
            DooPushTCPState.CONNECTED, DooPushTCPState.REGISTERING -> {
                // 连接中或注册中，等待完成
                DooPushLogger.i(TAG, "连接进行中，等待完成")
            }
            
            DooPushTCPState.CONNECTING -> {
                // 正在连接，可能需要重置
                DooPushLogger.i(TAG, "连接超时，重新连接")
                shouldReconnect.set(true)
                connect()
            }
            
            else -> {
                // 断开、失败等状态，重新连接
                DooPushLogger.i(TAG, "连接异常，重新建立连接")
                shouldReconnect.set(true)
                reconnectAttempts = 0
                connect()
            }
        }
    }
    
    /**
     * 应用进入后台
     */
    fun applicationWillResignActive() {
        DooPushLogger.i(TAG, "应用进入后台，当前状态: ${state.description}")
        
        // Android后台运行：停止心跳定时器节省资源
        // 连接可能会被系统断开，前台恢复时会重连
        tcpHandler.removeCallbacks(heartbeatRunnable)
        tcpHandler.removeCallbacks(reconnectRunnable)
        
        DooPushLogger.i(TAG, "已停止心跳和重连定时器，等待前台恢复")
    }
    
    /**
     * 应用即将终止
     */
    fun applicationWillTerminate() {
        disconnect()
    }
    
    /**
     * 释放资源
     */
    fun release() {
        disconnect()
        tcpThread.quitSafely()
        DooPushLogger.d(TAG, "TCP连接资源已释放")
    }
    
    // MARK: - 私有方法
    
    /**
     * 内部连接方法
     */
    private fun connectInternal(config: DooPushGatewayConfig) {
        disconnectInternal() // 先断开现有连接
        
        DooPushLogger.i(TAG, "正在连接到 Gateway - ${config}")
        state = DooPushTCPState.CONNECTING
        isRunning.set(true)
        
        try {
            // 创建Socket
            socket = if (config.ssl) {
                val sslSocketFactory = SSLSocketFactory.getDefault()
                val sslSocket = sslSocketFactory.createSocket(config.host, config.port) as SSLSocket
                sslSocket.soTimeout = SOCKET_TIMEOUT
                sslSocket
            } else {
                val plainSocket = Socket()
                plainSocket.connect(java.net.InetSocketAddress(config.host, config.port), CONNECT_TIMEOUT)
                plainSocket.soTimeout = SOCKET_TIMEOUT
                plainSocket
            }
            
            // 获取输入输出流
            inputStream = socket?.getInputStream()
            outputStream = socket?.getOutputStream()
            
            DooPushLogger.i(TAG, "TCP连接已建立")
            state = DooPushTCPState.CONNECTED
            reconnectAttempts = 0
            
            // 开始接收数据
            startReceiving()
            
            // 发送注册消息
            sendRegisterMessage()
            
        } catch (e: Exception) {
            if (isNormalConnectionError(e)) {
                DooPushLogger.i(TAG, "TCP连接暂时失败: ${e.javaClass.simpleName}")
                lastError = DooPushErrorHandler.handleNetworkError(e)
                state = DooPushTCPState.FAILED
                scheduleGentleReconnect()
            } else {
                DooPushLogger.e(TAG, "TCP连接失败", e)
                lastError = DooPushErrorHandler.handleNetworkError(e)
                state = DooPushTCPState.FAILED
                scheduleReconnect()
            }
        }
    }
    
    /**
     * 内部断开连接方法
     */
    private fun disconnectInternal() {
        isRunning.set(false)
        
        // 停止心跳和重连定时器
        tcpHandler.removeCallbacks(heartbeatRunnable)
        tcpHandler.removeCallbacks(reconnectRunnable)
        
        // 关闭流和socket
        try {
            inputStream?.close()
            outputStream?.close()
            socket?.close()
        } catch (e: Exception) {
            DooPushLogger.w(TAG, "关闭连接时发生异常", e)
        } finally {
            inputStream = null
            outputStream = null
            socket = null
        }
        
        if (state != DooPushTCPState.DISCONNECTED) {
            state = DooPushTCPState.DISCONNECTED
        }
        
        DooPushLogger.i(TAG, "TCP连接已断开")
    }
    
    /**
     * 开始接收数据
     */
    private fun startReceiving() {
        tcpHandler.post {
            receiveData()
        }
    }
    
    /**
     * 接收数据
     */
    private fun receiveData() {
        val inputStream = this.inputStream
        if (inputStream == null || !isRunning.get()) {
            return
        }
        
        try {
            val buffer = ByteArray(1024)
            val bytesRead = inputStream.read(buffer)
            
            if (bytesRead == -1) {
                // 连接已关闭
                DooPushLogger.i(TAG, "TCP连接已关闭")
                handleConnectionError(IOException("连接已关闭"))
                return
            }
            
            if (bytesRead > 0) {
                // 处理接收到的数据
                handleReceivedData(buffer, bytesRead)
            }
            
            // 继续接收数据
            if (isRunning.get()) {
                tcpHandler.post { receiveData() }
            }
            
        } catch (_: SocketTimeoutException) {
            // Socket超时，继续接收
            if (isRunning.get()) {
                tcpHandler.post { receiveData() }
            }
        } catch (e: Exception) {
            if (isNormalDisconnectionError(e)) {
                DooPushLogger.d(TAG, "TCP连接正常断开: ${e.javaClass.simpleName}")
                handleConnectionDisconnect(e)
            } else {
                DooPushLogger.e(TAG, "TCP数据接收失败", e)
                handleConnectionError(e)
            }
        }
    }
    
    /**
     * 处理接收到的数据
     */
    private fun handleReceivedData(buffer: ByteArray, length: Int) {
        messageBuffer.write(buffer, 0, length)
        
        // 尝试解析消息
        while (true) {
            val message = parseMessage() ?: break
            handleMessage(message)
        }
    }
    
    /**
     * 解析消息
     */
    private fun parseMessage(): DooPushTCPMessage? {
        val data = messageBuffer.toByteArray()
        if (data.isEmpty()) return null
        
        // 简单的消息格式：[类型1字节][数据]
        val messageType = data[0]
        val messageData = if (data.size > 1) data.copyOfRange(1, data.size) else byteArrayOf()
        
        // 清空缓冲区（简化处理）
        messageBuffer.reset()
        
        return DooPushTCPMessage(messageType, messageData)
    }
    
    /**
     * 处理消息
     */
    private fun handleMessage(message: DooPushTCPMessage) {
        when (DooPushTCPMessage.MessageType.fromValue(message.type)) {
            DooPushTCPMessage.MessageType.PONG -> handlePongMessage(message)
            DooPushTCPMessage.MessageType.ACK -> handleAckMessage(message)
            DooPushTCPMessage.MessageType.ERROR -> handleErrorMessage(message)
            DooPushTCPMessage.MessageType.PUSH -> handlePushMessage(message)
            else -> DooPushLogger.w(TAG, "收到未知消息类型: 0x${String.format("%02X", message.type)}")
        }
    }
    
    /**
     * 处理PONG消息
     */
    private fun handlePongMessage(message: DooPushTCPMessage) {
        DooPushLogger.d(TAG, "收到心跳响应")
        mainHandler.post {
            delegate?.onReceiveHeartbeatResponse(this, message)
        }
    }
    
    /**
     * 处理ACK消息
     */
    private fun handleAckMessage(message: DooPushTCPMessage) {
        DooPushLogger.i(TAG, "收到注册确认")
        state = DooPushTCPState.REGISTERED
        
        // 开始心跳
        startHeartbeat()
        
        mainHandler.post {
            delegate?.onRegisterSuccessfully(this, message)
        }
    }
    
    /**
     * 处理错误消息
     */
    private fun handleErrorMessage(message: DooPushTCPMessage) {
        val errorMessage = try {
            String(message.data, Charsets.UTF_8)
        } catch (_: Exception) {
            "未知错误"
        }
        
        DooPushLogger.e(TAG, "收到错误消息: $errorMessage")
        
        val error = DooPushError(
            code = DooPushError.ERROR_TCP_SERVER_ERROR,
            message = "服务器错误",
            details = errorMessage
        )
        lastError = error
        state = DooPushTCPState.FAILED
        
        mainHandler.post {
            delegate?.onReceiveError(this, error, errorMessage)
        }
    }
    
    /**
     * 处理推送消息
     */
    private fun handlePushMessage(message: DooPushTCPMessage) {
        DooPushLogger.i(TAG, "收到推送消息")
        
        mainHandler.post {
            delegate?.onReceivePushMessage(this, message)
        }
    }
    
    /**
     * 发送消息
     */
    private fun sendMessage(data: ByteArray) {
        val outputStream = this.outputStream
        if (outputStream == null || !isConnectionReady()) {
            DooPushLogger.w(TAG, "TCP连接未就绪，无法发送消息")
            return
        }
        
        try {
            outputStream.write(data)
            outputStream.flush()
        } catch (e: Exception) {
            if (isNormalDisconnectionError(e)) {
                DooPushLogger.d(TAG, "TCP发送时连接断开: ${e.javaClass.simpleName}")
                handleConnectionDisconnect(e)
            } else {
                DooPushLogger.e(TAG, "TCP消息发送失败", e)
                handleConnectionError(e)
            }
        }
    }
    
    /**
     * 发送注册消息
     */
    private fun sendRegisterMessage() {
        val appId = this.appId
        val deviceToken = this.deviceToken
        
        if (appId == null || deviceToken == null) {
            DooPushLogger.e(TAG, "应用ID或设备Token缺失")
            return
        }
        
        state = DooPushTCPState.REGISTERING
        
        try {
            // 构建注册消息JSON
            val registerData = mapOf(
                "app_id" to (appId.toIntOrNull() ?: 0),
                "token" to deviceToken,
                "platform" to "android"
            )
            
            val jsonBytes = gson.toJson(registerData).toByteArray(Charsets.UTF_8)
            val messageData = byteArrayOf(DooPushTCPMessage.MessageType.REGISTER.value) + jsonBytes
            
            sendMessage(messageData)
            DooPushLogger.i(TAG, "已发送设备注册消息")
        } catch (e: Exception) {
            DooPushLogger.e(TAG, "注册消息序列化失败", e)
        }
    }
    
    /**
     * 心跳任务
     */
    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            sendHeartbeat()
            tcpHandler.postDelayed(this, HEARTBEAT_INTERVAL)
        }
    }
    
    /**
     * 发送心跳
     */
    private fun sendHeartbeat() {
        if (state == DooPushTCPState.REGISTERED) {
            val heartbeatData = byteArrayOf(DooPushTCPMessage.MessageType.PING.value)
            sendMessage(heartbeatData)
            DooPushLogger.d(TAG, "已发送心跳消息")
        }
    }
    
    /**
     * 开始心跳
     */
    private fun startHeartbeat() {
        stopHeartbeat()
        tcpHandler.post(heartbeatRunnable)
        DooPushLogger.i(TAG, "心跳定时器已启动，间隔: ${HEARTBEAT_INTERVAL}ms")
    }
    
    /**
     * 停止心跳
     */
    private fun stopHeartbeat() {
        tcpHandler.removeCallbacks(heartbeatRunnable)
        DooPushLogger.d(TAG, "心跳定时器已停止")
    }
    
    /**
     * 重连任务
     */
    private val reconnectRunnable = Runnable {
        if (shouldReconnect.get()) {
            connectInternal(gatewayConfig!!)
        }
    }
    
    /**
     * 安排重连
     */
    private fun scheduleReconnect() {
        if (!shouldReconnect.get()) {
            return
        }
        
        // 检查是否达到最大重连次数
        if (MAX_RECONNECT_ATTEMPTS > 0 && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            DooPushLogger.w(TAG, "已达到最大重连次数 ($MAX_RECONNECT_ATTEMPTS)，停止重连")
            return
        }
        
        reconnectAttempts++
        val delay = minOf(2.0.pow(reconnectAttempts.toDouble()).toLong() * 1000, MAX_RECONNECT_DELAY)
        
        DooPushLogger.i(TAG, "将在 ${delay}ms 后尝试重连 (第${reconnectAttempts}次)")
        
        tcpHandler.postDelayed(reconnectRunnable, delay)
    }
    
    /**
     * 安排温和的重连（用于正常断开的情况）
     */
    private fun scheduleGentleReconnect() {
        if (!shouldReconnect.get()) {
            return
        }
        
        // 检查是否达到最大重连次数
        if (MAX_RECONNECT_ATTEMPTS > 0 && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            DooPushLogger.w(TAG, "已达到最大重连次数 ($MAX_RECONNECT_ATTEMPTS)，停止重连")
            return
        }
        
        reconnectAttempts++
        // 正常断开使用固定的较长延迟，避免频繁重连
        val delay = 5000L // 5秒延迟
        
        DooPushLogger.d(TAG, "将在 ${delay}ms 后温和重连 (第${reconnectAttempts}次)")
        
        tcpHandler.postDelayed(reconnectRunnable, delay)
    }
    
    /**
     * 判断是否是正常的连接建立错误
     */
    private fun isNormalConnectionError(error: Throwable): Boolean {
        return when {
            // ConnectException: Connection refused - 服务器不可达或重启
            error is java.net.ConnectException -> true
            
            // SocketTimeoutException: 连接超时 - 网络慢或服务器忙
            error is java.net.SocketTimeoutException -> true
            
            // UnknownHostException: DNS解析失败 - 网络问题
            error is java.net.UnknownHostException -> true
            
            // NoRouteToHostException: 网络不可达
            error is java.net.NoRouteToHostException -> true
            
            else -> false
        }
    }
    
    /**
     * 判断是否是正常的连接断开错误
     */
    private fun isNormalDisconnectionError(error: Throwable): Boolean {
        return when {
            // SocketException: Software caused connection abort - 应用后台或系统断开连接
            error is java.net.SocketException && 
            error.message?.contains("Software caused connection abort") == true -> true
            
            // SocketException: Connection reset by peer - 服务器主动断开
            error is java.net.SocketException && 
            error.message?.contains("Connection reset by peer") == true -> true
            
            // SocketException: Broken pipe - 连接已断开但尝试写入
            error is java.net.SocketException && 
            error.message?.contains("Broken pipe") == true -> true
            
            // ConnectException: Connection refused - 服务器不可达（可能是暂时的）
            error is java.net.ConnectException && 
            error.message?.contains("Connection refused") == true -> true
            
            else -> false
        }
    }
    
    /**
     * 处理正常的连接断开
     */
    private fun handleConnectionDisconnect(error: Throwable) {
        DooPushLogger.i(TAG, "TCP连接断开，准备重连")
        lastError = DooPushErrorHandler.handleNetworkError(error)
        state = DooPushTCPState.FAILED
        
        // 正常断开时，延迟重连（避免频繁重连）
        scheduleGentleReconnect()
    }
    
    /**
     * 处理连接错误
     */
    private fun handleConnectionError(error: Throwable) {
        DooPushLogger.e(TAG, "TCP连接错误", error)
        lastError = DooPushErrorHandler.handleNetworkError(error)
        state = DooPushTCPState.FAILED
        scheduleReconnect()
    }
    
    /**
     * 检查连接是否就绪
     */
    private fun isConnectionReady(): Boolean {
        return state == DooPushTCPState.CONNECTED || 
               state == DooPushTCPState.REGISTERING || 
               state == DooPushTCPState.REGISTERED
    }
    
    /**
     * 检查连接是否健康
     */
    private fun isConnectionHealthy(): Boolean {
        val socket = this.socket
        return socket != null && socket.isConnected && !socket.isClosed
    }
}

package com.doopush.sdk.tcp

import com.doopush.sdk.DooPushError
import com.doopush.sdk.internal.DooPushLogger
import com.doopush.sdk.model.DooPushMessage
import com.doopush.sdk.model.DooPushMessageBuilder
import com.doopush.sdk.model.DooPushMessageType
import com.google.gson.Gson
import com.google.gson.JsonObject
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory

/**
 * DooPush TCP连接管理器
 * 负责与Gateway服务器建立和维护TCP长连接
 */
class DooPushTCPConnection {
    
    companion object {
        private const val CONNECT_TIMEOUT = 30000 // 30秒连接超时
        private const val READ_TIMEOUT = 60000 // 60秒读取超时
        private const val HEARTBEAT_INTERVAL = 30000L // 30秒心跳间隔
        private const val RECONNECT_DELAY_BASE = 2000L // 基础重连延迟2秒
        private const val MAX_RECONNECT_DELAY = 60000L // 最大重连延迟60秒
        private const val MAX_RECONNECT_ATTEMPTS = 0 // 0表示无限重连
    }
    
    // 连接配置
    private var host: String? = null
    private var port: Int = 0
    private var ssl: Boolean = false
    private var appId: String? = null
    private var deviceToken: String? = null
    
    // 连接状态
    private var currentState = DooPushTCPState.DISCONNECTED
    private val isConnecting = AtomicBoolean(false)
    private val shouldReconnect = AtomicBoolean(true)
    
    // 网络组件
    private var socket: Socket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null
    
    // 线程管理
    private val executor: ScheduledExecutorService = Executors.newScheduledThreadPool(3)
    private var readThread: Thread? = null
    private var heartbeatFuture: ScheduledFuture<*>? = null
    private var reconnectFuture: ScheduledFuture<*>? = null
    
    // 重连管理
    private var reconnectAttempts = 0
    
    // 消息缓冲
    private val messageBuffer = ByteArray(8192)
    private var bufferPosition = 0
    
    // 事件监听器
    private var listener: Listener? = null
    
    // JSON解析器
    private val gson = Gson()
    
    /**
     * TCP连接事件监听器
     */
    interface Listener {
        /**
         * 连接状态变化
         */
        fun onStateChanged(state: DooPushTCPState)
        
        /**
         * 设备注册成功
         */
        fun onDeviceRegistered()
        
        /**
         * 收到推送消息
         */
        fun onMessageReceived(message: DooPushMessage)
        
        /**
         * 发生错误
         */
        fun onError(error: DooPushError)
        
        /**
         * 收到心跳响应
         */
        fun onHeartbeatReceived()
    }
    
    /**
     * 获取当前连接状态
     */
    val state: DooPushTCPState
        get() = currentState
    
    /**
     * 设置事件监听器
     */
    fun setListener(listener: Listener?) {
        this.listener = listener
    }
    
    /**
     * 配置连接参数
     */
    fun configure(
        host: String,
        port: Int,
        ssl: Boolean = false,
        appId: String,
        deviceToken: String
    ) {
        this.host = host
        this.port = port
        this.ssl = ssl
        this.appId = appId
        this.deviceToken = deviceToken

        DooPushLogger.info("TCP连接配置完成 - $host:$port (SSL: $ssl)")
        DooPushLogger.info("TCP配置参数 - AppID: $appId (类型: ${appId::class.java.simpleName}), DeviceToken: ${deviceToken.take(10)}... (长度: ${deviceToken.length})")

        // 验证参数有效性
        if (appId.isEmpty()) {
            DooPushLogger.error("TCP配置错误: AppID为空")
        }
        if (deviceToken.isEmpty()) {
            DooPushLogger.error("TCP配置错误: DeviceToken为空")
        }
    }
    
    /**
     * 建立连接
     */
    fun connect() {
        if (host == null || port == 0 || appId == null || deviceToken == null) {
            val error = DooPushError.TCPConnectionFailed("TCP连接配置不完整")
            notifyError(error)
            return
        }
        
        if (isConnecting.get() || currentState.isConnected()) {
            DooPushLogger.warning("TCP连接已存在或正在连接中")
            return
        }
        
        shouldReconnect.set(true)
        connectInternal()
    }
    
    /**
     * 断开连接
     */
    fun disconnect() {
        DooPushLogger.info("主动断开TCP连接")
        shouldReconnect.set(false)
        disconnectInternal()
    }
    
    /**
     * 内部连接实现
     */
    private fun connectInternal() {
        if (!isConnecting.compareAndSet(false, true)) {
            return
        }
        
        executor.execute {
            try {
                DooPushLogger.info("开始建立TCP连接 - $host:$port")
                changeState(DooPushTCPState.CONNECTING)
                
                // 创建Socket连接
                val newSocket = if (ssl) {
                    val sslSocketFactory = SSLSocketFactory.getDefault()
                    sslSocketFactory.createSocket(host, port) as SSLSocket
                } else {
                    Socket()
                }
                
                // 设置超时
//                newSocket.connectTimeout = CONNECT_TIMEOUT
//                newSocket.soTimeout = READ_TIMEOUT
                newSocket.soTimeout = CONNECT_TIMEOUT

                if (!ssl) {
                    newSocket.connect(java.net.InetSocketAddress(host, port), CONNECT_TIMEOUT)
                }
                
                // 获取输入输出流
                val newInputStream = newSocket.getInputStream()
                val newOutputStream = newSocket.getOutputStream()
                
                // 保存连接
                socket = newSocket
                inputStream = newInputStream
                outputStream = newOutputStream
                
                DooPushLogger.info("TCP连接建立成功")
                changeState(DooPushTCPState.CONNECTED)
                
                // 重置重连计数
                reconnectAttempts = 0
                
                // 启动读取线程
                startReadThread()
                
                // 启动心跳
                startHeartbeat()
                
                // 发送设备注册消息
                registerDevice()
                
            } catch (e: Exception) {
                DooPushLogger.error("TCP连接失败: $e")
                val error = DooPushError.TCPConnectionFailed("连接失败: ${e.message}", e)
                handleConnectionError(error)
            } finally {
                isConnecting.set(false)
            }
        }
    }
    
    /**
     * 内部断开连接实现
     */
    private fun disconnectInternal() {
        try {
            // 停止心跳
            stopHeartbeat()
            
            // 停止重连
            stopReconnect()
            
            // 停止读取线程
            stopReadThread()
            
            // 关闭流和Socket
            inputStream?.close()
            outputStream?.close()
            socket?.close()
            
        } catch (e: Exception) {
            DooPushLogger.error("断开TCP连接时发生错误: $e")
        } finally {
            inputStream = null
            outputStream = null
            socket = null
            bufferPosition = 0
            
            changeState(DooPushTCPState.DISCONNECTED)
            DooPushLogger.info("TCP连接已断开")
        }
    }
    
    /**
     * 启动读取线程
     */
    private fun startReadThread() {
        readThread = Thread({
            try {
                readMessages()
            } catch (e: Exception) {
                DooPushLogger.error("读取消息线程异常: $e")
                if (shouldReconnect.get()) {
                    val error = DooPushError.TCPConnectionFailed("读取消息失败", e)
                    handleConnectionError(error)
                }
            }
        }, "DooPushTCP-Read")
        
        readThread?.start()
    }
    
    /**
     * 停止读取线程
     */
    private fun stopReadThread() {
        readThread?.interrupt()
        readThread = null
    }
    
    /**
     * 读取消息循环
     */
    private fun readMessages() {
        val inputStream = this.inputStream ?: return
        val buffer = ByteArray(1024)
        
        while (!Thread.currentThread().isInterrupted && currentState.isConnected()) {
            try {
                val bytesRead = inputStream.read(buffer)
                if (bytesRead == -1) {
                    // 连接已关闭
                    DooPushLogger.warning("TCP连接已被服务器关闭")
                    break
                }
                
                if (bytesRead > 0) {
                    processReceivedData(buffer, bytesRead)
                }
                
            } catch (e: SocketTimeoutException) {
                // 读取超时，继续循环
                continue
            } catch (e: IOException) {
                if (!Thread.currentThread().isInterrupted) {
                    DooPushLogger.error("读取TCP数据失败: $e")
                    break
                }
            }
        }
        
        // 读取循环结束，可能需要重连
        if (shouldReconnect.get() && currentState.isConnected()) {
            val error = DooPushError.TCPConnectionFailed("TCP连接意外断开")
            handleConnectionError(error)
        }
    }
    
    /**
     * 处理接收到的数据
     */
    private fun processReceivedData(buffer: ByteArray, length: Int) {
        // 将数据添加到消息缓冲区
        if (bufferPosition + length > messageBuffer.size) {
            DooPushLogger.error("消息缓冲区溢出")
            bufferPosition = 0
            return
        }
        
        System.arraycopy(buffer, 0, messageBuffer, bufferPosition, length)
        bufferPosition += length
        
        // 尝试解析完整消息
        parseMessages()
    }
    
    /**
     * 解析消息
     * 参考iOS实现：简单的消息格式 [类型1字节][数据]
     */
    private fun parseMessages() {
        // 参考iOS的简化处理方式
        while (bufferPosition >= 1) { // 至少需要类型(1)
            // 提取完整消息（类型 + 剩余所有数据）
            val messageBytes = ByteArray(bufferPosition)
            System.arraycopy(messageBuffer, 0, messageBytes, 0, bufferPosition)

            // 重置缓冲区（简化处理）
            bufferPosition = 0

            // 解析并处理消息
            val message = DooPushTCPMessage.fromByteArray(messageBytes)
            if (message != null) {
                handleMessage(message)
            } else {
                DooPushLogger.error("解析TCP消息失败，原始数据: ${messageBytes.joinToString(", ") { "0x${it.toUByte().toString(16).padStart(2, '0')}" }}")
            }

            // 简化处理：每次只处理一个消息
            break
        }
    }
    
    /**
     * 处理接收到的消息
     */
    private fun handleMessage(message: DooPushTCPMessage) {
        DooPushLogger.info("收到TCP消息: ${message.type} (长度: ${message.dataLength}字节)")
        DooPushLogger.debug("消息内容: ${message.getDataAsString()}")

        when (message.type) {
            DooPushTCPMessageType.PONG -> {
                handlePongMessage(message)
            }
            DooPushTCPMessageType.ACK -> {
                handleAckMessage(message)
            }
            DooPushTCPMessageType.PUSH -> {
                handlePushMessage(message)
            }
            DooPushTCPMessageType.ERROR -> {
                handleErrorMessage(message)
            }
            else -> {
                DooPushLogger.warning("收到未知类型的TCP消息: ${message.type}")
            }
        }
    }
    
    /**
     * 处理心跳响应
     */
    private fun handlePongMessage(message: DooPushTCPMessage) {
        DooPushLogger.debug("收到心跳响应")
        listener?.onHeartbeatReceived()
    }
    
    /**
     * 处理确认消息
     */
    private fun handleAckMessage(message: DooPushTCPMessage) {
        try {
            val dataString = message.getDataAsString()
            val ackData = gson.fromJson(dataString, JsonObject::class.java)
            
            val status = ackData.get("status")?.asString
            if (status == "ok" && currentState == DooPushTCPState.REGISTERING) {
                DooPushLogger.info("设备注册成功")
                changeState(DooPushTCPState.REGISTERED)
                listener?.onDeviceRegistered()
            }
        } catch (e: Exception) {
            DooPushLogger.error("处理ACK消息失败: $e")
        }
    }
    
    /**
     * 处理推送消息
     */
    private fun handlePushMessage(message: DooPushTCPMessage) {
        try {
            val dataString = message.getDataAsString()
            val pushData = gson.fromJson(dataString, JsonObject::class.java)
            
            // 构建DooPushMessage
            val dooPushMessage = DooPushMessageBuilder()
                .messageId(pushData.get("message_id")?.asString ?: "")
                .title(pushData.get("title")?.asString)
                .content(pushData.get("content")?.asString)
                .vendor("tcp")
                .messageType(DooPushMessageType.PASS_THROUGH)
                .build()
            
            DooPushLogger.info("通过TCP收到推送消息: ${dooPushMessage.title}")
            listener?.onMessageReceived(dooPushMessage)
            
        } catch (e: Exception) {
            DooPushLogger.error("处理推送消息失败: $e")
        }
    }
    
    /**
     * 处理错误消息
     */
    private fun handleErrorMessage(message: DooPushTCPMessage) {
        try {
            val dataString = message.getDataAsString()
            val errorData = gson.fromJson(dataString, JsonObject::class.java)
            
            val errorCode = errorData.get("error_code")?.asInt ?: 0
            val errorMessage = errorData.get("error_message")?.asString ?: "未知错误"
            
            DooPushLogger.error("收到服务器错误: $errorCode - $errorMessage")
            
            val error = DooPushError.TCPMessageError("服务器错误: $errorMessage")
            notifyError(error)
            
        } catch (e: Exception) {
            DooPushLogger.error("处理错误消息失败: $e")
        }
    }
    
    /**
     * 发送消息
     */
    private fun sendMessage(message: DooPushTCPMessage): Boolean {
        val outputStream = this.outputStream
        if (outputStream == null || !currentState.canSendMessage()) {
            DooPushLogger.warning("无法发送TCP消息，连接状态: $currentState")
            return false
        }
        
        return try {
            val messageBytes = message.toByteArray()
            outputStream.write(messageBytes)
            outputStream.flush()

            DooPushLogger.info("发送TCP消息: ${message.type} (长度: ${messageBytes.size}字节)")
            DooPushLogger.debug("消息内容: ${message.getDataAsString()}")

            true
        } catch (e: Exception) {
            DooPushLogger.error("发送TCP消息失败: $e")
            false
        }
    }
    
    /**
     * 注册设备
     */
    private fun registerDevice() {
        val appId = this.appId
        val deviceToken = this.deviceToken

        if (appId == null || deviceToken == null) {
            val error = DooPushError.TCPRegistrationFailed("设备注册参数缺失")
            notifyError(error)
            return
        }

        DooPushLogger.info("开始TCP设备注册")
        DooPushLogger.info("注册参数 - AppID: $appId, DeviceToken: $deviceToken")

        changeState(DooPushTCPState.REGISTERING)

        val registerMessage = DooPushTCPMessage.createRegisterMessage(appId, deviceToken)

        // 记录注册消息内容
        val messageData = registerMessage.data.toString(Charsets.UTF_8)
        DooPushLogger.info("TCP注册消息内容: $messageData")

        if (!sendMessage(registerMessage)) {
            val error = DooPushError.TCPRegistrationFailed("发送注册消息失败")
            notifyError(error)
        } else {
            DooPushLogger.info("TCP注册消息已发送")
        }
    }
    
    /**
     * 启动心跳
     */
    private fun startHeartbeat() {
        stopHeartbeat()
        
        heartbeatFuture = executor.scheduleWithFixedDelay({
            if (currentState.canSendMessage()) {
                val pingMessage = DooPushTCPMessage.createPingMessage()
                sendMessage(pingMessage)
            }
        }, HEARTBEAT_INTERVAL, HEARTBEAT_INTERVAL, TimeUnit.MILLISECONDS)
        
        DooPushLogger.debug("心跳已启动")
    }
    
    /**
     * 停止心跳
     */
    private fun stopHeartbeat() {
        heartbeatFuture?.cancel(false)
        heartbeatFuture = null
        DooPushLogger.debug("心跳已停止")
    }
    
    /**
     * 处理连接错误
     */
    private fun handleConnectionError(error: DooPushError) {
        changeState(DooPushTCPState.FAILED)
        notifyError(error)
        
        // 断开当前连接
        disconnectInternal()
        
        // 安排重连
        if (shouldReconnect.get()) {
            scheduleReconnect()
        }
    }
    
    /**
     * 安排重连
     */
    private fun scheduleReconnect() {
        if (MAX_RECONNECT_ATTEMPTS > 0 && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            DooPushLogger.error("达到最大重连次数，停止重连")
            return
        }
        
        reconnectAttempts++
        
        // 计算重连延迟（指数退避）
        val delay = minOf(
            RECONNECT_DELAY_BASE * (1L shl minOf(reconnectAttempts - 1, 6)),
            MAX_RECONNECT_DELAY
        )
        
        DooPushLogger.info("${delay}ms后尝试第${reconnectAttempts}次重连")
        
        reconnectFuture = executor.schedule({
            if (shouldReconnect.get()) {
                connectInternal()
            }
        }, delay, TimeUnit.MILLISECONDS)
    }
    
    /**
     * 停止重连
     */
    private fun stopReconnect() {
        reconnectFuture?.cancel(false)
        reconnectFuture = null
    }
    
    /**
     * 改变连接状态
     */
    private fun changeState(newState: DooPushTCPState) {
        if (currentState != newState) {
            val oldState = currentState
            currentState = newState
            
            DooPushLogger.info("TCP连接状态变化: $oldState -> $newState")
            listener?.onStateChanged(newState)
        }
    }
    
    /**
     * 通知错误
     */
    private fun notifyError(error: DooPushError) {
        listener?.onError(error)
    }
    
    /**
     * 销毁连接
     */
    fun destroy() {
        shouldReconnect.set(false)
        disconnect()
        
        executor.shutdown()
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow()
            }
        } catch (e: InterruptedException) {
            executor.shutdownNow()
        }
        
        DooPushLogger.info("TCP连接管理器已销毁")
    }
}
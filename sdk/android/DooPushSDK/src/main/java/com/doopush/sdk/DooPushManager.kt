package com.doopush.sdk

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.doopush.sdk.internal.DooPushLogger
import com.doopush.sdk.internal.DooPushStorage
import com.doopush.sdk.internal.DeviceInfoManager
import com.doopush.sdk.model.DooPushMessage
import com.doopush.sdk.network.DooPushNetworking
import com.doopush.sdk.notification.DooPushNotificationChannel
import com.doopush.sdk.notification.DooPushNotificationChannelGroup
import com.doopush.sdk.notification.DooPushNotificationChannelManager
import com.doopush.sdk.tcp.DooPushTCPConnection
import com.doopush.sdk.tcp.DooPushTCPState
import com.doopush.sdk.vendor.PushVendorManager
import java.util.concurrent.CopyOnWriteArrayList

/**
 * DooPush SDK 主管理类
 */
class DooPushManager private constructor() {
    
    companion object {
        /**
         * SDK版本
         */
        const val SDK_VERSION = "1.0.0"
        
        /**
         * 单例实例
         */
        @JvmStatic
        val instance: DooPushManager by lazy { DooPushManager() }
    }
    
    // MARK: - 私有属性
    
    private var context: Context? = null
    private var config: DooPushConfig? = null
    private val listeners = CopyOnWriteArrayList<DooPushListener>()
    
    // 内部组件
    private lateinit var storage: DooPushStorage
    private lateinit var networking: DooPushNetworking
    private lateinit var deviceInfoManager: DeviceInfoManager
    private lateinit var vendorManager: PushVendorManager
    private lateinit var tcpConnection: DooPushTCPConnection
    private lateinit var notificationChannelManager: DooPushNotificationChannelManager
    
    // 状态管理
    private var isInitialized = false
    private var isRegistering = false
    private var pendingDeviceToken: String? = null
    
    // MARK: - 公共API
    
    /**
     * 初始化SDK
     * @param application 应用实例
     * @param config SDK配置
     */
    fun initialize(application: Application, config: DooPushConfig) {
        if (isInitialized) {
            DooPushLogger.warning("SDK已经初始化，忽略重复初始化")
            return
        }
        
        if (!config.isValid) {
            val error = DooPushError.InvalidConfiguration
            DooPushLogger.error("SDK配置无效: $error")
            notifyError(error)
            return
        }
        
        this.context = application.applicationContext
        this.config = config
        
        // 初始化日志
        DooPushLogger.initialize(config.debugEnabled)
        
        // 初始化内部组件
        initializeComponents()
        
        // 检查权限
        checkPermissions()
        
        // 初始化推送厂商
        initializeVendors()
        
        isInitialized = true
        
        DooPushLogger.info("DooPush SDK 初始化完成 - 版本: $SDK_VERSION, AppID: ${config.appId}")
    }
    
    /**
     * 注册推送通知
     * @param listener 注册结果监听器
     */
    fun registerForPushNotifications(listener: DooPushRegistrationListener? = null) {
        if (!checkInitialized()) {
            listener?.onRegistrationResult(null, DooPushError.NotConfigured)
            return
        }
        
        if (isRegistering) {
            DooPushLogger.warning("正在注册中，忽略重复请求")
            return
        }
        
        isRegistering = true
        DooPushLogger.info("开始注册推送通知")
        
        // 通过推送厂商管理器注册
        vendorManager.registerForPushNotifications { deviceToken, error ->
            isRegistering = false
            
            if (error != null) {
                DooPushLogger.error("推送注册失败: $error")
                listener?.onRegistrationResult(null, error)
                notifyError(error)
                return@registerForPushNotifications
            }
            
            if (deviceToken != null) {
                DooPushLogger.info("推送注册成功，设备token: $deviceToken")
                registerDeviceToServer(deviceToken, listener)
            } else {
                val unknownError = DooPushError.Unknown("未知的注册错误")
                listener?.onRegistrationResult(null, unknownError)
                notifyError(unknownError)
            }
        }
    }
    
    /**
     * 处理推送消息
     * @param message 推送消息
     */
    fun handlePushMessage(message: DooPushMessage) {
        if (!checkInitialized()) {
            return
        }
        
        DooPushLogger.info("收到推送消息: ${message.title}")
        
        // 通知监听器
        notifyMessageReceived(message)
        
        // 记录统计
        recordMessageReceived(message)
    }
    
    /**
     * 更新设备信息
     */
    fun updateDeviceInfo() {
        if (!checkInitialized()) {
            return
        }
        
        val deviceToken = storage.getDeviceToken()
        if (deviceToken == null) {
            DooPushLogger.warning("无法更新设备信息：设备token缺失")
            return
        }
        
        val deviceInfo = deviceInfoManager.getCurrentDeviceInfo()
        
//        networking.updateDevice(
//            config!!.appId,
//            deviceToken,
//            deviceInfo
//        ) { result ->
//            when (result) {
//                is Result.Success -> {
//                    DooPushLogger.info("设备信息更新成功")
//                    storage.saveLastDeviceUpdateTime()
//                    notifyDeviceInfoUpdated()
//                }
//                is Result.Error -> {
//                    DooPushLogger.error("设备信息更新失败: ${result.error}")
//                    notifyError(result.error)
//                }
//            }
//        }
    }
    
    /**
     * 添加事件监听器
     */
    fun addListener(listener: DooPushListener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
        }
    }
    
    /**
     * 移除事件监听器
     */
    fun removeListener(listener: DooPushListener) {
        listeners.remove(listener)
    }
    
    /**
     * 获取设备token
     */
    fun getDeviceToken(): String? {
        return if (checkInitialized()) {
            storage.getDeviceToken()
        } else {
            null
        }
    }
    
    /**
     * 获取设备ID
     */
    fun getDeviceId(): String? {
        return if (checkInitialized()) {
            storage.getDeviceId()
        } else {
            null
        }
    }
    
    /**
     * 获取TCP连接状态
     */
    fun getTCPConnectionState(): DooPushTCPState {
        return if (checkInitialized()) {
            tcpConnection.state
        } else {
            DooPushTCPState.DISCONNECTED
        }
    }
    
    /**
     * 手动连接TCP
     */
    fun connectTCP() {
        if (checkInitialized()) {
            tcpConnection.connect()
        }
    }
    
    /**
     * 手动断开TCP
     */
    fun disconnectTCP() {
        if (checkInitialized()) {
            tcpConnection.disconnect()
        }
    }
    
    // MARK: - 通知渠道管理API
    
    /**
     * 创建通知渠道
     * @param channelConfig 通知渠道配置
     * @return 是否创建成功
     */
    fun createNotificationChannel(channelConfig: DooPushNotificationChannel): Boolean {
        return if (checkInitialized()) {
            notificationChannelManager.createNotificationChannel(channelConfig)
        } else {
            false
        }
    }
    
    /**
     * 批量创建通知渠道
     * @param channelConfigs 通知渠道配置列表
     * @return 成功创建的数量
     */
    fun createNotificationChannels(channelConfigs: List<DooPushNotificationChannel>): Int {
        return if (checkInitialized()) {
            notificationChannelManager.createNotificationChannels(channelConfigs)
        } else {
            0
        }
    }
    
    /**
     * 创建通知渠道分组
     * @param groupConfig 通知渠道分组配置
     * @return 是否创建成功
     */
    fun createNotificationChannelGroup(groupConfig: DooPushNotificationChannelGroup): Boolean {
        return if (checkInitialized()) {
            notificationChannelManager.createNotificationChannelGroup(groupConfig)
        } else {
            false
        }
    }
    
    /**
     * 删除通知渠道
     * @param channelId 渠道ID
     * @return 是否删除成功
     */
    fun deleteNotificationChannel(channelId: String): Boolean {
        return if (checkInitialized()) {
            notificationChannelManager.deleteNotificationChannel(channelId)
        } else {
            false
        }
    }
    
    /**
     * 删除通知渠道分组
     * @param groupId 分组ID
     * @return 是否删除成功
     */
    fun deleteNotificationChannelGroup(groupId: String): Boolean {
        return if (checkInitialized()) {
            notificationChannelManager.deleteNotificationChannelGroup(groupId)
        } else {
            false
        }
    }
    
    /**
     * 检查通知渠道是否存在
     * @param channelId 渠道ID
     * @return 是否存在
     */
    fun isNotificationChannelExists(channelId: String): Boolean {
        return if (checkInitialized()) {
            notificationChannelManager.isChannelExists(channelId)
        } else {
            false
        }
    }
    
    /**
     * 检查通知渠道是否被用户禁用
     * @param channelId 渠道ID
     * @return 是否被禁用
     */
    fun isNotificationChannelBlocked(channelId: String): Boolean {
        return if (checkInitialized()) {
            notificationChannelManager.isChannelBlocked(channelId)
        } else {
            false
        }
    }
    
    /**
     * 获取所有通知渠道
     * @return 通知渠道列表
     */
    fun getAllNotificationChannels(): List<android.app.NotificationChannel> {
        return if (checkInitialized()) {
            notificationChannelManager.getAllNotificationChannels()
        } else {
            emptyList()
        }
    }
    
    /**
     * 获取所有通知渠道分组
     * @return 通知渠道分组列表
     */
    fun getAllNotificationChannelGroups(): List<android.app.NotificationChannelGroup> {
        return if (checkInitialized()) {
            notificationChannelManager.getAllNotificationChannelGroups()
        } else {
            emptyList()
        }
    }
    
    /**
     * 打开系统通知设置页面
     */
    fun openNotificationSettings() {
        if (checkInitialized()) {
            notificationChannelManager.openNotificationSettings()
        }
    }
    
    /**
     * 打开特定渠道的设置页面
     * @param channelId 渠道ID
     */
    fun openNotificationChannelSettings(channelId: String) {
        if (checkInitialized()) {
            notificationChannelManager.openChannelSettings(channelId)
        }
    }
    
    /**
     * 检查是否支持通知渠道功能（Android 8.0+）
     * @return 是否支持
     */
    fun isNotificationChannelSupported(): Boolean {
        return if (checkInitialized()) {
            notificationChannelManager.isNotificationChannelSupported()
        } else {
            false
        }
    }
    
    /**
     * 获取通知渠道统计信息
     * @return 统计信息Map
     */
    fun getNotificationChannelStats(): Map<String, Any> {
        return if (checkInitialized()) {
            notificationChannelManager.getChannelStats()
        } else {
            emptyMap()
        }
    }
    
    // MARK: - 私有方法
    
    private fun checkInitialized(): Boolean {
        if (!isInitialized) {
            DooPushLogger.error("SDK未初始化，请先调用initialize方法")
            notifyError(DooPushError.NotConfigured)
            return false
        }
        return true
    }
    
    private fun initializeComponents() {
        val context = this.context!!
        val config = this.config!!
        
        storage = DooPushStorage(context)
        networking = DooPushNetworking(config)
        deviceInfoManager = DeviceInfoManager(context)
        vendorManager = PushVendorManager(context)
        tcpConnection = DooPushTCPConnection()
        notificationChannelManager = DooPushNotificationChannelManager(context)
        
        // 保存配置
        storage.saveConfig(config)
        
        // 设置TCP连接监听器
        tcpConnection.setListener(object : DooPushTCPConnection.Listener {
            override fun onStateChanged(state: DooPushTCPState) {
                notifyTCPStateChanged(state)
            }
            
            override fun onDeviceRegistered() {
                notifyTCPDeviceRegistered()
            }
            
            override fun onMessageReceived(message: DooPushMessage) {
                handlePushMessage(message)
            }
            
            override fun onError(error: DooPushError) {
                notifyError(error)
            }
            
            override fun onHeartbeatReceived() {
                notifyTCPHeartbeatReceived()
            }
        })
        
        // 初始化默认通知渠道
        notificationChannelManager.initializeDefaultChannels()
    }
    
    private fun checkPermissions() {
        val context = this.context!!
        
        // 检查网络权限
        val internetPermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.INTERNET
        )
        
        if (internetPermission != PackageManager.PERMISSION_GRANTED) {
            DooPushLogger.warning("缺少INTERNET权限")
        }
        
        // 检查其他必要权限
        val networkStatePermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_NETWORK_STATE
        )
        
        if (networkStatePermission != PackageManager.PERMISSION_GRANTED) {
            DooPushLogger.warning("缺少ACCESS_NETWORK_STATE权限")
        }
    }
    
    private fun initializeVendors() {
        vendorManager.initialize { vendor, error ->
            if (error != null) {
                DooPushLogger.error("推送厂商 $vendor 初始化失败: $error")
                notifyVendorInitializationFailed(vendor, error)
            } else {
                DooPushLogger.info("推送厂商 $vendor 初始化成功")
                notifyVendorInitialized(vendor)
            }
        }
    }
    
    private fun registerDeviceToServer(
        deviceToken: String,
        listener: DooPushRegistrationListener?
    ) {
        val config = this.config!!
        val deviceInfo = deviceInfoManager.getCurrentDeviceInfo()
        
        networking.registerDevice(
            config.appId,
            deviceToken,
            deviceInfo
        ) { result ->
            when (result) {
                is Result.Success -> {
                    val response = result.data
                    DooPushLogger.info("设备注册成功: ${response.device.id}")
                    
                    // 保存设备信息
                    storage.saveDeviceToken(deviceToken)
                    storage.saveDeviceId(response.device.id.toString())
                    
                    // 连接TCP Gateway
                    connectToGateway(response, deviceToken)
                    
                    // 通知监听器
                    listener?.onRegistrationResult(deviceToken, null)
                    notifyDeviceRegistered(deviceToken)
                    
                }
                is Result.Error -> {
                    DooPushLogger.error("设备注册失败: ${result.error}")
                    
                    // 如果是网络错误，保存token用于重试
                    if (result.error.isNetworkError) {
                        pendingDeviceToken = deviceToken
                    }
                    
                    listener?.onRegistrationResult(null, result.error)
                    notifyError(result.error)
                }
            }
        }
    }
    
    private fun connectToGateway(
        response: com.doopush.sdk.network.DeviceRegistrationResponse,
        deviceToken: String
    ) {
        val config = this.config!!
        val gatewayConfig = response.gateway
        
        DooPushLogger.info("准备连接Gateway - ${gatewayConfig.host}:${gatewayConfig.port}")
        DooPushLogger.info("Gateway连接参数 - AppID: ${config.appId}, DeviceToken: ${deviceToken.take(10)}...")

        tcpConnection.configure(
            host = gatewayConfig.host,
            port = gatewayConfig.port,
            ssl = gatewayConfig.ssl,
            appId = config.appId,
            deviceToken = deviceToken
        )

        tcpConnection.connect()
    }
    
    private fun recordMessageReceived(message: DooPushMessage) {
        // TODO: 实现推送统计上报
        DooPushLogger.debug("推送统计记录: ${message.messageId}")
    }
    
    // MARK: - 通知方法
    
    private fun notifyDeviceRegistered(deviceToken: String) {
        listeners.forEach { it.onDeviceRegistered(deviceToken) }
    }
    
    private fun notifyMessageReceived(message: DooPushMessage) {
        listeners.forEach { it.onMessageReceived(message) }
    }
    
    private fun notifyError(error: DooPushError) {
        listeners.forEach { it.onError(error) }
    }
    
    private fun notifyDeviceInfoUpdated() {
        listeners.forEach { it.onDeviceInfoUpdated() }
    }
    
    private fun notifyTCPStateChanged(state: DooPushTCPState) {
        listeners.forEach { it.onTCPConnectionStateChanged(state) }
    }
    
    private fun notifyTCPDeviceRegistered() {
        listeners.forEach { it.onTCPDeviceRegistered() }
    }
    
    private fun notifyTCPHeartbeatReceived() {
        listeners.forEach { it.onTCPHeartbeatReceived() }
    }
    
    private fun notifyVendorInitialized(vendor: String) {
        listeners.forEach { it.onVendorInitialized(vendor) }
    }
    
    private fun notifyVendorInitializationFailed(vendor: String, error: DooPushError) {
        listeners.forEach { it.onVendorInitializationFailed(vendor, error) }
    }
}

/**
 * 结果封装类
 */
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val error: DooPushError) : Result<Nothing>()
}
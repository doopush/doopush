package com.doopush.sdk

import android.content.Context
import android.util.Log
import android.os.Handler
import android.os.Looper
import com.doopush.sdk.models.DeviceInfo
import com.doopush.sdk.models.DooPushError
import com.doopush.sdk.models.PushMessage
import com.doopush.sdk.badge.BadgeManager
import java.util.concurrent.atomic.AtomicBoolean

/**
 * DooPush SDK 主管理类
 * 
 * 提供 SDK 的统一入口和管理功能，集成所有核心组件
 */
class DooPushManager private constructor() {
    
    companion object {
        private const val TAG = "DooPushManager"
        
        @Volatile
        private var INSTANCE: DooPushManager? = null
        
        /**
         * 获取单例实例
         */
        @JvmStatic
        fun getInstance(): DooPushManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: DooPushManager().also { INSTANCE = it }
            }
        }
        
        /**
         * 检查是否已初始化
         */
        @JvmStatic
        fun isInitialized(): Boolean {
            return INSTANCE?.isConfigured?.get() == true
        }
        
        /**
         * 检查是否有活动的回调监听器
         */
        @JvmStatic
        fun hasActiveCallback(): Boolean {
            return INSTANCE?.callback != null
        }
    }
    
    // 核心组件
    private var config: DooPushConfig? = null
    private var deviceManager: DooPushDevice? = null
    private var networking: DooPushNetworking? = null
    private var fcmService: FCMService? = null
    private var hmsService: HMSService? = null
    private var xiaomiService: XiaomiService? = null
    private var oppoService: OppoService? = null
    private var vivoService: VivoService? = null
    private var tcpConnection: DooPushTCPConnection? = null
    private var applicationContext: Context? = null
    
    // 状态管理
    private val isConfigured = AtomicBoolean(false)
    private val isRegistering = AtomicBoolean(false)
    
    // Handler
    private val mainHandler = Handler(Looper.getMainLooper())
    
    // 回调监听器
    private var callback: DooPushCallback? = null
    
    // 设备信息缓存
    private var cachedDeviceInfo: DeviceInfo? = null
    private var cachedToken: String? = null
    
    init {
        Log.d(TAG, "DooPushManager 初始化")
        setupFirebaseMessageListener()
    }
    
    /**
     * TCP连接代理实现
     */
    private val tcpConnectionDelegate = object : DooPushTCPConnectionDelegate {
        override fun onStateChanged(connection: DooPushTCPConnection, state: DooPushTCPState) {
            Log.d(TAG, "TCP连接状态变更: ${state.description}")
            callback?.onTCPStateChanged(state)
        }
        
        override fun onRegisterSuccessfully(connection: DooPushTCPConnection, message: DooPushTCPMessage) {
            Log.i(TAG, "TCP设备注册成功")
            callback?.onTCPRegistered()
        }
        
        override fun onReceiveError(connection: DooPushTCPConnection, error: DooPushError, message: String) {
            Log.e(TAG, "TCP连接错误: ${error.message} - $message")
            callback?.onTCPError(error, message)
        }
        
        override fun onReceiveHeartbeatResponse(connection: DooPushTCPConnection, message: DooPushTCPMessage) {
            Log.d(TAG, "收到TCP心跳响应")
            callback?.onTCPHeartbeat()
        }
        
        override fun onReceivePushMessage(connection: DooPushTCPConnection, message: DooPushTCPMessage) {
            Log.i(TAG, "收到TCP推送消息")
            // 可以在这里解析推送消息并通过callback传递给应用
            callback?.onTCPPushMessage(message)
        }
    }
    
    /**
     * 配置 DooPush SDK
     * 
     * @param context Android上下文
     * @param appId 应用ID
     * @param apiKey API密钥
     * @param baseURL 服务器基础URL (可选)
     * @param hmsConfig HMS推送配置 (可选)
     * @param xiaomiConfig 小米推送配置 (可选)
     * @param oppoConfig OPPO推送配置 (可选)
     * @param vivoConfig VIVO推送配置 (可选)
     * @throws DooPushConfigException 配置参数无效时抛出
     */
    @Throws(DooPushConfigException::class)
    fun configure(
        context: Context,
        appId: String,
        apiKey: String,
        baseURL: String = DooPushConfig.DEFAULT_BASE_URL,
        hmsConfig: DooPushConfig.HMSConfig? = null,
        xiaomiConfig: DooPushConfig.XiaomiConfig? = null,
        oppoConfig: DooPushConfig.OppoConfig? = null,
        vivoConfig: DooPushConfig.VivoConfig? = null
    ) {
        try {
            Log.d(TAG, "开始配置 DooPush SDK")
            
            // 保存应用上下文
            applicationContext = context.applicationContext
            
            // 智能配置处理：华为设备自动启用HMS
            val finalHmsConfig = if (hmsConfig == null) {
                val vendorInfo = DooPushDeviceVendor.getDeviceVendorInfo()
                if (vendorInfo.preferredService == DooPushDeviceVendor.PushService.HMS) {
                    Log.d(TAG, "检测到华为设备，自动启用HMS推送服务")
                    DooPushConfig.HMSConfig() // 零配置，自动从 agconnect-services.json 读取
                } else {
                    null
                }
            } else {
                hmsConfig
            }
            
            // 智能配置处理：小米设备自动启用小米推送
            val finalXiaomiConfig = if (xiaomiConfig == null) {
                val vendorInfo = DooPushDeviceVendor.getDeviceVendorInfo()
                if (vendorInfo.preferredService == DooPushDeviceVendor.PushService.MIPUSH) {
                    Log.d(TAG, "检测到小米设备，自动启用小米推送服务")
                    DooPushConfig.XiaomiConfig() // 零配置，自动从 xiaomi-services.json 读取
                } else {
                    null
                }
            } else {
                xiaomiConfig
            }
            
            // 智能配置处理：OPPO设备自动启用OPPO推送
            val finalOppoConfig = if (oppoConfig == null) {
                val vendorInfo = DooPushDeviceVendor.getDeviceVendorInfo()
                if (vendorInfo.preferredService == DooPushDeviceVendor.PushService.OPPO) {
                    Log.d(TAG, "检测到OPPO设备，自动启用OPPO推送服务")
                    DooPushConfig.OppoConfig() // 零配置，自动从 oppo-services.json 读取
                } else {
                    null
                }
            } else {
                oppoConfig
            }
            
            // 智能配置处理：VIVO设备自动启用VIVO推送
            val finalVivoConfig = if (vivoConfig == null) {
                val vendorInfo = DooPushDeviceVendor.getDeviceVendorInfo()
                if (vendorInfo.preferredService == DooPushDeviceVendor.PushService.VIVO) {
                    Log.d(TAG, "检测到VIVO设备，自动启用VIVO推送服务")
                    DooPushConfig.VivoConfig() // 零配置，自动从 vivo-services.json 读取
                } else {
                    null
                }
            } else {
                vivoConfig
            }
            
            // 创建配置
            config = DooPushConfig.create(appId, apiKey, baseURL, finalHmsConfig, finalXiaomiConfig, finalOppoConfig, finalVivoConfig)

            // 初始化各组件
            deviceManager = DooPushDevice(applicationContext!!)
            networking = DooPushNetworking(config!!).apply {
                // 设置设备Token提供者
                setDeviceTokenProvider { cachedToken }
            }
            fcmService = FCMService(context.applicationContext)
            hmsService = HMSService(context.applicationContext)
            xiaomiService = XiaomiService(context.applicationContext).apply {
                // 设置服务实例到接收器
                XiaomiPushReceiver.setService(this)
                // 延迟初始化：在注册或获取Token时再进行
                Log.d(TAG, "小米推送服务实例已创建（延迟初始化）")
            }
            oppoService = OppoService(context.applicationContext).apply {
                // 让接收器持有服务实例，便于通过接收器回调成功/失败
                OppoPushReceiver.setService(this)
                // 延迟初始化：在注册或获取Token时再进行
                Log.d(TAG, "OPPO推送服务实例已创建（延迟初始化）")
            }
            vivoService = VivoService(context.applicationContext).apply {
                // 让接收器持有服务实例，便于通过接收器回调成功/失败
                VivoPushReceiver.setService(this)
                // 延迟初始化：在注册或获取Token时再进行
                Log.d(TAG, "VIVO推送服务实例已创建（延迟初始化）")
            }
            tcpConnection = DooPushTCPConnection().apply {
                delegate = tcpConnectionDelegate
            }
            
            // 配置统计管理器
            DooPushStatistics.configure(networking!!) { cachedToken }
            
            // 设置配置状态
            isConfigured.set(true)
            
            Log.i(TAG, "DooPush SDK 配置完成")
            Log.d(TAG, config!!.getSummary())
            
        } catch (e: Exception) {
            Log.e(TAG, "DooPush SDK 配置失败", e)
            isConfigured.set(false)
            throw e
        }
    }
    
    /**
     * 设置回调监听器
     * 
     * @param callback 回调监听器
     */
    fun setCallback(callback: DooPushCallback?) {
        this.callback = callback
        Log.d(TAG, "回调监听器已${if (callback != null) "设置" else "移除"}")
    }
    
    /**
     * 注册推送通知
     * 
     * @param callback 注册回调 (可选，如果提供则覆盖全局回调)
     */
    fun registerForPushNotifications(callback: DooPushRegisterCallback? = null) {
        if (!checkInitialized()) {
            val error = DooPushError.configNotInitialized()
            callback?.onError(error) ?: this.callback?.onRegisterError(error)
            return
        }
        
        if (isRegistering.get()) {
            Log.w(TAG, "正在注册中，跳过重复请求")
            return
        }
        
        Log.d(TAG, "开始注册推送通知")
        isRegistering.set(true)
        
        // 超时保护，避免底层SDK无回调导致卡住
        mainHandler.postDelayed({
            if (isRegistering.get()) {
                isRegistering.set(false)
                val error = DooPushError.networkTimeout("注册推送超时，请检查设备网络或厂商服务可用性")
                Log.e(TAG, error.getFullDescription())
                callback?.onError(error) ?: this.callback?.onRegisterError(error)
            }
        }, 15000L)
        
        try {
            // 根据设备厂商选择最优推送服务
            val recommendedService = DooPushDeviceVendor.getRecommendedService(applicationContext!!)
            Log.d(TAG, "推荐的推送服务: $recommendedService")
            
            when (recommendedService) {
                DooPushDeviceVendor.PushService.HMS -> {
                    if (config?.hasHMSConfig() == true) {
                        // 先组装设备信息（channel=huawei）
                        val deviceInfo = deviceManager!!.getCurrentDeviceInfo("huawei")
                        cachedDeviceInfo = deviceInfo
                        
                        hmsService!!.getToken(
                            config!!.hmsConfig!!,
                            object : HMSService.TokenCallback {
                                override fun onSuccess(token: String) {
                                    Log.d(TAG, "HMS Token获取成功: ${token.substring(0, 12)}...")
                                    cachedToken = token
                                    // 调用设备注册API
                                    registerDeviceToServer(deviceInfo, token, callback)
                                }
                                
                                override fun onError(error: DooPushError) {
                                    Log.e(TAG, "HMS Token获取失败: ${error.message}")
                                    isRegistering.set(false)
                                    callback?.onError(error) ?: this@DooPushManager.callback?.onRegisterError(error)
                                }
                            }
                        )
                    } else {
                        Log.w(TAG, "HMS未配置，fallback到FCM")
                        registerWithFCM(callback)
                    }
                }
                DooPushDeviceVendor.PushService.MIPUSH -> {
                    if (config?.hasXiaomiConfig() == true) {
                        // 组装设备信息（channel=xiaomi）
                        val deviceInfo = deviceManager!!.getCurrentDeviceInfo("xiaomi")
                        cachedDeviceInfo = deviceInfo
                        
                        xiaomiService!!.getToken(
                            object : XiaomiService.TokenCallback {
                                override fun onSuccess(token: String) {
                                    Log.d(TAG, "小米推送Token获取成功: ${token.substring(0, 12)}...")
                                    cachedToken = token
                                    // 调用设备注册API
                                    registerDeviceToServer(deviceInfo, token, callback)
                                }
                                
                                override fun onError(error: DooPushError) {
                                    Log.e(TAG, "小米推送Token获取失败: ${error.message}")
                                    isRegistering.set(false)
                                    callback?.onError(error) ?: this@DooPushManager.callback?.onRegisterError(error)
                                }
                            }
                        )
                    } else {
                        Log.w(TAG, "小米推送未配置，fallback到FCM")
                        registerWithFCM(callback)
                    }
                }
                DooPushDeviceVendor.PushService.OPPO -> {
                    if (config?.hasOppoConfig() == true) {
                        // 组装设备信息（channel=oppo）
                        val deviceInfo = deviceManager!!.getCurrentDeviceInfo("oppo")
                        cachedDeviceInfo = deviceInfo
                        
                        oppoService!!.getToken(
                            object : OppoService.TokenCallback {
                                override fun onSuccess(token: String) {
                                    Log.d(TAG, "OPPO推送Token获取成功: ${token.substring(0, 12)}...")
                                    cachedToken = token
                                    // 调用设备注册API
                                    registerDeviceToServer(deviceInfo, token, callback)
                                }
                                
                                override fun onError(error: DooPushError) {
                                    Log.e(TAG, "OPPO推送Token获取失败: ${error.message}")
                                    isRegistering.set(false)
                                    callback?.onError(error) ?: this@DooPushManager.callback?.onRegisterError(error)
                                }
                            }
                        )
                    } else {
                        Log.w(TAG, "OPPO推送未配置，fallback到FCM")
                        registerWithFCM(callback)
                    }
                }
                DooPushDeviceVendor.PushService.VIVO -> {
                    if (config?.hasVivoConfig() == true) {
                        // 组装设备信息（channel=vivo）
                        val deviceInfo = deviceManager!!.getCurrentDeviceInfo("vivo")
                        cachedDeviceInfo = deviceInfo
                        
                        vivoService!!.getToken(
                            object : VivoService.TokenCallback {
                                override fun onSuccess(token: String) {
                                    Log.d(TAG, "VIVO推送Token获取成功: ${token.substring(0, 12)}...")
                                    cachedToken = token
                                    // 调用设备注册API
                                    registerDeviceToServer(deviceInfo, token, callback)
                                }
                                
                                override fun onError(error: DooPushError) {
                                    Log.e(TAG, "VIVO推送Token获取失败: ${error.message}")
                                    isRegistering.set(false)
                                    callback?.onError(error) ?: this@DooPushManager.callback?.onRegisterError(error)
                                }
                            }
                        )
                    } else {
                        Log.w(TAG, "VIVO推送未配置，fallback到FCM")
                        registerWithFCM(callback)
                    }
                }
                else -> {
                    // 其他设备默认使用FCM
                    registerWithFCM(callback)
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "注册推送通知时发生异常", e)
            isRegistering.set(false)
            val error = DooPushError.fromException(e)
            callback?.onError(error) ?: this.callback?.onRegisterError(error)
        }
    }

    private fun registerWithFCM(callback: DooPushRegisterCallback?) {
        // 获取设备信息（channel=fcm）
        val deviceInfo = deviceManager!!.getCurrentDeviceInfo("fcm")
        cachedDeviceInfo = deviceInfo
        
        fcmService!!.getToken(object : FCMService.TokenCallback {
            override fun onSuccess(token: String) {
                Log.d(TAG, "FCM Token获取成功: ${token.substring(0, 12)}...")
                cachedToken = token
                // 调用设备注册API
                registerDeviceToServer(deviceInfo, token, callback)
            }
            
            override fun onError(error: DooPushError) {
                Log.e(TAG, "FCM Token获取失败: ${error.message}")
                isRegistering.set(false)
                callback?.onError(error) ?: this@DooPushManager.callback?.onRegisterError(error)
            }
        })
    }
    
    /**
     * 获取FCM Token
     * 
     * @param callback Token获取回调
     */
    fun getFCMToken(callback: DooPushTokenCallback) {
        if (!checkInitialized()) {
            callback.onError(DooPushError.configNotInitialized())
            return
        }
        
        // 如果有缓存的token，直接返回
        cachedToken?.let { token ->
            Log.d(TAG, "返回缓存的FCM Token: ${token.substring(0, 12)}...")
            callback.onSuccess(token)
            return
        }
        
        // 获取新的token
        fcmService!!.getToken(object : FCMService.TokenCallback {
            override fun onSuccess(token: String) {
                cachedToken = token
                callback.onSuccess(token)
            }
            
            override fun onError(error: DooPushError) {
                callback.onError(error)
            }
        })
    }
    
    /**
     * 获取HMS Token
     * 
     * @param callback Token获取回调
     */
    fun getHMSToken(callback: DooPushTokenCallback) {
        if (!checkInitialized()) {
            callback.onError(DooPushError.configNotInitialized())
            return
        }
        
        val hmsConfig = config?.hmsConfig
        if (hmsConfig == null || !hmsConfig.isValid()) {
            callback.onError(DooPushError.hmsConfigInvalid())
            return
        }
        
        hmsService!!.getToken(
            hmsConfig,
            object : HMSService.TokenCallback {
                override fun onSuccess(token: String) {
                    Log.d(TAG, "HMS Token获取成功: ${token.substring(0, 12)}...")
                    callback.onSuccess(token)
                }
                
                override fun onError(error: DooPushError) {
                    Log.e(TAG, "HMS Token获取失败: ${error.message}")
                    callback.onError(error)
                }
            }
        )
    }
    
    /**
     * 获取小米推送Token
     * 
     * @param callback Token获取回调
     */
    fun getXiaomiToken(callback: DooPushTokenCallback) {
        if (!checkInitialized()) {
            callback.onError(DooPushError.configNotInitialized())
            return
        }
        
        xiaomiService!!.getToken(
            object : XiaomiService.TokenCallback {
                override fun onSuccess(token: String) {
                    Log.d(TAG, "小米推送Token获取成功: ${token.substring(0, 12)}...")
                    callback.onSuccess(token)
                }
                
                override fun onError(error: DooPushError) {
                    Log.e(TAG, "小米推送Token获取失败: ${error.message}")
                    callback.onError(error)
                }
            }
        )
    }
    
    /**
     * 获取VIVO推送Token
     * 
     * @param callback Token获取回调
     */
    fun getVivoToken(callback: DooPushTokenCallback) {
        if (!checkInitialized()) {
            callback.onError(DooPushError.configNotInitialized())
            return
        }
        
        vivoService!!.getToken(
            object : VivoService.TokenCallback {
                override fun onSuccess(token: String) {
                    Log.d(TAG, "VIVO推送Token获取成功: ${token.substring(0, 12)}...")
                    callback.onSuccess(token)
                }
                
                override fun onError(error: DooPushError) {
                    Log.e(TAG, "VIVO推送Token获取失败: ${error.message}")
                    callback.onError(error)
                }
            }
        )
    }

    /**
     * 获取最适合的推送Token
     * 根据设备厂商智能选择FCM、HMS、小米、OPPO或VIVO推送
     * 
     * @param callback Token获取回调
     */
    fun getBestPushToken(callback: DooPushTokenCallback) {
        if (!checkInitialized()) {
            callback.onError(DooPushError.configNotInitialized())
            return
        }
        
        val recommendedService = DooPushDeviceVendor.getRecommendedService(applicationContext!!)
        Log.d(TAG, "推荐的推送服务: $recommendedService")
        
        when (recommendedService) {
            DooPushDeviceVendor.PushService.HMS -> {
                if (config?.hasHMSConfig() == true) {
                    Log.d(TAG, "使用HMS推送")
                    getHMSToken(callback)
                } else {
                    Log.d(TAG, "HMS未配置，fallback到FCM")
                    getFCMToken(callback)
                }
            }
            DooPushDeviceVendor.PushService.MIPUSH -> {
                if (config?.hasXiaomiConfig() == true) {
                    Log.d(TAG, "使用小米推送")
                    getXiaomiToken(callback)
                } else {
                    Log.d(TAG, "小米推送未配置，fallback到FCM")
                    getFCMToken(callback)
                }
            }
            DooPushDeviceVendor.PushService.OPPO -> {
                if (config?.hasOppoConfig() == true) {
                    Log.d(TAG, "使用OPPO推送")
                    Log.w(TAG, "getBestPushToken暂不支持OPPO，请使用registerForPushNotifications")
                    getFCMToken(callback)
                } else {
                    Log.d(TAG, "OPPO推送未配置，fallback到FCM")
                    getFCMToken(callback)
                }
            }
            DooPushDeviceVendor.PushService.VIVO -> {
                if (config?.hasVivoConfig() == true) {
                    Log.d(TAG, "使用VIVO推送")
                    getVivoToken(callback)
                } else {
                    Log.d(TAG, "VIVO推送未配置，fallback到FCM")
                    getFCMToken(callback)
                }
            }
            else -> {
                Log.d(TAG, "使用FCM推送")
                getFCMToken(callback)
            }
        }
    }
    
    /**
     * 检查HMS服务是否可用
     */
    fun isHMSAvailable(): Boolean {
        return hmsService?.isHMSAvailable() ?: false
    }
    
    /**
     * 检查小米推送服务是否可用
     */
    fun isXiaomiAvailable(): Boolean {
        return xiaomiService?.isXiaomiAvailable() ?: false
    }

    /**
     * 检查OPPO推送服务是否可用
     */
    fun isOppoAvailable(): Boolean {
        return oppoService?.isOppoAvailable() ?: false
    }

    /**
     * 检查VIVO推送服务是否可用
     */
    fun isVivoAvailable(): Boolean {
        return vivoService?.isVivoAvailable() ?: false
    }
    
    /**
     * 获取设备厂商信息
     */
    fun getDeviceVendorInfo(): DooPushDeviceVendor.DeviceVendorInfo {
        return DooPushDeviceVendor.getDeviceVendorInfo()
    }
    
    /**
     * 获取支持的推送服务列表
     */
    fun getSupportedPushServices(): List<DooPushDeviceVendor.PushService> {
        return if (checkInitialized()) {
            DooPushDeviceVendor.getAvailableServices(applicationContext!!)
        } else {
            emptyList()
        }
    }
    
    /**
     * 获取设备信息
     * 
     * @return 设备信息对象
     */
    fun getDeviceInfo(): DeviceInfo? {
        return if (checkInitialized()) {
            cachedDeviceInfo ?: deviceManager?.getCurrentDeviceInfo()?.also { 
                cachedDeviceInfo = it 
            }
        } else {
            null
        }
    }
    
    /**
     * 获取SDK配置信息
     * 
     * @return 配置对象
     */
    fun getConfig(): DooPushConfig? {
        return config
    }
    
    /**
     * 检查FCM服务是否可用
     * 
     * @return true if FCM服务可用
     */
    fun isFirebaseAvailable(): Boolean {
        return fcmService?.isFirebaseAvailable() ?: false
    }
    
    /**
     * 测试网络连接
     * 
     * @param callback 测试结果回调
     */
    fun testNetworkConnection(callback: (Boolean) -> Unit) {
        if (!checkInitialized()) {
            callback(false)
            return
        }
        
        networking!!.testConnection(callback)
    }
    
    /**
     * 获取TCP连接状态
     */
    fun getTCPConnectionState(): DooPushTCPState? {
        return tcpConnection?.state
    }
    
    /**
     * 手动连接TCP
     */
    fun connectTCP() {
        tcpConnection?.connect()
    }
    
    /**
     * 手动断开TCP
     */
    fun disconnectTCP() {
        tcpConnection?.disconnect()
    }
    
    /**
     * 应用进入前台时调用
     */
    fun applicationDidBecomeActive() {
        tcpConnection?.applicationDidBecomeActive()
        Log.d(TAG, "应用进入前台")
    }
    
    /**
     * 应用进入后台时调用
     */
    fun applicationWillResignActive() {
        tcpConnection?.applicationWillResignActive()
        Log.d(TAG, "应用进入后台，上报统计数据")
        // 应用进入后台时上报统计数据
        DooPushStatistics.reportStatistics()
    }
    
    /**
     * 应用即将终止时调用
     */
    fun applicationWillTerminate() {
        tcpConnection?.applicationWillTerminate()
        Log.d(TAG, "应用即将终止，上报统计数据")
        // 应用终止时上报统计数据
        DooPushStatistics.reportStatistics()
    }
    
    /**
     * 立即上报推送统计数据
     */
    fun reportStatistics() {
        if (!checkInitialized()) {
            return
        }
        
        try {
            DooPushStatistics.reportStatistics()
            Log.d(TAG, "手动触发统计上报")
        } catch (e: Exception) {
            Log.e(TAG, "上报统计数据失败", e)
        }
    }

    /**
     * 获取SDK状态信息 (调试用)
     * 
     * @return SDK状态信息字符串
     */
    fun getSDKStatus(): String {
        val builder = StringBuilder()
        builder.append("DooPush Android SDK 状态:\n")
        builder.append("  SDK版本: ${DooPushDevice.SDK_VERSION}\n")
        builder.append("  已配置: ${isConfigured.get()}\n")
        builder.append("  注册中: ${isRegistering.get()}\n")
        builder.append("  有回调监听器: ${callback != null}\n")
        builder.append("  有缓存Token: ${!cachedToken.isNullOrEmpty()}\n")
        builder.append("  有缓存设备信息: ${cachedDeviceInfo != null}\n")
        builder.append("  TCP连接状态: ${tcpConnection?.state?.description ?: "未初始化"}\n")
        builder.append("  ${DooPushStatistics.getStatisticsSummary()}\n")
        
        config?.let { builder.append("\n${it.getSummary()}") }
        fcmService?.let { builder.append("\n${it.getServiceStatus()}") }
        hmsService?.let { builder.append("\n${it.getServiceStatus()}") }
        xiaomiService?.let { builder.append("\n${it.getServiceStatus()}") }
        deviceManager?.let { builder.append("\n设备: ${it.getDeviceSummary()}") }
        builder.append("\n${DooPushDeviceVendor.getDeviceDebugInfo()}")
        
        return builder.toString()
    }
    
    /**
     * 清除缓存数据
     */
    fun clearCache() {
        Log.d(TAG, "清除缓存数据")
        cachedToken = null
        cachedDeviceInfo = null
    }
    
    /**
     * 释放SDK资源
     */
    fun release() {
        Log.d(TAG, "释放SDK资源")
        
        try {
            // 清除Firebase监听器
            DooPushFirebaseMessagingService.messageListener = null
            DooPushFirebaseMessagingService.tokenRefreshListener = null
            
            // 释放网络资源
            networking?.release()
            
            // 释放TCP连接
            tcpConnection?.release()
            
            // 清除缓存
            clearCache()
            
            // 重置状态
            isConfigured.set(false)
            isRegistering.set(false)
            callback = null
            
            // 清除组件引用
            config = null
            deviceManager = null
            networking = null
            fcmService = null
            hmsService = null
            xiaomiService = null
            tcpConnection = null
            
            Log.i(TAG, "SDK资源已释放")
            
        } catch (e: Exception) {
            Log.e(TAG, "释放SDK资源时发生异常", e)
        }
    }
    
    /**
     * 注册设备到服务器
     */
    private fun registerDeviceToServer(
        deviceInfo: DeviceInfo,
        token: String,
        callback: DooPushRegisterCallback?
    ) {
        networking!!.registerDevice(
            deviceInfo,
            token,
            object : DooPushNetworking.RegisterDeviceCallback {
                override fun onSuccess(response: DooPushNetworking.DeviceRegistrationResponse) {
                    Log.i(TAG, "设备注册成功")
                    isRegistering.set(false)
                    
                    // 连接到Gateway
                    connectToGateway(response, token)
                    
                    // 通知回调
                    callback?.onSuccess(token) ?: this@DooPushManager.callback?.onRegisterSuccess(token)
                }
                
                override fun onError(error: DooPushError) {
                    Log.e(TAG, "设备注册失败: ${error.message}")
                    isRegistering.set(false)
                    
                    // 通知回调
                    callback?.onError(error) ?: this@DooPushManager.callback?.onRegisterError(error)
                }
            }
        )
    }
    
    /**
     * 连接到Gateway
     */
    private fun connectToGateway(response: DooPushNetworking.DeviceRegistrationResponse, token: String) {
        val config = this.config
        if (config == null) {
            Log.e(TAG, "SDK配置缺失，无法连接Gateway")
            return
        }
        
        val gatewayConfig = response.gateway.toTCPGatewayConfig()
        Log.i(TAG, "准备连接Gateway - $gatewayConfig")
        
        tcpConnection?.configure(
            gatewayConfig,
            config.appId,
            token
        )
        tcpConnection?.connect()
    }
    
    /**
     * 设置Firebase消息监听器
     */
    private fun setupFirebaseMessageListener() {
        // 设置消息接收监听器
        DooPushFirebaseMessagingService.messageListener = 
            object : DooPushFirebaseMessagingService.MessageListener {
                override fun onMessageReceived(message: PushMessage) {
                    Log.d(TAG, "收到推送消息: ${message.toDisplayString()}")
                    callback?.onMessageReceived(message)
                }
            }
        
        // 设置Token刷新监听器
        DooPushFirebaseMessagingService.tokenRefreshListener = 
            object : DooPushFirebaseMessagingService.TokenRefreshListener {
                override fun onTokenRefresh(newToken: String) {
                    Log.d(TAG, "FCM Token已刷新")
                    handleTokenRefresh(newToken)
                }
            }
    }
    
    /**
     * 处理Token刷新
     */
    private fun handleTokenRefresh(newToken: String) {
        val oldToken = cachedToken
        cachedToken = newToken
        
        // 如果已配置且有旧token，更新服务器
        if (isConfigured.get() && !oldToken.isNullOrEmpty() && oldToken != newToken) {
            Log.d(TAG, "Token已变化，更新服务器")
            // 这里可以实现token更新逻辑，暂时省略
        }
    }

    /**
     * 获取全局应用上下文 (供内部组件使用)
     */
    internal fun getApplicationContext(): Context? {
        return applicationContext
    }

    /**
     * 获取内部回调接口 (供DooPushNotificationHandler使用)
     */
    internal fun getInternalCallback(): InternalCallback? {
        return if (checkInitialized()) InternalCallbackImpl() else null
    }
    
    /**
     * 内部回调接口
     */
    internal interface InternalCallback {
        fun onMessageReceived(message: PushMessage)
        fun onNotificationClick(notificationData: DooPushNotificationHandler.NotificationData)
        fun onNotificationOpen(notificationData: DooPushNotificationHandler.NotificationData)
    }
    
    /**
     * 内部回调实现
     */
    private inner class InternalCallbackImpl : InternalCallback {
        override fun onMessageReceived(message: PushMessage) {
            callback?.onMessageReceived(message)
        }
        
        override fun onNotificationClick(notificationData: DooPushNotificationHandler.NotificationData) {
            callback?.onNotificationClick(notificationData)
        }
        
        override fun onNotificationOpen(notificationData: DooPushNotificationHandler.NotificationData) {
            callback?.onNotificationOpen(notificationData)
        }
    }
    
    /**
     * 检查是否已初始化
     */
    private fun checkInitialized(): Boolean {
        val initialized = isConfigured.get()
        if (!initialized) {
            Log.w(TAG, "SDK尚未初始化，请先调用configure方法")
        }
        return initialized
    }
    
    /**
     * 设置应用角标数量
     * @param count 角标数量，0表示清除角标
     * @return 是否设置成功
     */
    fun setBadgeCount(count: Int): Boolean {
        Log.d(TAG, "设置应用角标数量: $count")
        
        if (!checkInitialized()) {
            return false
        }
        
        return try {
            val context = applicationContext ?: run {
                Log.e(TAG, "Context为空，无法设置角标")
                return false
            }
            
            BadgeManager.setBadgeCount(context, count)
        } catch (e: Exception) {
            Log.e(TAG, "设置角标数量失败", e)
            false
        }
    }
    
    /**
     * 清除应用角标
     * @return 是否清除成功
     */
    fun clearBadge(): Boolean {
        Log.d(TAG, "清除应用角标")
        return setBadgeCount(0)
    }
}

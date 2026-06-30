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
        private const val PREFS_NAME = "DooPushSDK.Storage"
        private const val PREF_DEVICE_TOKEN = "device_token"
        private const val PREF_DEVICE_ID = "device_id"
        private const val PREF_VENDOR = "vendor"
        private const val PREF_BADGE_COUNT = "badge_count"

        private val VALID_REGISTER_VENDORS = setOf(
            "apns", "fcm", "hms", "honor", "xiaomi", "oppo", "vivo", "meizu"
        )

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

    /**
     * 通知管理模式（marker 标记位）
     *
     * 此 enum 本身不直接改变 SDK 行为——它是一个**协调标记**，供上层 SDK
     * （例如 React Native bridge / Expo Module）读取并据此自行调用其它具体开关。
     *
     * **典型 PASSIVE 模式配置**（让位给第三方 SDK 处理 FCM）：
     * ```
     * DooPushManager.getInstance().setNotificationManagementMode(PASSIVE)
     * DooPushManager.getInstance().setFCMNotificationDisplayEnabled(false)
     * DooPushManager.getInstance().setExpoNotificationRelayEnabled(true)
     * // 之后由上层 SDK 拿到 token 后调用 registerDevice(token, vendor, callback)
     * ```
     *
     * - **ACTIVE**：默认。SDK 自管 FCM 通知展示、token 注册等
     * - **PASSIVE**：让位标记。SDK 自身行为不会因此改变；调用方需配合上述其它开关
     */
    enum class NotificationManagementMode { ACTIVE, PASSIVE }

    /** 当前通知管理模式 */
    @Volatile
    var notificationManagementMode: NotificationManagementMode = NotificationManagementMode.ACTIVE
        private set

    /** 设置通知管理模式 */
    fun setNotificationManagementMode(mode: NotificationManagementMode) {
        notificationManagementMode = mode
        Log.i(TAG, "通知管理模式设置为: $mode")
    }

    /** FCM 通道是否由 DooPush 自管展示通知（默认 true）。设 false 让位给上层（expo-notifications / react-native-firebase） */
    @Volatile
    var isFCMNotificationDisplayEnabled: Boolean = true
        private set

    fun setFCMNotificationDisplayEnabled(enabled: Boolean) {
        isFCMNotificationDisplayEnabled = enabled
        Log.i(TAG, "FCM 通知展示开关: $enabled")
    }

    /** 是否向上层 SDK（如 expo-notifications）转播 FCM 消息（默认 false） */
    @Volatile
    var isExpoNotificationRelayEnabled: Boolean = false
        private set

    fun setExpoNotificationRelayEnabled(enabled: Boolean) {
        isExpoNotificationRelayEnabled = enabled
        Log.i(TAG, "Expo 通知转播开关: $enabled")
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
    private var meizuService: MeizuService? = null
    private var honorService: HonorService? = null
    private var wsConnection: DooPushWebSocketConnection? = null
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
    private var cachedDeviceId: String? = null
    
    init {
        Log.d(TAG, "DooPushManager 初始化")
        setupFirebaseMessageListener()
    }
    
    /**
     * WebSocket 连接监听器实现
     */
    private val wsListener = object : DooPushWebSocketConnection.Listener {
        override fun onOpen() {
            Log.i(TAG, "WebSocket 连接已建立")
            callback?.onWebSocketOpen()
        }

        override fun onClosed(code: Int, reason: String) {
            Log.i(TAG, "WebSocket 连接已关闭: code=$code reason=$reason")
            callback?.onWebSocketClosed(code, reason)
        }

        override fun onFailure(t: Throwable) {
            Log.w(TAG, "WebSocket 连接失败: ${t.message}")
            callback?.onWebSocketFailure(t)
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
     * @param meizuConfig 魅族推送配置 (可选)
     * @param honorConfig 荣耀推送配置 (可选)
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
        vivoConfig: DooPushConfig.VivoConfig? = null,
        meizuConfig: DooPushConfig.MeizuConfig? = null,
        honorConfig: DooPushConfig.HonorConfig? = null
    ) {
        try {
            Log.d(TAG, "开始配置 DooPush SDK")
            
            // 保存应用上下文
            applicationContext = context.applicationContext
            loadPersistedRegistration()
            
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
            
            // 智能配置处理：魅族设备自动启用魅族推送
            val finalMeizuConfig = if (meizuConfig == null) {
                val vendorInfo = DooPushDeviceVendor.getDeviceVendorInfo()
                if (vendorInfo.preferredService == DooPushDeviceVendor.PushService.MEIZU) {
                    Log.d(TAG, "检测到魅族设备，自动启用魅族推送服务")
                    DooPushConfig.MeizuConfig() // 零配置，自动从 meizu-services.json 读取
                } else {
                    null
                }
            } else {
                meizuConfig
            }
            
            // 智能配置处理：荣耀设备自动启用荣耀推送
            val finalHonorConfig = if (honorConfig == null) {
                val vendorInfo = DooPushDeviceVendor.getDeviceVendorInfo()
                if (vendorInfo.preferredService == DooPushDeviceVendor.PushService.HONOR) {
                    Log.d(TAG, "检测到荣耀设备，自动启用荣耀推送服务")
                    DooPushConfig.HonorConfig() // 零配置，自动从 mcs-services.json 读取
                } else {
                    null
                }
            } else {
                honorConfig
            }
            
            // 创建配置
            config = DooPushConfig.create(appId, apiKey, baseURL, finalHmsConfig, finalXiaomiConfig, finalOppoConfig, finalVivoConfig, finalMeizuConfig, finalHonorConfig)

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
            meizuService = MeizuService(context.applicationContext).apply {
                // 让接收器持有服务实例，便于通过接收器回调成功/失败
                MeizuPushReceiver.setService(this)
                // 延迟初始化：在注册或获取Token时再进行
                Log.d(TAG, "魅族推送服务实例已创建（延迟初始化）")
            }
            honorService = HonorService(context.applicationContext).apply {
                // 让接收器持有服务实例，便于通过接收器回调成功/失败
                HonorPushReceiver.setService(this)
                // 延迟初始化：在注册或获取Token时再进行
                Log.d(TAG, "荣耀推送服务实例已创建（延迟初始化）")
                configure(config?.honorConfig)
                if (config?.honorConfig?.isValid() != true) {
                    autoInitialize()
                }
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
        
        // 超时保护，避免底层SDK无回调导致卡住。
        // 必须大于各厂商取 token 的内部超时（OPPO 轮询 30s，见 OppoService.startPollingForRegisterId），
        // 否则厂商真实的失败原因（如 OPPO 包名/appKey 不匹配）会被这个通用超时覆盖成“网络请求超时”。
        mainHandler.postDelayed({
            if (isRegistering.get()) {
                isRegistering.set(false)
                val error = DooPushError.networkTimeout("注册推送超时，请检查设备网络或厂商服务可用性")
                Log.e(TAG, error.getFullDescription())
                callback?.onError(error) ?: this.callback?.onRegisterError(error)
            }
        }, 35000L)
        
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
                DooPushDeviceVendor.PushService.MEIZU -> {
                    if (config?.hasMeizuConfig() == true) {
                        // 组装设备信息（channel=meizu）
                        val deviceInfo = deviceManager!!.getCurrentDeviceInfo("meizu")
                        cachedDeviceInfo = deviceInfo
                        
                        meizuService!!.getToken(
                            object : MeizuService.TokenCallback {
                                override fun onSuccess(token: String) {
                                    Log.d(TAG, "魅族推送Token获取成功: ${token.substring(0, 12)}...")
                                    cachedToken = token
                                    // 调用设备注册API
                                    registerDeviceToServer(deviceInfo, token, callback)
                                }
                                
                                override fun onError(error: DooPushError) {
                                    Log.e(TAG, "魅族推送Token获取失败: ${error.message}")
                                    isRegistering.set(false)
                                    callback?.onError(error) ?: this@DooPushManager.callback?.onRegisterError(error)
                                }
                            }
                        )
                    } else {
                        Log.w(TAG, "魅族推送未配置，fallback到FCM")
                        registerWithFCM(callback)
                    }
                }
                DooPushDeviceVendor.PushService.HONOR -> {
                    if (config?.hasHonorConfig() == true) {
                        // 组装设备信息（channel=honor）
                        val deviceInfo = deviceManager!!.getCurrentDeviceInfo("honor")
                        cachedDeviceInfo = deviceInfo
                        
                        honorService!!.getToken(
                            object : HonorService.TokenCallback {
                                override fun onSuccess(token: String) {
                                    Log.d(TAG, "荣耀推送Token获取成功: ${token.substring(0, 12)}...")
                                    cachedToken = token
                                    // 调用设备注册API
                                    registerDeviceToServer(deviceInfo, token, callback)
                                }
                                
                                override fun onError(error: DooPushError) {
                                    Log.e(TAG, "荣耀推送Token获取失败: ${error.message}")
                                    isRegistering.set(false)
                                    callback?.onError(error) ?: this@DooPushManager.callback?.onRegisterError(error)
                                }
                            }
                        )
                    } else {
                        Log.w(TAG, "荣耀推送未配置，fallback到FCM")
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
     * 获取魅族推送Token
     * 
     * @param callback Token获取回调
     */
    fun getMeizuToken(callback: DooPushTokenCallback) {
        if (!checkInitialized()) {
            callback.onError(DooPushError.configNotInitialized())
            return
        }
        
        meizuService!!.getToken(
            object : MeizuService.TokenCallback {
                override fun onSuccess(token: String) {
                    Log.d(TAG, "魅族推送Token获取成功: ${token.substring(0, 12)}...")
                    callback.onSuccess(token)
                }
                
                override fun onError(error: DooPushError) {
                    Log.e(TAG, "魅族推送Token获取失败: ${error.message}")
                    callback.onError(error)
                }
            }
        )
    }

    /**
     * 获取最适合的推送Token
     * 根据设备厂商智能选择FCM、HMS、小米、OPPO、VIVO或魅族推送
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
            DooPushDeviceVendor.PushService.MEIZU -> {
                if (config?.hasMeizuConfig() == true) {
                    Log.d(TAG, "使用魅族推送")
                    getMeizuToken(callback)
                } else {
                    Log.d(TAG, "魅族推送未配置，fallback到FCM")
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
     * 检查魅族推送服务是否可用
     */
    fun isMeizuAvailable(): Boolean {
        return meizuService?.isMeizuAvailable() ?: false
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
            cachedDeviceInfo ?: deviceManager?.getCurrentDeviceInfo(getCurrentVendor() ?: "fcm")?.also {
                cachedDeviceInfo = it
            }
        } else {
            null
        }
    }


    /**
     * 更新当前设备信息到服务器。Android 与 iOS 保持一致：复用注册接口，
     * 后端根据 token 识别并更新现有设备。
     */
    fun updateDeviceInfo(callback: ((Boolean, DooPushError?) -> Unit)? = null) {
        if (!checkInitialized()) {
            val error = DooPushError.configNotInitialized()
            callback?.invoke(false, error)
            return
        }

        val token = getDeviceToken()
        if (token.isNullOrBlank()) {
            val error = DooPushError(
                code = DooPushError.CONFIG_NOT_INITIALIZED,
                message = "无法更新设备信息：设备token缺失"
            )
            Log.w(TAG, error.message)
            callback?.invoke(false, error)
            return
        }

        val channel = getCurrentVendor() ?: "fcm"
        val deviceInfo = deviceManager?.getCurrentDeviceInfo(channel)
        if (deviceInfo == null) {
            val error = DooPushError.configNotInitialized()
            callback?.invoke(false, error)
            return
        }

        cachedDeviceInfo = deviceInfo
        networking?.registerDevice(deviceInfo, token, object : DooPushNetworking.RegisterDeviceCallback {
            override fun onSuccess(deviceId: String) {
                cachedDeviceId = deviceId
                persistRegistration(token, deviceId, channel)
                Log.i(TAG, "设备信息更新成功")
                callback?.invoke(true, null)
            }

            override fun onError(error: DooPushError) {
                Log.e(TAG, "设备信息更新失败: ${error.message}")
                callback?.invoke(false, error)
            }
        })
    }

    /**
     * 获取当前设备推送 token。
     */
    fun getDeviceToken(): String? = cachedToken ?: prefs()?.getString(PREF_DEVICE_TOKEN, null)

    /**
     * 获取服务端分配的设备 ID。
     */
    fun getDeviceId(): String? = cachedDeviceId ?: prefs()?.getString(PREF_DEVICE_ID, null)

    /**
     * 获取当前注册通道。
     */
    fun getCurrentVendor(): String? = cachedDeviceInfo?.channel ?: prefs()?.getString(PREF_VENDOR, null)
    
    /**
     * 获取SDK配置信息
     * 
     * @return 配置对象
     */
    fun getConfig(): DooPushConfig? {
        return config
    }

    private fun prefs() = applicationContext?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun loadPersistedRegistration() {
        val prefs = prefs() ?: return
        if (cachedToken.isNullOrEmpty()) {
            cachedToken = prefs.getString(PREF_DEVICE_TOKEN, null)
        }
        if (cachedDeviceId.isNullOrEmpty()) {
            cachedDeviceId = prefs.getString(PREF_DEVICE_ID, null)
        }
    }

    private fun persistRegistration(token: String, deviceId: String, vendor: String) {
        prefs()?.edit()
            ?.putString(PREF_DEVICE_TOKEN, token)
            ?.putString(PREF_DEVICE_ID, deviceId)
            ?.putString(PREF_VENDOR, vendor)
            ?.apply()
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
     * 手动连接 WebSocket（注册成功后由 SDK 自动调用，通常无需手动调用）
     */
    fun connectWebSocket() {
        val token = cachedToken
        if (token.isNullOrEmpty()) {
            Log.w(TAG, "无法连接 WebSocket：设备token缺失")
            return
        }
        connectToGateway(token)
    }

    /**
     * 手动断开 WebSocket
     */
    fun disconnectWebSocket() {
        wsConnection?.disconnect()
        wsConnection = null
    }

    /**
     * 应用进入前台时调用，执行通知清除和角标重置
     * @param context Android 上下文，推荐使用 Application 上下文
     */
    fun applicationDidBecomeActive(context: Context) {
        Log.d(TAG, "应用进入前台")
        // 清除通知栏消息
        // TODO 如果应用没有初始化 SDK 也可以清除通知？
        DooPushNotificationHandler.clearNotifications(context)
        if (checkInitialized()) {
            clearBadge()
            val token = cachedToken
            if (!token.isNullOrEmpty()) {
                // 前台守卫：已有活跃连接则复用（断了才补一次），避免重复 onResume 时无脑重建、
                // 自己挤掉自己触发服务端 4001。无活跃连接才新建。
                val ws = wsConnection
                if (ws != null && ws.isActive) {
                    ws.reconnectIfNeeded()
                } else {
                    connectToGateway(token)
                }
            }
        }
    }

    /**
     * 应用进入后台时调用
     */
    fun applicationWillResignActive() {
        Log.d(TAG, "应用进入后台")
        // 后台限制：主动断开，等前台恢复后再重连（与 iOS 行为对齐）
        wsConnection?.disconnect()
        wsConnection = null
        DooPushStatistics.reportStatistics()
    }
    
    /**
     * 应用即将终止时调用
     */
    fun applicationWillTerminate() {
        wsConnection?.disconnect()
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
        builder.append("  有缓存设备ID: ${!cachedDeviceId.isNullOrEmpty()}\n")
        builder.append("  有缓存设备信息: ${cachedDeviceInfo != null}\n")
        builder.append("  WebSocket连接: ${if (wsConnection != null) "已创建" else "未初始化"}\n")
        builder.append("  ${DooPushStatistics.getStatisticsSummary()}\n")
        
        config?.let { builder.append("\n${it.getSummary()}") }
        fcmService?.let { builder.append("\n${it.getServiceStatus()}") }
        hmsService?.let { builder.append("\n${it.getServiceStatus()}") }
        xiaomiService?.let { builder.append("\n${it.getServiceStatus()}") }
        deviceManager?.let { builder.append("\n设备: ${it.getDeviceSummary()}") }
        builder.append("\n${DooPushDeviceVendor.getDeviceDebugInfo()}")
        
        return builder.toString()
    }
    
    private fun clearMemoryCache() {
        cachedToken = null
        cachedDeviceId = null
        cachedDeviceInfo = null
    }

    /**
     * 清除缓存数据（内存 + 持久化注册信息）。
     */
    fun clearCache() {
        Log.d(TAG, "清除缓存数据")
        clearMemoryCache()
        prefs()?.edit()
            ?.remove(PREF_DEVICE_TOKEN)
            ?.remove(PREF_DEVICE_ID)
            ?.remove(PREF_VENDOR)
            ?.apply()
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
            
            // 断开 WebSocket 连接
            wsConnection?.disconnect()
            wsConnection = null

            // 清除内存缓存。release() 只释放运行时资源，不清除持久化注册信息。
            clearMemoryCache()
            
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

            Log.i(TAG, "SDK资源已释放")
            
        } catch (e: Exception) {
            Log.e(TAG, "释放SDK资源时发生异常", e)
        }
    }
    
    /**
     * 用调用方已有的推送 token 直接完成 DooPush 服务端注册
     * 跳过 SDK 内部权限请求 / 厂商 SDK 初始化 / token 获取流程
     *
     * @param token  调用方已经从 APNs / FCM / OEM 渠道拿到的设备 token
     * @param vendor 通道标识："apns"/"fcm"/"hms"/"honor"/"xiaomi"/"oppo"/"vivo"/"meizu"
     *               用于服务端正确归类设备 channel
     * @param callback 注册结果回调
     */
    fun registerDevice(
        token: String,
        vendor: String,
        callback: DooPushRegisterCallback
    ) {
        if (!checkInitialized()) {
            callback.onError(DooPushError.configNotInitialized())
            return
        }
        if (vendor !in VALID_REGISTER_VENDORS) {
            callback.onError(
                DooPushError(
                    code = DooPushError.CONFIG_INVALID_PARAMETER,
                    message = "vendor 必须是: ${VALID_REGISTER_VENDORS.joinToString()}"
                )
            )
            return
        }
        if (isRegistering.get()) {
            Log.w(TAG, "另一个注册流程正在进行，registerDevice(token,vendor) 拒绝执行")
            callback.onError(
                DooPushError(
                    code = DooPushError.REGISTRATION_IN_PROGRESS,
                    message = "另一个注册流程正在进行，请稍后重试"
                )
            )
            return
        }
        try {
            isRegistering.set(true)
            val deviceInfo = deviceManager!!.getCurrentDeviceInfo(vendor)
            cachedDeviceInfo = deviceInfo
            cachedToken = token
            registerDeviceToServer(deviceInfo, token, callback)
        } catch (e: Exception) {
            Log.e(TAG, "registerDevice(token,vendor) 失败", e)
            isRegistering.set(false)
            callback.onError(DooPushError.fromException(e))
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
                override fun onSuccess(deviceId: String) {
                    Log.i(TAG, "设备注册成功，设备ID: $deviceId")
                    isRegistering.set(false)
                    cachedToken = token
                    cachedDeviceId = deviceId
                    cachedDeviceInfo = deviceInfo
                    persistRegistration(token, deviceId, deviceInfo.channel)
                    connectToGateway(token)
                    val result = DooPushRegisterResult(
                        token = token,
                        deviceId = deviceId,
                        vendor = deviceInfo.channel
                    )
                    callback?.onSuccess(result) ?: this@DooPushManager.callback?.onRegisterSuccess(result)
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
     * 连接到 WebSocket Gateway
     */
    private fun connectToGateway(token: String) {
        val config = this.config
        if (config == null) {
            Log.e(TAG, "SDK配置缺失，无法连接 WebSocket Gateway")
            return
        }

        Log.i(TAG, "准备连接 WebSocket Gateway - ${config.baseURL}")

        // 断开可能存在的旧连接
        wsConnection?.disconnect()

        wsConnection = DooPushWebSocketConnection(
            baseUrl = config.baseURL,
            appId = config.appId,
            appKey = config.apiKey,
            token = token,
            listener = wsListener,
        )
        wsConnection?.connect()
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
        val deviceId = getDeviceId()
        val vendor = getCurrentVendor()
        if (!deviceId.isNullOrEmpty() && !vendor.isNullOrEmpty()) {
            persistRegistration(newToken, deviceId, vendor)
        }
        
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
            val success = BadgeManager.setBadgeCount(context, count)
            if (success) {
                prefs()?.edit()?.putInt(PREF_BADGE_COUNT, count.coerceAtLeast(0))?.apply()
            }
            success

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

    /**
     * 获取最近一次由 SDK 设置成功的应用角标数量。
     */
    fun getBadgeCount(): Int {
        return prefs()?.getInt(PREF_BADGE_COUNT, 0) ?: 0
    }
}

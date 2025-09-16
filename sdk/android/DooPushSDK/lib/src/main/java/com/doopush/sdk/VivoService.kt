package com.doopush.sdk

import android.content.Context
import android.util.Log
import android.os.Handler
import android.os.Looper
import com.doopush.sdk.models.DooPushError
import org.json.JSONObject
import java.io.InputStream

/**
 * VIVO推送服务管理类
 *
 * 负责VIVO Push的初始化、token获取和管理
 */
class VivoService(private val context: Context) {

    companion object {
        private const val TAG = "VivoService"

        // 检查VIVO推送SDK是否可用
        fun isVivoPushAvailable(): Boolean {
            return try {
                Class.forName("com.vivo.push.PushClient")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "VIVO推送SDK未集成")
                false
            }
        }

        // 检查是否为VIVO或iQOO设备
        fun isVivoOrIqooDevice(): Boolean {
            val manufacturer = android.os.Build.MANUFACTURER
            val brand = android.os.Build.BRAND
            return manufacturer.equals("vivo", ignoreCase = true) ||
                   brand.equals("vivo", ignoreCase = true) ||
                   manufacturer.equals("iqoo", ignoreCase = true) ||
                   brand.equals("iqoo", ignoreCase = true)
        }
    }

    /**
     * VIVO推送Token获取回调接口
     */
    interface TokenCallback {
        fun onSuccess(token: String)
        fun onError(error: DooPushError)
    }

    // 用于缓存注册结果的回调
    private var tokenCallback: TokenCallback? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pollingRunnable: Runnable? = null
    @Volatile
    private var pendingRegistration: Boolean = false
    @Volatile
    private var lastDeliveredRegId: String? = null

    // 缓存的配置信息（VIVO客户端需要 app_id, api_key）
    private var cachedAppId: String? = null
    private var cachedApiKey: String? = null

    /**
     * 自动初始化VIVO推送（从vivo-services.json读取配置）
     *
     * @return 是否初始化成功
     */
    fun autoInitialize(): Boolean {
        val config = loadVivoConfigFromAssets()
        return if (config != null) {
            initialize(config.first, config.second)
        } else {
            Log.w(TAG, "未读取到vivo-services.json，跳过VIVO初始化")
            false
        }
    }

    /**
     * 从assets目录读取vivo-services.json配置
     *
     * @return Pair<appId, apiKey> 或 null
     */
    private fun loadVivoConfigFromAssets(): Pair<String, String>? {
        return try {
            val inputStream: InputStream = context.assets.open("vivo-services.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(jsonString)

            // VIVO 客户端只需要 app_id 和 api_key
            val appId = jsonObject.optString("app_id", "")
            val apiKey = jsonObject.optString("api_key", "")

            if (appId.isNotEmpty() && apiKey.isNotEmpty()) {
                Log.d(TAG, "VIVO配置读取成功: app_id/api_key 就绪")
                Pair(appId, apiKey)
            } else {
                Log.w(TAG, "vivo-services.json中缺少必要配置: 需要 app_id 和 api_key")
                null
            }
        } catch (e: Exception) {
            Log.d(TAG, "读取vivo-services.json失败")
            null
        }
    }

    /**
     * 初始化VIVO推送
     *
     * @param appId VIVO应用ID
     * @param apiKey VIVO应用ApiKey
     * @return 是否初始化成功
     */
    fun initialize(appId: String, apiKey: String): Boolean {
        if (!isVivoPushAvailable()) {
            Log.w(TAG, "VIVO SDK 未集成")
            return false
        }

        return try {
            // 由于使用 compileOnly 依赖，这里用反射调用 VIVO SDK
            val pushClientClass = Class.forName("com.vivo.push.PushClient")
            val pushConfigClass = Class.forName("com.vivo.push.PushConfig")
            val pushConfigBuilderClass = Class.forName("com.vivo.push.PushConfig\$Builder")
            val iPushActionListenerClass = Class.forName("com.vivo.push.IPushActionListener")
            val iPushQueryActionListenerClass = Class.forName("com.vivo.push.listener.IPushQueryActionListener")
            
            // 获取PushClient实例
            val getInstanceMethod = pushClientClass.getMethod("getInstance", Context::class.java)
            val pushClientInstance = getInstanceMethod.invoke(null, context)

            // 构建PushConfig
            val builder = pushConfigBuilderClass.getDeclaredConstructor().newInstance()
            val agreePrivacyStatementMethod = pushConfigBuilderClass.getMethod("agreePrivacyStatement", java.lang.Boolean.TYPE)
            agreePrivacyStatementMethod.invoke(builder, true)
            
            val buildMethod = pushConfigBuilderClass.getMethod("build")
            val pushConfig = buildMethod.invoke(builder)

            // 初始化PushClient
            val initializeMethod = pushClientClass.getMethod("initialize", pushConfigClass)
            initializeMethod.invoke(pushClientInstance, pushConfig)

            // 创建推送开关回调（IPushActionListener）
            val turnOnPushCallback = java.lang.reflect.Proxy.newProxyInstance(
                iPushActionListenerClass.classLoader,
                arrayOf(iPushActionListenerClass)
            ) { _, method, args ->
                when (method.name) {
                    "onStateChanged" -> {
                        val state = args?.get(0) as? Int ?: -1
                        Log.d(TAG, "VIVO推送开关状态: state=$state")
                        when (state) {
                            0 -> {
                                // 推送开关成功，获取RegId
                                getRegIdFromSDK(pushClientInstance, pushClientClass, iPushQueryActionListenerClass)
                            }
                            // 1002 等状态表示仍在处理中，这类情况继续等待异步回调
                            1001, 1002, 1003 -> {
                                Log.d(TAG, "VIVO推送开关正在处理，等待异步回调 state=$state")
                                // 继续等待轮询/广播结果，不立即回调失败
                            }
                            else -> {
                                // 其他状态视为失败
                                handleRegisterCallback(state, null)
                            }
                        }
                    }
                }
                null
            }

            // 打开推送开关
            val turnOnPushMethod = pushClientClass.getMethod("turnOnPush", iPushActionListenerClass)
            turnOnPushMethod.invoke(pushClientInstance, turnOnPushCallback)
            
            cachedAppId = appId
            cachedApiKey = apiKey
            Log.d(TAG, "VIVO初始化成功")

            // 若存在等待中的回调，启动一次轮询，避免某些机型不回调
            if (tokenCallback != null) {
                startPollingForRegisterId(timeoutMs = 30000L)
            }
            true

        } catch (e: Exception) {
            Log.e(TAG, "VIVO推送初始化失败", e)
            false
        }
    }

    /**
     * 从SDK获取RegId
     */
    private fun getRegIdFromSDK(pushClientInstance: Any, pushClientClass: Class<*>, iPushQueryActionListenerClass: Class<*>) {
        try {
            val regIdCallback = java.lang.reflect.Proxy.newProxyInstance(
                iPushQueryActionListenerClass.classLoader,
                arrayOf(iPushQueryActionListenerClass)
            ) { _, method, args ->
                when (method.name) {
                    "onSuccess" -> {
                        val regId = args?.get(0) as? String
                        if (!regId.isNullOrEmpty()) {
                            handleRegisterCallback(0, regId)
                        } else {
                            handleRegisterCallback(-1, null)
                        }
                    }
                    "onFail" -> {
                        val errorCode = args?.get(0) as? Int ?: -1
                        handleRegisterCallback(errorCode, null)
                    }
                }
                null
            }

            val getRegIdMethod = pushClientClass.getMethod("getRegId", iPushQueryActionListenerClass)
            getRegIdMethod.invoke(pushClientInstance, regIdCallback)
        } catch (e: Exception) {
            Log.e(TAG, "获取VIVO推送RegId失败", e)
            handleRegisterCallback(-1, null)
        }
    }

    /**
     * 启动定时轮询获取 RegisterId，避免部分设备不触发回调
     */
    private fun startPollingForRegisterId(timeoutMs: Long) {
        stopPolling()
        val startAt = System.currentTimeMillis()
        pollingRunnable = object : Runnable {
            override fun run() {
                val regId = getRegId()
                if (!regId.isNullOrEmpty()) {
                    handleRegisterCallback(0, regId)
                    stopPolling()
                    return
                }
                val elapsed = System.currentTimeMillis() - startAt
                if (elapsed < timeoutMs) {
                    mainHandler.postDelayed(this, 1000L)
                } else {
                    Log.e(TAG, "VIVO RegisterId 轮询超时")
                    handleRegisterCallback(-1, null)
                    stopPolling()
                }
            }
        }
        mainHandler.postDelayed(pollingRunnable!!, 1000L)
    }

    private fun stopPolling() {
        pollingRunnable?.let { mainHandler.removeCallbacks(it) }
        pollingRunnable = null
    }

    /**
     * 处理注册回调
     */
    private fun handleRegisterCallback(code: Int, regid: String?) {
        if (code == 0 && !regid.isNullOrEmpty()) {
            deliverRegisterSuccess(regid)
        } else {
            val errorMsg = "VIVO注册失败: code=$code regid=$regid"
            notifyRegisterFailure(errorMsg)
        }
    }

    /**
     * 获取VIVO推送Token（使用缓存的配置）
     *
     * @param callback token获取回调
     */
    fun getToken(callback: TokenCallback) {
        if (cachedAppId != null && cachedApiKey != null) {
            // 尝试获取已缓存的token
            val cachedToken = getRegId()
            if (!cachedToken.isNullOrEmpty()) {
                Log.d(TAG, "使用缓存的VIVO推送token: ${cachedToken.take(12)}...")
                lastDeliveredRegId = cachedToken
                pendingRegistration = false
                callback.onSuccess(cachedToken)
            } else {
                // 如果没有缓存token，重新初始化以触发注册回调
                this.tokenCallback = callback // 缓存回调
                pendingRegistration = true
                initialize(cachedAppId!!, cachedApiKey!!)
            }
        } else {
            // 尝试自动初始化
            val success = autoInitialize()
            if (success && cachedAppId != null && cachedApiKey != null) {
                // 自动初始化成功后，再次尝试获取token
                getToken(callback)
            } else {
                callback.onError(DooPushError.vivoConfigInvalid("VIVO推送未正确配置或初始化"))
            }
        }
    }

    /**
     * 获取VIVO推送注册ID（token）
     *
     * @return 注册ID或null
     */
    private fun getRegId(): String? {
        return try {
            // 由于VIVO SDK没有同步获取regId的方法，这里返回null
            // 实际的regId获取是通过异步回调完成的
            null
        } catch (e: Exception) {
            Log.d(TAG, "获取VIVO推送RegId失败", e)
            null
        }
    }

    /**
     * 检查VIVO推送服务是否可用
     *
     * @return 是否可用
     */
    fun isVivoAvailable(): Boolean {
        return isVivoPushAvailable() && isVivoOrIqooDevice()
    }

    /**
     * 获取服务状态信息
     *
     * @return 状态信息字符串
     */
    fun getServiceStatus(): String {
        val builder = StringBuilder()
        builder.append("VIVO推送服务状态:")
        builder.append("\n  SDK可用: ${isVivoPushAvailable()}")
        builder.append("\n  VIVO/iQOO设备: ${isVivoOrIqooDevice()}")
        builder.append("\n  服务可用: ${isVivoAvailable()}")

        // VIVO SDK不提供同步获取RegId的方法，这里显示为异步获取
        builder.append("\n  当前RegId: 需异步获取")

        return builder.toString()
    }

    /**
     * 处理注册成功回调（供VivoPushReceiver调用）
     */
    fun handleRegisterSuccess(regId: String) {
        deliverRegisterSuccess(regId)
    }

    /**
     * 处理注册失败回调（供VivoPushReceiver调用）
     */
    fun handleRegisterError(reason: String) {
        notifyRegisterFailure("VIVO推送注册失败: $reason")
    }

    @Synchronized
    private fun deliverRegisterSuccess(regId: String) {
        if (!pendingRegistration && lastDeliveredRegId == regId) {
            Log.d(TAG, "忽略重复的VIVO注册成功回调: ${regId.take(12)}...")
            return
        }
        lastDeliveredRegId = regId
        pendingRegistration = false
        stopPolling()
        Log.d(TAG, "VIVO推送注册成功: ${regId.take(12)}...")
        tokenCallback?.onSuccess(regId)
        tokenCallback = null
    }

    @Synchronized
    private fun notifyRegisterFailure(message: String) {
        stopPolling()
        if (!pendingRegistration) {
            Log.w(TAG, "忽略重复的VIVO注册失败回调: $message")
            return
        }
        pendingRegistration = false
        lastDeliveredRegId = null
        Log.e(TAG, message)
        tokenCallback?.onError(DooPushError.vivoRegisterFailed(message))
        tokenCallback = null
    }
}

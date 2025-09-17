package com.doopush.sdk

import android.content.Context
import android.util.Log
import android.os.Handler
import android.os.Looper
import com.doopush.sdk.models.DooPushError
import org.json.JSONObject
import java.io.InputStream

/**
 * 荣耀推送服务管理类
 *
 * 负责荣耀Push的初始化、token获取和管理
 */
class HonorService(private val context: Context) {

    companion object {
        private const val TAG = "HonorService"

        // 检查荣耀推送SDK是否可用
        fun isHonorPushAvailable(): Boolean {
            return try {
                Class.forName("com.hihonor.mcs.push.HonorPushClient")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "荣耀推送SDK未集成")
                false
            }
        }

        // 检查是否为荣耀设备
        fun isHonorDevice(): Boolean {
            val manufacturer = android.os.Build.MANUFACTURER
            val brand = android.os.Build.BRAND
            return manufacturer.equals("honor", ignoreCase = true) ||
                   brand.equals("honor", ignoreCase = true)
        }
    }

    /**
     * 荣耀推送Token获取回调接口
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
    private var lastDeliveredToken: String? = null

    // 缓存的配置信息（荣耀客户端需要 client_id, client_secret）
    private var cachedClientId: String? = null
    private var cachedClientSecret: String? = null

    /**
     * 自动初始化荣耀推送（从mcs-services.json读取配置）
     *
     * @return 是否初始化成功
     */
    fun autoInitialize(): Boolean {
        val config = loadHonorConfigFromAssets()
        return if (config != null) {
            initialize(config.first, config.second)
        } else {
            Log.w(TAG, "未读取到mcs-services.json，跳过荣耀初始化")
            false
        }
    }

    /**
     * 从assets目录读取mcs-services.json配置
     *
     * @return Pair<clientId, clientSecret> 或 null
     */
    private fun loadHonorConfigFromAssets(): Pair<String, String>? {
        return try {
            val inputStream: InputStream = context.assets.open("mcs-services.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(jsonString)

            // 荣耀 客户端需要 client_id 和 client_secret
            val clientId = jsonObject.optString("client_id", "")
            val clientSecret = jsonObject.optString("client_secret", "")

            if (clientId.isNotEmpty() && clientSecret.isNotEmpty()) {
                Log.d(TAG, "荣耀配置读取成功: client_id/client_secret 就绪")
                Pair(clientId, clientSecret)
            } else {
                Log.w(TAG, "mcs-services.json中缺少必要配置: 需要 client_id 和 client_secret")
                null
            }
        } catch (e: Exception) {
            Log.d(TAG, "读取mcs-services.json失败")
            null
        }
    }

    /**
     * 初始化荣耀推送
     *
     * @param clientId 荣耀应用客户端ID
     * @param clientSecret 荣耀应用客户端密钥
     * @return 是否初始化成功
     */
    fun initialize(clientId: String, clientSecret: String): Boolean {
        if (!isHonorPushAvailable()) {
            Log.w(TAG, "荣耀 SDK 未集成")
            return false
        }

        return try {
            // 由于使用 compileOnly 依赖，这里用反射调用荣耀SDK
            val honorPushClientClass = Class.forName("com.hihonor.mcs.push.HonorPushClient")
            val honorConfigClass = Class.forName("com.hihonor.mcs.push.config.HonorPushConfig")
            val honorConfigBuilderClass = Class.forName("com.hihonor.mcs.push.config.HonorPushConfig\$Builder")
            val tokenCallbackClass = Class.forName("com.hihonor.mcs.push.callback.TokenCallback")
            
            // 获取HonorPushClient实例
            val getInstanceMethod = honorPushClientClass.getMethod("getInstance", Context::class.java)
            val honorPushClientInstance = getInstanceMethod.invoke(null, context)
            
            // 创建配置构建器
            val configBuilderConstructor = honorConfigBuilderClass.getConstructor()
            val configBuilder = configBuilderConstructor.newInstance()
            
            // 设置客户端ID和密钥
            val setClientIdMethod = honorConfigBuilderClass.getMethod("setClientId", String::class.java)
            val setClientSecretMethod = honorConfigBuilderClass.getMethod("setClientSecret", String::class.java)
            setClientIdMethod.invoke(configBuilder, clientId)
            setClientSecretMethod.invoke(configBuilder, clientSecret)
            
            // 构建配置
            val buildMethod = honorConfigBuilderClass.getMethod("build")
            val honorConfig = buildMethod.invoke(configBuilder)
            
            // 创建Token回调
            val tokenCallback = java.lang.reflect.Proxy.newProxyInstance(
                tokenCallbackClass.classLoader,
                arrayOf(tokenCallbackClass)
            ) { _, method, args ->
                when (method.name) {
                    "onSuccess" -> {
                        val token = args?.get(0) as? String
                        if (token != null) {
                            Log.d(TAG, "荣耀推送token获取成功: ${token.take(12)}...")
                            handleTokenCallback(null, token)
                        }
                    }
                    "onFailure" -> {
                        val errorCode = args?.get(0) as? Int ?: -1
                        val errorMsg = args?.get(1) as? String ?: "未知错误"
                        Log.e(TAG, "荣耀推送token获取失败: code=$errorCode, msg=$errorMsg")
                        handleTokenCallback(errorCode, null)
                    }
                }
                null
            }
            
            // 初始化荣耀推送服务
            val initMethod = honorPushClientClass.getMethod("init", honorConfigClass, tokenCallbackClass)
            initMethod.invoke(honorPushClientInstance, honorConfig, tokenCallback)
            
            cachedClientId = clientId
            cachedClientSecret = clientSecret
            Log.d(TAG, "荣耀初始化成功")

            // 若存在等待中的回调，启动一次轮询，避免某些机型不回调
            if (this.tokenCallback != null) {
                startPollingForToken(timeoutMs = 30000L)
            }
            true

        } catch (e: Exception) {
            Log.e(TAG, "荣耀推送初始化失败", e)
            false
        }
    }

    /**
     * 从SDK获取Token
     */
    private fun getTokenFromSDK() {
        try {
            val honorPushClientClass = Class.forName("com.hihonor.mcs.push.HonorPushClient")
            val tokenCallbackClass = Class.forName("com.hihonor.mcs.push.callback.TokenCallback")
            
            val getInstanceMethod = honorPushClientClass.getMethod("getInstance", Context::class.java)
            val honorPushClientInstance = getInstanceMethod.invoke(null, context)
            
            val tokenCallback = java.lang.reflect.Proxy.newProxyInstance(
                tokenCallbackClass.classLoader,
                arrayOf(tokenCallbackClass)
            ) { _, method, args ->
                when (method.name) {
                    "onSuccess" -> {
                        val token = args?.get(0) as? String
                        if (token != null) {
                            Log.d(TAG, "荣耀推送token获取成功: ${token.take(12)}...")
                            handleTokenCallback(null, token)
                        }
                    }
                    "onFailure" -> {
                        val errorCode = args?.get(0) as? Int ?: -1
                        val errorMsg = args?.get(1) as? String ?: "未知错误"
                        Log.e(TAG, "荣耀推送token获取失败: code=$errorCode, msg=$errorMsg")
                        handleTokenCallback(errorCode, null)
                    }
                }
                null
            }
            
            // 获取Token
            val getTokenMethod = honorPushClientClass.getMethod("getToken", tokenCallbackClass)
            getTokenMethod.invoke(honorPushClientInstance, tokenCallback)
            
        } catch (e: Exception) {
            Log.e(TAG, "从SDK获取token失败", e)
            handleTokenCallback(-1, null)
        }
    }

    /**
     * 处理Token获取回调
     */
    private fun handleTokenCallback(errorCode: Int?, token: String?) {
        mainHandler.post {
            val callback = tokenCallback
            if (callback != null) {
                if (token != null && token.isNotEmpty()) {
                    lastDeliveredToken = token
                    callback.onSuccess(token)
                } else {
                    val dooPushError = when (errorCode) {
                        -1 -> DooPushError(
                            code = DooPushError.HONOR_SDK_ERROR,
                            message = "荣耀推送SDK调用失败"
                        )
                        1 -> DooPushError(
                            code = DooPushError.HONOR_TOKEN_FAILED,
                            message = "荣耀推送token获取失败"
                        )
                        else -> DooPushError(
                            code = DooPushError.HONOR_UNKNOWN_ERROR,
                            message = "荣耀推送未知错误: $errorCode"
                        )
                    }
                    callback.onError(dooPushError)
                }
                
                // 清理回调和轮询
                tokenCallback = null
                stopPolling()
                pendingRegistration = false
            }
        }
    }

    /**
     * 获取荣耀推送Token
     *
     * @param callback Token获取回调
     */
    fun getToken(callback: TokenCallback) {
        if (!isHonorPushAvailable()) {
            mainHandler.post {
                callback.onError(DooPushError(
                    code = DooPushError.HONOR_SDK_NOT_AVAILABLE,
                    message = "荣耀推送SDK未集成"
                ))
            }
            return
        }

        // 如果已经有相同的注册在进行中，替换回调
        if (pendingRegistration) {
            Log.d(TAG, "已有荣耀token获取进行中，替换回调")
            tokenCallback = callback
            return
        }

        tokenCallback = callback
        pendingRegistration = true

        // 尝试从SDK获取token
        getTokenFromSDK()
        
        // 启动超时轮询，防止SDK不回调
        startPollingForToken(timeoutMs = 30000L)
    }

    /**
     * 启动Token获取轮询
     */
    private fun startPollingForToken(timeoutMs: Long) {
        stopPolling() // 先停止之前的轮询
        
        val startTime = System.currentTimeMillis()
        pollingRunnable = object : Runnable {
            override fun run() {
                try {
                    if (System.currentTimeMillis() - startTime >= timeoutMs) {
                        Log.w(TAG, "荣耀token获取超时")
                        handleTokenCallback(-1, null)
                        return
                    }
                    
                    // 尝试再次获取token
                    getTokenFromSDK()
                    
                    // 继续轮询
                    mainHandler.postDelayed(this, 5000)
                } catch (e: Exception) {
                    Log.e(TAG, "轮询获取token异常", e)
                    handleTokenCallback(-1, null)
                }
            }
        }
        
        mainHandler.postDelayed(pollingRunnable!!, 5000)
    }

    /**
     * 停止轮询
     */
    private fun stopPolling() {
        pollingRunnable?.let { runnable ->
            mainHandler.removeCallbacks(runnable)
            pollingRunnable = null
        }
    }

    /**
     * 清理资源
     */
    fun cleanup() {
        stopPolling()
        tokenCallback = null
        pendingRegistration = false
        lastDeliveredToken = null
    }

    /**
     * 检查荣耀推送是否可用
     *
     * @return 是否可用
     */
    fun isHonorAvailable(): Boolean {
        return isHonorPushAvailable()
    }

    /**
     * 处理Token获取成功回调（供HonorPushReceiver调用）
     *
     * @param token 获取到的Token
     */
    internal fun handleTokenSuccess(token: String) {
        Log.d(TAG, "处理Token获取成功回调: ${token.take(12)}...")
        handleTokenCallback(null, token)
    }

    /**
     * 处理Token获取失败回调（供HonorPushReceiver调用）
     *
     * @param error 错误信息
     */
    internal fun handleTokenError(error: String) {
        Log.e(TAG, "处理Token获取失败回调: $error")
        handleTokenCallback(-1, null)
    }
}

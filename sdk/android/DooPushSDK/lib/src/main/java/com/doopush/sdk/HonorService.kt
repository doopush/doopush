package com.doopush.sdk

import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.doopush.sdk.DooPushConfig
import com.doopush.sdk.models.DooPushError
import org.json.JSONObject
import java.io.InputStream

/**
 * 荣耀推送服务管理类
 *
 * 负责荣耀Push的初始化、token获取和管理
 */
class HonorService(private val context: Context) {

    enum class HonorSdkVariant { NEW, LEGACY }

    companion object {
        private const val TAG = "HonorService"

        private const val NEW_CLIENT_CLASS = "com.hihonor.push.sdk.HonorPushClient"
        private const val NEW_CALLBACK_CLASS = "com.hihonor.push.sdk.HonorPushCallback"
        private const val LEGACY_CLIENT_CLASS = "com.hihonor.mcs.push.HonorPushClient"
        private const val LEGACY_CONFIG_CLASS = "com.hihonor.mcs.push.config.HonorPushConfig"
        private const val LEGACY_CONFIG_BUILDER_CLASS = "com.hihonor.mcs.push.config.HonorPushConfig\$Builder"
        private const val LEGACY_TOKEN_CALLBACK_CLASS = "com.hihonor.mcs.push.callback.TokenCallback"
        private const val ERROR_CODE_APP_ID_MISSING = 8001002

        @Volatile
        private var cachedSdkVariant: HonorSdkVariant? = null

        // 检查荣耀推送SDK是否可用
        fun isHonorPushAvailable(): Boolean {
            return detectHonorSdkVariant()?.let {
                true
            } ?: run {
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

        private fun detectHonorSdkVariant(): HonorSdkVariant? {
            cachedSdkVariant?.let { return it }
            synchronized(HonorService::class.java) {
                cachedSdkVariant?.let { return it }
                val detected = when {
                    classExists(NEW_CLIENT_CLASS) -> HonorSdkVariant.NEW
                    classExists(LEGACY_CLIENT_CLASS) -> HonorSdkVariant.LEGACY
                    else -> null
                }
                cachedSdkVariant = detected
                return detected
            }
        }

        internal fun currentSdkVariant(): HonorSdkVariant? = detectHonorSdkVariant()

        private fun classExists(className: String): Boolean {
            return try {
                Class.forName(className)
                true
            } catch (ignored: ClassNotFoundException) {
                false
            }
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
    @Volatile
    private var honorSdkInitialized: Boolean = false
    private var cachedAppId: String? = null
    private var cachedDeveloperId: String? = null
    private var cachedCredentials: HonorCredentials? = null
    private var activeSdkVariant: HonorSdkVariant? = null

    // 缓存的配置信息（荣耀客户端需要 client_id, client_secret）
    private var cachedClientId: String? = null
    private var cachedClientSecret: String? = null

    /**
     * 自动初始化荣耀推送（从mcs-services.json读取配置）
     *
     * @return 是否初始化成功
     */
    fun configure(config: DooPushConfig.HonorConfig?) {
        if (config == null) {
            return
        }
        cachedCredentials = HonorCredentials(
            clientId = config.clientId.takeIf { it.isNotBlank() },
            clientSecret = config.clientSecret.takeIf { it.isNotBlank() },
            appId = config.appId.takeIf { it.isNotBlank() },
            developerId = config.developerId.takeIf { it.isNotBlank() }
        ).also { applyCredentials(it) }
    }

    fun autoInitialize(): Boolean {
        val variant = currentSdkVariant()
        if (variant == null) {
            Log.w(TAG, "未检测到可用的荣耀推送SDK，跳过自动初始化")
            return false
        }

        val credentials = loadHonorConfigFromAssets()
        credentials?.let { applyCredentials(it) }

        return if (credentials != null) {
            initialize(credentials.clientId.orEmpty(), credentials.clientSecret.orEmpty())
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
    private data class HonorCredentials(
        val clientId: String?,
        val clientSecret: String?,
        val appId: String?,
        val developerId: String?
    )

    private fun loadHonorConfigFromAssets(): HonorCredentials? {
        if (cachedCredentials != null) {
            return cachedCredentials
        }
        
        return try {
            val inputStream: InputStream = context.assets.open("mcs-services.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(jsonString)

            // 荣耀 客户端需要 client_id 和 client_secret
            val clientId = jsonObject.optString("client_id", "").takeIf { it.isNotBlank() }
            val clientSecret = jsonObject.optString("client_secret", "").takeIf { it.isNotBlank() }
            val appId = jsonObject.optString("app_id", "").takeIf { it.isNotBlank() }
            val developerId = jsonObject.optString("developer_id", "").takeIf { it.isNotBlank() }

            if (clientId != null && clientSecret != null) {
                Log.d(TAG, "荣耀配置读取成功: client_id/client_secret 就绪")
            } else {
                Log.w(TAG, "mcs-services.json中缺少client_id或client_secret，将尝试其他来源")
            }

            if (appId != null) {
                Log.d(TAG, "荣耀配置读取成功: app_id=${appId.takeLast(6)}")
            } else {
                Log.w(TAG, "mcs-services.json中缺少app_id，需在Manifest中配置 com.hihonor.push.app_id")
            }

            val credentials = HonorCredentials(clientId, clientSecret, appId, developerId)
            cachedCredentials = credentials
            credentials
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
    private fun applyCredentials(credentials: HonorCredentials) {
        credentials.clientId?.let { cachedClientId = it }
        credentials.clientSecret?.let { cachedClientSecret = it }
        credentials.appId?.let { cachedAppId = it }
        credentials.developerId?.let { cachedDeveloperId = it }
    }

    fun initialize(clientId: String, clientSecret: String): Boolean {
        val variant = currentSdkVariant()
        if (variant == null) {
            Log.w(TAG, "荣耀 SDK 未集成")
            return false
        }

        activeSdkVariant = variant
        cachedClientId = clientId.takeIf { it.isNotBlank() }
        cachedClientSecret = clientSecret.takeIf { it.isNotBlank() }

        val initialized = when (variant) {
            HonorSdkVariant.NEW -> initializeNewSdk()
            HonorSdkVariant.LEGACY -> initializeLegacySdk()
        }

        honorSdkInitialized = honorSdkInitialized || initialized

        if (initialized && this.tokenCallback != null) {
            // 若存在等待中的回调，启动一次轮询，避免某些机型不回调
            startPollingForToken(timeoutMs = 30000L)
        }

        return initialized
    }

    private fun initializeNewSdk(): Boolean {
        if (!ensureHonorAppIdAvailable()) {
            return false
        }

        return try {
            val honorPushClientClass = Class.forName(NEW_CLIENT_CLASS)
            val getInstanceMethod = honorPushClientClass.getMethod("getInstance")
            val honorPushClientInstance = getInstanceMethod.invoke(null)

            // 检查设备是否支持荣耀推送
            val checkSupportMethod = runCatching {
                honorPushClientClass.getMethod("checkSupportHonorPush", Context::class.java)
            }.getOrNull()
            if (checkSupportMethod != null) {
                val supported = (checkSupportMethod.invoke(honorPushClientInstance, context.applicationContext) as? Boolean) ?: false
                if (!supported) {
                    Log.w(TAG, "当前设备不支持荣耀推送服务")
                    return false
                }
            }

            val initMethod = honorPushClientClass.getMethod("init", Context::class.java, Boolean::class.javaPrimitiveType)
            initMethod.invoke(honorPushClientInstance, context.applicationContext, true)
            honorSdkInitialized = true
            Log.d(TAG, "荣耀推送新SDK初始化成功")
            true
        } catch (e: ClassNotFoundException) {
            Log.d(TAG, "荣耀推送新SDK未集成: ${e.message}")
            false
        } catch (e: Exception) {
            Log.e(TAG, "荣耀推送新SDK初始化失败", e)
            false
        }
    }

    private fun initializeLegacySdk(): Boolean {
        return try {
            val clientId = cachedClientId
            val clientSecret = cachedClientSecret
            if (clientId.isNullOrEmpty() || clientSecret.isNullOrEmpty()) {
                Log.w(TAG, "荣耀旧版SDK需要提供clientId和clientSecret")
                return false
            }

            val honorPushClientClass = Class.forName(LEGACY_CLIENT_CLASS)
            val honorConfigClass = Class.forName(LEGACY_CONFIG_CLASS)
            val honorConfigBuilderClass = Class.forName(LEGACY_CONFIG_BUILDER_CLASS)
            val tokenCallbackClass = Class.forName(LEGACY_TOKEN_CALLBACK_CLASS)

            val getInstanceMethod = honorPushClientClass.getMethod("getInstance", Context::class.java)
            val honorPushClientInstance = getInstanceMethod.invoke(null, context)

            val configBuilderConstructor = honorConfigBuilderClass.getConstructor()
            val configBuilder = configBuilderConstructor.newInstance()

            val setClientIdMethod = honorConfigBuilderClass.getMethod("setClientId", String::class.java)
            val setClientSecretMethod = honorConfigBuilderClass.getMethod("setClientSecret", String::class.java)
            setClientIdMethod.invoke(configBuilder, clientId)
            setClientSecretMethod.invoke(configBuilder, clientSecret)

            val buildMethod = honorConfigBuilderClass.getMethod("build")
            val honorConfig = buildMethod.invoke(configBuilder)

            val tokenCallback = java.lang.reflect.Proxy.newProxyInstance(
                tokenCallbackClass.classLoader,
                arrayOf(tokenCallbackClass)
            ) { _, method, args ->
                when (method.name) {
                    "onSuccess" -> {
                        val token = args?.getOrNull(0) as? String
                        if (!token.isNullOrEmpty()) {
                            Log.d(TAG, "荣耀推送token获取成功: ${token.take(12)}...")
                            handleTokenCallback(null, token)
                        }
                    }
                    "onFailure" -> {
                        val errorCode = args?.getOrNull(0) as? Int ?: -1
                        val errorMsg = args?.getOrNull(1) as? String ?: "未知错误"
                        Log.e(TAG, "荣耀推送token获取失败: code=$errorCode, msg=$errorMsg")
                        handleTokenCallback(errorCode, null)
                    }
                }
                null
            }

            val initMethod = honorPushClientClass.getMethod("init", honorConfigClass, tokenCallbackClass)
            initMethod.invoke(honorPushClientInstance, honorConfig, tokenCallback)

            honorSdkInitialized = true
            Log.d(TAG, "荣耀推送旧版SDK初始化成功")
            true
        } catch (e: Exception) {
            Log.e(TAG, "荣耀推送旧版SDK初始化失败", e)
            false
        }
    }

    /**
     * 从SDK获取Token
     */
    private fun getTokenFromSDK() {
        val variant = currentSdkVariant()
        activeSdkVariant = variant
        when (variant) {
            HonorSdkVariant.NEW -> getTokenFromNewSdk()
            HonorSdkVariant.LEGACY -> getTokenFromLegacySdk()
            null -> {
                Log.w(TAG, "荣耀推送SDK未集成，无法获取token")
                handleTokenCallback(-1, null)
            }
        }
    }

    private fun getTokenFromNewSdk() {
        try {
            val honorPushClientClass = Class.forName(NEW_CLIENT_CLASS)
            val honorPushCallbackClass = Class.forName(NEW_CALLBACK_CLASS)

            val getInstanceMethod = honorPushClientClass.getMethod("getInstance")
            val honorPushClientInstance = getInstanceMethod.invoke(null)

            val tokenCallback = java.lang.reflect.Proxy.newProxyInstance(
                honorPushCallbackClass.classLoader,
                arrayOf(honorPushCallbackClass)
            ) { _, method, args ->
                when (method.name) {
                    "onSuccess" -> {
                        val token = args?.getOrNull(0) as? String
                        if (!token.isNullOrEmpty()) {
                            Log.d(TAG, "荣耀推送(新SDK)token获取成功: ${token.take(12)}...")
                            handleTokenCallback(null, token)
                        } else {
                            Log.w(TAG, "荣耀推送(新SDK)返回空token")
                            handleTokenCallback(-1, null)
                        }
                    }
                    "onFailure" -> {
                        val errorCode = args?.getOrNull(0) as? Int ?: -1
                        val errorMsg = args?.getOrNull(1) as? String ?: "未知错误"
                        Log.e(TAG, "荣耀推送(新SDK)token获取失败: code=$errorCode, msg=$errorMsg")
                        handleTokenCallback(errorCode, null)
                    }
                }
                null
            }

            val getPushTokenMethod = honorPushClientClass.getMethod("getPushToken", honorPushCallbackClass)
            getPushTokenMethod.invoke(honorPushClientInstance, tokenCallback)

        } catch (e: Exception) {
            Log.e(TAG, "从荣耀新SDK获取token失败", e)
            handleTokenCallback(-1, null)
        }
    }

    private fun getTokenFromLegacySdk() {
        try {
            val honorPushClientClass = Class.forName(LEGACY_CLIENT_CLASS)
            val tokenCallbackClass = Class.forName(LEGACY_TOKEN_CALLBACK_CLASS)

            val getInstanceMethod = honorPushClientClass.getMethod("getInstance", Context::class.java)
            val honorPushClientInstance = getInstanceMethod.invoke(null, context)

            val tokenCallback = java.lang.reflect.Proxy.newProxyInstance(
                tokenCallbackClass.classLoader,
                arrayOf(tokenCallbackClass)
            ) { _, method, args ->
                when (method.name) {
                    "onSuccess" -> {
                        val token = args?.getOrNull(0) as? String
                        if (!token.isNullOrEmpty()) {
                            Log.d(TAG, "荣耀推送token获取成功: ${token.take(12)}...")
                            handleTokenCallback(null, token)
                        }
                    }
                    "onFailure" -> {
                        val errorCode = args?.getOrNull(0) as? Int ?: -1
                        val errorMsg = args?.getOrNull(1) as? String ?: "未知错误"
                        Log.e(TAG, "荣耀推送token获取失败: code=$errorCode, msg=$errorMsg")
                        handleTokenCallback(errorCode, null)
                    }
                }
                null
            }

            val getTokenMethod = honorPushClientClass.getMethod("getToken", tokenCallbackClass)
            getTokenMethod.invoke(honorPushClientInstance, tokenCallback)

        } catch (e: Exception) {
            Log.e(TAG, "从荣耀旧版SDK获取token失败", e)
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
                        ERROR_CODE_APP_ID_MISSING -> DooPushError(
                            code = DooPushError.HONOR_APP_ID_MISSING,
                            message = "荣耀推送缺少AppId，请在AndroidManifest.xml中配置com.hihonor.push.app_id",
                            details = "参考荣耀推送集成文档，确保清单中声明<meta-data android:name=\"com.hihonor.push.app_id\" android:value=\"您的AppId\"/>"
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

    private fun ensureHonorAppIdAvailable(): Boolean {
        if (!cachedAppId.isNullOrBlank()) {
            return true
        }

        val manifestAppId = readManifestAppId()
        if (!manifestAppId.isNullOrBlank()) {
            cachedAppId = manifestAppId
            return true
        }

        if (cachedCredentials == null) {
            loadHonorConfigFromAssets()?.let { applyCredentials(it) }
        }

        if (!cachedAppId.isNullOrBlank()) {
            return true
        }

        Log.e(TAG, "未检测到荣耀推送AppId。请在AndroidManifest.xml中配置<meta-data android:name=\"com.hihonor.push.app_id\" android:value=\"您的AppId\"/>")
        return false
    }

    private fun readManifestAppId(): String? {
        return try {
            val applicationInfo = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
            val metaData = applicationInfo.metaData ?: return null
            metaData.getStringCompat("com.hihonor.push.app_id")?.also { value ->
                if (value.isNotBlank()) {
                    cachedDeveloperId = metaData.getStringCompat("com.hihonor.push.developer_id") ?: cachedDeveloperId
                }
            }?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            Log.w(TAG, "读取Manifest中com.hihonor.push.app_id失败", e)
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun Bundle.getStringCompat(key: String): String? {
        val value = get(key) ?: return null
        return when (value) {
            is String -> value.takeIf { it.isNotBlank() }
            is CharSequence -> value.toString().takeIf { it.isNotBlank() }
            is Number -> value.toString()
            else -> value.toString()
        }
    }

    private fun ensureInitialized(): Boolean {
        if (honorSdkInitialized) {
            return true
        }

        return when (currentSdkVariant()) {
            HonorSdkVariant.NEW -> {
                val initialized = initializeNewSdk()
                honorSdkInitialized = honorSdkInitialized || initialized
                honorSdkInitialized
            }
            HonorSdkVariant.LEGACY -> {
                val hasCachedCredentials = !cachedClientId.isNullOrEmpty() && !cachedClientSecret.isNullOrEmpty()
                if (!hasCachedCredentials) {
                    loadHonorConfigFromAssets()?.let { (clientId, clientSecret) ->
                        cachedClientId = clientId
                        cachedClientSecret = clientSecret
                    }
                }
                if (cachedClientId.isNullOrEmpty() || cachedClientSecret.isNullOrEmpty()) {
                    Log.w(TAG, "荣耀旧版SDK缺少clientId/clientSecret配置")
                    return false
                }
                val initialized = initializeLegacySdk()
                honorSdkInitialized = honorSdkInitialized || initialized
                honorSdkInitialized
            }
            null -> false
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

        if (!ensureInitialized()) {
            Log.e(TAG, "荣耀推送SDK初始化失败，无法获取token")
            val errorCode = if (activeSdkVariant == HonorSdkVariant.NEW && cachedAppId.isNullOrBlank()) {
                ERROR_CODE_APP_ID_MISSING
            } else {
                -1
            }
            handleTokenCallback(errorCode, null)
            return
        }

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
        honorSdkInitialized = false
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

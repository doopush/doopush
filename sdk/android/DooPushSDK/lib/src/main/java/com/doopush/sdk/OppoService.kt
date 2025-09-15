package com.doopush.sdk

import android.content.Context
import android.util.Log
import android.os.Handler
import android.os.Looper
import com.doopush.sdk.models.DooPushError
import org.json.JSONObject
import java.io.InputStream

/**
 * OPPO推送服务管理类
 *
 * 负责OPPO HeytapPush的初始化、token获取和管理
 */
class OppoService(private val context: Context) {

    companion object {
        private const val TAG = "OppoService"

        // 检查OPPO推送SDK是否可用
        fun isOppoPushAvailable(): Boolean {
            return try {
                Class.forName("com.heytap.msp.push.HeytapPushManager")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "OPPO推送SDK未集成")
                false
            }
        }

        // 检查是否为OPPO或OnePlus设备
        fun isOppoOrOnePlusDevice(): Boolean {
            val manufacturer = android.os.Build.MANUFACTURER
            val brand = android.os.Build.BRAND
            return manufacturer.equals("oppo", ignoreCase = true) ||
                   brand.equals("oppo", ignoreCase = true) ||
                   manufacturer.equals("oneplus", ignoreCase = true) ||
                   brand.equals("oneplus", ignoreCase = true)
        }
    }

    /**
     * OPPO推送Token获取回调接口
     */
    interface TokenCallback {
        fun onSuccess(token: String)
        fun onError(error: DooPushError)
    }

    // 用于缓存注册结果的回调
    private var tokenCallback: TokenCallback? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pollingRunnable: Runnable? = null

    // 缓存的配置信息（OPPO客户端不需要 app_id）
    private var cachedAppKey: String? = null
    private var cachedAppSecret: String? = null

    /**
     * 自动初始化OPPO推送（从oppo-services.json读取配置）
     *
     * @return 是否初始化成功
     */
    fun autoInitialize(): Boolean {
        val config = loadOppoConfigFromAssets()
        return if (config != null) {
            initialize(config.first, config.second)
        } else {
            Log.w(TAG, "未读取到oppo-services.json，跳过OPPO初始化")
            false
        }
    }

    /**
     * 从assets目录读取oppo-services.json配置
     *
     * @return Pair<appKey, appSecret> 或 null
     */
    private fun loadOppoConfigFromAssets(): Pair<String, String>? {
        return try {
            val inputStream: InputStream = context.assets.open("oppo-services.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(jsonString)

            // OPPO 客户端仅需要 app_key 与 app_secret
            val appKey = jsonObject.optString("app_key", "")
            val appSecret = jsonObject.optString("app_secret", "")

            if (appKey.isNotEmpty() && appSecret.isNotEmpty()) {
                Log.d(TAG, "OPPO配置读取成功: app_key/app_secret 就绪")
                Pair(appKey, appSecret)
            } else {
                Log.w(TAG, "oppo-services.json中缺少必要配置: 需要 app_key 与 app_secret")
                null
            }
        } catch (e: Exception) {
            Log.d(TAG, "读取oppo-services.json失败")
            null
        }
    }

    /**
     * 初始化OPPO推送
     *
     * @param appKey OPPO应用Key
     * @param appSecret OPPO应用Secret
     * @return 是否初始化成功
     */
    fun initialize(appKey: String, appSecret: String): Boolean {
        if (!isOppoPushAvailable()) {
            Log.w(TAG, "OPPO SDK 未集成")
            return false
        }

        return try {
            // 由于使用 compileOnly 依赖，这里用反射调用 OPPO SDK
            val heytapPushManagerClass = Class.forName("com.heytap.msp.push.HeytapPushManager")
            val iCallBackResultServiceClass = Class.forName("com.heytap.msp.push.callback.ICallBackResultService")
            
            // 初始化HeytapPushManager（第二个参数为原始boolean类型）
            val initMethod = heytapPushManagerClass.getMethod("init", Context::class.java, java.lang.Boolean.TYPE)
            initMethod.invoke(null, context, true) // true for debug mode

            // 创建回调对象（完全在SDK内部，通过动态代理实现接口）
            val callbackObject = java.lang.reflect.Proxy.newProxyInstance(
                iCallBackResultServiceClass.classLoader,
                arrayOf(iCallBackResultServiceClass)
            ) { _, method, args ->
                when (method.name) {
                    "onRegister" -> {
                        val code = args?.get(0) as? Int ?: -1
                        val regid = args?.get(1) as? String
                        handleRegisterCallback(code, regid)
                    }
                    "onUnRegister" -> {
                        val code = args?.get(0) as? Int ?: -1
                        Log.d(TAG, "OPPO推送取消注册回调: code=$code")
                    }
                    else -> {
                        Log.d(TAG, "OPPO推送其他回调: ${method.name}")
                    }
                }
                null
            }

            // 注册推送服务
            // 优先尝试 4 参签名：register(Context, appKey, appSecret, ICallBackResultService)
            // 兼容兜底 5 参(JSON) 重载：register(Context, appKey, appSecret, JSONObject, ICallBackResultService)
            try {
                val register4Params = arrayOf(
                    Context::class.java,
                    String::class.java,
                    String::class.java,
                    iCallBackResultServiceClass
                )
                val register4 = heytapPushManagerClass.getMethod("register", *register4Params)
                register4.invoke(null, context, appKey, appSecret, callbackObject)
            } catch (e: NoSuchMethodException) {
                // 尝试带 JSONObject 的重载
                val jsonClass = Class.forName("org.json.JSONObject")
                val register5Params = arrayOf(
                    Context::class.java,
                    String::class.java,
                    String::class.java,
                    jsonClass,
                    iCallBackResultServiceClass
                )
                val register5 = heytapPushManagerClass.getMethod("register", *register5Params)
                val emptyJson = org.json.JSONObject()
                register5.invoke(null, context, appKey, appSecret, emptyJson, callbackObject)
            }
            
            cachedAppKey = appKey
            cachedAppSecret = appSecret
            Log.d(TAG, "OPPO初始化成功")

            // 若存在等待中的回调，启动一次轮询，避免某些机型不回调 onRegister
            if (tokenCallback != null) {
                startPollingForRegisterId(timeoutMs = 30000L)
            }
            true

        } catch (e: Exception) {
            Log.e(TAG, "OPPO推送初始化失败", e)
            false
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
                    Log.e(TAG, "OPPO RegisterId 轮询超时")
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
            Log.d(TAG, "OPPO注册成功: ${regid.take(12)}...")
            tokenCallback?.onSuccess(regid)
            tokenCallback = null
        } else {
            val errorMsg = "OPPO注册失败: code=$code regid=$regid"
            Log.e(TAG, errorMsg)
            tokenCallback?.onError(DooPushError.oppoRegisterFailed(errorMsg))
            tokenCallback = null
        }
    }

    /**
     * 获取OPPO推送Token（使用缓存的配置）
     *
     * @param callback token获取回调
     */
    fun getToken(callback: TokenCallback) {
        if (cachedAppKey != null && cachedAppSecret != null) {
            // 尝试获取已缓存的token
            val cachedToken = getRegId()
            if (!cachedToken.isNullOrEmpty()) {
                Log.d(TAG, "使用缓存的OPPO推送token: ${cachedToken.take(12)}...")
                callback.onSuccess(cachedToken)
            } else {
                // 如果没有缓存token，重新初始化以触发注册回调
                this.tokenCallback = callback // 缓存回调
                initialize(cachedAppKey!!, cachedAppSecret!!)
            }
        } else {
            // 尝试自动初始化
            val success = autoInitialize()
            if (success && cachedAppKey != null && cachedAppSecret != null) {
                // 自动初始化成功后，再次尝试获取token
                getToken(callback)
            } else {
                callback.onError(DooPushError.oppoConfigInvalid("OPPO推送未正确配置或初始化"))
            }
        }
    }

    /**
     * 获取OPPO推送注册ID（token）
     *
     * @return 注册ID或null
     */
    private fun getRegId(): String? {
        return try {
            val heytapPushManagerClass = Class.forName("com.heytap.msp.push.HeytapPushManager")
            val getRegisterIDMethod = heytapPushManagerClass.getMethod("getRegisterID")
            getRegisterIDMethod.invoke(null) as? String
        } catch (e: Exception) {
            Log.d(TAG, "获取OPPO推送RegId失败", e)
            null
        }
    }

    /**
     * 检查OPPO推送服务是否可用
     *
     * @return 是否可用
     */
    fun isOppoAvailable(): Boolean {
        return isOppoPushAvailable() && isOppoOrOnePlusDevice()
    }

    /**
     * 获取服务状态信息
     *
     * @return 状态信息字符串
     */
    fun getServiceStatus(): String {
        val builder = StringBuilder()
        builder.append("OPPO推送服务状态:")
        builder.append("\n  SDK可用: ${isOppoPushAvailable()}")
        builder.append("\n  OPPO/OnePlus设备: ${isOppoOrOnePlusDevice()}")
        builder.append("\n  服务可用: ${isOppoAvailable()}")

        // 尝试获取当前token
        val regId = getRegId()
        builder.append("\n  当前RegId: ${if (!regId.isNullOrEmpty()) "${regId.take(12)}..." else "未获取"}")

        return builder.toString()
    }

    /**
     * 处理注册成功回调（供OppoPushReceiver调用）
     */
    fun handleRegisterSuccess(regId: String) {
        Log.d(TAG, "OPPO推送注册成功: ${regId.take(12)}...")
        tokenCallback?.onSuccess(regId)
        tokenCallback = null
    }

    /**
     * 处理注册失败回调（供OppoPushReceiver调用）
     */
    fun handleRegisterError(reason: String) {
        Log.e(TAG, "OPPO推送注册失败: $reason")
        tokenCallback?.onError(DooPushError(
            code = DooPushError.OPPO_REGISTER_FAILED,
            message = "OPPO推送注册失败: $reason"
        ))
        tokenCallback = null
    }
}
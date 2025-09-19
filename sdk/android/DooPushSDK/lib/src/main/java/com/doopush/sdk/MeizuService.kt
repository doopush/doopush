package com.doopush.sdk

import android.content.Context
import android.util.Log
import android.os.Handler
import android.os.Looper
import com.doopush.sdk.models.DooPushError
import org.json.JSONObject
import java.io.InputStream

/**
 * 魅族推送服务管理类
 *
 * 负责魅族Push的初始化、token获取和管理
 */
class MeizuService(private val context: Context) {

    companion object {
        private const val TAG = "MeizuService"

        // 检查魅族推送SDK是否可用
        fun isMeizuPushAvailable(): Boolean {
            return try {
                Class.forName("com.meizu.cloud.pushsdk.PushManager")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "魅族推送SDK未集成")
                false
            }
        }

        // 检查是否为魅族设备
        fun isMeizuDevice(): Boolean {
            val manufacturer = android.os.Build.MANUFACTURER
            val brand = android.os.Build.BRAND
            return manufacturer.equals("meizu", ignoreCase = true) ||
                   brand.equals("meizu", ignoreCase = true)
        }
    }

    /**
     * 魅族推送Token获取回调接口
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
    private var lastDeliveredPushId: String? = null

    // 缓存的配置信息（魅族客户端需要 app_id, app_key）
    private var cachedAppId: String? = null
    private var cachedAppKey: String? = null

    /**
     * 自动初始化魅族推送（从meizu-services.json读取配置）
     *
     * @return 是否初始化成功
     */
    fun autoInitialize(): Boolean {
        val config = loadMeizuConfigFromAssets()
        return if (config != null) {
            initialize(config.first, config.second)
        } else {
            Log.w(TAG, "未读取到meizu-services.json，跳过魅族初始化")
            false
        }
    }

    /**
     * 从assets目录读取meizu-services.json配置
     *
     * @return Pair<appId, appKey> 或 null
     */
    private fun loadMeizuConfigFromAssets(): Pair<String, String>? {
        return try {
            val inputStream: InputStream = context.assets.open("meizu-services.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(jsonString)

            // 魅族客户端需要 app_id 和 app_key
            val appId = jsonObject.optString("app_id", "")
            val appKey = jsonObject.optString("app_key", "")

            if (appId.isNotEmpty() && appKey.isNotEmpty()) {
                Log.d(TAG, "魅族配置读取成功: app_id/app_key 就绪")
                Pair(appId, appKey)
            } else {
                Log.w(TAG, "meizu-services.json中缺少必要配置: 需要 app_id 和 app_key")
                null
            }
        } catch (e: Exception) {
            Log.d(TAG, "读取meizu-services.json失败")
            null
        }
    }

    /**
     * 初始化魅族推送
     *
     * @param appId 魅族应用ID
     * @param appKey 魅族应用AppKey
     * @return 是否初始化成功
     */
    fun initialize(appId: String, appKey: String): Boolean {
        if (!isMeizuPushAvailable()) {
            Log.w(TAG, "魅族SDK 未集成")
            return false
        }

        return try {
            // 由于使用 compileOnly 依赖，这里用反射调用魅族SDK
            val pushManagerClass = Class.forName("com.meizu.cloud.pushsdk.PushManager")
            
            // 注册推送服务，魅族SDK通常在这个方法中完成初始化和token获取
            val registerMethod = pushManagerClass.getMethod(
                "register", 
                Context::class.java, 
                String::class.java, 
                String::class.java
            )
            
            // 调用注册方法，魅族SDK会异步返回pushId
            registerMethod.invoke(null, context, appId, appKey)
            
            cachedAppId = appId
            cachedAppKey = appKey
            Log.d(TAG, "魅族初始化成功")

            // 若存在等待中的回调，启动轮询获取pushId
            if (tokenCallback != null) {
                startPollingForPushId(timeoutMs = 30000L)
            }
            true

        } catch (e: Exception) {
            Log.e(TAG, "魅族推送初始化失败", e)
            false
        }
    }

    /**
     * 启动定时轮询获取 PushId，避免部分设备不触发回调
     */
    private fun startPollingForPushId(timeoutMs: Long) {
        stopPolling()
        val startAt = System.currentTimeMillis()
        pollingRunnable = object : Runnable {
            override fun run() {
                val pushId = getPushId()
                if (!pushId.isNullOrEmpty()) {
                    handleRegisterCallback(0, pushId)
                    stopPolling()
                    return
                }
                val elapsed = System.currentTimeMillis() - startAt
                if (elapsed < timeoutMs) {
                    mainHandler.postDelayed(this, 1000L)
                } else {
                    Log.e(TAG, "魅族PushId 轮询超时")
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
    private fun handleRegisterCallback(code: Int, pushId: String?) {
        if (code == 0 && !pushId.isNullOrEmpty()) {
            deliverRegisterSuccess(pushId)
        } else {
            val errorMsg = "魅族注册失败: code=$code pushId=$pushId"
            notifyRegisterFailure(errorMsg)
        }
    }

    /**
     * 获取魅族推送Token（使用缓存的配置）
     *
     * @param callback token获取回调
     */
    fun getToken(callback: TokenCallback) {
        if (cachedAppId != null && cachedAppKey != null) {
            // 尝试获取已缓存的token
            val cachedToken = getPushId()
            if (!cachedToken.isNullOrEmpty()) {
                Log.d(TAG, "使用缓存的魅族推送token: ${cachedToken.take(12)}...")
                lastDeliveredPushId = cachedToken
                pendingRegistration = false
                callback.onSuccess(cachedToken)
            } else {
                // 如果没有缓存token，重新初始化以触发注册回调
                this.tokenCallback = callback // 缓存回调
                pendingRegistration = true
                initialize(cachedAppId!!, cachedAppKey!!)
            }
        } else {
            // 尝试自动初始化
            val success = autoInitialize()
            if (success && cachedAppId != null && cachedAppKey != null) {
                // 自动初始化成功后，再次尝试获取token
                getToken(callback)
            } else {
                callback.onError(DooPushError.meizuConfigInvalid("魅族推送未正确配置或初始化"))
            }
        }
    }

    /**
     * 获取魅族推送注册ID（pushId）
     *
     * @return 推送ID或null
     */
    private fun getPushId(): String? {
        return try {
            val pushManagerClass = Class.forName("com.meizu.cloud.pushsdk.PushManager")
            val getPushIdMethod = pushManagerClass.getMethod("getPushId", Context::class.java)
            val pushId = getPushIdMethod.invoke(null, context) as? String
            pushId?.takeIf { it.isNotEmpty() }
        } catch (e: Exception) {
            Log.d(TAG, "获取魅族推送PushId失败", e)
            null
        }
    }

    /**
     * 检查魅族推送服务是否可用
     *
     * @return 是否可用
     */
    fun isMeizuAvailable(): Boolean {
        return isMeizuPushAvailable() && isMeizuDevice()
    }

    /**
     * 获取服务状态信息
     *
     * @return 状态信息字符串
     */
    fun getServiceStatus(): String {
        val builder = StringBuilder()
        builder.append("魅族推送服务状态:")
        builder.append("\n  SDK可用: ${isMeizuPushAvailable()}")
        builder.append("\n  魅族设备: ${isMeizuDevice()}")
        builder.append("\n  服务可用: ${isMeizuAvailable()}")

        val currentPushId = getPushId()
        builder.append("\n  当前PushId: ${currentPushId?.take(12) ?: "未获取"}")

        return builder.toString()
    }

    /**
     * 处理注册成功回调（供MeizuPushReceiver调用）
     */
    fun handleRegisterSuccess(pushId: String) {
        deliverRegisterSuccess(pushId)
    }

    /**
     * 处理注册失败回调（供MeizuPushReceiver调用）
     */
    fun handleRegisterError(reason: String) {
        notifyRegisterFailure("魅族推送注册失败: $reason")
    }

    @Synchronized
    private fun deliverRegisterSuccess(pushId: String) {
        if (!pendingRegistration && lastDeliveredPushId == pushId) {
            Log.d(TAG, "忽略重复的魅族注册成功回调: ${pushId.take(12)}...")
            return
        }
        lastDeliveredPushId = pushId
        pendingRegistration = false
        stopPolling()
        Log.d(TAG, "魅族推送注册成功: ${pushId.take(12)}...")
        tokenCallback?.onSuccess(pushId)
        tokenCallback = null
    }

    @Synchronized
    private fun notifyRegisterFailure(message: String) {
        stopPolling()
        if (!pendingRegistration) {
            Log.w(TAG, "忽略重复的魅族注册失败回调: $message")
            return
        }
        pendingRegistration = false
        lastDeliveredPushId = null
        Log.e(TAG, message)
        tokenCallback?.onError(DooPushError.meizuRegisterFailed(message))
        tokenCallback = null
    }

    /**
     * 订阅标签（魅族推送支持标签功能）
     *
     * @param tags 标签列表
     * @param callback 操作回调
     */
    fun subscribeTags(tags: List<String>, callback: ((Boolean, String?) -> Unit)? = null) {
        if (!isMeizuPushAvailable()) {
            callback?.invoke(false, "魅族SDK未集成")
            return
        }

        try {
            val pushManagerClass = Class.forName("com.meizu.cloud.pushsdk.PushManager")
            val subscribeTagsMethod = pushManagerClass.getMethod(
                "subScribeTags",
                Context::class.java,
                java.util.List::class.java
            )
            
            subscribeTagsMethod.invoke(null, context, tags)
            Log.d(TAG, "魅族推送标签订阅请求已发送: $tags")
            callback?.invoke(true, null)
        } catch (e: Exception) {
            Log.e(TAG, "魅族推送标签订阅失败", e)
            callback?.invoke(false, e.message)
        }
    }

    /**
     * 取消订阅标签
     *
     * @param tags 标签列表
     * @param callback 操作回调
     */
    fun unsubscribeTags(tags: List<String>, callback: ((Boolean, String?) -> Unit)? = null) {
        if (!isMeizuPushAvailable()) {
            callback?.invoke(false, "魅族SDK未集成")
            return
        }

        try {
            val pushManagerClass = Class.forName("com.meizu.cloud.pushsdk.PushManager")
            val unsubscribeTagsMethod = pushManagerClass.getMethod(
                "unSubScribeTags",
                Context::class.java,
                java.util.List::class.java
            )
            
            unsubscribeTagsMethod.invoke(null, context, tags)
            Log.d(TAG, "魅族推送标签取消订阅请求已发送: $tags")
            callback?.invoke(true, null)
        } catch (e: Exception) {
            Log.e(TAG, "魅族推送标签取消订阅失败", e)
            callback?.invoke(false, e.message)
        }
    }

    /**
     * 检查推送是否开启
     *
     * @return 是否开启
     */
    fun isPushEnabled(): Boolean {
        return try {
            val pushManagerClass = Class.forName("com.meizu.cloud.pushsdk.PushManager")
            val checkPushMethod = pushManagerClass.getMethod("checkPush", Context::class.java)
            val result = checkPushMethod.invoke(null, context) as? Boolean
            result ?: false
        } catch (e: Exception) {
            Log.d(TAG, "检查魅族推送状态失败", e)
            false
        }
    }
}

package com.doopush.sdk

import android.content.Context
import android.util.Log
import com.doopush.sdk.models.DooPushError
import org.json.JSONObject
import java.io.InputStream

/**
 * 小米推送服务管理类
 * 
 * 负责小米MiPush的初始化、token获取和管理
 */
class XiaomiService(private val context: Context) {
    
    companion object {
        private const val TAG = "XiaomiService"
        
        // 检查小米推送SDK是否可用
        fun isXiaomiPushAvailable(): Boolean {
            return try {
                Class.forName("com.xiaomi.mipush.sdk.MiPushClient")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "小米推送SDK未集成")
                false
            }
        }
        
        // 检查是否为小米设备
        fun isMiuiDevice(): Boolean {
            return try {
                val miuiVersion = getSystemProperty("ro.miui.ui.version.name")
                !miuiVersion.isNullOrEmpty()
            } catch (e: Exception) {
                Log.d(TAG, "检测MIUI版本失败", e)
                false
            }
        }
        
        private fun getSystemProperty(propName: String): String? {
            return try {
                val systemPropertiesClass = Class.forName("android.os.SystemProperties")
                val getMethod = systemPropertiesClass.getMethod("get", String::class.java)
                getMethod.invoke(null, propName) as? String
            } catch (e: Exception) {
                null
            }
        }
    }
    
    /**
     * 小米推送Token获取回调接口
     */
    interface TokenCallback {
        fun onSuccess(token: String)
        fun onError(error: DooPushError)
    }
    
    // 用于缓存注册结果的回调
    private var tokenCallback: TokenCallback? = null
    
    // 缓存的配置信息
    private var cachedAppId: String? = null
    private var cachedAppKey: String? = null
    
    /**
     * 自动初始化小米推送（从xiaomi-services.json读取配置）
     * 
     * @return 是否初始化成功
     */
    fun autoInitialize(): Boolean {
        val config = loadXiaomiConfigFromAssets()
        return if (config != null) {
            initialize(config.first, config.second)
        } else {
            Log.w(TAG, "无法从xiaomi-services.json读取配置，小米推送初始化跳过")
            false
        }
    }
    
    /**
     * 从assets目录读取xiaomi-services.json配置
     * 
     * @return Pair<appId, appKey> 或 null
     */
    private fun loadXiaomiConfigFromAssets(): Pair<String, String>? {
        return try {
            val inputStream: InputStream = context.assets.open("xiaomi-services.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(jsonString)
            
            val appId = jsonObject.optString("app_id", "")
            val appKey = jsonObject.optString("app_key", "")
            
            if (appId.isNotEmpty() && appKey.isNotEmpty()) {
                Log.d(TAG, "从xiaomi-services.json读取配置成功: AppId=$appId")
                Pair(appId, appKey)
            } else {
                Log.w(TAG, "xiaomi-services.json中缺少必要配置")
                null
            }
        } catch (e: Exception) {
            Log.d(TAG, "xiaomi-services.json文件不存在或读取失败")
            null
        }
    }
    
    /**
     * 初始化小米推送
     * 
     * @param appId 小米应用ID
     * @param appKey 小米应用Key
     * @return 是否初始化成功
     */
    fun initialize(appId: String, appKey: String): Boolean {
        if (!isXiaomiPushAvailable()) {
            Log.w(TAG, "小米推送SDK不可用")
            return false
        }
        
        return try {
            // 通过反射调用小米推送SDK
            val miPushClientClass = Class.forName("com.xiaomi.mipush.sdk.MiPushClient")
            val registerPushMethod = miPushClientClass.getMethod(
                "registerPush", 
                Context::class.java, 
                String::class.java, 
                String::class.java
            )
            
            registerPushMethod.invoke(null, context, appId, appKey)
            
            // 缓存配置信息
            cachedAppId = appId
            cachedAppKey = appKey
            
            Log.d(TAG, "小米推送初始化成功: AppId=$appId")
            true
            
        } catch (e: Exception) {
            Log.e(TAG, "小米推送初始化失败", e)
            false
        }
    }
    
    /**
     * 获取小米推送Token（使用缓存的配置）
     * 
     * @param callback token获取回调
     */
    fun getToken(callback: TokenCallback) {
        if (cachedAppId != null && cachedAppKey != null) {
            getToken(cachedAppId!!, cachedAppKey!!, callback)
        } else {
            // 尝试自动初始化
            val success = autoInitialize()
            if (success && cachedAppId != null && cachedAppKey != null) {
                getToken(cachedAppId!!, cachedAppKey!!, callback)
            } else {
                callback.onError(DooPushError.xiaomiConfigInvalid("小米推送未正确配置或初始化"))
            }
        }
    }
    
    /**
     * 获取小米推送Token
     * 
     * @param appId 小米应用ID
     * @param appKey 小米应用Key
     * @param callback token获取回调
     */
    fun getToken(appId: String, appKey: String, callback: TokenCallback) {
        if (!isXiaomiPushAvailable()) {
            callback.onError(DooPushError.xiaomiNotAvailable())
            return
        }
        
        try {
            // 缓存回调，等待注册结果
            tokenCallback = callback
            
            // 初始化小米推送（会自动获取token）
            val success = initialize(appId, appKey)
            if (!success) {
                callback.onError(DooPushError(
                    code = DooPushError.XIAOMI_INIT_FAILED,
                    message = "小米推送初始化失败"
                ))
                return
            }
            
            // 尝试获取已缓存的token
            val cachedToken = getRegId()
            if (!cachedToken.isNullOrEmpty()) {
                Log.d(TAG, "使用缓存的小米推送token: ${cachedToken.substring(0, 12)}...")
                callback.onSuccess(cachedToken)
                tokenCallback = null
            }
            // 如果没有缓存token，等待注册结果回调
            
        } catch (e: Exception) {
            Log.e(TAG, "获取小米推送token时发生异常", e)
            callback.onError(DooPushError.xiaomiTokenFailed(e))
            tokenCallback = null
        }
    }
    
    /**
     * 获取小米推送注册ID（token）
     * 
     * @return 注册ID或null
     */
    private fun getRegId(): String? {
        return try {
            val miPushClientClass = Class.forName("com.xiaomi.mipush.sdk.MiPushClient")
            val getRegIdMethod = miPushClientClass.getMethod("getRegId", Context::class.java)
            getRegIdMethod.invoke(null, context) as? String
        } catch (e: Exception) {
            Log.d(TAG, "获取小米推送RegId失败", e)
            null
        }
    }
    
    /**
     * 取消注册小米推送
     * 
     * @param callback 回调接口
     */
    fun unregisterPush(callback: (Boolean) -> Unit) {
        if (!isXiaomiPushAvailable()) {
            callback(false)
            return
        }
        
        try {
            val miPushClientClass = Class.forName("com.xiaomi.mipush.sdk.MiPushClient")
            val unregisterPushMethod = miPushClientClass.getMethod("unregisterPush", Context::class.java)
            unregisterPushMethod.invoke(null, context)
            
            Log.d(TAG, "小米推送取消注册")
            callback(true)
            
        } catch (e: Exception) {
            Log.e(TAG, "取消注册小米推送失败", e)
            callback(false)
        }
    }
    
    /**
     * 设置别名
     * 
     * @param alias 别名
     * @param callback 回调接口
     */
    fun setAlias(alias: String, callback: (Boolean) -> Unit) {
        if (!isXiaomiPushAvailable()) {
            callback(false)
            return
        }
        
        try {
            val miPushClientClass = Class.forName("com.xiaomi.mipush.sdk.MiPushClient")
            val setAliasMethod = miPushClientClass.getMethod(
                "setAlias", 
                Context::class.java, 
                String::class.java, 
                String::class.java
            )
            setAliasMethod.invoke(null, context, alias, null)
            
            Log.d(TAG, "设置小米推送别名: $alias")
            callback(true)
            
        } catch (e: Exception) {
            Log.e(TAG, "设置小米推送别名失败", e)
            callback(false)
        }
    }
    
    /**
     * 取消设置别名
     * 
     * @param alias 别名
     * @param callback 回调接口
     */
    fun unsetAlias(alias: String, callback: (Boolean) -> Unit) {
        if (!isXiaomiPushAvailable()) {
            callback(false)
            return
        }
        
        try {
            val miPushClientClass = Class.forName("com.xiaomi.mipush.sdk.MiPushClient")
            val unsetAliasMethod = miPushClientClass.getMethod(
                "unsetAlias", 
                Context::class.java, 
                String::class.java, 
                String::class.java
            )
            unsetAliasMethod.invoke(null, context, alias, null)
            
            Log.d(TAG, "取消设置小米推送别名: $alias")
            callback(true)
            
        } catch (e: Exception) {
            Log.e(TAG, "取消设置小米推送别名失败", e)
            callback(false)
        }
    }
    
    /**
     * 检查小米推送服务是否可用
     * 
     * @return 是否可用
     */
    fun isXiaomiAvailable(): Boolean {
        return isXiaomiPushAvailable() && isMiuiDevice()
    }
    
    /**
     * 获取服务状态信息
     * 
     * @return 状态信息字符串
     */
    fun getServiceStatus(): String {
        val builder = StringBuilder()
        builder.append("小米推送服务状态:")
        builder.append("\n  SDK可用: ${isXiaomiPushAvailable()}")
        builder.append("\n  MIUI设备: ${isMiuiDevice()}")
        builder.append("\n  服务可用: ${isXiaomiAvailable()}")
        
        // 尝试获取当前token
        val regId = getRegId()
        builder.append("\n  当前RegId: ${if (!regId.isNullOrEmpty()) "${regId.substring(0, 12)}..." else "未获取"}")
        
        return builder.toString()
    }
    
    /**
     * 处理注册成功回调（供XiaomiPushReceiver调用）
     */
    internal fun handleRegisterSuccess(regId: String) {
        Log.d(TAG, "小米推送注册成功: ${regId.substring(0, 12)}...")
        tokenCallback?.onSuccess(regId)
        tokenCallback = null
    }
    
    /**
     * 处理注册失败回调（供XiaomiPushReceiver调用）
     */
    internal fun handleRegisterError(reason: String) {
        Log.e(TAG, "小米推送注册失败: $reason")
        tokenCallback?.onError(DooPushError(
            code = DooPushError.XIAOMI_REGISTER_FAILED,
            message = "小米推送注册失败: $reason"
        ))
        tokenCallback = null
    }
}

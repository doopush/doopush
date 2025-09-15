package com.doopush.sdk

import android.content.Context
import android.util.Log
import com.doopush.sdk.models.DooPushError

/**
 * HMS Push Service
 * 负责华为推送服务的客户端功能（仅获取Token，不含服务端API调用）
 * 
 * 注意：此类只包含客户端功能，服务端推送功能应在后端实现
 */
class HMSService(private val context: Context) {
    
    companion object {
        private const val TAG = "HMSService"
        private const val TIMEOUT_MS = 15000L // 15秒超时
    }
    
    /**
     * Token回调接口
     */
    interface TokenCallback {
        fun onSuccess(token: String)
        fun onError(error: DooPushError)
    }
    
    /**
     * 检查HMS服务是否可用
     */
    fun isHMSAvailable(): Boolean {
        return try {
            // 检查HMS Push SDK是否存在
            Class.forName("com.huawei.hms.aaid.HmsInstanceId")
            true
        } catch (e: ClassNotFoundException) {
            Log.d(TAG, "HMS Push SDK 未集成: ${e.message}")
            false
        } catch (e: Exception) {
            Log.w(TAG, "检查HMS可用性时出错", e)
            false
        }
    }
    
    /**
     * 从 AGConnect 配置读取 App ID
     */
    private fun getAppIdFromAGConnect(): String? {
        // 方法1：使用 AGConnect SDK 标准API
        try {
            val agConnectConfigClass = Class.forName("com.huawei.agconnect.config.AGConnectServicesConfig")
            val fromContextMethod = agConnectConfigClass.getMethod("fromContext", Context::class.java)
            val config = fromContextMethod.invoke(null, context)
            val getStringMethod = agConnectConfigClass.getMethod("getString", String::class.java)
            val appId = getStringMethod.invoke(config, "client/app_id") as? String
            
            if (!appId.isNullOrEmpty()) {
                Log.d(TAG, "从 AGConnect SDK 读取到 App ID: $appId")
                return appId
            }
        } catch (e: Exception) {
            Log.d(TAG, "AGConnect SDK 读取失败，尝试 assets 方式")
        }
        
        // 方法2：从 assets 目录读取
        try {
            val inputStream = context.assets.open("agconnect-services.json")
            val appId = parseAppIdFromJson(inputStream.bufferedReader().use { it.readText() })
            inputStream.close()
            
            if (!appId.isNullOrEmpty()) {
                Log.d(TAG, "从 assets/agconnect-services.json 读取到 App ID: $appId")
                return appId
            }
        } catch (e: Exception) {
            Log.w(TAG, "无法读取 agconnect-services.json 配置文件")
        }
        
        return null
    }
    
    /**
     * 从JSON字符串中解析App ID
     */
    private fun parseAppIdFromJson(json: String): String? {
        return try {
            val clientIndex = json.indexOf("\"client\"")
            if (clientIndex != -1) {
                val appIdIndex = json.indexOf("\"app_id\"", clientIndex)
                if (appIdIndex != -1) {
                    val colonIndex = json.indexOf(":", appIdIndex)
                    val valueStart = json.indexOf("\"", colonIndex) + 1
                    val valueEnd = json.indexOf("\"", valueStart)
                    if (valueStart > 0 && valueEnd > valueStart) {
                        return json.substring(valueStart, valueEnd)
                    }
                }
            }
            null
        } catch (e: Exception) {
            null
        }
    }

    /**
     * 获取HMS Token（使用 HmsInstanceId.getToken，同步方法，需放子线程）
     */
    fun getToken(config: DooPushConfig.HMSConfig, callback: TokenCallback) {
        if (!isHMSAvailable()) {
            callback.onError(DooPushError.hmsNotAvailable())
            return
        }
        
        Thread {
            try {
                // 优先使用配置中的 appId，如果为空则从 agconnect-services.json 读取
                val appId = config.appId.takeIf { it.isNotEmpty() } ?: getAppIdFromAGConnect()
                
                if (appId.isNullOrEmpty()) {
                    Log.e(TAG, "App ID 未配置且无法从 agconnect-services.json 读取")
                    callback.onError(DooPushError.hmsConfigInvalid())
                    return@Thread
                }
                
                val clazz = Class.forName("com.huawei.hms.aaid.HmsInstanceId")
                val getInstance = clazz.getMethod("getInstance", Context::class.java)
                val instance = getInstance.invoke(null, context)
                val getToken = clazz.getMethod("getToken", String::class.java, String::class.java)
                val token = getToken.invoke(instance, appId, "HCM") as String?
                
                if (!token.isNullOrEmpty()) {
                    Log.d(TAG, "HMS Token获取成功: ${token.substring(0, 12)}...")
                    callback.onSuccess(token)
                } else {
                    Log.e(TAG, "HMS Token为空")
                    callback.onError(DooPushError.hmsTokenEmpty())
                }
            } catch (e: Exception) {
                Log.e(TAG, "HMS Token获取异常", e)
                callback.onError(DooPushError.hmsTokenError(e.message))
            }
        }.start()
    }
    
    /**
     * 获取服务状态信息
     */
    fun getServiceStatus(): String {
        return if (isHMSAvailable()) {
            "HMS Push SDK 已集成并可用"
        } else {
            "HMS Push SDK 未集成或不可用"
        }
    }
}
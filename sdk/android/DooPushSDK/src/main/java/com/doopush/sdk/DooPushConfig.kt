package com.doopush.sdk

import android.content.Context
import com.google.gson.annotations.SerializedName

/**
 * DooPush SDK 配置类
 */
data class DooPushConfig(
    @SerializedName("app_id")
    val appId: String,
    
    @SerializedName("api_key")
    val apiKey: String,
    
    @SerializedName("base_url")
    val baseURL: String = "https://doopush.com/api/v1",
    
    @SerializedName("environment")
    val environment: DooPushEnvironment = DooPushEnvironment.PRODUCTION,
    
    @SerializedName("debug_enabled")
    val debugEnabled: Boolean = false
) {
    
    /**
     * 验证配置是否有效
     */
    val isValid: Boolean
        get() = appId.isNotEmpty() && apiKey.isNotEmpty() && baseURL.isNotEmpty()
    
    /**
     * 获取完整的API URL
     * @param endpoint 接口端点
     * @return 完整的API URL
     */
    fun apiURL(endpoint: String): String {
        val cleanBaseURL = baseURL.trimEnd('/')
        val cleanEndpoint = endpoint.trimStart('/')
        return "$cleanBaseURL/$cleanEndpoint"
    }
    
    /**
     * 获取设备注册API URL
     */
    fun deviceRegistrationURL(): String {
        return apiURL("apps/$appId/devices")
    }
    
    /**
     * 获取设备更新API URL
     */
    fun deviceUpdateURL(deviceToken: String): String {
        return apiURL("apps/$appId/devices/$deviceToken")
    }
    
    override fun toString(): String {
        return "DooPushConfig(appId='$appId', baseURL='$baseURL', environment=$environment, valid=$isValid)"
    }
    
    companion object {
        /**
         * 创建开发环境配置
         */
        fun development(
            appId: String,
            apiKey: String,
            baseURL: String = "http://localhost:5002/api/v1"
        ): DooPushConfig {
            return DooPushConfig(
                appId = appId,
                apiKey = apiKey,
                baseURL = baseURL,
                environment = DooPushEnvironment.DEVELOPMENT,
                debugEnabled = true
            )
        }
        
        /**
         * 创建生产环境配置
         */
        fun production(
            appId: String,
            apiKey: String,
            baseURL: String = "https://doopush.com/api/v1"
        ): DooPushConfig {
            return DooPushConfig(
                appId = appId,
                apiKey = apiKey,
                baseURL = baseURL,
                environment = DooPushEnvironment.PRODUCTION,
                debugEnabled = false
            )
        }
    }
}

/**
 * DooPush 环境类型
 */
enum class DooPushEnvironment {
    @SerializedName("production")
    PRODUCTION,
    
    @SerializedName("development")
    DEVELOPMENT,
    
    @SerializedName("staging")
    STAGING,
    
    @SerializedName("custom")
    CUSTOM
}
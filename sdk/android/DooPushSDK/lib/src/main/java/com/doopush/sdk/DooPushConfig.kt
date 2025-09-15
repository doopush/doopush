package com.doopush.sdk

import com.doopush.sdk.models.DooPushError
import java.util.regex.Pattern

/**
 * DooPush SDK 配置类
 * 
 * 管理SDK的配置参数，包括应用ID、API密钥和服务器地址
 */
data class DooPushConfig(
    
    /**
     * 应用ID
     * DooPush平台分配的唯一应用标识符
     */
    val appId: String,
    
    /**
     * API密钥
     * 用于API请求认证的密钥
     */
    val apiKey: String,
    
    /**
     * 服务器基础URL
     * DooPush API服务器地址，默认为生产环境
     */
    val baseURL: String = DEFAULT_BASE_URL,
    
    /**
     * HMS推送配置 (可选)
     */
    val hmsConfig: HMSConfig? = null,
    
    /**
     * 小米推送配置 (可选)
     */
    val xiaomiConfig: XiaomiConfig? = null,
    
    /**
     * OPPO推送配置 (可选)
     */
    val oppoConfig: OppoConfig? = null
    
) {
    
    /**
     * HMS推送配置类
     * @param appId HMS应用ID，如果为空则会从 agconnect-services.json 自动读取
     */
    data class HMSConfig(
        val appId: String = ""  // 可以为空，支持从 agconnect-services.json 读取
    ) {
        fun isValid(): Boolean {
            // 客户端SDK总是有效的，因为可以从 agconnect-services.json 读取配置
            return true
        }
        
        fun getSummary(): String {
            val appIdInfo = if (appId.isNotEmpty()) {
                "AppID=$appId"
            } else {
                "AppID=auto(从agconnect-services.json读取)"
            }
            return "HMS配置: $appIdInfo"
        }
    }
    
    /**
     * 小米推送配置类
     * @param appId 小米应用ID
     * @param appKey 小米应用Key
     */
    data class XiaomiConfig(
        val appId: String = "",
        val appKey: String = ""
    ) {
        fun isValid(): Boolean {
            return true
        }
        
        fun getSummary(): String {
            val appIdInfo = if (appId.isNotEmpty()) {
                "AppID=$appId"
            } else {
                "AppID=auto(从xiaomi-services.json读取)"
            }
            val appKeyInfo = if (appKey.isNotEmpty()) {
                "AppKey=${appKey.take(8)}..."
            } else {
                "AppKey=auto(从xiaomi-services.json读取)"
            }
            return "小米推送配置: $appIdInfo, $appKeyInfo"
        }
    }
    
    /**
     * OPPO推送配置类（客户端仅需 appKey，可从 oppo-services.json 自动读取）
     * @param appKey OPPO应用Key，如果为空则会从 oppo-services.json 自动读取
     */
    data class OppoConfig(
        val appKey: String = ""
    ) {
        fun isValid(): Boolean {
            return true
        }
        
        fun getSummary(): String {
            val appKeyInfo = if (appKey.isNotEmpty()) {
                "AppKey=${appKey.take(8)}..."
            } else {
                "AppKey=auto(从oppo-services.json读取)"
            }
            return "OPPO推送配置: $appKeyInfo"
        }
    }
    
    companion object {
        
        /**
         * 默认生产环境服务器地址
         */
        const val DEFAULT_BASE_URL = "https://doopush.com/api/v1"
        
        
        /**
         * API密钥的正则表达式模式
         * 格式: 数字、字母和特殊字符组成，长度为16-64位
         */
        private val API_KEY_PATTERN = Pattern.compile("^[a-zA-Z0-9_\\-\\.]{16,64}$")
        
        /**
         * URL的正则表达式模式
         * 基本的HTTP/HTTPS URL格式检查
         */
        private val URL_PATTERN = Pattern.compile(
            "^https?://[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?" +
            "(\\.[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?)*(:[0-9]{1,5})?(/.*)?$"
        )
        
        /**
         * 创建配置实例并验证参数
         * 
         * @param appId 应用ID
         * @param apiKey API密钥
         * @param baseURL 服务器基础URL (可选)
         * @param hmsConfig HMS推送配置 (可选)
         * @param xiaomiConfig 小米推送配置 (可选)
         * @param oppoConfig OPPO推送配置 (可选)
         * @return 配置实例
         * @throws DooPushConfigException 配置参数无效时抛出
         */
        @Throws(DooPushConfigException::class)
        fun create(
            appId: String,
            apiKey: String,
            baseURL: String = DEFAULT_BASE_URL,
            hmsConfig: HMSConfig? = null,
            xiaomiConfig: XiaomiConfig? = null,
            oppoConfig: OppoConfig? = null
        ): DooPushConfig {
            val config = DooPushConfig(
                appId = appId.trim(),
                apiKey = apiKey.trim(),
                baseURL = baseURL.trim().trimEnd('/'),
                hmsConfig = hmsConfig,
                xiaomiConfig = xiaomiConfig,
                oppoConfig = oppoConfig
            )
            
            config.validate()
            return config
        }
    }
    
    /**
     * 环境类型枚举
     */
    enum class Environment {
        PRODUCTION,    // 生产环境
        DEVELOPMENT,   // 开发环境
        CUSTOM         // 自定义环境
    }
    
    /**
     * 获取环境类型
     */
    val environment: Environment
        get() = when {
            baseURL.contains("localhost") || baseURL.contains("127.0.0.1") -> Environment.DEVELOPMENT
            baseURL == DEFAULT_BASE_URL -> Environment.PRODUCTION
            else -> Environment.CUSTOM
        }
    
    /**
     * 验证配置参数的有效性
     * 
     * @throws DooPushConfigException 参数无效时抛出异常
     */
    @Throws(DooPushConfigException::class)
    fun validate() {
        // 验证应用ID
        if (appId.isEmpty()) {
            throw DooPushConfigException(
                DooPushError(
                    code = DooPushError.CONFIG_INVALID_APP_ID,
                    message = "应用ID不能为空"
                )
            )
        }
        
        
        // 验证API密钥
        if (apiKey.isEmpty()) {
            throw DooPushConfigException(
                DooPushError(
                    code = DooPushError.CONFIG_INVALID_API_KEY,
                    message = "API密钥不能为空"
                )
            )
        }
        
        if (!API_KEY_PATTERN.matcher(apiKey).matches()) {
            throw DooPushConfigException(
                DooPushError(
                    code = DooPushError.CONFIG_INVALID_API_KEY,
                    message = "API密钥格式无效，应为16-64位字符组成",
                    details = "支持字母、数字、下划线、连字符和点号"
                )
            )
        }
        
        // 验证服务器地址
        if (baseURL.isEmpty()) {
            throw DooPushConfigException(
                DooPushError(
                    code = DooPushError.CONFIG_INVALID_BASE_URL,
                    message = "服务器地址不能为空"
                )
            )
        }
        
        if (!URL_PATTERN.matcher(baseURL).matches()) {
            throw DooPushConfigException(
                DooPushError(
                    code = DooPushError.CONFIG_INVALID_BASE_URL,
                    message = "服务器地址格式无效，应为有效的HTTP/HTTPS URL",
                    details = "当前地址: $baseURL"
                )
            )
        }
    }
    
    /**
     * 获取API请求的完整URL
     * 
     * @param endpoint API端点路径
     * @return 完整的API URL
     */
    fun getApiUrl(endpoint: String): String {
        val cleanEndpoint = endpoint.trimStart('/')
        return "$baseURL/$cleanEndpoint"
    }
    
    /**
     * 获取设备注册API的URL
     */
    fun getDeviceRegisterUrl(): String {
        return getApiUrl("apps/$appId/devices")
    }
    
    /**
     * 获取设备token更新API的URL
     * 
     * @param deviceId 设备ID
     */
    fun getDeviceTokenUpdateUrl(deviceId: String): String {
        return getApiUrl("apps/$appId/devices/$deviceId/token")
    }
    
    /**
     * 是否为开发环境
     */
    fun isDevelopment(): Boolean {
        return environment == Environment.DEVELOPMENT
    }
    
    /**
     * 是否为生产环境
     */
    fun isProduction(): Boolean {
        return environment == Environment.PRODUCTION
    }
    
    /**
     * 获取配置的摘要信息（用于调试）
     * API密钥会被部分隐藏
     */
    fun getSummary(): String {
        val maskedApiKey = if (apiKey.length > 8) {
            "${apiKey.substring(0, 4)}****${apiKey.substring(apiKey.length - 4)}"
        } else {
            "****"
        }
        
        val hmsInfo = hmsConfig?.getSummary() ?: "HMS配置: 未配置"
        val xiaomiInfo = xiaomiConfig?.getSummary() ?: "小米推送配置: 未配置"
        val oppoInfo = oppoConfig?.getSummary() ?: "OPPO推送配置: 未配置"
        
        return """
            |DooPush配置:
            |  应用ID: $appId
            |  API密钥: $maskedApiKey
            |  服务器: $baseURL
            |  环境: ${environment.name}
            |  $hmsInfo
            |  $xiaomiInfo
            |  $oppoInfo
        """.trimMargin()
    }
    
    /**
     * 检查是否配置了HMS推送
     */
    fun hasHMSConfig(): Boolean {
        return hmsConfig != null && hmsConfig.isValid()
    }
    
    /**
     * 检查是否配置了小米推送
     */
    fun hasXiaomiConfig(): Boolean {
        return xiaomiConfig != null && xiaomiConfig.isValid()
    }
    
    /**
     * 检查是否配置了OPPO推送
     */
    fun hasOppoConfig(): Boolean {
        return oppoConfig != null && oppoConfig.isValid()
    }
    
    override fun toString(): String {
        return getSummary()
    }
}

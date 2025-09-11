package com.doopush.DooPushSDKExample.utils

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import java.io.IOException
import java.util.*

/**
 * 配置管理器
 * 
 * 负责加载和管理应用配置
 */
class ConfigManager private constructor(private val context: Context) {
    
    companion object {
        private const val TAG = "ConfigManager"
        private const val PREFS_NAME = "doopush_example_config"
        private const val CONFIG_FILE = "doopush_config.properties"
        
        // 默认配置
        private const val DEFAULT_APP_ID = "your_app_id_here"
        private const val DEFAULT_API_KEY = "your_api_key_here"
        private const val DEFAULT_BASE_URL = "https://doopush.com"
        
        @Volatile
        private var instance: ConfigManager? = null
        
        fun getInstance(context: Context): ConfigManager {
            return instance ?: synchronized(this) {
                instance ?: ConfigManager(context.applicationContext).also { instance = it }
            }
        }
    }
    
    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    private var configProperties: Properties? = null
    
    init {
        loadConfigFromAssets()
    }
    
    /**
     * 配置项数据类
     */
    data class DooPushConfig(
        val appId: String,
        val apiKey: String,
        val baseUrl: String,
        val debugEnabled: Boolean = true
    )
    
    /**
     * 获取DooPush配置
     */
    fun getDooPushConfig(): DooPushConfig {
        val appId = prefs.getString("app_id", getAssetConfig("app_id", DEFAULT_APP_ID)) ?: DEFAULT_APP_ID
        val apiKey = prefs.getString("api_key", getAssetConfig("api_key", DEFAULT_API_KEY)) ?: DEFAULT_API_KEY
        val baseUrl = prefs.getString("base_url", getAssetConfig("base_url", DEFAULT_BASE_URL)) ?: DEFAULT_BASE_URL
        val debugEnabled = prefs.getBoolean("debug_enabled", getAssetConfigBoolean("debug_enabled", true))
        
        return DooPushConfig(
            appId = appId,
            apiKey = apiKey,
            baseUrl = baseUrl,
            debugEnabled = debugEnabled
        )
    }
    
    /**
     * 保存DooPush配置
     */
    fun saveDooPushConfig(config: DooPushConfig) {
        prefs.edit()
            .putString("app_id", config.appId)
            .putString("api_key", config.apiKey)
            .putString("base_url", config.baseUrl)
            .putBoolean("debug_enabled", config.debugEnabled)
            .apply()
        
        Log.d(TAG, "DooPush配置已保存")
    }
    
    /**
     * 获取字符串配置
     */
    fun getString(key: String, defaultValue: String = ""): String {
        return prefs.getString(key, getAssetConfig(key, defaultValue)) ?: defaultValue
    }
    
    /**
     * 获取布尔配置
     */
    fun getBoolean(key: String, defaultValue: Boolean = false): Boolean {
        return prefs.getBoolean(key, getAssetConfigBoolean(key, defaultValue))
    }
    
    /**
     * 获取整型配置
     */
    fun getInt(key: String, defaultValue: Int = 0): Int {
        return prefs.getInt(key, getAssetConfigInt(key, defaultValue))
    }
    
    /**
     * 保存字符串配置
     */
    fun putString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }
    
    /**
     * 保存布尔配置
     */
    fun putBoolean(key: String, value: Boolean) {
        prefs.edit().putBoolean(key, value).apply()
    }
    
    /**
     * 保存整型配置
     */
    fun putInt(key: String, value: Int) {
        prefs.edit().putInt(key, value).apply()
    }
    
    /**
     * 重置所有配置
     */
    fun resetConfig() {
        prefs.edit().clear().apply()
        Log.d(TAG, "配置已重置")
    }
    
    /**
     * 验证配置是否有效
     */
    fun validateConfig(config: DooPushConfig): ValidationResult {
        val errors = mutableListOf<String>()
        
        if (config.appId.isBlank() || config.appId == DEFAULT_APP_ID) {
            errors.add("应用ID无效")
        }
        
        if (config.apiKey.isBlank() || config.apiKey == DEFAULT_API_KEY) {
            errors.add("API密钥无效")
        }
        
        if (config.baseUrl.isBlank()) {
            errors.add("服务器地址不能为空")
        } else if (!isValidUrl(config.baseUrl)) {
            errors.add("服务器地址格式无效")
        }
        
        return ValidationResult(errors.isEmpty(), errors)
    }
    
    /**
     * 验证结果
     */
    data class ValidationResult(
        val isValid: Boolean,
        val errors: List<String>
    )
    
    /**
     * 获取所有配置信息（用于调试）
     */
    fun getAllConfigs(): Map<String, Any> {
        val configs = mutableMapOf<String, Any>()
        
        // 从SharedPreferences获取
        prefs.all.forEach { (key, value) ->
            configs[key] = value ?: "null"
        }
        
        // 从assets配置文件获取
        configProperties?.forEach { key, value ->
            val keyStr = key.toString()
            if (!configs.containsKey(keyStr)) {
                configs[keyStr] = value.toString()
            }
        }
        
        return configs
    }
    
    /**
     * 从assets加载配置文件
     */
    private fun loadConfigFromAssets() {
        try {
            val inputStream = context.assets.open(CONFIG_FILE)
            configProperties = Properties().apply {
                load(inputStream)
            }
            inputStream.close()
            
            Log.d(TAG, "配置文件加载成功，共${configProperties?.size ?: 0}项配置")
            
        } catch (e: IOException) {
            Log.w(TAG, "配置文件加载失败，将使用默认配置", e)
            configProperties = Properties()
        }
    }
    
    /**
     * 从assets配置获取字符串值
     */
    private fun getAssetConfig(key: String, defaultValue: String): String {
        return configProperties?.getProperty(key, defaultValue) ?: defaultValue
    }
    
    /**
     * 从assets配置获取布尔值
     */
    private fun getAssetConfigBoolean(key: String, defaultValue: Boolean): Boolean {
        val value = configProperties?.getProperty(key)
        return when (value?.lowercase()) {
            "true", "1", "yes", "on" -> true
            "false", "0", "no", "off" -> false
            else -> defaultValue
        }
    }
    
    /**
     * 从assets配置获取整型值
     */
    private fun getAssetConfigInt(key: String, defaultValue: Int): Int {
        val value = configProperties?.getProperty(key)
        return try {
            value?.toInt() ?: defaultValue
        } catch (e: NumberFormatException) {
            defaultValue
        }
    }
    
    /**
     * 验证URL格式
     */
    private fun isValidUrl(url: String): Boolean {
        return try {
            val uri = android.net.Uri.parse(url)
            uri.scheme?.let { scheme ->
                scheme == "http" || scheme == "https"
            } ?: false
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * 获取环境信息
     */
    fun getEnvironmentInfo(): String {
        val config = getDooPushConfig()
        return when {
            config.baseUrl.contains("localhost") || config.baseUrl.contains("127.0.0.1") -> "开发环境"
            config.baseUrl.contains("test") -> "测试环境"
            config.baseUrl.contains("doopush.com") -> "生产环境"
            else -> "自定义环境"
        }
    }
}

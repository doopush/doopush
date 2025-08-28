package com.doopush.DooPushSDKExample

/**
 * 应用配置类
 * 统一管理应用配置参数
 */
object AppConfig {

    // DooPush SDK 配置
    const val appId = "1"
    const val apiKey = "dp_live_i9Z6GoGvDOa9cGlaYRJsmLrB1BOjisCH"
    const val baseURL = "https://doopush.com/api/v1"

    // 获取不带API版本的服务器地址（用于UI显示）
    val displayBaseURL: String
        get() = baseURL.replace("/api/v1", "")

    /**
     * 输出配置信息到日志
     */
    fun printConfiguration() {
        android.util.Log.i("AppConfig", "🔧 配置参数:")
        android.util.Log.i("AppConfig", "   App ID: $appId")
        android.util.Log.i("AppConfig", "   API Key: ${apiKey.take(10)}...") // 只显示前10位
        android.util.Log.i("AppConfig", "   Base URL: $displayBaseURL")
    }
}

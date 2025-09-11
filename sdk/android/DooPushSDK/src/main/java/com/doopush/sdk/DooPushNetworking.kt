package com.doopush.sdk

import android.util.Log
import com.doopush.sdk.models.DeviceInfo
import com.doopush.sdk.models.DooPushError
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * DooPush 网络通信类
 * 
 * 负责与DooPush API服务器的网络通信，包括设备注册、token更新等操作
 */
class DooPushNetworking(private val config: DooPushConfig) {
    
    companion object {
        private const val TAG = "DooPushNetworking"
        
        // HTTP 超时配置
        private const val CONNECT_TIMEOUT = 15L // 连接超时 15秒
        private const val READ_TIMEOUT = 30L    // 读取超时 30秒
        private const val WRITE_TIMEOUT = 30L   // 写入超时 30秒
        
        // Content-Type 常量
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
    
    /**
     * HTTP客户端实例
     */
    private val httpClient: OkHttpClient by lazy {
        val builder = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT, TimeUnit.SECONDS)
            .writeTimeout(WRITE_TIMEOUT, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
        
        // 如果是开发环境，添加日志拦截器
        if (config.isDevelopment()) {
            val loggingInterceptor = HttpLoggingInterceptor { message ->
                Log.d(TAG, message)
            }.apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(loggingInterceptor)
        }
        
        // 添加API Key拦截器
        builder.addInterceptor { chain ->
            val originalRequest = chain.request()
            val authenticatedRequest = originalRequest.newBuilder()
                .header("X-API-Key", config.apiKey)
                .header("Content-Type", "application/json")
                .header("User-Agent", "DooPush-Android-SDK/1.0.0")
                .build()
            chain.proceed(authenticatedRequest)
        }
        
        builder.build()
    }
    
    private val gson = Gson()
    
    // 设备Token提供者
    private var deviceTokenProvider: (() -> String?)? = null
    
    /**
     * 设置设备Token提供者
     */
    fun setDeviceTokenProvider(provider: () -> String?) {
        this.deviceTokenProvider = provider
    }
    
    /**
     * 设备注册请求数据类
     */
    data class RegisterDeviceRequest(
        @SerializedName("token")
        val token: String,
        
        @SerializedName("bundle_id")
        val bundleId: String,
        
        @SerializedName("platform")
        val platform: String,
        
        @SerializedName("channel")
        val channel: String,
        
        @SerializedName("brand")
        val brand: String,
        
        @SerializedName("model")
        val model: String,
        
        @SerializedName("system_version")
        val systemVersion: String,
        
        @SerializedName("app_version")
        val appVersion: String,
        
        @SerializedName("user_agent")
        val userAgent: String,
        
        @SerializedName("tags")
        val tags: List<DeviceTag> = emptyList()
    )
    
    /**
     * 设备标签数据类
     */
    data class DeviceTag(
        @SerializedName("tag_name")
        val tagName: String,
        
        @SerializedName("tag_value") 
        val tagValue: String
    )
    
    /**
     * Gateway配置数据类
     */
    data class GatewayConfig(
        @SerializedName("host")
        val host: String,
        
        @SerializedName("port")
        val port: Int,
        
        @SerializedName("ssl")
        val ssl: Boolean
    ) {
        /**
         * 转换为TCP连接配置
         */
        fun toTCPGatewayConfig(): DooPushGatewayConfig {
            return DooPushGatewayConfig(host, port, ssl)
        }
    }
    
    /**
     * 设备注册响应数据类
     */
    data class DeviceRegistrationResponse(
        @SerializedName("device")
        val device: Map<String, Any>,
        
        @SerializedName("gateway")
        val gateway: GatewayConfig
    )
    
    /**
     * API响应基类
     */
    data class APIResponse<T>(
        @SerializedName("code")
        val code: Int,
        
        @SerializedName("message")
        val message: String,
        
        @SerializedName("data")
        val data: T?
    )
    
    /**
     * Token更新请求数据类
     */
    data class UpdateTokenRequest(
        @SerializedName("token")
        val token: String
    )
    
    /**
     * 设备注册回调接口
     */
    interface RegisterDeviceCallback {
        fun onSuccess(response: DeviceRegistrationResponse)
        fun onError(error: DooPushError)
    }
    
    /**
     * Token更新回调接口
     */
    interface UpdateTokenCallback {
        fun onSuccess()
        fun onError(error: DooPushError)
    }
    
    /**
     * 注册设备到DooPush服务器
     * 
     * @param deviceInfo 设备信息
     * @param token FCM推送token
     * @param callback 回调接口
     */
    fun registerDevice(
        deviceInfo: DeviceInfo,
        token: String,
        callback: RegisterDeviceCallback
    ) {
        try {
            // 构建请求数据
            val request = RegisterDeviceRequest(
                token = token,
                bundleId = deviceInfo.bundleId,
                platform = deviceInfo.platform,
                channel = deviceInfo.channel,
                brand = deviceInfo.brand,
                model = deviceInfo.model,
                systemVersion = deviceInfo.systemVersion,
                appVersion = deviceInfo.appVersion,
                userAgent = deviceInfo.userAgent
            )
            
            // 构建HTTP请求
            val requestBody = gson.toJson(request).toRequestBody(JSON_MEDIA_TYPE)
            val httpRequest = Request.Builder()
                .url(config.getDeviceRegisterUrl())
                .post(requestBody)
                .build()
            
            // 异步执行网络请求
            httpClient.newCall(httpRequest).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e(TAG, "设备注册网络请求失败", e)
                    val error = when {
                        e.message?.contains("timeout") == true -> 
                            DooPushError.networkTimeout("设备注册超时: ${e.message}")
                        else -> 
                            DooPushError.networkUnavailable("设备注册网络失败: ${e.message}")
                    }
                    callback.onError(error)
                }
                
                override fun onResponse(call: Call, response: Response) {
                    try {
                        val responseBody = response.body?.string()
                        
                        if (response.isSuccessful && !responseBody.isNullOrEmpty()) {
                            // 解析成功响应
                            val type = object : com.google.gson.reflect.TypeToken<APIResponse<DeviceRegistrationResponse>>() {}.type
                            val apiResponse: APIResponse<DeviceRegistrationResponse>? = gson.fromJson(responseBody, type)
                            
                            if (apiResponse != null && apiResponse.data != null) {
                                Log.d(TAG, "设备注册成功: ${apiResponse.message}")
                                callback.onSuccess(apiResponse.data)
                            } else {
                                Log.e(TAG, "设备注册响应数据为空")
                                callback.onError(DooPushError(
                                    code = DooPushError.ERROR_API_INVALID_RESPONSE,
                                    message = "服务器响应数据无效",
                                    details = responseBody
                                ))
                            }
                        } else {
                            // 处理错误响应
                            handleErrorResponse(response, responseBody, callback)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "设备注册响应解析失败", e)
                        callback.onError(DooPushError(
                            code = DooPushError.ERROR_API_INVALID_RESPONSE,
                            message = "响应数据解析失败",
                            details = e.message,
                            cause = e
                        ))
                    } finally {
                        response.close()
                    }
                }
            })
            
        } catch (e: Exception) {
            Log.e(TAG, "设备注册请求构建失败", e)
            callback.onError(DooPushError.fromException(e))
        }
    }
    
    /**
     * 更新设备Token
     * 
     * @param deviceId 设备ID
     * @param newToken 新的FCM token
     * @param callback 回调接口
     */
    fun updateDeviceToken(
        deviceId: String,
        newToken: String,
        callback: UpdateTokenCallback
    ) {
        try {
            // 构建请求数据
            val request = UpdateTokenRequest(token = newToken)
            
            // 构建HTTP请求
            val requestBody = gson.toJson(request).toRequestBody(JSON_MEDIA_TYPE)
            val httpRequest = Request.Builder()
                .url(config.getDeviceTokenUpdateUrl(deviceId))
                .put(requestBody)
                .build()
            
            // 异步执行网络请求
            httpClient.newCall(httpRequest).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e(TAG, "Token更新网络请求失败", e)
                    val error = when {
                        e.message?.contains("timeout") == true ->
                            DooPushError.networkTimeout("Token更新超时: ${e.message}")
                        else ->
                            DooPushError.networkUnavailable("Token更新网络失败: ${e.message}")
                    }
                    callback.onError(error)
                }
                
                override fun onResponse(call: Call, response: Response) {
                    try {
                        val responseBody = response.body?.string()
                        
                        if (response.isSuccessful) {
                            Log.d(TAG, "Token更新成功")
                            callback.onSuccess()
                        } else {
                            // 处理错误响应
                            handleTokenUpdateErrorResponse(response, responseBody, callback)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Token更新响应解析失败", e)
                        callback.onError(DooPushError(
                            code = DooPushError.ERROR_API_INVALID_RESPONSE,
                            message = "响应数据解析失败",
                            details = e.message,
                            cause = e
                        ))
                    } finally {
                        response.close()
                    }
                }
            })
            
        } catch (e: Exception) {
            Log.e(TAG, "Token更新请求构建失败", e)
            callback.onError(DooPushError.fromException(e))
        }
    }
    
    /**
     * 处理设备注册的错误响应
     */
    private fun handleErrorResponse(
        response: Response,
        responseBody: String?,
        callback: RegisterDeviceCallback
    ) {
        val errorCode = when (response.code) {
            400 -> DooPushError.ERROR_API_DEVICE_REGISTRATION_FAILED
            401 -> DooPushError.CONFIG_INVALID_API_KEY
            422 -> DooPushError.ERROR_API_DEVICE_REGISTRATION_FAILED
            else -> DooPushError.ERROR_NETWORK_REQUEST_FAILED
        }
        
        val errorMessage = try {
            if (!responseBody.isNullOrEmpty()) {
                val type = object : com.google.gson.reflect.TypeToken<APIResponse<Any>>() {}.type
                val errorResponse: APIResponse<Any>? = gson.fromJson(responseBody, type)
                errorResponse?.message ?: "设备注册失败"
            } else {
                "设备注册失败 (HTTP ${response.code})"
            }
        } catch (e: Exception) {
            "设备注册失败 (HTTP ${response.code})"
        }
        
        Log.e(TAG, "设备注册失败: $errorMessage (HTTP ${response.code})")
        callback.onError(DooPushError(
            code = errorCode,
            message = errorMessage,
            details = "HTTP ${response.code}: $responseBody"
        ))
    }
    
    /**
     * 处理Token更新的错误响应
     */
    private fun handleTokenUpdateErrorResponse(
        response: Response,
        responseBody: String?,
        callback: UpdateTokenCallback
    ) {
        val errorCode = when (response.code) {
            400 -> DooPushError.ERROR_API_TOKEN_UPDATE_FAILED
            401 -> DooPushError.CONFIG_INVALID_API_KEY
            404 -> DooPushError.ERROR_API_TOKEN_UPDATE_FAILED
            else -> DooPushError.ERROR_NETWORK_REQUEST_FAILED
        }
        
        val errorMessage = try {
            if (!responseBody.isNullOrEmpty()) {
                val type = object : com.google.gson.reflect.TypeToken<APIResponse<Any>>() {}.type
                val errorResponse: APIResponse<Any>? = gson.fromJson(responseBody, type)
                errorResponse?.message ?: "Token更新失败"
            } else {
                "Token更新失败 (HTTP ${response.code})"
            }
        } catch (e: Exception) {
            "Token更新失败 (HTTP ${response.code})"
        }
        
        Log.e(TAG, "Token更新失败: $errorMessage (HTTP ${response.code})")
        callback.onError(DooPushError(
            code = errorCode,
            message = errorMessage,
            details = "HTTP ${response.code}: $responseBody"
        ))
    }
    
    /**
     * 测试网络连接
     * 
     * @param callback 回调接口
     */
    fun testConnection(callback: (Boolean) -> Unit) {
        try {
            val request = Request.Builder()
                .url("${config.baseURL}/health")
                .get()
                .build()
            
            httpClient.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.w(TAG, "网络连接测试失败", e)
                    callback(false)
                }
                
                override fun onResponse(call: Call, response: Response) {
                    response.close()
                    val isConnected = response.isSuccessful
                    Log.d(TAG, "网络连接测试结果: $isConnected")
                    callback(isConnected)
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "网络连接测试异常", e)
            callback(false)
        }
    }
    
    /**
     * 获取网络状态描述
     */
    fun getNetworkStatus(): String {
        return "DooPush API: ${config.baseURL}"
    }
    
    /**
     * 统计事件上报请求数据类
     */
    data class StatisticsReportRequest(
        @SerializedName("device_token")
        val deviceToken: String,
        
        @SerializedName("statistics")
        val statistics: List<StatisticsEventReport>
    )
    
    /**
     * 统计事件上报数据类
     */
    data class StatisticsEventReport(
        @SerializedName("push_log_id")
        val pushLogId: String?,
        
        @SerializedName("dedup_key")
        val dedupKey: String?,
        
        @SerializedName("event")
        val event: String,
        
        @SerializedName("timestamp")
        val timestamp: Long
    )
    
    /**
     * 统计上报回调接口
     */
    interface StatisticsReportCallback {
        fun onSuccess()
        fun onError(error: DooPushError)
    }
    
    /**
     * 上报推送统计数据
     * 
     * @param events 统计事件列表
     * @param callback 回调接口
     */
    fun reportStatistics(
        events: List<DooPushStatistics.StatisticsEvent>,
        callback: StatisticsReportCallback
    ) {
        try {
            // 构建请求数据
            val deviceToken = deviceTokenProvider?.invoke()
            if (deviceToken == null) {
                Log.w(TAG, "设备Token缺失，无法上报统计数据")
                callback.onError(DooPushError.configNotInitialized())
                return
            }
            
            val request = StatisticsReportRequest(
                deviceToken = deviceToken,
                statistics = events.map { event ->
                    StatisticsEventReport(
                        pushLogId = event.pushLogId,
                        dedupKey = event.dedupKey,
                        event = event.eventType.value,
                        timestamp = event.timestamp
                    )
                }
            )
            
            // 构建HTTP请求
            val requestBody = gson.toJson(request).toRequestBody(JSON_MEDIA_TYPE)
            val httpRequest = Request.Builder()
                .url(getStatisticsReportUrl())
                .post(requestBody)
                .build()
            
            // 异步执行网络请求
            httpClient.newCall(httpRequest).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e(TAG, "统计数据上报网络请求失败", e)
                    val error = when {
                        e.message?.contains("timeout") == true -> 
                            DooPushError.networkTimeout("统计上报超时: ${e.message}")
                        else -> 
                            DooPushError.networkUnavailable("统计上报网络失败: ${e.message}")
                    }
                    callback.onError(error)
                }
                
                override fun onResponse(call: Call, response: Response) {
                    try {
                        val responseBody = response.body?.string()
                        
                        if (response.isSuccessful) {
                            Log.d(TAG, "统计数据上报成功")
                            callback.onSuccess()
                        } else {
                            // 处理错误响应
                            handleStatisticsReportErrorResponse(response, responseBody, callback)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "统计数据上报响应解析失败", e)
                        callback.onError(DooPushError(
                            code = DooPushError.ERROR_API_INVALID_RESPONSE,
                            message = "统计上报响应解析失败",
                            details = e.message,
                            cause = e
                        ))
                    } finally {
                        response.close()
                    }
                }
            })
            
        } catch (e: Exception) {
            Log.e(TAG, "统计数据上报请求构建失败", e)
            callback.onError(DooPushError.fromException(e))
        }
    }
    
    /**
     * 处理统计上报的错误响应
     */
    private fun handleStatisticsReportErrorResponse(
        response: Response,
        responseBody: String?,
        callback: StatisticsReportCallback
    ) {
        val errorCode = when (response.code) {
            400 -> DooPushError.API_BAD_REQUEST
            401 -> DooPushError.CONFIG_INVALID_API_KEY
            404 -> DooPushError.API_NOT_FOUND
            else -> DooPushError.ERROR_NETWORK_REQUEST_FAILED
        }
        
        val errorMessage = try {
            if (!responseBody.isNullOrEmpty()) {
                val type = object : com.google.gson.reflect.TypeToken<APIResponse<Any>>() {}.type
                val errorResponse: APIResponse<Any>? = gson.fromJson(responseBody, type)
                errorResponse?.message ?: "统计上报失败"
            } else {
                "统计上报失败 (HTTP ${response.code})"
            }
        } catch (e: Exception) {
            "统计上报失败 (HTTP ${response.code})"
        }
        
        Log.w(TAG, "统计数据上报失败: $errorMessage (HTTP ${response.code})")
        callback.onError(DooPushError(
            code = errorCode,
            message = errorMessage,
            details = "HTTP ${response.code}: $responseBody"
        ))
    }
    
    /**
     * 获取统计上报URL
     */
    private fun getStatisticsReportUrl(): String {
        return "${config.baseURL}/apps/${config.appId}/push/statistics/report"
    }
    

    /**
     * 释放资源
     */
    fun release() {
        try {
            httpClient.dispatcher.executorService.shutdown()
            httpClient.connectionPool.evictAll()
        } catch (e: Exception) {
            Log.w(TAG, "释放网络资源时发生异常", e)
        }
    }
}

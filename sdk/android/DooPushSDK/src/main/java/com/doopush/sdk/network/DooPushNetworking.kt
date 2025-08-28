package com.doopush.sdk.network

import com.doopush.sdk.DooPushConfig
import com.doopush.sdk.DooPushError
import com.doopush.sdk.DooPushErrorHandler
import com.doopush.sdk.Result
import com.doopush.sdk.internal.DooPushLogger
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * DooPush 网络通信管理器
 */
class DooPushNetworking(private val config: DooPushConfig) {
    
    private val gson = Gson()
    private val mediaType = "application/json; charset=utf-8".toMediaType()
    
    // OkHttp客户端
    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor(createAuthInterceptor())
            .addInterceptor(createLoggingInterceptor())
            .build()
    }
    
    /**
     * 注册设备到服务器
     */
    fun registerDevice(
        appId: String,
        deviceToken: String,
        deviceInfo: DeviceInfo,
        callback: (Result<DeviceRegistrationResponse>) -> Unit
    ) {
        registerDeviceWithRetry(appId, deviceToken, deviceInfo, 3, callback)
    }
    
    /**
     * 带重试机制的设备注册
     */
    private fun registerDeviceWithRetry(
        appId: String,
        deviceToken: String,
        deviceInfo: DeviceInfo,
        retryCount: Int,
        callback: (Result<DeviceRegistrationResponse>) -> Unit
    ) {
        val request = DeviceRegistrationRequest(
            token = deviceToken,
            bundleId = deviceInfo.bundleId,
            platform = deviceInfo.platform,
            channel = deviceInfo.channel,
            brand = deviceInfo.brand,
            model = deviceInfo.model,
            systemVersion = deviceInfo.systemVersion,
            appVersion = deviceInfo.appVersion,
            userAgent = deviceInfo.userAgent,
            deviceId = deviceInfo.deviceId,
            language = deviceInfo.language,
            timezone = deviceInfo.timezone,
            screenResolution = deviceInfo.screenResolution,
            networkType = deviceInfo.networkType,
            carrier = deviceInfo.carrier
        )
        
        performRequest(
            url = config.deviceRegistrationURL(),
            method = "POST",
            body = request,
            responseType = DeviceRegistrationResponse::class.java
        ) { result ->
            when (result) {
                is Result.Success -> {
                    DooPushLogger.info("设备注册成功")
                    callback(result)
                }
                is Result.Error -> {
                    if (retryCount > 0 && DooPushErrorHandler.isRetryable(result.error)) {
                        val delay = DooPushErrorHandler.getRetryDelay(result.error)
                        DooPushLogger.warning("设备注册失败，${delay}ms后重试，剩余重试次数: ${retryCount - 1}")
                        
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            registerDeviceWithRetry(appId, deviceToken, deviceInfo, retryCount - 1, callback)
                        }, delay)
                    } else {
                        DooPushLogger.error("设备注册最终失败: ${result.error}")
                        callback(result)
                    }
                }
            }
        }
    }
    
    /**
     * 更新设备信息
     */
    fun updateDevice(
        appId: String,
        deviceToken: String,
        deviceInfo: DeviceInfo,
        callback: (Result<Unit>) -> Unit
    ) {
        val request = DeviceUpdateRequest(
            bundleId = deviceInfo.bundleId,
            platform = deviceInfo.platform,
            channel = deviceInfo.channel,
            brand = deviceInfo.brand,
            model = deviceInfo.model,
            systemVersion = deviceInfo.systemVersion,
            appVersion = deviceInfo.appVersion,
            userAgent = deviceInfo.userAgent,
            deviceId = deviceInfo.deviceId,
            language = deviceInfo.language,
            timezone = deviceInfo.timezone,
            screenResolution = deviceInfo.screenResolution,
            networkType = deviceInfo.networkType,
            carrier = deviceInfo.carrier
        )
        
        performVoidRequest(
            url = config.deviceUpdateURL(deviceToken),
            method = "PUT",
            body = request,
            callback = callback
        )
    }
    
    /**
     * 执行HTTP请求（返回数据）
     */
    private fun <T, R> performRequest(
        url: String,
        method: String,
        body: T? = null,
        responseType: Class<R>,
        callback: (Result<R>) -> Unit
    ) {
        try {
            val requestBuilder = Request.Builder().url(url)
            
            when (method.uppercase()) {
                "GET" -> requestBuilder.get()
                "POST" -> {
                    val requestBody = if (body != null) {
                        gson.toJson(body).toRequestBody(mediaType)
                    } else {
                        "".toRequestBody(mediaType)
                    }
                    requestBuilder.post(requestBody)
                }
                "PUT" -> {
                    val requestBody = if (body != null) {
                        gson.toJson(body).toRequestBody(mediaType)
                    } else {
                        "".toRequestBody(mediaType)
                    }
                    requestBuilder.put(requestBody)
                }
                "DELETE" -> requestBuilder.delete()
            }
            
            val request = requestBuilder.build()
            
            httpClient.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    DooPushLogger.error("网络请求失败: $e")
                    val error = DooPushError.from(e)
                    callback(Result.Error(error))
                }
                
                override fun onResponse(call: Call, response: Response) {
                    handleResponse(response, responseType, callback)
                }
            })
            
        } catch (e: Exception) {
            DooPushLogger.error("创建网络请求失败: $e")
            val error = DooPushError.from(e)
            callback(Result.Error(error))
        }
    }
    
    /**
     * 执行HTTP请求（无返回数据）
     */
    private fun <T> performVoidRequest(
        url: String,
        method: String,
        body: T? = null,
        callback: (Result<Unit>) -> Unit
    ) {
        performRequest(url, method, body, VoidResponse::class.java) { result ->
            when (result) {
                is Result.Success -> callback(Result.Success(Unit))
                is Result.Error -> callback(Result.Error(result.error))
            }
        }
    }
    
    /**
     * 处理HTTP响应
     */
    private fun <R> handleResponse(
        response: Response,
        responseType: Class<R>,
        callback: (Result<R>) -> Unit
    ) {
        try {
            val responseBody = response.body?.string()
            
            if (!response.isSuccessful) {
                DooPushLogger.error("HTTP请求失败: ${response.code} ${responseBody} ${response.message}")
                
                val error = when (response.code) {
                    400 -> {
                        val errorMsg = parseErrorMessage(responseBody)
                        DooPushError.BadRequest(errorMsg)
                    }
                    401 -> DooPushError.Unauthorized()
                    403 -> DooPushError.Forbidden()
                    404 -> DooPushError.NotFound()
                    422 -> {
                        val errorMsg = parseErrorMessage(responseBody)
                        DooPushError.ValidationError(errorMsg)
                    }
                    in 500..599 -> {
                        val errorMsg = parseErrorMessage(responseBody)
                        DooPushError.ServerError(errorMsg)
                    }
                    else -> DooPushError.HttpError(response.code, response.message)
                }
                
                callback(Result.Error(error))
                return
            }
            
            if (responseBody.isNullOrEmpty()) {
                if (responseType == VoidResponse::class.java) {
                    @Suppress("UNCHECKED_CAST")
                    callback(Result.Success(VoidResponse() as R))
                } else {
                    callback(Result.Error(DooPushError.NoData))
                }
                return
            }
            
            try {
                // 尝试解析为API响应格式
                val apiResponse = gson.fromJson(responseBody, APIResponse::class.java)

                // 检查是否为成功响应
                // 支持多种成功状态码：0 (业务成功), 200-299 (HTTP成功状态码)
                val isSuccess = apiResponse.code == 0 ||
                               (apiResponse.code >= 200 && apiResponse.code < 300) ||
                               apiResponse.message?.contains("成功") == true

                if (isSuccess) {
                    // 成功响应
                    if (apiResponse.data != null) {
                        val dataJson = gson.toJson(apiResponse.data)
                        val data = gson.fromJson(dataJson, responseType)
                        callback(Result.Success(data))
                    } else if (responseType == VoidResponse::class.java) {
                        @Suppress("UNCHECKED_CAST")
                        callback(Result.Success(VoidResponse() as R))
                    } else {
                        callback(Result.Error(DooPushError.NoData))
                    }
                } else {
                    // 业务错误
                    val errorMsg = apiResponse.message ?: "未知错误"
                    val error = DooPushError.ValidationError(errorMsg)
                    callback(Result.Error(error))
                }
            } catch (e: Exception) {
                // 如果不是API响应格式，直接解析为目标类型
                try {
                    val data = gson.fromJson(responseBody, responseType)
                    callback(Result.Success(data))
                } catch (parseError: Exception) {
                    DooPushLogger.error("解析响应数据失败: $parseError")
                    val error = DooPushError.DecodingError("响应数据解析失败", parseError)
                    callback(Result.Error(error))
                }
            }
            
        } catch (e: Exception) {
            DooPushLogger.error("处理HTTP响应失败: $e")
            val error = DooPushError.from(e)
            callback(Result.Error(error))
        } finally {
            response.close()
        }
    }
    
    /**
     * 解析错误消息
     */
    private fun parseErrorMessage(responseBody: String?): String {
        if (responseBody.isNullOrEmpty()) {
            return "未知错误"
        }
        
        return try {
            val errorResponse = gson.fromJson(responseBody, ErrorResponse::class.java)
            errorResponse.message ?: "未知错误"
        } catch (e: Exception) {
            responseBody
        }
    }
    
    /**
     * 创建认证拦截器
     */
    private fun createAuthInterceptor(): Interceptor {
        return Interceptor { chain ->
            val originalRequest = chain.request()
            val newRequest = originalRequest.newBuilder()
                .addHeader("X-API-Key", config.apiKey)
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "DooPushSDK/1.0.0 Android")
                .build()

            chain.proceed(newRequest)
        }
    }
    
    /**
     * 创建日志拦截器
     */
    private fun createLoggingInterceptor(): Interceptor {
        return Interceptor { chain ->
            val request = chain.request()
            val startTime = System.currentTimeMillis()

            // 记录请求详情
            DooPushLogger.info("HTTP请求: ${request.method} ${request.url}")
            DooPushLogger.debug("请求头: ${request.headers}")

            // 如果是POST请求，记录请求体
            if ((request.method == "POST" || request.method == "PUT") && request.body != null) {
                try {
                    val buffer = okio.Buffer()
                    request.body?.writeTo(buffer)
                    val requestBody = buffer.readUtf8()
                    if (requestBody.isNotEmpty()) {
                        DooPushLogger.debug("请求体: $requestBody")
                    }
                } catch (e: Exception) {
                    // 忽略读取请求体的错误
                }
            }

            val response = chain.proceed(request)
            val endTime = System.currentTimeMillis()
            val duration = endTime - startTime

            DooPushLogger.info("HTTP响应: ${response.code} ${response.message} (${duration}ms)")

            // 如果响应失败或需要调试，记录响应体
            if (!response.isSuccessful || DooPushLogger.isDebugEnabled()) {
                try {
                    val responseBody = response.peekBody(Long.MAX_VALUE).string()
                    if (!response.isSuccessful) {
                        DooPushLogger.error("响应体: $responseBody")
                    } else {
                        DooPushLogger.debug("响应体: $responseBody")
                    }
                } catch (e: Exception) {
                    // 忽略读取响应体的错误
                }
            }

            response
        }
    }
}

// 数据模型类
data class DeviceInfo(
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
    
    @SerializedName("device_id")
    val deviceId: String? = null,
    
    @SerializedName("language")
    val language: String? = null,
    
    @SerializedName("timezone")
    val timezone: String? = null,
    
    @SerializedName("screen_resolution")
    val screenResolution: String? = null,
    
    @SerializedName("network_type")
    val networkType: String? = null,
    
    @SerializedName("carrier")
    val carrier: String? = null
)

data class DeviceRegistrationRequest(
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
    
    @SerializedName("device_id")
    val deviceId: String? = null,
    
    @SerializedName("language")
    val language: String? = null,
    
    @SerializedName("timezone")
    val timezone: String? = null,
    
    @SerializedName("screen_resolution")
    val screenResolution: String? = null,
    
    @SerializedName("network_type")
    val networkType: String? = null,
    
    @SerializedName("carrier")
    val carrier: String? = null
)

data class DeviceUpdateRequest(
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
    
    @SerializedName("device_id")
    val deviceId: String? = null,
    
    @SerializedName("language")
    val language: String? = null,
    
    @SerializedName("timezone")
    val timezone: String? = null,
    
    @SerializedName("screen_resolution")
    val screenResolution: String? = null,
    
    @SerializedName("network_type")
    val networkType: String? = null,
    
    @SerializedName("carrier")
    val carrier: String? = null
)

data class DeviceResponseInfo(
    @SerializedName("id")
    val id: Int,
    
    @SerializedName("app_id")
    val appId: Int,
    
    @SerializedName("token")
    val token: String,
    
    @SerializedName("platform")
    val platform: String,
    
    @SerializedName("channel")
    val channel: String,
    
    @SerializedName("brand")
    val brand: String?,
    
    @SerializedName("model")
    val model: String?,
    
    @SerializedName("system_version")
    val systemVersion: String?,
    
    @SerializedName("app_version")
    val appVersion: String?,
    
    @SerializedName("user_agent")
    val userAgent: String?,
    
    @SerializedName("status")
    val status: Int,
    
    @SerializedName("last_seen")
    val lastSeen: String?,
    
    @SerializedName("created_at")
    val createdAt: String,
    
    @SerializedName("updated_at")
    val updatedAt: String
)

data class GatewayConfigResponse(
    @SerializedName("host")
    val host: String,
    
    @SerializedName("port")
    val port: Int,
    
    @SerializedName("ssl")
    val ssl: Boolean
)

data class DeviceRegistrationResponse(
    @SerializedName("device")
    val device: DeviceResponseInfo,
    
    @SerializedName("gateway")
    val gateway: GatewayConfigResponse
)

private data class APIResponse<T>(
    @SerializedName("code")
    val code: Int,
    
    @SerializedName("message")
    val message: String?,
    
    @SerializedName("data")
    val data: T?
)

private data class ErrorResponse(
    @SerializedName("code")
    val code: Int,
    
    @SerializedName("message")
    val message: String?
)

private class VoidResponse
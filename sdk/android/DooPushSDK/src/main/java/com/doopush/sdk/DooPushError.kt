package com.doopush.sdk

/**
 * DooPush SDK 错误类
 */
sealed class DooPushError(val code: Int, message: String, cause: Throwable? = null) : Exception(message, cause) {
    
    // MARK: - 配置相关错误 (1000-1099)
    object NotConfigured : DooPushError(1000, "SDK未配置，请先调用configure方法")
    object InvalidConfiguration : DooPushError(1001, "SDK配置无效")
    object InvalidURL : DooPushError(1002, "URL格式无效")
    
    // MARK: - 权限相关错误 (1100-1199)
    object PushPermissionDenied : DooPushError(1100, "用户拒绝了推送通知权限")
    object PushPermissionNotDetermined : DooPushError(1101, "推送通知权限未确定")
    object PushNotificationNotSupported : DooPushError(1102, "设备不支持推送通知")
    
    // MARK: - 网络相关错误 (1200-1299)
    class NetworkError(message: String = "网络连接失败", cause: Throwable? = null) : DooPushError(1200, message, cause)
    class InvalidResponse(message: String = "服务器响应格式无效") : DooPushError(1201, message)
    object NoData : DooPushError(1202, "服务器未返回数据")
    class BadRequest(message: String = "请求参数错误") : DooPushError(1400, message)
    class Unauthorized(message: String = "API密钥无效或已过期") : DooPushError(1401, message)
    class Forbidden(message: String = "访问被禁止，请检查应用权限") : DooPushError(1403, message)
    class NotFound(message: String = "请求的资源不存在") : DooPushError(1404, message)
    class ValidationError(message: String = "请求数据验证失败") : DooPushError(1422, message)
    class ServerError(message: String = "服务器内部错误") : DooPushError(1500, message)
    class HttpError(code: Int, message: String = "HTTP请求失败") : DooPushError(1999, "HTTP $code: $message")
    
    // MARK: - 数据处理相关错误 (1300-1399)
    class EncodingError(message: String = "数据编码失败", cause: Throwable? = null) : DooPushError(1300, message, cause)
    class DecodingError(message: String = "数据解码失败", cause: Throwable? = null) : DooPushError(1301, message, cause)
    class DataCorrupted(message: String = "数据已损坏") : DooPushError(1302, message)
    
    // MARK: - 设备相关错误 (1600-1699)
    class DeviceTokenInvalid(message: String = "设备Token无效") : DooPushError(1600, message)
    class DeviceRegistrationFailed(message: String = "设备注册失败", cause: Throwable? = null) : DooPushError(1601, message, cause)
    class DeviceUpdateFailed(message: String = "设备信息更新失败", cause: Throwable? = null) : DooPushError(1602, message, cause)
    
    // MARK: - 推送厂商相关错误 (1700-1799)
    class VendorError(vendor: String, message: String, cause: Throwable? = null) : DooPushError(1700, "$vendor 推送错误: $message", cause)
    class VendorNotSupported(vendor: String) : DooPushError(1701, "不支持的推送厂商: $vendor")
    class VendorInitializationFailed(vendor: String, cause: Throwable? = null) : DooPushError(1702, "$vendor 推送初始化失败", cause)
    
    // MARK: - TCP连接相关错误 (1800-1899)
    class TCPConnectionFailed(message: String = "TCP连接失败", cause: Throwable? = null) : DooPushError(1800, message, cause)
    class TCPRegistrationFailed(message: String = "TCP注册失败") : DooPushError(1801, message)
    class TCPMessageError(message: String = "TCP消息处理错误") : DooPushError(1802, message)
    
    // MARK: - 通用错误 (1900-1999)
    class Unknown(message: String = "未知错误", cause: Throwable? = null) : DooPushError(1900, message, cause)
    object OperationCancelled : DooPushError(1901, "操作已取消")
    class Timeout(message: String = "操作超时") : DooPushError(1902, message)
    
    // MARK: - 错误分类
    
    /**
     * 是否为网络错误
     */
    val isNetworkError: Boolean
        get() = code in 1200..1299 || code in 1400..1599
    
    /**
     * 是否为配置错误
     */
    val isConfigurationError: Boolean
        get() = code in 1000..1099
    
    /**
     * 是否为权限错误
     */
    val isPermissionError: Boolean
        get() = code in 1100..1199
    
    /**
     * 是否为数据处理错误
     */
    val isDataProcessingError: Boolean
        get() = code in 1300..1399
    
    /**
     * 是否为设备相关错误
     */
    val isDeviceError: Boolean
        get() = code in 1600..1699
    
    /**
     * 是否为推送厂商错误
     */
    val isVendorError: Boolean
        get() = code in 1700..1799
    
    /**
     * 是否为TCP连接错误
     */
    val isTCPError: Boolean
        get() = code in 1800..1899
    
    companion object {
        /**
         * 从异常创建DooPushError
         */
        fun from(throwable: Throwable): DooPushError {
            return when (throwable) {
                is DooPushError -> throwable
                is java.net.UnknownHostException -> NetworkError("网络连接失败", throwable)
                is java.net.SocketTimeoutException -> Timeout("网络请求超时")
                is java.net.ConnectException -> NetworkError("无法连接到服务器", throwable)
                is java.io.IOException -> NetworkError("网络IO错误", throwable)
                else -> Unknown(throwable.message ?: "未知错误", throwable)
            }
        }
    }
}

/**
 * 错误处理工具类
 */
object DooPushErrorHandler {
    
    /**
     * 获取用户友好的错误消息
     */
    fun getUserFriendlyMessage(error: DooPushError): String {
        return when (error) {
            is DooPushError.NotConfigured -> "SDK未正确配置，请联系开发者"
            is DooPushError.PushPermissionDenied -> "请在设置中开启推送通知权限"
            is DooPushError.NetworkError -> "网络连接失败，请检查网络设置"
            is DooPushError.Unauthorized -> "应用认证失败，请重新启动应用"
            is DooPushError.ServerError -> "服务暂时不可用，请稍后重试"
            else -> error.message ?: "操作失败，请重试"
        }
    }
    
    /**
     * 检查错误是否可以重试
     */
    fun isRetryable(error: DooPushError): Boolean {
        return when (error) {
            is DooPushError.NetworkError,
            is DooPushError.Timeout,
            is DooPushError.ServerError -> true
            is DooPushError.Unauthorized,
            is DooPushError.Forbidden,
            is DooPushError.NotFound,
            is DooPushError.BadRequest,
            is DooPushError.ValidationError,
            is DooPushError.NotConfigured,
            is DooPushError.PushPermissionDenied -> false
            else -> false
        }
    }
    
    /**
     * 获取建议的重试延时时间（毫秒）
     */
    fun getRetryDelay(error: DooPushError): Long {
        return when (error) {
            is DooPushError.NetworkError -> 2000L
            is DooPushError.Timeout -> 5000L
            is DooPushError.ServerError -> 10000L
            else -> 1000L
        }
    }
}
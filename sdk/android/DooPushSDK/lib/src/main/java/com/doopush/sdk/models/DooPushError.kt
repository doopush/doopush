package com.doopush.sdk.models

/**
 * DooPush SDK 错误信息类
 * 
 * 统一的错误处理和错误信息封装
 */
data class DooPushError(
    
    /**
     * 错误码
     */
    val code: Int,
    
    /**
     * 错误消息
     */
    override val message: String,
    
    /**
     * 详细错误信息 (可选)
     */
    val details: String? = null,
    
    /**
     * 原始异常 (可选)
     */
    override val cause: Throwable? = null
) : Throwable(message, cause) {
    
    companion object {
        // 网络相关错误码
        const val NETWORK_ERROR = 1000
        const val ERROR_NETWORK_UNAVAILABLE = 1001
        const val ERROR_NETWORK_TIMEOUT = 1002
        const val ERROR_NETWORK_REQUEST_FAILED = 1003
        
        // 配置相关错误码
        const val CONFIG_INVALID_APP_ID = 2001
        const val CONFIG_INVALID_API_KEY = 2002
        const val CONFIG_INVALID_BASE_URL = 2003
        const val CONFIG_NOT_INITIALIZED = 2004
        
        // FCM相关错误码
        const val FCM_TOKEN_FETCH_FAILED = 3001
        const val FCM_SERVICE_UNAVAILABLE = 3002
        const val FCM_REGISTRATION_FAILED = 3003
        
        // HMS相关错误码
        const val HMS_NOT_AVAILABLE = 3101
        const val HMS_CONFIG_INVALID = 3102
        const val HMS_TOKEN_FETCH_FAILED = 3103
        const val HMS_TOKEN_EMPTY = 3104
        const val HMS_AUTH_ERROR = 3105
        const val HMS_PUSH_ERROR = 3106
        
        // 小米推送相关错误码
        const val XIAOMI_NOT_AVAILABLE = 3201
        const val XIAOMI_INIT_FAILED = 3202
        const val XIAOMI_TOKEN_FETCH_FAILED = 3203
        const val XIAOMI_REGISTER_FAILED = 3204
        const val XIAOMI_CONFIG_INVALID = 3205
        const val XIAOMI_PUSH_ERROR = 3206
        
        // OPPO推送相关错误码
        const val OPPO_NOT_AVAILABLE = 3301
        const val OPPO_INIT_FAILED = 3302
        const val OPPO_TOKEN_FETCH_FAILED = 3303
        const val OPPO_REGISTER_FAILED = 3304
        const val OPPO_CONFIG_INVALID = 3305
        const val OPPO_PUSH_ERROR = 3306
        
        // VIVO推送相关错误码
        const val VIVO_NOT_AVAILABLE = 3401
        const val VIVO_INIT_FAILED = 3402
        const val VIVO_TOKEN_FETCH_FAILED = 3403
        const val VIVO_REGISTER_FAILED = 3404
        const val VIVO_CONFIG_INVALID = 3405
        const val VIVO_PUSH_ERROR = 3406
        
        // 魅族推送相关错误码
        const val MEIZU_NOT_AVAILABLE = 3501
        const val MEIZU_INIT_FAILED = 3502
        const val MEIZU_TOKEN_FETCH_FAILED = 3503
        const val MEIZU_REGISTER_FAILED = 3504
        const val MEIZU_CONFIG_INVALID = 3505
        const val MEIZU_PUSH_ERROR = 3506
        
        // 荣耀推送相关错误码
        const val HONOR_NOT_AVAILABLE = 3601
        const val HONOR_SDK_NOT_AVAILABLE = 3602
        const val HONOR_INIT_FAILED = 3603
        const val HONOR_TOKEN_FAILED = 3604
        const val HONOR_CONFIG_INVALID = 3605
        const val HONOR_SDK_ERROR = 3606
        const val HONOR_APP_ID_MISSING = 3607
        const val HONOR_UNKNOWN_ERROR = 3608
        
        // 权限相关错误码
        const val PERMISSION_DENIED = 4001
        const val NOTIFICATION_PERMISSION_DENIED = 4002
        
        // API相关错误码
        const val API_BAD_REQUEST = 5100
        const val API_UNAUTHORIZED = 5101
        const val API_FORBIDDEN = 5103
        const val API_NOT_FOUND = 5104
        const val API_UNPROCESSABLE_ENTITY = 5122
        const val API_INTERNAL_SERVER_ERROR = 5500
        const val API_REQUEST_FAILED = 5501
        const val ERROR_API_DEVICE_REGISTRATION_FAILED = 5001
        const val ERROR_API_TOKEN_UPDATE_FAILED = 5002
        const val ERROR_API_INVALID_RESPONSE = 5003
        
        // TCP连接相关错误码
        const val ERROR_TCP_CONNECTION_FAILED = 6001
        const val ERROR_TCP_CONNECTION_TIMEOUT = 6002
        const val ERROR_TCP_REGISTRATION_FAILED = 6003
        const val ERROR_TCP_SERVER_ERROR = 6004
        const val ERROR_TCP_MESSAGE_SEND_FAILED = 6005

        // 系统相关错误码
        const val UNKNOWN_ERROR = 9999
        
        /**
         * 创建网络不可用错误
         */
        fun networkUnavailable(details: String? = null): DooPushError {
            return DooPushError(
                code = ERROR_NETWORK_UNAVAILABLE,
                message = "网络连接不可用",
                details = details
            )
        }
        
        /**
         * 创建网络超时错误
         */
        fun networkTimeout(details: String? = null): DooPushError {
            return DooPushError(
                code = ERROR_NETWORK_TIMEOUT,
                message = "网络请求超时",
                details = details
            )
        }
        
        /**
         * 创建配置未初始化错误
         */
        fun configNotInitialized(): DooPushError {
            return DooPushError(
                code = CONFIG_NOT_INITIALIZED,
                message = "SDK尚未初始化，请先调用configure方法"
            )
        }
        
        /**
         * 创建FCM Token获取失败错误
         */
        fun fcmTokenFailed(cause: Throwable? = null): DooPushError {
            return DooPushError(
                code = FCM_TOKEN_FETCH_FAILED,
                message = "FCM Token获取失败",
                details = cause?.message,
                cause = cause
            )
        }
        
        /**
         * 创建权限被拒绝错误
         */
        fun permissionDenied(): DooPushError {
            return DooPushError(
                code = PERMISSION_DENIED,
                message = "推送权限被拒绝，请在设置中开启通知权限"
            )
        }
        
        /**
         * 创建HMS不可用错误
         */
        fun hmsNotAvailable(): DooPushError {
            return DooPushError(
                code = HMS_NOT_AVAILABLE,
                message = "华为推送服务不可用，请检查设备是否为华为设备且已安装HMS Core"
            )
        }
        
        /**
         * 创建HMS配置无效错误
         */
        fun hmsConfigInvalid(): DooPushError {
            return DooPushError(
                code = HMS_CONFIG_INVALID,
                message = "华为推送配置无效，请检查App ID是否正确"
            )
        }
        
        /**
         * 创建HMS Token获取失败错误
         */
        fun hmsTokenError(details: String? = null): DooPushError {
            return DooPushError(
                code = HMS_TOKEN_FETCH_FAILED,
                message = "华为推送Token获取失败",
                details = details
            )
        }
        
        /**
         * 创建HMS Token为空错误
         */
        fun hmsTokenEmpty(): DooPushError {
            return DooPushError(
                code = HMS_TOKEN_EMPTY,
                message = "华为推送Token为空"
            )
        }
        
        /**
         * 创建HMS认证失败错误
         */
        fun hmsAuthError(details: String? = null): DooPushError {
            return DooPushError(
                code = HMS_AUTH_ERROR,
                message = "华为推送认证失败",
                details = details
            )
        }
        
        /**
         * 创建HMS推送发送失败错误
         */
        fun hmsPushError(details: String? = null): DooPushError {
            return DooPushError(
                code = HMS_PUSH_ERROR,
                message = "华为推送发送失败",
                details = details
            )
        }
        
        /**
         * 创建小米推送不可用错误
         */
        fun xiaomiNotAvailable(): DooPushError {
            return DooPushError(
                code = XIAOMI_NOT_AVAILABLE,
                message = "小米推送服务不可用，请检查设备是否为小米设备且已安装小米推送SDK"
            )
        }
        
        /**
         * 创建小米推送初始化失败错误
         */
        fun xiaomiInitFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = XIAOMI_INIT_FAILED,
                message = "小米推送初始化失败",
                details = details
            )
        }
        
        /**
         * 创建小米推送Token获取失败错误
         */
        fun xiaomiTokenFailed(cause: Throwable? = null): DooPushError {
            return DooPushError(
                code = XIAOMI_TOKEN_FETCH_FAILED,
                message = "小米推送Token获取失败",
                details = cause?.message,
                cause = cause
            )
        }
        
        /**
         * 创建小米推送注册失败错误
         */
        fun xiaomiRegisterFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = XIAOMI_REGISTER_FAILED,
                message = "小米推送注册失败",
                details = details
            )
        }
        
        /**
         * 创建小米推送配置无效错误
         */
        fun xiaomiConfigInvalid(details: String? = null): DooPushError {
            return DooPushError(
                code = XIAOMI_CONFIG_INVALID,
                message = "小米推送配置无效",
                details = details
            )
        }
        
        /**
         * 创建小米推送操作错误
         */
        fun xiaomiPushError(details: String? = null): DooPushError {
            return DooPushError(
                code = XIAOMI_PUSH_ERROR,
                message = "小米推送操作失败",
                details = details
            )
        }
        
        /**
         * 创建OPPO推送不可用错误
         */
        fun oppoNotAvailable(): DooPushError {
            return DooPushError(
                code = OPPO_NOT_AVAILABLE,
                message = "OPPO推送服务不可用，可能是设备不支持或SDK未集成"
            )
        }
        
        /**
         * 创建OPPO推送初始化失败错误
         */
        fun oppoInitFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = OPPO_INIT_FAILED,
                message = "OPPO推送初始化失败",
                details = details
            )
        }
        
        /**
         * 创建OPPO推送Token获取失败错误
         */
        fun oppoTokenFailed(cause: Throwable? = null): DooPushError {
            return DooPushError(
                code = OPPO_TOKEN_FETCH_FAILED,
                message = "OPPO推送Token获取失败",
                details = cause?.message,
                cause = cause
            )
        }
        
        /**
         * 创建OPPO推送注册失败错误
         */
        fun oppoRegisterFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = OPPO_REGISTER_FAILED,
                message = "OPPO推送注册失败",
                details = details
            )
        }
        
        /**
         * 创建OPPO推送配置无效错误
         */
        fun oppoConfigInvalid(details: String? = null): DooPushError {
            return DooPushError(
                code = OPPO_CONFIG_INVALID,
                message = "OPPO推送配置无效",
                details = details
            )
        }
        
        /**
         * 创建OPPO推送操作错误
         */
        fun oppoPushError(details: String? = null): DooPushError {
            return DooPushError(
                code = OPPO_PUSH_ERROR,
                message = "OPPO推送操作失败",
                details = details
            )
        }
        
        /**
         * 创建VIVO推送不可用错误
         */
        fun vivoNotAvailable(): DooPushError {
            return DooPushError(
                code = VIVO_NOT_AVAILABLE,
                message = "VIVO推送服务不可用，可能是设备不支持或SDK未集成"
            )
        }
        
        /**
         * 创建VIVO推送初始化失败错误
         */
        fun vivoInitFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = VIVO_INIT_FAILED,
                message = "VIVO推送初始化失败",
                details = details
            )
        }
        
        /**
         * 创建VIVO推送Token获取失败错误
         */
        fun vivoTokenFailed(cause: Throwable? = null): DooPushError {
            return DooPushError(
                code = VIVO_TOKEN_FETCH_FAILED,
                message = "VIVO推送Token获取失败",
                details = cause?.message,
                cause = cause
            )
        }
        
        /**
         * 创建VIVO推送注册失败错误
         */
        fun vivoRegisterFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = VIVO_REGISTER_FAILED,
                message = "VIVO推送注册失败",
                details = details
            )
        }
        
        /**
         * 创建VIVO推送配置无效错误
         */
        fun vivoConfigInvalid(details: String? = null): DooPushError {
            return DooPushError(
                code = VIVO_CONFIG_INVALID,
                message = "VIVO推送配置无效",
                details = details
            )
        }
        
        /**
         * 创建VIVO推送操作错误
         */
        fun vivoPushError(details: String? = null): DooPushError {
            return DooPushError(
                code = VIVO_PUSH_ERROR,
                message = "VIVO推送操作失败",
                details = details
            )
        }
        
        /**
         * 创建魅族推送不可用错误
         */
        fun meizuNotAvailable(): DooPushError {
            return DooPushError(
                code = MEIZU_NOT_AVAILABLE,
                message = "魅族推送服务不可用，可能是设备不支持或SDK未集成"
            )
        }
        
        /**
         * 创建魅族推送初始化失败错误
         */
        fun meizuInitFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = MEIZU_INIT_FAILED,
                message = "魅族推送初始化失败",
                details = details
            )
        }
        
        /**
         * 创建魅族推送Token获取失败错误
         */
        fun meizuTokenFailed(cause: Throwable? = null): DooPushError {
            return DooPushError(
                code = MEIZU_TOKEN_FETCH_FAILED,
                message = "魅族推送Token获取失败",
                details = cause?.message,
                cause = cause
            )
        }
        
        /**
         * 创建魅族推送注册失败错误
         */
        fun meizuRegisterFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = MEIZU_REGISTER_FAILED,
                message = "魅族推送注册失败",
                details = details
            )
        }
        
        /**
         * 创建魅族推送配置无效错误
         */
        fun meizuConfigInvalid(details: String? = null): DooPushError {
            return DooPushError(
                code = MEIZU_CONFIG_INVALID,
                message = "魅族推送配置无效",
                details = details
            )
        }
        
        /**
         * 创建魅族推送操作错误
         */
        fun meizuPushError(details: String? = null): DooPushError {
            return DooPushError(
                code = MEIZU_PUSH_ERROR,
                message = "魅族推送操作失败",
                details = details
            )
        }
        
        /**
         * 创建荣耀推送不可用错误
         */
        fun honorNotAvailable(): DooPushError {
            return DooPushError(
                code = HONOR_NOT_AVAILABLE,
                message = "荣耀推送服务不可用，可能是设备不支持或SDK未集成"
            )
        }
        
        /**
         * 创建荣耀推送SDK不可用错误
         */
        fun honorSdkNotAvailable(): DooPushError {
            return DooPushError(
                code = HONOR_SDK_NOT_AVAILABLE,
                message = "荣耀推送SDK不可用，请确保已集成荣耀推送SDK"
            )
        }
        
        /**
         * 创建荣耀推送初始化失败错误
         */
        fun honorInitFailed(details: String? = null): DooPushError {
            return DooPushError(
                code = HONOR_INIT_FAILED,
                message = "荣耀推送初始化失败",
                details = details
            )
        }
        
        /**
         * 创建荣耀推送Token获取失败错误
         */
        fun honorTokenFailed(cause: Throwable? = null): DooPushError {
            return DooPushError(
                code = HONOR_TOKEN_FAILED,
                message = "荣耀推送Token获取失败",
                details = cause?.message,
                cause = cause
            )
        }
        
        /**
         * 创建荣耀推送配置无效错误
         */
        fun honorConfigInvalid(details: String? = null): DooPushError {
            return DooPushError(
                code = HONOR_CONFIG_INVALID,
                message = "荣耀推送配置无效",
                details = details
            )
        }
        
        /**
         * 创建荣耀推送SDK错误
         */
        fun honorSdkError(details: String? = null): DooPushError {
            return DooPushError(
                code = HONOR_SDK_ERROR,
                message = "荣耀推送SDK调用错误",
                details = details
            )
        }
        
        /**
         * 创建荣耀推送未知错误
         */
        fun honorUnknownError(details: String? = null): DooPushError {
            return DooPushError(
                code = HONOR_UNKNOWN_ERROR,
                message = "荣耀推送未知错误",
                details = details
            )
        }
        
        /**
         * 创建未知系统错误
         */
        fun unknown(cause: Throwable? = null): DooPushError {
            return DooPushError(
                code = UNKNOWN_ERROR,
                message = "未知系统错误",
                details = cause?.message,
                cause = cause
            )
        }
        
        /**
         * 从异常创建错误对象
         */
        fun fromException(exception: Throwable): DooPushError {
            return DooPushError(
                code = UNKNOWN_ERROR,
                message = exception.message ?: "未知错误",
                cause = exception
            )
        }
    }
    
    /**
     * 获取完整的错误描述
     */
    fun getFullDescription(): String {
        val builder = StringBuilder()
        builder.append("[$code] $message")
        if (!details.isNullOrEmpty()) {
            builder.append(" - $details")
        }
        return builder.toString()
    }
    
    /**
     * 是否为网络相关错误
     */
    fun isNetworkError(): Boolean {
        return code in 1001..1999
    }
    
    /**
     * 是否为配置相关错误
     */
    fun isConfigError(): Boolean {
        return code in 2001..2999
    }
    
    /**
     * 是否为FCM相关错误
     */
    fun isFcmError(): Boolean {
        return code in 3001..3099
    }
    
    /**
     * 是否为HMS相关错误
     */
    fun isHmsError(): Boolean {
        return code in 3101..3199
    }
    
    /**
     * 是否为荣耀推送相关错误
     */
    fun isHonorError(): Boolean {
        return code in 3501..3599
    }
    
    /**
     * 是否为权限相关错误
     */
    fun isPermissionError(): Boolean {
        return code in 4001..4999
    }
    
    /**
     * 是否为TCP连接相关错误
     */
    fun isTcpError(): Boolean {
        return code in 6001..6999
    }
}

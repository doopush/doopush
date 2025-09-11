package com.doopush.sdk

import com.doopush.sdk.models.DooPushError
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * DooPush SDK 统一错误处理器
 * 
 * 负责处理各种异常并转换为标准的 DooPushError
 */
object DooPushErrorHandler {
    
    private const val TAG = "ErrorHandler"
    
    /**
     * 处理网络异常
     */
    fun handleNetworkError(throwable: Throwable): DooPushError {
        // 根据异常类型决定日志级别
        if (isCommonNetworkError(throwable)) {
            DooPushLogger.d(TAG, "常见网络异常: ${throwable.javaClass.simpleName} - ${throwable.message}")
        } else {
            DooPushLogger.e(TAG, "处理网络异常: ${throwable.javaClass.simpleName}", throwable)
        }
        
        return when (throwable) {
            is SocketTimeoutException -> {
                DooPushError(
                    code = DooPushError.NETWORK_ERROR,
                    message = "网络请求超时",
                    details = "请检查网络连接或稍后重试",
                    cause = throwable
                )
            }
            
            is UnknownHostException -> {
                DooPushError(
                    code = DooPushError.NETWORK_ERROR,
                    message = "无法连接到服务器",
                    details = "请检查网络连接和服务器地址",
                    cause = throwable
                )
            }
            
            is IOException -> {
                DooPushError(
                    code = DooPushError.NETWORK_ERROR,
                    message = "网络连接错误",
                    details = throwable.message ?: "未知网络错误",
                    cause = throwable
                )
            }
            
            else -> {
                DooPushError(
                    code = DooPushError.NETWORK_ERROR,
                    message = "网络请求失败",
                    details = throwable.message ?: throwable.javaClass.simpleName,
                    cause = throwable
                )
            }
        }
    }
    
    /**
     * 处理API响应错误
     */
    fun handleApiError(statusCode: Int, responseBody: String?): DooPushError {
        DooPushLogger.w(TAG, "API错误: $statusCode, 响应: $responseBody")
        
        val errorCode = when (statusCode) {
            400 -> DooPushError.API_BAD_REQUEST
            401 -> DooPushError.API_UNAUTHORIZED
            403 -> DooPushError.API_FORBIDDEN
            404 -> DooPushError.API_NOT_FOUND
            422 -> DooPushError.API_UNPROCESSABLE_ENTITY
            in 500..599 -> DooPushError.API_INTERNAL_SERVER_ERROR
            else -> DooPushError.API_REQUEST_FAILED
        }
        
        val message = when (statusCode) {
            400 -> "请求参数错误"
            401 -> "认证失败，请检查API密钥"
            403 -> "没有访问权限"
            404 -> "请求的资源不存在"
            422 -> "请求数据格式错误"
            in 500..599 -> "服务器内部错误"
            else -> "API请求失败"
        }
        
        return DooPushError(
            code = errorCode,
            message = message,
            details = "HTTP $statusCode: ${responseBody ?: "无响应内容"}"
        )
    }
    
    /**
     * 处理FCM相关错误
     */
    fun handleFCMError(throwable: Throwable): DooPushError {
        DooPushLogger.e(TAG, "FCM错误: ${throwable.javaClass.simpleName}", throwable)
        
        return when {
            throwable.message?.contains("SERVICE_NOT_AVAILABLE", ignoreCase = true) == true -> {
                DooPushError(
                    code = DooPushError.FCM_SERVICE_UNAVAILABLE,
                    message = "Firebase服务不可用",
                    details = "请检查Google Play服务是否安装和更新",
                    cause = throwable
                )
            }
            
            throwable.message?.contains("INVALID_PARAMETERS", ignoreCase = true) == true -> {
                DooPushError(
                    code = DooPushError.FCM_TOKEN_FETCH_FAILED,
                    message = "FCM配置错误",
                    details = "请检查google-services.json配置文件",
                    cause = throwable
                )
            }
            
            else -> {
                DooPushError(
                    code = DooPushError.FCM_TOKEN_FETCH_FAILED,
                    message = "FCM Token获取失败",
                    details = throwable.message ?: "未知FCM错误",
                    cause = throwable
                )
            }
        }
    }
    
    /**
     * 处理配置错误
     */
    fun handleConfigError(field: String, value: String?): DooPushError {
        DooPushLogger.e(TAG, "配置错误: $field = $value")
        
        val (code, message) = when (field) {
            "appId" -> Pair(DooPushError.CONFIG_INVALID_APP_ID, "应用ID无效")
            "apiKey" -> Pair(DooPushError.CONFIG_INVALID_API_KEY, "API密钥无效")
            "baseUrl" -> Pair(DooPushError.CONFIG_INVALID_BASE_URL, "服务器地址无效")
            else -> Pair(DooPushError.CONFIG_NOT_INITIALIZED, "配置参数无效")
        }
        
        return DooPushError(
            code = code,
            message = message,
            details = "字段: $field, 值: ${value ?: "null"}"
        )
    }
    
    /**
     * 处理权限错误
     */
    fun handlePermissionError(permission: String): DooPushError {
        DooPushLogger.w(TAG, "权限错误: $permission")
        
        return when (permission) {
            android.Manifest.permission.POST_NOTIFICATIONS -> {
                DooPushError(
                    code = DooPushError.NOTIFICATION_PERMISSION_DENIED,
                    message = "通知权限被拒绝",
                    details = "请在系统设置中开启通知权限"
                )
            }
            
            else -> {
                DooPushError(
                    code = DooPushError.PERMISSION_DENIED,
                    message = "权限被拒绝",
                    details = "缺少必要权限: $permission"
                )
            }
        }
    }
    
    /**
     * 处理一般性异常
     */
    fun handleGeneralError(throwable: Throwable, context: String = "未知操作"): DooPushError {
        DooPushLogger.e(TAG, "一般性异常 [$context]: ${throwable.javaClass.simpleName}", throwable)
        
        return when (throwable) {
            is IllegalArgumentException -> {
                DooPushError(
                    code = DooPushError.CONFIG_NOT_INITIALIZED,
                    message = "参数错误",
                    details = throwable.message ?: "无效的参数值",
                    cause = throwable
                )
            }
            
            is IllegalStateException -> {
                DooPushError(
                    code = DooPushError.CONFIG_NOT_INITIALIZED,
                    message = "状态错误",
                    details = throwable.message ?: "SDK未正确初始化",
                    cause = throwable
                )
            }
            
            is SecurityException -> {
                DooPushError(
                    code = DooPushError.PERMISSION_DENIED,
                    message = "安全错误",
                    details = throwable.message ?: "权限不足",
                    cause = throwable
                )
            }
            
            else -> {
                DooPushError(
                    code = DooPushError.UNKNOWN_ERROR,
                    message = "未知错误",
                    details = "操作: $context, 异常: ${throwable.message ?: throwable.javaClass.simpleName}",
                    cause = throwable
                )
            }
        }
    }
    
    /**
     * 创建用户友好的错误信息
     */
    fun createUserFriendlyMessage(error: DooPushError): String {
        return when (error.code) {
            DooPushError.NETWORK_ERROR -> "网络连接失败，请检查网络设置后重试"
            DooPushError.API_UNAUTHORIZED -> "认证失败，请检查配置信息"
            DooPushError.CONFIG_NOT_INITIALIZED -> "SDK未正确配置，请先完成初始化"
            DooPushError.FCM_TOKEN_FETCH_FAILED -> "推送服务连接失败，请检查网络和Google服务"
            DooPushError.NOTIFICATION_PERMISSION_DENIED -> "请在系统设置中开启通知权限"
            else -> error.message
        }
    }
    
    /**
     * 记录错误统计
     */
    fun logErrorStatistics() {
        // 这里可以实现错误统计逻辑
        DooPushLogger.d(TAG, "错误统计功能暂未实现")
    }
    
    /**
     * 获取错误诊断信息
     */
    fun getDiagnosticInfo(error: DooPushError): String {
        val builder = StringBuilder()
        
        builder.append("=== 错误诊断信息 ===\n")
        builder.append("错误码: ${error.code}\n")
        builder.append("错误消息: ${error.message}\n")
        builder.append("详细信息: ${error.details ?: "无"}\n")
        builder.append("时间戳: ${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())}\n")
        
        error.cause?.let { throwable ->
            builder.append("异常类型: ${throwable.javaClass.simpleName}\n")
            builder.append("异常消息: ${throwable.message ?: "无"}\n")
            
            // 堆栈跟踪（仅显示前5行）
            val stackTrace = throwable.stackTrace.take(5).joinToString("\n") { 
                "  at ${it.className}.${it.methodName}(${it.fileName}:${it.lineNumber})"
            }
            if (stackTrace.isNotEmpty()) {
                builder.append("堆栈跟踪:\n$stackTrace\n")
            }
        }
        
        // 建议解决方案
        val suggestions = getSuggestions(error)
        if (suggestions.isNotEmpty()) {
            builder.append("建议解决方案:\n")
            suggestions.forEachIndexed { index, suggestion ->
                builder.append("${index + 1}. $suggestion\n")
            }
        }
        
        return builder.toString()
    }
    
    /**
     * 判断是否是常见的网络错误（不需要ERROR级别日志）
     */
    private fun isCommonNetworkError(throwable: Throwable): Boolean {
        return when {
            // Socket连接相关的常见错误
            throwable is java.net.SocketException -> {
                val message = throwable.message?.lowercase()
                message?.contains("software caused connection abort") == true ||
                message?.contains("connection reset by peer") == true ||
                message?.contains("broken pipe") == true
            }
            
            // 连接超时和DNS解析失败是常见的
            throwable is SocketTimeoutException -> true
            throwable is UnknownHostException -> true
            throwable is java.net.ConnectException -> true
            throwable is java.net.NoRouteToHostException -> true
            
            // 一般的IOException，如果消息包含常见的网络断开信息
            throwable is IOException -> {
                val message = throwable.message?.lowercase()
                message?.contains("connection") == true ||
                message?.contains("socket") == true ||
                message?.contains("network") == true
            }
            
            else -> false
        }
    }

    /**
     * 获取错误解决建议
     */
    private fun getSuggestions(error: DooPushError): List<String> {
        return when (error.code) {
            DooPushError.NETWORK_ERROR -> listOf(
                "检查设备网络连接",
                "确认服务器地址正确",
                "尝试切换网络环境",
                "检查防火墙设置"
            )
            
            DooPushError.API_UNAUTHORIZED -> listOf(
                "验证API密钥是否正确",
                "检查应用ID配置",
                "确认账户权限状态",
                "联系技术支持"
            )
            
            DooPushError.FCM_TOKEN_FETCH_FAILED -> listOf(
                "检查Google Play服务是否安装",
                "验证google-services.json配置",
                "检查网络连接",
                "重启应用重试"
            )
            
            DooPushError.NOTIFICATION_PERMISSION_DENIED -> listOf(
                "进入系统设置开启通知权限",
                "检查应用通知设置",
                "重新安装应用"
            )
            
            else -> listOf(
                "重启应用重试",
                "检查配置信息",
                "联系技术支持"
            )
        }
    }
}

package com.doopush.sdk.internal

import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * DooPush SDK 日志管理器
 */
object DooPushLogger {
    
    private const val TAG = "DooPushSDK"
    private const val MAX_LOG_HISTORY = 1000
    
    // 日志级别
    enum class LogLevel(val priority: Int) {
        VERBOSE(Log.VERBOSE),
        DEBUG(Log.DEBUG),
        INFO(Log.INFO),
        WARN(Log.WARN),
        ERROR(Log.ERROR)
    }
    
    // 日志配置
    private var isDebugEnabled = false
    private var minLogLevel = LogLevel.INFO
    private var logToFile = false
    private var customLogListener: ((LogLevel, String, String) -> Unit)? = null
    
    // 日志历史记录
    private val logHistory = ConcurrentLinkedQueue<LogEntry>()
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault())
    
    /**
     * 日志条目
     */
    data class LogEntry(
        val timestamp: Long,
        val level: LogLevel,
        val tag: String,
        val message: String,
        val throwable: Throwable? = null
    ) {
        fun getFormattedTime(): String {
            return dateFormat.format(Date(timestamp))
        }
        
        override fun toString(): String {
            val throwableStr = throwable?.let { "\n${Log.getStackTraceString(it)}" } ?: ""
            return "${getFormattedTime()} ${level.name}/$tag: $message$throwableStr"
        }
    }
    
    /**
     * 初始化日志系统
     */
    fun initialize(debugEnabled: Boolean) {
        isDebugEnabled = debugEnabled
        minLogLevel = if (debugEnabled) LogLevel.DEBUG else LogLevel.INFO
        
        info("DooPush Logger 初始化完成 - Debug: $debugEnabled")
    }
    
    /**
     * 启用开发模式
     */
    fun enableDevelopmentMode() {
        isDebugEnabled = true
        minLogLevel = LogLevel.DEBUG
        info("开发模式已启用")
    }
    
    /**
     * 启用生产模式
     */
    fun enableProductionMode() {
        isDebugEnabled = false
        minLogLevel = LogLevel.INFO
        info("生产模式已启用")
    }
    
    /**
     * 设置最小日志级别
     */
    fun setMinLogLevel(level: LogLevel) {
        minLogLevel = level
        info("最小日志级别设置为: ${level.name}")
    }
    
    /**
     * 设置自定义日志监听器
     */
    fun setCustomLogListener(listener: ((LogLevel, String, String) -> Unit)?) {
        customLogListener = listener
        info("自定义日志监听器已${if (listener != null) "设置" else "移除"}")
    }
    
    /**
     * 启用/禁用文件日志
     */
    fun setLogToFile(enabled: Boolean) {
        logToFile = enabled
        info("文件日志已${if (enabled) "启用" else "禁用"}")
    }
    
    /**
     * 检查是否启用调试模式
     */
    fun isDebugEnabled(): Boolean {
        return isDebugEnabled
    }
    
    /**
     * 检查日志级别是否可以输出
     */
    private fun shouldLog(level: LogLevel): Boolean {
        return level.priority >= minLogLevel.priority
    }
    
    /**
     * 记录日志
     */
    private fun log(level: LogLevel, message: String, throwable: Throwable? = null) {
        if (!shouldLog(level)) {
            return
        }
        
        val tag = TAG
        val logEntry = LogEntry(
            timestamp = System.currentTimeMillis(),
            level = level,
            tag = tag,
            message = message,
            throwable = throwable
        )
        
        // 添加到历史记录
        addToHistory(logEntry)
        
        // 输出到Android Log
        when (level) {
            LogLevel.VERBOSE -> Log.v(tag, message, throwable)
            LogLevel.DEBUG -> Log.d(tag, message, throwable)
            LogLevel.INFO -> Log.i(tag, message, throwable)
            LogLevel.WARN -> Log.w(tag, message, throwable)
            LogLevel.ERROR -> Log.e(tag, message, throwable)
        }
        
        // 调用自定义监听器
        customLogListener?.invoke(level, tag, message)
        
        // TODO: 实现文件日志
        if (logToFile) {
            writeToFile(logEntry)
        }
    }
    
    /**
     * 添加到历史记录
     */
    private fun addToHistory(logEntry: LogEntry) {
        logHistory.offer(logEntry)
        
        // 保持历史记录数量在限制内
        while (logHistory.size > MAX_LOG_HISTORY) {
            logHistory.poll()
        }
    }
    
    /**
     * 写入文件（TODO: 实现文件日志功能）
     */
    private fun writeToFile(logEntry: LogEntry) {
        // TODO: 实现文件日志写入
    }
    
    // 公共日志方法
    
    /**
     * 详细日志
     */
    fun verbose(message: String, throwable: Throwable? = null) {
        log(LogLevel.VERBOSE, message, throwable)
    }
    
    /**
     * 调试日志
     */
    fun debug(message: String, throwable: Throwable? = null) {
        log(LogLevel.DEBUG, message, throwable)
    }
    
    /**
     * 信息日志
     */
    fun info(message: String, throwable: Throwable? = null) {
        log(LogLevel.INFO, message, throwable)
    }
    
    /**
     * 警告日志
     */
    fun warning(message: String, throwable: Throwable? = null) {
        log(LogLevel.WARN, message, throwable)
    }
    
    /**
     * 错误日志
     */
    fun error(message: String, throwable: Throwable? = null) {
        log(LogLevel.ERROR, message, throwable)
    }
    
    // 便利方法
    
    /**
     * 记录方法进入
     */
    fun enter(methodName: String) {
        debug("→ 进入方法: $methodName")
    }
    
    /**
     * 记录方法退出
     */
    fun exit(methodName: String) {
        debug("← 退出方法: $methodName")
    }
    
    /**
     * 记录方法执行时间
     */
    fun logExecutionTime(methodName: String, startTime: Long) {
        val executionTime = System.currentTimeMillis() - startTime
        debug("方法 $methodName 执行时间: ${executionTime}ms")
    }
    
    /**
     * 记录网络请求
     */
    fun logNetworkRequest(method: String, url: String, statusCode: Int? = null) {
        val statusStr = statusCode?.let { " ($it)" } ?: ""
        info("网络请求: $method $url$statusStr")
    }
    
    /**
     * 记录推送事件
     */
    fun logPushEvent(event: String, details: String? = null) {
        val detailsStr = details?.let { " - $it" } ?: ""
        info("推送事件: $event$detailsStr")
    }
    
    // 日志查询和导出
    
    /**
     * 获取日志历史记录
     */
    fun getLogHistory(): List<LogEntry> {
        return logHistory.toList()
    }
    
    /**
     * 获取指定级别的日志
     */
    fun getLogsByLevel(level: LogLevel): List<LogEntry> {
        return logHistory.filter { it.level == level }
    }
    
    /**
     * 获取指定时间范围的日志
     */
    fun getLogsByTimeRange(startTime: Long, endTime: Long): List<LogEntry> {
        return logHistory.filter { it.timestamp in startTime..endTime }
    }
    
    /**
     * 搜索日志
     */
    fun searchLogs(keyword: String): List<LogEntry> {
        return logHistory.filter { 
            it.message.contains(keyword, ignoreCase = true) ||
            it.tag.contains(keyword, ignoreCase = true)
        }
    }
    
    /**
     * 导出日志为字符串
     */
    fun exportLogsAsString(): String {
        return logHistory.joinToString("\n") { it.toString() }
    }
    
    /**
     * 导出指定级别的日志
     */
    fun exportLogsByLevel(level: LogLevel): String {
        return getLogsByLevel(level).joinToString("\n") { it.toString() }
    }
    
    /**
     * 清除日志历史
     */
    fun clearHistory() {
        logHistory.clear()
        info("日志历史已清除")
    }
    
    /**
     * 获取日志统计信息
     */
    fun getLogStats(): Map<String, Any> {
        val stats = mutableMapOf<String, Any>()
        
        stats["total_logs"] = logHistory.size
        stats["debug_enabled"] = isDebugEnabled
        stats["min_log_level"] = minLogLevel.name
        stats["log_to_file"] = logToFile
        stats["has_custom_listener"] = (customLogListener != null)
        
        // 按级别统计
        val levelCounts = mutableMapOf<String, Int>()
        for (level in LogLevel.values()) {
            levelCounts[level.name] = logHistory.count { it.level == level }
        }
        stats["level_counts"] = levelCounts
        
        // 时间范围
        if (logHistory.isNotEmpty()) {
            val timestamps = logHistory.map { it.timestamp }
            stats["first_log_time"] = timestamps.minOrNull() ?: 0
            stats["last_log_time"] = timestamps.maxOrNull() ?: 0
        }
        
        return stats
    }
}
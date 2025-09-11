package com.doopush.sdk

import android.util.Log
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * DooPush SDK 统一日志管理器
 * 
 * 提供统一的日志记录、过滤和输出功能
 */
object DooPushLogger {
    
    /**
     * 日志级别
     */
    enum class Level(val value: Int, val tag: String) {
        VERBOSE(2, "V"),
        DEBUG(3, "D"),
        INFO(4, "I"),
        WARN(5, "W"),
        ERROR(6, "E"),
        ASSERT(7, "A")
    }
    
    /**
     * 日志项
     */
    data class LogEntry(
        val timestamp: Long,
        val level: Level,
        val tag: String,
        val message: String,
        val throwable: Throwable? = null
    ) {
        fun getFormattedMessage(): String {
            val dateFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault())
            val timeStr = dateFormat.format(Date(timestamp))
            val throwableStr = throwable?.let { "\n${getStackTraceString(it)}" } ?: ""
            return "[$timeStr] ${level.tag}/$tag: $message$throwableStr"
        }
        
        private fun getStackTraceString(throwable: Throwable): String {
            val sw = StringWriter()
            val pw = PrintWriter(sw)
            throwable.printStackTrace(pw)
            return sw.toString()
        }
    }
    
    // 配置
    private const val DEFAULT_TAG = "DooPush"
    private const val MAX_LOG_ENTRIES = 1000
    private val LOG_TAG_PREFIX = "DooPush"
    
    // 状态
    private var isEnabled = BuildConfig.DEBUG
    private var logLevel = Level.DEBUG
    private var enableLogStorage = true
    
    // 日志存储
    private val logEntries = ConcurrentLinkedQueue<LogEntry>()
    
    // 日志监听器
    private val listeners = mutableSetOf<LogListener>()
    
    /**
     * 日志监听器接口
     */
    interface LogListener {
        fun onLog(entry: LogEntry)
    }
    
    /**
     * 启用或禁用日志
     */
    fun setEnabled(enabled: Boolean) {
        isEnabled = enabled
        i(DEFAULT_TAG, "日志系统${if (enabled) "已启用" else "已禁用"}")
    }
    
    /**
     * 设置日志级别
     */
    fun setLogLevel(level: Level) {
        this.logLevel = level
        i(DEFAULT_TAG, "日志级别设置为: ${level.name}")
    }
    
    /**
     * 启用或禁用日志存储
     */
    fun setLogStorageEnabled(enabled: Boolean) {
        enableLogStorage = enabled
        i(DEFAULT_TAG, "日志存储${if (enabled) "已启用" else "已禁用"}")
    }
    
    /**
     * 添加日志监听器
     */
    fun addListener(listener: LogListener) {
        listeners.add(listener)
    }
    
    /**
     * 移除日志监听器
     */
    fun removeListener(listener: LogListener) {
        listeners.remove(listener)
    }
    
    /**
     * VERBOSE 日志
     */
    @JvmStatic
    fun v(tag: String, message: String, throwable: Throwable? = null) {
        log(Level.VERBOSE, tag, message, throwable)
    }
    
    /**
     * DEBUG 日志
     */
    @JvmStatic
    fun d(tag: String, message: String, throwable: Throwable? = null) {
        log(Level.DEBUG, tag, message, throwable)
    }
    
    /**
     * INFO 日志
     */
    @JvmStatic
    fun i(tag: String, message: String, throwable: Throwable? = null) {
        log(Level.INFO, tag, message, throwable)
    }
    
    /**
     * WARN 日志
     */
    @JvmStatic
    fun w(tag: String, message: String, throwable: Throwable? = null) {
        log(Level.WARN, tag, message, throwable)
    }
    
    /**
     * ERROR 日志
     */
    @JvmStatic
    fun e(tag: String, message: String, throwable: Throwable? = null) {
        log(Level.ERROR, tag, message, throwable)
    }
    
    /**
     * 记录异常
     */
    @JvmStatic
    fun logException(tag: String, message: String, throwable: Throwable) {
        log(Level.ERROR, tag, message, throwable)
    }
    
    /**
     * 记录网络请求
     */
    @JvmStatic
    fun logNetworkRequest(url: String, method: String, headers: Map<String, String>? = null) {
        if (!isEnabled || logLevel.value > Level.DEBUG.value) return
        
        val headersStr = headers?.entries?.joinToString(", ") { "${it.key}=${it.value}" } ?: ""
        d("Network", "请求: $method $url ${if (headersStr.isNotEmpty()) "[$headersStr]" else ""}")
    }
    
    /**
     * 记录网络响应
     */
    @JvmStatic
    fun logNetworkResponse(url: String, statusCode: Int, responseTime: Long) {
        if (!isEnabled || logLevel.value > Level.DEBUG.value) return
        
        val level = when {
            statusCode in 200..299 -> Level.DEBUG
            statusCode in 400..499 -> Level.WARN
            statusCode >= 500 -> Level.ERROR
            else -> Level.DEBUG
        }
        
        log(level, "Network", "响应: $statusCode $url (${responseTime}ms)", null)
    }
    
    /**
     * 记录推送消息
     */
    @JvmStatic
    fun logPushMessage(title: String?, body: String?, data: Map<String, String>?) {
        val message = "推送消息 - 标题: $title, 内容: $body, 数据: $data"
        i("Push", message)
    }
    
    /**
     * 记录SDK事件
     */
    @JvmStatic
    fun logEvent(event: String, details: String? = null) {
        val message = if (details != null) "$event: $details" else event
        i("Event", message)
    }
    
    /**
     * 获取所有日志条目
     */
    fun getAllLogs(): List<LogEntry> {
        return logEntries.toList().sortedByDescending { it.timestamp }
    }
    
    /**
     * 获取指定级别的日志
     */
    fun getLogsByLevel(level: Level): List<LogEntry> {
        return logEntries.filter { it.level == level }.sortedByDescending { it.timestamp }
    }
    
    /**
     * 获取指定标签的日志
     */
    fun getLogsByTag(tag: String): List<LogEntry> {
        return logEntries.filter { it.tag == tag }.sortedByDescending { it.timestamp }
    }
    
    /**
     * 清空日志
     */
    fun clearLogs() {
        logEntries.clear()
        i(DEFAULT_TAG, "日志已清空")
    }
    
    /**
     * 导出日志为字符串
     */
    fun exportLogs(): String {
        val logs = getAllLogs()
        return if (logs.isEmpty()) {
            "暂无日志记录"
        } else {
            val header = "DooPush SDK 日志导出\n生成时间: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())}\n总计: ${logs.size} 条日志\n\n"
            header + logs.joinToString("\n") { it.getFormattedMessage() }
        }
    }
    
    /**
     * 获取SDK状态日志
     */
    fun getSDKStatusLog(): String {
        val builder = StringBuilder()
        builder.append("=== DooPush SDK 状态日志 ===\n")
        builder.append("时间: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())}\n")
        builder.append("日志系统状态: ${if (isEnabled) "启用" else "禁用"}\n")
        builder.append("日志级别: ${logLevel.name}\n")
        builder.append("日志存储: ${if (enableLogStorage) "启用" else "禁用"}\n")
        builder.append("存储日志数: ${logEntries.size}/$MAX_LOG_ENTRIES\n")
        builder.append("监听器数: ${listeners.size}\n")
        builder.append("\n")
        
        // 按级别统计
        val levelCounts = Level.values().associateWith { level ->
            logEntries.count { it.level == level }
        }
        builder.append("=== 日志级别统计 ===\n")
        levelCounts.forEach { (level, count) ->
            builder.append("${level.name}: $count 条\n")
        }
        builder.append("\n")
        
        // 最近的错误日志
        val recentErrors = getLogsByLevel(Level.ERROR).take(5)
        if (recentErrors.isNotEmpty()) {
            builder.append("=== 最近错误日志 ===\n")
            recentErrors.forEach { entry ->
                builder.append("${entry.getFormattedMessage()}\n")
            }
        }
        
        return builder.toString()
    }
    
    /**
     * 核心日志记录方法
     */
    private fun log(level: Level, tag: String, message: String, throwable: Throwable?) {
        // 检查是否启用和级别过滤
        if (!isEnabled || level.value < logLevel.value) {
            return
        }
        
        // 构造完整标签
        val fullTag = "$LOG_TAG_PREFIX-$tag"
        
        // 输出到Android Log
        when (level) {
            Level.VERBOSE -> Log.v(fullTag, message, throwable)
            Level.DEBUG -> Log.d(fullTag, message, throwable)
            Level.INFO -> Log.i(fullTag, message, throwable)
            Level.WARN -> Log.w(fullTag, message, throwable)
            Level.ERROR -> Log.e(fullTag, message, throwable)
            Level.ASSERT -> Log.wtf(fullTag, message, throwable)
        }
        
        // 存储日志
        if (enableLogStorage) {
            val entry = LogEntry(
                timestamp = System.currentTimeMillis(),
                level = level,
                tag = tag,
                message = message,
                throwable = throwable
            )
            
            // 添加到存储，限制数量
            logEntries.offer(entry)
            while (logEntries.size > MAX_LOG_ENTRIES) {
                logEntries.poll()
            }
            
            // 通知监听器
            listeners.forEach { listener ->
                try {
                    listener.onLog(entry)
                } catch (e: Exception) {
                    Log.e(fullTag, "日志监听器异常", e)
                }
            }
        }
    }
    
    /**
     * 初始化日志系统
     */
    internal fun initialize(debugMode: Boolean = BuildConfig.DEBUG) {
        setEnabled(debugMode)
        i(DEFAULT_TAG, "DooPush 日志系统初始化完成")
    }
}

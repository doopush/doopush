import Foundation
import os.log

/// DooPush SDK 日志管理类
public class DooPushLogger {
    
    /// 日志级别枚举
    @objc public enum LogLevel: Int, CaseIterable {
        case verbose = 0
        case debug = 1
        case info = 2
        case warning = 3
        case error = 4
        case none = 5
        
        var name: String {
            switch self {
            case .verbose: return "VERBOSE"
            case .debug: return "DEBUG"
            case .info: return "INFO"
            case .warning: return "WARNING"
            case .error: return "ERROR"
            case .none: return "NONE"
            }
        }
        
        var emoji: String {
            switch self {
            case .verbose: return "💬"
            case .debug: return "🔍"
            case .info: return "ℹ️"
            case .warning: return "⚠️"
            case .error: return "❌"
            case .none: return ""
            }
        }
        
        @available(iOS 10.0, *)
        var osLogType: OSLogType {
            switch self {
            case .verbose, .debug: return .debug
            case .info: return .info
            case .warning: return .default
            case .error: return .error
            case .none: return .fault
            }
        }
    }
    
    /// 单例实例
    public static let shared = DooPushLogger()
    
    /// 当前日志级别
    @objc public static var logLevel: LogLevel = .info
    
    /// 是否启用控制台输出
    @objc public static var isConsoleEnabled: Bool = true
    
    /// 是否启用系统日志
    @objc public static var isSystemLogEnabled: Bool = false
    
    /// 日志标签前缀
    private static let logPrefix = "[DooPushSDK]"
    
    /// 系统日志对象
    @available(iOS 10.0, *)
    private lazy var osLog = OSLog(subsystem: "com.doopush.sdk", category: "DooPushSDK")
    
    /// 日志格式化器
    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        return formatter
    }()
    
    /// 日志回调
    public static var logCallback: ((LogLevel, String, String) -> Void)?
    
    private init() {}
    
    // MARK: - 公共日志方法
    
    /// 详细日志
    /// - Parameters:
    ///   - message: 日志消息
    ///   - file: 文件名
    ///   - function: 函数名
    ///   - line: 行号
    @objc public static func verbose(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .verbose, message: message, file: file, function: function, line: line)
    }
    
    /// 调试日志
    /// - Parameters:
    ///   - message: 日志消息
    ///   - file: 文件名
    ///   - function: 函数名
    ///   - line: 行号
    @objc public static func debug(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .debug, message: message, file: file, function: function, line: line)
    }
    
    /// 信息日志
    /// - Parameters:
    ///   - message: 日志消息
    ///   - file: 文件名
    ///   - function: 函数名
    ///   - line: 行号
    @objc public static func info(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .info, message: message, file: file, function: function, line: line)
    }
    
    /// 警告日志
    /// - Parameters:
    ///   - message: 日志消息
    ///   - file: 文件名
    ///   - function: 函数名
    ///   - line: 行号
    @objc public static func warning(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .warning, message: message, file: file, function: function, line: line)
    }
    
    /// 错误日志
    /// - Parameters:
    ///   - message: 日志消息
    ///   - file: 文件名
    ///   - function: 函数名
    ///   - line: 行号
    @objc public static func error(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .error, message: message, file: file, function: function, line: line)
    }
    
    /// 错误日志（带Error对象）
    /// - Parameters:
    ///   - error: 错误对象
    ///   - message: 额外的错误消息
    ///   - file: 文件名
    ///   - function: 函数名
    ///   - line: 行号
    @objc public static func error(
        _ error: Error,
        message: String? = nil,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        let errorMessage: String
        if let additionalMessage = message {
            errorMessage = "\(additionalMessage): \(error.localizedDescription)"
        } else {
            errorMessage = error.localizedDescription
        }
        
        shared.log(level: .error, message: errorMessage, file: file, function: function, line: line)
    }
    
    // MARK: - 核心日志方法
    
    /// 核心日志输出方法
    /// - Parameters:
    ///   - level: 日志级别
    ///   - message: 日志消息
    ///   - file: 文件名
    ///   - function: 函数名
    ///   - line: 行号
    private func log(
        level: LogLevel,
        message: String,
        file: String,
        function: String,
        line: Int
    ) {
        // 检查日志级别
        guard level.rawValue >= Self.logLevel.rawValue else { return }
        
        let timestamp = dateFormatter.string(from: Date())
        let fileName = (file as NSString).lastPathComponent
        let location = "\(fileName):\(line)"
        
        let logMessage = "\(Self.logPrefix) \(level.emoji) [\(level.name)] \(message) [\(location)]"
        
        // 控制台输出
        if Self.isConsoleEnabled {
            print("\(timestamp) \(logMessage)")
        }
        
        // 系统日志输出
        if Self.isSystemLogEnabled {
            if #available(iOS 10.0, *) {
                os_log("%{public}@", log: osLog, type: level.osLogType, logMessage)
            } else {
                NSLog("%@", logMessage)
            }
        }
        
        // 回调输出
        Self.logCallback?(level, message, location)
    }
    
    // MARK: - 配置方法
    
    /// 设置日志级别
    /// - Parameter level: 日志级别
    @objc public static func configureLogLevel(_ level: LogLevel) {
        logLevel = level
        info("日志级别已设置为: \(level.name)")
    }
    
    /// 启用/禁用控制台日志
    /// - Parameter enabled: 是否启用
    @objc public static func setConsoleEnabled(_ enabled: Bool) {
        isConsoleEnabled = enabled
    }
    
    /// 启用/禁用系统日志
    /// - Parameter enabled: 是否启用
    @objc public static func setSystemLogEnabled(_ enabled: Bool) {
        isSystemLogEnabled = enabled
    }
    
    /// 设置日志回调
    /// - Parameter callback: 日志回调函数
    public static func setLogCallback(_ callback: ((LogLevel, String, String) -> Void)?) {
        logCallback = callback
    }
    
    // MARK: - 便利方法
    
    /// 启用开发模式日志（显示所有级别）
    @objc public static func enableDevelopmentMode() {
        configureLogLevel(.verbose)
        setConsoleEnabled(true)
        setSystemLogEnabled(true)
        info("开发模式日志已启用")
    }
    
    /// 启用生产模式日志（仅显示重要信息）
    @objc public static func enableProductionMode() {
        configureLogLevel(.warning)
        setConsoleEnabled(false)
        setSystemLogEnabled(true)
        info("生产模式日志已启用")
    }
    
    /// 禁用所有日志
    @objc public static func disableAllLogs() {
        configureLogLevel(.none)
        setConsoleEnabled(false)
        setSystemLogEnabled(false)
    }
    
    // MARK: - SDK 特定日志方法
    
    /// SDK初始化日志
    /// - Parameter message: 消息
    public static func sdkInit(_ message: String) {
        info("🚀 [SDK_INIT] \(message)")
    }
    
    /// 配置相关日志
    /// - Parameter message: 消息
    public static func config(_ message: String) {
        debug("⚙️ [CONFIG] \(message)")
    }
    
    /// 网络请求日志
    /// - Parameter message: 消息
    public static func network(_ message: String) {
        debug("🌐 [NETWORK] \(message)")
    }
    
    /// 设备相关日志
    /// - Parameter message: 消息
    public static func device(_ message: String) {
        debug("📱 [DEVICE] \(message)")
    }
    
    /// 推送相关日志
    /// - Parameter message: 消息
    public static func push(_ message: String) {
        info("🔔 [PUSH] \(message)")
    }
    
    /// 存储相关日志
    /// - Parameter message: 消息
    public static func storage(_ message: String) {
        debug("💾 [STORAGE] \(message)")
    }
    
    // MARK: - 性能监控
    
    /// 性能监控开始
    /// - Parameter operation: 操作名称
    /// - Returns: 开始时间
    public static func performanceStart(_ operation: String) -> CFAbsoluteTime {
        let startTime = CFAbsoluteTimeGetCurrent()
        verbose("⏱️ [PERFORMANCE] \(operation) 开始")
        return startTime
    }
    
    /// 性能监控结束
    /// - Parameters:
    ///   - operation: 操作名称
    ///   - startTime: 开始时间
    public static func performanceEnd(_ operation: String, startTime: CFAbsoluteTime) {
        let duration = (CFAbsoluteTimeGetCurrent() - startTime) * 1000
        verbose("⏱️ [PERFORMANCE] \(operation) 完成，耗时: \(String(format: "%.2f", duration))ms")
    }
}

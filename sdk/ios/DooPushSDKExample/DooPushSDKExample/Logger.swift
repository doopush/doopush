import Foundation

/// 简化的日志管理类
public class Logger {
    
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
    }
    
    /// 单例实例
    public static let shared = Logger()
    
    /// 当前日志级别
    @objc public static var logLevel: LogLevel = .info
    
    /// 日志标签前缀
    private static let logPrefix = "[DooPushSDKExample]"
    
    /// 日志格式化器
    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        return formatter
    }()
    
    private init() {}
    
    // MARK: - 公共日志方法
    
    /// 详细日志
    @objc public static func verbose(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .verbose, message: message, file: file, function: function, line: line)
    }
    
    /// 调试日志
    @objc public static func debug(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .debug, message: message, file: file, function: function, line: line)
    }
    
    /// 信息日志
    @objc public static func info(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .info, message: message, file: file, function: function, line: line)
    }
    
    /// 警告日志
    @objc public static func warning(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .warning, message: message, file: file, function: function, line: line)
    }
    
    /// 错误日志
    @objc public static func error(
        _ message: String,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        shared.log(level: .error, message: message, file: file, function: function, line: line)
    }
    
    /// 错误日志（带Error对象）
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
        print("\(timestamp) \(logMessage)")
    }
}

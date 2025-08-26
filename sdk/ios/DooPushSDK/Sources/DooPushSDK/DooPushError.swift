import Foundation

/// DooPush SDK 错误枚举
@objc public enum DooPushError: Int, Error, LocalizedError, CaseIterable {
    
    // MARK: - 配置相关错误 (1000-1099)
    case notConfigured = 1000
    case invalidConfiguration = 1001
    case invalidURL = 1002
    
    // MARK: - 权限相关错误 (1100-1199)
    case pushPermissionDenied = 1100
    case pushPermissionNotDetermined = 1101
    case pushNotificationNotSupported = 1102
    
    // MARK: - 网络相关错误 (1200-1299)
    case networkError = 1200
    case invalidResponse = 1201
    case noData = 1202
    case badRequest = 1400
    case unauthorized = 1401
    case forbidden = 1403
    case notFound = 1404
    case validationError = 1422
    case serverError = 1500
    case httpError = 1999
    
    // MARK: - 数据处理相关错误 (1300-1399)
    case encodingError = 1300
    case decodingError = 1301
    case dataCorrupted = 1302
    
    // MARK: - 设备相关错误 (1600-1699)
    case deviceTokenInvalid = 1600
    case deviceRegistrationFailed = 1601
    case deviceUpdateFailed = 1602
    
    // MARK: - 通用错误 (1900-1999)
    case unknown = 1900
    case operationCancelled = 1901
    case timeout = 1902
    
    // MARK: - 错误描述
    
    public var errorDescription: String? {
        switch self {
        // 配置相关
        case .notConfigured:
            return "SDK未配置，请先调用configure方法"
        case .invalidConfiguration:
            return "SDK配置无效"
        case .invalidURL:
            return "URL格式无效"
            
        // 权限相关
        case .pushPermissionDenied:
            return "用户拒绝了推送通知权限"
        case .pushPermissionNotDetermined:
            return "推送通知权限未确定"
        case .pushNotificationNotSupported:
            return "设备不支持推送通知"
            
        // 网络相关
        case .networkError:
            return "网络连接失败"
        case .invalidResponse:
            return "服务器响应格式无效"
        case .noData:
            return "服务器未返回数据"
        case .badRequest:
            return "请求参数错误"
        case .unauthorized:
            return "API密钥无效或已过期"
        case .forbidden:
            return "访问被禁止，请检查应用权限"
        case .notFound:
            return "请求的资源不存在"
        case .validationError:
            return "请求数据验证失败"
        case .serverError:
            return "服务器内部错误"
        case .httpError:
            return "HTTP请求失败"
            
        // 数据处理相关
        case .encodingError:
            return "数据编码失败"
        case .decodingError:
            return "数据解码失败"
        case .dataCorrupted:
            return "数据已损坏"
            
        // 设备相关
        case .deviceTokenInvalid:
            return "设备Token无效"
        case .deviceRegistrationFailed:
            return "设备注册失败"
        case .deviceUpdateFailed:
            return "设备信息更新失败"
            
        // 通用错误
        case .unknown:
            return "未知错误"
        case .operationCancelled:
            return "操作已取消"
        case .timeout:
            return "操作超时"
        }
    }
    
    // MARK: - 错误代码
    
    /// 获取错误代码
    public var code: Int {
        return self.rawValue
    }
    
    // MARK: - 错误分类
    
    /// 是否为网络错误
    public var isNetworkError: Bool {
        return (1200...1299).contains(self.rawValue) || (1400...1599).contains(self.rawValue)
    }
    
    /// 是否为配置错误
    public var isConfigurationError: Bool {
        return (1000...1099).contains(self.rawValue)
    }
    
    /// 是否为权限错误
    public var isPermissionError: Bool {
        return (1100...1199).contains(self.rawValue)
    }
    
    /// 是否为数据处理错误
    public var isDataProcessingError: Bool {
        return (1300...1399).contains(self.rawValue)
    }
    
    /// 是否为设备相关错误
    public var isDeviceError: Bool {
        return (1600...1699).contains(self.rawValue)
    }
    
    // MARK: - 便利构造方法
    
    /// 从NSError创建DooPushError
    /// - Parameter error: NSError对象
    /// - Returns: DooPushError
    public static func from(_ error: Error) -> DooPushError {
        if let dooPushError = error as? DooPushError {
            return dooPushError
        }
        
        if let nsError = error as NSError? {
            // 根据NSError的domain和code映射到DooPushError
            switch nsError.domain {
            case NSURLErrorDomain:
                switch nsError.code {
                case NSURLErrorNotConnectedToInternet,
                     NSURLErrorNetworkConnectionLost:
                    return .networkError
                case NSURLErrorTimedOut:
                    return .timeout
                case NSURLErrorCancelled:
                    return .operationCancelled
                case NSURLErrorBadURL:
                    return .invalidURL
                default:
                    return .networkError
                }
            default:
                return .unknown
            }
        }
        
        return .unknown
    }
    
    /// 创建带有底层错误的DooPushError
    /// - Parameters:
    ///   - type: 错误类型
    ///   - underlyingError: 底层错误
    /// - Returns: NSError包装的DooPushError
    public static func networkError(_ underlyingError: Error) -> DooPushError {
        return DooPushError.from(underlyingError)
    }
    
    public static func encodingError(_ underlyingError: Error) -> DooPushError {
        return .encodingError
    }
    
    public static func decodingError(_ underlyingError: Error) -> DooPushError {
        return .decodingError
    }
    
    public static func validationError(_ message: String) -> DooPushError {
        if message != "" {
            DooPushLogger.error("服务器错误: \(message)")
        }
        return .validationError
    }
}

// MARK: - NSError 扩展

extension DooPushError {
    
    /// 转换为NSError
    public var nsError: NSError {
        return NSError(
            domain: "DooPushSDKErrorDomain",
            code: self.rawValue,
            userInfo: [
                NSLocalizedDescriptionKey: self.errorDescription ?? "Unknown error",
                "DooPushErrorCode": self.rawValue
            ]
        )
    }
}

// MARK: - 错误处理工具

/// 错误处理工具类
public class DooPushErrorHandler {
    
    /// 处理错误并提供用户友好的消息
    /// - Parameter error: 错误对象
    /// - Returns: 用户友好的错误消息
    public static func userFriendlyMessage(for error: Error) -> String {
        let dooPushError = DooPushError.from(error)
        
        switch dooPushError {
        case .notConfigured:
            return "SDK未正确配置，请联系开发者"
        case .pushPermissionDenied:
            return "请在设置中开启推送通知权限"
        case .networkError:
            return "网络连接失败，请检查网络设置"
        case .unauthorized:
            return "应用认证失败，请重新启动应用"
        case .serverError:
            return "服务暂时不可用，请稍后重试"
        default:
            return dooPushError.errorDescription ?? "操作失败，请重试"
        }
    }
    
    /// 检查错误是否可以重试
    /// - Parameter error: 错误对象
    /// - Returns: 是否可以重试
    public static func isRetryable(_ error: Error) -> Bool {
        let dooPushError = DooPushError.from(error)
        
        switch dooPushError {
        case .networkError, .timeout, .serverError:
            return true
        case .unauthorized, .forbidden, .notFound:
            return false
        case .badRequest, .validationError:
            return false
        case .notConfigured, .pushPermissionDenied:
            return false
        default:
            return false
        }
    }
    
    /// 获取建议的重试延时时间（秒）
    /// - Parameter error: 错误对象
    /// - Returns: 重试延时时间
    public static func retryDelay(for error: Error) -> TimeInterval {
        let dooPushError = DooPushError.from(error)
        
        switch dooPushError {
        case .networkError:
            return 2.0
        case .timeout:
            return 5.0
        case .serverError:
            return 10.0
        default:
            return 1.0
        }
    }
}

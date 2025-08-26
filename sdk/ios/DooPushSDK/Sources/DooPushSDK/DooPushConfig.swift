import Foundation

/// DooPush 配置类
@objc public class DooPushConfig: NSObject, Codable {
    /// 应用ID
    @objc public let appId: String
    
    /// API密钥
    @objc public let apiKey: String
    
    /// 服务器基础URL
    @objc public let baseURL: String
    
    /// 环境类型
    public let environment: DooPushEnvironment
    
    /// 初始化配置
    /// - Parameters:
    ///   - appId: 应用ID
    ///   - apiKey: API密钥
    ///   - baseURL: 服务器基础URL
    @objc public init(appId: String, apiKey: String, baseURL: String) {
        self.appId = appId
        self.apiKey = apiKey
        self.baseURL = baseURL
        
        // 根据URL判断环境类型
        if baseURL.contains("localhost") || baseURL.contains("127.0.0.1") {
            self.environment = .development
        } else if baseURL.contains("doopush.com") {
            self.environment = .production
        } else {
            self.environment = .custom(baseURL)
        }
        
        super.init()
    }
    
    // MARK: - Codable
    
    enum CodingKeys: String, CodingKey {
        case appId = "app_id"
        case apiKey = "api_key"
        case baseURL = "base_url"
        case environment = "environment"
    }
    
    required public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        self.appId = try container.decode(String.self, forKey: .appId)
        self.apiKey = try container.decode(String.self, forKey: .apiKey)
        self.baseURL = try container.decode(String.self, forKey: .baseURL)
        
        // 环境类型从baseURL推断
        if baseURL.contains("localhost") || baseURL.contains("127.0.0.1") {
            self.environment = .development
        } else if baseURL.contains("doopush.com") {
            self.environment = .production
        } else {
            self.environment = .custom(baseURL)
        }
        
        super.init()
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(appId, forKey: .appId)
        try container.encode(apiKey, forKey: .apiKey)
        try container.encode(baseURL, forKey: .baseURL)
        try container.encode(environment.rawValue, forKey: .environment)
    }
    
    // MARK: - 便利方法
    
    /// 获取完整的API URL
    /// - Parameter endpoint: 接口端点
    /// - Returns: 完整的API URL
    public func apiURL(for endpoint: String) -> String {
        let cleanBaseURL = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanEndpoint = endpoint.hasPrefix("/") ? String(endpoint.dropFirst()) : endpoint
        
        return "\(cleanBaseURL)/\(cleanEndpoint)"
    }
    
    /// 获取设备注册API URL
    public func deviceRegistrationURL() -> String {
        return apiURL(for: "apps/\(appId)/devices")
    }
    
    /// 验证配置是否有效
    public var isValid: Bool {
        return !appId.isEmpty && !apiKey.isEmpty && !baseURL.isEmpty
    }
    
    // MARK: - 调试信息
    
    public override var description: String {
        return """
        DooPushConfig:
        - AppID: \(appId)
        - BaseURL: \(baseURL)
        - Environment: \(environment)
        - Valid: \(isValid)
        """
    }
}

/// DooPush 环境类型
public enum DooPushEnvironment: Codable, CustomStringConvertible {
    case production      // 生产环境
    case development     // 开发环境
    case custom(String)  // 自定义环境
    
    public var rawValue: String {
        switch self {
        case .production:
            return "production"
        case .development:
            return "development"
        case .custom(let url):
            return "custom(\(url))"
        }
    }
    
    public var description: String {
        return rawValue
    }
    
    // MARK: - Codable
    
    enum CodingKeys: String, CodingKey {
        case type
        case value
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        
        switch type {
        case "production":
            self = .production
        case "development":
            self = .development
        case "custom":
            let value = try container.decode(String.self, forKey: .value)
            self = .custom(value)
        default:
            self = .production
        }
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        switch self {
        case .production:
            try container.encode("production", forKey: .type)
        case .development:
            try container.encode("development", forKey: .type)
        case .custom(let url):
            try container.encode("custom", forKey: .type)
            try container.encode(url, forKey: .value)
        }
    }
}

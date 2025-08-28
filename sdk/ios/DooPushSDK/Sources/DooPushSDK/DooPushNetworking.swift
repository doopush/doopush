import Foundation

/// 网络请求管理类
public class DooPushNetworking {
    
    /// 配置信息
    private var config: DooPushConfig?
    
    /// URL Session
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        return URLSession(configuration: configuration)
    }()
    
    /// 配置网络管理器
    /// - Parameter config: 配置信息
    public func configure(with config: DooPushConfig) {
        self.config = config
    }
    
    // MARK: - 设备注册相关
    
    /// 注册设备到服务器
    /// - Parameters:
    ///   - appId: 应用ID
    ///   - token: 设备token
    ///   - deviceInfo: 设备信息
    ///   - completion: 完成回调
    public func registerDevice(
        appId: String,
        token: String,
        deviceInfo: DeviceInfo,
        completion: @escaping (Result<DeviceRegistrationResponse, DooPushError>) -> Void
    ) {
        registerDeviceWithRetry(
            appId: appId,
            token: token,
            deviceInfo: deviceInfo,
            retryCount: 3,
            completion: completion
        )
    }
    
    /// 带重试机制的设备注册
    /// - Parameters:
    ///   - appId: 应用ID
    ///   - token: 设备token
    ///   - deviceInfo: 设备信息
    ///   - retryCount: 重试次数
    ///   - completion: 完成回调
    private func registerDeviceWithRetry(
        appId: String,
        token: String,
        deviceInfo: DeviceInfo,
        retryCount: Int,
        completion: @escaping (Result<DeviceRegistrationResponse, DooPushError>) -> Void
    ) {
        guard let config = config else {
            completion(.failure(.notConfigured))
            return
        }
        
        let url = config.deviceRegistrationURL()
        
        let requestBody = DeviceRegistrationRequest(
            token: token,
            bundleId: deviceInfo.bundleId,
            platform: deviceInfo.platform,
            channel: deviceInfo.channel,
            brand: deviceInfo.brand,
            model: deviceInfo.model,
            systemVersion: deviceInfo.systemVersion,
            appVersion: deviceInfo.appVersion,
            userAgent: deviceInfo.userAgent
        )
        
        performRequest(
            url: url,
            method: .POST,
            body: requestBody,
            responseType: DeviceRegistrationResponse.self
        ) { result in
            switch result {
            case .success(let response):
                completion(.success(response))
            case .failure(let error):
                // 检查是否可以重试
                if retryCount > 0 && self.shouldRetry(error: error) {
                    let delay = self.calculateRetryDelay(retryAttempt: 4 - retryCount)
                    DooPushLogger.warning("设备注册失败，\(delay)秒后重试: \(error)")
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                        self.registerDeviceWithRetry(
                            appId: appId,
                            token: token,
                            deviceInfo: deviceInfo,
                            retryCount: retryCount - 1,
                            completion: completion
                        )
                    }
                } else {
                    completion(.failure(error))
                }
            }
        }
    }
    
    /// 更新设备信息
    /// - Parameters:
    ///   - appId: 应用ID
    ///   - token: 设备token
    ///   - deviceInfo: 设备信息
    ///   - completion: 完成回调
    /// 注意：更新操作通过重新注册设备实现，后端会自动识别并更新现有设备
    public func updateDevice(
        appId: String,
        token: String,
        deviceInfo: DeviceInfo,
        completion: @escaping (Result<Void, DooPushError>) -> Void
    ) {
        // 使用注册接口进行更新（后端会自动处理已存在的token）
        registerDevice(appId: appId, token: token, deviceInfo: deviceInfo) { result in
            switch result {
            case .success:
                completion(.success(()))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
    
    // MARK: - 统计数据上报
    
    /// 上报推送统计数据
    /// - Parameters:
    ///   - appId: 应用ID
    ///   - deviceToken: 设备token
    ///   - events: 统计事件列表
    ///   - completion: 完成回调
    public func reportStatistics(
        appId: String,
        deviceToken: String,
        events: [StatisticsEvent],
        completion: @escaping (Result<Void, DooPushError>) -> Void
    ) {
        guard let config = config else {
            completion(.failure(.notConfigured))
            return
        }
        
        let url = config.statisticsReportURL()
        
        let requestBody = StatisticsReportRequest(
            deviceToken: deviceToken,
            statistics: events.map { event in
                StatisticsEventReport(
                    pushLogId: event.pushLogID,
                    dedupKey: event.dedupKey,
                    event: event.event.rawValue,
                    timestamp: event.timestamp
                )
            }
        )
        
        performVoidRequest(
            url: url,
            method: .POST,
            body: requestBody,
            completion: completion
        )
    }
    
    // MARK: - 通用请求方法
    
    /// HTTP 方法枚举
    private enum HTTPMethod: String {
        case GET = "GET"
        case POST = "POST"
        case PUT = "PUT"
        case DELETE = "DELETE"
    }
    
    /// 执行网络请求（有返回数据）
    /// - Parameters:
    ///   - url: 请求URL
    ///   - method: HTTP方法
    ///   - body: 请求体
    ///   - responseType: 响应数据类型
    ///   - completion: 完成回调
    private func performRequest<T: Codable, R: Codable>(
        url: String,
        method: HTTPMethod,
        body: T? = nil,
        responseType: R.Type,
        completion: @escaping (Result<R, DooPushError>) -> Void
    ) {
        guard let config = config else {
            completion(.failure(.notConfigured))
            return
        }
        
        guard let requestURL = URL(string: url) else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: requestURL)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("DooPushSDK/\(DooPushManager.sdkVersion)", forHTTPHeaderField: "User-Agent")
        request.setValue(config.apiKey, forHTTPHeaderField: "X-API-Key")
        
        // 设置请求体
        if let body = body {
            do {
                let jsonData = try JSONEncoder().encode(body)
                request.httpBody = jsonData
                
                DooPushLogger.debug("API请求: \(method.rawValue) \(url)")
                DooPushLogger.debug("请求体: \(String(data: jsonData, encoding: .utf8) ?? "")")
            } catch {
                completion(.failure(.encodingError(error)))
                return
            }
        }
        
        // 执行请求
        session.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                self.handleResponse(
                    data: data,
                    response: response,
                    error: error,
                    responseType: responseType,
                    completion: completion
                )
            }
        }.resume()
    }
    
    /// 执行网络请求（无返回数据）
    /// - Parameters:
    ///   - url: 请求URL
    ///   - method: HTTP方法
    ///   - body: 请求体
    ///   - completion: 完成回调
    private func performVoidRequest<T: Codable>(
        url: String,
        method: HTTPMethod,
        body: T? = nil,
        completion: @escaping (Result<Void, DooPushError>) -> Void
    ) {
        performRequest(
            url: url,
            method: method,
            body: body,
            responseType: VoidResponse.self
        ) { result in
            switch result {
            case .success:
                completion(.success(()))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
    
    /// 处理网络响应
    /// - Parameters:
    ///   - data: 响应数据
    ///   - response: HTTP响应
    ///   - error: 网络错误
    ///   - responseType: 响应数据类型
    ///   - completion: 完成回调
    private func handleResponse<R: Codable>(
        data: Data?,
        response: URLResponse?,
        error: Error?,
        responseType: R.Type,
        completion: @escaping (Result<R, DooPushError>) -> Void
    ) {
        // 处理网络错误
        if let error = error {
            DooPushLogger.error("网络请求失败: \(error)")
            completion(.failure(.networkError(error)))
            return
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            completion(.failure(.invalidResponse))
            return
        }
        
        guard let data = data else {
            completion(.failure(.noData))
            return
        }
        
        DooPushLogger.debug("API响应: HTTP \(httpResponse.statusCode)")
        DooPushLogger.debug("响应体: \(String(data: data, encoding: .utf8) ?? "")")
        
        // 处理HTTP状态码
        switch httpResponse.statusCode {
        case 200...299:
            // 成功响应
            do {
                if responseType == VoidResponse.self {
                    completion(.success(VoidResponse() as! R))
                } else {
                    let decoder = JSONDecoder()
                    // 不使用自动转换，而是通过CodingKeys手动控制
                    // decoder.keyDecodingStrategy = .convertFromSnakeCase
                    
                    // 尝试解析标准API响应格式
                    do {
                        let apiResponse = try decoder.decode(APIResponse<R>.self, from: data)
                        if let responseData = apiResponse.data {
                            DooPushLogger.debug("API响应解析成功 - Code: \(apiResponse.code), Message: \(apiResponse.message)")
                            completion(.success(responseData))
                        } else {
                            DooPushLogger.warning("API响应数据为空")
                            completion(.failure(.decodingError(NSError(domain: "NoData", code: 0, userInfo: [NSLocalizedDescriptionKey: "API响应数据为空"]))))
                        }
                    } catch {
                        DooPushLogger.debug("标准API格式解析失败，尝试直接解析: \(error)")
                        // 直接解析响应数据
                        let result = try decoder.decode(responseType, from: data)
                        completion(.success(result))
                    }
                }
            } catch {
                DooPushLogger.error("JSON解析失败: \(error)")
                completion(.failure(.decodingError(error)))
            }
            
        case 400:
            completion(.failure(.badRequest))
        case 401:
            completion(.failure(.unauthorized))
        case 403:
            completion(.failure(.forbidden))
        case 422:
            // 解析验证错误信息
            do {
                let decoder = JSONDecoder()
                // 尝试解析标准错误响应格式
                if let errorResponse = try? decoder.decode(APIResponse<Empty>.self, from: data) {
                    completion(.failure(.validationError(errorResponse.message)))
                } else if let simpleError = try? decoder.decode(ErrorResponse.self, from: data) {
                    completion(.failure(.validationError(simpleError.message)))
                } else {
                    // 如果都解析失败，使用原始响应
                    let errorMessage = String(data: data, encoding: .utf8) ?? "请求参数验证失败"
                    DooPushLogger.error("验证错误响应解析失败: \(errorMessage)")
                    completion(.failure(.validationError("请求参数验证失败: \(errorMessage)")))
                }
            }
        case 500...599:
            completion(.failure(.serverError))
        default:
            completion(.failure(.httpError))
        }
    }
    
    // MARK: - 重试机制
    
    /// 判断错误是否可以重试
    /// - Parameter error: 错误对象
    /// - Returns: 是否可以重试
    private func shouldRetry(error: DooPushError) -> Bool {
        switch error {
        case .networkError, .timeout, .serverError:
            return true
        case .badRequest, .unauthorized, .forbidden, .validationError:
            return false
        case .notFound:
            return false
        case .encodingError, .decodingError:
            return false
        default:
            return false
        }
    }
    
    /// 计算重试延时
    /// - Parameter retryAttempt: 重试次数（从1开始）
    /// - Returns: 延时时间（秒）
    private func calculateRetryDelay(retryAttempt: Int) -> TimeInterval {
        // 指数退避策略：1秒、2秒、4秒
        return pow(2.0, Double(retryAttempt - 1))
    }
}

// MARK: - 请求和响应数据结构

/// 设备注册请求
private struct DeviceRegistrationRequest: Codable {
    let token: String
    let bundleId: String
    let platform: String
    let channel: String
    let brand: String
    let model: String
    let systemVersion: String
    let appVersion: String
    let userAgent: String
    
    enum CodingKeys: String, CodingKey {
        case token
        case bundleId = "bundle_id"
        case platform
        case channel
        case brand
        case model
        case systemVersion = "system_version"
        case appVersion = "app_version"
        case userAgent = "user_agent"
    }
}



/// 设备响应信息
public struct DeviceResponseInfo: Codable {
    public let id: Int
    public let appId: Int
    public let token: String
    public let platform: String
    public let channel: String
    public let brand: String?
    public let model: String?
    public let systemVersion: String?
    public let appVersion: String?
    public let userAgent: String?
    public let status: Int
    public let lastSeen: String?
    public let createdAt: String
    public let updatedAt: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case appId = "app_id"
        case token
        case platform
        case channel
        case brand
        case model
        case systemVersion = "system_version"
        case appVersion = "app_version"
        case userAgent = "user_agent"
        case status
        case lastSeen = "last_seen"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
    
    /// 获取设备ID字符串形式（兼容旧版本）
    public var deviceId: String {
        return String(id)
    }
}

/// Gateway 配置响应
public struct GatewayConfigResponse: Codable {
    public let host: String
    public let port: Int
    public let ssl: Bool
    
    public init(host: String, port: Int, ssl: Bool) {
        self.host = host
        self.port = port
        self.ssl = ssl
    }
}

/// 设备注册响应（包含Gateway配置）
public struct DeviceRegistrationResponse: Codable {
    public let device: DeviceResponseInfo
    public let gateway: GatewayConfigResponse
    
    enum CodingKeys: String, CodingKey {
        case device
        case gateway
    }
    
    /// 获取设备ID字符串形式（兼容旧版本）
    public var id: Int {
        return device.id
    }
    
    /// 获取设备ID字符串形式（兼容旧版本）
    public var deviceId: String {
        return device.deviceId
    }
    
    /// 转换为 DooPushGatewayConfig
    public var gatewayConfig: DooPushGatewayConfig {
        return DooPushGatewayConfig(
            host: gateway.host,
            port: gateway.port,
            ssl: gateway.ssl
        )
    }
}

/// API标准响应格式
private struct APIResponse<T: Codable>: Codable {
    let code: Int
    let message: String
    let data: T?
}

/// 错误响应
private struct ErrorResponse: Codable {
    let code: Int
    let message: String
}

/// 空响应（用于无返回数据的请求）
private struct VoidResponse: Codable {}

/// 空数据结构（用于错误响应解析）
private struct Empty: Codable {}

// MARK: - 统计上报数据结构

/// 统计上报请求
private struct StatisticsReportRequest: Codable {
    let deviceToken: String
    let statistics: [StatisticsEventReport]
    
    enum CodingKeys: String, CodingKey {
        case deviceToken = "device_token"
        case statistics
    }
}

/// 统计事件上报
private struct StatisticsEventReport: Codable {
    let pushLogId: UInt?
    let dedupKey: String?
    let event: String
    let timestamp: Int64
    
    enum CodingKeys: String, CodingKey {
        case pushLogId = "push_log_id"
        case dedupKey = "dedup_key"
        case event
        case timestamp
    }
}

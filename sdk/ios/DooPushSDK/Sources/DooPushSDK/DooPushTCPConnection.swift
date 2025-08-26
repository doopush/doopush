import Foundation
import Network

/// TCP 连接状态
@objc public enum DooPushTCPState: Int {
    case disconnected = 0
    case connecting = 1
    case connected = 2
    case registering = 3
    case registered = 4
    case failed = 5
    
    /// 状态描述
    public var description: String {
        switch self {
        case .disconnected: return "已断开"
        case .connecting: return "连接中"
        case .connected: return "已连接"
        case .registering: return "注册中"
        case .registered: return "已注册"
        case .failed: return "连接失败"
        }
    }
}

/// Gateway 配置信息
public struct DooPushGatewayConfig: Codable {
    public let host: String
    public let port: Int
    public let ssl: Bool
    
    public init(host: String, port: Int, ssl: Bool = false) {
        self.host = host
        self.port = port
        self.ssl = ssl
    }
}

/// TCP 连接管理器
public class DooPushTCPConnection: NSObject {
    
    // MARK: - 属性
    
    /// Gateway 配置
    private var gatewayConfig: DooPushGatewayConfig?
    
    /// 应用配置
    private var appId: String?
    private var deviceToken: String?
    
    /// Network Framework 连接
    private var connection: NWConnection?
    private let queue = DispatchQueue(label: "com.doopush.tcp", qos: .userInitiated)
    
    /// 连接状态
    @objc public private(set) var state: DooPushTCPState = .disconnected {
        didSet {
            DispatchQueue.main.async {
                self.delegate?.tcpConnection(self, didChangeState: self.state)
            }
        }
    }
    
    /// 最后的错误信息
    @objc public private(set) var lastError: Error?
    
    /// 代理
    public weak var delegate: DooPushTCPConnectionDelegate?
    
    /// 心跳定时器
    private var heartbeatTimer: Timer?
    private let heartbeatInterval: TimeInterval = 30.0 // 30秒心跳
    
    /// 重连相关
    private var reconnectTimer: Timer?
    private var reconnectAttempts: Int = 0
    private let maxReconnectAttempts: Int = 0   // 最大重连次数，0表示一直重连
    private let maxReconnectDelay: TimeInterval = 15.0 // 最大重连延迟时间
    private var shouldReconnect: Bool = true
    
    /// 消息队列
    private var messageBuffer = Data()
    
    // MARK: - 初始化
    
    public override init() {
        super.init()
    }
    
    // MARK: - 公共方法
    
    /// 配置 Gateway 连接
    /// - Parameters:
    ///   - config: Gateway 配置
    ///   - appId: 应用ID
    ///   - deviceToken: 设备Token
    public func configure(config: DooPushGatewayConfig, appId: String, deviceToken: String) {
        self.gatewayConfig = config
        self.appId = appId
        self.deviceToken = deviceToken
        
        DooPushLogger.info("TCP连接已配置 - Host: \(config.host), Port: \(config.port), AppID: \(appId)")
    }
    
    /// 连接到 Gateway
    public func connect() {
        guard let config = gatewayConfig else {
            DooPushLogger.error("TCP连接未配置")
            lastError = DooPushError.notConfigured
            state = .failed
            return
        }
        
        disconnect() // 先断开现有连接
        
        DooPushLogger.info("正在连接到 Gateway - \(config.host):\(config.port)")
        state = .connecting
        
        // 创建连接
        let host = NWEndpoint.Host(config.host)
        let port = NWEndpoint.Port(integerLiteral: UInt16(config.port))
        let parameters: NWParameters = config.ssl ? .tls : .tcp
        
        connection = NWConnection(host: host, port: port, using: parameters)
        connection?.stateUpdateHandler = { [weak self] state in
            self?.handleConnectionStateChange(state)
        }
        
        // 启动连接
        connection?.start(queue: queue)
    }
    
    /// 断开连接
    public func disconnect() {
        shouldReconnect = false
        
        // 停止心跳
        stopHeartbeat()
        
        // 停止重连定时器
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        
        // 断开连接
        connection?.cancel()
        connection = nil
        
        state = .disconnected
        DooPushLogger.info("TCP连接已断开")
    }
    
    /// 发送消息
    /// - Parameter data: 消息数据
    private func sendMessage(_ data: Data) {
        guard let connection = connection, state == .connected || state == .registering || state == .registered else {
            DooPushLogger.warning("TCP连接未就绪，无法发送消息")
            return
        }
        
        connection.send(content: data, completion: .contentProcessed { [weak self] error in
            if let error = error {
                DooPushLogger.error("TCP消息发送失败: \(error)")
                self?.handleConnectionError(error)
            }
        })
    }
    
    // MARK: - 连接状态处理
    
    private func handleConnectionStateChange(_ connectionState: NWConnection.State) {
        switch connectionState {
        case .ready:
            DooPushLogger.info("TCP连接已建立")
            state = .connected
            reconnectAttempts = 0
            
            // 开始接收数据
            startReceiving()
            
            // 发送注册消息
            sendRegisterMessage()
            
        case .failed(let error):
            DooPushLogger.error("TCP连接失败: \(error)")
            lastError = error
            state = .failed
            scheduleReconnect()
            
        case .cancelled:
            DooPushLogger.info("TCP连接已取消")
            state = .disconnected
            
        case .waiting(let error):
            DooPushLogger.warning("TCP连接等待中: \(error)")
            lastError = error
            
        default:
            break
        }
    }
    
    private func handleConnectionError(_ error: Error) {
        DooPushLogger.error("TCP连接错误: \(error)")
        lastError = error
        state = .failed
        scheduleReconnect()
    }
    
    // MARK: - 数据接收
    
    private func startReceiving() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, context, isComplete, error in
            
            if let error = error {
                DooPushLogger.error("TCP数据接收失败: \(error)")
                self?.handleConnectionError(error)
                return
            }
            
            if let data = data, !data.isEmpty {
                self?.handleReceivedData(data)
            }
            
            if isComplete {
                DooPushLogger.info("TCP连接已完成")
                self?.state = .disconnected
                self?.scheduleReconnect()
            } else {
                // 继续接收
                self?.startReceiving()
            }
        }
    }
    
    private func handleReceivedData(_ data: Data) {
        messageBuffer.append(data)
        
        // 尝试解析消息
        while let message = parseMessage(from: &messageBuffer) {
            handleMessage(message)
        }
    }
    
    // MARK: - 消息处理
    
    private func parseMessage(from buffer: inout Data) -> DooPushTCPMessage? {
        // 简单的消息格式：[类型1字节][数据]
        guard buffer.count >= 1 else { return nil }
        
        let messageType = buffer[0]
        let messageData = buffer.count > 1 ? buffer.subdata(in: 1..<buffer.count) : Data()
        
        buffer = Data() // 清空缓冲区（简化处理）
        
        return DooPushTCPMessage(type: messageType, data: messageData)
    }
    
    private func handleMessage(_ message: DooPushTCPMessage) {
        switch message.type {
        case DooPushTCPMessage.MessageType.pong.rawValue:
            handlePongMessage(message)
        case DooPushTCPMessage.MessageType.ack.rawValue:
            handleAckMessage(message)
        case DooPushTCPMessage.MessageType.error.rawValue:
            handleErrorMessage(message)
        case DooPushTCPMessage.MessageType.push.rawValue:
            handlePushMessage(message)
        default:
            DooPushLogger.warning("收到未知消息类型: 0x\(String(format: "%02x", message.type))")
        }
    }
    
    private func handlePongMessage(_ message: DooPushTCPMessage) {
        DooPushLogger.debug("收到心跳响应")
        DispatchQueue.main.async {
            self.delegate?.tcpConnection(self, didReceiveHeartbeatResponse: message)
        }
    }
    
    private func handleAckMessage(_ message: DooPushTCPMessage) {
        DooPushLogger.info("收到注册确认")
        state = .registered
        
        // 开始心跳
        startHeartbeat()
        
        DispatchQueue.main.async {
            self.delegate?.tcpConnection(self, didRegisterSuccessfully: message)
        }
    }
    
    private func handleErrorMessage(_ message: DooPushTCPMessage) {
        let errorMessage = String(data: message.data, encoding: .utf8) ?? "未知错误"
        DooPushLogger.error("收到错误消息: \(errorMessage)")
        
        let error = DooPushError.serverError
        lastError = error
        state = .failed
        
        DispatchQueue.main.async {
            self.delegate?.tcpConnection(self, didReceiveError: error, message: errorMessage)
        }
    }
    
    private func handlePushMessage(_ message: DooPushTCPMessage) {
        DooPushLogger.info("收到推送消息")
        
        DispatchQueue.main.async {
            self.delegate?.tcpConnection(self, didReceivePushMessage: message)
        }
    }
    
    // MARK: - 消息发送
    
    private func sendRegisterMessage() {
        guard let appId = appId, let deviceToken = deviceToken else {
            DooPushLogger.error("应用ID或设备Token缺失")
            return
        }
        
        state = .registering
        
        // 构建注册消息 JSON
        let registerData: [String: Any] = [
            "app_id": Int(appId) ?? 0,
            "token": deviceToken,
            "platform": "ios"
        ]
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: registerData)
            var messageData = Data([DooPushTCPMessage.MessageType.register.rawValue])
            messageData.append(jsonData)
            
            sendMessage(messageData)
            DooPushLogger.info("已发送设备注册消息")
        } catch {
            DooPushLogger.error("注册消息序列化失败: \(error)")
        }
    }
    
    private func sendHeartbeat() {
        let heartbeatData = Data([DooPushTCPMessage.MessageType.ping.rawValue])
        sendMessage(heartbeatData)
        DooPushLogger.debug("已发送心跳消息")
    }
    
    // MARK: - 心跳管理
    
    private func startHeartbeat() {
        stopHeartbeat()
        
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatInterval, repeats: true) { [weak self] _ in
            self?.sendHeartbeat()
        }
        
        DooPushLogger.info("心跳定时器已启动，间隔: \(heartbeatInterval)秒")
    }
    
    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        DooPushLogger.debug("心跳定时器已停止")
    }
    
    // MARK: - 重连机制
    
    private func scheduleReconnect() {
        // 首先检查是否应该重连
        guard shouldReconnect else {
            return
        }
        
        // 再检查是否达到最大重连次数
        guard maxReconnectAttempts == 0 || reconnectAttempts < maxReconnectAttempts else {
            DooPushLogger.warning("已达到最大重连次数 (\(maxReconnectAttempts))，停止重连")
            return
        }
        
        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), maxReconnectDelay)
        
        DooPushLogger.info("将在 \(delay) 秒后尝试重连 (第\(reconnectAttempts)次)")
        
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.connect()
        }
    }
    
    // MARK: - 连接健康检查
    
    /// 检查连接是否健康
    /// - Returns: 连接是否可用
    private func isConnectionHealthy() -> Bool {
        guard let connection = connection else {
            DooPushLogger.debug("连接对象不存在")
            return false
        }
        
        // 检查底层连接状态
        switch connection.state {
        case .ready:
            DooPushLogger.debug("底层连接状态正常")
            return true
        case .failed(_), .cancelled:
            DooPushLogger.debug("底层连接已失效")
            return false
        case .waiting(_):
            DooPushLogger.debug("底层连接等待中")
            return false
        default:
            DooPushLogger.debug("底层连接状态未就绪")
            return false
        }
    }
    
    // MARK: - 应用生命周期
    
    /// 应用进入前台
    @objc public func applicationDidBecomeActive() {
        guard let _ = gatewayConfig else {
            DooPushLogger.info("应用进入前台，TCP连接未配置，不进行状态检查")
            return 
        }
        
        DooPushLogger.info("应用进入前台，当前连接状态: \(state.description)")
        
        // 检查连接状态，如果不是正常连接状态，则重连
        switch state {
        case .registered:
            // 已注册状态，检查连接是否真的可用
            DooPushLogger.info("连接已注册，验证连接健康状态")
            if !isConnectionHealthy() {
                DooPushLogger.warning("连接不健康，重新连接")
                shouldReconnect = true
                reconnectAttempts = 0
                connect()
            } else {
                // 重新启动心跳
                startHeartbeat()
                sendHeartbeat()
            }
            
        case .connected, .registering:
            // 连接中或注册中，等待完成
            DooPushLogger.info("连接进行中，等待完成")
            
        case .connecting:
            // 正在连接，可能需要重置
            DooPushLogger.info("连接超时，重新连接")
            shouldReconnect = true
            connect()
            
        default:
            // 断开、失败等状态，重新连接
            DooPushLogger.info("连接异常，重新建立连接")
            shouldReconnect = true
            reconnectAttempts = 0  // 重置重连次数
            connect()
        }
    }
    
    /// 应用进入后台
    @objc public func applicationWillResignActive() {
        DooPushLogger.info("应用进入后台，当前状态: \(state.description)")
        
        // iOS后台运行限制：停止心跳定时器节省资源
        // 连接可能会被系统断开，前台恢复时会重连
        stopHeartbeat()
        
        // 停止重连定时器
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        
        DooPushLogger.info("已停止心跳和重连定时器，等待前台恢复")
    }
    
    /// 应用即将终止
    @objc public func applicationWillTerminate() {
        disconnect()
    }
}

// MARK: - 代理协议

public protocol DooPushTCPConnectionDelegate: AnyObject {
    /// 连接状态变化
    func tcpConnection(_ connection: DooPushTCPConnection, didChangeState state: DooPushTCPState)
    
    /// 注册成功
    func tcpConnection(_ connection: DooPushTCPConnection, didRegisterSuccessfully message: DooPushTCPMessage)
    
    /// 收到错误
    func tcpConnection(_ connection: DooPushTCPConnection, didReceiveError error: Error, message: String)
    
    /// 收到心跳响应
    func tcpConnection(_ connection: DooPushTCPConnection, didReceiveHeartbeatResponse message: DooPushTCPMessage)
    
    /// 收到推送消息
    func tcpConnection(_ connection: DooPushTCPConnection, didReceivePushMessage message: DooPushTCPMessage)
}

// MARK: - TCP 消息结构

public struct DooPushTCPMessage {
    public let type: UInt8
    public let data: Data
    
    public enum MessageType: UInt8 {
        case ping = 0x01        // 心跳请求
        case pong = 0x02        // 心跳响应
        case register = 0x03    // 设备注册
        case ack = 0x04         // 注册确认
        case push = 0x05        // 推送消息
        case error = 0xFF       // 错误消息
    }
    
    public init(type: UInt8, data: Data) {
        self.type = type
        self.data = data
    }
}

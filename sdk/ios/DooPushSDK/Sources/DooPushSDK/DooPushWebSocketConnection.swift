import Foundation

/// 维护设备到平台的 WebSocket 长连接。
/// 仅承担握手鉴权 + 心跳维持，无应用层消息。
public final class DooPushWebSocketConnection: NSObject {
    public protocol Listener: AnyObject {
        func wsDidOpen()
        func wsDidClose(code: Int, reason: String?)
        func wsDidFail(_ error: Error)
    }

    private let baseUrl: String
    private let appId: String
    private let appKey: String
    private let token: String
    public weak var listener: Listener?

    private var session: URLSession!
    private var pingTimer: DispatchSourceTimer?
    private let stateQueue = DispatchQueue(label: "com.doopush.ws.state")
    private var _active = false
    private var active: Bool {
        get { stateQueue.sync { _active } }
        set { stateQueue.sync { _active = newValue } }
    }
    // 当前连接 task。读写均经 stateQueue 串行化，确保终结时的"认领"是原子的。
    private var _task: URLSessionWebSocketTask?
    private var task: URLSessionWebSocketTask? {
        get { stateQueue.sync { _task } }
        set { stateQueue.sync { _task = newValue } }
    }
    private var reconnectDelay: TimeInterval = 1
    private let maxReconnectDelay: TimeInterval = 15
    private var _reconnectPending = false  // 单飞：是否已有待执行的重连
    private var openSinceMs: TimeInterval = 0  // 用于稳态退避重置

    public init(baseUrl: String, appId: String, appKey: String, token: String) {
        self.baseUrl = baseUrl
        self.appId = appId
        self.appKey = appKey
        self.token = token
        super.init()
        // iOS 的 URLSessionWebSocketTask 在 .default 会话/连接复用下，对部分服务端（如 Cloudflare 前置）
        // 易出现 -1005「network connection was lost」，而同网络下 OkHttp/Node 均稳定。
        // 用 ephemeral 干净会话 + 等待连通性 + 扩展空闲，贴近其它客户端「每次干净连接」的行为。
        let cfg = URLSessionConfiguration.ephemeral
        cfg.waitsForConnectivity = true
        cfg.shouldUseExtendedBackgroundIdleMode = true
        // 心跳 30s，这里给足余量，避免「无数据超时」在心跳间隙误掐连接（仅靠 30s Ping 保活）
        cfg.timeoutIntervalForRequest = 300
        self.session = URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
    }

    public func connect() {
        guard !active else { return }
        active = true
        startTask()
    }

    public func disconnect() {
        active = false
        pingTimer?.cancel()
        pingTimer = nil
        // 先清空当前 task，确保随后到达的关闭/失败回调无法再"认领"（避免自断开触发重连/事件）
        let t = task
        task = nil
        t?.cancel(with: .goingAway, reason: nil)
    }

    /// 是否处于活跃状态（已 connect 且未 disconnect）。供上层前台守卫判断是否需要新建连接。
    public var isActive: Bool { active }

    /// 前台唤醒：仅当活跃、且当前既无连接也无在途重连时，立即拉起一次重连。
    /// 用于回前台时复用已有连接对象、避免重复新建连接触发服务端 4001 替换。
    public func reconnectIfNeeded() {
        guard active else { return }
        let needsKick: Bool = stateQueue.sync {
            guard _task == nil, !_reconnectPending else { return false }
            return true
        }
        guard needsKick else { return }
        reconnectDelay = 1
        scheduleReconnect()
    }

    private func startTask() {
        guard let url = makeURL() else { return }
        var req = URLRequest(url: url)
        // 标记为「呼叫信令」类长连接：提示系统这是需要长期保活的控制通道，
        // 降低系统/链路过早回收连接导致 -1005 的概率。
        req.networkServiceType = .callSignaling
        let t = session.webSocketTask(with: req)
        // 单飞：已存在连接则不重复创建，丢弃刚建的 task
        let installed: Bool = stateQueue.sync {
            guard _task == nil else { return false }
            _task = t
            return true
        }
        guard installed else { return }
        t.resume()
        readLoop(t)
        startPing()
    }

    private func makeURL() -> URL? {
        // 严格用 URLComponents 解析 + 重组，剥离 baseUrl 中可能携带的路径
        // 例如 baseUrl = "https://doopush.com/api/v1" → "wss://doopush.com/ws"
        guard let comp = URLComponents(string: baseUrl) else { return nil }
        var out = URLComponents()
        out.scheme = (comp.scheme?.lowercased() == "https") ? "wss" : "ws"
        out.host = comp.host
        out.port = comp.port
        out.path = "/ws"
        out.queryItems = [
            URLQueryItem(name: "appid", value: appId),
            URLQueryItem(name: "appkey", value: appKey),
            URLQueryItem(name: "token", value: token),
        ]
        return out.url
    }

    private func readLoop(_ t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            guard let self = self else { return }
            // 仅当本次 receive 的 task 仍是当前 task 时才响应；
            // 否则说明旧 task 已被 reconnect/disconnect 替换，回调过期
            guard t === self.task else { return }
            switch result {
            case .failure(let err):
                self.handleFailure(err, task: t)
            case .success:
                // 应用层消息预留，本期忽略
                self.readLoop(t)
            }
        }
    }

    private func startPing() {
        pingTimer?.cancel()
        let timer = DispatchSource.makeTimerSource()
        timer.schedule(deadline: .now() + 30, repeating: 30)
        timer.setEventHandler { [weak self] in
            guard let self = self else { return }
            let t = self.task
            t?.sendPing { [weak self] err in
                if let err = err { self?.handleFailure(err, task: t) }
            }
        }
        timer.resume()
        pingTimer = timer
    }

    /// 原子地"认领"某个连接的终结：仅当传入 task 仍是当前 task 时清空并返回 true。
    /// 同一次断连可能从多条回调路径（receive 失败、didCompleteWithError、didCloseWith）到达，
    /// 由此保证每个连接只被终结一次，避免重复上报与重复重连。
    private func claimDeath(of t: URLSessionWebSocketTask?) -> Bool {
        stateQueue.sync {
            guard let t = t, t === _task else { return false }
            _task = nil
            return true
        }
    }

    private func handleFailure(_ error: Error, task t: URLSessionWebSocketTask?) {
        // 只有成功认领本连接终结的那一次回调才继续处理
        guard claimDeath(of: t) else { return }
        pingTimer?.cancel()
        pingTimer = nil
        guard active else { return }
        DispatchQueue.main.async { [weak self] in
            self?.listener?.wsDidFail(error)
        }
        // 鉴权失败 (HTTP 4xx) 不重连，由上层重新 register 拿新 token
        // （无论 receive 失败还是 didCompleteWithError 先到，都以此为准）
        if let resp = t?.response as? HTTPURLResponse, (400..<500).contains(resp.statusCode) {
            return
        }
        scheduleReconnect()
    }

    private func maybeResetBackoff() {
        let now = Date().timeIntervalSince1970
        let openedFor = now - openSinceMs
        // 至少稳定 30s 才视为正常运行，重置退避
        if openSinceMs > 0 && openedFor >= 30 {
            reconnectDelay = 1
        }
        openSinceMs = 0
    }

    private func scheduleReconnect() {
        // 单飞：同一时刻只允许一个待执行的重连，避免竞态下叠加多条连接
        let shouldSchedule: Bool = stateQueue.sync {
            guard !_reconnectPending else { return false }
            _reconnectPending = true
            return true
        }
        guard shouldSchedule else { return }
        let delay = reconnectDelay
        reconnectDelay = min(reconnectDelay * 2, maxReconnectDelay)
        DispatchQueue.global().asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self else { return }
            let proceed: Bool = self.stateQueue.sync {
                self._reconnectPending = false
                return self._active
            }
            guard proceed else { return }
            self.startTask()
        }
    }
}

extension DooPushWebSocketConnection: URLSessionWebSocketDelegate {
    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol p: String?) {
        openSinceMs = Date().timeIntervalSince1970
        DispatchQueue.main.async { [weak self] in
            self?.listener?.wsDidOpen()
        }
    }

    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith code: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        // 认领本连接终结；若已被 receive 失败/disconnect 等路径处理则忽略，避免重复
        guard claimDeath(of: webSocketTask) else { return }
        pingTimer?.cancel()
        pingTimer = nil
        let reasonStr = reason.flatMap { String(data: $0, encoding: .utf8) }
        maybeResetBackoff()
        let raw = code.rawValue
        let stillActive = active
        DispatchQueue.main.async { [weak self] in
            self?.listener?.wsDidClose(code: raw, reason: reasonStr)
        }
        // 不重连：4001 被新连挤掉、1000/1001 正常关闭
        if stillActive && raw != 4001 && raw != 1000 && raw != 1001 {
            scheduleReconnect()
        }
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let wt = task as? URLSessionWebSocketTask else { return }
        // 鉴权失败 (HTTP 4xx) 不重连，由上层重新 register 拿新 token
        if let resp = wt.response as? HTTPURLResponse, (400..<500).contains(resp.statusCode) {
            guard claimDeath(of: wt) else { return }
            pingTimer?.cancel()
            pingTimer = nil
            let status = resp.statusCode
            DispatchQueue.main.async { [weak self] in
                self?.listener?.wsDidFail(error ?? NSError(domain: "DooPushWS", code: status, userInfo: [NSLocalizedDescriptionKey: "auth failed: HTTP \(status)"]))
            }
            return
        }
        // 其他失败：交给 handleFailure（内部认领，去重 receive 与本回调的双重触发）
        if let error = error {
            handleFailure(error, task: wt)
        }
    }
}

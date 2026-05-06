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
    private var task: URLSessionWebSocketTask?
    private var pingTimer: DispatchSourceTimer?
    private let stateQueue = DispatchQueue(label: "com.doopush.ws.state")
    private var _active = false
    private var active: Bool {
        get { stateQueue.sync { _active } }
        set { stateQueue.sync { _active = newValue } }
    }
    private var reconnectDelay: TimeInterval = 1
    private let maxReconnectDelay: TimeInterval = 15
    private var openSinceMs: TimeInterval = 0  // 用于稳态退避重置

    public init(baseUrl: String, appId: String, appKey: String, token: String) {
        self.baseUrl = baseUrl
        self.appId = appId
        self.appKey = appKey
        self.token = token
        super.init()
        let cfg = URLSessionConfiguration.default
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
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func startTask() {
        guard let url = makeURL() else { return }
        let t = session.webSocketTask(with: url)
        task = t
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
                self.handleFailure(err)
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
            self?.task?.sendPing { err in
                if let err = err { self?.handleFailure(err) }
            }
        }
        timer.resume()
        pingTimer = timer
    }

    private func handleFailure(_ error: Error) {
        guard active else { return }
        DispatchQueue.main.async { [weak self] in
            self?.listener?.wsDidFail(error)
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
        let delay = reconnectDelay
        reconnectDelay = min(reconnectDelay * 2, maxReconnectDelay)
        DispatchQueue.global().asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self, self.active else { return }
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
        // 只关心当前 task 的失败
        guard let wt = task as? URLSessionWebSocketTask, wt === self.task else { return }
        // 鉴权失败 (HTTP 4xx) 不重连，由上层重新 register 拿新 token
        if let resp = wt.response as? HTTPURLResponse, (400..<500).contains(resp.statusCode) {
            DispatchQueue.main.async { [weak self] in
                self?.listener?.wsDidFail(error ?? NSError(domain: "DooPushWS", code: resp.statusCode, userInfo: [NSLocalizedDescriptionKey: "auth failed: HTTP \(resp.statusCode)"]))
            }
            return
        }
        // 其他失败：交给 handleFailure 走重连
        if let error = error {
            handleFailure(error)
        }
    }
}

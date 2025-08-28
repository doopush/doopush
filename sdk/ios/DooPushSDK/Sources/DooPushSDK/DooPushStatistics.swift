import Foundation
import UIKit

/// 推送统计管理类
public class DooPushStatistics {
    
    /// 单例实例
    public static let shared = DooPushStatistics()
    
    /// 本地存储
    private lazy var storage = DooPushStorage()
    
    /// 网络管理器
    private var networking: DooPushNetworking?
    
    /// 配置信息
    private var config: DooPushConfig?
    
    /// 待上报的统计数据
    private var pendingEvents: [StatisticsEvent] = []
    
    /// 线程锁
    private let eventLock = NSLock()
    
    /// 上报定时器
    private var reportTimer: Timer?
    
    /// 上报中的标记，避免并发重复上报
    private var isReporting: Bool = false
    private let reportingLock = NSLock()
    
    private init() {
        setupApplicationObservers()
        loadPendingEvents()
        scheduleReporting()
    }
    
    // MARK: - 配置管理
    
    /// 配置统计管理器
    /// - Parameters:
    ///   - config: 配置信息
    ///   - networking: 网络管理器
    public func configure(config: DooPushConfig, networking: DooPushNetworking) {
        self.config = config
        self.networking = networking
    }
    
    // MARK: - 事件记录
    
    /// 记录推送接收事件
    /// - Parameters:
    ///   - pushData: 推送数据
    ///   - userInfo: 通知用户信息
    public func recordNotificationReceived(pushData: DooPushNotificationData, userInfo: [AnyHashable: Any]) {
        DooPushLogger.info("推送接收统计记录: \(pushData)")
        
        // 这里可以记录推送到达统计，目前项目重点关注点击和打开
        // 可以在后续扩展时添加到达率统计
    }
    
    /// 记录推送点击事件
    /// - Parameters:
    ///   - pushData: 推送数据
    ///   - userInfo: 通知用户信息
    public func recordNotificationClick(pushData: DooPushNotificationData, userInfo: [AnyHashable: Any]) {
        DooPushLogger.info("推送点击统计记录: \(pushData)")
        
        let event = StatisticsEvent(
            pushLogID: pushData.pushLogID,
            dedupKey: pushData.dedupKey,
            event: .click,
            timestamp: Int64(Date().timeIntervalSince1970)
        )
        
        addEvent(event)
    }
    
    /// 记录应用打开事件（因推送引起）
    /// - Parameters:
    ///   - pushData: 推送数据
    ///   - userInfo: 通知用户信息
    public func recordNotificationOpen(pushData: DooPushNotificationData, userInfo: [AnyHashable: Any]) {
        DooPushLogger.info("推送打开统计记录: \(pushData)")
        
        let event = StatisticsEvent(
            pushLogID: pushData.pushLogID,
            dedupKey: pushData.dedupKey,
            event: .open,
            timestamp: Int64(Date().timeIntervalSince1970)
        )
        
        addEvent(event)
    }
    
    /// 添加统计事件到队列
    /// - Parameter event: 统计事件
    private func addEvent(_ event: StatisticsEvent) {
        eventLock.lock()
        defer { eventLock.unlock() }
        
        // 避免重复事件（基于去重键和事件类型）
        let duplicateExists = pendingEvents.contains { existingEvent in
            existingEvent.dedupKey == event.dedupKey && 
            existingEvent.event == event.event
        }
        
        if !duplicateExists {
            pendingEvents.append(event)
            savePendingEvents()
            
            DooPushLogger.debug("统计事件已添加到队列: \(event)")
            
            // 如果事件数量超过阈值，立即上报
            if pendingEvents.count >= 10 {
                reportPendingEvents()
            }
        } else {
            DooPushLogger.debug("重复统计事件，跳过: \(event)")
        }
    }
    
    // MARK: - 数据上报
    
    /// 立即上报所有待处理的统计事件
    public func reportPendingEvents() {
        // 并发保护：避免重复上报
        reportingLock.lock()
        if isReporting {
            reportingLock.unlock()
            return
        }
        isReporting = true
        reportingLock.unlock()

        guard let config = config,
              let networking = networking else {
            DooPushLogger.debug("配置缺失，无法上报统计数据")
            reportingLock.lock(); isReporting = false; reportingLock.unlock()
            return
        }

        // 拷贝事件快照
        eventLock.lock()
        let eventsToReport = Array(pendingEvents)
        eventLock.unlock()

        guard !eventsToReport.isEmpty else {
            reportingLock.lock(); isReporting = false; reportingLock.unlock()
            return
        }

        DooPushLogger.info("开始上报 \(eventsToReport.count) 个统计事件")

        // 获取设备token
        guard let deviceToken = storage.getDeviceToken() else {
            DooPushLogger.warning("设备token缺失，无法上报统计数据")
            reportingLock.lock(); isReporting = false; reportingLock.unlock()
            return
        }

        networking.reportStatistics(
            appId: config.appId,
            deviceToken: deviceToken,
            events: eventsToReport
        ) { [weak self] result in
            self?.handleReportResult(result: result, reportedEvents: eventsToReport)
            // 重置上报标记
            self?.reportingLock.lock(); self?.isReporting = false; self?.reportingLock.unlock()
        }
    }
    
    /// 处理上报结果
    /// - Parameters:
    ///   - result: 上报结果
    ///   - reportedEvents: 已上报的事件
    private func handleReportResult(result: Result<Void, DooPushError>, reportedEvents: [StatisticsEvent]) {
        switch result {
        case .success:
            DooPushLogger.info("统计数据上报成功，移除 \(reportedEvents.count) 个事件")
            
            eventLock.lock()
            // 移除已成功上报的事件
            pendingEvents.removeAll { reportedEvent in
                reportedEvents.contains { $0.id == reportedEvent.id }
            }
            savePendingEvents()
            eventLock.unlock()
            
        case .failure(let error):
            DooPushLogger.error("统计数据上报失败: \(error)")
            
            // 对于某些错误类型，可能需要丢弃事件避免无限重试
            if case .badRequest = error {
                DooPushLogger.warning("统计数据格式错误，丢弃这批事件")
                eventLock.lock()
                pendingEvents.removeAll { reportedEvent in
                    reportedEvents.contains { $0.id == reportedEvent.id }
                }
                savePendingEvents()
                eventLock.unlock()
            }
        }
    }
    
    // MARK: - 定时上报
    
    /// 设置定时上报
    private func scheduleReporting() {
        // 防止重复创建多个定时器
        if reportTimer != nil { return }
        // 每30秒检查一次是否需要上报
        reportTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.reportPendingEvents()
        }
    }
    
    /// 停止定时上报
    private func stopReporting() {
        reportTimer?.invalidate()
        reportTimer = nil
    }
    
    // MARK: - 数据持久化
    
    /// 保存待上报事件到本地
    private func savePendingEvents() {
        do {
            let data = try JSONEncoder().encode(pendingEvents)
            UserDefaults.standard.set(data, forKey: "DooPushPendingStatistics")
            DooPushLogger.debug("已保存 \(pendingEvents.count) 个待上报统计事件")
        } catch {
            DooPushLogger.error("保存待上报统计事件失败: \(error)")
        }
    }
    
    /// 从本地加载待上报事件
    private func loadPendingEvents() {
        guard let data = UserDefaults.standard.data(forKey: "DooPushPendingStatistics") else {
            DooPushLogger.debug("没有本地缓存的统计事件")
            return
        }
        
        do {
            pendingEvents = try JSONDecoder().decode([StatisticsEvent].self, from: data)
            DooPushLogger.info("加载了 \(pendingEvents.count) 个本地缓存的统计事件")
        } catch {
            DooPushLogger.error("加载本地统计事件失败: \(error)")
            pendingEvents = []
        }
    }
    
    // MARK: - 应用生命周期处理
    
    /// 设置应用生命周期观察者
    private func setupApplicationObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillTerminate),
            name: UIApplication.willTerminateNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }
    
    @objc private func applicationWillTerminate() {
        DooPushLogger.info("应用即将终止，上报统计数据")
        reportPendingEvents()
        stopReporting()
    }
    
    @objc private func applicationDidEnterBackground() {
        DooPushLogger.info("应用进入后台，上报统计数据")
        // 进入后台先停止定时器，避免回到前台后重复定时
        stopReporting()
        reportPendingEvents()
    }
    
    @objc private func applicationDidBecomeActive() {
        DooPushLogger.info("应用变为活跃，恢复统计上报")
        scheduleReporting()
    }
    
    // MARK: - 清理
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        stopReporting()
    }
}

// MARK: - 数据结构

/// 统计事件类型
public enum StatisticsEventType: String, Codable {
    case click = "click"    // 点击推送
    case open = "open"      // 打开应用
}

/// 统计事件
public struct StatisticsEvent: Codable {
    /// 唯一标识符
    public let id: String
    
    /// 推送日志ID
    public let pushLogID: UInt?
    
    /// 去重键
    public let dedupKey: String?
    
    /// 事件类型
    public let event: StatisticsEventType
    
    /// 事件发生时间戳
    public let timestamp: Int64
    
    public init(pushLogID: UInt? = nil, dedupKey: String? = nil, event: StatisticsEventType, timestamp: Int64) {
        self.id = UUID().uuidString
        self.pushLogID = pushLogID
        self.dedupKey = dedupKey
        self.event = event
        self.timestamp = timestamp
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case pushLogID = "push_log_id"
        case dedupKey = "dedup_key"
        case event
        case timestamp
    }
}

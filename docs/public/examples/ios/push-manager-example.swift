import DooPushSDK
import UserNotifications

class PushNotificationManager: NSObject, ObservableObject {
    static let shared = PushNotificationManager()
    
    @Published var isRegistered = false
    @Published var deviceToken: String?
    @Published var deviceId: String?
    @Published var lastError: Error?
    
    override init() {
        super.init()
        setupSDK()
    }
    
    private func setupSDK() {
        // 配置 DooPush SDK
        DooPushManager.shared.configure(
            appId: "your_app_id_here",
            apiKey: "your_api_key_here"
        )
        
        // 设置代理
        DooPushManager.shared.delegate = self
        
        // 设置通知中心代理
        UNUserNotificationCenter.current().delegate = self
    }
    
    func registerForPushNotifications() {
        DooPushManager.shared.registerForPushNotifications { [weak self] token, error in
            DispatchQueue.main.async {
                if let token = token {
                    self?.deviceToken = token
                    self?.isRegistered = true
                    print("✅ 推送注册成功: \(token)")
                } else if let error = error {
                    self?.lastError = error
                    print("❌ 推送注册失败: \(error.localizedDescription)")
                }
            }
        }
    }
    
    func setBadgeNumber(_ number: Int) {
        DooPushManager.shared.setBadgeNumber(number)
    }
    
    func clearBadge() {
        DooPushManager.shared.clearBadge()
    }
}

// MARK: - DooPushDelegate
extension PushNotificationManager: DooPushDelegate {
    
    func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String) {
        DispatchQueue.main.async {
            self.deviceToken = token
            self.deviceId = manager.deviceId
            self.isRegistered = true
            print("✅ 设备注册成功: \(token)")
        }
    }
    
    func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any]) {
        print("📱 接收到推送通知")
        
        // 解析推送内容
        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: Any] {
            let title = alert["title"] as? String
            let body = alert["body"] as? String
            print("推送内容: \(title ?? "") - \(body ?? "")")
        }
        
        // 处理自定义载荷
        if let customData = userInfo["custom_data"] as? [String: Any] {
            print("自定义数据: \(customData)")
        }
    }
    
    func dooPush(_ manager: DooPushManager, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.lastError = error
            print("❌ 推送服务错误: \(error.localizedDescription)")
        }
    }
    
    func dooPushDidUpdateDeviceInfo(_ manager: DooPushManager) {
        DispatchQueue.main.async {
            self.deviceId = manager.deviceId
            print("🔄 设备信息已更新")
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension PushNotificationManager: UNUserNotificationCenterDelegate {
    
    // 应用在前台时收到通知
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }
    
    // 用户点击通知时调用
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        
        // 处理推送点击
        handleNotificationTap(userInfo: userInfo)
        
        completionHandler()
    }
    
    private func handleNotificationTap(userInfo: [AnyHashable: Any]) {
        // 处理自定义操作
        if let customData = userInfo["custom_data"] as? [String: Any],
           let action = customData["action"] as? String {
            
            switch action {
            case "open_page":
                if let page = customData["page"] as? String {
                    print("📱 打开页面: \(page)")
                    // 导航到指定页面
                }
            case "open_url":
                if let urlString = customData["url"] as? String,
                   let url = URL(string: urlString) {
                    print("🔗 打开链接: \(url)")
                    // 打开外部链接
                }
            default:
                print("🤷‍♂️ 未知操作: \(action)")
            }
        }
    }
}

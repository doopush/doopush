import Foundation
import UserNotifications

/// 内部代理：拦截通知回调并转发给原始代理
final class DooPushNotificationProxy: NSObject, UNUserNotificationCenterDelegate {
    weak var original: UNUserNotificationCenterDelegate?

    init(original: UNUserNotificationCenterDelegate?) {
        self.original = original
    }

    // 前台收到推送
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo
        _ = DooPushManager.shared.handleNotification(userInfo)

        if let original = original as? NSObjectProtocol,
           original.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
            (original as? UNUserNotificationCenterDelegate)?.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            if #available(iOS 14.0, *) {
                completionHandler([.banner, .sound, .badge])
            } else {
                completionHandler([.alert, .sound, .badge])
            }
        }
    }

    // 用户与推送交互
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        switch response.actionIdentifier {
        case UNNotificationDefaultActionIdentifier:
            _ = DooPushManager.shared.handleNotificationClick(userInfo)
            _ = DooPushManager.shared.handleNotificationOpen(userInfo)
        case UNNotificationDismissActionIdentifier:
            _ = DooPushManager.shared.handleNotificationClick(userInfo)
        default:
            _ = DooPushManager.shared.handleNotificationClick(userInfo)
        }

        if let original = original as? NSObjectProtocol,
           original.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
            (original as? UNUserNotificationCenterDelegate)?.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }
}

// 保持强引用，避免被释放
private var dooPushNotificationProxy: DooPushNotificationProxy?

public extension DooPushManager {
    /// 启用自动采集通知事件（点击/打开），并转发给原始代理
    @objc public func enableAutomaticNotificationTracking() {
        let center = UNUserNotificationCenter.current()
        // 避免重复包裹代理
        if center.delegate is DooPushNotificationProxy {
            DooPushLogger.debug("自动通知事件采集已启用，跳过重复设置")
            return
        }
        let current = center.delegate
        let proxy = DooPushNotificationProxy(original: current)
        dooPushNotificationProxy = proxy
        center.delegate = proxy
        DooPushLogger.info("已启用自动通知事件采集，并代理原始通知回调")
    }

    /// 关闭自动采集并还原原始代理
    @objc public func disableAutomaticNotificationTracking() {
        let center = UNUserNotificationCenter.current()
        center.delegate = dooPushNotificationProxy?.original
        dooPushNotificationProxy = nil
        DooPushLogger.info("已关闭自动通知事件采集，并还原通知代理")
    }
}



import ExpoModulesCore
import DooPushSDK
import UIKit

/**
 * Forwards UIApplicationDelegate push-notification callbacks from the
 * Expo-managed AppDelegate to DooPush iOS SDK.
 *
 * Without this, the APNs device token never reaches DooPushManager and
 * `DooPush.register()` hangs forever after the user grants permission.
 */
public class DooPushAppDelegateSubscriber: ExpoAppDelegateSubscriber {

    public func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        DooPushManager.shared.didRegisterForRemoteNotifications(with: deviceToken)
    }

    public func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        DooPushManager.shared.didFailToRegisterForRemoteNotifications(with: error)
    }

    public func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        _ = DooPushManager.shared.handleNotification(userInfo)
        completionHandler(.newData)
    }
}

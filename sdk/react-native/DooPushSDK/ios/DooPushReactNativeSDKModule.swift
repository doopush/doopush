import ExpoModulesCore
import DooPushSDK
import UserNotifications

/**
 * DooPush React Native SDK — iOS bridge
 * v0.1.0 alpha
 *
 * Mode: ACTIVE (default) — DooPush owns UNUserNotificationCenterDelegate via the
 * delegate-forwarding mechanism added in DooPushSDK v1.1.0. Coexists with
 * expo-notifications because both delegates forward to each other.
 */
public class DooPushReactNativeSDKModule: Module, DooPushDelegate {

    public func definition() -> ModuleDefinition {
        Name("DooPushReactNativeSDK")

        Events("onRegister", "onRegisterError", "onMessage")

        OnCreate {
            // Wire DooPush's delegate to this module so we can forward events to JS.
            DooPushManager.shared.delegate = self
        }

        // ── configure ───────────────────────────────────────────────────
        Function("configure") { (config: [String: Any]) in
            guard let appId = config["appId"] as? String,
                  let apiKey = config["apiKey"] as? String else {
                throw NSError(
                    domain: "DooPushReactNativeSDK",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "configure requires appId + apiKey"]
                )
            }
            let baseURL = (config["baseURL"] as? String) ?? ""
            DooPushManager.shared.configure(appId: appId, apiKey: apiKey, baseURL: baseURL)

            // Always enable automatic notification tracking for active mode (default).
            DooPushManager.shared.enableAutomaticNotificationTracking()
        }

        // ── register ────────────────────────────────────────────────────
        AsyncFunction("register") { (promise: Promise) in
            DooPushManager.shared.registerForPushNotifications { token, error in
                if let error = error {
                    promise.reject("E_REGISTER", error.localizedDescription)
                    return
                }
                guard let token = token else {
                    promise.reject("E_REGISTER", "Unknown failure: no token returned")
                    return
                }
                let deviceId = DooPushManager.shared.getDeviceId() ?? ""
                promise.resolve([
                    "token": token,
                    "deviceId": deviceId,
                    "vendor": "apns"
                ])
            }
        }

        // ── registerWithToken ───────────────────────────────────────────
        AsyncFunction("registerWithToken") { (token: String, vendor: String, promise: Promise) in
            DooPushManager.shared.registerDevice(withToken: token, vendor: vendor) { deviceId, error in
                if let error = error {
                    promise.reject("E_REGISTER", error.localizedDescription)
                    return
                }
                promise.resolve(["deviceId": deviceId ?? ""])
            }
        }

        // ── token getters ───────────────────────────────────────────────
        AsyncFunction("getDeviceToken") { () -> String? in
            return DooPushManager.shared.getDeviceToken()
        }

        AsyncFunction("getDeviceId") { () -> String? in
            return DooPushManager.shared.getDeviceId()
        }
    }

    // MARK: - DooPushDelegate

    public func dooPush(_ manager: DooPushManager, didRegisterWithToken token: String) {
        sendEvent("onRegister", [
            "token": token,
            "deviceId": manager.getDeviceId() ?? "",
            "vendor": "apns"
        ])
    }

    public func dooPush(_ manager: DooPushManager, didReceiveNotification userInfo: [AnyHashable: Any]) {
        sendEvent("onMessage", normalizeMessage(userInfo))
    }

    public func dooPush(_ manager: DooPushManager, didFailWithError error: Error) {
        sendEvent("onRegisterError", [
            "code": "E_REGISTER",
            "message": error.localizedDescription
        ])
    }

    // MARK: - Helpers

    /// Convert APNs userInfo into the JS-side DooPushMessage shape.
    private func normalizeMessage(_ userInfo: [AnyHashable: Any]) -> [String: Any] {
        var data: [String: String] = [:]
        var title: String?
        var body: String?
        for (k, v) in userInfo {
            guard let key = k as? String else { continue }
            if key == "aps", let aps = v as? [String: Any], let alert = aps["alert"] as? [String: Any] {
                title = alert["title"] as? String
                body = alert["body"] as? String
                continue
            }
            if let s = v as? String {
                data[key] = s
            } else {
                data[key] = "\(v)"
            }
        }
        return [
            "vendor": "apns",
            "title": title as Any,
            "body": body as Any,
            "messageId": userInfo["apns-id"] as? String as Any,
            "pushLogId": data["push_log_id"] as Any,
            "dedupKey": data["dedup_key"] as Any,
            "data": data
        ]
    }
}

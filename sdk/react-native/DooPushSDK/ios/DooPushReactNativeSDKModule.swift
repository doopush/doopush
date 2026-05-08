import ExpoModulesCore
import DooPushSDK
import UserNotifications

/**
 * DooPush React Native SDK — iOS bridge
 * v0.5.0
 *
 * Mode: ACTIVE (default) — DooPush owns UNUserNotificationCenterDelegate via the
 * delegate-forwarding mechanism in DooPushSDK. Coexists with
 * expo-notifications because both delegates forward to each other.
 */
public class DooPushReactNativeSDKModule: Module, DooPushDelegate {

    public func definition() -> ModuleDefinition {
        Name("DooPushReactNativeSDK")

        Events(
            "onRegister",
            "onRegisterError",
            "onMessage",
            "onNotificationClick",
            "onNotificationOpen",
            "onGatewayOpen",
            "onGatewayClosed",
            "onGatewayError"
        )

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
            let allowedVendors: Set<String> = ["apns", "fcm", "hms", "honor", "xiaomi", "oppo", "vivo", "meizu"]
            guard allowedVendors.contains(vendor.lowercased()) else {
                promise.reject("E_INVALID_VENDOR", "vendor must be one of: \(allowedVendors.sorted().joined(separator: ", "))")
                return
            }
            DooPushManager.shared.registerDevice(withToken: token, vendor: vendor.lowercased()) { deviceId, error in
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

        AsyncFunction("getDeviceInfo") { () -> [String: Any] in
            return normalizeDeviceInfo(DooPushManager.shared.getDeviceInfo())
        }

        AsyncFunction("updateDeviceInfo") { (promise: Promise) in
            DooPushManager.shared.updateDeviceInfo()
            promise.resolve(nil)
        }

        AsyncFunction("reportStatistics") { (promise: Promise) in
            DooPushManager.shared.reportStatistics()
            promise.resolve(nil)
        }

        AsyncFunction("checkPermissionStatus") { (promise: Promise) in
            DooPushManager.shared.checkPushPermissionStatus { status in
                promise.resolve(self.normalizePermissionStatus(status))
            }
        }

        AsyncFunction("setBadge") { (count: Int, promise: Promise) in
            guard count >= 0 else {
                promise.reject("E_BADGE", "badge count must be >= 0")
                return
            }
            DooPushManager.shared.setBadgeNumber(count) { error in
                if let error = error {
                    promise.reject("E_BADGE", error.localizedDescription)
                } else {
                    promise.resolve(true)
                }
            }
        }

        AsyncFunction("clearBadge") { (promise: Promise) in
            DooPushManager.shared.clearBadge { error in
                if let error = error {
                    promise.reject("E_BADGE", error.localizedDescription)
                } else {
                    promise.resolve(true)
                }
            }
        }

        AsyncFunction("getBadge") { () -> Int in
            return DooPushManager.shared.getCurrentBadgeNumber()
        }

        // ── notification management / coexistence ───────────────────────
        Function("setNotificationManagementMode") { (mode: String) in
            switch mode.lowercased() {
            case "active":
                DooPushManager.shared.setNotificationManagementMode(.active)
                DooPushManager.shared.enableAutomaticNotificationTracking()
            case "passive":
                DooPushManager.shared.setNotificationManagementMode(.passive)
                DooPushManager.shared.disableAutomaticNotificationTracking()
            default:
                throw NSError(
                    domain: "DooPushReactNativeSDK",
                    code: -2,
                    userInfo: [NSLocalizedDescriptionKey: "mode must be 'active' or 'passive'"]
                )
            }
        }

        Function("setExpoNotificationRelayEnabled") { (_ enabled: Bool) in
            // iOS uses UNUserNotificationCenter delegate forwarding; no explicit relay flag is needed.
        }

        Function("setNotificationDisplayEnabled") { (enabled: Bool) in
            // iOS notification presentation is controlled by UNUserNotificationCenter and APNs.
            // Keep this API as a no-op for cross-platform compatibility; use
            // setNotificationManagementMode('passive') to disable DooPush delegate tracking.
            NSLog("[DooPushReactNativeSDK] setNotificationDisplayEnabled(\(enabled)) is a no-op on iOS")
        }

        AsyncFunction("connectGateway") { (promise: Promise) in
            guard DooPushManager.shared.getDeviceToken()?.isEmpty == false else {
                promise.reject("E_GATEWAY", "device token is required before connecting gateway")
                return
            }
            DooPushManager.shared.connectWebSocket()
            promise.resolve(nil)
        }

        AsyncFunction("disconnectGateway") { (promise: Promise) in
            DooPushManager.shared.disconnectWebSocket()
            promise.resolve(nil)
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

    public func dooPush(_ manager: DooPushManager, didClickNotification userInfo: [AnyHashable: Any]) {
        sendEvent("onNotificationClick", normalizeMessage(userInfo))
    }

    public func dooPush(_ manager: DooPushManager, didOpenNotification userInfo: [AnyHashable: Any]) {
        sendEvent("onNotificationOpen", normalizeMessage(userInfo))
    }

    public func dooPushGatewayDidOpen(_ manager: DooPushManager) {
        sendEvent("onGatewayOpen", ["connected": true])
    }

    public func dooPush(_ manager: DooPushManager, gatewayDidCloseWithCode code: Int, reason: String?) {
        var payload: [String: Any] = ["code": code]
        if let reason = reason {
            payload["reason"] = reason
        }
        sendEvent("onGatewayClosed", payload)
    }

    public func dooPush(_ manager: DooPushManager, gatewayDidFailWithError error: Error) {
        sendEvent("onGatewayError", [
            "code": "E_GATEWAY",
            "message": error.localizedDescription
        ])
    }

    // MARK: - Helpers


    private func normalizeDeviceInfo(_ deviceInfo: DeviceInfo) -> [String: Any] {
        return [
            "platform": deviceInfo.platform,
            "channel": deviceInfo.channel,
            "bundleId": deviceInfo.bundleId,
            "brand": deviceInfo.brand,
            "model": deviceInfo.model,
            "systemVersion": deviceInfo.systemVersion,
            "appVersion": deviceInfo.appVersion,
            "userAgent": deviceInfo.userAgent
        ]
    }

    private func normalizePermissionStatus(_ status: UNAuthorizationStatus) -> String {
        if #available(iOS 14.0, *), status == .ephemeral {
            return "ephemeral"
        }

        switch status {
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .notDetermined:
            return "notDetermined"
        case .provisional:
            return "provisional"
        @unknown default:
            return "unknown"
        }
    }

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

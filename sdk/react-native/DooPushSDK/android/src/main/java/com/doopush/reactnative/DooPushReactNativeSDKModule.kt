package com.doopush.reactnative

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.doopush.sdk.DooPushCallback
import com.doopush.sdk.DooPushManager
import com.doopush.sdk.DooPushNotificationHandler
import com.doopush.sdk.DooPushRegisterCallback
import com.doopush.sdk.DooPushRegisterResult
import com.doopush.sdk.models.DooPushError
import com.doopush.sdk.models.PushMessage
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * DooPush React Native SDK — Android bridge
 * v0.5.0
 *
 * Mode: ACTIVE (default) — DooPush owns FCM display via DooPushFirebaseMessagingService.
 * Coexistence with expo-notifications/react-native-firebase is exposed through
 * notification-management / relay APIs.
 */
class DooPushReactNativeSDKModule : Module(), DooPushCallback {

    override fun definition() = ModuleDefinition {
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
            DooPushManager.getInstance().setCallback(this@DooPushReactNativeSDKModule)
        }

        // ── configure ───────────────────────────────────────────────────
        Function("configure") { config: Map<String, Any> ->
            val appId = config["appId"] as? String
                ?: throw IllegalArgumentException("configure requires appId")
            val apiKey = config["apiKey"] as? String
                ?: throw IllegalArgumentException("configure requires apiKey")
            val baseURL = config["baseURL"] as? String
            val context = appContext.reactContext
                ?: throw IllegalStateException("React context unavailable")
            if (baseURL.isNullOrBlank()) {
                DooPushManager.getInstance().configure(context, appId, apiKey)
            } else {
                DooPushManager.getInstance().configure(context, appId, apiKey, baseURL)
            }
        }

        // ── register ────────────────────────────────────────────────────
        AsyncFunction("register") { promise: Promise ->
            DooPushManager.getInstance().registerForPushNotifications(
                object : DooPushRegisterCallback {
                    override fun onSuccess(token: String) {
                        // Compatibility fallback for older native SDK callback dispatch.
                        promise.resolve(mapOf(
                            "token" to token,
                            "deviceId" to (DooPushManager.getInstance().getDeviceId() ?: ""),
                            "vendor" to currentVendor()
                        ))
                    }
                    override fun onSuccess(result: DooPushRegisterResult) {
                        promise.resolve(mapOf(
                            "token" to result.token,
                            "deviceId" to result.deviceId,
                            "vendor" to normalizeVendor(result.vendor)
                        ))
                    }
                    override fun onError(error: DooPushError) {
                        promise.reject("E_REGISTER", error.message ?: "register failed", null)
                    }
                }
            )
        }

        // ── registerWithToken ───────────────────────────────────────────
        AsyncFunction("registerWithToken") { token: String, vendor: String, promise: Promise ->
            DooPushManager.getInstance().registerDevice(
                token = token,
                vendor = vendor,
                callback = object : DooPushRegisterCallback {
                    override fun onSuccess(t: String) {
                        promise.resolve(mapOf("deviceId" to (DooPushManager.getInstance().getDeviceId() ?: "")))
                    }
                    override fun onSuccess(result: DooPushRegisterResult) {
                        promise.resolve(mapOf("deviceId" to result.deviceId))
                    }
                    override fun onError(error: DooPushError) {
                        promise.reject("E_REGISTER", error.message ?: "register failed", null)
                    }
                }
            )
        }

        // ── token getters ───────────────────────────────────────────────
        AsyncFunction("getDeviceToken") { ->
            DooPushManager.getInstance().getDeviceToken()
        }

        AsyncFunction("getDeviceId") { ->
            DooPushManager.getInstance().getDeviceId()
        }

        AsyncFunction("getDeviceInfo") { ->
            DooPushManager.getInstance().getDeviceInfo()?.let { deviceInfo ->
                mapOf(
                    "platform" to deviceInfo.platform,
                    "channel" to normalizeVendor(deviceInfo.channel),
                    "bundleId" to deviceInfo.bundleId,
                    "brand" to deviceInfo.brand,
                    "model" to deviceInfo.model,
                    "systemVersion" to deviceInfo.systemVersion,
                    "appVersion" to deviceInfo.appVersion,
                    "userAgent" to deviceInfo.userAgent
                )
            }
        }

        AsyncFunction("updateDeviceInfo") { promise: Promise ->
            DooPushManager.getInstance().updateDeviceInfo { success, error ->
                if (success) {
                    promise.resolve(null)
                } else {
                    promise.reject("E_UPDATE_DEVICE_INFO", error?.message ?: "updateDeviceInfo failed", null)
                }
            }
        }

        AsyncFunction("reportStatistics") { ->
            DooPushManager.getInstance().reportStatistics()
        }

        AsyncFunction("checkPermissionStatus") { ->
            checkPermissionStatus()
        }

        AsyncFunction("setBadge") { count: Int, promise: Promise ->
            if (count < 0) {
                promise.reject("E_BADGE", "badge count must be >= 0", null)
            } else {
                promise.resolve(DooPushManager.getInstance().setBadgeCount(count))
            }
        }

        AsyncFunction("clearBadge") { ->
            DooPushManager.getInstance().clearBadge()
        }

        AsyncFunction("getBadge") { ->
            DooPushManager.getInstance().getBadgeCount()
        }

        // ── notification management / coexistence ───────────────────────
        Function("setNotificationManagementMode") { mode: String ->
            val manager = DooPushManager.getInstance()
            val resolved = when (mode.lowercase()) {
                "active" -> DooPushManager.NotificationManagementMode.ACTIVE
                "passive" -> DooPushManager.NotificationManagementMode.PASSIVE
                else -> throw IllegalArgumentException("mode must be 'active' or 'passive'")
            }
            manager.setNotificationManagementMode(resolved)
            // Keep relay independent: callers may opt into Expo relay in either mode.
            manager.setFCMNotificationDisplayEnabled(
                resolved == DooPushManager.NotificationManagementMode.ACTIVE
            )
        }

        Function("setExpoNotificationRelayEnabled") { enabled: Boolean ->
            DooPushManager.getInstance().setExpoNotificationRelayEnabled(enabled)
        }

        Function("setNotificationDisplayEnabled") { enabled: Boolean ->
            DooPushManager.getInstance().setFCMNotificationDisplayEnabled(enabled)
        }

        AsyncFunction("connectGateway") { promise: Promise ->
            if (DooPushManager.getInstance().getDeviceToken().isNullOrBlank()) {
                promise.reject("E_GATEWAY", "device token is required before connecting gateway", null)
            } else {
                DooPushManager.getInstance().connectWebSocket()
                promise.resolve(null)
            }
        }

        AsyncFunction("disconnectGateway") { promise: Promise ->
            DooPushManager.getInstance().disconnectWebSocket()
            promise.resolve(null)
        }
    }

    // MARK: - DooPushCallback

    override fun onRegisterSuccess(token: String) {
        sendEvent("onRegister", mapOf(
            "token" to token,
            "deviceId" to (DooPushManager.getInstance().getDeviceId() ?: ""),
            "vendor" to currentVendor()
        ))
    }

    override fun onRegisterSuccess(result: DooPushRegisterResult) {
        sendEvent("onRegister", mapOf(
            "token" to result.token,
            "deviceId" to result.deviceId,
            "vendor" to normalizeVendor(result.vendor)
        ))
    }

    override fun onRegisterError(error: DooPushError) {
        sendEvent("onRegisterError", mapOf(
            "code" to "E_REGISTER",
            "message" to (error.message ?: "register failed")
        ))
    }

    override fun onMessageReceived(message: PushMessage) {
        sendEvent("onMessage", mapOf(
            "vendor" to currentVendor(),
            "title" to message.getDisplayTitle(),
            "body" to message.getDisplayBody(),
            "pushLogId" to message.pushLogId,
            "dedupKey" to message.dedupKey,
            "messageId" to message.messageId,
            "data" to message.data
        ))
    }

    // Direct token-fetch callbacks are not part of the RN v0.5.0 surface; apps consume
    // register/registerWithToken plus onRegister/onRegisterError/onMessage events.
    override fun onTokenReceived(token: String) {
        // No-op.
    }

    override fun onTokenError(error: DooPushError) {
        // No-op.
    }

    override fun onNotificationClick(notificationData: DooPushNotificationHandler.NotificationData) {
        sendEvent("onNotificationClick", normalizeNotification(notificationData))
    }

    override fun onNotificationOpen(notificationData: DooPushNotificationHandler.NotificationData) {
        sendEvent("onNotificationOpen", normalizeNotification(notificationData))
    }

    override fun onWebSocketOpen() {
        sendEvent("onGatewayOpen", mapOf("connected" to true))
    }

    override fun onWebSocketClosed(code: Int, reason: String) {
        sendEvent("onGatewayClosed", mapOf("code" to code, "reason" to reason))
    }

    override fun onWebSocketFailure(t: Throwable) {
        sendEvent("onGatewayError", mapOf(
            "code" to "E_GATEWAY",
            "message" to (t.message ?: "WebSocket failure")
        ))
    }

    private fun normalizeNotification(
        notificationData: DooPushNotificationHandler.NotificationData
    ): Map<String, Any?> = mapOf(
        "vendor" to currentVendor(),
        "title" to notificationData.title,
        "body" to notificationData.body,
        "pushLogId" to notificationData.pushLogId,
        "dedupKey" to notificationData.dedupKey,
        "data" to notificationData.payload.mapValues { it.value.toString() }
    )

    private fun currentVendor(): String =
        normalizeVendor(DooPushManager.getInstance().getCurrentVendor() ?: "fcm")

    private fun checkPermissionStatus(): String {
        val context = appContext.reactContext ?: return "unknown"
        val notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        if (!notificationsEnabled) return "denied"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            return if (granted) "authorized" else "denied"
        }

        return "authorized"
    }

    private fun normalizeVendor(vendor: String): String =
        if (vendor == "huawei") "hms" else vendor
}

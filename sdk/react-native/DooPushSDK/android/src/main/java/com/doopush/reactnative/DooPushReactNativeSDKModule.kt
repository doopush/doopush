package com.doopush.reactnative

import com.doopush.sdk.DooPushCallback
import com.doopush.sdk.DooPushManager
import com.doopush.sdk.DooPushNotificationHandler
import com.doopush.sdk.DooPushRegisterCallback
import com.doopush.sdk.models.DooPushError
import com.doopush.sdk.models.PushMessage
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * DooPush React Native SDK — Android bridge
 * v0.1.0 alpha
 *
 * Mode: ACTIVE (default) — DooPush owns FCM display via DooPushFirebaseMessagingService.
 * Coexistence with expo-notifications/react-native-firebase is via the relay broadcast
 * (opt-in by host app calling setExpoNotificationRelayEnabled(true) from JS — not exposed in v0.1).
 */
class DooPushReactNativeSDKModule : Module(), DooPushCallback {

    override fun definition() = ModuleDefinition {
        Name("DooPushReactNativeSDK")

        Events("onRegister", "onRegisterError", "onMessage")

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
                        promise.resolve(mapOf(
                            "token" to token,
                            "deviceId" to (DooPushManager.getInstance().run {
                                // Try to read deviceId via reflection / public getter; v1.1.0 doesn't expose
                                // a public getDeviceId(), so we fall back to empty string for v0.1.0.
                                // TODO P3: expose getDeviceId() on Android Manager parity with iOS.
                                ""
                            }),
                            "vendor" to currentVendor()
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
                        promise.resolve(mapOf("deviceId" to ""))  // TODO P3: real deviceId
                    }
                    override fun onError(error: DooPushError) {
                        promise.reject("E_REGISTER", error.message ?: "register failed", null)
                    }
                }
            )
        }

        // ── token getters ───────────────────────────────────────────────
        AsyncFunction("getDeviceToken") { ->
            // Android SDK v1.1.0 doesn't expose a public getDeviceToken() — return null in v0.1.
            // TODO P3: add public getter on Android Manager and wire here.
            null as String?
        }

        AsyncFunction("getDeviceId") { ->
            null as String?  // same TODO
        }
    }

    // MARK: - DooPushCallback

    override fun onRegisterSuccess(token: String) {
        sendEvent("onRegister", mapOf(
            "token" to token,
            "deviceId" to "",  // TODO P3
            "vendor" to currentVendor()
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

    // The DooPushCallback interface (v1.1.0) has additional non-default abstract methods
    // that the plan code didn't list. Implement them as no-ops for v0.1.0 — surfacing
    // direct token-fetch results to JS isn't part of the v0.1 surface (the JS layer only
    // consumes onRegister/onRegisterError/onMessage). v0.5.0 may surface these.
    override fun onTokenReceived(token: String) {
        // No-op: not surfaced in v0.1.0.
    }

    override fun onTokenError(error: DooPushError) {
        // No-op: not surfaced in v0.1.0.
    }

    override fun onNotificationClick(notificationData: DooPushNotificationHandler.NotificationData) {
        // v0.5.0 will surface this as onNotificationClick. For v0.1, ignored.
    }

    /** Best-effort vendor inference for v0.1 (default fcm). v0.5.0 will read from active vendor state. */
    private fun currentVendor(): String = "fcm"
}

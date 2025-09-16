package com.doopush.sdk

import android.content.Context
import android.util.Log
import java.util.HashMap
import com.vivo.push.model.UnvarnishedMessage
import com.vivo.push.model.UPSNotificationMessage
import com.vivo.push.sdk.OpenClientPushMessageReceiver

/**
 * Android BroadcastReceiver bridge for Vivo push callbacks.
 *
 * Delegates Vivo SDK callbacks to the internal BaseVivoPushMessageReceiver so the
 * rest of the SDK can stay decoupled from vendor classes.
 */
class DooPushVivoMessageReceiver : OpenClientPushMessageReceiver() {

    companion object {
        private const val TAG = "DooPushVivoReceiver"

        @Volatile
        private var lastKnownContext: Context? = null

        private fun rememberContext(context: Context) {
            lastKnownContext = context.applicationContext
        }

        private fun resolveContext(fallback: Context? = null): Context? {
            return fallback
                ?: lastKnownContext
                ?: DooPushManager.getInstance().getApplicationContext()
        }

        private fun copyParams(params: Map<String, String>?): Map<String, String>? {
            return params?.let { HashMap(it) }
        }
    }

    private val delegate: BaseVivoPushMessageReceiver = object : BaseVivoPushMessageReceiver() {}

    override fun onReceiveRegId(context: Context, regId: String?) {
        rememberContext(context)
        delegate.onReceiveRegId(context, regId)
    }

    override fun onTransmissionMessage(context: Context, message: UnvarnishedMessage) {
        rememberContext(context)
        val payload = message.message ?: message.unpackToJson()
        delegate.onTransmissionMessage(context, payload)
    }

    override fun onNotificationMessageClicked(context: Context, message: UPSNotificationMessage) {
        rememberContext(context)
        delegate.onNotificationMessageClicked(context, message.title, message.content, copyParams(message.params))
    }

    override fun onForegroundMessageArrived(message: UPSNotificationMessage) {
        val context = resolveContext()
        if (context == null) {
            Log.w(TAG, "Foreground message arrived without context. Skip processing to avoid crashes.")
            return
        }
        delegate.onForegroundMessageArrived(context, message.title, message.content, copyParams(message.params))
    }

}

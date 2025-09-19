package com.doopush.DooPushSDKExample

import android.content.Context
import com.doopush.sdk.MeizuPushReceiver
import com.meizu.cloud.pushsdk.MzPushMessageReceiver
import com.meizu.cloud.pushsdk.handler.MzPushMessage
import com.meizu.cloud.pushsdk.platform.message.RegisterStatus

class MeizuPushMessageReceiver : MzPushMessageReceiver() {

    override fun onRegisterStatus(context: Context, status: RegisterStatus?) {
        val pushId = status?.pushId
        MeizuPushReceiver.onPushIdReceived(context, pushId)
    }

    override fun onMessage(context: Context, message: String?, platformExtra: String?) {
        MeizuPushReceiver.onTransparentMessage(context, message)
    }

    override fun onNotificationArrived(context: Context, pushMessage: MzPushMessage?) {
        MeizuPushReceiver.onNotificationArrived(
            context,
            pushMessage?.title,
            pushMessage?.content,
            pushMessage?.selfDefineContentString
        )
    }

    override fun onNotificationClicked(context: Context, pushMessage: MzPushMessage?) {
        MeizuPushReceiver.onNotificationClicked(
            context,
            pushMessage?.title,
            pushMessage?.content,
            pushMessage?.selfDefineContentString
        )
    }

    override fun onNotificationDeleted(context: Context, pushMessage: MzPushMessage?) {
        MeizuPushReceiver.onNotificationDeleted(
            context,
            pushMessage?.title,
            pushMessage?.content,
            pushMessage?.selfDefineContentString
        )
    }
}

package com.doopush.sdk

import android.content.Context
import com.meizu.cloud.pushsdk.MzPushMessageReceiver
import com.meizu.cloud.pushsdk.handler.MzPushMessage
import com.meizu.cloud.pushsdk.platform.message.RegisterStatus

/**
 * Android BroadcastReceiver bridge for Meizu push callbacks.
 *
 * 魅族推送服务通过 Manifest 中声明的 MzPushMessageReceiver 回传 PushId 与消息，缺少时注册拿不到 PushId。
 * 已在 SDK Manifest 中声明（category 为宿主 applicationId），宿主无需再注册自己的接收器（否则回调会重复）。
 */
class DooPushMeizuMessageReceiver : MzPushMessageReceiver() {

    private val delegate: BaseMeizuPushMessageReceiver = object : BaseMeizuPushMessageReceiver() {}

    override fun onRegisterStatus(context: Context, status: RegisterStatus?) {
        delegate.onPushIdReceived(context, status?.pushId)
    }

    override fun onMessage(context: Context, message: String?, platformExtra: String?) {
        delegate.onTransparentMessage(context, message)
    }

    override fun onNotificationArrived(context: Context, pushMessage: MzPushMessage?) {
        delegate.onNotificationArrived(context, pushMessage?.title, pushMessage?.content, pushMessage?.selfDefineContentString)
    }

    override fun onNotificationClicked(context: Context, pushMessage: MzPushMessage?) {
        delegate.onNotificationClicked(context, pushMessage?.title, pushMessage?.content, pushMessage?.selfDefineContentString)
    }

    override fun onNotificationDeleted(context: Context, pushMessage: MzPushMessage?) {
        delegate.onNotificationDeleted(context, pushMessage?.title, pushMessage?.content, pushMessage?.selfDefineContentString)
    }
}

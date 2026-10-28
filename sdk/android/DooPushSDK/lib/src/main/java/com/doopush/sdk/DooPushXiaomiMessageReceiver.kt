package com.doopush.sdk

import android.content.Context
import com.xiaomi.mipush.sdk.MiPushCommandMessage
import com.xiaomi.mipush.sdk.MiPushMessage
import com.xiaomi.mipush.sdk.PushMessageReceiver

/**
 * Android BroadcastReceiver bridge for Xiaomi push callbacks.
 *
 * 小米系统推送服务只会把注册结果和消息投递给继承 PushMessageReceiver 且在 Manifest 中声明的接收器；
 * 缺少时日志为 "we can see the app, but we can't see the receiver"，注册拿不到 RegId 而超时。
 * 已在 SDK Manifest 中声明，宿主无需再注册自己的接收器（否则回调会重复）。
 */
class DooPushXiaomiMessageReceiver : PushMessageReceiver() {

    private val delegate: BaseMiPushMessageReceiver = object : BaseMiPushMessageReceiver() {}

    override fun onReceivePassThroughMessage(context: Context?, message: MiPushMessage?) {
        if (context != null && message != null) delegate.onReceivePassThroughMessage(context, message)
    }

    override fun onNotificationMessageClicked(context: Context?, message: MiPushMessage?) {
        if (context != null && message != null) delegate.onNotificationMessageClicked(context, message)
    }

    override fun onNotificationMessageArrived(context: Context?, message: MiPushMessage?) {
        if (context != null && message != null) delegate.onNotificationMessageArrived(context, message)
    }

    override fun onReceiveRegisterResult(context: Context?, message: MiPushCommandMessage?) {
        if (context != null && message != null) delegate.onReceiveRegisterResult(context, message)
    }

    override fun onCommandResult(context: Context?, message: MiPushCommandMessage?) {
        if (context != null && message != null) delegate.onCommandResult(context, message)
    }
}

package com.doopush.DooPushSDKExample

import android.content.Context
import android.util.Log
import com.doopush.sdk.XiaomiPushReceiver

/**
 * 小米推送消息接收器实现
 * 
 * 继承自小米推送 PushMessageReceiver，处理推送消息的接收和回调
 */
class XiaomiPushMessageReceiver : com.xiaomi.mipush.sdk.PushMessageReceiver() {
    
    companion object {
        private const val TAG = "XiaomiPushReceiver"
    }
    
    /**
     * 接收服务器向客户端发送的透传消息
     */
    override fun onReceivePassThroughMessage(context: Context?, message: com.xiaomi.mipush.sdk.MiPushMessage?) {
        Log.d(TAG, "收到透传消息: ${message?.content}")
        if (context != null && message != null) {
            XiaomiPushReceiver.onReceivePassThroughMessage(context, message)
        }
    }
    
    /**
     * 接收服务器向客户端发送的通知消息，用户点击后触发
     */  
    override fun onNotificationMessageClicked(context: Context?, message: com.xiaomi.mipush.sdk.MiPushMessage?) {
        Log.d(TAG, "通知消息被点击: ${message?.title}")
        if (context != null && message != null) {
            XiaomiPushReceiver.onNotificationMessageClicked(context, message)
        }
    }
    
    /**
     * 接收服务器向客户端发送的通知消息，消息到达客户端时触发
     */
    override fun onNotificationMessageArrived(context: Context?, message: com.xiaomi.mipush.sdk.MiPushMessage?) {
        Log.d(TAG, "通知消息到达: ${message?.title}")
        if (context != null && message != null) {
            XiaomiPushReceiver.onNotificationMessageArrived(context, message)
        }
    }
    
    /**
     * 接收客户端向服务器发送注册命令的响应结果
     */
    override fun onReceiveRegisterResult(context: Context?, message: com.xiaomi.mipush.sdk.MiPushCommandMessage?) {
        Log.d(TAG, "收到注册结果: ${message?.resultCode}")
        if (context != null && message != null) {
            XiaomiPushReceiver.onReceiveRegisterResult(context, message)
        }
    }
    
    /**
     * 接收客户端向服务器发送命令的响应结果
     */
    override fun onCommandResult(context: Context?, message: com.xiaomi.mipush.sdk.MiPushCommandMessage?) {
        Log.d(TAG, "收到命令结果: ${message?.command} - ${message?.resultCode}")
        // 可以在这里处理其他命令结果，如设置别名等
    }
    
    /**
     * 接收服务器向客户端发送的通知消息，消息被打开时触发
     */
    override fun onRequirePermissions(context: Context?, permissions: Array<out String>?) {
        Log.d(TAG, "需要权限: ${permissions?.joinToString(", ")}")
    }
}

package com.doopush.sdk

import com.doopush.sdk.models.DooPushError
import com.doopush.sdk.models.PushMessage

/**
 * DooPush SDK 回调接口
 * 
 * 提供异步操作的结果回调，包括设备注册、推送接收等功能
 */
interface DooPushCallback {
    
    /**
     * 设备注册成功回调（旧版兼容，仅包含推送 token）。
     *
     * @param token 推送 token
     */
    fun onRegisterSuccess(token: String)

    /**
     * 设备注册成功回调（v1.2+，包含服务端 deviceId 与推送通道）。
     *
     * 默认委托给旧版 onRegisterSuccess(token)，保持既有实现源码兼容。
     */
    fun onRegisterSuccess(result: DooPushRegisterResult) {
        onRegisterSuccess(result.token)
    }
    
    /**
     * 设备注册失败回调
     * 
     * @param error 错误信息
     */
    fun onRegisterError(error: DooPushError)
    
    /**
     * 收到推送消息回调
     * 
     * @param message 推送消息内容
     */
    fun onMessageReceived(message: PushMessage)
    
    /**
     * 获取FCM Token成功回调
     * 
     * @param token FCM推送token
     */
    fun onTokenReceived(token: String)
    
    /**
     * 获取FCM Token失败回调
     * 
     * @param error 错误信息
     */
    fun onTokenError(error: DooPushError)
    
    // WebSocket 连接相关回调 (可选实现)

    /**
     * WebSocket 连接建立回调
     */
    fun onWebSocketOpen() {}

    /**
     * WebSocket 连接关闭回调
     *
     * @param code 关闭状态码
     * @param reason 关闭原因
     */
    fun onWebSocketClosed(code: Int, reason: String) {}

    /**
     * WebSocket 连接失败回调
     *
     * @param t 失败原因
     */
    fun onWebSocketFailure(t: Throwable) {}
    
    // 推送通知事件回调 (可选实现)
    
    /**
     * 推送通知点击回调
     * 
     * @param notificationData 推送通知数据
     */
    fun onNotificationClick(notificationData: DooPushNotificationHandler.NotificationData) {}
    
    /**
     * 推送通知打开回调 (点击通知导致应用打开)
     * 
     * @param notificationData 推送通知数据
     */
    fun onNotificationOpen(notificationData: DooPushNotificationHandler.NotificationData) {}
}

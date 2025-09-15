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
     * 设备注册成功回调
     * 
     * @param token FCM推送token
     */
    fun onRegisterSuccess(token: String)
    
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
    
    // TCP连接相关回调 (可选实现)
    
    /**
     * TCP连接状态变化回调
     * 
     * @param state TCP连接状态
     */
    fun onTCPStateChanged(state: DooPushTCPState) {}
    
    /**
     * TCP设备注册成功回调
     */
    fun onTCPRegistered() {}
    
    /**
     * TCP连接错误回调
     * 
     * @param error 错误信息
     * @param message 错误消息
     */
    fun onTCPError(error: DooPushError, message: String) {}
    
    /**
     * TCP心跳响应回调
     */
    fun onTCPHeartbeat() {}
    
    /**
     * TCP推送消息回调
     * 
     * @param message TCP推送消息
     */
    fun onTCPPushMessage(message: DooPushTCPMessage) {}
    
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

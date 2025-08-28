package com.doopush.sdk

import com.doopush.sdk.model.DooPushMessage
import com.doopush.sdk.tcp.DooPushTCPState

/**
 * DooPush SDK 事件监听器
 */
interface DooPushListener {
    
    /**
     * 设备注册成功
     * @param deviceToken 设备token
     */
    fun onDeviceRegistered(deviceToken: String)
    
    /**
     * 收到推送消息
     * @param message 推送消息
     */
    fun onMessageReceived(message: DooPushMessage)
    
    /**
     * 发生错误
     * @param error 错误信息
     */
    fun onError(error: DooPushError)
    
    /**
     * 设备信息更新成功（可选实现）
     */
    fun onDeviceInfoUpdated() {}
    
    /**
     * 推送权限状态变更（可选实现）
     * @param granted 是否已授权
     */
    fun onPermissionChanged(granted: Boolean) {}
    
    // MARK: - TCP连接相关回调（可选实现）
    
    /**
     * TCP连接状态变化
     * @param state 连接状态
     */
    fun onTCPConnectionStateChanged(state: DooPushTCPState) {}
    
    /**
     * TCP设备注册成功
     */
    fun onTCPDeviceRegistered() {}
    
    /**
     * TCP心跳响应
     */
    fun onTCPHeartbeatReceived() {}
    
    // MARK: - 推送厂商相关回调（可选实现）
    
    /**
     * 推送厂商初始化成功
     * @param vendor 厂商名称
     */
    fun onVendorInitialized(vendor: String) {}
    
    /**
     * 推送厂商初始化失败
     * @param vendor 厂商名称
     * @param error 错误信息
     */
    fun onVendorInitializationFailed(vendor: String, error: DooPushError) {}
}

/**
 * DooPush SDK 简化监听器
 * 只需要实现必要的回调方法
 */
abstract class DooPushSimpleListener : DooPushListener {
    
    /**
     * 设备注册成功
     */
    override fun onDeviceRegistered(deviceToken: String) {
        // 默认空实现
    }
    
    /**
     * 收到推送消息
     */
    override fun onMessageReceived(message: DooPushMessage) {
        // 默认空实现
    }
    
    /**
     * 发生错误
     */
    override fun onError(error: DooPushError) {
        // 默认空实现
    }
}

/**
 * 推送消息监听器
 * 专门用于处理推送消息的简化接口
 */
fun interface DooPushMessageListener {
    /**
     * 收到推送消息
     * @param message 推送消息
     */
    fun onMessageReceived(message: DooPushMessage)
}

/**
 * 设备注册监听器
 * 专门用于处理设备注册的简化接口
 */
fun interface DooPushRegistrationListener {
    /**
     * 设备注册结果
     * @param deviceToken 设备token，null表示注册失败
     * @param error 错误信息，null表示注册成功
     */
    fun onRegistrationResult(deviceToken: String?, error: DooPushError?)
}
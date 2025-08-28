package com.doopush.sdk.receiver

import android.content.Context
import com.doopush.sdk.DooPushManager
import com.doopush.sdk.internal.DooPushLogger
import com.doopush.sdk.vendor.xiaomi.XiaomiPushVendor
import com.xiaomi.mipush.sdk.ErrorCode
import com.xiaomi.mipush.sdk.MiPushClient
import com.xiaomi.mipush.sdk.MiPushCommandMessage
import com.xiaomi.mipush.sdk.MiPushMessage
import com.xiaomi.mipush.sdk.PushMessageReceiver

/**
 * DooPush 推送消息接收器
 * 继承自小米推送的PushMessageReceiver，处理小米推送的各种事件
 */
class DooPushMessageReceiver : PushMessageReceiver() {
    
    /**
     * 接收服务器向客户端发送的透传消息
     */
    override fun onReceivePassThroughMessage(context: Context?, miPushMessage: MiPushMessage?) {
        DooPushLogger.info("收到小米透传消息: ${miPushMessage?.content}")
        
        if (context != null && miPushMessage != null) {
            handlePushMessage(context, miPushMessage)
        }
    }
    
    /**
     * 接收服务器向客户端发送的通知消息，用户点击后触发
     */
    override fun onNotificationMessageClicked(context: Context?, miPushMessage: MiPushMessage?) {
        DooPushLogger.info("用户点击小米通知消息: ${miPushMessage?.content}")
        
        if (context != null && miPushMessage != null) {
            handlePushMessage(context, miPushMessage)
        }
    }
    
    /**
     * 接收服务器向客户端发送的通知消息，消息到达客户端时触发
     */
    override fun onNotificationMessageArrived(context: Context?, miPushMessage: MiPushMessage?) {
        DooPushLogger.info("收到小米通知消息: ${miPushMessage?.content}")
        
        if (context != null && miPushMessage != null) {
            handlePushMessage(context, miPushMessage)
        }
    }
    
    /**
     * 用于接收客户端向服务器发送命令的响应结果
     */
    override fun onCommandResult(context: Context?, miPushCommandMessage: MiPushCommandMessage?) {
        DooPushLogger.info("收到小米推送命令结果: ${miPushCommandMessage?.command}")
        
        if (context == null || miPushCommandMessage == null) {
            return
        }
        
        val command = miPushCommandMessage.command
        val resultCode = miPushCommandMessage.resultCode
        val reason = miPushCommandMessage.reason
        
        DooPushLogger.info("小米推送命令: $command, 结果码: $resultCode, 原因: $reason")
        
        when (command) {
            MiPushClient.COMMAND_REGISTER -> {
                handleRegistrationResult(context, miPushCommandMessage)
            }
            MiPushClient.COMMAND_SET_ALIAS -> {
                handleAliasResult(context, miPushCommandMessage)
            }
            MiPushClient.COMMAND_UNSET_ALIAS -> {
                handleUnsetAliasResult(context, miPushCommandMessage)
            }
            MiPushClient.COMMAND_SUBSCRIBE_TOPIC -> {
                handleSubscribeResult(context, miPushCommandMessage)
            }
            MiPushClient.COMMAND_UNSUBSCRIBE_TOPIC -> {
                handleUnsubscribeResult(context, miPushCommandMessage)
            }
            MiPushClient.COMMAND_SET_ACCOUNT -> {
                handleSetAccountResult(context, miPushCommandMessage)
            }
            MiPushClient.COMMAND_UNSET_ACCOUNT -> {
                handleUnsetAccountResult(context, miPushCommandMessage)
            }
        }
        
        // 通知小米推送厂商处理命令结果
        notifyXiaomiVendor(miPushCommandMessage)
    }
    
    /**
     * 用于接收客户端向服务器发送注册命令的响应结果
     */
    override fun onReceiveRegisterResult(context: Context?, miPushCommandMessage: MiPushCommandMessage?) {
        DooPushLogger.info("收到小米推送注册结果")
        
        if (context != null && miPushCommandMessage != null) {
            handleRegistrationResult(context, miPushCommandMessage)
        }
    }
    
    /**
     * 处理推送消息
     */
    private fun handlePushMessage(context: Context, miPushMessage: MiPushMessage) {
        try {
            // 获取DooPushManager实例
            val dooPushManager = DooPushManager.instance
            
            // 通过推送厂商管理器解析消息
            val vendorManager = getVendorManager(dooPushManager)
            if (vendorManager != null) {
                // 创建Intent来模拟消息传递
                val intent = android.content.Intent().apply {
                    putExtra("key_message", miPushMessage)
                }
                
                val dooPushMessage = vendorManager.parseMessage(intent)
                if (dooPushMessage != null) {
                    dooPushManager.handlePushMessage(dooPushMessage)
                } else {
                    DooPushLogger.warning("无法解析小米推送消息")
                }
            } else {
                DooPushLogger.warning("无法获取推送厂商管理器")
            }
            
        } catch (e: Exception) {
            DooPushLogger.error("处理小米推送消息时发生错误: $e")
        }
    }
    
    /**
     * 处理注册结果
     */
    private fun handleRegistrationResult(context: Context, commandMessage: MiPushCommandMessage) {
        val resultCode = commandMessage.resultCode
        val regId = commandMessage.commandArguments?.firstOrNull()
        
        DooPushLogger.info("小米推送注册结果 - 错误码: $resultCode, RegId: $regId")
        
        // 通知小米推送厂商处理注册结果
        notifyXiaomiVendorRegistration(regId, resultCode)
    }
    
    /**
     * 处理别名设置结果
     */
    private fun handleAliasResult(context: Context, commandMessage: MiPushCommandMessage) {
        val resultCode = commandMessage.resultCode
        val alias = commandMessage.commandArguments?.firstOrNull()
        
        if (resultCode.toInt() == ErrorCode.SUCCESS) {
            DooPushLogger.info("小米推送设置别名成功: $alias")
        } else {
            DooPushLogger.error("小米推送设置别名失败: $alias, 错误码: $resultCode")
        }
    }
    
    /**
     * 处理取消别名结果
     */
    private fun handleUnsetAliasResult(context: Context, commandMessage: MiPushCommandMessage) {
        val resultCode = commandMessage.resultCode
        val alias = commandMessage.commandArguments?.firstOrNull()
        
        if (resultCode.toInt() == ErrorCode.SUCCESS) {
            DooPushLogger.info("小米推送取消别名成功: $alias")
        } else {
            DooPushLogger.error("小米推送取消别名失败: $alias, 错误码: $resultCode")
        }
    }
    
    /**
     * 处理订阅主题结果
     */
    private fun handleSubscribeResult(context: Context, commandMessage: MiPushCommandMessage) {
        val resultCode = commandMessage.resultCode
        val topic = commandMessage.commandArguments?.firstOrNull()
        
        if (resultCode.toInt() == ErrorCode.SUCCESS) {
            DooPushLogger.info("小米推送订阅主题成功: $topic")
        } else {
            DooPushLogger.error("小米推送订阅主题失败: $topic, 错误码: $resultCode")
        }
    }
    
    /**
     * 处理取消订阅主题结果
     */
    private fun handleUnsubscribeResult(context: Context, commandMessage: MiPushCommandMessage) {
        val resultCode = commandMessage.resultCode
        val topic = commandMessage.commandArguments?.firstOrNull()
        
        if (resultCode.toInt() == ErrorCode.SUCCESS) {
            DooPushLogger.info("小米推送取消订阅主题成功: $topic")
        } else {
            DooPushLogger.error("小米推送取消订阅主题失败: $topic, 错误码: $resultCode")
        }
    }
    
    /**
     * 处理设置账号结果
     */
    private fun handleSetAccountResult(context: Context, commandMessage: MiPushCommandMessage) {
        val resultCode = commandMessage.resultCode
        val account = commandMessage.commandArguments?.firstOrNull()
        
        if (resultCode.toInt() == ErrorCode.SUCCESS) {
            DooPushLogger.info("小米推送设置账号成功: $account")
        } else {
            DooPushLogger.error("小米推送设置账号失败: $account, 错误码: $resultCode")
        }
    }
    
    /**
     * 处理取消账号结果
     */
    private fun handleUnsetAccountResult(context: Context, commandMessage: MiPushCommandMessage) {
        val resultCode = commandMessage.resultCode
        val account = commandMessage.commandArguments?.firstOrNull()
        
        if (resultCode.toInt() == ErrorCode.SUCCESS) {
            DooPushLogger.info("小米推送取消账号成功: $account")
        } else {
            DooPushLogger.error("小米推送取消账号失败: $account, 错误码: $resultCode")
        }
    }
    
    /**
     * 通知小米推送厂商处理命令结果
     */
    private fun notifyXiaomiVendor(commandMessage: MiPushCommandMessage) {
        try {
            val dooPushManager = DooPushManager.instance
            val vendorManager = getVendorManager(dooPushManager)
            val xiaomiVendor = vendorManager?.getActiveVendor() as? XiaomiPushVendor
            
            xiaomiVendor?.handleCommandResult(commandMessage)
        } catch (e: Exception) {
            DooPushLogger.error("通知小米推送厂商时发生错误: $e")
        }
    }
    
    /**
     * 通知小米推送厂商处理注册结果
     */
    private fun notifyXiaomiVendorRegistration(regId: String?, resultCode: Long) {
        try {
            val dooPushManager = DooPushManager.instance
            val vendorManager = getVendorManager(dooPushManager)
            val xiaomiVendor = vendorManager?.getActiveVendor() as? XiaomiPushVendor
            
            xiaomiVendor?.handleRegistrationResult(regId, resultCode)
        } catch (e: Exception) {
            DooPushLogger.error("通知小米推送厂商注册结果时发生错误: $e")
        }
    }
    
    /**
     * 通过反射获取推送厂商管理器
     * 这是一个临时解决方案，避免循环依赖
     */
    private fun getVendorManager(dooPushManager: DooPushManager): com.doopush.sdk.vendor.PushVendorManager? {
        return try {
            val field = dooPushManager.javaClass.getDeclaredField("vendorManager")
            field.isAccessible = true
            field.get(dooPushManager) as? com.doopush.sdk.vendor.PushVendorManager
        } catch (e: Exception) {
            DooPushLogger.error("获取推送厂商管理器失败: $e")
            null
        }
    }
}
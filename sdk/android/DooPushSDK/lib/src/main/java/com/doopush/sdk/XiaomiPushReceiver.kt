package com.doopush.sdk

import android.content.Context
import android.content.Intent
import android.util.Log
import com.doopush.sdk.models.PushMessage

/**
 * 小米推送消息接收器
 * 
 * 处理小米推送的消息接收、点击和统计上报
 */
class XiaomiPushReceiver {
    
    companion object {
        private const val TAG = "XiaomiPushReceiver"
        
        // 全局的服务实例（用于处理回调）
        private var globalXiaomiService: XiaomiService? = null
        
        /**
         * 设置服务实例（供 DooPushManager 调用）
         */
        internal fun setService(service: XiaomiService) {
            globalXiaomiService = service
        }
        
        /**
         * 检查小米推送接收器是否可用
         */
        fun isReceiverAvailable(): Boolean {
            return try {
                Class.forName("com.xiaomi.mipush.sdk.PushMessageReceiver")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "小米推送接收器不可用")
                false
            }
        }
        
        /**
         * 处理小米推送注册成功回调
         * 
         * @param context 应用上下文
         * @param message 注册成功消息
         */
        fun onReceiveRegisterResult(context: Context, message: Any) {
            try {
                Log.d(TAG, "收到小米推送注册结果")
                
                // 通过反射获取regId
                var regId = getRegIdFromMessage(message)
                
                // 如果从消息中获取不到，尝试直接从MiPushClient获取
                if (regId.isNullOrEmpty()) {
                    Log.d(TAG, "从消息中获取RegId失败，尝试从MiPushClient直接获取")
                    regId = getRegIdFromMiPushClient(context)
                }
                
                if (!regId.isNullOrEmpty()) {
                    Log.d(TAG, "小米推送注册成功: ${regId.substring(0, 12)}...")
                    globalXiaomiService?.handleRegisterSuccess(regId)
                } else {
                    // 等待一小段时间后再次尝试获取，有时候RegId需要一点时间生成
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        val delayedRegId = getRegIdFromMiPushClient(context)
                        if (!delayedRegId.isNullOrEmpty()) {
                            Log.d(TAG, "延迟获取小米推送RegId成功")
                            globalXiaomiService?.handleRegisterSuccess(delayedRegId)
                        } else {
                            Log.e(TAG, "小米推送注册失败: 无法获取RegId")
                            globalXiaomiService?.handleRegisterError("无法获取RegId")
                        }
                    }, 1000) // 延迟1秒
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理小米推送注册结果时发生异常", e)
                globalXiaomiService?.handleRegisterError("处理注册结果异常: ${e.message}")
            }
        }
        
        /**
         * 直接从MiPushClient获取RegId
         */
        private fun getRegIdFromMiPushClient(context: Context): String? {
            return try {
                val miPushClientClass = Class.forName("com.xiaomi.mipush.sdk.MiPushClient")
                val getRegIdMethod = miPushClientClass.getMethod("getRegId", Context::class.java)
                val regId = getRegIdMethod.invoke(null, context) as? String
                Log.d(TAG, "从MiPushClient获取RegId: ${if (regId.isNullOrEmpty()) "null" else "success"}")
                regId
            } catch (e: Exception) {
                Log.d(TAG, "从MiPushClient获取RegId失败", e)
                null
            }
        }
        
        /**
         * 处理小米推送消息接收
         * 
         * @param context 应用上下文
         * @param message 推送消息
         */
        fun onReceivePassThroughMessage(context: Context, message: Any) {
            try {
                Log.d(TAG, "收到小米推送透传消息")
                
                val pushMessage = parsePushMessage(message)
                if (pushMessage != null) {
                    // 通知 DooPushManager
                    val manager = DooPushManager.getInstance()
                    val callback = manager.getInternalCallback()
                    callback?.onMessageReceived(pushMessage)
                    
                    // 上报统计数据
                    reportMessageReceived(pushMessage)
                } else {
                    Log.w(TAG, "解析小米推送消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理小米推送消息时发生异常", e)
            }
        }
        
        /**
         * 处理小米推送通知栏消息点击
         * 
         * @param context 应用上下文
         * @param message 推送消息
         */
        fun onNotificationMessageClicked(context: Context, message: Any) {
            try {
                Log.d(TAG, "小米推送通知栏消息被点击")
                
                val pushMessage = parsePushMessage(message)
                if (pushMessage != null) {
                    // 创建通知数据
                    val notificationData = DooPushNotificationHandler.NotificationData(
                        pushLogId = pushMessage.pushLogId,
                        dedupKey = pushMessage.dedupKey,
                        title = pushMessage.title ?: "",
                        body = pushMessage.body ?: "",
                        payload = pushMessage.data
                    )
                    
                    // 通知 DooPushManager
                    val manager = DooPushManager.getInstance()
                    val callback = manager.getInternalCallback()
                    callback?.onNotificationClick(notificationData)
                    
                    // 上报点击统计
                    reportNotificationClick(pushMessage)
                } else {
                    Log.w(TAG, "解析小米推送点击消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理小米推送通知点击时发生异常", e)
            }
        }
        
        /**
         * 处理小米推送通知栏消息到达
         * 
         * @param context 应用上下文
         * @param message 推送消息
         */
        fun onNotificationMessageArrived(context: Context, message: Any) {
            try {
                Log.d(TAG, "小米推送通知栏消息到达")
                
                val pushMessage = parsePushMessage(message)
                if (pushMessage != null) {
                    // 上报消息到达统计
                    reportMessageArrived(pushMessage)
                } else {
                    Log.w(TAG, "解析小米推送到达消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理小米推送通知到达时发生异常", e)
            }
        }
        
        /**
         * 从小米推送消息对象中获取RegId
         */
        private fun getRegIdFromMessage(message: Any): String? {
            return try {
                val messageClass = message.javaClass
                
                // 尝试多种可能的方法来获取RegId
                val possibleMethods = listOf(
                    "getRegId",
                    "getCommandArguments", 
                    "getCommandArgs",
                    "getRegID",
                    "getToken"
                )
                
                for (methodName in possibleMethods) {
                    try {
                        val method = messageClass.getMethod(methodName)
                        val result = method.invoke(message)
                        when (result) {
                            is String -> {
                                if (result.isNotEmpty()) {
                                    Log.d(TAG, "通过 $methodName 获取到RegId")
                                    return result
                                }
                            }
                            is List<*> -> {
                                // commandArguments 通常返回List，第一个元素是RegId
                                if (result.isNotEmpty() && result[0] is String) {
                                    val regId = result[0] as String
                                    if (regId.isNotEmpty()) {
                                        Log.d(TAG, "通过 $methodName 从List获取到RegId")
                                        return regId
                                    }
                                }
                            }
                        }
                    } catch (e: NoSuchMethodException) {
                        // 继续尝试下一个方法
                    }
                }
                
                // 如果所有方法都失败，尝试从MiPushClient直接获取
                Log.w(TAG, "无法从消息中获取RegId，尝试从MiPushClient直接获取")
                null
                
            } catch (e: Exception) {
                Log.e(TAG, "获取小米推送RegId时发生异常", e)
                null
            }
        }
        
        /**
         * 解析小米推送消息为统一的PushMessage格式
         */
        private fun parsePushMessage(message: Any): PushMessage? {
            return try {
                val messageClass = message.javaClass
                
                // 获取基本信息
                val getContentMethod = messageClass.getMethod("getContent")
                val getDescriptionMethod = messageClass.getMethod("getDescription") 
                val getTitleMethod = messageClass.getMethod("getTitle")
                val getExtraMethod = messageClass.getMethod("getExtra")
                
                val content = getContentMethod.invoke(message) as? String
                val description = getDescriptionMethod.invoke(message) as? String
                val title = getTitleMethod.invoke(message) as? String
                val extra = getExtraMethod.invoke(message) as? Map<String, String>
                
                // 构建统一的推送消息对象
                val data = mutableMapOf<String, String>()
                
                // 添加小米特有数据
                content?.let { data["content"] = it }
                description?.let { data["description"] = it }
                
                // 添加扩展数据
                extra?.forEach { (key, value) ->
                    data[key] = value
                }
                
                // 提取统计标识字段
                val pushLogId = data["push_log_id"]
                val dedupKey = data["dedup_key"]
                
                PushMessage(
                    messageId = System.currentTimeMillis().toString(),
                    title = title,
                    body = description,
                    data = data,
                    pushLogId = pushLogId,
                    dedupKey = dedupKey
                )
                
            } catch (e: Exception) {
                Log.e(TAG, "解析小米推送消息失败", e)
                null
            }
        }
        
        /**
         * 上报消息接收统计
         */
        private fun reportMessageReceived(message: PushMessage) {
            try {
                // 创建通知数据用于统计上报
                val notificationData = DooPushNotificationHandler.NotificationData(
                    pushLogId = message.pushLogId,
                    dedupKey = message.dedupKey,
                    title = message.title,
                    body = message.body,
                    payload = message.data
                )
                DooPushStatistics.recordNotificationReceived(notificationData)
            } catch (e: Exception) {
                Log.e(TAG, "上报消息接收统计失败", e)
            }
        }
        
        /**
         * 上报消息到达统计
         */
        private fun reportMessageArrived(message: PushMessage) {
            try {
                // 创建通知数据用于统计上报
                val notificationData = DooPushNotificationHandler.NotificationData(
                    pushLogId = message.pushLogId,
                    dedupKey = message.dedupKey,
                    title = message.title,
                    body = message.body,
                    payload = message.data
                )
                DooPushStatistics.recordNotificationReceived(notificationData)
            } catch (e: Exception) {
                Log.e(TAG, "上报消息到达统计失败", e)
            }
        }
        
        /**
         * 上报通知点击统计
         */
        private fun reportNotificationClick(message: PushMessage) {
            try {
                // 创建通知数据用于统计上报
                val notificationData = DooPushNotificationHandler.NotificationData(
                    pushLogId = message.pushLogId,
                    dedupKey = message.dedupKey,
                    title = message.title,
                    body = message.body,
                    payload = message.data
                )
                DooPushStatistics.recordNotificationClick(notificationData)
            } catch (e: Exception) {
                Log.e(TAG, "上报通知点击统计失败", e)
            }
        }
    }
}

/**
 * 小米推送消息接收器实现类
 * 
 * 这个类需要在应用的 AndroidManifest.xml 中注册，并继承自小米的 PushMessageReceiver
 * 由于我们使用 compileOnly 依赖，这里提供一个基础实现供应用参考
 */
abstract class BaseMiPushMessageReceiver {
    
    companion object {
        private const val TAG = "BaseMiPushMessageReceiver"
    }
    
    /**
     * 接收服务器向客户端发送的透传消息
     */
    open fun onReceivePassThroughMessage(context: Context, message: Any) {
        Log.d(TAG, "收到透传消息")
        XiaomiPushReceiver.onReceivePassThroughMessage(context, message)
    }
    
    /**
     * 接收服务器向客户端发送的通知消息，用户点击后触发
     */  
    open fun onNotificationMessageClicked(context: Context, message: Any) {
        Log.d(TAG, "通知消息被点击")
        XiaomiPushReceiver.onNotificationMessageClicked(context, message)
    }
    
    /**
     * 接收服务器向客户端发送的通知消息，消息到达客户端时触发
     */
    open fun onNotificationMessageArrived(context: Context, message: Any) {
        Log.d(TAG, "通知消息到达")
        XiaomiPushReceiver.onNotificationMessageArrived(context, message)
    }
    
    /**
     * 接收客户端向服务器发送注册命令的响应结果
     */
    open fun onReceiveRegisterResult(context: Context, message: Any) {
        Log.d(TAG, "收到注册结果")
        XiaomiPushReceiver.onReceiveRegisterResult(context, message)
    }
    
    /**
     * 接收客户端向服务器发送命令的响应结果
     */
    open fun onCommandResult(context: Context, message: Any) {
        Log.d(TAG, "收到命令结果")
        // 可以在这里处理其他命令结果，如设置别名等
    }
}

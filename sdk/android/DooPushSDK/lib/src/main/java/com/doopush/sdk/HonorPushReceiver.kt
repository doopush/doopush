package com.doopush.sdk

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import com.doopush.sdk.models.PushMessage

/**
 * 荣耀推送消息接收器
 * 
 * 处理荣耀推送的消息接收、点击和统计上报
 */
class HonorPushReceiver {
    
    companion object {
        private const val TAG = "HonorPushReceiver"
        
        // 全局的服务实例（用于处理回调）
        @SuppressLint("StaticFieldLeak")
        private var globalHonorService: HonorService? = null
        
        /**
         * 设置服务实例（供 DooPushManager 调用）
         */
        internal fun setService(service: HonorService) {
            globalHonorService = service
        }
        
        /**
         * 检查荣耀推送接收器是否可用
         */
        fun isReceiverAvailable(): Boolean {
            return when {
                classExists("com.hihonor.push.sdk.HonorMessageService") -> true
                classExists("com.hihonor.mcs.push.callback.MessageCallback") -> true
                else -> {
                    Log.d(TAG, "荣耀接收器不可用")
                    false
                }
            }
        }

        private fun classExists(className: String): Boolean {
            return try {
                Class.forName(className)
                true
            } catch (_: ClassNotFoundException) {
                false
            }
        }
        
        /**
         * 处理荣耀推送Token获取成功回调
         * 
         * @param context 应用上下文
         * @param token 获取到的推送Token
         */
        fun onTokenReceived(context: Context, token: String?) {
            try {
                Log.d(TAG, "收到荣耀Token结果")
                if (!token.isNullOrEmpty()) {
                    Log.d(TAG, "荣耀Token获取成功: ${token.substring(0, 12)}...")
                    globalHonorService?.handleTokenSuccess(token)
                } else {
                    Log.e(TAG, "荣耀Token获取失败: Token为空")
                    globalHonorService?.handleTokenError("Token为空")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理荣耀Token结果异常", e)
                globalHonorService?.handleTokenError("处理Token结果异常: ${e.message}")
            }
        }
        
        /**
         * 处理荣耀推送Token获取失败回调
         * 
         * @param context 应用上下文
         * @param errorCode 错误码
         * @param errorMsg 错误消息
         */
        fun onTokenError(context: Context, errorCode: Int, errorMsg: String?) {
            try {
                Log.e(TAG, "荣耀Token获取失败: code=$errorCode, msg=$errorMsg")
                globalHonorService?.handleTokenError("Token获取失败: $errorCode - $errorMsg")
            } catch (e: Exception) {
                Log.e(TAG, "处理荣耀Token错误异常", e)
                globalHonorService?.handleTokenError("处理Token错误异常: ${e.message}")
            }
        }
        
        /**
         * 处理荣耀推送透传消息接收
         * 
         * @param context 应用上下文
         * @param data 透传消息内容
         */
        fun onDataMessageReceived(context: Context, data: Map<String, String>?) {
            try {
                Log.d(TAG, "收到荣耀透传消息")
                
                val pushMessage = parseDataMessage(data)
                if (pushMessage != null) {
                    // 通知 DooPushManager
                    val manager = DooPushManager.getInstance()
                    val callback = manager.getInternalCallback()
                    callback?.onMessageReceived(pushMessage)
                    
                    // 上报统计数据
                    reportMessageReceived(pushMessage)
                } else {
                    Log.w(TAG, "解析荣耀透传消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理荣耀透传消息异常", e)
            }
        }
        
        /**
         * 处理荣耀推送通知消息前台到达
         * 
         * @param context 应用上下文
         * @param title 通知标题
         * @param body 通知内容
         * @param data 附加数据
         */
        fun onNotificationMessageArrived(context: Context, title: String?, body: String?, data: Map<String, String>?) {
            try {
                Log.d(TAG, "荣耀前台消息到达")
                
                val pushMessage = parseNotificationMessage(title, body, data)
                if (pushMessage != null) {
                    // 上报消息到达统计
                    reportMessageArrived(pushMessage)
                } else {
                    Log.w(TAG, "解析荣耀前台消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理荣耀前台消息异常", e)
            }
        }
        
        /**
         * 处理荣耀推送通知消息点击
         * 
         * @param context 应用上下文
         * @param title 通知标题
         * @param body 通知内容
         * @param data 附加数据
         */
        fun onNotificationMessageClicked(context: Context, title: String?, body: String?, data: Map<String, String>?) {
            try {
                Log.d(TAG, "荣耀通知被点击")
                
                val pushMessage = parseNotificationMessage(title, body, data)
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
                    Log.w(TAG, "解析荣耀点击消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理荣耀通知点击异常", e)
            }
        }
        
        /**
         * 解析荣耀透传消息为统一的PushMessage格式
         * 
         * @param data 透传消息数据
         */
        private fun parseDataMessage(data: Map<String, String>?): PushMessage? {
            return try {
                if (data.isNullOrEmpty()) {
                    Log.w(TAG, "荣耀透传消息为空")
                    return null
                }
                
                // 构建统一的推送消息对象
                val messageData = mutableMapOf<String, String>()
                
                // 添加所有数据
                data.forEach { (key, value) ->
                    if (value.isNotEmpty()) {
                        messageData[key] = value
                    }
                }
                
                // 提取常见字段
                val title = data["title"] ?: data["Title"]
                val content = data["content"] ?: data["body"] ?: data["Body"]
                
                // 提取统计标识字段
                val pushLogId = data["push_log_id"]
                val dedupKey = data["dedup_key"]
                
                PushMessage(
                    messageId = System.currentTimeMillis().toString(),
                    title = title,
                    body = content,
                    data = messageData,
                    pushLogId = pushLogId,
                    dedupKey = dedupKey
                )
                
            } catch (e: Exception) {
                Log.e(TAG, "解析荣耀透传消息失败", e)
                null
            }
        }
        
        /**
         * 解析荣耀通知消息为统一的PushMessage格式
         * 
         * @param title 通知标题
         * @param body 通知内容
         * @param data 附加数据
         */
        private fun parseNotificationMessage(title: String?, body: String?, data: Map<String, String>?): PushMessage? {
            return try {
                // 构建统一的推送消息对象
                val messageData = mutableMapOf<String, String>()
                
                // 添加基本信息
                if (!title.isNullOrEmpty()) messageData["title"] = title
                if (!body.isNullOrEmpty()) messageData["body"] = body
                
                // 添加附加数据
                data?.forEach { (key, value) ->
                    if (value.isNotEmpty()) {
                        messageData[key] = value
                    }
                }
                
                // 提取统计标识字段
                val pushLogId = data?.get("push_log_id")
                val dedupKey = data?.get("dedup_key")
                
                PushMessage(
                    messageId = System.currentTimeMillis().toString(),
                    title = title,
                    body = body,
                    data = messageData,
                    pushLogId = pushLogId,
                    dedupKey = dedupKey
                )
                
            } catch (e: Exception) {
                Log.e(TAG, "解析荣耀通知消息失败", e)
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
 * 荣耀推送消息接收器实现类
 * 
 * 这个类需要在应用中继承荣耀推送的MessageCallback
 * 由于我们使用 compileOnly 依赖，这里提供一个基础实现供应用参考
 */
@SuppressLint("LongLogTag")
abstract class BaseHonorMessageCallback {
    
    companion object {
        private const val TAG = "BaseHonorMessageCallback"
    }
    
    /**
     * 推送Token获取成功回调
     * 
     * @param context 应用上下文
     * @param token 推送Token
     */
    open fun onTokenSuccess(context: Context, token: String) {
        Log.d(TAG, "荣耀推送Token获取成功")
        HonorPushReceiver.onTokenReceived(context, token)
    }
    
    /**
     * 推送Token获取失败回调
     * 
     * @param context 应用上下文
     * @param errorCode 错误码
     * @param errorMsg 错误消息
     */
    open fun onTokenFailure(context: Context, errorCode: Int, errorMsg: String) {
        Log.d(TAG, "荣耀推送Token获取失败")
        HonorPushReceiver.onTokenError(context, errorCode, errorMsg)
    }
    
    /**
     * 接收透传消息
     * 
     * @param context 应用上下文
     * @param data 透传消息数据
     */
    open fun onDataMessage(context: Context, data: Map<String, String>) {
        Log.d(TAG, "收到荣耀透传消息")
        HonorPushReceiver.onDataMessageReceived(context, data)
    }
    
    /**
     * 通知消息到达
     * 
     * @param context 应用上下文
     * @param title 消息标题
     * @param body 消息内容
     * @param data 附加数据
     */
    open fun onNotificationArrived(context: Context, title: String, body: String, data: Map<String, String>) {
        Log.d(TAG, "荣耀通知消息到达")
        HonorPushReceiver.onNotificationMessageArrived(context, title, body, data)
    }
    
    /**
     * 通知消息被点击
     * 
     * @param context 应用上下文
     * @param title 消息标题
     * @param body 消息内容  
     * @param data 附加数据
     */
    open fun onNotificationClicked(context: Context, title: String, body: String, data: Map<String, String>) {
        Log.d(TAG, "荣耀推送通知消息被点击")
        HonorPushReceiver.onNotificationMessageClicked(context, title, body, data)
    }
}

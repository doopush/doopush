package com.doopush.sdk

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import com.doopush.sdk.models.PushMessage

/**
 * VIVO推送消息接收器
 * 
 * 处理VIVO推送的消息接收、点击和统计上报
 */
class VivoPushReceiver {
    
    companion object {
        private const val TAG = "VivoPushReceiver"
        
        // 全局的服务实例（用于处理回调）
        @SuppressLint("StaticFieldLeak")
        private var globalVivoService: VivoService? = null
        
        /**
         * 设置服务实例（供 DooPushManager 调用）
         */
        internal fun setService(service: VivoService) {
            globalVivoService = service
        }
        
        /**
         * 检查VIVO推送接收器是否可用
         */
        fun isReceiverAvailable(): Boolean {
            return try {
                Class.forName("com.vivo.push.sdk.OpenClientPushMessageReceiver")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "VIVO接收器不可用")
                false
            }
        }
        
        /**
         * 处理VIVO推送注册成功回调
         * 
         * @param context 应用上下文
         * @param regId 注册成功的RegId
         */
        fun onReceiveRegId(context: Context, regId: String?) {
            try {
                Log.d(TAG, "收到VIVO注册结果")
                if (!regId.isNullOrEmpty()) {
                    Log.d(TAG, "VIVO注册成功: ${regId.substring(0, 12)}...")
                    globalVivoService?.handleRegisterSuccess(regId)
                } else {
                    Log.e(TAG, "VIVO注册失败: RegId为空")
                    globalVivoService?.handleRegisterError("RegId为空")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理VIVO注册结果异常", e)
                globalVivoService?.handleRegisterError("处理注册结果异常: ${e.message}")
            }
        }
        
        /**
         * 处理VIVO推送透传消息接收
         * 
         * @param context 应用上下文
         * @param message 透传消息内容
         */
        fun onTransmissionMessage(context: Context, message: String?) {
            try {
                Log.d(TAG, "收到VIVO透传消息")
                
                val pushMessage = parseTransmissionMessage(message)
                if (pushMessage != null) {
                    // 通知 DooPushManager
                    val manager = DooPushManager.getInstance()
                    val callback = manager.getInternalCallback()
                    callback?.onMessageReceived(pushMessage)
                    
                    // 上报统计数据
                    reportMessageReceived(pushMessage)
                } else {
                    Log.w(TAG, "解析VIVO透传消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理VIVO透传消息异常", e)
            }
        }
        
        /**
         * 处理VIVO推送通知消息前台到达
         * 
         * @param context 应用上下文
         * @param title 通知标题
         * @param content 通知内容
         * @param customData 自定义数据
         */
        fun onForegroundMessageArrived(context: Context, title: String?, content: String?, customData: Map<String, String>?) {
            try {
                Log.d(TAG, "VIVO前台消息到达")
                
                val pushMessage = parseNotificationMessage(title, content, customData)
                if (pushMessage != null) {
                    // 上报消息到达统计
                    reportMessageArrived(pushMessage)
                } else {
                    Log.w(TAG, "解析VIVO前台消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理VIVO前台消息异常", e)
            }
        }
        
        /**
         * 处理VIVO推送通知消息点击
         * 
         * @param context 应用上下文
         * @param title 通知标题
         * @param content 通知内容
         * @param customData 自定义数据
         */
        fun onNotificationMessageClicked(context: Context, title: String?, content: String?, customData: Map<String, String>?) {
            try {
                Log.d(TAG, "VIVO通知被点击")
                
                val pushMessage = parseNotificationMessage(title, content, customData)
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
                    Log.w(TAG, "解析VIVO点击消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理VIVO通知点击异常", e)
            }
        }
        
        /**
         * 解析VIVO透传消息为统一的PushMessage格式
         * 
         * @param message 透传消息内容
         */
        private fun parseTransmissionMessage(message: String?): PushMessage? {
            return try {
                if (message.isNullOrEmpty()) {
                    Log.w(TAG, "VIVO透传消息为空")
                    return null
                }
                
                // 尝试解析JSON格式的透传消息
                val data = mutableMapOf<String, String>()
                data["transmission_content"] = message
                
                try {
                    val jsonObject = org.json.JSONObject(message)
                    
                    // 提取常见字段
                    val title = jsonObject.optString("title", "")
                    val content = jsonObject.optString("content", "")
                    
                    if (title.isNotEmpty()) data["title"] = title
                    if (content.isNotEmpty()) data["content"] = content
                    
                    // 提取所有其他字段
                    jsonObject.keys().forEach { key ->
                        val value = jsonObject.optString(key, "")
                        if (value.isNotEmpty()) {
                            data[key] = value
                        }
                    }
                } catch (e: Exception) {
                    // 如果不是JSON格式，保持原始内容
                    Log.d(TAG, "透传消息不是JSON格式，保持原始内容")
                }
                
                // 提取统计标识字段
                val pushLogId = data["push_log_id"]
                val dedupKey = data["dedup_key"]
                
                PushMessage(
                    messageId = System.currentTimeMillis().toString(),
                    title = data["title"],
                    body = data["content"],
                    data = data,
                    pushLogId = pushLogId,
                    dedupKey = dedupKey
                )
                
            } catch (e: Exception) {
                Log.e(TAG, "解析VIVO透传消息失败", e)
                null
            }
        }
        
        /**
         * 解析VIVO通知消息为统一的PushMessage格式
         * 
         * @param title 通知标题
         * @param content 通知内容
         * @param customData 自定义数据
         */
        private fun parseNotificationMessage(title: String?, content: String?, customData: Map<String, String>?): PushMessage? {
            return try {
                // 构建统一的推送消息对象
                val data = mutableMapOf<String, String>()
                
                // 添加基本信息
                if (!title.isNullOrEmpty()) data["title"] = title
                if (!content.isNullOrEmpty()) data["content"] = content
                
                // 添加自定义数据
                customData?.forEach { (key, value) ->
                    if (value.isNotEmpty()) {
                        data[key] = value
                    }
                }
                
                // 提取统计标识字段
                val pushLogId = data["push_log_id"]
                val dedupKey = data["dedup_key"]
                
                PushMessage(
                    messageId = System.currentTimeMillis().toString(),
                    title = title,
                    body = content,
                    data = data,
                    pushLogId = pushLogId,
                    dedupKey = dedupKey
                )
                
            } catch (e: Exception) {
                Log.e(TAG, "解析VIVO通知消息失败", e)
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
 * VIVO推送消息接收器实现类
 * 
 * 这个类需要在应用的 AndroidManifest.xml 中注册，并继承自 OpenClientPushMessageReceiver
 * 由于我们使用 compileOnly 依赖，这里提供一个基础实现供应用参考
 */
@SuppressLint("LongLogTag")
abstract class BaseVivoPushMessageReceiver {
    
    companion object {
        private const val TAG = "BaseVivoPushMessageReceiver"
    }
    
    /**
     * 推送服务注册成功回调
     * 
     * @param context 应用上下文
     * @param regId 注册ID
     */
    open fun onReceiveRegId(context: Context, regId: String?) {
        Log.d(TAG, "VIVO推送注册成功")
        VivoPushReceiver.onReceiveRegId(context, regId)
    }
    
    /**
     * 接收透传消息
     * 
     * @param context 应用上下文
     * @param message 透传消息内容
     */
    open fun onTransmissionMessage(context: Context, message: String?) {
        Log.d(TAG, "收到VIVO透传消息")
        VivoPushReceiver.onTransmissionMessage(context, message)
    }
    
    /**
     * 前台消息到达（不展示的消息）
     * 
     * @param context 应用上下文
     * @param title 消息标题
     * @param content 消息内容
     * @param customData 自定义数据
     */
    open fun onForegroundMessageArrived(context: Context, title: String?, content: String?, customData: Map<String, String>?) {
        Log.d(TAG, "VIVO前台消息到达")
        VivoPushReceiver.onForegroundMessageArrived(context, title, content, customData)
    }
    
    /**
     * 通知消息被点击
     * 
     * @param context 应用上下文
     * @param title 消息标题
     * @param content 消息内容
     * @param customData 自定义数据
     */
    open fun onNotificationMessageClicked(context: Context, title: String?, content: String?, customData: Map<String, String>?) {
        Log.d(TAG, "VIVO推送通知消息被点击")
        VivoPushReceiver.onNotificationMessageClicked(context, title, content, customData)
    }
    
    /**
     * 设置别名结果回调
     * 
     * @param context 应用上下文
     * @param result 设置结果
     * @param alias 别名
     */
    open fun onSetAliasResult(context: Context, result: Int, alias: String?) {
        Log.d(TAG, "VIVO推送设置别名结果: result=$result, alias=$alias")
    }
    
    /**
     * 取消设置别名结果回调
     * 
     * @param context 应用上下文
     * @param result 取消结果
     * @param alias 别名
     */
    open fun onUnsetAliasResult(context: Context, result: Int, alias: String?) {
        Log.d(TAG, "VIVO推送取消设置别名结果: result=$result, alias=$alias")
    }
    
    /**
     * 设置标签结果回调
     * 
     * @param context 应用上下文
     * @param result 设置结果
     * @param topic 标签
     */
    open fun onSetTopicResult(context: Context, result: Int, topic: String?) {
        Log.d(TAG, "VIVO推送设置标签结果: result=$result, topic=$topic")
    }
    
    /**
     * 取消设置标签结果回调
     * 
     * @param context 应用上下文
     * @param result 取消结果
     * @param topic 标签
     */
    open fun onUnsetTopicResult(context: Context, result: Int, topic: String?) {
        Log.d(TAG, "VIVO推送取消设置标签结果: result=$result, topic=$topic")
    }
}

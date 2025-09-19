package com.doopush.sdk

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import com.doopush.sdk.models.PushMessage

/**
 * 魅族推送消息接收器
 * 
 * 处理魅族推送的消息接收、点击和统计上报
 */
class MeizuPushReceiver {
    
    companion object {
        private const val TAG = "MeizuPushReceiver"
        
        // 全局的服务实例（用于处理回调）
        @SuppressLint("StaticFieldLeak")
        private var globalMeizuService: MeizuService? = null
        
        /**
         * 设置服务实例（供 DooPushManager 调用）
         */
        internal fun setService(service: MeizuService) {
            globalMeizuService = service
        }
        
        /**
         * 检查魅族推送接收器是否可用
         */
        fun isReceiverAvailable(): Boolean {
            return try {
                Class.forName("com.meizu.cloud.pushsdk.MzPushMessageReceiver")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "魅族接收器不可用")
                false
            }
        }
        
        /**
         * 处理魅族推送注册成功回调
         * 
         * @param context 应用上下文
         * @param pushId 注册成功的PushId
         */
        fun onPushIdReceived(context: Context, pushId: String?) {
            try {
                Log.d(TAG, "收到魅族注册结果")
                if (!pushId.isNullOrEmpty()) {
                    Log.d(TAG, "魅族注册成功: ${pushId.substring(0, 12)}...")
                    globalMeizuService?.handleRegisterSuccess(pushId)
                } else {
                    Log.e(TAG, "魅族注册失败: PushId为空")
                    globalMeizuService?.handleRegisterError("PushId为空")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理魅族注册结果异常", e)
                globalMeizuService?.handleRegisterError("处理注册结果异常: ${e.message}")
            }
        }
        
        /**
         * 处理魅族推送透传消息接收
         * 
         * @param context 应用上下文
         * @param message 透传消息内容
         */
        fun onTransparentMessage(context: Context, message: String?) {
            try {
                Log.d(TAG, "收到魅族透传消息")
                
                val pushMessage = parseTransparentMessage(message)
                if (pushMessage != null) {
                    // 通知 DooPushManager
                    val manager = DooPushManager.getInstance()
                    val callback = manager.getInternalCallback()
                    callback?.onMessageReceived(pushMessage)
                    
                    // 上报统计数据
                    reportMessageReceived(pushMessage)
                } else {
                    Log.w(TAG, "解析魅族透传消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理魅族透传消息异常", e)
            }
        }
        
        /**
         * 处理魅族推送通知消息到达
         * 
         * @param context 应用上下文
         * @param title 通知标题
         * @param content 通知内容
         * @param selfDefineContentString 自定义内容
         */
        fun onNotificationArrived(context: Context, title: String?, content: String?, selfDefineContentString: String?) {
            try {
                Log.d(TAG, "魅族通知消息到达")
                
                val pushMessage = parseNotificationMessage(title, content, selfDefineContentString)
                if (pushMessage != null) {
                    // 上报消息到达统计
                    reportMessageArrived(pushMessage)
                } else {
                    Log.w(TAG, "解析魅族通知消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理魅族通知消息异常", e)
            }
        }
        
        /**
         * 处理魅族推送通知消息点击
         * 
         * @param context 应用上下文
         * @param title 通知标题
         * @param content 通知内容
         * @param selfDefineContentString 自定义内容
         */
        fun onNotificationClicked(context: Context, title: String?, content: String?, selfDefineContentString: String?) {
            try {
                Log.d(TAG, "魅族通知被点击")
                
                val pushMessage = parseNotificationMessage(title, content, selfDefineContentString)
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
                    Log.w(TAG, "解析魅族点击消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理魅族通知点击异常", e)
            }
        }
        
        /**
         * 处理魅族推送通知删除
         * 
         * @param context 应用上下文
         * @param title 通知标题
         * @param content 通知内容
         * @param selfDefineContentString 自定义内容
         */
        fun onNotificationDeleted(context: Context, title: String?, content: String?, selfDefineContentString: String?) {
            try {
                Log.d(TAG, "魅族通知被删除")
                
                val pushMessage = parseNotificationMessage(title, content, selfDefineContentString)
                if (pushMessage != null) {
                    // 可以在这里处理通知删除的统计逻辑
                    Log.d(TAG, "通知删除统计: ${pushMessage.pushLogId}")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理魅族通知删除异常", e)
            }
        }
        
        /**
         * 解析魅族透传消息为统一的PushMessage格式
         * 
         * @param message 透传消息内容
         */
        private fun parseTransparentMessage(message: String?): PushMessage? {
            return try {
                if (message.isNullOrEmpty()) {
                    Log.w(TAG, "魅族透传消息为空")
                    return null
                }
                
                // 尝试解析JSON格式的透传消息
                val data = mutableMapOf<String, String>()
                data["transparent_content"] = message
                
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
                Log.e(TAG, "解析魅族透传消息失败", e)
                null
            }
        }
        
        /**
         * 解析魅族通知消息为统一的PushMessage格式
         * 
         * @param title 通知标题
         * @param content 通知内容
         * @param selfDefineContentString 自定义内容字符串
         */
        private fun parseNotificationMessage(title: String?, content: String?, selfDefineContentString: String?): PushMessage? {
            return try {
                // 构建统一的推送消息对象
                val data = mutableMapOf<String, String>()
                
                // 添加基本信息
                if (!title.isNullOrEmpty()) data["title"] = title
                if (!content.isNullOrEmpty()) data["content"] = content
                
                // 解析自定义内容
                if (!selfDefineContentString.isNullOrEmpty()) {
                    data["self_define_content"] = selfDefineContentString
                    
                    try {
                        val jsonObject = org.json.JSONObject(selfDefineContentString)
                        jsonObject.keys().forEach { key ->
                            val value = jsonObject.optString(key, "")
                            if (value.isNotEmpty()) {
                                data[key] = value
                            }
                        }
                    } catch (e: Exception) {
                        // 如果不是JSON格式，保持原始内容
                        Log.d(TAG, "自定义内容不是JSON格式，保持原始内容")
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
                Log.e(TAG, "解析魅族通知消息失败", e)
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
 * 魅族推送消息接收器实现类
 * 
 * 这个类需要在应用的 AndroidManifest.xml 中注册，并继承自 MzPushMessageReceiver
 * 由于我们使用 compileOnly 依赖，这里提供一个基础实现供应用参考
 */
@SuppressLint("LongLogTag")
abstract class BaseMeizuPushMessageReceiver {
    
    companion object {
        private const val TAG = "BaseMeizuPushMessageReceiver"
    }
    
    /**
     * 推送服务注册成功回调
     * 
     * @param context 应用上下文
     * @param pushId 推送ID
     */
    open fun onPushIdReceived(context: Context, pushId: String?) {
        Log.d(TAG, "魅族推送注册成功")
        MeizuPushReceiver.onPushIdReceived(context, pushId)
    }
    
    /**
     * 接收透传消息
     * 
     * @param context 应用上下文
     * @param message 透传消息内容
     */
    open fun onTransparentMessage(context: Context, message: String?) {
        Log.d(TAG, "收到魅族透传消息")
        MeizuPushReceiver.onTransparentMessage(context, message)
    }
    
    /**
     * 通知消息到达
     * 
     * @param context 应用上下文
     * @param title 消息标题
     * @param content 消息内容
     * @param selfDefineContentString 自定义内容
     */
    open fun onNotificationArrived(context: Context, title: String?, content: String?, selfDefineContentString: String?) {
        Log.d(TAG, "魅族通知消息到达")
        MeizuPushReceiver.onNotificationArrived(context, title, content, selfDefineContentString)
    }
    
    /**
     * 通知消息被点击
     * 
     * @param context 应用上下文
     * @param title 消息标题
     * @param content 消息内容
     * @param selfDefineContentString 自定义内容
     */
    open fun onNotificationClicked(context: Context, title: String?, content: String?, selfDefineContentString: String?) {
        Log.d(TAG, "魅族推送通知消息被点击")
        MeizuPushReceiver.onNotificationClicked(context, title, content, selfDefineContentString)
    }
    
    /**
     * 通知消息被删除
     * 
     * @param context 应用上下文
     * @param title 消息标题
     * @param content 消息内容
     * @param selfDefineContentString 自定义内容
     */
    open fun onNotificationDeleted(context: Context, title: String?, content: String?, selfDefineContentString: String?) {
        Log.d(TAG, "魅族推送通知消息被删除")
        MeizuPushReceiver.onNotificationDeleted(context, title, content, selfDefineContentString)
    }
    
    /**
     * 订阅标签结果回调
     * 
     * @param context 应用上下文
     * @param result 操作结果
     * @param tags 标签列表
     */
    open fun onSubscribeTagsResult(context: Context, result: Boolean, tags: List<String>?) {
        Log.d(TAG, "魅族推送订阅标签结果: result=$result, tags=$tags")
    }
    
    /**
     * 取消订阅标签结果回调
     * 
     * @param context 应用上下文
     * @param result 操作结果
     * @param tags 标签列表
     */
    open fun onUnsubscribeTagsResult(context: Context, result: Boolean, tags: List<String>?) {
        Log.d(TAG, "魅族推送取消订阅标签结果: result=$result, tags=$tags")
    }
    
    /**
     * 检查推送状态结果回调
     * 
     * @param context 应用上下文
     * @param enabled 推送是否开启
     */
    open fun onPushStatusChanged(context: Context, enabled: Boolean) {
        Log.d(TAG, "魅族推送状态改变: enabled=$enabled")
    }
}

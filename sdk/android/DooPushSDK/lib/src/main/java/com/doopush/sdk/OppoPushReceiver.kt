package com.doopush.sdk

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.util.Log
import com.doopush.sdk.models.PushMessage

/**
 * OPPO推送消息接收器
 * 
 * 处理OPPO推送的消息接收、点击和统计上报
 */
class OppoPushReceiver {
    
    companion object {
        private const val TAG = "OppoPushReceiver"
        
        // 全局的服务实例（用于处理回调）
        @SuppressLint("StaticFieldLeak")
        private var globalOppoService: OppoService? = null
        
        /**
         * 设置服务实例（供 DooPushManager 调用）
         */
        internal fun setService(service: OppoService) {
            globalOppoService = service
        }
        
        /**
         * 检查OPPO推送接收器是否可用
         */
        fun isReceiverAvailable(): Boolean {
            return try {
                Class.forName("com.heytap.msp.push.callback.ICallBackResultService")
                true
            } catch (e: ClassNotFoundException) {
                Log.d(TAG, "OPPO接收器不可用")
                false
            }
        }
        
        /**
         * 处理OPPO推送注册成功回调
         * 
         * @param context 应用上下文
         * @param registerId 注册成功的RegisterId
         */
        fun onRegister(context: Context, registerId: String?) {
            try {
                Log.d(TAG, "收到OPPO注册结果")
                if (!registerId.isNullOrEmpty()) {
                    Log.d(TAG, "OPPO注册成功: ${registerId.substring(0, 12)}...")
                    globalOppoService?.handleRegisterSuccess(registerId)
                } else {
                    // 尝试直接从 OPPO SDK 获取 RegisterId
                    Log.d(TAG, "RegisterId为空，尝试从HeytapPushManager获取")
                    val cachedRegisterId = getRegisterIdFromHeytapPushManager()
                    
                    if (!cachedRegisterId.isNullOrEmpty()) {
                        Log.d(TAG, "直接获取RegisterId成功")
                        globalOppoService?.handleRegisterSuccess(cachedRegisterId)
                    } else {
                        // 有些机型需要等待一小段时间
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            val delayedRegisterId = getRegisterIdFromHeytapPushManager()
                            if (!delayedRegisterId.isNullOrEmpty()) {
                                Log.d(TAG, "延迟获取RegisterId成功")
                                globalOppoService?.handleRegisterSuccess(delayedRegisterId)
                            } else {
                                Log.e(TAG, "OPPO注册失败: 无法获取RegisterId")
                                globalOppoService?.handleRegisterError("无法获取RegisterId")
                            }
                        }, 1000)
                    }
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理OPPO注册结果异常", e)
                globalOppoService?.handleRegisterError("处理注册结果异常: ${e.message}")
            }
        }
        
        /**
         * 处理OPPO推送注册失败回调
         * 
         * @param context 应用上下文
         * @param errorCode 错误码
         * @param errorMsg 错误消息
         */
        fun onUnRegister(context: Context, errorCode: Int, errorMsg: String?) {
            try {
                Log.e(TAG, "OPPO注册失败: code=$errorCode, msg=$errorMsg")
                globalOppoService?.handleRegisterError("注册失败: $errorCode - $errorMsg")
            } catch (e: Exception) {
                Log.e(TAG, "处理OPPO注册失败异常", e)
                globalOppoService?.handleRegisterError("处理注册失败异常: ${e.message}")
            }
        }
        
        /**
         * 直接从HeytapPushManager获取RegisterId
         */
        private fun getRegisterIdFromHeytapPushManager(): String? {
            return try {
                val heytapPushManagerClass = Class.forName("com.heytap.msp.push.HeytapPushManager")
                val getRegisterIdMethod = heytapPushManagerClass.getMethod("getRegisterID")
                val registerId = getRegisterIdMethod.invoke(null) as? String
                Log.d(TAG, "获取RegisterId: ${if (registerId.isNullOrEmpty()) "null" else "success"}")
                registerId
            } catch (e: Exception) {
                Log.d(TAG, "获取RegisterId失败", e)
                null
            }
        }
        
        /**
         * 处理OPPO推送消息接收
         * 
         * @param context 应用上下文
         * @param messageType 消息类型
         * @param messageData 消息数据
         */
        fun onReceiveMessage(context: Context, messageType: Int, messageData: String?) {
            try {
                Log.d(TAG, "收到OPPO消息 type=$messageType")
                
                val pushMessage = parsePushMessage(messageType, messageData)
                if (pushMessage != null) {
                    // 通知 DooPushManager
                    val manager = DooPushManager.getInstance()
                    val callback = manager.getInternalCallback()
                    callback?.onMessageReceived(pushMessage)
                    
                    // 上报统计数据
                    reportMessageReceived(pushMessage)
                } else {
                    Log.w(TAG, "解析OPPO消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理OPPO消息异常", e)
            }
        }
        
        /**
         * 处理OPPO推送通知栏消息点击
         * 
         * @param context 应用上下文
         * @param messageType 消息类型
         * @param messageData 消息数据
         */
        fun onNotificationMessageClicked(context: Context, messageType: Int, messageData: String?) {
            try {
                Log.d(TAG, "OPPO通知被点击 type=$messageType")
                
                val pushMessage = parsePushMessage(messageType, messageData)
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
                    Log.w(TAG, "解析OPPO点击消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理OPPO通知点击异常", e)
            }
        }
        
        /**
         * 处理OPPO推送通知栏消息到达
         * 
         * @param context 应用上下文
         * @param messageType 消息类型
         * @param messageData 消息数据
         */
        fun onNotificationMessageArrived(context: Context, messageType: Int, messageData: String?) {
            try {
                Log.d(TAG, "OPPO通知到达 type=$messageType")
                
                val pushMessage = parsePushMessage(messageType, messageData)
                if (pushMessage != null) {
                    // 上报消息到达统计
                    reportMessageArrived(pushMessage)
                } else {
                    Log.w(TAG, "解析OPPO到达消息失败")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "处理OPPO通知到达异常", e)
            }
        }
        
        /**
         * 解析OPPO推送消息为统一的PushMessage格式
         * 
         * @param messageType 消息类型
         * @param messageData 消息数据（JSON字符串）
         */
        private fun parsePushMessage(messageType: Int, messageData: String?): PushMessage? {
            return try {
                if (messageData.isNullOrEmpty()) {
                    Log.w(TAG, "OPPO消息数据为空")
                    return null
                }
                
                // 解析JSON消息数据
                val jsonObject = org.json.JSONObject(messageData)
                
                // 获取基本信息
                val title = jsonObject.optString("title", "")
                val content = jsonObject.optString("content", "")
                val customData = jsonObject.optJSONObject("custom_data")
                
                // 构建统一的推送消息对象
                val data = mutableMapOf<String, String>()
                
                // 添加OPPO特有数据
                if (title.isNotEmpty()) data["title"] = title
                if (content.isNotEmpty()) data["content"] = content
                data["message_type"] = messageType.toString()
                
                // 添加自定义数据
                customData?.let { custom ->
                    custom.keys().forEach { key ->
                        val value = custom.optString(key, "")
                        if (value.isNotEmpty()) {
                            data[key] = value
                        }
                    }
                }
                
                // 提取统计标识字段
                val pushLogId = data["push_log_id"]
                val dedupKey = data["dedup_key"]
                
                PushMessage(
                    messageId = System.currentTimeMillis().toString(),
                    title = if (title.isNotEmpty()) title else null,
                    body = if (content.isNotEmpty()) content else null,
                    data = data,
                    pushLogId = pushLogId,
                    dedupKey = dedupKey
                )
                
            } catch (e: Exception) {
                Log.e(TAG, "解析OPPO推送消息失败", e)
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
 * OPPO推送消息接收器实现类
 * 
 * 这个类需要在应用的 AndroidManifest.xml 中注册，并实现OPPO推送的回调接口
 * 由于我们使用 compileOnly 依赖，这里提供一个基础实现供应用参考
 */
@SuppressLint("LongLogTag")
abstract class BaseOppoPushMessageReceiver {
    
    companion object {
        private const val TAG = "BaseOppoPushMessageReceiver"
    }
    
    /**
     * 推送服务注册成功回调
     * 
     * @param context 应用上下文
     * @param registerId 注册ID
     */
    open fun onRegister(context: Context, registerId: String?) {
        Log.d(TAG, "OPPO推送注册成功")
        OppoPushReceiver.onRegister(context, registerId)
    }
    
    /**
     * 推送服务注册失败回调
     * 
     * @param context 应用上下文
     * @param errorCode 错误码
     * @param errorMsg 错误消息
     */
    open fun onUnRegister(context: Context, errorCode: Int, errorMsg: String?) {
        Log.d(TAG, "OPPO推送注册失败")
        OppoPushReceiver.onUnRegister(context, errorCode, errorMsg)
    }
    
    /**
     * 接收推送消息
     * 
     * @param context 应用上下文
     * @param messageType 消息类型
     * @param messageData 消息数据
     */
    open fun onReceiveMessage(context: Context, messageType: Int, messageData: String?) {
        Log.d(TAG, "收到OPPO推送消息")
        OppoPushReceiver.onReceiveMessage(context, messageType, messageData)
    }
    
    /**
     * 通知消息被点击
     * 
     * @param context 应用上下文
     * @param messageType 消息类型
     * @param messageData 消息数据
     */
    open fun onNotificationMessageClicked(context: Context, messageType: Int, messageData: String?) {
        Log.d(TAG, "OPPO推送通知消息被点击")
        OppoPushReceiver.onNotificationMessageClicked(context, messageType, messageData)
    }
    
    /**
     * 通知消息到达
     * 
     * @param context 应用上下文
     * @param messageType 消息类型
     * @param messageData 消息数据
     */
    open fun onNotificationMessageArrived(context: Context, messageType: Int, messageData: String?) {
        Log.d(TAG, "OPPO推送通知消息到达")
        OppoPushReceiver.onNotificationMessageArrived(context, messageType, messageData)
    }
    
    /**
     * 设置别名结果回调
     * 
     * @param context 应用上下文
     * @param result 设置结果
     * @param alias 别名
     */
    open fun onSetAliasResult(context: Context, result: Int, alias: String?) {
        Log.d(TAG, "OPPO推送设置别名结果: result=$result, alias=$alias")
    }
    
    /**
     * 取消设置别名结果回调
     * 
     * @param context 应用上下文
     * @param result 取消结果
     * @param alias 别名
     */
    open fun onUnsetAliasResult(context: Context, result: Int, alias: String?) {
        Log.d(TAG, "OPPO推送取消设置别名结果: result=$result, alias=$alias")
    }
}

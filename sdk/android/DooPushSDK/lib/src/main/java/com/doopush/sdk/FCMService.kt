package com.doopush.sdk

import android.content.Context
import android.util.Log
import com.doopush.sdk.models.DooPushError
import com.google.android.gms.tasks.OnCompleteListener
import com.google.firebase.messaging.FirebaseMessaging

/**
 * FCM 推送服务管理类
 * 
 * 负责Firebase Cloud Messaging的初始化、token获取和管理
 */
class FCMService(private val context: Context) {
    
    companion object {
        private const val TAG = "FCMService"
    }
    
    /**
     * FCM Token获取回调接口
     */
    interface TokenCallback {
        fun onSuccess(token: String)
        fun onError(error: DooPushError)
    }
    
    /**
     * 获取FCM Token
     * 
     * @param callback token获取回调
     */
    fun getToken(callback: TokenCallback) {
        try {
            FirebaseMessaging.getInstance().token
                .addOnCompleteListener(OnCompleteListener { task ->
                    if (!task.isSuccessful) {
                        Log.w(TAG, "FCM token获取失败", task.exception)
                        callback.onError(DooPushError.fcmTokenFailed(task.exception))
                        return@OnCompleteListener
                    }
                    
                    // 获取token成功
                    val token = task.result
                    if (!token.isNullOrEmpty()) {
                        Log.d(TAG, "FCM token获取成功: ${token.substring(0, 12)}...")
                        callback.onSuccess(token)
                    } else {
                        Log.e(TAG, "FCM token为空")
                        callback.onError(DooPushError(
                            code = DooPushError.FCM_TOKEN_FETCH_FAILED,
                            message = "FCM token为空"
                        ))
                    }
                })
        } catch (e: Exception) {
            Log.e(TAG, "获取FCM token时发生异常", e)
            callback.onError(DooPushError.fcmTokenFailed(e))
        }
    }
    
    /**
     * 删除FCM Token
     * 
     * @param callback 回调接口
     */
    fun deleteToken(callback: (Boolean) -> Unit) {
        try {
            FirebaseMessaging.getInstance().deleteToken()
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        Log.d(TAG, "FCM token删除成功")
                        callback(true)
                    } else {
                        Log.w(TAG, "FCM token删除失败", task.exception)
                        callback(false)
                    }
                }
        } catch (e: Exception) {
            Log.e(TAG, "删除FCM token时发生异常", e)
            callback(false)
        }
    }
    
    /**
     * 订阅主题
     * 
     * @param topic 主题名称
     * @param callback 回调接口
     */
    fun subscribeToTopic(topic: String, callback: (Boolean) -> Unit) {
        try {
            FirebaseMessaging.getInstance().subscribeToTopic(topic)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        Log.d(TAG, "订阅主题成功: $topic")
                        callback(true)
                    } else {
                        Log.w(TAG, "订阅主题失败: $topic", task.exception)
                        callback(false)
                    }
                }
        } catch (e: Exception) {
            Log.e(TAG, "订阅主题时发生异常: $topic", e)
            callback(false)
        }
    }
    
    /**
     * 取消订阅主题
     * 
     * @param topic 主题名称
     * @param callback 回调接口
     */
    fun unsubscribeFromTopic(topic: String, callback: (Boolean) -> Unit) {
        try {
            FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        Log.d(TAG, "取消订阅主题成功: $topic")
                        callback(true)
                    } else {
                        Log.w(TAG, "取消订阅主题失败: $topic", task.exception)
                        callback(false)
                    }
                }
        } catch (e: Exception) {
            Log.e(TAG, "取消订阅主题时发生异常: $topic", e)
            callback(false)
        }
    }
    
    /**
     * 检查Firebase服务是否可用
     * 
     * @return true if Firebase服务可用
     */
    fun isFirebaseAvailable(): Boolean {
        return try {
            // 尝试获取Firebase实例
            FirebaseMessaging.getInstance()
            true
        } catch (e: Exception) {
            Log.e(TAG, "Firebase服务不可用", e)
            false
        }
    }
    
    /**
     * 启用/禁用自动初始化
     * 
     * @param enabled 是否启用自动初始化
     */
    fun setAutoInitEnabled(enabled: Boolean) {
        try {
            FirebaseMessaging.getInstance().isAutoInitEnabled = enabled
            Log.d(TAG, "FCM自动初始化设置为: $enabled")
        } catch (e: Exception) {
            Log.e(TAG, "设置FCM自动初始化失败", e)
        }
    }
    
    /**
     * 获取当前自动初始化状态
     * 
     * @return 自动初始化状态
     */
    fun isAutoInitEnabled(): Boolean {
        return try {
            FirebaseMessaging.getInstance().isAutoInitEnabled
        } catch (e: Exception) {
            Log.e(TAG, "获取FCM自动初始化状态失败", e)
            true // 默认启用
        }
    }
    
    /**
     * 获取FCM服务状态信息（用于调试）
     * 
     * @return FCM状态信息字符串
     */
    fun getServiceStatus(): String {
        return try {
            val isAvailable = isFirebaseAvailable()
            val isAutoInit = isAutoInitEnabled()
            
            """
                |FCM服务状态:
                |  可用性: ${if (isAvailable) "可用" else "不可用"}
                |  自动初始化: ${if (isAutoInit) "启用" else "禁用"}
            """.trimMargin()
        } catch (e: Exception) {
            "FCM服务状态检查失败: ${e.message}"
        }
    }
}

package com.doopush.sdk

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.doopush.sdk.models.PushMessage
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * DooPush Firebase消息服务
 * 
 * 处理Firebase Cloud Messaging的消息接收和token刷新
 */
class DooPushFirebaseMessagingService : FirebaseMessagingService() {
    
    companion object {
        private const val TAG = "DooPushFCMService"
        private const val NOTIFICATION_CHANNEL_ID = "doopush_default_channel"
        private const val NOTIFICATION_ID_BASE = 10000
        
        /**
         * 全局消息监听器
         */
        var messageListener: MessageListener? = null
        
        /**
         * 全局Token刷新监听器
         */
        var tokenRefreshListener: TokenRefreshListener? = null
    }
    
    /**
     * 消息接收监听器
     */
    interface MessageListener {
        fun onMessageReceived(message: PushMessage)
    }
    
    /**
     * Token刷新监听器
     */
    interface TokenRefreshListener {
        fun onTokenRefresh(newToken: String)
    }
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "DooPush Firebase消息服务创建")
        
        // 创建通知渠道
        createNotificationChannel()
    }
    
    /**
     * 接收到推送消息时调用
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d(TAG, "收到FCM推送消息 From: ${remoteMessage.from}")
        
        try {
            // 转换为DooPush消息格式
            val pushMessage = PushMessage.fromFCMRemoteMessage(remoteMessage)
            
            // 通过DooPushNotificationHandler处理推送接收
            DooPushNotificationHandler.handleNotification(pushMessage)
            
            // 通知全局监听器 (保持兼容性)
            messageListener?.onMessageReceived(pushMessage)
            
            // 处理通知显示
            handleNotificationDisplay(pushMessage, remoteMessage)
            
            // 记录日志
            logMessageReceived(pushMessage)
            
        } catch (e: Exception) {
            Log.e(TAG, "处理推送消息时发生异常", e)
        }
    }
    
    /**
     * Token刷新时调用
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        
        Log.d(TAG, "FCM Token已刷新: ${token.substring(0, 12)}...")
        
        try {
            // 通知全局监听器
            tokenRefreshListener?.onTokenRefresh(token)
            
        } catch (e: Exception) {
            Log.e(TAG, "处理Token刷新时发生异常", e)
        }
    }
    
    /**
     * 处理通知显示
     */
    private fun handleNotificationDisplay(pushMessage: PushMessage, remoteMessage: RemoteMessage) {
        // 应用在前台时不显示系统通知；后台则无论是否有notification字段都显示
        if (isAppInForeground()) {
            Log.d(TAG, "跳过系统通知显示 (应用在前台)")
            return
        }
        
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // 构建通知（即使remoteMessage.notification为null也使用自定义内容）
            val notificationBuilder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setContentTitle(pushMessage.getDisplayTitle() ?: "新消息")
                .setContentText(pushMessage.getDisplayBody() ?: "")
                .setSmallIcon(R.drawable.ic_notification)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            
            // 设置点击意图
            val clickIntent = createNotificationClickIntent(pushMessage)
            if (clickIntent != null) {
                notificationBuilder.setContentIntent(clickIntent)
            }
            // 添加默认点击行为：无点击意图时也避免通知无响应（降级方案）
            if (clickIntent == null) {
                Log.w(TAG, "未能创建点击意图，使用降级方案")
                val fallbackIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                fallbackIntent?.let {
                    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    } else {
                        PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pi = PendingIntent.getActivity(this, 0, it, flags)
                    notificationBuilder.setContentIntent(pi)
                }
            }
            
            // 显示通知
            val notificationId = generateNotificationId(pushMessage)
            notificationManager.notify(notificationId, notificationBuilder.build())
            
            Log.d(TAG, "显示推送通知: ${pushMessage.getDisplayTitle()}")
            
        } catch (e: Exception) {
            Log.e(TAG, "显示通知时发生异常", e)
        }
    }
    
    /**
     * 创建通知渠道 (Android 8.0+)
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val channelName = getString(R.string.default_notification_channel_name)
                val channelDescription = getString(R.string.default_notification_channel_description)
                val importance = NotificationManager.IMPORTANCE_DEFAULT
                
                val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, channelName, importance).apply {
                    description = channelDescription
                }
                
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.createNotificationChannel(channel)
                
                Log.d(TAG, "创建通知渠道成功: $channelName")
                
            } catch (e: Exception) {
                Log.e(TAG, "创建通知渠道失败", e)
            }
        }
    }
    
    /**
     * 创建通知点击意图
     */
    private fun createNotificationClickIntent(pushMessage: PushMessage): PendingIntent? {
        return try {
            // 获取启动Activity的Intent
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                // 设置Intent标志
                launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                
                // 使用DooPushNotificationHandler添加推送点击数据
                DooPushNotificationHandler.addNotificationClickData(launchIntent, pushMessage)
                
                // 创建PendingIntent
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                
                PendingIntent.getActivity(this, pushMessage.hashCode(), launchIntent, flags)
            } else {
                Log.w(TAG, "无法获取启动Intent")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "创建通知点击意图失败", e)
            null
        }
    }
    
    /**
     * 生成通知ID
     */
    private fun generateNotificationId(pushMessage: PushMessage): Int {
        return try {
            // 使用push_log_id或dedup_key生成唯一ID
            val uniqueKey = pushMessage.pushLogId ?: pushMessage.dedupKey ?: pushMessage.messageId
            if (!uniqueKey.isNullOrEmpty()) {
                NOTIFICATION_ID_BASE + uniqueKey.hashCode()
            } else {
                NOTIFICATION_ID_BASE + System.currentTimeMillis().toInt()
            }
        } catch (e: Exception) {
            NOTIFICATION_ID_BASE + System.currentTimeMillis().toInt()
        }
    }
    
    /**
     * 检查应用是否在前台
     */
    private fun isAppInForeground(): Boolean {
        // 简单实现：假设如果DooPushManager有活动监听器，则应用在前台
        return DooPushManager.isInitialized() && DooPushManager.hasActiveCallback()
    }
    
    /**
     * 记录消息接收日志
     */
    private fun logMessageReceived(pushMessage: PushMessage) {
        try {
            val logInfo = StringBuilder()
            logInfo.append("FCM消息详情:")
            logInfo.append("\n  标题: ${pushMessage.getDisplayTitle() ?: "无"}")
            logInfo.append("\n  内容: ${pushMessage.getDisplayBody() ?: "无"}")
            logInfo.append("\n  推送ID: ${pushMessage.pushLogId ?: "无"}")
            logInfo.append("\n  去重键: ${pushMessage.dedupKey ?: "无"}")
            logInfo.append("\n  消息ID: ${pushMessage.messageId ?: "无"}")
            logInfo.append("\n  自定义数据: ${pushMessage.data.size}个字段")
            
            if (pushMessage.data.isNotEmpty()) {
                for ((key, value) in pushMessage.data) {
                    logInfo.append("\n    $key: $value")
                }
            }
            
            Log.i(TAG, logInfo.toString())
            
        } catch (e: Exception) {
            Log.e(TAG, "记录消息日志时发生异常", e)
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "DooPush Firebase消息服务销毁")
    }
}

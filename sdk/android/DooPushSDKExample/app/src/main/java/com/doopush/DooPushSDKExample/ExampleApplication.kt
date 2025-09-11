package com.doopush.DooPushSDKExample

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.doopush.sdk.DooPushManager

/**
 * ExampleApplication - 示例应用的Application类
 *
 * 用于全局初始化和配置
 */
class ExampleApplication : Application() {

    companion object {
        private const val TAG = "ExampleApplication"
        private const val NOTIFICATION_CHANNEL_ID = "doopush_example_channel"
    }

    override fun onCreate() {
        super.onCreate()

        Log.d(TAG, "ExampleApplication 初始化开始")

        // 创建通知渠道
        createNotificationChannel()

        // 注册应用生命周期处理器
        AppLifecycleHandler.register(this)

        // 这里不直接配置SDK，而是在MainActivity中配置
        // 因为配置可能需要用户输入或从配置文件读取

        Log.i(TAG, "ExampleApplication 初始化完成")
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

                val channel = NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    channelName,
                    importance
                ).apply {
                    description = channelDescription
                    enableLights(true)
                    enableVibration(true)
                }

                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.createNotificationChannel(channel)

                Log.d(TAG, "通知渠道创建成功: $channelName")

            } catch (e: Exception) {
                Log.e(TAG, "创建通知渠道失败", e)
            }
        }
    }

    override fun onTerminate() {
        super.onTerminate()

        try {
            // 应用终止时通知SDK并释放资源
            if (DooPushManager.isInitialized()) {
                DooPushManager.getInstance().applicationWillTerminate()
                DooPushManager.getInstance().release()
                Log.d(TAG, "SDK资源已释放")
            }
        } catch (e: Exception) {
            Log.e(TAG, "释放SDK资源时发生异常", e)
        }

        Log.d(TAG, "ExampleApplication 终止")
    }
}

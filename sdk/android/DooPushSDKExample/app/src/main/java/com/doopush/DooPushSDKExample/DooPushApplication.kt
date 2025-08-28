package com.doopush.DooPushSDKExample

import android.app.Application
import android.util.Log
import com.doopush.sdk.DooPushConfig
import com.doopush.sdk.DooPushManager
import com.doopush.sdk.DooPushError
import com.doopush.sdk.model.DooPushMessage

/**
 * DooPush SDK 示例应用 Application 类
 * 负责初始化 SDK 和全局配置
 */
class DooPushApplication : Application() {

    companion object {
        private const val TAG = "DooPushApplication"
    }

    override fun onCreate() {
        super.onCreate()

        Log.i(TAG, "DooPushApplication onCreate")

        // 打印配置信息
        AppConfig.printConfiguration()

        // 初始化 SDK
        initializeDooPushSDK()
    }

    private fun initializeDooPushSDK() {
        try {
            // 配置 DooPushSDK
            val config = DooPushConfig.development(
                appId = AppConfig.appId,
                apiKey = AppConfig.apiKey,
                baseURL = AppConfig.baseURL
            )

            Log.i(TAG, "初始化 DooPush SDK - AppID: ${config.appId}")

            // 初始化 SDK
            DooPushManager.instance.initialize(this, config)

            // 添加事件监听器
            DooPushManager.instance.addListener(object : com.doopush.sdk.DooPushListener {
                override fun onDeviceRegistered(deviceToken: String) {
                    Log.i(TAG, "设备注册成功: $deviceToken")
                }

                override fun onMessageReceived(message: DooPushMessage) {
                    Log.i(TAG, "收到推送消息: ${message.title}")
                }

                override fun onError(error: DooPushError) {
                    Log.e(TAG, "DooPush 错误: ${error.message}")
                }

                override fun onTCPConnectionStateChanged(state: com.doopush.sdk.tcp.DooPushTCPState) {
                    Log.i(TAG, "TCP连接状态变化: ${state.getDescription()}")
                }

                override fun onVendorInitialized(vendor: String) {
                    Log.i(TAG, "推送厂商初始化成功: $vendor")
                }

                override fun onVendorInitializationFailed(vendor: String, error: DooPushError) {
                    Log.e(TAG, "推送厂商初始化失败: $vendor - ${error.message}")
                }

                override fun onDeviceInfoUpdated() {
                    Log.i(TAG, "设备信息更新成功")
                }

                override fun onTCPDeviceRegistered() {
                    Log.i(TAG, "TCP设备注册成功")
                }

                override fun onTCPHeartbeatReceived() {
                    Log.d(TAG, "TCP心跳接收")
                }
            })

            Log.i(TAG, "DooPush SDK 初始化完成")

        } catch (e: Exception) {
            Log.e(TAG, "DooPush SDK 初始化失败", e)
        }
    }
}

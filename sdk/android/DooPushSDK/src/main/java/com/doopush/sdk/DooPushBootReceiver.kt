package com.doopush.sdk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * DooPush 开机广播接收器
 * 
 * 处理系统重启后的推送服务恢复
 */
class DooPushBootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "DooPushBootReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "收到系统广播: ${intent.action}")
        
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                Log.i(TAG, "系统开机完成，准备恢复推送服务")
                handleBootCompleted()
            }
            
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_PACKAGE_REPLACED -> {
                Log.i(TAG, "应用包更新完成，准备恢复推送服务")
                handlePackageReplaced(context, intent)
            }
        }
    }
    
    /**
     * 处理开机完成事件
     */
    private fun handleBootCompleted() {
        try {
            // 检查是否已配置
            if (DooPushManager.isInitialized()) {
                Log.d(TAG, "SDK已配置，开机后无需特殊处理")
                return
            }
            
            // 这里可以添加开机后的特殊处理逻辑
            // 比如重新获取FCM Token、重新注册设备等
            Log.d(TAG, "开机后推送服务恢复完成")
            
        } catch (e: Exception) {
            Log.e(TAG, "处理开机完成事件时发生异常", e)
        }
    }
    
    /**
     * 处理应用包更新事件
     */
    private fun handlePackageReplaced(context: Context, intent: Intent) {
        try {
            val packageName = intent.dataString?.removePrefix("package:")
            Log.d(TAG, "应用包已更新: $packageName")
            
            // 只处理自己的包更新事件
            if (packageName == context.packageName) {
                Log.i(TAG, "当前应用包已更新，推送服务将自动恢复")
                
                // 这里可以添加应用更新后的特殊处理逻辑
                // 比如清理旧的缓存数据、更新配置等
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "处理应用包更新事件时发生异常", e)
        }
    }
}

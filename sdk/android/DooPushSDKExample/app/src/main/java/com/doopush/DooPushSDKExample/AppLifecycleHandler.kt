package com.doopush.DooPushSDKExample

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.util.Log
import com.doopush.sdk.DooPushManager

/**
 * 应用生命周期处理器
 * 
 * 用于监听应用的生命周期变化，并通知DooPush SDK进行相应的处理
 */
class AppLifecycleHandler : Application.ActivityLifecycleCallbacks {
    
    companion object {
        private const val TAG = "AppLifecycleHandler"
        
        /**
         * 注册生命周期监听器
         */
        fun register(application: Application) {
            val handler = AppLifecycleHandler()
            application.registerActivityLifecycleCallbacks(handler)
            Log.d(TAG, "应用生命周期监听器已注册")
        }
    }
    
    private var activityCount = 0
    
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        Log.d(TAG, "Activity创建: ${activity.javaClass.simpleName}")
    }
    
    // 用 Started/Stopped（而不是 Resumed/Paused）跟踪可见 Activity 数：
    // 在 Android 跨 Activity 跳转时，新 Activity 的 onStart 先于旧 Activity 的 onStop，
    // 计数从 1→2→1，不会触达 0；Resumed/Paused 则会瞬时降到 0，导致内部跳转误判后台并重建 WebSocket。
    override fun onActivityStarted(activity: Activity) {
        activityCount++
        Log.d(TAG, "Activity启动: ${activity.javaClass.simpleName}, 活跃数量: $activityCount")

        if (activityCount == 1) {
            DooPushManager.getInstance().applicationDidBecomeActive(activity.applicationContext)
        }
    }

    override fun onActivityResumed(activity: Activity) {
        Log.d(TAG, "Activity恢复: ${activity.javaClass.simpleName}")
    }

    override fun onActivityPaused(activity: Activity) {
        Log.d(TAG, "Activity暂停: ${activity.javaClass.simpleName}")
    }

    override fun onActivityStopped(activity: Activity) {
        activityCount--
        Log.d(TAG, "Activity停止: ${activity.javaClass.simpleName}, 活跃数量: $activityCount")

        if (activityCount == 0) {
            DooPushManager.getInstance().applicationWillResignActive()
        }
    }
    
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {
        Log.v(TAG, "Activity保存状态: ${activity.javaClass.simpleName}")
    }
    
    override fun onActivityDestroyed(activity: Activity) {
        Log.d(TAG, "Activity销毁: ${activity.javaClass.simpleName}")
    }
}

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
    
    override fun onActivityStarted(activity: Activity) {
        Log.d(TAG, "Activity启动: ${activity.javaClass.simpleName}")
    }
    
    override fun onActivityResumed(activity: Activity) {
        activityCount++
        Log.d(TAG, "Activity恢复: ${activity.javaClass.simpleName}, 活跃数量: $activityCount")
        
        // 第一个Activity恢复时，通知SDK应用进入前台
        if (activityCount == 1) {
            DooPushManager.getInstance().applicationDidBecomeActive(activity.applicationContext)
        }
    }
    
    override fun onActivityPaused(activity: Activity) {
        activityCount--
        Log.d(TAG, "Activity暂停: ${activity.javaClass.simpleName}, 活跃数量: $activityCount")
        
        // 最后一个Activity暂停时，通知SDK应用进入后台
        if (activityCount == 0) {
            DooPushManager.getInstance().applicationWillResignActive()
        }
    }
    
    override fun onActivityStopped(activity: Activity) {
        Log.d(TAG, "Activity停止: ${activity.javaClass.simpleName}")
    }
    
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {
        Log.v(TAG, "Activity保存状态: ${activity.javaClass.simpleName}")
    }
    
    override fun onActivityDestroyed(activity: Activity) {
        Log.d(TAG, "Activity销毁: ${activity.javaClass.simpleName}")
    }
}

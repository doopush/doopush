package com.doopush.sdk

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Log

/**
 * 厂商系统通知的点击中转页（华为、荣耀、小米、OPPO、vivo、魅族）
 *
 * 厂商通知由系统直接展示，点击时不经过 SDK；服务端把点击动作指向本页面并通过 Intent extras
 * 携带推送数据。本页面无界面：分发点击事件（SDK 未就绪时暂存，配置完成/设置回调后补发），
 * 再把应用切到前台并立即关闭。
 */
class DooPushNotificationClickActivity : Activity() {

    companion object {
        private const val TAG = "DooPushClickActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 系统回收后重建时 extras 仍在，避免重复分发
        if (savedInstanceState == null) {
            handle(intent)
        }
        finish()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
        finish()
    }

    private fun handle(intent: Intent?) {
        if (intent != null) {
            DooPushNotificationHandler.handleNotificationClick(this, intent)
        }
        try {
            // 应用已在后台时只把原任务切到前台，不新建页面
            val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            }
            if (launch != null) {
                startActivity(launch)
            } else {
                Log.w(TAG, "未找到应用启动入口")
            }
        } catch (e: Exception) {
            Log.e(TAG, "打开应用失败", e)
        }
    }
}

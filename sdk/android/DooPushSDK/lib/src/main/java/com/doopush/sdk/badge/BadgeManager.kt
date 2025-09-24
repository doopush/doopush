/*
 * Copyright 2024 DooPush SDK
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.doopush.sdk.badge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentProviderClient
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.doopush.sdk.utils.DeviceBrand

/**
 * 角标管理器
 * 支持华为、小米、OPPO、VIVO等厂商的角标设置
 */
object BadgeManager {
    private const val TAG = "DooPush_BadgeManager"
    
    // 华为桌面
    private const val HUAWEI_LAUNCHER_CLASS = "com.huawei.android.launcher.LauncherProvider"

    // 小米桌面
    private const val XIAOMI_LAUNCHER_CLASS = "com.miui.home.launcher.Launcher"
    
    // OPPO桌面
    private const val OPPO_LAUNCHER_CLASS = "com.oppo.launcher.Launcher"
    
    // VIVO桌面
    private const val VIVO_LAUNCHER_CLASS = "com.vivo.launcher.Launcher"



    private fun getSystemProperty(key: String, defaultValue: String = ""): String {
        return try {
            val systemProperties = Class.forName("android.os.SystemProperties")
            val getMethod = systemProperties.getMethod("get", String::class.java, String::class.java)
            getMethod.invoke(null, key, defaultValue) as String
        } catch (e: Exception) {
            e.printStackTrace()
            defaultValue
        }
    }
    /**
     * 设置应用角标数量
     * @param context 应用上下文
     * @param count 角标数量，0表示清除角标
     * @return 是否设置成功
     */
    fun setBadgeCount(context: Context, count: Int, resId: Int, title: String, content: String): Boolean {
        Log.d(TAG, "设置角标数量: $count")
        
        return try {
            when {
                isHuaweiLauncher() -> setHuaweiBadge(context, count)
                isHonorLauncher() -> setHonorBadge(context, count)
                isXiaomiLauncher() -> setXiaomiBadge(context, count, resId, title, content)
                isOppoLauncher() -> setOppoBadge(context, count)
                isVivoLauncher() -> setVivoBadge(context, count)
                isMeiZuLauncher() -> setMeiZuBadge(context, count)
                else -> {
                    Log.w(TAG, "未识别的桌面类型，尝试通用方法")
                    setGenericBadge(context, count)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "设置角标失败", e)
            false
        }
    }
    
    /**
     * 判断是否为华为桌面
     */
    private fun isHuaweiLauncher(): Boolean {
        return isLauncherClassExists(HUAWEI_LAUNCHER_CLASS) || 
               Build.MANUFACTURER.equals("HUAWEI", ignoreCase = true)
    }

    /**
     * 判断是否为小米桌面
     */
    private fun isXiaomiLauncher(): Boolean {
        return isLauncherClassExists(XIAOMI_LAUNCHER_CLASS) ||
               Build.MANUFACTURER.equals("Xiaomi", ignoreCase = true)
    }
    
    /**
     * 判断是否为OPPO桌面
     */
    private fun isOppoLauncher(): Boolean {
        return isLauncherClassExists(OPPO_LAUNCHER_CLASS) ||
               Build.MANUFACTURER.equals("OPPO", ignoreCase = true)
    }
    
    /**
     * 判断是否为VIVO桌面
     */
    private fun isVivoLauncher(): Boolean {
        return isLauncherClassExists(VIVO_LAUNCHER_CLASS) ||
               Build.MANUFACTURER.equals("vivo", ignoreCase = true)
    }
    /**
     * 判断是否为MeiZu桌面
     */
    private fun isMeiZuLauncher(): Boolean {
        return DeviceBrand.isMeiZu()
    }
    /**
     * 判断是否为荣耀桌面
     */
    private fun isHonorLauncher(): Boolean {
        return DeviceBrand.isHonor();
    }
    /**
     * 检查桌面类是否存在
     */
    private fun isLauncherClassExists(className: String): Boolean {
        return try {
            Class.forName(className)
            true
        } catch (e: ClassNotFoundException) {
            false
        }
    }
    
    /**
     * 设置华为角标
     */
    private fun setHuaweiBadge(context: Context, count: Int): Boolean {
        return try {
            val launcherClassName = getLauncherClassName(context)
            if (launcherClassName.isNullOrEmpty()) {
                Log.w(TAG, "无法获取启动Activity类名")
                return false
            }
            Log.d(TAG, "荣耀设备设置角标: $count, Activity: $launcherClassName")
            val uri = Uri.parse("content://com.huawei.android.launcher.settings/badge/")
            val extra = Bundle().apply {
                putString("package", context.packageName) // 接入的App包名
                putString("class", getLauncherClassName(context))     // 接入的App class名
                putInt("badgenumber", count) // 目标的角标数
            }
            var client: ContentProviderClient? = null
            try {
                client = context.contentResolver.acquireUnstableContentProviderClient(uri)
                if (client != null) {
                    val result = client.call("change_badge", null, extra)?.getInt("result")
                    // 处理结果
                } else {
                    return false
                }
            } catch (e: Exception) {
                // TODO 调用角标接口失败或者不支持
                e.printStackTrace()
                return false
            } finally {
                client?.let {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        it.close()
                    } else {
                        it.release()
                    }
                }
            }
            // 方法2: 华为推送服务器已经处理了角标，这里只是确保兼容性
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置荣耀角标失败", e)
            false
        }
    }


    /**
     * 设置小米角标
     */
    private fun setXiaomiBadge(context: Context, count: Int, resId: Int, title: String, content: String): Boolean {
        return try {
            Log.d(TAG, "小米设备设置角标: $count")

            val code = getSystemProperty("ro.miui.ui.version.code", "")
            val intCode = code.toIntOrNull() ?: 0
            if (intCode >= 11) {
                // 获取通知管理类
                val mNotificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                // 通知在Android8.0之后需要创建通道，才能弹出来
                val channel = NotificationChannel("doopush", title, NotificationManager.IMPORTANCE_HIGH)
                mNotificationManager.createNotificationChannel(channel)

                val notification = Notification.Builder(context, "doopush")
                    .setSmallIcon(resId)
                    .setContentTitle(title)
                    .setContentText(content)
                    .setNumber(count)
                    .build()

                mNotificationManager.notify(0, notification)
            } else {
                // 获取通知管理类
                val mNotificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                // 通知在Android8.0之后需要创建通道，才能弹出来
                val channel = NotificationChannel("doopush", title, NotificationManager.IMPORTANCE_HIGH)
                mNotificationManager.createNotificationChannel(channel)

                val notification = Notification.Builder(context, "doopush")
                    .setSmallIcon(resId)
                    .setContentTitle(title)
                    .setContentText(content)
                    .build()
                val field = notification.javaClass.getDeclaredField("extraNotification")
                val extraNotification = field.get(notification)
                val method = extraNotification.javaClass.getDeclaredMethod("setMessageCount", Int::class.java)
                method.invoke(extraNotification, count)
                // 告诉系统要出现哪个通知
                mNotificationManager.notify(0, notification)
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置小米角标失败", e)
            false
        }
    }
    
    /**
     * 设置OPPO角标
     */
    private fun setOppoBadge(context: Context, count: Int): Boolean {
        return try {
            Log.d(TAG, "OPPO设备设置角标: $count")
            
            if (count <= 0) {
                // 清除角标
                val intent = Intent("com.oppo.unsettledevent").apply {
                    putExtra("packageName", context.packageName)
                    putExtra("number", 0)
                    putExtra("upgradeNumber", 0)
                }
                context.sendBroadcast(intent)
            } else {
                // 设置角标
                val intent = Intent("com.oppo.unsettledevent").apply {
                    putExtra("packageName", context.packageName)
                    putExtra("number", count)
                    putExtra("upgradeNumber", count)
                }
                context.sendBroadcast(intent)
            }
            
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置OPPO角标失败", e)
            false
        }
    }

    private fun invokeIntConstants(canonicalName: String?, fieldName: String, defaultValue: Int = 0): Int {
        if (canonicalName == null) {
            return defaultValue
        }
        return try {
            val c = Class.forName(canonicalName)
            val field: java.lang.reflect.Field = c.getField(fieldName)
            field.getInt(null) // For static fields, pass null to get()
        } catch (e: Exception) {
            e.printStackTrace()
            defaultValue
        }
    }
    /**
     * 设置VIVO角标
     */
    private fun setVivoBadge(context: Context, count: Int): Boolean {
        return try {
            Log.d(TAG, "VIVO设备设置角标: $count")

            val version = getSystemProperty("ro.vivo.os.build.display.id","Funtouch")
            if (version.contains("Origin")) {
                val uri = Uri.parse("content://com.vivo.abe.provider.launcher.notification.num")
                val extra = Bundle().apply {
                    putString("package", context.packageName) // 接入的App包名
                    putString("class", getLauncherClassName(context))     // 接入的App class名
                    putInt("badgenumber", count) // 目标的角标数
                }
                var client: ContentProviderClient? = null
                try {
                    client = context.contentResolver.acquireUnstableContentProviderClient(uri)
                    if (client != null) {
                        val result = client.call("change_badge", null, extra)?.getInt("result")
                        // 处理结果
                    } else {
                       return false
                    }
                } catch (e: Exception) {
                    // TODO 调用角标接口失败或者不支持
                    e.printStackTrace()
                    return false
                } finally {
                    client?.let {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            it.close()
                        } else {
                            it.release()
                        }
                    }
                }
            }else{
                val intent = Intent("launcher.action.CHANGE_APPLICATION_NOTIFICATION_NUM").apply {
                    putExtra("packageName", context.packageName)
                    putExtra("className", getLauncherClassName(context))
                    putExtra("notificationNum", count)
                    addFlags(invokeIntConstants(Intent::class.java.canonicalName, "FLAG_RECEIVER_INCLUDE_BACKGROUND"))
                }
                context.sendBroadcast(intent)
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置VIVO角标失败", e)
            false
        }
    }

    private fun setHonorBadge(context: Context, count: Int): Boolean {
        return try {
            val launcherClassName = getLauncherClassName(context)
            if (launcherClassName.isNullOrEmpty()) {
                Log.w(TAG, "无法获取启动Activity类名")
                return false
            }
            Log.d(TAG, "荣耀设备设置角标: $count, Activity: $launcherClassName")
            val uri = Uri.parse("content://com.hihonor.android.launcher.settings/badge/")
            val extra = Bundle().apply {
                putString("package", context.packageName) // 接入的App包名
                putString("class", getLauncherClassName(context))     // 接入的App class名
                putInt("badgenumber", count) // 目标的角标数
            }
            var client: ContentProviderClient? = null
            try {
                client = context.contentResolver.acquireUnstableContentProviderClient(uri)
                if (client != null) {
                    val result = client.call("change_badge", null, extra)?.getInt("result")
                    // 处理结果
                } else {
                    return false
                }
            } catch (e: Exception) {
                // TODO 调用角标接口失败或者不支持
                e.printStackTrace()
                return false
            } finally {
                client?.let {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        it.close()
                    } else {
                        it.release()
                    }
                }
            }
            // 方法2: 华为推送服务器已经处理了角标，这里只是确保兼容性
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置荣耀角标失败", e)
            false
        }
    }

    private fun setMeiZuBadge(context: Context, count: Int): Boolean {
        return try {
            val launcherClassName = getLauncherClassName(context)
            if (launcherClassName.isNullOrEmpty()) {
                Log.w(TAG, "无法获取启动Activity类名")
                return false
            }
            Log.d(TAG, "魅族设备设置角标: $count, Activity: $launcherClassName")
            val uri = Uri.parse("content://com.meizu.flyme.launcher.app_extras/badge_extras")
            val extra = Bundle().apply {
                putString("package", context.packageName) // 接入的App包名
                putString("class", getLauncherClassName(context))     // 接入的App class名
                putInt("badge_number", count) // 目标的角标数
            }
            var client: ContentProviderClient? = null
            try {
                client = context.contentResolver.acquireUnstableContentProviderClient(uri)
                if (client != null) {
                    val result = client.call("change_badge", null, extra)?.getInt("result")
                    // 处理结果
                } else {
                    return false
                }
            } catch (e: Exception) {
                // TODO 调用角标接口失败或者不支持
                e.printStackTrace()
                return false
            } finally {
                client?.let {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        it.close()
                    } else {
                        it.release()
                    }
                }
            }
            // 方法2: 华为推送服务器已经处理了角标，这里只是确保兼容性
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置荣耀角标失败", e)
            false
        }
    }

    /**
     * 通用角标设置方法
     */
    private fun setGenericBadge(context: Context, count: Int): Boolean {
        return try {
            Log.d(TAG, "使用通用方法设置角标: $count")
            
            // 尝试使用ShortcutBadger库的方法
            val intent = Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
                putExtra("badge_count", count)
                putExtra("badge_count_package_name", context.packageName)
                putExtra("badge_count_class_name", getLauncherClassName(context))
            }
            context.sendBroadcast(intent)
            
            true
        } catch (e: Exception) {
            Log.e(TAG, "通用角标设置失败", e)
            false
        }
    }
    
    /**
     * 获取启动Activity的类名
     */
    private fun getLauncherClassName(context: Context): String? {
        return try {
            val packageManager = context.packageManager
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
                setPackage(context.packageName)
            }
            
            val resolveInfo = packageManager.queryIntentActivities(intent, 0)
            if (resolveInfo.isNotEmpty()) {
                resolveInfo[0].activityInfo.name
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "获取启动Activity类名失败", e)
            null
        }
    }
    
    /**
     * 清除角标
     */
    fun clearBadge(context: Context): Boolean {
        return setBadgeCount(context, 0,0,"","")
    }
}

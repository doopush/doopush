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

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Build
import android.util.Log
import java.lang.reflect.Method

/**
 * 角标管理器
 * 支持华为、小米、OPPO、VIVO、三星等厂商的角标设置
 */
object BadgeManager {
    private const val TAG = "DooPush_BadgeManager"
    
    // 华为桌面
    private const val HUAWEI_LAUNCHER_CLASS = "com.huawei.android.launcher.LauncherProvider"
    private const val HUAWEI_LAUNCHER_PACKAGE = "com.huawei.android.launcher"
    
    // 小米桌面
    private const val XIAOMI_LAUNCHER_CLASS = "com.miui.home.launcher.Launcher"
    
    // OPPO桌面
    private const val OPPO_LAUNCHER_CLASS = "com.oppo.launcher.Launcher"
    
    // VIVO桌面
    private const val VIVO_LAUNCHER_CLASS = "com.vivo.launcher.Launcher"
    
    /**
     * 设置应用角标数量
     * @param context 应用上下文
     * @param count 角标数量，0表示清除角标
     * @return 是否设置成功
     */
    fun setBadgeCount(context: Context, count: Int): Boolean {
        Log.d(TAG, "设置角标数量: $count")
        
        return try {
            when {
                isHuaweiLauncher(context) -> setHuaweiBadge(context, count)
                isXiaomiLauncher(context) -> setXiaomiBadge(context, count)
                isOppoLauncher(context) -> setOppoBadge(context, count)
                isVivoLauncher(context) -> setVivoBadge(context, count)
                isSamsungLauncher(context) -> setSamsungBadge(context, count)
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
    private fun isHuaweiLauncher(context: Context): Boolean {
        return isLauncherClassExists(HUAWEI_LAUNCHER_CLASS) || 
               Build.MANUFACTURER.equals("HUAWEI", ignoreCase = true) ||
               Build.MANUFACTURER.equals("HONOR", ignoreCase = true)
    }
    
    /**
     * 判断是否为小米桌面
     */
    private fun isXiaomiLauncher(context: Context): Boolean {
        return isLauncherClassExists(XIAOMI_LAUNCHER_CLASS) ||
               Build.MANUFACTURER.equals("Xiaomi", ignoreCase = true)
    }
    
    /**
     * 判断是否为OPPO桌面
     */
    private fun isOppoLauncher(context: Context): Boolean {
        return isLauncherClassExists(OPPO_LAUNCHER_CLASS) ||
               Build.MANUFACTURER.equals("OPPO", ignoreCase = true)
    }
    
    /**
     * 判断是否为VIVO桌面
     */
    private fun isVivoLauncher(context: Context): Boolean {
        return isLauncherClassExists(VIVO_LAUNCHER_CLASS) ||
               Build.MANUFACTURER.equals("vivo", ignoreCase = true)
    }
    
    /**
     * 判断是否为三星桌面
     */
    private fun isSamsungLauncher(context: Context): Boolean {
        return Build.MANUFACTURER.equals("samsung", ignoreCase = true)
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
            
            Log.d(TAG, "华为设备设置角标: $count, Activity: $launcherClassName")
            
            // 方法1: 使用广播方式
            val intent = Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
                putExtra("badge_count", count)
                putExtra("badge_count_package_name", context.packageName)
                putExtra("badge_count_class_name", launcherClassName)
            }
            context.sendBroadcast(intent)
            
            // 方法2: 华为推送服务器已经处理了角标，这里只是确保兼容性
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置华为角标失败", e)
            false
        }
    }
    
    /**
     * 设置小米角标
     */
    private fun setXiaomiBadge(context: Context, count: Int): Boolean {
        return try {
            Log.d(TAG, "小米设备设置角标: $count")
            
            // 小米的角标需要通过NotificationManager
            val intent = Intent("android.intent.action.APPLICATION_MESSAGE_UPDATE").apply {
                putExtra("android.intent.extra.update_application_component_name", 
                        "${context.packageName}/${getLauncherClassName(context)}")
                putExtra("android.intent.extra.update_application_message_text", 
                        if (count > 0) count.toString() else "")
            }
            context.sendBroadcast(intent)
            
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
    
    /**
     * 设置VIVO角标
     */
    private fun setVivoBadge(context: Context, count: Int): Boolean {
        return try {
            Log.d(TAG, "VIVO设备设置角标: $count")
            
            val intent = Intent("launcher.action.CHANGE_APPLICATION_NOTIFICATION_NUM").apply {
                putExtra("packageName", context.packageName)
                putExtra("className", getLauncherClassName(context))
                putExtra("notificationNum", count)
            }
            context.sendBroadcast(intent)
            
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置VIVO角标失败", e)
            false
        }
    }
    
    /**
     * 设置三星角标
     */
    private fun setSamsungBadge(context: Context, count: Int): Boolean {
        return try {
            Log.d(TAG, "三星设备设置角标: $count")
            
            val intent = Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
                putExtra("badge_count", count)
                putExtra("badge_count_package_name", context.packageName)
                putExtra("badge_count_class_name", getLauncherClassName(context))
            }
            context.sendBroadcast(intent)
            
            true
        } catch (e: Exception) {
            Log.e(TAG, "设置三星角标失败", e)
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
        return setBadgeCount(context, 0)
    }
}

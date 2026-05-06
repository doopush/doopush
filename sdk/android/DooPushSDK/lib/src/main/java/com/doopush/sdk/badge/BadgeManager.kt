/*
 * Copyright 2024 DooPush SDK
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

package com.doopush.sdk.badge

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentProviderClient
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import com.doopush.sdk.R

/**
 * 角标管理器
 * 支持华为、荣耀、小米、OPPO、VIVO、魅族等厂商的角标设置
 */
object BadgeManager {
    private const val TAG = "DooPush_BadgeManager"

    private enum class Vendor { HUAWEI, HONOR, XIAOMI, OPPO, VIVO, MEIZU, GENERIC }

    private val vendor: Vendor by lazy { detectVendor() }

    private fun detectVendor(): Vendor {
        val manufacturer = android.os.Build.MANUFACTURER ?: ""
        return when {
            manufacturer.equals("HONOR", ignoreCase = true) -> Vendor.HONOR
            manufacturer.equals("HUAWEI", ignoreCase = true) -> Vendor.HUAWEI
            manufacturer.equals("Xiaomi", ignoreCase = true) -> Vendor.XIAOMI
            manufacturer.equals("OPPO", ignoreCase = true) -> Vendor.OPPO
            manufacturer.equals("vivo", ignoreCase = true) -> Vendor.VIVO
            manufacturer.equals("MEIZU", ignoreCase = true) -> Vendor.MEIZU
            else -> Vendor.GENERIC
        }
    }

    private fun getSystemProperty(key: String, defaultValue: String = ""): String {
        return try {
            val cls = Class.forName("android.os.SystemProperties")
            val getMethod = cls.getMethod("get", String::class.java, String::class.java)
            getMethod.invoke(null, key, defaultValue) as String
        } catch (e: Exception) {
            defaultValue
        }
    }

    /**
     * 设置应用角标数量
     * @param count 角标数量，0表示清除角标
     */
    fun setBadgeCount(context: Context, count: Int): Boolean {
        Log.d(TAG, "设置角标数量: $count, vendor=$vendor")
        return try {
            when (vendor) {
                Vendor.HUAWEI -> setHuaweiBadge(context, count)
                Vendor.HONOR -> setHonorBadge(context, count)
                Vendor.XIAOMI -> setXiaomiBadge(context, count)
                Vendor.OPPO -> setOppoBadge(context, count)
                Vendor.VIVO -> setVivoBadge(context, count)
                Vendor.MEIZU -> setMeiZuBadge(context, count)
                Vendor.GENERIC -> setGenericBadge(context, count)
            }
        } catch (e: Exception) {
            Log.e(TAG, "设置角标失败", e)
            false
        }
    }

    fun clearBadge(context: Context): Boolean = setBadgeCount(context, 0)

    /**
     * 通过 ContentProvider 设置角标，适用于华为/荣耀/魅族/Vivo Origin OS。
     */
    private fun callBadgeProvider(
        context: Context,
        uri: Uri,
        count: Int,
        numberKey: String = "badgenumber",
    ): Boolean {
        val launcherClassName = getLauncherClassName(context)
        if (launcherClassName.isNullOrEmpty()) {
            Log.w(TAG, "无法获取启动Activity类名")
            return false
        }
        val extra = Bundle().apply {
            putString("package", context.packageName)
            putString("class", launcherClassName)
            putInt(numberKey, count)
        }
        val client: ContentProviderClient =
            context.contentResolver.acquireUnstableContentProviderClient(uri) ?: return false
        return try {
            client.call("change_badge", null, extra)
            true
        } catch (e: Exception) {
            Log.e(TAG, "调用角标 ContentProvider 失败: $uri", e)
            false
        } finally {
            client.close()
        }
    }

    private fun setHuaweiBadge(context: Context, count: Int): Boolean {
        Log.d(TAG, "华为设备设置角标: $count")
        return callBadgeProvider(
            context,
            Uri.parse("content://com.huawei.android.launcher.settings/badge/"),
            count,
        )
    }

    private fun setHonorBadge(context: Context, count: Int): Boolean {
        Log.d(TAG, "荣耀设备设置角标: $count")
        return callBadgeProvider(
            context,
            Uri.parse("content://com.hihonor.android.launcher.settings/badge/"),
            count,
        )
    }

    private fun setMeiZuBadge(context: Context, count: Int): Boolean {
        Log.d(TAG, "魅族设备设置角标: $count")
        return callBadgeProvider(
            context,
            Uri.parse("content://com.meizu.flyme.launcher.app_extras/badge_extras"),
            count,
            numberKey = "badge_number",
        )
    }

    private fun setXiaomiBadge(context: Context, count: Int): Boolean {
        Log.d(TAG, "小米设备设置角标: $count")
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val miuiVersion = getSystemProperty("ro.miui.ui.version.code", "").toIntOrNull() ?: 0
        if (miuiVersion >= 11) {
            val channel = NotificationChannel("doopush_channel", "doopush", NotificationManager.IMPORTANCE_HIGH)
            nm.createNotificationChannel(channel)
            val notification = Notification.Builder(context, "doopush_channel")
                .setSmallIcon(R.drawable.ic_transparent)
                .setContentTitle("")
                .setContentText("")
                .setNumber(count)
                .build()
            nm.notify(0, notification)
        } else {
            val channel = NotificationChannel("doopush", "", NotificationManager.IMPORTANCE_HIGH)
            nm.createNotificationChannel(channel)
            val notification = Notification.Builder(context, "doopush")
                .setSmallIcon(R.drawable.ic_transparent)
                .setContentTitle("")
                .setContentText("")
                .build()
            // MIUI < 11 走反射设置 setMessageCount
            val field = notification.javaClass.getDeclaredField("extraNotification")
            val extra = field.get(notification)
            extra.javaClass.getDeclaredMethod("setMessageCount", Int::class.java).invoke(extra, count)
            nm.notify(0, notification)
        }
        return true
    }

    private fun setOppoBadge(context: Context, count: Int): Boolean {
        Log.d(TAG, "OPPO设备设置角标: $count")
        val n = if (count <= 0) 0 else count
        val intent = Intent("com.oppo.unsettledevent").apply {
            putExtra("packageName", context.packageName)
            putExtra("number", n)
            putExtra("upgradeNumber", n)
        }
        context.sendBroadcast(intent)
        return true
    }

    @SuppressLint("WrongConstant")
    private fun setVivoBadge(context: Context, count: Int): Boolean {
        Log.d(TAG, "VIVO设备设置角标: $count")
        val osBuild = getSystemProperty("ro.vivo.os.build.display.id", "Funtouch")
        if (osBuild.contains("Origin")) {
            return callBadgeProvider(
                context,
                Uri.parse("content://com.vivo.abe.provider.launcher.notification.num"),
                count,
            )
        }
        // FLAG_RECEIVER_INCLUDE_BACKGROUND 在 framework 中标记为 @hide，未暴露到 SDK，需用字面量。
        val flagReceiverIncludeBackground = 0x01000000
        val intent = Intent("launcher.action.CHANGE_APPLICATION_NOTIFICATION_NUM").apply {
            putExtra("packageName", context.packageName)
            putExtra("className", getLauncherClassName(context))
            putExtra("notificationNum", count)
            addFlags(flagReceiverIncludeBackground)
        }
        context.sendBroadcast(intent)
        return true
    }

    private fun setGenericBadge(context: Context, count: Int): Boolean {
        Log.d(TAG, "使用通用方法设置角标: $count")
        val intent = Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
            putExtra("badge_count", count)
            putExtra("badge_count_package_name", context.packageName)
            putExtra("badge_count_class_name", getLauncherClassName(context))
        }
        context.sendBroadcast(intent)
        return true
    }

    private fun getLauncherClassName(context: Context): String? {
        return try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
                setPackage(context.packageName)
            }
            context.packageManager.queryIntentActivities(intent, 0)
                .firstOrNull()?.activityInfo?.name
        } catch (e: Exception) {
            Log.e(TAG, "获取启动Activity类名失败", e)
            null
        }
    }
}

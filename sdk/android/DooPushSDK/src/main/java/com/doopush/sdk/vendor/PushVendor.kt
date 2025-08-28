package com.doopush.sdk.vendor

import android.content.Context
import com.doopush.sdk.DooPushError
import com.doopush.sdk.model.DooPushMessage

/**
 * 推送厂商抽象接口
 */
abstract class PushVendor {
    
    /**
     * 厂商名称
     */
    abstract val vendorName: String
    
    /**
     * 是否支持当前设备
     */
    abstract fun isSupported(context: Context): Boolean
    
    /**
     * 初始化推送服务
     * @param context 应用上下文
     * @param appId 应用ID
     * @param appKey 应用密钥
     * @param callback 初始化结果回调
     */
    abstract fun initialize(
        context: Context,
        appId: String,
        appKey: String,
        callback: (DooPushError?) -> Unit
    )
    
    /**
     * 注册推送通知
     * @param callback 注册结果回调，返回设备token或错误
     */
    abstract fun registerForPushNotifications(
        callback: (String?, DooPushError?) -> Unit
    )
    
    /**
     * 解析推送消息
     * @param intent 推送Intent
     * @return 解析后的推送消息，如果不是该厂商的消息则返回null
     */
    abstract fun parseMessage(intent: android.content.Intent): DooPushMessage?
    
    /**
     * 解析推送消息（从Bundle）
     * @param bundle 推送数据Bundle
     * @return 解析后的推送消息，如果不是该厂商的消息则返回null
     */
    abstract fun parseMessage(bundle: android.os.Bundle): DooPushMessage?
    
    /**
     * 设置别名
     * @param alias 用户别名
     * @param callback 设置结果回调
     */
    open fun setAlias(alias: String, callback: ((DooPushError?) -> Unit)? = null) {
        // 默认空实现
        callback?.invoke(DooPushError.VendorNotSupported(vendorName))
    }
    
    /**
     * 设置标签
     * @param tags 标签列表
     * @param callback 设置结果回调
     */
    open fun setTags(tags: List<String>, callback: ((DooPushError?) -> Unit)? = null) {
        // 默认空实现
        callback?.invoke(DooPushError.VendorNotSupported(vendorName))
    }
    
    /**
     * 获取设备token
     */
    abstract fun getDeviceToken(): String?
    
    /**
     * 是否已初始化
     */
    abstract fun isInitialized(): Boolean
    
    /**
     * 销毁推送服务
     */
    open fun destroy() {
        // 默认空实现
    }
    
    /**
     * 获取厂商特定的配置信息
     */
    open fun getVendorInfo(): Map<String, Any> {
        return mapOf(
            "vendor" to vendorName,
            "supported" to true,
            "initialized" to isInitialized()
        )
    }
}

/**
 * 推送厂商类型枚举
 */
enum class PushVendorType(val vendorName: String, val packageName: String) {
    XIAOMI("xiaomi", "com.xiaomi.xmsf"),
    HUAWEI("huawei", "com.huawei.hwid"),
    OPPO("oppo", "com.heytap.mcs"),
    VIVO("vivo", "com.vivo.push"),
    MEIZU("meizu", "com.meizu.flyme.push"),
    HONOR("honor", "com.hihonor.push"),
    FCM("fcm", "com.google.android.gms");
    
    companion object {
        /**
         * 根据厂商名称获取类型
         */
        fun fromVendorName(name: String): PushVendorType? {
            return values().find { it.vendorName.equals(name, ignoreCase = true) }
        }
    }
}

/**
 * 推送厂商检测工具
 */
object PushVendorDetector {
    
    /**
     * 检测当前设备支持的推送厂商
     * @param context 应用上下文
     * @return 支持的厂商列表，按优先级排序
     */
    fun detectSupportedVendors(context: Context): List<PushVendorType> {
        val supportedVendors = mutableListOf<PushVendorType>()
        
        // 检测设备厂商
        val manufacturer = android.os.Build.MANUFACTURER.lowercase()
        val brand = android.os.Build.BRAND.lowercase()
        
        when {
            manufacturer.contains("xiaomi") || brand.contains("xiaomi") ||
            manufacturer.contains("redmi") || brand.contains("redmi") -> {
                supportedVendors.add(PushVendorType.XIAOMI)
            }
            manufacturer.contains("huawei") || brand.contains("huawei") -> {
                supportedVendors.add(PushVendorType.HUAWEI)
            }
            manufacturer.contains("oppo") || brand.contains("oppo") ||
            manufacturer.contains("oneplus") || brand.contains("oneplus") -> {
                supportedVendors.add(PushVendorType.OPPO)
            }
            manufacturer.contains("vivo") || brand.contains("vivo") ||
            manufacturer.contains("iqoo") || brand.contains("iqoo") -> {
                supportedVendors.add(PushVendorType.VIVO)
            }
            manufacturer.contains("meizu") || brand.contains("meizu") -> {
                supportedVendors.add(PushVendorType.MEIZU)
            }
            manufacturer.contains("honor") || brand.contains("honor") -> {
                supportedVendors.add(PushVendorType.HONOR)
            }
        }
        
        // 检测Google Play Services（FCM）
        if (isGooglePlayServicesAvailable(context)) {
            supportedVendors.add(PushVendorType.FCM)
        }
        
        // 如果没有检测到特定厂商，添加FCM作为备选
        if (supportedVendors.isEmpty()) {
            supportedVendors.add(PushVendorType.FCM)
        }
        
        return supportedVendors
    }
    
    /**
     * 检查是否安装了指定厂商的推送服务
     */
    fun isVendorServiceInstalled(context: Context, vendorType: PushVendorType): Boolean {
        return try {
            context.packageManager.getPackageInfo(vendorType.packageName, 0)
            true
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * 检查Google Play Services是否可用
     */
    private fun isGooglePlayServicesAvailable(context: Context): Boolean {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(
                "com.google.android.gms", 0
            )
            packageInfo.versionCode > 0
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * 获取设备信息用于调试
     */
    fun getDeviceInfo(): Map<String, String> {
        return mapOf(
            "manufacturer" to android.os.Build.MANUFACTURER,
            "brand" to android.os.Build.BRAND,
            "model" to android.os.Build.MODEL,
            "device" to android.os.Build.DEVICE,
            "product" to android.os.Build.PRODUCT,
            "sdk_int" to android.os.Build.VERSION.SDK_INT.toString(),
            "release" to android.os.Build.VERSION.RELEASE
        )
    }
}
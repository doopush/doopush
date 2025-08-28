package com.doopush.sdk.vendor

import android.content.Context
import com.doopush.sdk.DooPushError
import com.doopush.sdk.internal.DooPushLogger
import com.doopush.sdk.model.DooPushMessage
import com.doopush.sdk.vendor.xiaomi.XiaomiPushVendor
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 推送厂商管理器
 * 负责管理多个推送厂商，选择最适合的厂商进行推送
 */
class PushVendorManager(private val context: Context) {
    
    // 已注册的推送厂商列表
    private val vendors = mutableListOf<PushVendor>()
    
    // 当前激活的推送厂商
    private var activeVendor: PushVendor? = null
    
    // 初始化回调列表
    private val initializationCallbacks = CopyOnWriteArrayList<(String, DooPushError?) -> Unit>()
    
    // 是否已初始化
    private var isInitialized = false
    
    init {
        registerDefaultVendors()
    }
    
    /**
     * 注册默认的推送厂商
     */
    private fun registerDefaultVendors() {
        // 注册小米推送
        registerVendor(XiaomiPushVendor())
        
        // TODO: 注册其他厂商
        // registerVendor(HuaweiPushVendor())
        // registerVendor(OppoPushVendor())
        // registerVendor(VivoPushVendor())
        // registerVendor(MeizuPushVendor())
        // registerVendor(FCMPushVendor())
    }
    
    /**
     * 注册推送厂商
     */
    fun registerVendor(vendor: PushVendor) {
        if (!vendors.contains(vendor)) {
            vendors.add(vendor)
            DooPushLogger.info("注册推送厂商: ${vendor.vendorName}")
        }
    }
    
    /**
     * 初始化推送厂商
     * @param callback 初始化结果回调
     */
    fun initialize(callback: (String, DooPushError?) -> Unit) {
        if (isInitialized) {
            DooPushLogger.warning("推送厂商管理器已初始化")
            return
        }
        
        initializationCallbacks.add(callback)
        
        // 检测支持的厂商
        val supportedVendorTypes = PushVendorDetector.detectSupportedVendors(context)
        DooPushLogger.info("检测到支持的推送厂商: ${supportedVendorTypes.map { it.vendorName }}")
        
        // 按优先级尝试初始化厂商
        initializeVendorsInOrder(supportedVendorTypes)
    }
    
    /**
     * 按优先级初始化厂商
     */
    private fun initializeVendorsInOrder(supportedTypes: List<PushVendorType>) {
        if (supportedTypes.isEmpty()) {
            val error = DooPushError.VendorNotSupported("未找到支持的推送厂商")
            notifyInitializationResult("unknown", error)
            return
        }
        
        // 尝试初始化第一个支持的厂商
        val vendorType = supportedTypes.first()
        val vendor = findVendorByType(vendorType)
        
        if (vendor == null) {
            DooPushLogger.warning("未找到 ${vendorType.vendorName} 推送厂商实现")
            // 尝试下一个厂商
            val remainingTypes = supportedTypes.drop(1)
            initializeVendorsInOrder(remainingTypes)
            return
        }
        
        if (!vendor.isSupported(context)) {
            DooPushLogger.warning("${vendor.vendorName} 推送厂商不支持当前设备")
            // 尝试下一个厂商
            val remainingTypes = supportedTypes.drop(1)
            initializeVendorsInOrder(remainingTypes)
            return
        }
        
        DooPushLogger.info("开始初始化 ${vendor.vendorName} 推送厂商")
        
        // 初始化厂商（这里需要从配置中获取appId和appKey）
        vendor.initialize(context, getAppId(vendorType), getAppKey(vendorType)) { error ->
            if (error == null) {
                // 初始化成功
                activeVendor = vendor
                isInitialized = true
                DooPushLogger.info("${vendor.vendorName} 推送厂商初始化成功")
                notifyInitializationResult(vendor.vendorName, null)
            } else {
                // 初始化失败，尝试下一个厂商
                DooPushLogger.error("${vendor.vendorName} 推送厂商初始化失败: $error")
                val remainingTypes = supportedTypes.drop(1)
                if (remainingTypes.isNotEmpty()) {
                    initializeVendorsInOrder(remainingTypes)
                } else {
                    notifyInitializationResult(vendor.vendorName, error)
                }
            }
        }
    }
    
    /**
     * 根据类型查找厂商实现
     */
    private fun findVendorByType(type: PushVendorType): PushVendor? {
        return vendors.find { it.vendorName.equals(type.vendorName, ignoreCase = true) }
    }
    
    /**
     * 获取厂商的AppId（从AndroidManifest.xml的meta-data中获取）
     */
    private fun getAppId(vendorType: PushVendorType): String {
        return when (vendorType) {
            PushVendorType.XIAOMI -> getMetaDataValue("XIAOMI_APP_ID") ?: ""
            PushVendorType.HUAWEI -> getMetaDataValue("HUAWEI_APP_ID") ?: ""
            PushVendorType.OPPO -> getMetaDataValue("OPPO_APP_ID") ?: ""
            PushVendorType.VIVO -> getMetaDataValue("VIVO_APP_ID") ?: ""
            PushVendorType.MEIZU -> getMetaDataValue("MEIZU_APP_ID") ?: ""
            PushVendorType.HONOR -> getMetaDataValue("HONOR_APP_ID") ?: ""
            PushVendorType.FCM -> getMetaDataValue("FCM_SENDER_ID") ?: ""
        }
    }

    /**
     * 获取厂商的AppKey（从AndroidManifest.xml的meta-data中获取）
     */
    private fun getAppKey(vendorType: PushVendorType): String {
        return when (vendorType) {
            PushVendorType.XIAOMI -> getMetaDataValue("XIAOMI_APP_KEY") ?: ""
            PushVendorType.HUAWEI -> getMetaDataValue("HUAWEI_APP_KEY") ?: ""
            PushVendorType.OPPO -> getMetaDataValue("OPPO_APP_KEY") ?: ""
            PushVendorType.VIVO -> getMetaDataValue("VIVO_APP_KEY") ?: ""
            PushVendorType.MEIZU -> getMetaDataValue("MEIZU_APP_KEY") ?: ""
            PushVendorType.HONOR -> getMetaDataValue("HONOR_APP_KEY") ?: ""
            PushVendorType.FCM -> getMetaDataValue("FCM_SERVER_KEY") ?: ""
        }
    }

    /**
     * 从AndroidManifest.xml的meta-data中获取配置值
     */
    private fun getMetaDataValue(key: String): String? {
        return try {
            val applicationInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                android.content.pm.PackageManager.GET_META_DATA
            )
            applicationInfo.metaData?.getString(key)
        } catch (e: Exception) {
            DooPushLogger.warning("获取meta-data配置失败 $key: $e")
            null
        }
    }
    
    /**
     * 注册推送通知
     */
    fun registerForPushNotifications(callback: (String?, DooPushError?) -> Unit) {
        val vendor = activeVendor
        if (vendor == null) {
            callback(null, DooPushError.VendorNotSupported("没有可用的推送厂商"))
            return
        }
        
        if (!vendor.isInitialized()) {
            callback(null, DooPushError.VendorInitializationFailed(vendor.vendorName))
            return
        }
        
        DooPushLogger.info("使用 ${vendor.vendorName} 注册推送通知")
        vendor.registerForPushNotifications(callback)
    }
    
    /**
     * 解析推送消息
     */
    fun parseMessage(intent: android.content.Intent): DooPushMessage? {
        // 尝试用所有厂商解析消息
        for (vendor in vendors) {
            val message = vendor.parseMessage(intent)
            if (message != null) {
                DooPushLogger.info("使用 ${vendor.vendorName} 解析到推送消息")
                return message
            }
        }
        return null
    }
    
    /**
     * 解析推送消息（从Bundle）
     */
    fun parseMessage(bundle: android.os.Bundle): DooPushMessage? {
        // 尝试用所有厂商解析消息
        for (vendor in vendors) {
            val message = vendor.parseMessage(bundle)
            if (message != null) {
                DooPushLogger.info("使用 ${vendor.vendorName} 解析到推送消息")
                return message
            }
        }
        return null
    }
    
    /**
     * 设置别名
     */
    fun setAlias(alias: String, callback: ((DooPushError?) -> Unit)? = null) {
        val vendor = activeVendor
        if (vendor == null) {
            callback?.invoke(DooPushError.VendorNotSupported("没有可用的推送厂商"))
            return
        }
        
        vendor.setAlias(alias, callback)
    }
    
    /**
     * 设置标签
     */
    fun setTags(tags: List<String>, callback: ((DooPushError?) -> Unit)? = null) {
        val vendor = activeVendor
        if (vendor == null) {
            callback?.invoke(DooPushError.VendorNotSupported("没有可用的推送厂商"))
            return
        }
        
        vendor.setTags(tags, callback)
    }
    
    /**
     * 获取当前激活的厂商
     */
    fun getActiveVendor(): PushVendor? {
        return activeVendor
    }
    
    /**
     * 获取设备token
     */
    fun getDeviceToken(): String? {
        return activeVendor?.getDeviceToken()
    }
    
    /**
     * 获取所有厂商信息
     */
    fun getAllVendorInfo(): List<Map<String, Any>> {
        return vendors.map { it.getVendorInfo() }
    }
    
    /**
     * 销毁所有厂商
     */
    fun destroy() {
        vendors.forEach { it.destroy() }
        activeVendor = null
        isInitialized = false
        initializationCallbacks.clear()
    }
    
    /**
     * 通知初始化结果
     */
    private fun notifyInitializationResult(vendor: String, error: DooPushError?) {
        initializationCallbacks.forEach { it(vendor, error) }
    }
}
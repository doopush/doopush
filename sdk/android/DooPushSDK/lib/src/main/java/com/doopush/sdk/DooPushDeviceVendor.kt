package com.doopush.sdk

import android.content.Context
import android.os.Build
import android.util.Log

/**
 * 设备厂商识别和推送服务选择
 */
object DooPushDeviceVendor {
    
    private const val TAG = "DooPushDeviceVendor"
    
    /**
     * 支持的推送服务类型
     */
    enum class PushService {
        FCM,        // Firebase Cloud Messaging
        HMS,        // 华为移动服务
        MIPUSH,     // 小米推送
        OPPO,       // OPPO推送
        VIVO,       // VIVO推送
        HONOR       // 荣耀推送
    }
    
    /**
     * 设备厂商信息
     */
    data class DeviceVendorInfo(
        val manufacturer: String,
        val brand: String,
        val model: String,
        val preferredService: PushService,
        val supportedServices: List<PushService>
    )
    
    /**
     * 获取设备厂商信息
     */
    fun getDeviceVendorInfo(): DeviceVendorInfo {
        val manufacturer = Build.MANUFACTURER.uppercase()
        val brand = Build.BRAND.uppercase()
        val model = Build.MODEL
        
        val (preferredService, supportedServices) = when {
            // 华为设备
            manufacturer == "HUAWEI" -> {
                Log.d(TAG, "检测到华为设备")
                PushService.HMS to listOf(PushService.HMS, PushService.FCM)
            }
            
            // 荣耀设备（Honor从华为独立后）
            manufacturer == "HONOR" || brand == "HONOR" -> {
                Log.d(TAG, "检测到荣耀设备")
                PushService.HONOR to listOf(PushService.HONOR, PushService.FCM)
            }
            
            // 小米设备
            manufacturer == "XIAOMI" || brand == "XIAOMI" || brand == "REDMI" -> {
                Log.d(TAG, "检测到小米设备")
                PushService.MIPUSH to listOf(PushService.MIPUSH, PushService.FCM)
            }
            
            // OPPO设备
            manufacturer == "OPPO" || brand == "OPPO" -> {
                Log.d(TAG, "检测到OPPO设备")
                PushService.OPPO to listOf(PushService.OPPO, PushService.FCM)
            }
            
            // OnePlus设备（归属OPPO）
            manufacturer == "ONEPLUS" || brand == "ONEPLUS" -> {
                Log.d(TAG, "检测到OnePlus设备")
                PushService.OPPO to listOf(PushService.OPPO, PushService.FCM)
            }
            
            // VIVO设备
            manufacturer == "VIVO" || brand == "VIVO" -> {
                Log.d(TAG, "检测到VIVO设备")
                PushService.VIVO to listOf(PushService.VIVO, PushService.FCM)
            }
            
            // iQOO设备（归属VIVO）
            manufacturer == "IQOO" || brand == "IQOO" -> {
                Log.d(TAG, "检测到iQOO设备")
                PushService.VIVO to listOf(PushService.VIVO, PushService.FCM)
            }
            
            // 其他设备使用FCM
            else -> {
                Log.d(TAG, "检测到其他设备，使用FCM: $manufacturer")
                PushService.FCM to listOf(PushService.FCM)
            }
        }
        
        return DeviceVendorInfo(
            manufacturer = manufacturer,
            brand = brand,
            model = model,
            preferredService = preferredService,
            supportedServices = supportedServices
        )
    }
    
    /**
     * 检查指定推送服务是否在设备上可用
     */
    fun isServiceAvailable(context: Context, service: PushService): Boolean {
        return when (service) {
            PushService.FCM -> isFirebaseAvailable(context)
            PushService.HMS -> isHMSAvailable(context)
            PushService.MIPUSH -> isMiPushAvailable(context)
            PushService.OPPO -> isOppoPushAvailable(context)
            PushService.VIVO -> isVivoPushAvailable(context)
            PushService.HONOR -> isHonorPushAvailable(context)
        }
    }
    
    /**
     * 获取设备上可用的推送服务列表
     */
    fun getAvailableServices(context: Context): List<PushService> {
        val vendorInfo = getDeviceVendorInfo()
        return vendorInfo.supportedServices.filter { service ->
            isServiceAvailable(context, service)
        }
    }
    
    /**
     * 获取推荐的推送服务
     * 优先使用厂商推送服务，如果不可用则fallback到FCM
     */
    fun getRecommendedService(context: Context): PushService {
        val vendorInfo = getDeviceVendorInfo()
        val availableServices = getAvailableServices(context)
        
        // 优先使用设备厂商推荐的服务
        if (availableServices.contains(vendorInfo.preferredService)) {
            Log.d(TAG, "使用厂商推荐服务: ${vendorInfo.preferredService}")
            return vendorInfo.preferredService
        }
        
        // 如果厂商服务不可用，尝试FCM
        if (availableServices.contains(PushService.FCM)) {
            Log.d(TAG, "厂商服务不可用，fallback到FCM")
            return PushService.FCM
        }
        
        // 如果都不可用，返回FCM作为默认选择
        Log.w(TAG, "没有可用的推送服务，返回FCM作为默认选择")
        return PushService.FCM
    }
    
    /**
     * 检查Firebase是否可用
     */
    private fun isFirebaseAvailable(context: Context): Boolean {
        return try {
            Class.forName("com.google.firebase.messaging.FirebaseMessaging")
            true
        } catch (e: ClassNotFoundException) {
            Log.d(TAG, "Firebase不可用: ${e.message}")
            false
        } catch (e: Exception) {
            Log.w(TAG, "检查Firebase可用性时出错", e)
            false
        }
    }
    
    /**
     * 检查华为HMS是否可用
     */
    private fun isHMSAvailable(context: Context): Boolean {
        return try {
            // 检查是否为华为设备
            val vendorInfo = getDeviceVendorInfo()
            if (vendorInfo.preferredService != PushService.HMS) {
                return false
            }
            
            // 检查HMS Push SDK是否可用
            Class.forName("com.huawei.hms.push.HmsMessaging")
            
            // 可以进一步检查HMS Core是否安装
            // 这里简化处理，只检查SDK是否存在
            true
        } catch (e: ClassNotFoundException) {
            Log.d(TAG, "HMS不可用: ${e.message}")
            false
        } catch (e: Exception) {
            Log.w(TAG, "检查HMS可用性时出错", e)
            false
        }
    }
    
    /**
     * 检查小米推送是否可用
     */
    private fun isMiPushAvailable(context: Context): Boolean {
        return try {
            Class.forName("com.xiaomi.mipush.sdk.MiPushClient")
            true
        } catch (e: ClassNotFoundException) {
            Log.d(TAG, "小米推送不可用: ${e.message}")
            false
        } catch (e: Exception) {
            Log.w(TAG, "检查小米推送可用性时出错", e)
            false
        }
    }
    
    /**
     * 检查OPPO推送是否可用
     */
    private fun isOppoPushAvailable(context: Context): Boolean {
        return try {
            // 检查是否为OPPO或OnePlus设备
            val vendorInfo = getDeviceVendorInfo()
            if (vendorInfo.preferredService != PushService.OPPO) {
                return false
            }
            
            // 检查OPPO推送SDK是否可用（HeytapPush）
            Class.forName("com.heytap.msp.push.HeytapPushManager")
            true
        } catch (e: ClassNotFoundException) {
            Log.d(TAG, "OPPO推送不可用: ${e.message}")
            false
        } catch (e: Exception) {
            Log.w(TAG, "检查OPPO推送可用性时出错", e)
            false
        }
    }
    
    /**
     * 检查VIVO推送是否可用
     */
    private fun isVivoPushAvailable(context: Context): Boolean {
        return try {
            Class.forName("com.vivo.push.PushClient")
            true
        } catch (e: ClassNotFoundException) {
            Log.d(TAG, "VIVO推送不可用: ${e.message}")
            false
        } catch (e: Exception) {
            Log.w(TAG, "检查VIVO推送可用性时出错", e)
            false
        }
    }
    
    /**
     * 检查荣耀推送是否可用
     */
    private fun isHonorPushAvailable(context: Context): Boolean {
        // 荣耀设备目前主要使用HMS或FCM
        // 可以根据需要实现专门的荣耀推送SDK检查
        return isHMSAvailable(context)
    }
    
    /**
     * 获取设备详细信息字符串（用于调试）
     */
    fun getDeviceDebugInfo(): String {
        val vendorInfo = getDeviceVendorInfo()
        return """
            |设备厂商信息:
            |  制造商: ${vendorInfo.manufacturer}
            |  品牌: ${vendorInfo.brand}
            |  型号: ${vendorInfo.model}
            |  系统版本: Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})
            |  推荐服务: ${vendorInfo.preferredService}
            |  支持服务: ${vendorInfo.supportedServices.joinToString(", ")}
        """.trimMargin()
    }
}

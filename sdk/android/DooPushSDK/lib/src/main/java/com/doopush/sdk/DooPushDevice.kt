package com.doopush.sdk

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import com.doopush.sdk.models.DeviceInfo
import java.util.Locale

/**
 * DooPush 设备信息管理类
 * 
 * 负责收集Android设备的各种信息，用于设备注册和统计
 */
class DooPushDevice(private val context: Context) {
    
    companion object {
        
        /**
         * SDK版本号
         */
        const val SDK_VERSION = "1.0.0"
        
        /**
         * 用户代理格式模板
         */
        private const val USER_AGENT_TEMPLATE = "DooPush-Android-SDK/%s (%s; %s %s; Android %s)"
        
        /**
         * 设备型号映射 - 将一些常见的型号代码映射为可读名称
         */
        private val MODEL_MAPPING = mapOf(
            // 常见Galaxy系列型号
            "SM-G973F" to "Galaxy S10",
            "SM-G975F" to "Galaxy S10+",
            "SM-G981B" to "Galaxy S20",
            "SM-G991B" to "Galaxy S21",
            "SM-N971N" to "Galaxy Note10",
            "SM-N981B" to "Galaxy Note20",
            
            // Xiaomi
            "M2102J20SG" to "Mi 11",
            "M2007J3SY" to "Mi 10",
            "M1903F2A" to "Mi 9",
            "M2006C3MG" to "Redmi Note 9",
            "M2101K9G" to "Redmi Note 10 Pro",
            
            // Huawei
            "ELS-NX9" to "P40",
            "ANA-NX9" to "P40 Pro",
            "VOG-L29" to "P30",
            "EML-L29" to "P20",
            "CLT-L29" to "P20 Pro"
        )
    }
    
    /**
     * 获取当前设备信息
     * 
     * @param channel 推送通道（如："fcm"、"hms"）
     * @return DeviceInfo 设备信息对象
     */
    fun getCurrentDeviceInfo(channel: String = "fcm"): DeviceInfo {
        return DeviceInfo(
            platform = "android",
            channel = channel,
            bundleId = getBundleId(),
            brand = getBrand(),
            model = getModel(),
            systemVersion = getSystemVersion(),
            appVersion = getAppVersion(),
            userAgent = getUserAgent()
        )
    }
    
    /**
     * 获取应用包名（Bundle ID）
     * 
     * @return 应用包名
     */
    private fun getBundleId(): String {
        return try {
            context.packageName ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }
    }
    
    /**
     * 获取设备品牌
     * 
     * @return 设备品牌名称（首字母大写）
     */
    private fun getBrand(): String {
        return try {
            val brand = Build.BRAND ?: "Unknown"
            brand.replaceFirstChar { 
                if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() 
            }
        } catch (e: Exception) {
            "Unknown"
        }
    }
    
    /**
     * 获取设备型号
     * 先查找映射表，如果没有则使用原始型号
     * 
     * @return 设备型号名称
     */
    private fun getModel(): String {
        return try {
            val originalModel = Build.MODEL ?: "Unknown"
            
            // 先查找映射表中是否有对应的可读名称
            MODEL_MAPPING[originalModel] ?: originalModel
        } catch (e: Exception) {
            "Unknown"
        }
    }
    
    /**
     * 获取Android系统版本
     * 
     * @return 系统版本号（如: "11", "12"）
     */
    private fun getSystemVersion(): String {
        return try {
            Build.VERSION.RELEASE ?: "Unknown"
        } catch (e: Exception) {
            "Unknown"
        }
    }
    
    /**
     * 获取应用版本号
     * 
     * @return 应用版本名称（如: "1.0.0"）
     */
    private fun getAppVersion(): String {
        return try {
            val packageManager = context.packageManager
            val packageInfo: PackageInfo = packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "1.0.0"
        } catch (e: PackageManager.NameNotFoundException) {
            "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }
    
    /**
     * 生成用户代理字符串
     * 格式: DooPush-Android-SDK/1.0.0 (com.example.app; Google Pixel 7; Android 14)
     * 
     * @return 用户代理字符串
     */
    private fun getUserAgent(): String {
        return try {
            String.format(
                USER_AGENT_TEMPLATE,
                SDK_VERSION,
                getBundleId(),
                getBrand(),
                getModel(),
                getSystemVersion()
            )
        } catch (e: Exception) {
            "DooPush-Android-SDK/$SDK_VERSION"
        }
    }
    
    /**
     * 获取设备的详细硬件信息（用于调试）
     * 
     * @return 设备硬件信息Map
     */
    fun getDetailedDeviceInfo(): Map<String, String> {
        return try {
            mapOf(
                "brand" to (Build.BRAND ?: "Unknown"),
                "manufacturer" to (Build.MANUFACTURER ?: "Unknown"),
                "model" to (Build.MODEL ?: "Unknown"),
                "device" to (Build.DEVICE ?: "Unknown"),
                "board" to (Build.BOARD ?: "Unknown"),
                "hardware" to (Build.HARDWARE ?: "Unknown"),
                "product" to (Build.PRODUCT ?: "Unknown"),
                "display" to (Build.DISPLAY ?: "Unknown"),
                "fingerprint" to (Build.FINGERPRINT ?: "Unknown"),
                "host" to (Build.HOST ?: "Unknown"),
                "id" to (Build.ID ?: "Unknown"),
                "tags" to (Build.TAGS ?: "Unknown"),
                "type" to (Build.TYPE ?: "Unknown"),
                "user" to (Build.USER ?: "Unknown"),
                "android_version" to (Build.VERSION.RELEASE ?: "Unknown"),
                "api_level" to Build.VERSION.SDK_INT.toString(),
                "codename" to (Build.VERSION.CODENAME ?: "Unknown"),
                "incremental" to (Build.VERSION.INCREMENTAL ?: "Unknown"),
                "security_patch" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Build.VERSION.SECURITY_PATCH ?: "Unknown"
                } else {
                    "Not Available"
                }
            )
        } catch (e: Exception) {
            mapOf("error" to "Failed to get device info: ${e.message}")
        }
    }
    
    /**
     * 获取系统架构信息
     * 
     * @return 系统架构字符串数组
     */
    fun getSupportedAbis(): Array<String> {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                Build.SUPPORTED_ABIS ?: arrayOf("Unknown")
            } else {
                @Suppress("DEPRECATION")
                arrayOf(Build.CPU_ABI ?: "Unknown")
            }
        } catch (e: Exception) {
            arrayOf("Unknown")
        }
    }
    
    /**
     * 检查设备是否为模拟器
     * 
     * @return true if 是模拟器, false otherwise
     */
    fun isEmulator(): Boolean {
        return try {
            (Build.FINGERPRINT?.startsWith("generic") == true) ||
            (Build.FINGERPRINT?.startsWith("unknown") == true) ||
            (Build.MODEL?.contains("google_sdk") == true) ||
            (Build.MODEL?.contains("Emulator") == true) ||
            (Build.MODEL?.contains("Android SDK built for x86") == true) ||
            (Build.MANUFACTURER?.contains("Genymotion") == true) ||
            (Build.BRAND?.startsWith("generic") == true && Build.DEVICE?.startsWith("generic") == true) ||
            ("google_sdk" == Build.PRODUCT)
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * 获取设备的显示摘要信息
     * 
     * @return 设备摘要字符串
     */
    fun getDeviceSummary(): String {
        val deviceInfo = getCurrentDeviceInfo()
        val isEmulator = if (isEmulator()) " [模拟器]" else ""
        
        return "${deviceInfo.brand} ${deviceInfo.model} (Android ${deviceInfo.systemVersion})$isEmulator"
    }
    
    /**
     * 检查是否为特定品牌的设备
     * 
     * @param brandName 品牌名称
     * @return true if 是指定品牌, false otherwise
     */
    fun isBrand(brandName: String): Boolean {
        return try {
            getBrand().equals(brandName, ignoreCase = true)
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * 检查是否为华为设备（包括华为和荣耀）
     * 
     * @return true if 是华为系设备, false otherwise
     */
    fun isHuaweiDevice(): Boolean {
        return isBrand("Huawei") || isBrand("Honor")
    }
    
    /**
     * 检查是否为小米设备（包括小米和红米）
     * 
     * @return true if 是小米系设备, false otherwise
     */
    fun isXiaomiDevice(): Boolean {
        return isBrand("Xiaomi") || isBrand("Redmi")
    }
    
    /**
     * 检查是否为OPPO设备（包括OPPO和OnePlus）
     * 
     * @return true if 是OPPO系设备, false otherwise
     */
    fun isOppoDevice(): Boolean {
        return isBrand("OPPO") || isBrand("OnePlus")
    }
    
    /**
     * 检查是否为VIVO设备
     * 
     * @return true if 是VIVO设备, false otherwise
     */
    fun isVivoDevice(): Boolean {
        return isBrand("VIVO")
    }
}

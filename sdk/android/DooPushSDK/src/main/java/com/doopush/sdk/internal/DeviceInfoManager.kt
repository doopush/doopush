package com.doopush.sdk.internal

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.telephony.TelephonyManager
import com.doopush.sdk.network.DeviceInfo
import java.util.Locale
import java.util.TimeZone

/**
 * 设备信息管理器
 * 负责收集和管理设备相关信息
 */
class DeviceInfoManager(private val context: Context) {
    
    /**
     * 获取当前设备信息
     */
    fun getCurrentDeviceInfo(): DeviceInfo {
        return DeviceInfo(
            bundleId = getPackageName(),
            platform = "android",
            channel = getChannel(),
            brand = getBrand(),
            model = getModel(),
            systemVersion = getSystemVersion(),
            appVersion = getAppVersion(),
            userAgent = getUserAgent(),
            deviceId = getDeviceId(),
            language = getLanguage(),
            timezone = getTimezone(),
            screenResolution = getScreenResolution(),
            networkType = getNetworkType(),
            carrier = getCarrier()
        )
    }
    
    /**
     * 获取应用包名
     */
    private fun getPackageName(): String {
        return context.packageName
    }
    
    /**
     * 获取渠道信息
     */
    private fun getChannel(): String {
        // 检测设备厂商
        val manufacturer = android.os.Build.MANUFACTURER.lowercase()
        val brand = android.os.Build.BRAND.lowercase()

        when {
            manufacturer.contains("xiaomi") || brand.contains("xiaomi") ||
                    manufacturer.contains("redmi") || brand.contains("redmi") -> {
                return "xiaomi"
            }
            manufacturer.contains("huawei") || brand.contains("huawei") -> {
                return "huawei"
            }
            manufacturer.contains("oppo") || brand.contains("oppo") ||
                    manufacturer.contains("oneplus") || brand.contains("oneplus") -> {
                return "oppo"
            }
            manufacturer.contains("vivo") || brand.contains("vivo") ||
                    manufacturer.contains("iqoo") || brand.contains("iqoo") -> {
                return "vivo"
            }
            manufacturer.contains("honor") || brand.contains("honor") -> {
                return "honor"
            }
        }
        return "fcm"
    }


    
    /**
     * 获取设备品牌
     */
    private fun getBrand(): String {
        return Build.BRAND ?: "unknown"
    }
    
    /**
     * 获取设备型号
     */
    private fun getModel(): String {
        return Build.MODEL ?: "unknown"
    }
    
    /**
     * 获取系统版本
     */
    private fun getSystemVersion(): String {
        return "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"
    }
    
    /**
     * 获取应用版本
     */
    private fun getAppVersion(): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            "${packageInfo.versionName} (${packageInfo.versionCode})"
        } catch (e: Exception) {
            DooPushLogger.warning("获取应用版本失败: $e")
            "unknown"
        }
    }
    
    /**
     * 获取User Agent
     */
    private fun getUserAgent(): String {
        return "DooPushSDK/1.0.0 (Android ${Build.VERSION.RELEASE}; ${Build.BRAND} ${Build.MODEL})"
    }
    
    /**
     * 获取设备ID
     */
    private fun getDeviceId(): String {
        return try {
            // 使用Android ID作为设备标识
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
        } catch (e: Exception) {
            DooPushLogger.warning("获取设备ID失败: $e")
            "unknown"
        }
    }
    
    /**
     * 获取语言设置
     */
    private fun getLanguage(): String {
        return try {
            val locale = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                context.resources.configuration.locales[0]
            } else {
                @Suppress("DEPRECATION")
                context.resources.configuration.locale
            }
            "${locale.language}_${locale.country}"
        } catch (e: Exception) {
            DooPushLogger.warning("获取语言设置失败: $e")
            Locale.getDefault().toString()
        }
    }
    
    /**
     * 获取时区
     */
    private fun getTimezone(): String {
        return try {
            TimeZone.getDefault().id
        } catch (e: Exception) {
            DooPushLogger.warning("获取时区失败: $e")
            "UTC"
        }
    }
    
    /**
     * 获取屏幕分辨率
     */
    private fun getScreenResolution(): String {
        return try {
            val displayMetrics = context.resources.displayMetrics
            "${displayMetrics.widthPixels}x${displayMetrics.heightPixels}"
        } catch (e: Exception) {
            DooPushLogger.warning("获取屏幕分辨率失败: $e")
            "unknown"
        }
    }
    
    /**
     * 获取网络类型
     */
    private fun getNetworkType(): String {
        return try {
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) 
                as? android.net.ConnectivityManager
            
            if (connectivityManager == null) {
                return "unknown"
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = connectivityManager.activeNetwork
                val capabilities = connectivityManager.getNetworkCapabilities(network)
                
                when {
                    capabilities?.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) == true -> "wifi"
                    capabilities?.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "cellular"
                    capabilities?.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET) == true -> "ethernet"
                    else -> "unknown"
                }
            } else {
                @Suppress("DEPRECATION")
                val activeNetworkInfo = connectivityManager.activeNetworkInfo
                when (activeNetworkInfo?.type) {
                    android.net.ConnectivityManager.TYPE_WIFI -> "wifi"
                    android.net.ConnectivityManager.TYPE_MOBILE -> "cellular"
                    android.net.ConnectivityManager.TYPE_ETHERNET -> "ethernet"
                    else -> "unknown"
                }
            }
        } catch (e: Exception) {
            DooPushLogger.warning("获取网络类型失败: $e")
            "unknown"
        }
    }
    
    /**
     * 获取运营商信息
     */
    private fun getCarrier(): String {
        return try {
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) 
                as? TelephonyManager
            
            telephonyManager?.networkOperatorName ?: "unknown"
        } catch (e: Exception) {
            DooPushLogger.warning("获取运营商信息失败: $e")
            "unknown"
        }
    }
    
    /**
     * 获取设备硬件信息
     */
    fun getHardwareInfo(): Map<String, String> {
        return mapOf(
            "manufacturer" to (Build.MANUFACTURER ?: "unknown"),
            "brand" to (Build.BRAND ?: "unknown"),
            "model" to (Build.MODEL ?: "unknown"),
            "device" to (Build.DEVICE ?: "unknown"),
            "product" to (Build.PRODUCT ?: "unknown"),
            "board" to (Build.BOARD ?: "unknown"),
            "hardware" to (Build.HARDWARE ?: "unknown"),
            "cpu_abi" to (Build.CPU_ABI ?: "unknown"),
            "cpu_abi2" to (Build.CPU_ABI2 ?: "unknown")
        )
    }
    
    /**
     * 获取系统详细信息
     */
    fun getSystemInfo(): Map<String, String> {
        return mapOf(
            "sdk_int" to Build.VERSION.SDK_INT.toString(),
            "release" to (Build.VERSION.RELEASE ?: "unknown"),
            "codename" to (Build.VERSION.CODENAME ?: "unknown"),
            "incremental" to (Build.VERSION.INCREMENTAL ?: "unknown"),
            "security_patch" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Build.VERSION.SECURITY_PATCH ?: "unknown"
            } else {
                "unknown"
            },
            "bootloader" to (Build.BOOTLOADER ?: "unknown"),
            "radio" to (Build.getRadioVersion() ?: "unknown")
        )
    }
    
    /**
     * 获取应用详细信息
     */
    fun getAppInfo(): Map<String, String> {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            val appInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                PackageManager.GET_META_DATA
            )
            
            mapOf(
                "package_name" to context.packageName,
                "version_name" to (packageInfo.versionName ?: "unknown"),
                "version_code" to packageInfo.versionCode.toString(),
                "target_sdk" to appInfo.targetSdkVersion.toString(),
                "min_sdk" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    appInfo.minSdkVersion.toString()
                } else {
                    "unknown"
                },
                "install_time" to packageInfo.firstInstallTime.toString(),
                "update_time" to packageInfo.lastUpdateTime.toString(),
                "debuggable" to ((appInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0).toString()
            )
        } catch (e: Exception) {
            DooPushLogger.warning("获取应用信息失败: $e")
            mapOf(
                "package_name" to context.packageName,
                "error" to e.message.toString()
            )
        }
    }
    
    /**
     * 获取完整的设备信息用于调试
     */
    fun getFullDeviceInfo(): Map<String, Any> {
        return mapOf(
            "basic" to getCurrentDeviceInfo(),
            "hardware" to getHardwareInfo(),
            "system" to getSystemInfo(),
            "app" to getAppInfo()
        )
    }
}
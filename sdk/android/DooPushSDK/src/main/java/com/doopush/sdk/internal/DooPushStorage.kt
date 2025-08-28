package com.doopush.sdk.internal

import android.content.Context
import android.content.SharedPreferences
import com.doopush.sdk.DooPushConfig
import com.google.gson.Gson
import java.util.concurrent.TimeUnit

/**
 * DooPush 本地存储管理器
 * 负责保存和读取SDK的配置信息、设备信息等数据
 */
class DooPushStorage(context: Context) {
    
    companion object {
        private const val PREF_NAME = "doopush_sdk_prefs"
        private const val KEY_CONFIG = "config"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_PUSH_PERMISSION_GRANTED = "push_permission_granted"
        private const val KEY_LAST_DEVICE_UPDATE_TIME = "last_device_update_time"
        private const val KEY_FIRST_INSTALL_TIME = "first_install_time"
        private const val KEY_APP_VERSION = "app_version"
        private const val KEY_SDK_VERSION = "sdk_version"
    }
    
    private val sharedPreferences: SharedPreferences = context.getSharedPreferences(
        PREF_NAME,
        Context.MODE_PRIVATE
    )
    private val gson = Gson()
    
    init {
        // 记录首次安装时间
        if (!sharedPreferences.contains(KEY_FIRST_INSTALL_TIME)) {
            sharedPreferences.edit()
                .putLong(KEY_FIRST_INSTALL_TIME, System.currentTimeMillis())
                .apply()
        }
        
        // 更新SDK版本
        sharedPreferences.edit()
            .putString(KEY_SDK_VERSION, "1.0.0")
            .apply()
    }
    
    /**
     * 保存SDK配置
     */
    fun saveConfig(config: DooPushConfig) {
        try {
            val configJson = gson.toJson(config)
            sharedPreferences.edit()
                .putString(KEY_CONFIG, configJson)
                .apply()
            
            DooPushLogger.debug("SDK配置已保存")
        } catch (e: Exception) {
            DooPushLogger.error("保存SDK配置失败: $e")
        }
    }
    
    /**
     * 获取SDK配置
     */
    fun getConfig(): DooPushConfig? {
        return try {
            val configJson = sharedPreferences.getString(KEY_CONFIG, null)
            if (configJson != null) {
                gson.fromJson(configJson, DooPushConfig::class.java)
            } else {
                null
            }
        } catch (e: Exception) {
            DooPushLogger.error("读取SDK配置失败: $e")
            null
        }
    }
    
    /**
     * 保存设备Token
     */
    fun saveDeviceToken(token: String) {
        sharedPreferences.edit()
            .putString(KEY_DEVICE_TOKEN, token)
            .apply()
        
        DooPushLogger.debug("设备Token已保存")
    }
    
    /**
     * 获取设备Token
     */
    fun getDeviceToken(): String? {
        return sharedPreferences.getString(KEY_DEVICE_TOKEN, null)
    }
    
    /**
     * 保存设备ID
     */
    fun saveDeviceId(deviceId: String) {
        sharedPreferences.edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .apply()
        
        DooPushLogger.debug("设备ID已保存")
    }
    
    /**
     * 获取设备ID
     */
    fun getDeviceId(): String? {
        return sharedPreferences.getString(KEY_DEVICE_ID, null)
    }
    
    /**
     * 设置推送权限状态
     */
    fun setPushPermissionGranted(granted: Boolean) {
        sharedPreferences.edit()
            .putBoolean(KEY_PUSH_PERMISSION_GRANTED, granted)
            .apply()
        
        DooPushLogger.debug("推送权限状态已保存: $granted")
    }
    
    /**
     * 获取推送权限状态
     */
    fun isPushPermissionGranted(): Boolean {
        return sharedPreferences.getBoolean(KEY_PUSH_PERMISSION_GRANTED, false)
    }
    
    /**
     * 保存最后设备信息更新时间
     */
    fun saveLastDeviceUpdateTime() {
        sharedPreferences.edit()
            .putLong(KEY_LAST_DEVICE_UPDATE_TIME, System.currentTimeMillis())
            .apply()
        
        DooPushLogger.debug("设备信息更新时间已保存")
    }
    
    /**
     * 获取最后设备信息更新时间
     */
    fun getLastDeviceUpdateTime(): Long {
        return sharedPreferences.getLong(KEY_LAST_DEVICE_UPDATE_TIME, 0)
    }
    
    /**
     * 检查是否需要更新设备信息
     * @param intervalHours 更新间隔（小时）
     */
    fun shouldUpdateDeviceInfo(intervalHours: Int = 24): Boolean {
        val lastUpdateTime = getLastDeviceUpdateTime()
        if (lastUpdateTime == 0L) {
            return true // 从未更新过
        }
        
        val currentTime = System.currentTimeMillis()
        val intervalMillis = TimeUnit.HOURS.toMillis(intervalHours.toLong())
        
        return (currentTime - lastUpdateTime) >= intervalMillis
    }
    
    /**
     * 保存应用版本
     */
    fun saveAppVersion(version: String) {
        sharedPreferences.edit()
            .putString(KEY_APP_VERSION, version)
            .apply()
    }
    
    /**
     * 获取保存的应用版本
     */
    fun getSavedAppVersion(): String? {
        return sharedPreferences.getString(KEY_APP_VERSION, null)
    }
    
    /**
     * 检查应用是否更新了
     */
    fun isAppUpdated(currentVersion: String): Boolean {
        val savedVersion = getSavedAppVersion()
        return savedVersion != null && savedVersion != currentVersion
    }
    
    /**
     * 获取首次安装时间
     */
    fun getFirstInstallTime(): Long {
        return sharedPreferences.getLong(KEY_FIRST_INSTALL_TIME, System.currentTimeMillis())
    }
    
    /**
     * 获取SDK版本
     */
    fun getSdkVersion(): String? {
        return sharedPreferences.getString(KEY_SDK_VERSION, null)
    }
    
    /**
     * 保存自定义键值对
     */
    fun saveCustomValue(key: String, value: String) {
        sharedPreferences.edit()
            .putString("custom_$key", value)
            .apply()
    }
    
    /**
     * 获取自定义键值对
     */
    fun getCustomValue(key: String): String? {
        return sharedPreferences.getString("custom_$key", null)
    }
    
    /**
     * 保存自定义键值对（整数）
     */
    fun saveCustomInt(key: String, value: Int) {
        sharedPreferences.edit()
            .putInt("custom_int_$key", value)
            .apply()
    }
    
    /**
     * 获取自定义键值对（整数）
     */
    fun getCustomInt(key: String, defaultValue: Int = 0): Int {
        return sharedPreferences.getInt("custom_int_$key", defaultValue)
    }
    
    /**
     * 保存自定义键值对（布尔值）
     */
    fun saveCustomBoolean(key: String, value: Boolean) {
        sharedPreferences.edit()
            .putBoolean("custom_bool_$key", value)
            .apply()
    }
    
    /**
     * 获取自定义键值对（布尔值）
     */
    fun getCustomBoolean(key: String, defaultValue: Boolean = false): Boolean {
        return sharedPreferences.getBoolean("custom_bool_$key", defaultValue)
    }
    
    /**
     * 保存自定义键值对（长整数）
     */
    fun saveCustomLong(key: String, value: Long) {
        sharedPreferences.edit()
            .putLong("custom_long_$key", value)
            .apply()
    }
    
    /**
     * 获取自定义键值对（长整数）
     */
    fun getCustomLong(key: String, defaultValue: Long = 0L): Long {
        return sharedPreferences.getLong("custom_long_$key", defaultValue)
    }
    
    /**
     * 删除自定义键值对
     */
    fun removeCustomValue(key: String) {
        sharedPreferences.edit()
            .remove("custom_$key")
            .remove("custom_int_$key")
            .remove("custom_bool_$key")
            .remove("custom_long_$key")
            .apply()
    }
    
    /**
     * 清除所有数据
     */
    fun clear() {
        sharedPreferences.edit().clear().apply()
        DooPushLogger.info("本地存储数据已清除")
    }
    
    /**
     * 清除设备相关数据（保留配置）
     */
    fun clearDeviceData() {
        sharedPreferences.edit()
            .remove(KEY_DEVICE_TOKEN)
            .remove(KEY_DEVICE_ID)
            .remove(KEY_PUSH_PERMISSION_GRANTED)
            .remove(KEY_LAST_DEVICE_UPDATE_TIME)
            .apply()
        
        DooPushLogger.info("设备数据已清除")
    }
    
    /**
     * 获取所有存储的数据（用于调试）
     */
    fun getAllData(): Map<String, Any?> {
        val allData = mutableMapOf<String, Any?>()
        
        try {
            for ((key, value) in sharedPreferences.all) {
                allData[key] = value
            }
        } catch (e: Exception) {
            DooPushLogger.error("获取存储数据失败: $e")
        }
        
        return allData
    }
    
    /**
     * 获取存储统计信息
     */
    fun getStorageStats(): Map<String, Any> {
        val stats = mutableMapOf<String, Any>()
        
        try {
            val allData = sharedPreferences.all
            stats["total_keys"] = allData.size
            stats["has_config"] = sharedPreferences.contains(KEY_CONFIG)
            stats["has_device_token"] = sharedPreferences.contains(KEY_DEVICE_TOKEN)
            stats["has_device_id"] = sharedPreferences.contains(KEY_DEVICE_ID)
            stats["first_install_time"] = getFirstInstallTime()
            stats["last_device_update_time"] = getLastDeviceUpdateTime()
            stats["sdk_version"] = getSdkVersion() ?: "unknown"
            
            // 计算自定义数据数量
            var customDataCount = 0
            for (key in allData.keys) {
                if (key.startsWith("custom_")) {
                    customDataCount++
                }
            }
            stats["custom_data_count"] = customDataCount
            
        } catch (e: Exception) {
            DooPushLogger.error("获取存储统计失败: $e")
            stats["error"] = e.message ?: "unknown error"
        }
        
        return stats
    }
}
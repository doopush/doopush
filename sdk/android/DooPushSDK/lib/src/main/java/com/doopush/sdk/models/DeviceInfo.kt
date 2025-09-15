package com.doopush.sdk.models

import com.google.gson.annotations.SerializedName

/**
 * 设备信息数据类
 * 
 * 包含设备的基本信息，用于向DooPush服务器注册设备
 */
data class DeviceInfo(
    
    /**
     * 平台类型，固定为 "android"
     */
    @SerializedName("platform")
    val platform: String = "android",
    
    /**
     * 推送通道，当前为 "fcm"
     */
    @SerializedName("channel")
    val channel: String = "fcm",
    
    /**
     * 应用包名 (Bundle ID)
     */
    @SerializedName("bundle_id")
    val bundleId: String,
    
    /**
     * 设备品牌 (如: Samsung, Xiaomi, Huawei)
     */
    @SerializedName("brand")
    val brand: String,
    
    /**
     * 设备型号 (如: SM-G973F, MI 9)
     */
    @SerializedName("model")
    val model: String,
    
    /**
     * 系统版本 (如: 11, 12)
     */
    @SerializedName("system_version")
    val systemVersion: String,
    
    /**
     * 应用版本 (如: 1.0.0)
     */
    @SerializedName("app_version")
    val appVersion: String,
    
    /**
     * 用户代理字符串
     */
    @SerializedName("user_agent")
    val userAgent: String
) {
    
    /**
     * 获取设备的唯一标识字符串
     * 
     * @return 设备标识字符串
     */
    fun getDeviceIdentifier(): String {
        return "$brand-$model-$systemVersion"
    }
    
    /**
     * 获取完整的设备描述信息
     * 
     * @return 设备描述字符串
     */
    fun getDeviceDescription(): String {
        return "$brand $model (Android $systemVersion)"
    }
    
    /**
     * 转换为Map格式，用于API请求
     * 
     * @return 设备信息Map
     */
    fun toMap(): Map<String, String> {
        return mapOf(
            "platform" to platform,
            "channel" to channel,
            "bundle_id" to bundleId,
            "brand" to brand,
            "model" to model,
            "system_version" to systemVersion,
            "app_version" to appVersion,
            "user_agent" to userAgent
        )
    }
}

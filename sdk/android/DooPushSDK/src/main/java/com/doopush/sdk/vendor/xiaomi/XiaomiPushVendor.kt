package com.doopush.sdk.vendor.xiaomi

import android.content.Context
import android.content.Intent
import android.os.Bundle
import com.doopush.sdk.DooPushError
import com.doopush.sdk.internal.DooPushLogger
import com.doopush.sdk.model.DooPushMessage
import com.doopush.sdk.vendor.PushVendor
import com.xiaomi.mipush.sdk.MiPushClient
import com.xiaomi.mipush.sdk.MiPushCommandMessage
import com.xiaomi.mipush.sdk.MiPushMessage
import com.xiaomi.mipush.sdk.ErrorCode

/**
 * 小米推送厂商实现
 */
class XiaomiPushVendor : PushVendor() {
    
    override val vendorName: String = "xiaomi"
    
    private var context: Context? = null
    private var appId: String? = null
    private var appKey: String? = null
    private var isInitialized = false
    private var deviceToken: String? = null
    
    // 注册回调
    private var registrationCallback: ((String?, DooPushError?) -> Unit)? = null
    
    override fun isSupported(context: Context): Boolean {
        return try {
            // 检查是否为小米设备或安装了小米推送服务
            val manufacturer = android.os.Build.MANUFACTURER.lowercase()
            val brand = android.os.Build.BRAND.lowercase()
            
            val isXiaomiDevice = manufacturer.contains("xiaomi") || 
                               brand.contains("xiaomi") ||
                               manufacturer.contains("redmi") || 
                               brand.contains("redmi")
            
            if (isXiaomiDevice) {
                return true
            }
            
            // 检查是否安装了小米推送服务
            try {
                context.packageManager.getPackageInfo("com.xiaomi.xmsf", 0)
                true
            } catch (e: Exception) {
                false
            }
        } catch (e: Exception) {
            DooPushLogger.error("检查小米推送支持时发生错误: $e")
            false
        }
    }
    
    override fun initialize(
        context: Context,
        appId: String,
        appKey: String,
        callback: (DooPushError?) -> Unit
    ) {
        if (isInitialized) {
            DooPushLogger.warning("小米推送已经初始化")
            callback(null)
            return
        }
        
        this.context = context.applicationContext
        this.appId = appId
        this.appKey = appKey
        
        try {
            DooPushLogger.info("开始初始化小米推送 - AppID: $appId")
            
            // 设置小米推送的日志级别
            if (DooPushLogger.isDebugEnabled()) {
                MiPushClient.enablePush(context)
            }
            
            // 初始化小米推送
            MiPushClient.registerPush(context, appId, appKey)
            
            isInitialized = true
            DooPushLogger.info("小米推送初始化成功")
            callback(null)
            
        } catch (e: Exception) {
            DooPushLogger.error("小米推送初始化失败: $e")
            val error = DooPushError.VendorInitializationFailed(vendorName, e)
            callback(error)
        }
    }
    
    override fun registerForPushNotifications(
        callback: (String?, DooPushError?) -> Unit
    ) {
        if (!isInitialized) {
            callback(null, DooPushError.VendorInitializationFailed(vendorName))
            return
        }
        
        val context = this.context
        if (context == null) {
            callback(null, DooPushError.VendorError(vendorName, "Context为空"))
            return
        }
        
        this.registrationCallback = callback
        
        try {
            DooPushLogger.info("开始注册小米推送")
            
            // 检查是否已经有token
            val existingToken = MiPushClient.getRegId(context)
            if (!existingToken.isNullOrEmpty()) {
                DooPushLogger.info("使用已存在的小米推送token: $existingToken")
                deviceToken = existingToken
                callback(existingToken, null)
                return
            }
            
            // 注册推送（结果会通过XiaomiPushMessageReceiver回调）
            MiPushClient.registerPush(context, appId, appKey)
            
        } catch (e: Exception) {
            DooPushLogger.error("小米推送注册失败: $e")
            val error = DooPushError.DeviceRegistrationFailed("小米推送注册失败", e)
            callback(null, error)
        }
    }
    
    override fun parseMessage(intent: Intent): DooPushMessage? {
        return try {
            val miPushMessage = intent.getSerializableExtra("key_message") as? MiPushMessage
            if (miPushMessage != null) {
                parseXiaomiMessage(miPushMessage)
            } else {
                null
            }
        } catch (e: Exception) {
            DooPushLogger.error("解析小米推送消息失败: $e")
            null
        }
    }
    
    override fun parseMessage(bundle: Bundle): DooPushMessage? {
        return try {
            val miPushMessage = bundle.getSerializable("key_message") as? MiPushMessage
            if (miPushMessage != null) {
                parseXiaomiMessage(miPushMessage)
            } else {
                null
            }
        } catch (e: Exception) {
            DooPushLogger.error("解析小米推送消息失败: $e")
            null
        }
    }
    
    /**
     * 解析小米推送消息
     */
    private fun parseXiaomiMessage(miPushMessage: MiPushMessage): DooPushMessage {
        val title = miPushMessage.title ?: ""
        val content = miPushMessage.content ?: miPushMessage.description ?: ""
        
        // 解析自定义数据
        val customData = mutableMapOf<String, Any>()
        miPushMessage.extra?.forEach { (key, value) ->
            customData[key] = value
        }
        
        return DooPushMessage(
            messageId = miPushMessage.messageId ?: "",
            title = title,
            content = content,
            payload = customData,
            vendor = vendorName,
            rawData = mapOf(
                "messageId" to (miPushMessage.messageId ?: ""),
                "title" to title,
                "content" to content,
                "description" to (miPushMessage.description ?: ""),
                "extra" to (miPushMessage.extra ?: emptyMap<String, String>()),
                "messageType" to miPushMessage.messageType,
                "notifyType" to miPushMessage.notifyType,
                "passThrough" to miPushMessage.passThrough
            )
        )
    }
    
    override fun setAlias(alias: String, callback: ((DooPushError?) -> Unit)?) {
        if (!isInitialized) {
            callback?.invoke(DooPushError.VendorInitializationFailed(vendorName))
            return
        }
        
        val context = this.context
        if (context == null) {
            callback?.invoke(DooPushError.VendorError(vendorName, "Context为空"))
            return
        }
        
        try {
            DooPushLogger.info("设置小米推送别名: $alias")
            MiPushClient.setAlias(context, alias, null)
            callback?.invoke(null)
        } catch (e: Exception) {
            DooPushLogger.error("设置小米推送别名失败: $e")
            callback?.invoke(DooPushError.VendorError(vendorName, "设置别名失败", e))
        }
    }
    
    override fun setTags(tags: List<String>, callback: ((DooPushError?) -> Unit)?) {
        if (!isInitialized) {
            callback?.invoke(DooPushError.VendorInitializationFailed(vendorName))
            return
        }
        
        val context = this.context
        if (context == null) {
            callback?.invoke(DooPushError.VendorError(vendorName, "Context为空"))
            return
        }
        
        try {
            DooPushLogger.info("设置小米推送标签: $tags")
            MiPushClient.subscribe(context, tags.joinToString(","), null)
            callback?.invoke(null)
        } catch (e: Exception) {
            DooPushLogger.error("设置小米推送标签失败: $e")
            callback?.invoke(DooPushError.VendorError(vendorName, "设置标签失败", e))
        }
    }
    
    override fun getDeviceToken(): String? {
        return deviceToken ?: run {
            val context = this.context
            if (context != null && isInitialized) {
                val token = MiPushClient.getRegId(context)
                if (!token.isNullOrEmpty()) {
                    deviceToken = token
                    token
                } else {
                    null
                }
            } else {
                null
            }
        }
    }
    
    override fun isInitialized(): Boolean {
        return isInitialized
    }
    
    override fun destroy() {
        try {
            val context = this.context
            if (context != null && isInitialized) {
                MiPushClient.unregisterPush(context)
                DooPushLogger.info("小米推送服务已销毁")
            }
        } catch (e: Exception) {
            DooPushLogger.error("销毁小米推送服务失败: $e")
        } finally {
            isInitialized = false
            deviceToken = null
            registrationCallback = null
            context = null
            appId = null
            appKey = null
        }
    }
    
    override fun getVendorInfo(): Map<String, Any> {
        val baseInfo = super.getVendorInfo().toMutableMap()
        
        baseInfo["device_token"] = getDeviceToken() ?: ""
        baseInfo["app_id"] = appId ?: ""
        
        val context = this.context
        if (context != null) {
            try {
                baseInfo["xiaomi_service_available"] = MiPushClient.shouldUseMIUIPush(context)
            } catch (e: Exception) {
                baseInfo["xiaomi_service_available"] = false
            }
        }
        
        return baseInfo
    }
    
    /**
     * 处理小米推送注册结果
     * 这个方法会被XiaomiPushMessageReceiver调用
     */
    internal fun handleRegistrationResult(regId: String?, errorCode: Long) {
        val callback = this.registrationCallback
        if (callback == null) {
            DooPushLogger.warning("小米推送注册回调为空")
            return
        }
        
        if (errorCode.toInt() == ErrorCode.SUCCESS) {
            if (!regId.isNullOrEmpty()) {
                DooPushLogger.info("小米推送注册成功: $regId")
                deviceToken = regId
                callback(regId, null)
            } else {
                DooPushLogger.error("小米推送注册成功但token为空")
                callback(null, DooPushError.DeviceTokenInvalid("小米推送token为空"))
            }
        } else {
            DooPushLogger.error("小米推送注册失败，错误码: $errorCode")
            val error = DooPushError.DeviceRegistrationFailed("小米推送注册失败，错误码: $errorCode")
            callback(null, error)
        }
        
        // 清除回调
        registrationCallback = null
    }
    
    /**
     * 处理小米推送命令结果
     */
    internal fun handleCommandResult(message: MiPushCommandMessage) {
        DooPushLogger.info("收到小米推送命令结果: ${message.command}, 错误码: ${message.resultCode}")
        
        // 根据命令类型处理结果
        when (message.command) {
            "register" -> {
                // 注册命令结果已在handleRegistrationResult中处理
            }
            "set-alias" -> {
                if (message.resultCode.toInt() == ErrorCode.SUCCESS) {
                    DooPushLogger.info("小米推送设置别名成功")
                } else {
                    DooPushLogger.error("小米推送设置别名失败，错误码: ${message.resultCode}")
                }
            }
            "subscribe" -> {
                if (message.resultCode.toInt() == ErrorCode.SUCCESS) {
                    DooPushLogger.info("小米推送订阅标签成功")
                } else {
                    DooPushLogger.error("小米推送订阅标签失败，错误码: ${message.resultCode}")
                }
            }
        }
    }
}
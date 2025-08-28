package com.doopush.DooPushSDKExample

import android.app.Application
import android.util.Log
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import com.doopush.sdk.DooPushManager
import com.doopush.sdk.DooPushError
import com.doopush.sdk.model.DooPushMessage
import com.doopush.sdk.tcp.DooPushTCPState
import java.util.*

/**
 * 推送通知管理器
 * 负责管理推送状态、历史记录和SDK事件
 */
class PushNotificationManager private constructor() : ViewModel() {

    companion object {
        private const val TAG = "PushNotificationManager"
        private const val PERMISSION_REQUEST_CODE = 1001

        // 单例实例
        val instance: PushNotificationManager by lazy { PushNotificationManager() }
    }

    // SDK状态
    val sdkStatus = mutableStateOf<SDKStatus>(SDKStatus.UNINITIALIZED)

    // 推送权限状态
    val pushPermissionStatus = mutableStateOf<PushPermissionStatus>(PushPermissionStatus.UNKNOWN)

    // 权限申请回调
    var permissionCallback: ((Boolean) -> Unit)? = null

    // Context引用
    private var context: android.content.Context? = null

    // 设备信息
    val deviceToken = mutableStateOf<String?>(null)
    val deviceId = mutableStateOf<String?>(null)

    // TCP状态
    val tcpState = mutableStateOf<DooPushTCPState>(DooPushTCPState.DISCONNECTED)

    // 加载状态
    val isLoading = mutableStateOf(false)
    val isUpdatingDevice = mutableStateOf(false)

    // 错误信息
    val lastError = mutableStateOf<String?>(null)
    val updateMessage = mutableStateOf<String?>(null)

    // 通知历史
    val notifications = mutableStateListOf<NotificationInfo>()

    // 私有属性
    private var isInitialized = false

    init {
        // 初始化时同步当前状态
        syncCurrentState()
    }

    /**
     * 初始化管理器
     */
    fun initialize(application: Application) {
        if (isInitialized) return

        this.context = application.applicationContext
        Log.i(TAG, "初始化推送管理器")

        // 同步当前状态
        syncCurrentState()

        // 监听SDK事件
        DooPushManager.instance.addListener(object : com.doopush.sdk.DooPushListener {
            override fun onDeviceRegistered(deviceToken: String) {
                Log.i(TAG, "设备注册成功: $deviceToken")
                this@PushNotificationManager.deviceToken.value = deviceToken
                deviceId.value = DooPushManager.instance.getDeviceId()
                sdkStatus.value = SDKStatus.REGISTERED
                updateMessage.value = "设备注册成功"
                clearMessageAfterDelay()
            }

            override fun onMessageReceived(message: DooPushMessage) {
                Log.i(TAG, "收到推送消息: ${message.title}")

                // 添加到通知历史
                val notification = NotificationInfo(
                    id = message.messageId,
                    title = message.title,
                    content = message.content,
                    receivedAt = Date(),
                    message = message
                )
                notifications.add(0, notification) // 添加到开头

                // 只保留最近50条记录
                if (notifications.size > 50) {
                    notifications.removeRange(50, notifications.size)
                }
            }

            override fun onError(error: DooPushError) {
                Log.e(TAG, "推送错误: ${error.message}")
                lastError.value = error.message
                if (sdkStatus.value == SDKStatus.REGISTERING) {
                    sdkStatus.value = SDKStatus.FAILED
                }
                clearErrorAfterDelay()
            }

            override fun onTCPConnectionStateChanged(state: DooPushTCPState) {
                Log.i(TAG, "TCP状态变化: ${state.getDescription()}")
                tcpState.value = state
            }

            override fun onVendorInitialized(vendor: String) {
                Log.i(TAG, "推送厂商初始化成功: $vendor")
                updateMessage.value = "$vendor 推送初始化成功"
                clearMessageAfterDelay()
            }

            override fun onVendorInitializationFailed(vendor: String, error: DooPushError) {
                Log.e(TAG, "推送厂商初始化失败: $vendor - ${error.message}")
                updateMessage.value = "$vendor 推送初始化失败"
                clearMessageAfterDelay()
            }

            override fun onDeviceInfoUpdated() {
                Log.i(TAG, "设备信息更新成功")
                isUpdatingDevice.value = false
                updateMessage.value = "设备信息更新成功"
                clearMessageAfterDelay()
            }

            override fun onTCPDeviceRegistered() {
                Log.i(TAG, "TCP设备注册成功")
                updateMessage.value = "TCP连接注册成功"
                clearMessageAfterDelay()
            }

            override fun onTCPHeartbeatReceived() {
                Log.d(TAG, "TCP心跳接收")
            }
        })

        isInitialized = true
        Log.i(TAG, "推送管理器初始化完成")
    }

    /**
     * 注册推送通知
     */
    fun registerForPushNotifications() {
        if (!checkInitialized()) return

        Log.i(TAG, "开始注册推送通知")

        // 先检查并申请推送权限
        requestPushPermission { permissionGranted ->
            if (permissionGranted) {
                Log.i(TAG, "推送权限已授予，开始注册推送服务")
                performPushRegistration()
            } else {
                Log.e(TAG, "推送权限被拒绝")
                lastError.value = "推送权限被拒绝，请在设置中开启推送通知权限"
                sdkStatus.value = SDKStatus.FAILED
            }
        }
    }

    /**
     * 执行推送注册（内部方法）
     */
    private fun performPushRegistration() {
        isLoading.value = true
        sdkStatus.value = SDKStatus.REGISTERING
        lastError.value = null

        DooPushManager.instance.registerForPushNotifications { deviceToken, error ->
            isLoading.value = false

            if (error != null) {
                Log.e(TAG, "推送注册失败: ${error.message}")
                sdkStatus.value = SDKStatus.FAILED
                lastError.value = error.message
            } else if (deviceToken != null) {
                Log.i(TAG, "推送注册成功: $deviceToken")
                // 手动触发设备注册成功回调
                onDeviceRegistered(deviceToken)
                updateMessage.value = "推送注册成功"
            }
        }
    }

    /**
     * 设备注册成功处理方法
     */
    private fun onDeviceRegistered(deviceToken: String) {
        Log.i(TAG, "设备注册成功: $deviceToken")
        this.deviceToken.value = deviceToken
        deviceId.value = DooPushManager.instance.getDeviceId()
        sdkStatus.value = SDKStatus.REGISTERED
        updateMessage.value = "设备注册成功"
        clearMessageAfterDelay()
    }

    /**
     * 更新设备信息
     */
    fun updateDeviceInfo() {
        if (!checkInitialized()) return

        Log.i(TAG, "更新设备信息")
        isUpdatingDevice.value = true
        lastError.value = null
        updateMessage.value = "正在更新设备信息..."

        DooPushManager.instance.updateDeviceInfo()
    }

    /**
     * 重新注册推送
     */
    fun reRegisterForPushNotifications() {
        Log.i(TAG, "重新注册推送通知")
        registerForPushNotifications()
    }

    /**
     * 检查推送权限
     */
    fun checkPushPermission(): Boolean {
        val context = context ?: return false

        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ 需要检查POST_NOTIFICATIONS权限
            androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            // Android 12及以下版本不需要特殊权限
            true
        }
    }

    /**
     * 申请推送权限
     */
    fun requestPushPermission(callback: (Boolean) -> Unit) {
        val context = context ?: run {
            callback(false)
            return
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ 需要申请POST_NOTIFICATIONS权限
            if (checkPushPermission()) {
                pushPermissionStatus.value = PushPermissionStatus.AUTHORIZED
                callback(true)
                return
            }

            permissionCallback = callback
            pushPermissionStatus.value = PushPermissionStatus.REQUESTING

            val activity = context as? android.app.Activity ?: run {
                callback(false)
                return
            }

            androidx.core.app.ActivityCompat.requestPermissions(
                activity,
                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                PERMISSION_REQUEST_CODE
            )
        } else {
            // Android 12及以下版本不需要特殊权限
            pushPermissionStatus.value = PushPermissionStatus.AUTHORIZED
            callback(true)
        }
    }

    /**
     * 处理权限申请结果
     */
    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val granted = grantResults.isNotEmpty() &&
                         grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED

            pushPermissionStatus.value = if (granted) {
                PushPermissionStatus.AUTHORIZED
            } else {
                PushPermissionStatus.DENIED
            }

            permissionCallback?.invoke(granted)
            permissionCallback = null
        }
    }

    /**
     * 检查权限状态
     */
    fun checkPermissionStatus() {
        val hasPermission = checkPushPermission()
        pushPermissionStatus.value = if (hasPermission) {
            PushPermissionStatus.AUTHORIZED
        } else {
            PushPermissionStatus.DENIED
        }
    }

    /**
     * 清空通知历史
     */
    fun clearNotifications() {
        notifications.clear()
        Log.i(TAG, "通知历史已清空")
    }

    /**
     * 同步当前状态
     */
    private fun syncCurrentState() {
        try {
            deviceToken.value = DooPushManager.instance.getDeviceToken()
            deviceId.value = DooPushManager.instance.getDeviceId()
            tcpState.value = DooPushManager.instance.getTCPConnectionState()

            if (deviceToken.value != null) {
                sdkStatus.value = SDKStatus.REGISTERED
            } else {
                sdkStatus.value = SDKStatus.UNINITIALIZED
            }

            // 同步权限状态
            checkPermissionStatus()
        } catch (e: Exception) {
            Log.e(TAG, "同步状态失败", e)
        }
    }

    /**
     * 检查SDK是否已初始化
     */
    private fun checkInitialized(): Boolean {
        if (!isInitialized) {
            Log.e(TAG, "推送管理器未初始化")
            lastError.value = "推送管理器未初始化"
            return false
        }
        return true
    }

    /**
     * 清除错误信息（延迟执行）
     */
    private fun clearErrorAfterDelay() {
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            lastError.value = null
        }, 3000)
    }

    /**
     * 清除消息（延迟执行）
     */
    private fun clearMessageAfterDelay() {
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            updateMessage.value = null
        }, 3000)
    }

    /**
     * SDK状态枚举
     */
    enum class SDKStatus(val displayText: String, val statusColor: androidx.compose.ui.graphics.Color) {
        UNINITIALIZED("未初始化", androidx.compose.ui.graphics.Color.Gray),
        REGISTERING("注册中...", androidx.compose.ui.graphics.Color.Blue),
        REGISTERED("已注册", androidx.compose.ui.graphics.Color.Green),
        FAILED("注册失败", androidx.compose.ui.graphics.Color.Red)
    }

    /**
     * 推送权限状态枚举
     */
    enum class PushPermissionStatus(val displayText: String, val statusColor: androidx.compose.ui.graphics.Color) {
        UNKNOWN("未知", androidx.compose.ui.graphics.Color.Gray),
        REQUESTING("申请中...", androidx.compose.ui.graphics.Color.Blue),
        AUTHORIZED("已授权", androidx.compose.ui.graphics.Color.Green),
        DENIED("未授权", androidx.compose.ui.graphics.Color.Red)
    }

    /**
     * 通知信息数据类
     */
    data class NotificationInfo(
        val id: String,
        val title: String?,
        val content: String?,
        val receivedAt: Date,
        val message: DooPushMessage
    )
}

package com.doopush.DooPushSDKExample

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.doopush.DooPushSDKExample.databinding.ActivityMainBinding
import com.doopush.sdk.*
import com.doopush.sdk.models.DooPushError
import com.doopush.sdk.models.PushMessage
import org.json.JSONObject
import java.io.InputStream

/**
 * MainActivity - DooPush SDK 示例应用主界面
 * 
 * 展示SDK的各种功能，包括配置、注册、推送接收等
 */
class MainActivity : AppCompatActivity(), DooPushCallback {
    
    companion object {
        private const val TAG = "MainActivity"
        
        // 全局配置变量（空值，使用SDK默认配置）
        var appId: String = ""
        var apiKey: String = ""
        var baseUrl: String = ""
        var debugEnabled: Boolean = true
        
    }
    
    private lateinit var binding: ActivityMainBinding
    private val dooPushManager = DooPushManager.getInstance()
    
    // 权限请求launcher
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Log.d(TAG, "通知权限已授予")
            updateUI()
        } else {
            Log.w(TAG, "通知权限被拒绝")
            showPermissionDialog()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // 从配置文件读取配置
        loadConfigFromFile()
        
        // 设置SDK回调
        dooPushManager.setCallback(this)
        
        // 初始化UI
        initViews()
        
        // 检查通知权限
        checkNotificationPermission()
        
        // 处理推送点击意图
        handleNotificationIntent(intent)
        
        // 更新界面状态
        updateUI()
        
        Log.d(TAG, "MainActivity 创建完成")
    }
    
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        
        Log.d(TAG, "收到新Intent")
        
        // 处理推送点击意图
        handleNotificationIntent(intent)
    }
    
    /**
     * 处理推送通知点击意图
     */
    private fun handleNotificationIntent(intent: Intent?) {
        if (intent == null) return
        
        try {
            // 检查是否是推送点击意图
            if (DooPushNotificationHandler.isNotificationClickIntent(intent)) {
                Log.d(TAG, "检测到推送点击意图")
                
                // 处理推送点击事件
                DooPushNotificationHandler.handleNotificationClick(this, intent)
                
                // 处理推送打开事件
                DooPushNotificationHandler.handleNotificationOpen(this, intent)
            } else {
                Log.d(TAG, "常规应用启动意图")
            }
        } catch (e: Exception) {
            Log.e(TAG, "处理推送点击意图失败", e)
        }
    }
    
    /**
     * 初始化视图和事件监听器
     */
    private fun initViews() {
        // 设置工具栏
        setSupportActionBar(binding.toolbar)

        // 配置SDK按钮
        binding.btnConfigureSdk.setOnClickListener {
            configureSDK()
        }
        
        // 注册推送按钮
        binding.btnRegisterPush.setOnClickListener {
            registerForPushNotifications()
        }
        
        // 获取推送Token按钮
        binding.btnGetPushToken.setOnClickListener {
            getPushToken()
        }
        
        // 复制Token按钮
        binding.btnCopyToken.setOnClickListener {
            copyTokenToClipboard()
        }
        
        // 测试连接按钮
        binding.btnTestConnection.setOnClickListener {
            testNetworkConnection()
        }
        
        // 清除缓存按钮
        binding.btnClearCache.setOnClickListener {
            clearCache()
        }
        
        // 查看历史按钮
        binding.btnViewHistory.setOnClickListener {
            viewPushHistory()
        }
        
        // 设置按钮
        binding.btnSettings.setOnClickListener {
            openSettings()
        }
        
        // 角标测试按钮
        binding.btnSetBadge.setOnClickListener {
            testBadgeFunction(5) // 设置角标数量为5
        }
        
        binding.btnClearBadge.setOnClickListener {
            testBadgeFunction(0) // 清除角标
        }
        
        // 推送服务状态按钮（暂时移除，等UI布局添加后再启用）
        // binding.btnCheckServices?.setOnClickListener {
        //     checkPushServicesStatus()
        // }
    }
    
    /**
     * 从配置文件读取配置到全局变量
     */
    private fun loadConfigFromFile() {
        // 读取 DooPush 配置
        loadDooPushConfig()
    }
    
    /**
     * 从 doopush-services.json 读取 DooPush 配置
     */
    private fun loadDooPushConfig() {
        try {
            val inputStream: InputStream = assets.open("doopush-services.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(jsonString)
            
            appId = jsonObject.optString("app_id", "")
            apiKey = jsonObject.optString("api_key", "")
            baseUrl = jsonObject.optString("base_url", "")
            debugEnabled = jsonObject.optBoolean("debug_enabled", true)
            
            Log.d(TAG, "从doopush-services.json读取配置: appId=$appId, baseUrl=$baseUrl")
        } catch (e: Exception) {
            Log.d(TAG, "doopush-services.json不存在或读取失败，全局变量保持空值")
        }
    }
    
    
    /**
     * 配置SDK
     */
    private fun configureSDK() {
        try {
            showStatusInfo("正在配置SDK...")
            
            Log.d(TAG, "使用配置: appId=$appId, baseUrl=$baseUrl")
            
            // 配置SDK
            dooPushManager.configure(
                context = this,
                appId = appId,
                apiKey = apiKey,
                baseURL = baseUrl
            )
            
            showToast("SDK配置成功")
            updateUI()
            
            Log.i(TAG, "SDK配置成功 - 已自动适配设备推送服务")
            
        } catch (e: DooPushConfigException) {
            Log.e(TAG, "SDK配置失败", e)
            showToast("SDK配置失败: ${e.error.message}")
            hideStatusInfo()
        }
    }
    
    /**
     * 注册推送通知
     */
    private fun registerForPushNotifications() {
        if (!DooPushManager.isInitialized()) {
            showToast(getString(R.string.error_config_required))
            return
        }
        
        showStatusInfo("正在注册推送...")
        dooPushManager.registerForPushNotifications()
    }
    
    /**
     * 获取推送Token（智能选择最佳服务）
     */
    private fun getPushToken() {
        if (!DooPushManager.isInitialized()) {
            showToast(getString(R.string.error_config_required))
            return
        }
        
        showStatusInfo("正在获取推送Token...")
        
        dooPushManager.getBestPushToken(object : DooPushTokenCallback {
            override fun onSuccess(token: String) {
                runOnUiThread {
                    val vendorInfo = dooPushManager.getDeviceVendorInfo()
                    val recommendedService = vendorInfo.preferredService
                    
                    // 显示Token
                    binding.tvPushToken.text = token
                    
                    // 显示服务类型信息
                    val serviceText = when (recommendedService) {
                        DooPushDeviceVendor.PushService.HMS -> "华为 HMS Push"
                        DooPushDeviceVendor.PushService.FCM -> "Google FCM"
                        DooPushDeviceVendor.PushService.MIPUSH -> "小米推送"
                        DooPushDeviceVendor.PushService.OPPO -> "OPPO推送"
                        DooPushDeviceVendor.PushService.VIVO -> "VIVO推送"
                        DooPushDeviceVendor.PushService.HONOR -> "荣耀推送"
                    }
                    binding.tvTokenType.text = "使用服务: $serviceText (${vendorInfo.brand})"
                    binding.tvTokenType.visibility = View.VISIBLE
                    
                    showToast("推送Token获取成功")
                    showStatusInfo("推送Token获取成功 ✓\n服务: $serviceText\n设备: ${vendorInfo.brand} ${vendorInfo.model}")
                    
                    Log.d(TAG, "推送Token获取成功: ${token.substring(0, 12)}... (服务: $serviceText)")
                    
                    updateUI()
                }
            }
            
            override fun onError(error: DooPushError) {
                runOnUiThread {
                    showToast("推送Token获取失败: ${error.message}")
                    showStatusInfo("推送Token获取失败 ✗\n错误: ${error.message}")
                    Log.e(TAG, "推送Token获取失败: ${error.message}")
                }
            }
        })
    }
    
    /**
     * 复制Token到剪贴板
     */
    private fun copyTokenToClipboard() {
        val token = binding.tvPushToken.text.toString()
        
        if (token.isNotEmpty() && !token.contains("未获取")) {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("推送Token", token)
            clipboard.setPrimaryClip(clip)
            showToast("推送Token已复制到剪贴板")
            Log.d(TAG, "推送Token已复制: ${token.substring(0, 12)}...")
        } else {
            showToast("暂无推送Token可复制")
        }
    }
    
    /**
     * 测试网络连接
     */
    private fun testNetworkConnection() {
        if (!DooPushManager.isInitialized()) {
            showToast(getString(R.string.error_config_required))
            return
        }
        
        showStatusInfo("正在测试网络连接...")
        
        dooPushManager.testNetworkConnection { isConnected ->
            runOnUiThread {
                if (isConnected) {
                    showToast(getString(R.string.msg_connection_success))
                    showStatusInfo("网络连接正常 ✓")
                } else {
                    showToast(getString(R.string.msg_connection_failed))
                    showStatusInfo("网络连接失败 ✗")
                }
            }
        }
    }
    
    /**
     * 清除缓存
     */
    private fun clearCache() {
        if (!DooPushManager.isInitialized()) {
            showToast(getString(R.string.error_config_required))
            return
        }
        
        dooPushManager.clearCache()
        showToast(getString(R.string.msg_cache_cleared))
        updateUI()
        Log.d(TAG, "缓存已清除")
    }
    
    /**
     * 查看推送历史
     */
    private fun viewPushHistory() {
        val intent = Intent(this, PushHistoryActivity::class.java)
        startActivity(intent)
    }
    
    /**
     * 打开设置页面
     */
    private fun openSettings() {
        val intent = Intent(this, SettingsActivity::class.java)
        startActivity(intent)
    }
    
    /**
     * 检查通知权限
     */
    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                Log.d(TAG, "通知权限未授予，请求权限")
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
    
    /**
     * 显示权限对话框
     */
    private fun showPermissionDialog() {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.permission_notification_title))
            .setMessage(getString(R.string.permission_notification_message))
            .setPositiveButton(getString(R.string.permission_goto_settings)) { _, _ ->
                openAppSettings()
            }
            .setNegativeButton(getString(R.string.permission_cancel), null)
            .show()
    }
    
    /**
     * 打开应用设置页面
     */
    private fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
        }
        startActivity(intent)
    }
    
    /**
     * 更新UI状态
     */
    private fun updateUI() {
        // 更新SDK状态
        val isConfigured = DooPushManager.isInitialized()
        binding.tvSdkStatus.text = if (isConfigured) {
            getString(R.string.status_configured)
        } else {
            getString(R.string.status_not_configured)
        }
        
        // 更新状态指示器
        binding.statusIndicator.isSelected = isConfigured
        
        // 更新设备信息
        updateDeviceInfo()
        
        // 更新厂商信息和推送服务状态
        updateVendorInfo()
        
        // 更新按钮状态
        binding.btnRegisterPush.isEnabled = isConfigured
        binding.btnGetPushToken.isEnabled = isConfigured
        binding.btnTestConnection.isEnabled = isConfigured
        binding.btnClearCache.isEnabled = isConfigured
        
        // 显示SDK状态信息
        if (isConfigured) {
            showStatusInfo(dooPushManager.getSDKStatus())
        }
    }
    
    /**
     * 更新设备信息
     */
    private fun updateDeviceInfo() {
        val deviceInfo = dooPushManager.getDeviceInfo()
        if (deviceInfo != null) {
            val info = """
                平台: ${deviceInfo.platform}
                品牌: ${deviceInfo.brand}
                型号: ${deviceInfo.model}
                系统版本: Android ${deviceInfo.systemVersion}
                应用版本: ${deviceInfo.appVersion}
                包名: ${deviceInfo.bundleId}
            """.trimIndent()
            binding.tvDeviceInfo.text = info
        } else {
            binding.tvDeviceInfo.text = "设备信息未获取"
        }
    }
    
    /**
     * 更新厂商信息和推送服务状态
     */
    private fun updateVendorInfo() {
        try {
            val vendorInfo = dooPushManager.getDeviceVendorInfo()
            val vendorText = """
                厂商: ${vendorInfo.manufacturer}
                品牌: ${vendorInfo.brand}
                型号: ${vendorInfo.model}
                推荐服务: ${vendorInfo.preferredService}
            """.trimIndent()
            binding.tvVendorInfo.text = vendorText
            
            val supportedServices = dooPushManager.getSupportedPushServices()
            val servicesText = "支持的推送服务: ${supportedServices.joinToString(", ")}"
            binding.tvSupportedServices.text = servicesText
            
            Log.d(TAG, "设备厂商信息更新: ${vendorInfo.manufacturer} ${vendorInfo.brand}")
            Log.d(TAG, "支持的推送服务: $supportedServices")
            
        } catch (e: Exception) {
            Log.e(TAG, "更新厂商信息失败", e)
            binding.tvVendorInfo.text = "厂商信息获取失败"
            binding.tvSupportedServices.text = "推送服务检测失败"
        }
    }
    
    
    /**
     * 显示状态信息
     */
    private fun showStatusInfo(info: String) {
        binding.tvStatusInfo.text = info
        binding.cardStatusInfo.visibility = View.VISIBLE
    }
    
    /**
     * 隐藏状态信息
     */
    private fun hideStatusInfo() {
        binding.cardStatusInfo.visibility = View.GONE
    }
    
    /**
     * 显示Toast消息
     */
    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
    
    /**
     * 测试角标功能
     */
    private fun testBadgeFunction(count: Int) {
        Log.d(TAG, "测试角标功能: count=$count")
        
        try {
            val success = dooPushManager.setBadgeCount(count)
            val message = if (count == 0) {
                if (success) "角标已清除" else "清除角标失败"
            } else {
                if (success) "角标已设置为 $count" else "设置角标失败"
            }
            
            showToast(message)
            showStatusInfo(if (success) "$message ✓" else "$message ✗")
            
            Log.i(TAG, "角标测试结果: $message")
        } catch (e: Exception) {
            val errorMsg = "角标操作异常: ${e.message}"
            showToast(errorMsg)
            showStatusInfo("$errorMsg ✗")
            Log.e(TAG, "角标测试异常", e)
        }
    }
    
    // DooPushCallback 实现
    
    override fun onRegisterSuccess(token: String) {
        runOnUiThread {
            binding.tvPushToken.text = token
            
            // 显示服务类型信息
            val vendorInfo = dooPushManager.getDeviceVendorInfo()
            val serviceText = when (vendorInfo.preferredService) {
                DooPushDeviceVendor.PushService.HMS -> "华为 HMS Push"
                DooPushDeviceVendor.PushService.FCM -> "Google FCM"
                DooPushDeviceVendor.PushService.MIPUSH -> "小米推送"
                DooPushDeviceVendor.PushService.OPPO -> "OPPO推送"
                DooPushDeviceVendor.PushService.VIVO -> "VIVO推送"
                DooPushDeviceVendor.PushService.HONOR -> "荣耀推送"
            }
            binding.tvTokenType.text = "使用服务: $serviceText (${vendorInfo.brand})"
            binding.tvTokenType.visibility = View.VISIBLE
            
            showToast(getString(R.string.msg_registration_success))
            showStatusInfo("推送注册成功 ✓\n服务: $serviceText\nToken: ${token.substring(0, 12)}...")
            Log.i(TAG, "推送注册成功")
        }
    }
    
    override fun onRegisterError(error: DooPushError) {
        runOnUiThread {
            showToast(getString(R.string.msg_registration_failed, error.message))
            showStatusInfo("推送注册失败 ✗\n错误: ${error.message}")
            Log.e(TAG, "推送注册失败: ${error.message}")
        }
    }
    
    override fun onMessageReceived(message: PushMessage) {
        runOnUiThread {
            val displayText = message.toDisplayString()
            showToast("收到推送: $displayText")
            showStatusInfo("收到推送消息 ✓\n$displayText")
            Log.i(TAG, "收到推送消息: $displayText")
        }
    }
    
    // 推送通知事件回调
    
    override fun onNotificationClick(notificationData: DooPushNotificationHandler.NotificationData) {
        Log.i(TAG, "推送通知被点击: ${notificationData.title}")
        
        runOnUiThread {
            val message = "推送点击: ${notificationData.title ?: "未知标题"}"
            showToast(message)
            showStatusInfo("推送通知点击 ✓\n${notificationData.getDisplayContent()}")
        }
    }
    
    override fun onNotificationOpen(notificationData: DooPushNotificationHandler.NotificationData) {
        Log.i(TAG, "推送通知打开应用: ${notificationData.title}")
        
        runOnUiThread {
            val message = "推送打开: ${notificationData.title ?: "未知标题"}"
            showToast(message)
            showStatusInfo("推送打开应用 ✓\n${notificationData.getDisplayContent()}")
        }
    }
    
    override fun onTokenReceived(token: String) {
        runOnUiThread {
            binding.tvPushToken.text = token
            
            // 显示服务类型信息
            val vendorInfo = dooPushManager.getDeviceVendorInfo()
            val serviceText = when (vendorInfo.preferredService) {
                DooPushDeviceVendor.PushService.HMS -> "华为 HMS Push"
                DooPushDeviceVendor.PushService.FCM -> "Google FCM"
                DooPushDeviceVendor.PushService.MIPUSH -> "小米推送"
                DooPushDeviceVendor.PushService.OPPO -> "OPPO推送"
                DooPushDeviceVendor.PushService.VIVO -> "VIVO推送"
                DooPushDeviceVendor.PushService.HONOR -> "荣耀推送"
            }
            binding.tvTokenType.text = "使用服务: $serviceText (${vendorInfo.brand})"
            binding.tvTokenType.visibility = View.VISIBLE
            
            Log.d(TAG, "Token更新: ${token.substring(0, 12)}... (服务: $serviceText)")
        }
    }
    
    override fun onTokenError(error: DooPushError) {
        runOnUiThread {
            showToast("Token获取失败: ${error.message}")
            Log.e(TAG, "Token获取失败: ${error.message}")
        }
    }
    
    override fun onResume() {
        super.onResume()
        updateUI()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // 不要在这里释放SDK，因为可能还有其他Activity在使用
        Log.d(TAG, "MainActivity 销毁")
    }
    
    /**
     * 检查推送服务状态
     */
    private fun checkPushServicesStatus() {
        if (!DooPushManager.isInitialized()) {
            showToast("SDK尚未初始化")
            return
        }
        
        val vendorInfo = dooPushManager.getDeviceVendorInfo()
        val isFirebaseAvailable = dooPushManager.isFirebaseAvailable()
        val isHMSAvailable = dooPushManager.isHMSAvailable()
        val isXiaomiAvailable = dooPushManager.isXiaomiAvailable()
        val isOppoAvailable = dooPushManager.isOppoAvailable()
        val isVivoAvailable = dooPushManager.isVivoAvailable()
        
        val statusText = StringBuilder()
        statusText.append("推送服务可用性状态：\n\n")
        statusText.append("设备信息：\n")
        statusText.append("- 制造商：${vendorInfo.manufacturer}\n")
        statusText.append("- 品牌：${vendorInfo.brand}\n")
        statusText.append("- 型号：${vendorInfo.model}\n")
        statusText.append("- 推荐服务：${getServiceDisplayName(vendorInfo.preferredService)}\n\n")
        
        statusText.append("服务可用性：\n")
        statusText.append("- Firebase Cloud Messaging：${if (isFirebaseAvailable) "✓ 可用" else "✗ 不可用"}\n")
        statusText.append("- 华为 HMS Push：${if (isHMSAvailable) "✓ 可用" else "✗ 不可用"}\n")
        statusText.append("- 小米推送：${if (isXiaomiAvailable) "✓ 可用" else "✗ 不可用"}\n")
        statusText.append("- OPPO推送：${if (isOppoAvailable) "✓ 可用" else "✗ 不可用"}\n")
        statusText.append("- VIVO推送：${if (isVivoAvailable) "✓ 可用" else "✗ 不可用"}\n")
        
        statusText.append("\n支持的服务：\n")
        vendorInfo.supportedServices.forEach { service ->
            statusText.append("- ${getServiceDisplayName(service)}\n")
        }
        
        // 显示在对话框中
        AlertDialog.Builder(this)
            .setTitle("推送服务状态")
            .setMessage(statusText.toString())
            .setPositiveButton("确定", null)
            .show()
            
        Log.d(TAG, "推送服务状态检查完成")
    }
    
    /**
     * 获取推送服务显示名称
     */
    private fun getServiceDisplayName(service: DooPushDeviceVendor.PushService): String {
        return when (service) {
            DooPushDeviceVendor.PushService.HMS -> "华为 HMS Push"
            DooPushDeviceVendor.PushService.FCM -> "Google FCM" 
            DooPushDeviceVendor.PushService.MIPUSH -> "小米推送"
            DooPushDeviceVendor.PushService.OPPO -> "OPPO推送"
            DooPushDeviceVendor.PushService.VIVO -> "VIVO推送"
            DooPushDeviceVendor.PushService.HONOR -> "荣耀推送"
        }
    }
}

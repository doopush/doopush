package com.doopush.DooPushSDKExample

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.doopush.DooPushSDKExample.databinding.ActivitySettingsBinding
import com.doopush.DooPushSDKExample.utils.ConfigManager
import com.doopush.sdk.*
import com.doopush.sdk.models.DooPushError

/**
 * 设置页面
 * 
 * 提供SDK配置管理和调试信息展示
 */
class SettingsActivity : AppCompatActivity() {
    
    companion object {
        private const val TAG = "SettingsActivity"
    }
    
    private lateinit var binding: ActivitySettingsBinding
    private lateinit var configManager: ConfigManager
    private val dooPushManager = DooPushManager.getInstance()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // 初始化配置管理器
        configManager = ConfigManager.getInstance(this)
        
        // 初始化视图
        initViews()
        
        // 加载当前配置
        loadCurrentConfig()
        
        // 更新所有信息
        updateAllInfo()
        
        Log.d(TAG, "SettingsActivity 创建完成")
    }
    
    /**
     * 初始化视图
     */
    private fun initViews() {
        // 设置工具栏
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
        
        // 保存配置按钮
        binding.btnSaveConfig.setOnClickListener {
            saveConfig()
        }
        
        // 复制设备信息按钮
        binding.btnCopyDeviceInfo.setOnClickListener {
            copyToClipboard("设备信息", binding.tvDeviceInfo.text.toString())
        }
        
        // 复制推送Token按钮
        binding.btnCopyPushToken.setOnClickListener {
            copyToClipboard("推送Token", binding.tvPushToken.text.toString())
        }
        
        // 调试模式开关
        binding.switchDebug.setOnCheckedChangeListener { _, isChecked ->
            configManager.putBoolean("debug_enabled", isChecked)
            updateSdkStatus()
        }
        
        // 刷新信息按钮
        binding.btnRefreshInfo.setOnClickListener {
            updateAllInfo()
            showToast("信息已刷新")
        }
        
        // 重置配置按钮
        binding.btnResetConfig.setOnClickListener {
            showResetConfigDialog()
        }
    }
    
    /**
     * 加载当前配置
     */
    private fun loadCurrentConfig() {
        binding.etAppId.setText(MainActivity.appId)
        binding.etApiKey.setText(MainActivity.apiKey)
        binding.etBaseUrl.setText(MainActivity.baseUrl)
        binding.switchDebug.isChecked = MainActivity.debugEnabled
    }
    
    /**
     * 保存配置
     */
    private fun saveConfig() {
        val appId = binding.etAppId.text.toString().trim()
        val apiKey = binding.etApiKey.text.toString().trim()
        val baseUrl = binding.etBaseUrl.text.toString().trim()
        val debugEnabled = binding.switchDebug.isChecked
        
        // 简单验证
        if (appId.isBlank() || apiKey.isBlank() || baseUrl.isBlank()) {
            showToast("配置不能为空")
            return
        }
        
        // 修改全局变量
        MainActivity.appId = appId
        MainActivity.apiKey = apiKey
        MainActivity.baseUrl = baseUrl
        MainActivity.debugEnabled = debugEnabled
        
        // 重新配置SDK
        try {
            dooPushManager.configure(
                context = this,
                appId = appId,
                apiKey = apiKey,
                baseURL = baseUrl
            )
            
            showToast("配置保存成功")
            updateAllInfo()
            
            Log.d(TAG, "配置已保存并重新配置SDK: appId=$appId")
            
        } catch (e: Exception) {
            Log.e(TAG, "重新配置SDK失败", e)
            showToast("SDK重新配置失败: ${e.message}")
        }
    }
    
    /**
     * 更新所有信息
     */
    private fun updateAllInfo() {
        updateSdkStatus()
        updateDeviceInfo()
        updatePushToken()
        updateAppInfo()
    }
    
    /**
     * 更新SDK状态
     */
    private fun updateSdkStatus() {
        val statusBuilder = StringBuilder()
        
        try {
            val isInitialized = DooPushManager.isInitialized()
            statusBuilder.append("SDK状态: ${if (isInitialized) "已初始化" else "未初始化"}\n")
            
            if (isInitialized) {
                // 显示实际配置
                statusBuilder.append("应用ID: ${MainActivity.appId}\n")
                statusBuilder.append("服务器: ${MainActivity.baseUrl}\n")
                statusBuilder.append("调试模式: ${if (MainActivity.debugEnabled) "开启" else "关闭"}\n")
                
                // SDK版本信息
                statusBuilder.append("SDK版本: ${BuildConfig.VERSION_NAME}\n")
                statusBuilder.append("构建时间: ${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(BuildConfig.BUILD_TIME))}\n")
            }
            
        } catch (e: Exception) {
            statusBuilder.append("获取SDK状态失败: ${e.message}\n")
            Log.e(TAG, "获取SDK状态失败", e)
        }
        
        binding.tvSdkStatus.text = statusBuilder.toString().trim()
    }
    
    /**
     * 更新设备信息
     */
    private fun updateDeviceInfo() {
        val deviceBuilder = StringBuilder()
        
        try {
            // 基本设备信息
            deviceBuilder.append("设备品牌: ${Build.BRAND}\n")
            deviceBuilder.append("设备型号: ${Build.MODEL}\n")
            deviceBuilder.append("系统版本: Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\n")
            deviceBuilder.append("制造商: ${Build.MANUFACTURER}\n")
            deviceBuilder.append("设备指纹: ${Build.FINGERPRINT.substring(0, minOf(50, Build.FINGERPRINT.length))}...\n")
            
            // 应用信息
            val packageInfo = packageManager.getPackageInfo(packageName, 0)
            deviceBuilder.append("应用包名: ${packageName}\n")
            deviceBuilder.append("应用版本: ${packageInfo.versionName} (${packageInfo.longVersionCode})\n")
            
            // 获取 SDK 采集的设备信息
            if (DooPushManager.isInitialized()) {
                val deviceInfo = dooPushManager.getDeviceInfo()
                if (deviceInfo != null) {
                    deviceBuilder.append("推送通道: ${deviceInfo.channel}\n")
                    deviceBuilder.append("用户代理: ${deviceInfo.userAgent}\n")
                }

                // 额外设备环境信息（通过 DooPushDevice）
                try {
                    val deviceHelper = com.doopush.sdk.DooPushDevice(this)
                    val isEmu = if (deviceHelper.isEmulator()) "是" else "否"
                    deviceBuilder.append("是否模拟器: $isEmu\n")
                    val details = deviceHelper.getDetailedDeviceInfo()
                    details["manufacturer"]?.let { m ->
                        deviceBuilder.append("厂商识别: $m\n")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "获取额外设备信息失败", e)
                }
            }
            
        } catch (e: Exception) {
            deviceBuilder.append("获取设备信息失败: ${e.message}\n")
            Log.e(TAG, "获取设备信息失败", e)
        }
        
        binding.tvDeviceInfo.text = deviceBuilder.toString().trim()
    }
    
    /**
     * 更新推送Token
     */
    private fun updatePushToken() {
        if (!DooPushManager.isInitialized()) {
            binding.tvPushToken.text = "SDK未初始化"
            binding.tvPushTokenType.visibility = android.view.View.GONE
            return
        }
        
        binding.tvPushToken.text = "获取中..."
        binding.tvPushTokenType.visibility = android.view.View.GONE
        
        dooPushManager.getBestPushToken(object : DooPushTokenCallback {
            override fun onSuccess(token: String) {
                runOnUiThread {
                    binding.tvPushToken.text = token
                    
                    // 显示服务类型信息
                    val vendorInfo = dooPushManager.getDeviceVendorInfo()
                    val serviceText = when (vendorInfo.preferredService) {
                        DooPushDeviceVendor.PushService.HMS -> "华为 HMS Push"
                        DooPushDeviceVendor.PushService.FCM -> "Google FCM"
                        else -> "推送服务"
                    }
                    binding.tvPushTokenType.text = "使用服务: $serviceText (${vendorInfo.brand})"
                    binding.tvPushTokenType.visibility = android.view.View.VISIBLE
                    
                    Log.d(TAG, "推送Token获取成功: 服务=$serviceText")
                }
            }
            
            override fun onError(error: DooPushError) {
                runOnUiThread {
                    binding.tvPushToken.text = "获取失败: ${error.message}"
                    binding.tvPushTokenType.visibility = android.view.View.GONE
                    Log.e(TAG, "推送Token获取失败: ${error.message}")
                }
            }
        })
    }
    
    /**
     * 更新应用信息
     */
    private fun updateAppInfo() {
        val appBuilder = StringBuilder()
        
        try {
            val packageInfo = packageManager.getPackageInfo(packageName, 0)
            appBuilder.append("应用名称: ${getString(R.string.app_name)}\n")
            appBuilder.append("包名: ${packageName}\n")
            appBuilder.append("版本名称: ${packageInfo.versionName}\n")
            appBuilder.append("版本号: ${packageInfo.longVersionCode}\n")
            appBuilder.append("目标SDK: ${packageInfo.applicationInfo.targetSdkVersion}\n")
            appBuilder.append("最小SDK: ${packageInfo.applicationInfo.minSdkVersion}\n")
            
            // 构建信息
            appBuilder.append("构建类型: ${BuildConfig.BUILD_TYPE}\n")
            appBuilder.append("调试模式: ${if (BuildConfig.DEBUG) "是" else "否"}\n")
            appBuilder.append("应用ID: ${BuildConfig.APPLICATION_ID}\n")
            
            // 权限信息
            val hasNotificationPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
            appBuilder.append("通知权限: ${if (hasNotificationPermission) "已授予" else "未授予"}\n")
            
        } catch (e: Exception) {
            appBuilder.append("获取应用信息失败: ${e.message}\n")
            Log.e(TAG, "获取应用信息失败", e)
        }
        
        binding.tvAppInfo.text = appBuilder.toString().trim()
    }
    
    /**
     * 显示重置配置确认对话框
     */
    private fun showResetConfigDialog() {
        AlertDialog.Builder(this)
            .setTitle("重置配置")
            .setMessage("确定要重置所有配置到默认值吗？此操作不可撤销。")
            .setPositiveButton("确定") { _, _ ->
                resetConfig()
            }
            .setNegativeButton("取消", null)
            .show()
    }
    
    /**
     * 重置配置
     */
    private fun resetConfig() {
        MainActivity.appId = ""
        MainActivity.apiKey = ""
        MainActivity.baseUrl = ""
        MainActivity.debugEnabled = true
        
        loadCurrentConfig()
        updateAllInfo()
        showToast("配置已重置为空值")
    }
    
    /**
     * 复制到剪贴板
     */
    private fun copyToClipboard(label: String, text: String) {
        if (text.isNotEmpty() && text != "获取中..." && !text.startsWith("获取失败")) {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText(label, text)
            clipboard.setPrimaryClip(clip)
            showToast("已复制到剪贴板")
        } else {
            showToast("暂无内容可复制")
        }
    }
    
    /**
     * 显示Toast消息
     */
    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
    
    override fun onResume() {
        super.onResume()
        // 页面恢复时刷新信息
        updateAllInfo()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "SettingsActivity 销毁")
    }
}

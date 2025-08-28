package com.doopush.DooPushSDKExample

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.doopush.DooPushSDKExample.ui.theme.DooPushSDKExampleTheme
import com.doopush.sdk.DooPushManager
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*


class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "DooPushExample"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // 初始化推送管理器
        PushNotificationManager.instance.initialize(application)

        setContent {
            DooPushSDKExampleTheme {
                DooPushMainScreen()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // 同步权限状态
        PushNotificationManager.instance.checkPermissionStatus()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        PushNotificationManager.instance.onRequestPermissionsResult(requestCode, grantResults)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DooPushMainScreen() {
    val pushManager = PushNotificationManager.instance
    var showSettings by remember { mutableStateOf(false) }
    var showNotificationDetail by remember { mutableStateOf<PushNotificationManager.NotificationInfo?>(null) }
    var showToast by remember { mutableStateOf(false) }
    var toastMessage by remember { mutableStateOf("") }
    var showClearConfirm by remember { mutableStateOf(false) }

    // 监听状态变化，显示toast
    LaunchedEffect(pushManager.lastError.value, pushManager.updateMessage.value) {
        pushManager.lastError.value?.let {
            toastMessage = it
            showToast = true
            delay(3000)
            showToast = false
            pushManager.lastError.value = null
        }

        pushManager.updateMessage.value?.let {
            toastMessage = it
            showToast = true
            delay(3000)
            showToast = false
            pushManager.updateMessage.value = null
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = { Text("DooPush SDK 示例") },
                actions = {
                    IconButton(onClick = { showSettings = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "设置")
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { HeaderSection() }
            item { SDKStatusSection() }
            item { DeviceInfoSection() }
            item { ActionButtonsSection() }
            item { NotificationsSection(showNotificationDetail = { showNotificationDetail = it }) }
        }
    }

    // 设置页面
    if (showSettings) {
        SettingsDialog(onDismiss = { showSettings = false })
    }

    // 通知详情页面
    showNotificationDetail?.let { notification ->
        NotificationDetailDialog(
            notification = notification,
            onDismiss = { showNotificationDetail = null }
        )
    }

    // 清空确认对话框
    if (showClearConfirm) {
        AlertDialog(
            onDismissRequest = { showClearConfirm = false },
            title = { Text("清空通知历史") },
            text = { Text("确定要清空所有通知历史吗？此操作不可撤销。") },
            confirmButton = {
                TextButton(onClick = {
                    pushManager.clearNotifications()
                    showClearConfirm = false
                    toastMessage = "通知历史已清空"
                    showToast = true
                }) {
                    Text("清空", color = Color.Red)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirm = false }) {
                    Text("取消")
                }
            }
        )
    }

    // Toast提示
    if (showToast) {
        Toast(message = toastMessage)
    }
}

@Composable
fun HeaderSection() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Logo (使用系统图标代替)
        Icon(
            Icons.Default.Notifications,
            contentDescription = "DooPush Logo",
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Text(
            text = "DooPush SDK 示例",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        Text(
            text = "版本 ${DooPushManager.SDK_VERSION}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun SDKStatusSection() {
    val pushManager = PushNotificationManager.instance

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "SDK 状态",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            StatusRow(
                title = "SDK 状态",
                value = pushManager.sdkStatus.value.displayText,
                color = pushManager.sdkStatus.value.statusColor
            )

            StatusRow(
                title = "推送权限",
                value = pushManager.pushPermissionStatus.value.displayText,
                color = pushManager.pushPermissionStatus.value.statusColor
            )

            // 错误信息
            pushManager.lastError.value?.let { error ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
//                    Icon(
//                        Icons.Default.Error,
//                        contentDescription = "错误",
//                        tint = Color.Red,
//                        modifier = Modifier.size(16.dp)
//                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = error,
                        color = Color.Red,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // 更新消息
            pushManager.updateMessage.value?.let { message ->
                val rotationAngle by animateFloatAsState(
                    targetValue = if (pushManager.isUpdatingDevice.value) 360f else 0f,
                    animationSpec = if (pushManager.isUpdatingDevice.value)
                        androidx.compose.animation.core.infiniteRepeatable(tween(1000))
                    else tween(0),
                    label = "rotation"
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        if (pushManager.isUpdatingDevice.value) Icons.Default.Refresh else Icons.Default.CheckCircle,
                        contentDescription = "状态",
                        tint = if (pushManager.isUpdatingDevice.value) Color.Blue else Color.Green,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = message,
                        color = if (pushManager.isUpdatingDevice.value) Color.Blue else Color.Green,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
fun DeviceInfoSection() {
    val pushManager = PushNotificationManager.instance

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "设备信息",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            InfoRow(title = "设备 Token", value = pushManager.deviceToken.value ?: "未获取")
            InfoRow(title = "设备 ID", value = pushManager.deviceId.value ?: "未获取")
            InfoRow(title = "TCP 状态", value = pushManager.tcpState.value.getDescription())
            InfoRow(title = "设备型号", value = android.os.Build.MODEL)
            InfoRow(title = "系统版本", value = "Android ${android.os.Build.VERSION.RELEASE}")
        }
    }
}

@Composable
fun ActionButtonsSection() {
    val pushManager = PushNotificationManager.instance
    val context = LocalContext.current

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "操作",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            // 注册推送按钮
            Button(
                onClick = { pushManager.registerForPushNotifications() },
                modifier = Modifier.fillMaxWidth(),
                enabled = !pushManager.isLoading.value
            ) {
                if (pushManager.isLoading.value) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("注册中...")
                } else {
                    Icon(Icons.Default.Notifications, contentDescription = "注册推送")
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("注册推送通知")
                }
            }

            // 更新设备信息按钮
            Button(
                onClick = { pushManager.updateDeviceInfo() },
                modifier = Modifier.fillMaxWidth(),
                enabled = !pushManager.isUpdatingDevice.value
            ) {
                if (pushManager.isUpdatingDevice.value) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("更新中...")
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "更新设备信息")
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("更新设备信息")
                }
            }

            // 其他操作按钮
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        // 重新注册
                        pushManager.reRegisterForPushNotifications()
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("重新注册")
                }

                OutlinedButton(
                    onClick = {
                        // 打开设置
                        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.parse("package:${context.packageName}")
                        }
                        context.startActivity(intent)
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("系统设置")
                }
            }
            
            // 通知渠道管理按钮
//            Button(
//                onClick = {
//                    val intent = Intent(context, NotificationChannelActivity::class.java)
//                    context.startActivity(intent)
//                },
//                modifier = Modifier.fillMaxWidth()
//            ) {
////                Icon(Icons.Default.NotificationAdd, contentDescription = "通知渠道")
//                Spacer(modifier = Modifier.width(8.dp))
//                Text("通知渠道管理")
//            }
        }
    }
}

@Composable
fun NotificationsSection(showNotificationDetail: (PushNotificationManager.NotificationInfo) -> Unit) {
    val pushManager = PushNotificationManager.instance

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "通知历史 (${pushManager.notifications.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                if (pushManager.notifications.isNotEmpty()) {
                    TextButton(onClick = { /* 显示清空确认 */ }) {
                        Text("清空", color = Color.Red)
                    }
                }
            }

            if (pushManager.notifications.isEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
//                    Icon(
//                        Icons.Default.NotificationsOff,
//                        contentDescription = "无通知",
//                        tint = MaterialTheme.colorScheme.onSurfaceVariant
//                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "暂无推送通知",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    pushManager.notifications.take(5).forEach { notification ->
                        NotificationRow(
                            notification = notification,
                            onClick = { showNotificationDetail(notification) }
                        )
                    }

                    if (pushManager.notifications.size > 5) {
                        Text(
                            text = "查看更多...",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatusRow(title: String, value: String, color: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(color, shape = androidx.compose.foundation.shape.CircleShape)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = value,
                color = color,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
fun InfoRow(title: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f)
        )

        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(2f),
            textAlign = TextAlign.End,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun NotificationRow(
    notification: PushNotificationManager.NotificationInfo,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            Icons.Default.Notifications,
            contentDescription = "通知",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            notification.title?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            notification.content?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

//            Text(
//                text = formatTime(notification.receivedAt),
//                style = MaterialTheme.typography.caption,
//                color = MaterialTheme.colorScheme.onSurfaceVariant
//            )
        }

//        Icon(
//            Icons.Default.ChevronRight,
//            contentDescription = "详情",
//            tint = MaterialTheme.colorScheme.onSurfaceVariant
//        )
    }
}

@Composable
fun Toast(message: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 100.dp),
        contentAlignment = Alignment.BottomCenter
    ) {
        Card(
            modifier = Modifier.padding(horizontal = 20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.Black.copy(alpha = 0.8f))
        ) {
            Text(
                text = message,
                color = Color.White,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun SettingsDialog(onDismiss: () -> Unit) {
    val pushManager = PushNotificationManager.instance
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("设置") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // SDK配置
                Text("SDK 配置", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                InfoRow(title = "应用 ID", value = AppConfig.appId)
                InfoRow(title = "API 密钥", value = "${AppConfig.apiKey.take(10)}...")
                InfoRow(title = "服务器地址", value = AppConfig.displayBaseURL)
                InfoRow(title = "SDK 版本", value = DooPushManager.SDK_VERSION)

                Divider()

                // 设备信息
                Text("设备信息", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                InfoRow(title = "设备 Token", value = pushManager.deviceToken.value ?: "未获取")
                InfoRow(title = "设备 ID", value = pushManager.deviceId.value ?: "未获取")
                InfoRow(title = "设备型号", value = android.os.Build.MODEL)
                InfoRow(title = "系统版本", value = "Android ${android.os.Build.VERSION.RELEASE}")

                Divider()

                // 调试信息
                Text("调试信息", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                InfoRow(title = "推送权限", value = pushManager.pushPermissionStatus.value.displayText)
                InfoRow(title = "SDK 状态", value = pushManager.sdkStatus.value.displayText)
                InfoRow(title = "通知数量", value = "${pushManager.notifications.size} 条")

                pushManager.lastError.value?.let {
                    InfoRow(title = "最后错误", value = it)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("完成")
            }
        }
    )
}

@Composable
fun NotificationDetailDialog(
    notification: PushNotificationManager.NotificationInfo,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("通知详情") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                notification.title?.let {
                    Text("标题: $it", style = MaterialTheme.typography.bodyMedium)
                }

                notification.content?.let {
                    Text("内容: $it", style = MaterialTheme.typography.bodyMedium)
                }

                Text("接收时间: ${formatTime(notification.receivedAt)}", style = MaterialTheme.typography.bodySmall)
                Text("消息ID: ${notification.id}", style = MaterialTheme.typography.bodySmall)
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("关闭")
            }
        }
    )
}

private fun formatTime(date: Date): String {
    val formatter = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
    return formatter.format(date)
}

@Preview(showBackground = true)
@Composable
fun DooPushExamplePreview() {
    DooPushSDKExampleTheme {
        // Preview content would go here
    }
}
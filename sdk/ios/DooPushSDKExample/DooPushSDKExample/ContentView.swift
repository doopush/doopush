//
//  ContentView.swift
//  DooPushSDKExample
//
//  Created by 韦一 on 2025/8/25.
//

import SwiftUI
import DooPushSDK
import UserNotifications

struct ContentView: View {
    @EnvironmentObject var pushManager: PushNotificationManager
    @State private var showSettings = false
    @State private var showNotificationDetail: PushNotificationManager.NotificationInfo?
    @State private var showPermissionToast = false
    @State private var permissionToastMessage = ""
    @State private var rotationAngle = 0.0
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    headerSection
                    
                    // SDK Status
                    sdkStatusSection
                    
                    // Device Info
                    deviceInfoSection
                    
                    // Actions
                    actionsSection
                    
                    // Recent Notifications
                    notificationsSection
                }
                .padding(.horizontal, horizontalPadding)
            }
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("设置") {
                        showSettings = true
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .sheet(item: $showNotificationDetail) { notification in
                NotificationDetailView(notification: notification)
            }
            .refreshable {
                await refreshData()
            }
            .overlay(
                // Toast 提示框
                toastView
                    .opacity(showPermissionToast ? 1 : 0)
                    .offset(y: showPermissionToast ? 0 : 50)
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: showPermissionToast),
                alignment: .bottom
            )
        }
        .navigationViewStyle(StackNavigationViewStyle()) // 确保iPad上也使用单栏布局，不显示侧边栏
        .onChange(of: pushManager.isUpdatingDevice) { _, isUpdating in
            if isUpdating {
                // 开始旋转动画
                withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) {
                    rotationAngle = 360
                }
            } else {
                // 停止旋转动画
                withAnimation(.default) {
                    rotationAngle = 0
                }
            }
        }
    }
    
    // 计算横向内边距，iPad上增加一些边距让内容不会太宽
    private var horizontalPadding: CGFloat {
        let isIPad = UIDevice.current.userInterfaceIdiom == .pad
        return isIPad ? 40 : 16
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        VStack(spacing: 8) {
            Image("icon")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 128, height: 128)
            
            Text("DooPush SDK 示例")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("版本 \(DooPushManager.sdkVersion)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.bottom, 20)
    }
    
    // MARK: - SDK Status Section
    
    private var sdkStatusSection: some View {
        GroupBox("SDK 状态") {
            VStack(spacing: 12) {
                statusRow(
                    title: "SDK 状态",
                    value: pushManager.sdkStatus.displayText,
                    color: pushManager.sdkStatus.statusColor
                )
                
                statusRow(
                    title: "推送权限",
                    value: pushManager.pushPermissionStatus.displayText,
                    color: pushManager.pushPermissionStatus.statusColor
                )
                
                if let error = pushManager.lastError {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                        Spacer(minLength: 32)
                    }
                    .padding(.top, 4)
                }
                
                if let updateMessage = pushManager.updateMessage {
                    HStack {
                        Image(systemName: pushManager.isUpdatingDevice ? "arrow.triangle.2.circlepath" : "checkmark.circle.fill")
                            .foregroundColor(pushManager.isUpdatingDevice ? .blue : .green)
                            .rotationEffect(.degrees(rotationAngle))
                        Text(updateMessage)
                            .font(.caption)
                            .foregroundColor(pushManager.isUpdatingDevice ? .blue : .green)
                        Spacer(minLength: 32)
                    }
                    .padding(.top, 4)
                }
            }
            .padding(.top, 8)
        }
    }
    
    // MARK: - Device Info Section
    
    private var deviceInfoSection: some View {
        GroupBox("设备信息") {
            VStack(spacing: 12) {
                if let token = pushManager.deviceToken {
                    infoRow(title: "设备 Token", value: token)
                } else {
                    infoRow(title: "设备 Token", value: "未获取")
                }
                
                if let deviceId = pushManager.deviceId {
                    infoRow(title: "设备 ID", value: deviceId)
                } else {
                    infoRow(title: "设备 ID", value: "未获取")
                }
                
                infoRow(title: "设备型号", value: UIDevice.current.model)
                infoRow(title: "系统版本", value: "iOS \(UIDevice.current.systemVersion)")
            }
            .padding(.top, 8)
        }
    }
    
    // MARK: - Actions Section
    
    private var actionsSection: some View {
        VStack(spacing: 12) {
            // Register Button
            Button(action: {
                pushManager.registerForPushNotifications()
            }) {
                HStack {
                    if pushManager.isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "bell.circle.fill")
                    }
                    Text("注册推送通知")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Color.green)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(pushManager.isLoading)
            
            HStack(spacing: 12) {
                // Update Device Info Button
                Button(action: {
                    pushManager.updateDeviceInfo()
                }) {
                    HStack {
                        if pushManager.isUpdatingDevice {
                            ProgressView()
                                .scaleEffect(0.7)
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath")
                        }
                        Text(pushManager.isUpdatingDevice ? "更新中..." : "更新设备信息")
                    }
                }
                .font(.subheadline)
                .foregroundColor(.blue)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(Color.blue.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .disabled(pushManager.isUpdatingDevice)
                
                // Check Permission Button
                Button("检查权限") {
                    checkPermissionWithToast()
                }
                .font(.subheadline)
                .foregroundColor(.orange)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(Color.orange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            
            // Open Settings Button (if permission denied)
            if pushManager.pushPermissionStatus == .denied {
                Button("前往设置开启推送权限") {
                    openSettings()
                }
                .font(.subheadline)
                .foregroundColor(.red)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(Color.red.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
    
    // MARK: - Notifications Section
    
    private var notificationsSection: some View {
        GroupBox("通知历史 (\(pushManager.notifications.count))") {
            if pushManager.notifications.isEmpty {
                HStack {
                    Image(systemName: "bell.slash")
                        .foregroundColor(.secondary)
                    Text("暂无推送通知")
                        .foregroundColor(.secondary)
                    Spacer(minLength: 32)
                }
                .padding(.vertical, 20)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(pushManager.notifications.prefix(5).enumerated()), id: \.element.id) { index, notification in
                        Button(action: {
                            showNotificationDetail = notification
                        }) {
                            notificationRow(notification)
                        }
                        .buttonStyle(PlainButtonStyle())
                        
                        if index < min(4, pushManager.notifications.count - 1) {
                            Divider()
                        }
                    }
                    
                    if pushManager.notifications.count > 5 {
                        HStack {
                            Spacer(minLength: 32)
                            Text("查看更多...")
                                .font(.caption)
                                .foregroundColor(.blue)
                            Spacer(minLength: 32)
                        }
                        .padding(.top, 8)
                    }
                    
                    if pushManager.notifications.count > 0 {
                        Button("清空历史") {
                            pushManager.clearNotifications()
                        }
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding(.top, 8)
                    }
                }
            }
        }
    }
    
    // MARK: - Helper Views
    
    private func statusRow(title: String, value: String, color: Color) -> some View {
        HStack {
            Text(title)
                .fontWeight(.medium)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 32)
            HStack(spacing: 4) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                Text(value)
                    .foregroundColor(color)
                    .fontWeight(.medium)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
    }
    
    private func infoRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .fontWeight(.medium)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 32)
            Text(value)
                .foregroundColor(.secondary)
                .font(.system(.body, design: .monospaced))
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }
    
    private func notificationRow(_ notification: PushNotificationManager.NotificationInfo) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "bell.fill")
                .foregroundColor(.blue)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 4) {
                if let title = notification.title {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(2)
                }
                
                if let content = notification.content {
                    Text(content)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(3)
                }
                
                Text(formatTime(notification.receivedAt))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer(minLength: 32)
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
    
    // MARK: - Helper Methods
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
    
    private func openSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        UIApplication.shared.open(settingsUrl)
    }
    
    /// 检查权限并显示toast提示
    private func checkPermissionWithToast() {
        // 先检查当前权限状态
        let currentStatus = pushManager.pushPermissionStatus
        
        // 如果已经有权限，显示toast
        if currentStatus == .authorized {
            showToast(message: "推送权限已经开启，无需重复检查")
        } else {
            // 没有权限时，执行权限检查（可能会触发系统权限弹窗）
            pushManager.checkPermissionStatus()
            
            // 给用户一个反馈，说明正在检查
            showToast(message: "正在检查推送权限状态...")
        }
    }
    
    /// 显示toast并自动隐藏
    private func showToast(message: String) {
        permissionToastMessage = message
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            showPermissionToast = true
        }
        
        // 2.5秒后自动隐藏
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                showPermissionToast = false
            }
        }
    }
    
    // MARK: - Toast View
    
    private var toastView: some View {
        HStack {
            Text(permissionToastMessage)
                .foregroundColor(.white)
                .font(.system(.body, weight: .medium))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.black.opacity(0.8))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
        .padding(.horizontal, 20)
        .padding(.bottom, 50)
    }
    
    @MainActor
    private func refreshData() async {
        pushManager.checkPermissionStatus()
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second delay
    }
}

#Preview {
    ContentView()
        .environmentObject(PushNotificationManager())
}

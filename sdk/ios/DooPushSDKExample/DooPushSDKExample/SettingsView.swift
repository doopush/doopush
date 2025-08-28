//
//  SettingsView.swift
//  DooPushSDKExample
//
//  Created by 韦一 on 2025/8/25.
//

import SwiftUI
import DooPushSDK
import UIKit

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var pushManager: PushNotificationManager
    
    @State private var showTokenDetail = false
    @State private var showDeviceDetail = false
    @State private var showToast = false
    @State private var toastMessage = ""
    @State private var showClearConfirm = false
    @State private var badgeRefreshTrigger = 0
    
    var body: some View {
        NavigationView {
            Form {
                // SDK Configuration Section
                Section {
                    configurationInfo
                } header: {
                    Text("SDK 配置")
                }
                
                // Device Information Section
                Section {
                    deviceInformation
                } header: {
                    Text("设备详细信息")
                }
                
                // Debug Information Section
                Section {
                    debugInformation
                } header: {
                    Text("调试信息")
                }
                
                // Actions Section
                Section {
                    actionButtons
                } header: {
                    Text("操作")
                }
                
                // Badge Management Section
                Section {
                    badgeManagementSection
                } header: {
                    Text("角标管理")
                }
                
                // About Section
                Section {
                    aboutInformation
                } header: {
                    Text("关于")
                }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") {
                        dismiss()
                    }
                }
            }
            .overlay(
                // Toast 提示框
                toastView
                    .opacity(showToast ? 1 : 0)
                    .offset(y: showToast ? 0 : 50)
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: showToast),
                alignment: .bottom
            )
            .alert("清空通知历史", isPresented: $showClearConfirm) {
                Button("取消", role: .cancel) { }
                Button("清空", role: .destructive) {
                    pushManager.clearNotifications()
                    showToast(message: "通知历史已清空")
                }
            } message: {
                Text("确定要清空所有通知历史吗？此操作不可撤销。")
            }
            .onChange(of: pushManager.sdkStatus) { _, newStatus in
                if newStatus == .registered {
                    showToast(message: "推送注册成功")
                } else if newStatus == .failed {
                    showToast(message: "推送注册失败")
                }
            }
            .onChange(of: pushManager.updateMessage) { _, newMessage in
                if let message = newMessage {
                    showToast(message: message)
                }
            }.onChange(of: pushManager.lastError) { _, newError in
                if let error = newError {
                    showToast(message: error)
                }
            }
        }
    }
    
    // MARK: - Configuration Info
    
    private var configurationInfo: some View {
        Group {
            configRow(title: "应用 ID", value: AppConfig.appId)
            configRow(title: "API 密钥", value: AppConfig.apiKey)
            configRow(title: "服务器地址", value: AppConfig.displayBaseURL)
            configRow(title: "SDK 版本", value: DooPushManager.sdkVersion)
        }
    }
    
    // MARK: - Device Information
    
    private var deviceInformation: some View {
        Group {
            if let token = pushManager.deviceToken {
                Button(action: {
                    showTokenDetail = true
                }) {
                    HStack {
                        Text("设备 Token")
                            .lineLimit(1)
                            .truncationMode(.tail)
                        Spacer(minLength: 32)
                        Text(token)
                            .foregroundColor(.secondary)
                            .font(.system(.body, design: .monospaced))
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Image(systemName: "chevron.right")
                            .foregroundColor(.secondary)
                            .font(.caption)
                    }
                }
                .foregroundColor(.primary)
                .sheet(isPresented: $showTokenDetail) {
                    TokenDetailView(token: token)
                }
            } else {
                configRow(title: "设备 Token", value: "未获取")
            }
            
            if let deviceId = pushManager.deviceId {
                configRow(title: "设备 ID", value: deviceId)
            } else {
                configRow(title: "设备 ID", value: "未获取")
            }
            
            configRow(title: "设备型号", value: UIDevice.current.model)
            configRow(title: "系统名称", value: UIDevice.current.systemName)
            configRow(title: "系统版本", value: UIDevice.current.systemVersion)
            
            if let bundleId = Bundle.main.bundleIdentifier {
                configRow(title: "Bundle ID", value: bundleId)
            }
            
            if let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String {
                configRow(title: "应用版本", value: appVersion)
            }
            
            if let buildNumber = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String {
                configRow(title: "构建版本", value: buildNumber)
            }
        }
    }
    
    // MARK: - Debug Information
    
    private var debugInformation: some View {
        Group {
            configRow(title: "推送权限", value: pushManager.pushPermissionStatus.displayText)
            configRow(title: "SDK 状态", value: pushManager.sdkStatus.displayText)
            configRow(title: "通知历史", value: "\(pushManager.notifications.count) 条")
            
            if let error = pushManager.lastError {
                HStack {
                    Text("最后错误")
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Spacer(minLength: 32)
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .onTapGesture {
                            UIPasteboard.general.string = error
                            showToast(message: "错误信息已复制到剪贴板")
                        }
                }
            }
        }
    }
    
    // MARK: - Action Buttons
    
    private var actionButtons: some View {
        Group {
            Button("重新注册推送") {
                pushManager.registerForPushNotifications()
                showToast(message: "正在重新注册推送服务...")
            }
            .foregroundColor(.blue)
            
            Button("更新设备信息") {
                pushManager.updateDeviceInfo()
                showToast(message: "正在更新设备信息...")
            }
            .foregroundColor(.blue)
            
            Button("前往系统设置") {
                openSettings()
            }
            .foregroundColor(.blue)
            
            Button("上报统计数据") {
                pushManager.reportStatistics()
                showToast(message: "统计数据上报已触发")
            }
            .foregroundColor(.green)
            
            Button("清空通知历史") {
                showClearConfirm = true
            }
            .foregroundColor(.red)
        }
    }
    
    // MARK: - Badge Management Section
    
    private var badgeManagementSection: some View {
        Group {
            // Current Badge Display
            HStack {
                Text("当前角标数字")
                Spacer()
                Text("\(UIApplication.shared.applicationIconBadgeNumber)")
                    .font(.system(.title3, design: .monospaced))
                    .fontWeight(.semibold)
                    .foregroundColor(.blue)
                    .id(badgeRefreshTrigger) // 强制UI更新
            }
            
            // Quick Set Buttons
            Button("设置为 5") {
                updateBadge(to: 5)
            }
            .foregroundColor(.blue)
            
            Button("设置为 10") {
                updateBadge(to: 10)
            }
            .foregroundColor(.blue)
            
            // Increment/Decrement Buttons
            Button("角标 +1") {
                incrementBadge()
            }
            .foregroundColor(.green)
            
            Button("角标 -1") {
                decrementBadge()
            }
            .foregroundColor(.orange)
            
            Button("随机设置") {
                let randomNumber = Int.random(in: 1...99)
                updateBadge(to: randomNumber)
            }
            .foregroundColor(.purple)
            
            Button("清除角标") {
                updateBadge(to: 0)
            }
            .foregroundColor(.red)
        }
    }
    
    // MARK: - About Information
    
    private var aboutInformation: some View {
        Group {
            configRow(title: "示例应用版本", value: "1.0.0")
            configRow(title: "构建时间", value: formatBuildDate())
            
            Link(destination: URL(string: "https://github.com/doopush/doopush")!) {
                HStack {
                    Text("项目主页")
                    Spacer(minLength: 32)
                    Image(systemName: "arrow.up.right.square")
                        .foregroundColor(.secondary)
                        .font(.caption)
                }
            }
        }
    }
    
    // MARK: - Helper Views
    
    private func configRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .lineLimit(1)
                .truncationMode(.tail)
            
            Spacer(minLength: 32)
            
            Text(value)
                .foregroundColor(.secondary)
                .font(.system(.body, design: .monospaced))
                .lineLimit(1)
                .truncationMode(.middle)
                .onTapGesture {
                    UIPasteboard.general.string = value
                    showToast(message: "\(title)已复制到剪贴板")
                }
        }
    }
    
    // MARK: - Toast View
    
    private var toastView: some View {
        HStack {
            Text(toastMessage)
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
    
    // MARK: - Helper Methods
    
    /// 显示toast并自动隐藏
    private func showToast(message: String) {
        toastMessage = message
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            showToast = true
        }
        
        // 2.5秒后自动隐藏
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                showToast = false
            }
        }
    }
    
    private func openSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        UIApplication.shared.open(settingsUrl)
    }
    
    private func formatBuildDate() -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: Date())
    }
    
    // MARK: - Badge Management Methods
    
    /// 更新角标数字
    private func updateBadge(to number: Int) {
        DooPushManager.shared.setBadgeNumber(number)
        
        // 立即触发UI更新
        badgeRefreshTrigger += 1
        
        // 延迟一点点显示Toast
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            if number == 0 {
                showToast(message: "角标已清除")
            } else {
                showToast(message: "角标已设置为 \(number)")
            }
        }
    }
    
    /// 增加角标数字
    private func incrementBadge() {
        DooPushManager.shared.incrementBadgeNumber()
        
        // 立即触发UI更新
        badgeRefreshTrigger += 1
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            let current = UIApplication.shared.applicationIconBadgeNumber
            showToast(message: "角标数字 +1，当前: \(current)")
        }
    }
    
    /// 减少角标数字
    private func decrementBadge() {
        DooPushManager.shared.decrementBadgeNumber()
        
        // 立即触发UI更新
        badgeRefreshTrigger += 1
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            let current = UIApplication.shared.applicationIconBadgeNumber
            showToast(message: "角标数字 -1，当前: \(current)")
        }
    }
}

// MARK: - Token Detail View

struct TokenDetailView: View {
    let token: String
    @Environment(\.dismiss) private var dismiss
    @State private var showToast = false
    @State private var toastMessage = ""
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Group {
                        Text("完整设备 Token")
                            .font(.headline)
                        
                        Text(token)
                            .font(.system(.body, design: .monospaced))
                            .textSelection(.enabled)
                            .padding()
                            .background(Color.gray.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        
                        Button("复制到剪贴板") {
                            UIPasteboard.general.string = token
                            showToast(message: "设备 Token 已复制到剪贴板")
                        }
                        .frame(maxWidth: .infinity)
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.blue)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        
                        Group {
                            Text("说明")
                                .font(.headline)
                                .padding(.top)
                            
                            Text("设备 Token 是 iOS 设备的唯一推送标识符，由 Apple Push Notification service (APNs) 分配。此 Token 会在以下情况下发生变化：")
                            
                            VStack(alignment: .leading, spacing: 8) {
                                bulletPoint("应用重新安装")
                                bulletPoint("设备恢复")
                                bulletPoint("iOS 系统更新")
                                bulletPoint("长时间未使用应用")
                            }
                            .padding(.leading)
                            
                            Text("因此，建议在每次应用启动时都检查并更新设备 Token。")
                                .padding(.top, 4)
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                }
                .padding()
            }
            .navigationTitle("设备 Token")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") {
                        dismiss()
                    }
                }
            }
            .overlay(
                // Toast 提示框
                tokenToastView
                    .opacity(showToast ? 1 : 0)
                    .offset(y: showToast ? 0 : 50)
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: showToast),
                alignment: .bottom
            )
        }
    }
    
    // MARK: - Toast View for Token Detail
    
    private var tokenToastView: some View {
        HStack {
            Text(toastMessage)
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
    
    /// 显示toast并自动隐藏
    private func showToast(message: String) {
        toastMessage = message
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            showToast = true
        }
        
        // 2.5秒后自动隐藏
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                showToast = false
            }
        }
    }
    
    private func bulletPoint(_ text: String) -> some View {
        HStack(alignment: .top) {
            Text("•")
            Text(text)
            Spacer(minLength: 32)
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(PushNotificationManager())
}


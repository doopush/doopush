//
//  NotificationDetailView.swift
//  DooPushSDKExample
//
//  Created by 韦一 on 2025/8/25.
//

import SwiftUI
import DooPushSDK

struct NotificationDetailView: View {
    let notification: PushNotificationManager.NotificationInfo
    @Environment(\.dismiss) private var dismiss
    @State private var copiedMessage = ""
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Basic Info Section
                    basicInfoSection
                    
                    // Content Section
                    if notification.title != nil || notification.content != nil {
                        contentSection
                    }
                    
                    // Payload Section
                    if let payload = notification.payload, !payload.isEmpty {
                        payloadSection
                    }
                    
                    // Time Info Section
                    timeInfoSection
                    
                    // Actions Section
                    actionsSection
                }
                .padding()
            }
            .navigationTitle("推送详情")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") {
                        dismiss()
                    }
                }
            }
            .alert("复制成功", isPresented: .constant(!copiedMessage.isEmpty)) {
                Button("确定") {
                    copiedMessage = ""
                }
            } message: {
                Text(copiedMessage)
            }
        }
    }
    
    // MARK: - Basic Info Section
    
    private var basicInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "bell.fill")
                    .foregroundColor(.blue)
                    .font(.title2)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("推送通知")
                        .font(.headline)
                    Text("DooPush SDK")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer(minLength: 32)
            }
            
            Divider()
        }
    }
    
    // MARK: - Content Section
    
    private var contentSection: some View {
        GroupBox("消息内容") {
            VStack(alignment: .leading, spacing: 12) {
                if let title = notification.title {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("标题")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(title)
                            .font(.headline)
                            .textSelection(.enabled)
                    }
                }
                
                if let content = notification.content {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("内容")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(content)
                            .font(.body)
                            .textSelection(.enabled)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
    
    // MARK: - Payload Section
    
    private var payloadSection: some View {
        GroupBox("附加数据") {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(notification.payload?.sorted(by: { $0.key < $1.key }) ?? []), id: \.key) { key, value in
                    payloadRow(key: key, value: value)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
    
    // MARK: - Time Info Section
    
    private var timeInfoSection: some View {
        GroupBox("时间信息") {
            VStack(alignment: .leading, spacing: 8) {
                infoRow(title: "接收时间", value: formatFullTime(notification.receivedAt))
                infoRow(title: "相对时间", value: formatRelativeTime(notification.receivedAt))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
    
    // MARK: - Actions Section
    
    private var actionsSection: some View {
        VStack(spacing: 12) {
            Button("复制完整信息") {
                copyFullInfo()
            }
            .frame(maxWidth: .infinity)
            .foregroundColor(.white)
            .padding()
            .background(Color.blue)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            
            if let payload = notification.payload, !payload.isEmpty {
                Button("复制附加数据 (JSON)") {
                    copyPayloadAsJSON()
                }
                .frame(maxWidth: .infinity)
                .foregroundColor(.blue)
                .padding()
                .background(Color.blue.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }
    
    // MARK: - Helper Views
    
    private func payloadRow(key: String, value: Any) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(key)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(formatPayloadValue(value))
                .font(.system(.body, design: .monospaced))
                .textSelection(.enabled)
                .padding(8)
                .background(Color.gray.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
    }
    
    private func infoRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer(minLength: 32)
            Text(value)
                .font(.system(.caption, design: .monospaced))
        }
    }
    
    // MARK: - Helper Methods
    
    private func formatPayloadValue(_ value: Any) -> String {
        if let stringValue = value as? String {
            return stringValue
        } else if let numberValue = value as? NSNumber {
            return numberValue.stringValue
        } else if let boolValue = value as? Bool {
            return boolValue ? "true" : "false"
        } else if let arrayValue = value as? [Any] {
            do {
                let data = try JSONSerialization.data(withJSONObject: arrayValue, options: [.prettyPrinted])
                return String(data: data, encoding: .utf8) ?? "Array"
            } catch {
                return "Array"
            }
        } else if let dictValue = value as? [String: Any] {
            do {
                let data = try JSONSerialization.data(withJSONObject: dictValue, options: [.prettyPrinted])
                return String(data: data, encoding: .utf8) ?? "Object"
            } catch {
                return "Object"
            }
        } else {
            return String(describing: value)
        }
    }
    
    private func formatFullTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .medium
        return formatter.string(from: date)
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let now = Date()
        let timeInterval = now.timeIntervalSince(date)
        
        if timeInterval < 60 {
            return "\(Int(timeInterval)) 秒前"
        } else if timeInterval < 3600 {
            return "\(Int(timeInterval / 60)) 分钟前"
        } else if timeInterval < 86400 {
            return "\(Int(timeInterval / 3600)) 小时前"
        } else {
            return "\(Int(timeInterval / 86400)) 天前"
        }
    }
    
    private func copyFullInfo() {
        var info: [String] = []
        
        info.append("=== DooPush 推送通知详情 ===")
        info.append("")
        
        if let title = notification.title {
            info.append("标题: \(title)")
        }
        
        if let content = notification.content {
            info.append("内容: \(content)")
        }
        
        info.append("接收时间: \(formatFullTime(notification.receivedAt))")
        
        if let payload = notification.payload, !payload.isEmpty {
            info.append("")
            info.append("附加数据:")
            for (key, value) in payload.sorted(by: { $0.key < $1.key }) {
                info.append("  \(key): \(formatPayloadValue(value))")
            }
        }
        
        let fullInfo = info.joined(separator: "\n")
        UIPasteboard.general.string = fullInfo
        copiedMessage = "完整信息已复制到剪贴板"
    }
    
    private func copyPayloadAsJSON() {
        guard let payload = notification.payload else { return }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                UIPasteboard.general.string = jsonString
                copiedMessage = "附加数据 JSON 已复制到剪贴板"
            }
        } catch {
            copiedMessage = "复制失败：JSON 序列化错误"
        }
    }
}

#Preview {
    NotificationDetailView(
        notification: PushNotificationManager.NotificationInfo(
            title: "测试标题",
            content: "这是一条测试推送消息的内容",
            payload: [
                "action": "open_page",
                "page_id": "123",
                "extra_data": ["key1": "value1", "key2": "value2"]
            ],
            dedupKey: "123",
            receivedAt: Date()
        )
    )
}

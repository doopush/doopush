//
//  Config.swift
//  DooPushSDKExample
//
//  配置文件 - 统一管理应用配置参数
//

import Foundation

struct AppConfig {
    
    // MARK: - DooPush SDK 配置
    
    /// 应用ID
    static let appId = "1"
    
    /// API密钥
    static let apiKey = "dp_live_XXpwyhNOxpsXWh3sRxxhZ0KK9Wo8ArwB"
    
    /// 服务器基础URL
    static let baseURL = "https://doopush.com/api/v1"
    
    /// 获取不带API版本的服务器地址（用于UI显示）
    static var displayBaseURL: String {
        return baseURL.replacingOccurrences(of: "/api/v1", with: "")
    }
    
    /// 输出配置信息到控制台
    static func printConfiguration() {
        Logger.info("🔧 配置参数:")
        Logger.info("   App ID: \(appId)")
        Logger.info("   API Key: \(apiKey)")
        Logger.info("   Base URL: \(displayBaseURL)")
    }
}

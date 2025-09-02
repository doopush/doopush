//
//  Config.swift
//  DooPushSDKExample
//
//  配置文件 - 统一管理应用配置参数
//

import Foundation

struct AppConfig {
    
    // MARK: - 本地配置优先级
    // 1) 启动参数/NSUserDefaults（Scheme Arguments）
    // 2) 未入库的 DooPushLocalConfig.plist（添加到 Target 但被 .gitignore 忽略）
    // 3) 代码默认值（回退）
    
    private enum Keys {
        static let appId = "APP_ID"
        static let apiKey = "API_KEY"
        static let baseURL = "BASE_URL"
    }
    
    private static let defaults: [String: String] = [
        Keys.appId: "1",
        Keys.apiKey: "dp_live_XXpwyhNOxpsXWh3sRxxhZ0KK9Wo8ArwB",
        Keys.baseURL: "https://doopush.com/api/v1",
    ]
    
    private static let userDefaults = UserDefaults.standard
    
    private static let localPlist: [String: Any]? = {
        // 先从 Bundle 中找（需将 DooPushLocalConfig.plist 加入目标）
        if let path = Bundle.main.path(forResource: "DooPushLocalConfig", ofType: "plist"),
           let data = NSDictionary(contentsOfFile: path) as? [String: Any] {
            return data
        }
        // 兜底：尝试读取沙盒 Documents 目录的同名文件（无需加入工程）
        let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true)
        if let documentsPath = paths.first {
            let candidate = (documentsPath as NSString).appendingPathComponent("DooPushLocalConfig.plist")
            if let data = NSDictionary(contentsOfFile: candidate) as? [String: Any] {
                return data
            }
        }
        return nil
    }()
    
    private static func value(for key: String) -> String {
        if let override = userDefaults.string(forKey: key), !override.isEmpty {
            return override
        }
        if let dict = localPlist, let v = dict[key] as? String, !v.isEmpty {
            return v
        }
        return defaults[key] ?? ""
    }
    
    // MARK: - DooPush SDK 配置（对外暴露）
    
    /// 应用ID
    static var appId: String { value(for: Keys.appId) }
    
    /// API密钥
    static var apiKey: String { value(for: Keys.apiKey) }
    
    /// 服务器基础URL
    static var baseURL: String { value(for: Keys.baseURL) }
    
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

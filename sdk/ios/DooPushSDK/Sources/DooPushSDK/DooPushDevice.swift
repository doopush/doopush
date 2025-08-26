import Foundation
import UIKit

/// 设备信息管理类
public class DooPushDevice {
    
    /// 获取当前设备信息
    /// - Returns: 设备信息结构
    public func getCurrentDeviceInfo() -> DeviceInfo {
        let device = UIDevice.current
        
        return DeviceInfo(
            platform: "ios",
            channel: "apns",
            bundleId: bundleIdentifier(),
            brand: "Apple",
            model: deviceModelName(),
            systemVersion: device.systemVersion,
            appVersion: appVersion(),
            userAgent: userAgent()
        )
    }
    
    /// 获取应用Bundle ID
    /// - Returns: Bundle Identifier
    private func bundleIdentifier() -> String {
        return Bundle.main.bundleIdentifier ?? ""
    }
    
    /// 获取设备型号名称
    /// - Returns: 设备型号
    private func deviceModelName() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let identifier = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }
        
        return mapToDeviceName(identifier: identifier)
    }
    
    /// 映射设备标识符到可读名称
    /// - Parameter identifier: 设备标识符
    /// - Returns: 设备名称
    private func mapToDeviceName(identifier: String) -> String {
        switch identifier {
        // iPhone 系列
        case "iPhone14,7": return "iPhone 14"
        case "iPhone14,8": return "iPhone 14 Plus"
        case "iPhone15,2": return "iPhone 14 Pro"
        case "iPhone15,3": return "iPhone 14 Pro Max"
        case "iPhone15,4": return "iPhone 15"
        case "iPhone15,5": return "iPhone 15 Plus"
        case "iPhone16,1": return "iPhone 15 Pro"
        case "iPhone16,2": return "iPhone 15 Pro Max"
        case "iPhone17,3": return "iPhone 16"
        case "iPhone17,4": return "iPhone 16 Plus"
        case "iPhone17,1": return "iPhone 16 Pro"
        case "iPhone17,2": return "iPhone 16 Pro Max"
        
        // iPad 系列
        case "iPad13,18", "iPad13,19": return "iPad (10th generation)"
        case "iPad14,3", "iPad14,4": return "iPad Pro (11-inch) (4th generation)"
        case "iPad14,5", "iPad14,6": return "iPad Pro (12.9-inch) (6th generation)"
        case "iPad13,1", "iPad13,2": return "iPad Air (5th generation)"
        case "iPad14,8", "iPad14,9": return "iPad Air (11-inch) (M2)"
        case "iPad14,10", "iPad14,11": return "iPad Air (13-inch) (M2)"
        
        // iPad mini
        case "iPad14,1", "iPad14,2": return "iPad mini (6th generation)"
        
        // 模拟器
        case "x86_64", "arm64":
            #if targetEnvironment(simulator)
            return "iOS Simulator (\(UIDevice.current.model))"
            #else
            return UIDevice.current.model
            #endif
            
        default:
            // 如果无法识别，返回原始标识符
            return identifier.isEmpty ? UIDevice.current.model : identifier
        }
    }
    
    /// 获取应用版本信息
    /// - Returns: 应用版本
    private func appVersion() -> String {
        let mainBundle = Bundle.main
        let version = mainBundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = mainBundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        
        return "\(version) (\(build))"
    }
    
    /// 生成User Agent字符串
    /// - Returns: User Agent字符串
    private func userAgent() -> String {
        let mainBundle = Bundle.main
        let appName = mainBundle.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String 
                     ?? mainBundle.object(forInfoDictionaryKey: "CFBundleName") as? String 
                     ?? "Unknown"
        
        let appVersion = self.appVersion()
        let systemVersion = UIDevice.current.systemVersion
        let deviceModel = deviceModelName()
        
        return "\(appName)/\(appVersion) (iOS \(systemVersion); \(deviceModel))"
    }
    
    /// 获取设备唯一标识符（IDFV）
    /// - Returns: 设备标识符
    public func getDeviceIdentifier() -> String {
        return UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
    }
    
    /// 获取设备屏幕信息
    /// - Returns: 屏幕信息
    public func getScreenInfo() -> ScreenInfo {
        let screen = UIScreen.main
        let bounds = screen.bounds
        let scale = screen.scale
        
        return ScreenInfo(
            width: Int(bounds.width * scale),
            height: Int(bounds.height * scale),
            scale: scale
        )
    }
    
    /// 获取设备内存信息
    /// - Returns: 内存信息（MB）
    public func getMemoryInfo() -> MemoryInfo {
        let physicalMemory = ProcessInfo.processInfo.physicalMemory
        
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }
        
        let usedMemory = kerr == KERN_SUCCESS ? info.resident_size : 0
        
        return MemoryInfo(
            totalMemory: Int(physicalMemory / 1024 / 1024), // 转换为MB
            usedMemory: Int(usedMemory / 1024 / 1024)       // 转换为MB
        )
    }
    
    /// 获取网络状态
    /// - Returns: 网络状态
    public func getNetworkStatus() -> String {
        // 简单的网络状态检测
        // 在实际项目中可能需要使用 Reachability 或类似的库
        return "unknown"
    }
}

// MARK: - 数据结构

/// 设备信息结构
public struct DeviceInfo: Codable {
    /// 平台类型
    public let platform: String
    
    /// 推送通道
    public let channel: String
    
    /// Bundle ID
    public let bundleId: String
    
    /// 设备品牌
    public let brand: String
    
    /// 设备型号
    public let model: String
    
    /// 系统版本
    public let systemVersion: String
    
    /// 应用版本
    public let appVersion: String
    
    /// User Agent
    public let userAgent: String
    
    /// 编码键
    enum CodingKeys: String, CodingKey {
        case platform = "platform"
        case channel = "channel"
        case bundleId = "bundle_id"
        case brand = "brand"
        case model = "model"
        case systemVersion = "system_version"
        case appVersion = "app_version"
        case userAgent = "user_agent"
    }
}

/// 屏幕信息结构
public struct ScreenInfo: Codable {
    /// 屏幕宽度（像素）
    public let width: Int
    
    /// 屏幕高度（像素）
    public let height: Int
    
    /// 屏幕缩放比例
    public let scale: CGFloat
    
    /// 编码键
    enum CodingKeys: String, CodingKey {
        case width = "width"
        case height = "height"
        case scale = "scale"
    }
}

/// 内存信息结构
public struct MemoryInfo: Codable {
    /// 总内存（MB）
    public let totalMemory: Int
    
    /// 已使用内存（MB）
    public let usedMemory: Int
    
    /// 编码键
    enum CodingKeys: String, CodingKey {
        case totalMemory = "total_memory"
        case usedMemory = "used_memory"
    }
}

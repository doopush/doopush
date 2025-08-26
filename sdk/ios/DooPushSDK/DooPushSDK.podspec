Pod::Spec.new do |spec|
  spec.name         = "DooPushSDK"
  spec.version      = "1.0.0"
  spec.summary      = "DooPush iOS SDK - 简单易用的推送通知解决方案"
  spec.description  = <<-DESC
                      DooPush iOS SDK 提供简单易用的推送通知解决方案，支持：
                      
                      • iOS APNs 推送通知
                      • 设备自动注册和管理
                      • 灵活的服务器配置（支持本地开发环境）
                      • Swift 和 Objective-C 双语言支持
                      • 完整的错误处理和日志系统
                      • 本地数据存储和管理
                      
                      适用于需要推送通知功能的iOS应用。
                      DESC

  spec.homepage     = "https://github.com/doopush/ios-sdk"
  spec.license      = { :type => "MIT", :file => "DooPushSDK/LICENSE" }
  spec.author       = { "DooPush Team" => "support@doopush.com" }

  # 平台和版本要求
  spec.ios.deployment_target = "12.0"
  spec.swift_version = "5.9"
  
  # 源码位置
  # spec.source = { :git => "https://github.com/doopush/ios-sdk.git", :tag => "#{spec.version}" }
  # 目前使用本地路径进行开发
  spec.source = { :path => "." }

  # 源文件
  spec.source_files = "Sources/DooPushSDK/**/*.{swift}"
  
  # 公共头文件
  spec.public_header_files = "Sources/DooPushSDK/include/**/*.h"
  
  # 资源文件
  spec.resources = ["README.md"]
  
  # 模块映射
  spec.module_map = "Sources/DooPushSDK/include/module.modulemap"
  
  # 系统框架依赖
  spec.frameworks = "Foundation", "UIKit", "UserNotifications"
  
  # 编译器设置
  spec.requires_arc = true
  spec.pod_target_xcconfig = {
    'SWIFT_VERSION' => '5.9',
    'IPHONEOS_DEPLOYMENT_TARGET' => '12.0'
  }
  
  # 子模块（如果需要的话）
  # spec.subspec 'Core' do |core|
  #   core.source_files = 'DooPushSDK/Sources/DooPushSDK/**/*.swift'
  # end
  
  # 测试规范
  spec.test_spec 'Tests' do |test_spec|
    test_spec.source_files = 'Tests/**/*.swift'
    test_spec.frameworks = 'XCTest'
    test_spec.requires_app_host = true
  end
end

import XCTest
@testable import DooPushSDK

/// DooPush SDK 单元测试
final class DooPushSDKTests: XCTestCase {
    
    var manager: DooPushManager!
    
    override func setUpWithError() throws {
        super.setUp()
        manager = DooPushManager.shared
    }
    
    override func tearDownWithError() throws {
        // 清理测试数据
        DooPushStorage().clearAllData()
        super.tearDown()
    }
    
    // MARK: - 配置测试
    
    func testSDKConfiguration() throws {
        let appId = "test_app_id"
        let apiKey = "test_api_key"
        let baseURL = "https://test.doopush.com/api/v1"
        
        manager.configure(appId: appId, apiKey: apiKey, baseURL: baseURL)
        
        let storage = DooPushStorage()
        let config = storage.getConfig()
        
        XCTAssertNotNil(config)
        XCTAssertEqual(config?.appId, appId)
        XCTAssertEqual(config?.apiKey, apiKey)
        XCTAssertEqual(config?.baseURL, baseURL)
    }
    
    func testConfigurationWithDefaultURL() throws {
        let appId = "test_app_id"
        let apiKey = "test_api_key"
        
        manager.configure(appId: appId, apiKey: apiKey)
        
        let storage = DooPushStorage()
        let config = storage.getConfig()
        
        XCTAssertNotNil(config)
        XCTAssertEqual(config?.baseURL, "https://doopush.com/api/v1")
    }
    
    // MARK: - 设备信息测试
    
    func testDeviceInfoGeneration() throws {
        let deviceManager = DooPushDevice()
        let deviceInfo = deviceManager.getCurrentDeviceInfo()
        
        XCTAssertEqual(deviceInfo.platform, "ios")
        XCTAssertEqual(deviceInfo.channel, "apns")
        XCTAssertEqual(deviceInfo.brand, "Apple")
        XCTAssertFalse(deviceInfo.model.isEmpty)
        XCTAssertFalse(deviceInfo.systemVersion.isEmpty)
        XCTAssertFalse(deviceInfo.appVersion.isEmpty)
        XCTAssertFalse(deviceInfo.userAgent.isEmpty)
    }
    
    func testDeviceIdentifier() throws {
        let deviceManager = DooPushDevice()
        let identifier = deviceManager.getDeviceIdentifier()
        
        XCTAssertFalse(identifier.isEmpty)
        XCTAssertNotEqual(identifier, "00000000-0000-0000-0000-000000000000")
    }
    
    // MARK: - 存储测试
    
    func testStorageOperations() throws {
        let storage = DooPushStorage()
        
        // 测试设备token存储
        let testToken = "test_device_token"
        storage.saveDeviceToken(testToken)
        XCTAssertEqual(storage.getDeviceToken(), testToken)
        
        // 测试设备ID存储
        let testDeviceId = "test_device_id"
        storage.saveDeviceId(testDeviceId)
        XCTAssertEqual(storage.getDeviceId(), testDeviceId)
        
        // 测试推送权限状态
        storage.setPushPermissionGranted(true)
        XCTAssertTrue(storage.isPushPermissionGranted())
        
        storage.setPushPermissionGranted(false)
        XCTAssertFalse(storage.isPushPermissionGranted())
        
        // 测试安装ID
        let installationId = storage.getInstallationId()
        XCTAssertFalse(installationId.isEmpty)
        
        // 多次获取应该返回相同的ID
        let installationId2 = storage.getInstallationId()
        XCTAssertEqual(installationId, installationId2)
    }
    
    func testStorageCleanup() throws {
        let storage = DooPushStorage()
        
        // 先保存一些数据
        storage.saveDeviceToken("test_token")
        storage.saveDeviceId("test_device_id")
        storage.setPushPermissionGranted(true)
        
        // 清理设备数据
        storage.clearDeviceData()
        
        XCTAssertNil(storage.getDeviceToken())
        XCTAssertNil(storage.getDeviceId())
        XCTAssertFalse(storage.isPushPermissionGranted())
        
        // 安装ID应该还在
        XCTAssertFalse(storage.getInstallationId().isEmpty)
    }
    
    // MARK: - 配置测试
    
    func testConfigValidation() throws {
        let validConfig = DooPushConfig(
            appId: "test_app",
            apiKey: "test_key",
            baseURL: "https://test.com"
        )
        XCTAssertTrue(validConfig.isValid)
        
        let invalidConfig = DooPushConfig(
            appId: "",
            apiKey: "test_key",
            baseURL: "https://test.com"
        )
        XCTAssertFalse(invalidConfig.isValid)
    }
    
    func testConfigURLGeneration() throws {
        let config = DooPushConfig(
            appId: "123",
            apiKey: "test_key",
            baseURL: "https://api.doopush.com/v1"
        )
        
        let deviceURL = config.deviceRegistrationURL()
        XCTAssertEqual(deviceURL, "https://api.doopush.com/v1/apps/123/devices")
        
        let customURL = config.apiURL(for: "custom/endpoint")
        XCTAssertEqual(customURL, "https://api.doopush.com/v1/custom/endpoint")
    }
    
    // MARK: - 环境检测测试
    
    func testEnvironmentDetection() throws {
        let prodConfig = DooPushConfig(
            appId: "test",
            apiKey: "key",
            baseURL: "https://doopush.com/api/v1"
        )
        XCTAssertEqual(prodConfig.environment, .production)
        
        let devConfig = DooPushConfig(
            appId: "test",
            apiKey: "key",
            baseURL: "http://localhost:5002/api/v1"
        )
        XCTAssertEqual(devConfig.environment, .development)
        
        let customConfig = DooPushConfig(
            appId: "test",
            apiKey: "key",
            baseURL: "https://custom.example.com/api"
        )
        if case .custom(let url) = customConfig.environment {
            XCTAssertEqual(url, "https://custom.example.com/api")
        } else {
            XCTFail("应该是自定义环境")
        }
    }
    
    // MARK: - 推送通知数据解析测试
    
    func testNotificationDataParsing() throws {
        // 测试标准APNs格式
        let apnsUserInfo: [AnyHashable: Any] = [
            "aps": [
                "alert": [
                    "title": "测试标题",
                    "body": "测试内容"
                ],
                "badge": 5,
                "sound": "default"
            ],
            "push_id": "12345",
            "custom_data": "test_value"
        ]
        
        let notificationData = DooPushNotificationParser.parse(apnsUserInfo)
        
        XCTAssertEqual(notificationData.title, "测试标题")
        XCTAssertEqual(notificationData.content, "测试内容")
        XCTAssertEqual(notificationData.badge, 5)
        XCTAssertEqual(notificationData.sound, "default")
        XCTAssertEqual(notificationData.pushId, "12345")
        XCTAssertTrue(notificationData.hasCustomPayload)
        XCTAssertEqual(notificationData.customValue(for: "custom_data") as? String, "test_value")
        
        // 测试简单格式
        let simpleUserInfo: [AnyHashable: Any] = [
            "title": "简单标题",
            "body": "简单内容",
            "id": "67890"
        ]
        
        let simpleData = DooPushNotificationParser.parse(simpleUserInfo)
        XCTAssertEqual(simpleData.title, "简单标题")
        XCTAssertEqual(simpleData.content, "简单内容")
        XCTAssertEqual(simpleData.pushId, "67890")
    }
    
    // MARK: - 错误处理测试
    
    func testErrorHandling() throws {
        // 测试错误分类
        let networkError = DooPushError.networkError
        XCTAssertTrue(networkError.isNetworkError)
        XCTAssertFalse(networkError.isConfigurationError)
        
        let configError = DooPushError.notConfigured
        XCTAssertTrue(configError.isConfigurationError)
        XCTAssertFalse(configError.isNetworkError)
        
        // 测试错误消息
        XCTAssertFalse(networkError.errorDescription!.isEmpty)
        XCTAssertFalse(configError.errorDescription!.isEmpty)
        
        // 测试用户友好消息
        let userMessage = DooPushErrorHandler.userFriendlyMessage(for: networkError)
        XCTAssertFalse(userMessage.isEmpty)
        
        // 测试重试逻辑
        XCTAssertTrue(DooPushErrorHandler.isRetryable(networkError))
        XCTAssertFalse(DooPushErrorHandler.isRetryable(configError))
    }
    
    // MARK: - 日志测试
    
    func testLogging() throws {
        var logMessages: [(DooPushLogger.LogLevel, String, String)] = []
        
        DooPushLogger.setLogCallback { level, message, location in
            logMessages.append((level, message, location))
        }
        
        DooPushLogger.configureLogLevel(.debug)
        
        DooPushLogger.debug("测试调试消息")
        DooPushLogger.info("测试信息消息")
        DooPushLogger.warning("测试警告消息")
        DooPushLogger.error("测试错误消息")
        
        XCTAssertEqual(logMessages.count, 4)
        XCTAssertEqual(logMessages[0].0, .debug)
        XCTAssertEqual(logMessages[1].0, .info)
        XCTAssertEqual(logMessages[2].0, .warning)
        XCTAssertEqual(logMessages[3].0, .error)
        
        // 测试日志级别过滤
        logMessages.removeAll()
        DooPushLogger.configureLogLevel(.warning)
        
        DooPushLogger.debug("不应该显示")
        DooPushLogger.info("不应该显示")
        DooPushLogger.warning("应该显示")
        DooPushLogger.error("应该显示")
        
        XCTAssertEqual(logMessages.count, 2)
    }
    
    // MARK: - 性能测试
    
    func testPerformance() throws {
        measure {
            // 测试设备信息生成性能
            let deviceManager = DooPushDevice()
            for _ in 0..<100 {
                _ = deviceManager.getCurrentDeviceInfo()
            }
        }
    }
    
    // MARK: - SDK版本测试
    
    func testSDKVersion() throws {
        let version = DooPushManager.sdkVersion
        XCTAssertFalse(version.isEmpty)
        XCTAssertTrue(version.contains("."))
    }
}

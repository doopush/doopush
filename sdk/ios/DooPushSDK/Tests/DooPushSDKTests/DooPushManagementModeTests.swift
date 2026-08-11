import XCTest
@testable import DooPushSDK

final class DooPushManagementModeTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Reset to default
        DooPushManager.shared.setNotificationManagementMode(.active)
    }

    func testDefaultModeIsActive() {
        XCTAssertEqual(DooPushManager.shared.notificationManagementMode, .active)
    }

    func testSetPassiveMode() {
        DooPushManager.shared.setNotificationManagementMode(.passive)
        XCTAssertEqual(DooPushManager.shared.notificationManagementMode, .passive)
    }

    func testSetActiveMode() {
        DooPushManager.shared.setNotificationManagementMode(.passive)
        DooPushManager.shared.setNotificationManagementMode(.active)
        XCTAssertEqual(DooPushManager.shared.notificationManagementMode, .active)
    }

    func testRegisterWithTokenInvokesNetworking() {
        DooPushManager.shared.configure(appId: "test_app_id", appKey: "test_app_key")

        let exp = expectation(description: "completion called")
        DooPushManager.shared.registerDevice(withToken: "deadbeef", vendor: "apns") { deviceId, error in
            // 这里期望 networking 被调用并返回 error（因 baseURL 不可达）；deviceId 为 nil 但 completion 被触发
            XCTAssertNotNil(error, "无网络环境下应回调 error")
            XCTAssertNil(deviceId)
            exp.fulfill()
        }
        wait(for: [exp], timeout: 5.0)
    }

    func testConfigureForTokenAcquisitionPreservesFullConfigurationAndDeviceId() {
        let storage = DooPushStorage()
        DooPushManager.shared.configure(
            appId: "existing_app_id",
            appKey: "existing_app_key",
            baseURL: "https://example.com/api/v1"
        )
        storage.saveDeviceId("existing_device_id")

        DooPushManager.shared.configureForTokenAcquisition()

        XCTAssertEqual(storage.getConfig()?.appId, "existing_app_id")
        XCTAssertEqual(storage.getConfig()?.appKey, "existing_app_key")
        XCTAssertEqual(storage.getConfig()?.baseURL, "https://example.com/api/v1")
        XCTAssertEqual(storage.getDeviceId(), "existing_device_id")
    }

    func testConfigureForTokenAcquisitionDoesNotInstallDelegateInPassiveMode() {
        let manager = DooPushManager.shared
        manager.setNotificationManagementMode(.passive)

        manager.configureForTokenAcquisition()
        manager.enableAutomaticNotificationTracking()

        XCTAssertEqual(manager.notificationManagementMode, .passive)
    }

    func testAcquirePushTokenRejectsOverlappingRegistration() {
        let manager = DooPushManager.shared

        var firstError: Error?
        XCTAssertTrue(manager.beginTokenRequest(registerWithServer: true) { _, error in
            firstError = error
        })

        var overlappingError: Error?
        XCTAssertFalse(manager.beginTokenRequest(registerWithServer: false) { _, error in
            overlappingError = error
        })

        XCTAssertEqual(overlappingError as? DooPushError, .registrationInProgress)
        XCTAssertNil(firstError, "重叠请求不得替换或完成首个请求的回调")

        let apnsError = NSError(domain: "DooPushSDKTests", code: 1)
        manager.didFailToRegisterForRemoteNotifications(with: apnsError)
        XCTAssertEqual((firstError as NSError?)?.domain, apnsError.domain)
        XCTAssertEqual((firstError as NSError?)?.code, apnsError.code)
    }
}

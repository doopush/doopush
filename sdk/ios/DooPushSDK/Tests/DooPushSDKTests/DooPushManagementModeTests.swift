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
        DooPushManager.shared.configure(appId: "test_app_id", apiKey: "test_api_key")

        let exp = expectation(description: "completion called")
        DooPushManager.shared.registerDevice(withToken: "deadbeef", vendor: "apns") { deviceId, error in
            // 这里期望 networking 被调用并返回 error（因 baseURL 不可达）；deviceId 为 nil 但 completion 被触发
            XCTAssertNotNil(error, "无网络环境下应回调 error")
            XCTAssertNil(deviceId)
            exp.fulfill()
        }
        wait(for: [exp], timeout: 5.0)
    }
}

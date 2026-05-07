import XCTest
import UserNotifications
@testable import DooPushSDK

/// 验证 DooPushNotificationProxy 在被第三方替换 delegate 后能自动重装
final class DooPushNotificationProxyTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // 重置环境
        UNUserNotificationCenter.current().delegate = nil
        DooPushManager.shared.disableAutomaticNotificationTracking()
    }

    override func tearDown() {
        UNUserNotificationCenter.current().delegate = nil
        DooPushManager.shared.disableAutomaticNotificationTracking()
        super.tearDown()
    }

    func testProxyReinstallsAfterThirdPartyTakesDelegate() {
        // 1) DooPush 安装代理
        DooPushManager.shared.enableAutomaticNotificationTracking()
        XCTAssertTrue(UNUserNotificationCenter.current().delegate is DooPushNotificationProxy,
                      "DooPush 代理应该被安装")

        // 2) 第三方（模拟 expo-notifications）替换 delegate
        let foreign = ForeignDelegate()
        UNUserNotificationCenter.current().delegate = foreign

        // 3) 等待 KVO 触发（runloop 一拍）
        let exp = expectation(description: "KVO reinstall")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { exp.fulfill() }
        wait(for: [exp], timeout: 1.0)

        // 4) DooPush 代理应该重新装回顶层，并把 foreign 链接为 original
        XCTAssertTrue(UNUserNotificationCenter.current().delegate is DooPushNotificationProxy,
                      "DooPush 代理应在第三方接管后重新装回")
        let proxy = UNUserNotificationCenter.current().delegate as? DooPushNotificationProxy
        XCTAssertTrue(proxy?.original === foreign,
                      "原 delegate 应该是 foreign")
    }

    private final class ForeignDelegate: NSObject, UNUserNotificationCenterDelegate {}
}

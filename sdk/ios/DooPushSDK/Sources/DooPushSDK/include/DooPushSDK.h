//
//  DooPushSDK.h
//  DooPushSDK
//
//  Created by DooPush Team on 2024.
//  Copyright © 2024 DooPush. All rights reserved.
//

#import <Foundation/Foundation.h>

//! Project version number for DooPushSDK.
FOUNDATION_EXPORT double DooPushSDKVersionNumber;

//! Project version string for DooPushSDK.
FOUNDATION_EXPORT const unsigned char DooPushSDKVersionString[];

// Import public headers for Objective-C compatibility
// Main classes are available through Swift module imports

// When importing in Objective-C:
// @import DooPushSDK;
// or
// #import <DooPushSDK/DooPushSDK-Swift.h>

/**
 * DooPush iOS SDK
 * 
 * 提供简单易用的推送通知解决方案，支持iOS APNs推送。
 * 
 * 主要功能：
 * - 设备注册和管理
 * - 推送通知处理
 * - 配置管理
 * - 角标管理
 * - 错误处理和日志
 * 
 * 使用方法：
 * 
 * Swift:
 * ```swift
 * import DooPushSDK
 * 
 * DooPushManager.shared.configure(
 *     appId: "your_app_id",
 *     apiKey: "your_api_key",
 *     baseURL: "https://doopush.com/api/v1"
 * )
 * 
 * DooPushManager.shared.registerForPushNotifications { token, error in
 *     // 处理结果
 * }
 * 
 * // 角标管理
 * DooPushManager.shared.setBadgeNumber(5)        // 设置角标为5
 * DooPushManager.shared.clearBadge()             // 清除角标
 * DooPushManager.shared.incrementBadgeNumber()   // 角标+1
 * DooPushManager.shared.decrementBadgeNumber()   // 角标-1
 * let currentBadge = DooPushManager.shared.getCurrentBadgeNumber() // 获取当前角标
 * ```
 * 
 * Objective-C:
 * ```objc
 * @import DooPushSDK;
 * 
 * [[DooPushManager sharedInstance] configureWithAppId:@"your_app_id"
 *                                               apiKey:@"your_api_key"
 *                                              baseURL:@"https://doopush.com/api/v1"];
 * 
 * [[DooPushManager sharedInstance] registerForPushNotificationsWithCompletion:^(NSString *token, NSError *error) {
 *     // 处理结果
 * }];
 * 
 * // 角标管理
 * [[DooPushManager sharedInstance] setBadgeNumber:5];          // 设置角标为5
 * [[DooPushManager sharedInstance] clearBadge];                // 清除角标
 * [[DooPushManager sharedInstance] incrementBadgeNumberBy:1];  // 角标+1
 * [[DooPushManager sharedInstance] decrementBadgeNumberBy:1];  // 角标-1
 * NSInteger currentBadge = [[DooPushManager sharedInstance] getCurrentBadgeNumber]; // 获取当前角标
 * ```
 */

//
//  PushNotificationManager.h
//  DooPushSDKExample-ObjC
//
//  推送通知管理器 - 实现DooPushDelegate
//

#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>
@import DooPushSDK;

NS_ASSUME_NONNULL_BEGIN

// 状态更新通知
extern NSString * const DooPushStatusUpdateNotification;

/**
 * SDK状态枚举
 */
typedef NS_ENUM(NSInteger, SDKStatus) {
    SDKStatusNotConfigured,
    SDKStatusConfigured,
    SDKStatusRegistering,
    SDKStatusRegistered,
    SDKStatusFailed
};

/**
 * 通知信息模型
 */
@interface NotificationInfo : NSObject

@property (nonatomic, strong, readonly) NSString *identifier;
@property (nonatomic, strong, nullable) NSString *title;
@property (nonatomic, strong, nullable) NSString *content;
@property (nonatomic, strong, nullable) NSDictionary *payload;
@property (nonatomic, strong, nullable) NSString *dedupKey;
@property (nonatomic, strong) NSDate *receivedAt;

@end

/**
 * 推送通知管理器 - 实现DooPushDelegate
 */
@interface PushNotificationManager : NSObject <DooPushDelegate>

/// SDK状态
@property (nonatomic, assign) SDKStatus sdkStatus;

/// 推送权限状态
@property (nonatomic, assign) UNAuthorizationStatus pushPermissionStatus;

/// 设备Token
@property (nonatomic, strong, nullable) NSString *deviceToken;

/// 设备ID
@property (nonatomic, strong, nullable) NSString *deviceId;

/// 最后的错误信息
@property (nonatomic, strong, nullable) NSString *lastError;

/// 通知历史列表
@property (nonatomic, strong) NSMutableArray<NotificationInfo *> *notifications;

/// 是否正在加载
@property (nonatomic, assign) BOOL isLoading;

/// 是否正在更新设备
@property (nonatomic, assign) BOOL isUpdatingDevice;

/// 更新消息
@property (nonatomic, strong, nullable) NSString *updateMessage;

/// 状态变更回调
@property (nonatomic, copy, nullable) void(^statusUpdateCallback)(void);

/// 单例实例
@property (nonatomic, strong, readonly, class) PushNotificationManager *shared;

/// SDK配置完成后检查是否需要自动注册
- (void)checkAutoRegister;

/// 注册推送通知
- (void)registerForPushNotifications;

/// 更新设备信息
- (void)updateDeviceInfo;

/// 检查权限状态
- (void)checkPermissionStatus;

/// 清除通知历史
- (void)clearNotifications;

/// 手动上报统计数据
- (void)reportStatistics;

/// 获取SDK状态显示文本
- (NSString *)displayTextForSDKStatus:(SDKStatus)status;

/// 获取SDK状态颜色 (返回颜色名称字符串)
- (NSString *)colorNameForSDKStatus:(SDKStatus)status;

/// 获取权限状态显示文本
- (NSString *)displayTextForAuthorizationStatus:(UNAuthorizationStatus)status;

/// 获取权限状态颜色 (返回颜色名称字符串)
- (NSString *)colorNameForAuthorizationStatus:(UNAuthorizationStatus)status;

@end

NS_ASSUME_NONNULL_END

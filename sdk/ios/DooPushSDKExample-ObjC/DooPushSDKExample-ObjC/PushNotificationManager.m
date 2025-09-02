//
//  PushNotificationManager.m
//  DooPushSDKExample-ObjC
//
//  推送通知管理器 - 实现DooPushDelegate
//

#import "PushNotificationManager.h"
#import "Logger.h"
@import DooPushSDK;

// 状态更新通知常量
NSString * const DooPushStatusUpdateNotification = @"DooPushStatusUpdateNotification";

#pragma mark - NotificationInfo Implementation

@implementation NotificationInfo

- (instancetype)init {
    self = [super init];
    if (self) {
        _identifier = [[NSUUID UUID] UUIDString];
        _receivedAt = [NSDate date];
    }
    return self;
}

- (BOOL)isEqual:(id)object {
    if (![object isKindOfClass:[NotificationInfo class]]) {
        return NO;
    }
    NotificationInfo *other = (NotificationInfo *)object;
    return [self.identifier isEqualToString:other.identifier];
}

- (NSUInteger)hash {
    return [self.identifier hash];
}

@end

#pragma mark - PushNotificationManager Implementation

@interface PushNotificationManager ()

@property (nonatomic, strong) NSTimer *updateTimeoutTimer;

@end

@implementation PushNotificationManager

static PushNotificationManager *_shared = nil;

+ (PushNotificationManager *)shared {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        _shared = [[PushNotificationManager alloc] init];
    });
    return _shared;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _notifications = [[NSMutableArray alloc] init];
        _sdkStatus = SDKStatusNotConfigured;
        _pushPermissionStatus = UNAuthorizationStatusNotDetermined;
        _isLoading = NO;
        _isUpdatingDevice = NO;
        
        [self checkPermissionStatus];
        [self updateSDKStatus];
    }
    return self;
}

#pragma mark - Public Methods

- (void)checkAutoRegister {
    // 检查是否之前已经注册过
    NSString *localToken = [DooPushManager.shared getDeviceToken];
    if (localToken && localToken.length > 0) {
        // 如果有本地token，自动重新注册以恢复连接
        [self registerForPushNotifications];
    }
}

- (void)registerForPushNotifications {
    self.isLoading = YES;
    self.sdkStatus = SDKStatusRegistering;
    self.lastError = nil;
    [self notifyStatusUpdate];
    
    __weak typeof(self) weakSelf = self;
    [DooPushManager.shared registerForPushNotificationsWithCompletion:^(NSString * _Nullable token, NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            weakSelf.isLoading = NO;
            
            if (error) {
                [weakSelf handleRegistrationError:error];
            } else if (token) {
                [weakSelf handleRegistrationSuccess:token];
            }
        });
    }];
}

- (void)updateDeviceInfo {
    self.isUpdatingDevice = YES;
    self.updateMessage = @"⏳ 正在更新设备信息...";
    [self notifyStatusUpdate];
    
    [DooPushManager.shared updateDeviceInfo];
    
    // 设置超时
    __weak typeof(self) weakSelf = self;
    self.updateTimeoutTimer = [NSTimer scheduledTimerWithTimeInterval:10.0 repeats:NO block:^(NSTimer * _Nonnull timer) {
        if (weakSelf.isUpdatingDevice) {
            weakSelf.isUpdatingDevice = NO;
            weakSelf.updateMessage = nil;
            weakSelf.lastError = @"更新超时";
            [weakSelf notifyStatusUpdate];
        }
    }];
}

- (void)checkPermissionStatus {
    __weak typeof(self) weakSelf = self;
    [DooPushManager.shared checkPushPermissionStatusWithCompletion:^(UNAuthorizationStatus status) {
        dispatch_async(dispatch_get_main_queue(), ^{
            weakSelf.pushPermissionStatus = status;
            [weakSelf updateSDKStatus];
            [weakSelf notifyStatusUpdate];
        });
    }];
}

- (void)clearNotifications {
    [self.notifications removeAllObjects];
    [self notifyStatusUpdate];
}

- (void)reportStatistics {
    [DooPushManager.shared reportStatistics];
    [Logger info:@"📊 手动触发统计数据上报"];
}

#pragma mark - Private Methods

- (void)updateSDKStatus {
    self.deviceToken = [DooPushManager.shared getDeviceToken];
    self.deviceId = [DooPushManager.shared getDeviceId];
    
    if (self.deviceToken && self.deviceToken.length > 0) {
        self.sdkStatus = SDKStatusRegistered;
    } else {
        self.sdkStatus = SDKStatusConfigured;
    }
}

- (void)handleRegistrationSuccess:(NSString *)token {
    self.deviceToken = token;
    self.deviceId = [DooPushManager.shared getDeviceId];
    self.sdkStatus = SDKStatusRegistered;
    self.lastError = nil;
    [self checkPermissionStatus];
    [self notifyStatusUpdate];
}

- (void)handleRegistrationError:(NSError *)error {
    self.sdkStatus = SDKStatusFailed;
    self.lastError = [self userFriendlyMessageForError:error];
    [self checkPermissionStatus];
    [self notifyStatusUpdate];
}

- (void)notifyStatusUpdate {
    // 发送通知给所有监听者
    [[NSNotificationCenter defaultCenter] postNotificationName:DooPushStatusUpdateNotification 
                                                        object:self 
                                                      userInfo:nil];
    
    // 保持向后兼容性
    if (self.statusUpdateCallback) {
        self.statusUpdateCallback();
    }
}

- (NSString *)userFriendlyMessageForError:(NSError *)error {
    // 根据错误类型提供用户友好的消息
    if ([error.domain isEqualToString:NSURLErrorDomain]) {
        switch (error.code) {
            case NSURLErrorNotConnectedToInternet:
            case NSURLErrorNetworkConnectionLost:
                return @"网络连接失败，请检查网络设置";
            case NSURLErrorTimedOut:
                return @"操作超时，请重试";
            case NSURLErrorCancelled:
                return @"操作已取消";
            default:
                return @"网络请求失败，请重试";
        }
    } else if (error.code == 1100) { // DooPushError.pushPermissionDenied
        return @"请在设置中开启推送通知权限";
    } else if (error.code == 1000) { // DooPushError.notConfigured
        return @"SDK未正确配置，请联系开发者";
    } else if (error.code == 1401) { // DooPushError.unauthorized
        return @"应用认证失败，请重新启动应用";
    } else if (error.code == 1500) { // DooPushError.serverError
        return @"服务暂时不可用，请稍后重试";
    }
    
    return error.localizedDescription ?: @"操作失败，请重试";
}

- (NSDictionary *)parseNotificationUserInfo:(NSDictionary *)userInfo {
    NSMutableDictionary *result = [[NSMutableDictionary alloc] init];
    
    // 解析 APNs 格式数据
    NSDictionary *aps = userInfo[@"aps"];
    if (aps) {
        id alert = aps[@"alert"];
        if ([alert isKindOfClass:[NSDictionary class]]) {
            NSDictionary *alertDict = (NSDictionary *)alert;
            result[@"title"] = alertDict[@"title"];
            result[@"content"] = alertDict[@"body"];
        } else if ([alert isKindOfClass:[NSString class]]) {
            result[@"content"] = (NSString *)alert;
        }
    } else {
        // 兼容其他格式
        result[@"title"] = userInfo[@"title"];
        result[@"content"] = userInfo[@"content"] ?: userInfo[@"body"];
    }
    
    // 解析自定义数据
    NSMutableDictionary *customPayload = [[NSMutableDictionary alloc] init];
    for (NSString *key in userInfo.allKeys) {
        if (![key isEqualToString:@"aps"]) {
            customPayload[key] = userInfo[key];
        }
    }
    
    if (customPayload.count > 0) {
        result[@"payload"] = [customPayload copy];
    }
    
    return [result copy];
}

#pragma mark - DooPushDelegate

- (void)dooPush:(DooPushManager *)manager didRegisterWithToken:(NSString *)token {
    dispatch_async(dispatch_get_main_queue(), ^{
        [Logger info:[NSString stringWithFormat:@"🎯 设备注册成功: %@", token]];
        [self handleRegistrationSuccess:token];
    });
}

- (void)dooPush:(DooPushManager *)manager didReceiveNotification:(NSDictionary *)userInfo {
    dispatch_async(dispatch_get_main_queue(), ^{
        [Logger info:[NSString stringWithFormat:@"📱 收到推送通知: %@", userInfo]];
        
        NotificationInfo *notification = [[NotificationInfo alloc] init];
        
        // 解析推送通知数据
        NSDictionary *parsedData = [self parseNotificationUserInfo:userInfo];
        notification.title = parsedData[@"title"];
        notification.content = parsedData[@"content"];
        notification.payload = parsedData[@"payload"];
        
        // 插入到列表开头
        [self.notifications insertObject:notification atIndex:0];
        
        // 限制通知历史数量
        if (self.notifications.count > 50) {
            [self.notifications removeLastObject];
        }
        
        [self notifyStatusUpdate];
    });
}

- (void)dooPush:(DooPushManager *)manager didFailWithError:(NSError *)error {
    dispatch_async(dispatch_get_main_queue(), ^{
        [Logger error:[NSString stringWithFormat:@"❌ 发生错误: %@", error]];
        
        // 如果正在更新设备信息时出错
        if (self.isUpdatingDevice) {
            [self.updateTimeoutTimer invalidate];
            self.updateTimeoutTimer = nil;
            self.isUpdatingDevice = NO;
            self.updateMessage = nil;
            self.lastError = [NSString stringWithFormat:@"设备信息更新失败: %@", [self userFriendlyMessageForError:error]];
        } else {
            [self handleRegistrationError:error];
        }
        
        [self notifyStatusUpdate];
    });
}

#pragma mark - Optional Delegate Methods

- (void)dooPushDidUpdateDeviceInfo:(DooPushManager *)manager {
    dispatch_async(dispatch_get_main_queue(), ^{
        [Logger info:@"✅ 设备信息更新成功"];
        
        [self.updateTimeoutTimer invalidate];
        self.updateTimeoutTimer = nil;
        
        self.isUpdatingDevice = NO;
        self.updateMessage = @"✅ 设备信息更新成功";
        [self notifyStatusUpdate];
        
        // 3秒后清除更新消息
        __weak typeof(self) weakSelf = self;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            weakSelf.updateMessage = nil;
            [weakSelf notifyStatusUpdate];
        });
    });
}

- (void)dooPush:(DooPushManager *)manager didChangePermissionStatus:(NSInteger)status {
    dispatch_async(dispatch_get_main_queue(), ^{
        [Logger info:[NSString stringWithFormat:@"🔔 权限状态变更: %ld", (long)status]];
        [self checkPermissionStatus];
    });
}

#pragma mark - Display Text Methods

- (NSString *)displayTextForSDKStatus:(SDKStatus)status {
    switch (status) {
        case SDKStatusNotConfigured:
            return @"未配置";
        case SDKStatusConfigured:
            return @"已配置";
        case SDKStatusRegistering:
            return @"注册中...";
        case SDKStatusRegistered:
            return @"已注册";
        case SDKStatusFailed:
            return @"注册失败";
    }
}

- (NSString *)colorNameForSDKStatus:(SDKStatus)status {
    switch (status) {
        case SDKStatusNotConfigured:
        case SDKStatusFailed:
            return @"red";
        case SDKStatusConfigured:
        case SDKStatusRegistering:
            return @"orange";
        case SDKStatusRegistered:
            return @"green";
    }
}

- (NSString *)displayTextForAuthorizationStatus:(UNAuthorizationStatus)status {
    switch (status) {
        case UNAuthorizationStatusNotDetermined:
            return @"未确定";
        case UNAuthorizationStatusDenied:
            return @"已拒绝";
        case UNAuthorizationStatusAuthorized:
            return @"已授权";
        case UNAuthorizationStatusProvisional:
            return @"临时授权";
        case UNAuthorizationStatusEphemeral:
            return @"短期授权";
        default:
            return @"未知";
    }
}

- (NSString *)colorNameForAuthorizationStatus:(UNAuthorizationStatus)status {
    switch (status) {
        case UNAuthorizationStatusDenied:
            return @"red";
        case UNAuthorizationStatusNotDetermined:
        case UNAuthorizationStatusProvisional:
        case UNAuthorizationStatusEphemeral:
            return @"orange";
        case UNAuthorizationStatusAuthorized:
            return @"green";
        default:
            return @"gray";
    }
}

- (void)dealloc {
    [self.updateTimeoutTimer invalidate];
}

@end

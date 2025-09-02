//
//  AppDelegate.m
//  DooPushSDKExample-ObjC
//
//  Created by 韦一 on 2025/9/1.
//

#import "AppDelegate.h"
#import "AppConfig.h"
#import "PushNotificationManager.h"
@import DooPushSDK;

@interface AppDelegate ()

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    // 配置推送SDK
    [self configurePushSDK];
    
    return YES;
}

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
    [DooPushManager.shared didRegisterForRemoteNotificationsWith:deviceToken];
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
    [DooPushManager.shared didFailToRegisterForRemoteNotificationsWith:error];
}

#pragma mark - Private Methods

- (void)configurePushSDK {
    [DooPushManager.shared configureWithAppId:AppConfig.appId
                                       apiKey:AppConfig.apiKey
                                      baseURL:AppConfig.baseURL];
    
    DooPushManager.shared.delegate = PushNotificationManager.shared;
    
    // 检查是否需要自动注册
    [PushNotificationManager.shared checkAutoRegister];
    
    // 使用配置文件的方法输出配置信息
    [AppConfig printConfiguration];
}


#pragma mark - UISceneSession lifecycle


- (UISceneConfiguration *)application:(UIApplication *)application configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession options:(UISceneConnectionOptions *)options {
    // Called when a new scene session is being created.
    // Use this method to select a configuration to create the new scene with.
    return [[UISceneConfiguration alloc] initWithName:@"Default Configuration" sessionRole:connectingSceneSession.role];
}


- (void)application:(UIApplication *)application didDiscardSceneSessions:(NSSet<UISceneSession *> *)sceneSessions {
    // Called when the user discards a scene session.
    // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
    // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
}


@end

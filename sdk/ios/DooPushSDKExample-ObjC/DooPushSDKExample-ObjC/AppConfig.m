//
//  AppConfig.m
//  DooPushSDKExample-ObjC
//
//  配置文件 - 统一管理应用配置参数
//

#import "AppConfig.h"
#import "Logger.h"

@implementation AppConfig

+ (NSString *)appId {
    return @"1";
}

+ (NSString *)apiKey {
    return @"dp_live_XXpwyhNOxpsXWh3sRxxhZ0KK9Wo8ArwB";
}

+ (NSString *)baseURL {
    return @"https://doopush.com/api/v1";
}

+ (NSString *)displayBaseURL {
    return [self.baseURL stringByReplacingOccurrencesOfString:@"/api/v1" withString:@""];
}

+ (void)printConfiguration {
    [Logger info:@"🔧 配置参数:"];
    [Logger info:[NSString stringWithFormat:@"   App ID: %@", self.appId]];
    [Logger info:[NSString stringWithFormat:@"   API Key: %@", self.apiKey]];
    [Logger info:[NSString stringWithFormat:@"   Base URL: %@", self.displayBaseURL]];
}

@end

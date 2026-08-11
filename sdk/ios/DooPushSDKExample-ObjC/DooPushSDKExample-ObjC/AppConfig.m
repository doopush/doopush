//
//  AppConfig.m
//  DooPushSDKExample-ObjC
//
//  配置文件 - 统一管理应用配置参数
//

#import "AppConfig.h"
#import "Logger.h"
@import Foundation;

@implementation AppConfig

// 本地配置优先级：
// 1) NSUserDefaults（可通过 Scheme Arguments 设置）
// 2) DooPushLocalConfig.plist（加入目标或放在 Documents 目录）
// 3) 代码默认值

+ (NSDictionary *)localPlist {
    static NSDictionary *cached;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSString *path = [[NSBundle mainBundle] pathForResource:@"DooPushLocalConfig" ofType:@"plist"];
        if (path) {
            cached = [NSDictionary dictionaryWithContentsOfFile:path];
        }
        if (!cached) {
            NSArray<NSString *> *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
            NSString *documents = paths.firstObject;
            if (documents) {
                NSString *candidate = [documents stringByAppendingPathComponent:@"DooPushLocalConfig.plist"];
                NSDictionary *dict = [NSDictionary dictionaryWithContentsOfFile:candidate];
                if (dict) {
                    cached = dict;
                }
            }
        }
        if (!cached) {
            cached = @{};
        }
    });
    return cached;
}

+ (NSString *)valueForKey:(NSString *)key default:(NSString *)fallback {
    NSString *ud = [[NSUserDefaults standardUserDefaults] stringForKey:key];
    if (ud.length > 0) {
        return ud;
    }
    NSString *plistVal = (NSString *)[self.localPlist objectForKey:key];
    if (plistVal.length > 0) {
        return plistVal;
    }
    return fallback ?: @"";
}

+ (NSString *)appId {
    return [self valueForKey:@"APP_ID" default:@"1"];
}

+ (NSString *)appKey {
    return [self valueForKey:@"APP_KEY" default:@"dp_ak_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"];
}

+ (NSString *)baseURL {
    return [self valueForKey:@"BASE_URL" default:@"https://doopush.com/api/v1"];
}

+ (NSString *)displayBaseURL {
    return [self.baseURL stringByReplacingOccurrencesOfString:@"/api/v1" withString:@""];
}

+ (void)printConfiguration {
    [Logger info:@"🔧 配置参数:"];
    [Logger info:[NSString stringWithFormat:@"   App ID: %@", self.appId]];
    [Logger info:[NSString stringWithFormat:@"   App Key: %@", self.appKey]];
    [Logger info:[NSString stringWithFormat:@"   Base URL: %@", self.displayBaseURL]];
}

@end

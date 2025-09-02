//
//  AppConfig.h
//  DooPushSDKExample-ObjC
//
//  配置文件 - 统一管理应用配置参数
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * DooPush SDK 配置类
 */
@interface AppConfig : NSObject

/// 应用ID
@property (nonatomic, readonly, class) NSString *appId;

/// API密钥
@property (nonatomic, readonly, class) NSString *apiKey;

/// 服务器基础URL
@property (nonatomic, readonly, class) NSString *baseURL;

/// 获取不带API版本的服务器地址（用于UI显示）
@property (nonatomic, readonly, class) NSString *displayBaseURL;

/// 输出配置信息到控制台
+ (void)printConfiguration;

@end

NS_ASSUME_NONNULL_END

//
//  Logger.h
//  DooPushSDKExample-ObjC
//
//  简化的日志管理类
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * 日志级别枚举
 */
typedef NS_ENUM(NSInteger, LogLevel) {
    LogLevelVerbose = 0,
    LogLevelDebug = 1,
    LogLevelInfo = 2,
    LogLevelWarning = 3,
    LogLevelError = 4,
    LogLevelNone = 5
};

/**
 * 简化的日志管理类
 */
@interface Logger : NSObject

/// 当前日志级别
@property (nonatomic, assign, class) LogLevel logLevel;

/// 单例实例
@property (nonatomic, strong, readonly, class) Logger *shared;

/// 详细日志
+ (void)verbose:(NSString *)message;

/// 调试日志
+ (void)debug:(NSString *)message;

/// 信息日志
+ (void)info:(NSString *)message;

/// 警告日志
+ (void)warning:(NSString *)message;

/// 错误日志
+ (void)error:(NSString *)message;

/// 错误日志（带Error对象）
+ (void)errorWithError:(NSError *)error message:(nullable NSString *)message;

@end

NS_ASSUME_NONNULL_END

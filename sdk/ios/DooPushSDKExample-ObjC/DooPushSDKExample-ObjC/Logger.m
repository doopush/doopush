//
//  Logger.m
//  DooPushSDKExample-ObjC
//
//  简化的日志管理类
//

#import "Logger.h"

@interface Logger ()

@property (nonatomic, strong) NSDateFormatter *dateFormatter;

@end

@implementation Logger

static LogLevel _logLevel = LogLevelInfo;
static Logger *_shared = nil;

+ (LogLevel)logLevel {
    return _logLevel;
}

+ (void)setLogLevel:(LogLevel)logLevel {
    _logLevel = logLevel;
}

+ (Logger *)shared {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        _shared = [[Logger alloc] init];
    });
    return _shared;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _dateFormatter = [[NSDateFormatter alloc] init];
        _dateFormatter.dateFormat = @"yyyy-MM-dd HH:mm:ss.SSS";
    }
    return self;
}

#pragma mark - Public Methods

+ (void)verbose:(NSString *)message {
    [[self shared] logWithLevel:LogLevelVerbose message:message];
}

+ (void)debug:(NSString *)message {
    [[self shared] logWithLevel:LogLevelDebug message:message];
}

+ (void)info:(NSString *)message {
    [[self shared] logWithLevel:LogLevelInfo message:message];
}

+ (void)warning:(NSString *)message {
    [[self shared] logWithLevel:LogLevelWarning message:message];
}

+ (void)error:(NSString *)message {
    [[self shared] logWithLevel:LogLevelError message:message];
}

+ (void)errorWithError:(NSError *)error message:(nullable NSString *)message {
    NSString *errorMessage;
    if (message) {
        errorMessage = [NSString stringWithFormat:@"%@: %@", message, error.localizedDescription];
    } else {
        errorMessage = error.localizedDescription;
    }
    [[self shared] logWithLevel:LogLevelError message:errorMessage];
}

#pragma mark - Private Methods

- (void)logWithLevel:(LogLevel)level message:(NSString *)message {
    // 检查日志级别
    if (level < [Logger logLevel]) {
        return;
    }
    
    NSString *timestamp = [self.dateFormatter stringFromDate:[NSDate date]];
    NSString *levelName = [self nameForLogLevel:level];
    NSString *emoji = [self emojiForLogLevel:level];
    NSString *logPrefix = @"[DooPushSDKExample-ObjC]";
    
    NSString *logMessage = [NSString stringWithFormat:@"%@ %@ %@ [%@] %@", 
                           timestamp, logPrefix, emoji, levelName, message];
    
    // 控制台输出
    NSLog(@"%@", logMessage);
}

- (NSString *)nameForLogLevel:(LogLevel)level {
    switch (level) {
        case LogLevelVerbose:
            return @"VERBOSE";
        case LogLevelDebug:
            return @"DEBUG";
        case LogLevelInfo:
            return @"INFO";
        case LogLevelWarning:
            return @"WARNING";
        case LogLevelError:
            return @"ERROR";
        case LogLevelNone:
            return @"NONE";
    }
}

- (NSString *)emojiForLogLevel:(LogLevel)level {
    switch (level) {
        case LogLevelVerbose:
            return @"💬";
        case LogLevelDebug:
            return @"🔍";
        case LogLevelInfo:
            return @"ℹ️";
        case LogLevelWarning:
            return @"⚠️";
        case LogLevelError:
            return @"❌";
        case LogLevelNone:
            return @"";
    }
}

@end

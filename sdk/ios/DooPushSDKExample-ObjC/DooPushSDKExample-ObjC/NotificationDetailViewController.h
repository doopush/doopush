//
//  NotificationDetailViewController.h
//  DooPushSDKExample-ObjC
//
//  通知详情页面
//

#import <UIKit/UIKit.h>
#import "PushNotificationManager.h"

NS_ASSUME_NONNULL_BEGIN

@interface NotificationDetailViewController : UITableViewController

@property (nonatomic, strong) NotificationInfo *notification;

@end

NS_ASSUME_NONNULL_END

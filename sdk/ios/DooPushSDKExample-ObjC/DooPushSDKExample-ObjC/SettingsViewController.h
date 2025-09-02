//
//  SettingsViewController.h
//  DooPushSDKExample-ObjC
//
//  设置页面
//

#import <UIKit/UIKit.h>
#import "PushNotificationManager.h"

NS_ASSUME_NONNULL_BEGIN

@interface SettingsViewController : UITableViewController

@property (nonatomic, strong) PushNotificationManager *pushManager;

@end

NS_ASSUME_NONNULL_END

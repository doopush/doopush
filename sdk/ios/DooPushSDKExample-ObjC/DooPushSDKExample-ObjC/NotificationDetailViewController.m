//
//  NotificationDetailViewController.m
//  DooPushSDKExample-ObjC
//
//  通知详情页面
//

#import "NotificationDetailViewController.h"

typedef NS_ENUM(NSInteger, NotificationDetailSection) {
    NotificationDetailSectionBasicInfo = 0,
    NotificationDetailSectionContent,
    NotificationDetailSectionPayload,
    NotificationDetailSectionTimeInfo,
    NotificationDetailSectionActions,
    NotificationDetailSectionCount
};

@interface NotificationDetailViewController ()

@property (nonatomic, strong) UIView *toastView;
@property (nonatomic, strong) UILabel *toastLabel;
@property (nonatomic, strong) NSLayoutConstraint *toastBottomConstraint;

@end

@implementation NotificationDetailViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    [self setupUI];
    [self setupToastView];
}

#pragma mark - Setup Methods

- (void)setupUI {
    self.navigationItem.title = @"推送详情";
    self.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithTitle:@"完成" 
                                                                              style:UIBarButtonItemStyleDone 
                                                                             target:self 
                                                                             action:@selector(dismiss)];
    
    self.tableView.rowHeight = UITableViewAutomaticDimension;
    self.tableView.estimatedRowHeight = 44;
    self.tableView.allowsSelection = NO;
}

- (void)setupToastView {
    self.toastView = [[UIView alloc] init];
    self.toastView.translatesAutoresizingMaskIntoConstraints = NO;
    self.toastView.layer.cornerRadius = 12;
    self.toastView.backgroundColor = [[UIColor blackColor] colorWithAlphaComponent:0.8];
    self.toastView.hidden = YES;
    
    self.toastLabel = [[UILabel alloc] init];
    self.toastLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.toastLabel.textColor = [UIColor whiteColor];
    self.toastLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightMedium];
    self.toastLabel.textAlignment = NSTextAlignmentCenter;
    self.toastLabel.numberOfLines = 0;
    
    [self.toastView addSubview:self.toastLabel];
    [self.view addSubview:self.toastView];
    
    // Toast view constraints
    [NSLayoutConstraint activateConstraints:@[
        [self.toastView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
        [self.toastView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20],
        [self.toastView.heightAnchor constraintGreaterThanOrEqualToConstant:44]
    ]];
    
    self.toastBottomConstraint = [self.toastView.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:50];
    self.toastBottomConstraint.active = YES;
    
    // Toast label constraints
    [NSLayoutConstraint activateConstraints:@[
        [self.toastLabel.leadingAnchor constraintEqualToAnchor:self.toastView.leadingAnchor constant:16],
        [self.toastLabel.trailingAnchor constraintEqualToAnchor:self.toastView.trailingAnchor constant:-16],
        [self.toastLabel.topAnchor constraintEqualToAnchor:self.toastView.topAnchor constant:12],
        [self.toastLabel.bottomAnchor constraintEqualToAnchor:self.toastView.bottomAnchor constant:-12]
    ]];
}

- (void)dismiss {
    [self dismissViewControllerAnimated:YES completion:nil];
}

#pragma mark - Toast Methods

- (void)showToast:(NSString *)message {
    self.toastLabel.text = message;
    self.toastView.hidden = NO;
    self.toastBottomConstraint.constant = -50;
    
    [UIView animateWithDuration:0.4 delay:0 usingSpringWithDamping:0.8 initialSpringVelocity:0 options:0 animations:^{
        [self.view layoutIfNeeded];
    } completion:nil];
    
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [self hideToast];
    });
}

- (void)hideToast {
    self.toastBottomConstraint.constant = 50;
    
    [UIView animateWithDuration:0.4 delay:0 usingSpringWithDamping:0.8 initialSpringVelocity:0 options:0 animations:^{
        [self.view layoutIfNeeded];
    } completion:^(BOOL finished) {
        self.toastView.hidden = YES;
    }];
}

#pragma mark - Helper Methods

- (NSString *)formatPayloadValue:(id)value {
    if ([value isKindOfClass:[NSString class]]) {
        return (NSString *)value;
    } else if ([value isKindOfClass:[NSNumber class]]) {
        return [(NSNumber *)value stringValue];
    } else if ([value isKindOfClass:[NSArray class]] || [value isKindOfClass:[NSDictionary class]]) {
        NSError *error;
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:value options:NSJSONWritingPrettyPrinted error:&error];
        if (!error && jsonData) {
            return [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        } else {
            return [value description];
        }
    } else {
        return [value description];
    }
}

- (NSString *)formatFullTime:(NSDate *)date {
    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
    formatter.dateStyle = NSDateFormatterFullStyle;
    formatter.timeStyle = NSDateFormatterMediumStyle;
    return [formatter stringFromDate:date];
}

- (NSString *)formatRelativeTime:(NSDate *)date {
    NSTimeInterval timeInterval = [[NSDate date] timeIntervalSinceDate:date];
    
    if (timeInterval < 60) {
        return [NSString stringWithFormat:@"%.0f 秒前", timeInterval];
    } else if (timeInterval < 3600) {
        return [NSString stringWithFormat:@"%.0f 分钟前", timeInterval / 60];
    } else if (timeInterval < 86400) {
        return [NSString stringWithFormat:@"%.0f 小时前", timeInterval / 3600];
    } else {
        return [NSString stringWithFormat:@"%.0f 天前", timeInterval / 86400];
    }
}

- (void)copyFullInfo {
    NSMutableArray *info = [[NSMutableArray alloc] init];
    
    [info addObject:@"=== DooPush 推送通知详情 ==="];
    [info addObject:@""];
    
    if (self.notification.title) {
        [info addObject:[NSString stringWithFormat:@"标题: %@", self.notification.title]];
    }
    
    if (self.notification.content) {
        [info addObject:[NSString stringWithFormat:@"内容: %@", self.notification.content]];
    }
    
    [info addObject:[NSString stringWithFormat:@"接收时间: %@", [self formatFullTime:self.notification.receivedAt]]];
    
    if (self.notification.payload && self.notification.payload.count > 0) {
        [info addObject:@""];
        [info addObject:@"附加数据:"];
        
        NSArray *sortedKeys = [self.notification.payload.allKeys sortedArrayUsingSelector:@selector(localizedCaseInsensitiveCompare:)];
        for (NSString *key in sortedKeys) {
            id value = self.notification.payload[key];
            [info addObject:[NSString stringWithFormat:@"  %@: %@", key, [self formatPayloadValue:value]]];
        }
    }
    
    NSString *fullInfo = [info componentsJoinedByString:@"\n"];
    UIPasteboard.generalPasteboard.string = fullInfo;
    [self showToast:@"完整信息已复制到剪贴板"];
}

- (void)copyPayloadAsJSON {
    if (!self.notification.payload || self.notification.payload.count == 0) {
        return;
    }
    
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:self.notification.payload 
                                                       options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys 
                                                         error:&error];
    
    if (!error && jsonData) {
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        UIPasteboard.generalPasteboard.string = jsonString;
        [self showToast:@"附加数据 JSON 已复制到剪贴板"];
    } else {
        [self showToast:@"复制失败：JSON 序列化错误"];
    }
}

#pragma mark - UITableViewDataSource

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView {
    NSInteger sectionCount = NotificationDetailSectionTimeInfo + 1; // Basic sections
    
    // Add content section if there's content
    if (self.notification.title || self.notification.content) {
        sectionCount++;
    }
    
    // Add payload section if there's payload
    if (self.notification.payload && self.notification.payload.count > 0) {
        sectionCount++;
    }
    
    return sectionCount;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    NSInteger adjustedSection = [self adjustedSectionForSection:section];
    
    switch (adjustedSection) {
        case NotificationDetailSectionBasicInfo:
            return 1;
        case NotificationDetailSectionContent:
            return (self.notification.title ? 1 : 0) + (self.notification.content ? 1 : 0);
        case NotificationDetailSectionPayload:
            return self.notification.payload.count;
        case NotificationDetailSectionTimeInfo:
            return 2;
        case NotificationDetailSectionActions:
            return self.notification.payload && self.notification.payload.count > 0 ? 2 : 1;
        default:
            return 0;
    }
}

- (NSInteger)adjustedSectionForSection:(NSInteger)section {
    NSInteger adjustedSection = section;
    
    // Skip content section if no content
    if (!(self.notification.title || self.notification.content)) {
        if (section >= NotificationDetailSectionContent) {
            adjustedSection++;
        }
    }
    
    // Skip payload section if no payload
    if (!(self.notification.payload && self.notification.payload.count > 0)) {
        if (section >= NotificationDetailSectionPayload) {
            adjustedSection++;
        }
    }
    
    return adjustedSection;
}

- (NSString *)tableView:(UITableView *)tableView titleForHeaderInSection:(NSInteger)section {
    NSInteger adjustedSection = [self adjustedSectionForSection:section];
    
    switch (adjustedSection) {
        case NotificationDetailSectionBasicInfo:
            return nil;
        case NotificationDetailSectionContent:
            return @"消息内容";
        case NotificationDetailSectionPayload:
            return @"附加数据";
        case NotificationDetailSectionTimeInfo:
            return @"时间信息";
        case NotificationDetailSectionActions:
            return @"操作";
        default:
            return nil;
    }
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    NSInteger adjustedSection = [self adjustedSectionForSection:indexPath.section];
    
    switch (adjustedSection) {
        case NotificationDetailSectionBasicInfo:
            return [self basicInfoCellForTableView:tableView];
        case NotificationDetailSectionContent:
            return [self contentCellForTableView:tableView atRow:indexPath.row];
        case NotificationDetailSectionPayload:
            return [self payloadCellForTableView:tableView atRow:indexPath.row];
        case NotificationDetailSectionTimeInfo:
            return [self timeInfoCellForTableView:tableView atRow:indexPath.row];
        case NotificationDetailSectionActions:
            return [self actionsCellForTableView:tableView atRow:indexPath.row];
        default:
            return [[UITableViewCell alloc] init];
    }
}

- (UITableViewCell *)basicInfoCellForTableView:(UITableView *)tableView {
    static NSString *cellIdentifier = @"BasicInfoCell";
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:cellIdentifier];
    
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:cellIdentifier];
        cell.selectionStyle = UITableViewCellSelectionStyleNone;
        
        // Create custom layout
        UIImageView *iconView = [[UIImageView alloc] init];
        iconView.translatesAutoresizingMaskIntoConstraints = NO;
        iconView.image = [UIImage systemImageNamed:@"bell.fill"];
        iconView.tintColor = [UIColor systemBlueColor];
        [cell.contentView addSubview:iconView];
        
        UILabel *titleLabel = [[UILabel alloc] init];
        titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
        titleLabel.text = @"推送通知";
        titleLabel.font = [UIFont systemFontOfSize:18 weight:UIFontWeightSemibold];
        [cell.contentView addSubview:titleLabel];
        
        UILabel *subtitleLabel = [[UILabel alloc] init];
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = NO;
        subtitleLabel.text = @"DooPush SDK";
        subtitleLabel.font = [UIFont systemFontOfSize:14];
        subtitleLabel.textColor = [UIColor secondaryLabelColor];
        [cell.contentView addSubview:subtitleLabel];
        
        [NSLayoutConstraint activateConstraints:@[
            [iconView.leadingAnchor constraintEqualToAnchor:cell.contentView.leadingAnchor constant:16],
            [iconView.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
            [iconView.widthAnchor constraintEqualToConstant:24],
            [iconView.heightAnchor constraintEqualToConstant:24],
            
            [titleLabel.leadingAnchor constraintEqualToAnchor:iconView.trailingAnchor constant:12],
            [titleLabel.topAnchor constraintEqualToAnchor:cell.contentView.topAnchor constant:12],
            [titleLabel.trailingAnchor constraintEqualToAnchor:cell.contentView.trailingAnchor constant:-16],
            
            [subtitleLabel.leadingAnchor constraintEqualToAnchor:titleLabel.leadingAnchor],
            [subtitleLabel.topAnchor constraintEqualToAnchor:titleLabel.bottomAnchor constant:2],
            [subtitleLabel.trailingAnchor constraintEqualToAnchor:titleLabel.trailingAnchor],
            [subtitleLabel.bottomAnchor constraintEqualToAnchor:cell.contentView.bottomAnchor constant:-12]
        ]];
    }
    
    return cell;
}

- (UITableViewCell *)contentCellForTableView:(UITableView *)tableView atRow:(NSInteger)row {
    static NSString *cellIdentifier = @"ContentCell";
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:cellIdentifier];
    
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:cellIdentifier];
        cell.selectionStyle = UITableViewCellSelectionStyleNone;
        cell.textLabel.numberOfLines = 0;
    }
    
    if (row == 0 && self.notification.title) {
        cell.textLabel.text = [NSString stringWithFormat:@"标题: %@", self.notification.title];
        cell.textLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
    } else if ((row == 1 && self.notification.title) || (row == 0 && !self.notification.title)) {
        cell.textLabel.text = [NSString stringWithFormat:@"内容: %@", self.notification.content ?: @""];
        cell.textLabel.font = [UIFont systemFontOfSize:16];
    }
    
    return cell;
}

- (UITableViewCell *)payloadCellForTableView:(UITableView *)tableView atRow:(NSInteger)row {
    static NSString *cellIdentifier = @"PayloadCell";
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:cellIdentifier];
    
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleSubtitle reuseIdentifier:cellIdentifier];
        cell.selectionStyle = UITableViewCellSelectionStyleNone;
        cell.detailTextLabel.numberOfLines = 0;
        cell.detailTextLabel.font = [UIFont fontWithName:@"Menlo" size:14] ?: [UIFont systemFontOfSize:14];
    }
    
    NSArray *sortedKeys = [self.notification.payload.allKeys sortedArrayUsingSelector:@selector(localizedCaseInsensitiveCompare:)];
    NSString *key = sortedKeys[row];
    id value = self.notification.payload[key];
    
    cell.textLabel.text = key;
    cell.detailTextLabel.text = [self formatPayloadValue:value];
    
    return cell;
}

- (UITableViewCell *)timeInfoCellForTableView:(UITableView *)tableView atRow:(NSInteger)row {
    static NSString *cellIdentifier = @"TimeInfoCell";
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:cellIdentifier];
    
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleValue1 reuseIdentifier:cellIdentifier];
        cell.selectionStyle = UITableViewCellSelectionStyleNone;
        cell.detailTextLabel.font = [UIFont fontWithName:@"Menlo" size:14] ?: [UIFont systemFontOfSize:14];
    }
    
    if (row == 0) {
        cell.textLabel.text = @"接收时间";
        cell.detailTextLabel.text = [self formatFullTime:self.notification.receivedAt];
    } else {
        cell.textLabel.text = @"相对时间";
        cell.detailTextLabel.text = [self formatRelativeTime:self.notification.receivedAt];
    }
    
    return cell;
}

- (UITableViewCell *)actionsCellForTableView:(UITableView *)tableView atRow:(NSInteger)row {
    static NSString *cellIdentifier = @"ActionsCell";
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:cellIdentifier];
    
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:cellIdentifier];
        cell.selectionStyle = UITableViewCellSelectionStyleDefault;
        cell.textLabel.textAlignment = NSTextAlignmentCenter;
    }
    
    if (row == 0) {
        cell.textLabel.text = @"复制完整信息";
        cell.textLabel.textColor = [UIColor systemBlueColor];
        cell.backgroundColor = [[UIColor systemBlueColor] colorWithAlphaComponent:0.1];
    } else {
        cell.textLabel.text = @"复制附加数据 (JSON)";
        cell.textLabel.textColor = [UIColor systemBlueColor];
        cell.backgroundColor = [[UIColor systemBlueColor] colorWithAlphaComponent:0.1];
    }
    
    return cell;
}

#pragma mark - UITableViewDelegate

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
    [tableView deselectRowAtIndexPath:indexPath animated:YES];
    
    NSInteger adjustedSection = [self adjustedSectionForSection:indexPath.section];
    
    if (adjustedSection == NotificationDetailSectionActions) {
        if (indexPath.row == 0) {
            [self copyFullInfo];
        } else {
            [self copyPayloadAsJSON];
        }
    }
}

@end

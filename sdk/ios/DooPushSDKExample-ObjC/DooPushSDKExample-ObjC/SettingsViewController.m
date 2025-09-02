//
//  SettingsViewController.m
//  DooPushSDKExample-ObjC
//
//  设置页面
//

#import "SettingsViewController.h"
#import "PushNotificationManager.h"
#import "AppConfig.h"
#import "Logger.h"
@import DooPushSDK;

typedef NS_ENUM(NSInteger, SettingsSection) {
    SettingsSectionConfiguration = 0,
    SettingsSectionDeviceInfo,
    SettingsSectionDebugInfo,
    SettingsSectionActions,
    SettingsSectionBadgeManagement,
    SettingsSectionAbout,
    SettingsSectionCount
};

@interface SettingsViewController ()

@property (nonatomic, strong) UIView *toastView;
@property (nonatomic, strong) UILabel *toastLabel;
@property (nonatomic, strong) NSLayoutConstraint *toastBottomConstraint;
@property (nonatomic, assign) NSInteger badgeRefreshTrigger;

// Toast生命周期管理
@property (nonatomic, strong) NSTimer *hideToastTimer;

// 状态跟踪
@property (nonatomic, assign) BOOL wasRegistering;
@property (nonatomic, assign) BOOL wasUpdatingDevice;

@end

@implementation SettingsViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    [self setupUI];
    [self setupToastView];
    [self setupStatusUpdateCallback];
}

- (void)viewWillAppear:(BOOL)animated {
    [super viewWillAppear:animated];
    
    // 初始化状态跟踪变量
    self.wasRegistering = self.pushManager.isLoading;
    self.wasUpdatingDevice = self.pushManager.isUpdatingDevice;
    
    [self.tableView reloadData];
}

- (void)viewWillDisappear:(BOOL)animated {
    [super viewWillDisappear:animated];
    // 不再需要清除回调，使用通知机制
}

- (void)dealloc {
    // 清理通知监听
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    
    // 清理计时器，避免内存泄漏
    [self.hideToastTimer invalidate];
    self.hideToastTimer = nil;
}

#pragma mark - Setup Methods

- (void)setupUI {
    self.navigationItem.title = @"设置";
    self.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithTitle:@"完成" 
                                                                              style:UIBarButtonItemStyleDone 
                                                                             target:self 
                                                                             action:@selector(dismiss)];
    
    self.tableView.rowHeight = UITableViewAutomaticDimension;
    self.tableView.estimatedRowHeight = 44;
    // 稳定 iOS 15+ 的顶部 header 间距，避免粘性切换时的视觉抖动/层级错乱
    if (@available(iOS 15.0, *)) {
        self.tableView.sectionHeaderTopPadding = 0;
    }
    // 降低 Header 重建频率导致的层级变化几率
    self.tableView.estimatedSectionHeaderHeight = 0;
    self.tableView.estimatedSectionFooterHeight = 0;
}

- (void)setupToastView {
    self.toastView = [[UIView alloc] init];
    self.toastView.translatesAutoresizingMaskIntoConstraints = NO;
    self.toastView.layer.cornerRadius = 12;
    self.toastView.backgroundColor = [[UIColor blackColor] colorWithAlphaComponent:0.8];
    self.toastView.hidden = YES;

    // 确保 toast 显示在最顶层，避免被 tableView header 覆盖
    self.toastView.layer.zPosition = 999;
    
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
        [self.toastView.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
        [self.toastView.leadingAnchor constraintGreaterThanOrEqualToAnchor:self.view.leadingAnchor constant:20],
        [self.toastView.trailingAnchor constraintLessThanOrEqualToAnchor:self.view.trailingAnchor constant:-20],
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

- (void)setupStatusUpdateCallback {
    // 监听状态更新通知
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleStatusUpdateNotification:)
                                                 name:DooPushStatusUpdateNotification
                                               object:nil];
}

- (void)handleStatusUpdateNotification:(NSNotification *)notification {
    [self handleStatusUpdate];
}

- (void)handleStatusUpdate {
    BOOL needsDeviceInfoRefresh = NO;
    BOOL needsDebugInfoRefresh = NO;
    BOOL needsBadgeRefresh = NO;

    // 检查设备信息更新状态
    if (self.pushManager.updateMessage) {
        [self showToast:self.pushManager.updateMessage];
        needsDeviceInfoRefresh = YES;
    }

    // 检查注册操作完成
    if (self.wasRegistering && !self.pushManager.isLoading) {
        if (self.pushManager.sdkStatus == SDKStatusRegistered) {
            [self showToast:@"✅ 推送服务重新注册成功"];
        } else if (self.pushManager.lastError) {
            [self showToast:[NSString stringWithFormat:@"❌ 注册失败: %@", self.pushManager.lastError]];
        }
        needsDeviceInfoRefresh = YES; // 注册成功后deviceToken会更新
        needsDebugInfoRefresh = YES;  // SDK状态会变化
        self.wasRegistering = NO;
    }

    // 检查设备信息更新操作完成
    if (self.wasUpdatingDevice && !self.pushManager.isUpdatingDevice) {
        if (self.pushManager.updateMessage && [self.pushManager.updateMessage containsString:@"成功"]) {
            // updateMessage已经包含成功消息，不需要额外显示
        } else if (self.pushManager.lastError) {
            [self showToast:[NSString stringWithFormat:@"❌ 更新失败: %@", self.pushManager.lastError]];
        }
        needsDeviceInfoRefresh = YES; // 设备信息已更新
        self.wasUpdatingDevice = NO;
    }

        // 更新状态标志
    self.wasRegistering = self.pushManager.isLoading;
    self.wasUpdatingDevice = self.pushManager.isUpdatingDevice;

    // 根据具体变化选择性刷新，避免全表抖动
    [UIView performWithoutAnimation:^{
        NSMutableIndexSet *sectionsToReload = [NSMutableIndexSet new];

        if (needsDeviceInfoRefresh) {
            [sectionsToReload addIndex:SettingsSectionDeviceInfo];
        }
        if (needsDebugInfoRefresh) {
            [sectionsToReload addIndex:SettingsSectionDebugInfo];
        }
        if (needsBadgeRefresh) {
            [sectionsToReload addIndex:SettingsSectionBadgeManagement];
        }

        // 如果没有任何变化就不刷新，避免不必要的抖动
        if (sectionsToReload.count > 0) {
            [self reloadAdaptivelyForSections:sectionsToReload];
        }
    }];
}

- (void)dismiss {
    [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)refreshSpecificSections {
    // 使用动画禁用来避免抖动
    [UIView performWithoutAnimation:^{
        // 只刷新需要动态更新的section（仅刷新行以避免 header 重建带来的层级跳变）
        NSMutableIndexSet *sectionsToReload = [NSMutableIndexSet new];

        // 设备信息section - 包含deviceToken和deviceId
        [sectionsToReload addIndex:SettingsSectionDeviceInfo];

        // 调试信息section - 包含权限状态、SDK状态、通知历史、错误信息
        [sectionsToReload addIndex:SettingsSectionDebugInfo];

        // 角标管理section - 包含当前角标数字
        [sectionsToReload addIndex:SettingsSectionBadgeManagement];

        [self reloadAdaptivelyForSections:sectionsToReload];
    }];
}

- (void)refreshBadgeSection {
    // 仅刷新角标管理section，避免全表抖动
    [UIView performWithoutAnimation:^{
        NSIndexSet *badgeSection = [NSIndexSet indexSetWithIndex:SettingsSectionBadgeManagement];
        [self reloadAdaptivelyForSections:badgeSection];
    }];
}

- (void)refreshDebugInfoSection {
    // 仅刷新调试信息section，避免全表抖动
    [UIView performWithoutAnimation:^{
        NSIndexSet *debugSection = [NSIndexSet indexSetWithIndex:SettingsSectionDebugInfo];
        [self reloadAdaptivelyForSections:debugSection];
    }];
}

#pragma mark - Header Stabilization

// 统一 header 的背景，避免透明造成的重叠视觉问题
- (void)tableView:(UITableView *)tableView willDisplayHeaderView:(UIView *)view forSection:(NSInteger)section {
    if (![view isKindOfClass:[UITableViewHeaderFooterView class]]) { return; }
    UITableViewHeaderFooterView *header = (UITableViewHeaderFooterView *)view;
    header.backgroundView = nil;
    header.contentView.backgroundColor = tableView.backgroundColor ?: [UIColor systemBackgroundColor];
}

#pragma mark - Fine-grained reload helpers

- (void)reloadRowsForSections:(NSIndexSet *)sections {
    NSMutableArray<NSIndexPath *> *indexPaths = [NSMutableArray array];
    [sections enumerateIndexesUsingBlock:^(NSUInteger section, BOOL * _Nonnull stop) {
        NSInteger rows = [self tableView:self.tableView numberOfRowsInSection:section];
        for (NSInteger row = 0; row < rows; row++) {
            [indexPaths addObject:[NSIndexPath indexPathForRow:row inSection:section]];
        }
    }];
    if (indexPaths.count > 0) {
        [self.tableView reloadRowsAtIndexPaths:indexPaths withRowAnimation:UITableViewRowAnimationNone];
    }
}

// DebugInfo 行数可能增减（有无 lastError），该 section 使用 reloadSections；其余使用行级刷新
- (void)reloadAdaptivelyForSections:(NSIndexSet *)sections {
    __block NSMutableIndexSet *sectionLevelSet = [NSMutableIndexSet indexSet];
    __block NSMutableIndexSet *rowLevelSet = [NSMutableIndexSet indexSet];

    [sections enumerateIndexesUsingBlock:^(NSUInteger section, BOOL * _Nonnull stop) {
        if (section == SettingsSectionDebugInfo) {
            [sectionLevelSet addIndex:section];
        } else {
            [rowLevelSet addIndex:section];
        }
    }];

    if (rowLevelSet.count > 0) {
        [self reloadRowsForSections:rowLevelSet];
    }
    if (sectionLevelSet.count > 0) {
        [self.tableView reloadSections:sectionLevelSet withRowAnimation:UITableViewRowAnimationNone];
    }
}

#pragma mark - Toast Methods

- (void)showToast:(NSString *)message {
    // 取消之前的自动隐藏计时器
    [self.hideToastTimer invalidate];
    self.hideToastTimer = nil;

    // 取消正在进行的隐藏动画，确保立刻转为显示状态
    [self.toastView.layer removeAllAnimations];
    [self.view.layer removeAllAnimations];

    self.toastLabel.text = message;
    self.toastView.hidden = NO;
    self.toastView.alpha = 1.0;
    self.toastBottomConstraint.constant = -50;
    
    [UIView animateWithDuration:0.3 delay:0 options:UIViewAnimationOptionBeginFromCurrentState | UIViewAnimationOptionCurveEaseOut animations:^{
        [self.view layoutIfNeeded];
    } completion:nil];
    
    // 重新开始计时，2.5秒后自动隐藏
    __weak typeof(self) weakSelf = self;
    self.hideToastTimer = [NSTimer scheduledTimerWithTimeInterval:2.5 repeats:NO block:^(NSTimer * _Nonnull timer) {
        [weakSelf hideToast];
    }];
}

- (void)hideToast {
    // 清除计时器
    [self.hideToastTimer invalidate];
    self.hideToastTimer = nil;
    
    // 在隐藏时允许中途被打断：BeginFromCurrentState，并同时做轻微淡出
    self.toastBottomConstraint.constant = 50;
    [UIView animateWithDuration:0.25 delay:0 options:UIViewAnimationOptionBeginFromCurrentState | UIViewAnimationOptionCurveEaseIn | UIViewAnimationOptionAllowUserInteraction animations:^{
        self.toastView.alpha = 0.0;
        [self.view layoutIfNeeded];
    } completion:^(BOOL finished) {
        BOOL shouldStillHide = (self.hideToastTimer == nil) && (self.toastBottomConstraint.constant == 50);
        if (shouldStillHide) {
            self.toastView.hidden = YES;
            self.toastView.alpha = 1.0;
        } else {
            self.toastView.hidden = NO;
            self.toastView.alpha = 1.0;
        }
    }];
}

#pragma mark - Badge Management Methods

- (void)updateBadge:(NSInteger)number {
    [DooPushManager.shared setBadgeNumber:number completion:nil];
    
    // 立即触发UI更新
    self.badgeRefreshTrigger++;
    
    // 延迟一点点显示Toast
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        if (number == 0) {
            [self showToast:@"角标已清除"];
        } else {
            [self showToast:[NSString stringWithFormat:@"角标已设置为 %ld", (long)number]];
        }
        [self refreshBadgeSection];
    });
}

- (void)incrementBadge {
    [DooPushManager.shared incrementBadgeNumberBy:1 completion:nil];
    
    self.badgeRefreshTrigger++;
    
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        NSInteger current = [DooPushManager.shared getCurrentBadgeNumber];
        [self showToast:[NSString stringWithFormat:@"角标数字 +1，当前: %ld", (long)current]];
        [self refreshBadgeSection];
    });
}

- (void)decrementBadge {
    [DooPushManager.shared decrementBadgeNumberBy:1 completion:nil];
    
    self.badgeRefreshTrigger++;
    
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        NSInteger current = [DooPushManager.shared getCurrentBadgeNumber];
        [self showToast:[NSString stringWithFormat:@"角标数字 -1，当前: %ld", (long)current]];
        [self refreshBadgeSection];
    });
}

#pragma mark - Helper Methods

- (void)openSettings {
    NSURL *settingsURL = [NSURL URLWithString:UIApplicationOpenSettingsURLString];
    if (settingsURL && [[UIApplication sharedApplication] canOpenURL:settingsURL]) {
        [[UIApplication sharedApplication] openURL:settingsURL options:@{} completionHandler:nil];
    }
}

- (NSString *)formatBuildDate {
    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
    formatter.dateStyle = NSDateFormatterMediumStyle;
    formatter.timeStyle = NSDateFormatterShortStyle;
    return [formatter stringFromDate:[NSDate date]];
}

- (void)copyToClipboard:(NSString *)text withMessage:(NSString *)message {
    UIPasteboard.generalPasteboard.string = text;
    [self showToast:message];
}

#pragma mark - UITableViewDataSource

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView {
    return SettingsSectionCount;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    switch (section) {
        case SettingsSectionConfiguration:
            return 4; // App ID, API Key, Server URL, SDK Version
        case SettingsSectionDeviceInfo:
            return 7; // Token, Device ID, Model, System Name, System Version, Bundle ID, App Version
        case SettingsSectionDebugInfo:
            return self.pushManager.lastError ? 4 : 3; // Permission, SDK Status, Notifications, Error (optional)
        case SettingsSectionActions:
            return 4; // Re-register, Update Device, Open Settings, Clear History
        case SettingsSectionBadgeManagement:
            return 7; // Current Badge, Set 5, Set 10, +1, -1, Random, Clear
        case SettingsSectionAbout:
            return 3; // App Version, Build Time, Project URL
        default:
            return 0;
    }
}

- (NSString *)tableView:(UITableView *)tableView titleForHeaderInSection:(NSInteger)section {
    switch (section) {
        case SettingsSectionConfiguration:
            return @"SDK 配置";
        case SettingsSectionDeviceInfo:
            return @"设备详细信息";
        case SettingsSectionDebugInfo:
            return @"调试信息";
        case SettingsSectionActions:
            return @"操作";
        case SettingsSectionBadgeManagement:
            return @"角标管理";
        case SettingsSectionAbout:
            return @"关于";
        default:
            return nil;
    }
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    static NSString *cellIdentifier = @"SettingsCell";
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:cellIdentifier];
    
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleValue1 reuseIdentifier:cellIdentifier];
        cell.detailTextLabel.font = [UIFont fontWithName:@"Menlo" size:14] ?: [UIFont systemFontOfSize:14];
        cell.selectionStyle = UITableViewCellSelectionStyleDefault;
    }
    
    // Reset cell state to avoid reuse issues
    cell.textLabel.textColor = [UIColor labelColor];
    cell.detailTextLabel.textColor = [UIColor secondaryLabelColor]; // 重置详细文本颜色
    cell.detailTextLabel.font = [UIFont fontWithName:@"Menlo" size:14] ?: [UIFont systemFontOfSize:14]; // 重置详细文本字体
    cell.detailTextLabel.text = nil; // 清空详细文本
    cell.accessoryType = UITableViewCellAccessoryNone;
    cell.selectionStyle = UITableViewCellSelectionStyleDefault;
    
    switch (indexPath.section) {
        case SettingsSectionConfiguration:
            [self configureConfigurationCell:cell atRow:indexPath.row];
            break;
        case SettingsSectionDeviceInfo:
            [self configureDeviceInfoCell:cell atRow:indexPath.row];
            break;
        case SettingsSectionDebugInfo:
            [self configureDebugInfoCell:cell atRow:indexPath.row];
            break;
        case SettingsSectionActions:
            [self configureActionsCell:cell atRow:indexPath.row];
            break;
        case SettingsSectionBadgeManagement:
            [self configureBadgeManagementCell:cell atRow:indexPath.row];
            break;
        case SettingsSectionAbout:
            [self configureAboutCell:cell atRow:indexPath.row];
            break;
    }
    
    return cell;
}

- (void)configureConfigurationCell:(UITableViewCell *)cell atRow:(NSInteger)row {
    switch (row) {
        case 0:
            cell.textLabel.text = @"应用 ID";
            cell.detailTextLabel.text = AppConfig.appId;
            break;
        case 1:
            cell.textLabel.text = @"API 密钥";
            cell.detailTextLabel.text = AppConfig.apiKey;
            break;
        case 2:
            cell.textLabel.text = @"服务器地址";
            cell.detailTextLabel.text = AppConfig.displayBaseURL;
            break;
        case 3:
            cell.textLabel.text = @"SDK 版本";
            cell.detailTextLabel.text = DooPushManager.sdkVersion;
            break;
    }
}

- (void)configureDeviceInfoCell:(UITableViewCell *)cell atRow:(NSInteger)row {
    UIDevice *device = [UIDevice currentDevice];
    NSBundle *bundle = [NSBundle mainBundle];
    
    switch (row) {
        case 0:
            cell.textLabel.text = @"设备 Token";
            cell.detailTextLabel.text = self.pushManager.deviceToken ?: @"未获取";
            if (self.pushManager.deviceToken) {
                cell.accessoryType = UITableViewCellAccessoryDisclosureIndicator;
            }
            break;
        case 1:
            cell.textLabel.text = @"设备 ID";
            cell.detailTextLabel.text = self.pushManager.deviceId ?: @"未获取";
            break;
        case 2:
            cell.textLabel.text = @"设备型号";
            cell.detailTextLabel.text = device.model;
            break;
        case 3:
            cell.textLabel.text = @"系统名称";
            cell.detailTextLabel.text = device.systemName;
            break;
        case 4:
            cell.textLabel.text = @"系统版本";
            cell.detailTextLabel.text = device.systemVersion;
            break;
        case 5:
            cell.textLabel.text = @"Bundle ID";
            cell.detailTextLabel.text = bundle.bundleIdentifier ?: @"未知";
            break;
        case 6:
            cell.textLabel.text = @"应用版本";
            cell.detailTextLabel.text = [bundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"未知";
            break;
    }
}

- (void)configureDebugInfoCell:(UITableViewCell *)cell atRow:(NSInteger)row {
    switch (row) {
        case 0:
            cell.textLabel.text = @"推送权限";
            cell.detailTextLabel.text = [self.pushManager displayTextForAuthorizationStatus:self.pushManager.pushPermissionStatus];
            break;
        case 1:
            cell.textLabel.text = @"SDK 状态";
            cell.detailTextLabel.text = [self.pushManager displayTextForSDKStatus:self.pushManager.sdkStatus];
            break;
        case 2:
            cell.textLabel.text = @"通知历史";
            cell.detailTextLabel.text = [NSString stringWithFormat:@"%lu 条", (unsigned long)self.pushManager.notifications.count];
            break;
        case 3:
            if (self.pushManager.lastError) {
                cell.textLabel.text = @"最后错误";
                cell.detailTextLabel.text = self.pushManager.lastError;
                cell.detailTextLabel.textColor = [UIColor systemRedColor];
                cell.detailTextLabel.font = [UIFont systemFontOfSize:12];
            } else {
                // 没有错误时，隐藏此行或显示状态正常
                cell.textLabel.text = @"运行状态";
                cell.detailTextLabel.text = @"正常";
                cell.detailTextLabel.textColor = [UIColor systemGreenColor];
                cell.detailTextLabel.font = [UIFont fontWithName:@"Menlo" size:14] ?: [UIFont systemFontOfSize:14];
            }
            break;
    }
}

- (void)configureActionsCell:(UITableViewCell *)cell atRow:(NSInteger)row {
    cell.detailTextLabel.text = nil;
    
    switch (row) {
        case 0:
            cell.textLabel.text = @"重新注册推送";
            cell.textLabel.textColor = [UIColor systemBlueColor];
            break;
        case 1:
            cell.textLabel.text = @"更新设备信息";
            cell.textLabel.textColor = [UIColor systemBlueColor];
            break;
        case 2:
            cell.textLabel.text = @"前往系统设置";
            cell.textLabel.textColor = [UIColor systemBlueColor];
            break;
        case 3:
            cell.textLabel.text = @"清空通知历史";
            cell.textLabel.textColor = [UIColor systemRedColor];
            break;
    }
}

- (void)configureBadgeManagementCell:(UITableViewCell *)cell atRow:(NSInteger)row {
    cell.detailTextLabel.text = nil;
    
    switch (row) {
        case 0:
            cell.textLabel.text = @"当前角标数字";
            cell.detailTextLabel.text = [NSString stringWithFormat:@"%ld", (long)[DooPushManager.shared getCurrentBadgeNumber]];
            cell.detailTextLabel.font = [UIFont systemFontOfSize:18 weight:UIFontWeightSemibold];
            cell.detailTextLabel.textColor = [UIColor systemBlueColor];
            cell.selectionStyle = UITableViewCellSelectionStyleNone;
            break;
        case 1:
            cell.textLabel.text = @"设置为 5";
            cell.textLabel.textColor = [UIColor systemBlueColor];
            cell.selectionStyle = UITableViewCellSelectionStyleDefault; // 重置选择样式
            break;
        case 2:
            cell.textLabel.text = @"设置为 10";
            cell.textLabel.textColor = [UIColor systemBlueColor];
            cell.selectionStyle = UITableViewCellSelectionStyleDefault; // 重置选择样式
            break;
        case 3:
            cell.textLabel.text = @"角标 +1";
            cell.textLabel.textColor = [UIColor systemGreenColor];
            cell.selectionStyle = UITableViewCellSelectionStyleDefault; // 重置选择样式
            break;
        case 4:
            cell.textLabel.text = @"角标 -1";
            cell.textLabel.textColor = [UIColor systemOrangeColor];
            cell.selectionStyle = UITableViewCellSelectionStyleDefault; // 重置选择样式
            break;
        case 5:
            cell.textLabel.text = @"随机设置";
            cell.textLabel.textColor = [UIColor systemPurpleColor];
            cell.selectionStyle = UITableViewCellSelectionStyleDefault; // 重置选择样式
            break;
        case 6:
            cell.textLabel.text = @"清除角标";
            cell.textLabel.textColor = [UIColor systemRedColor];
            cell.selectionStyle = UITableViewCellSelectionStyleDefault; // 重置选择样式
            break;
    }
}

- (void)configureAboutCell:(UITableViewCell *)cell atRow:(NSInteger)row {
    switch (row) {
        case 0:
            cell.textLabel.text = @"示例应用版本";
            cell.detailTextLabel.text = @"1.0.0";
            break;
        case 1:
            cell.textLabel.text = @"构建时间";
            cell.detailTextLabel.text = [self formatBuildDate];
            break;
        case 2:
            cell.textLabel.text = @"项目主页";
            cell.detailTextLabel.text = nil;
            cell.textLabel.textColor = [UIColor systemBlueColor];
            cell.accessoryType = UITableViewCellAccessoryDisclosureIndicator;
            break;
    }
}

#pragma mark - UITableViewDelegate

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
    [tableView deselectRowAtIndexPath:indexPath animated:YES];
    
    switch (indexPath.section) {
        case SettingsSectionConfiguration:
            [self handleConfigurationRowTap:indexPath.row];
            break;
        case SettingsSectionDeviceInfo:
            [self handleDeviceInfoRowTap:indexPath.row];
            break;
        case SettingsSectionDebugInfo:
            [self handleDebugInfoRowTap:indexPath.row];
            break;
        case SettingsSectionActions:
            [self handleActionsRowTap:indexPath.row];
            break;
        case SettingsSectionBadgeManagement:
            [self handleBadgeManagementRowTap:indexPath.row];
            break;
        case SettingsSectionAbout:
            [self handleAboutRowTap:indexPath.row];
            break;
    }
}

- (void)handleConfigurationRowTap:(NSInteger)row {
    NSString *value;
    NSString *message;
    
    switch (row) {
        case 0:
            value = AppConfig.appId;
            message = @"应用 ID 已复制到剪贴板";
            break;
        case 1:
            value = AppConfig.apiKey;
            message = @"API 密钥已复制到剪贴板";
            break;
        case 2:
            value = AppConfig.displayBaseURL;
            message = @"服务器地址已复制到剪贴板";
            break;
        case 3:
            value = DooPushManager.sdkVersion;
            message = @"SDK 版本已复制到剪贴板";
            break;
    }
    
    if (value) {
        [self copyToClipboard:value withMessage:message];
    }
}

- (void)handleDeviceInfoRowTap:(NSInteger)row {
    if (row == 0 && self.pushManager.deviceToken) {
        // Show token detail view (simplified version)
        UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"设备 Token" 
                                                                       message:self.pushManager.deviceToken 
                                                                preferredStyle:UIAlertControllerStyleAlert];
        
        UIAlertAction *copyAction = [UIAlertAction actionWithTitle:@"复制" style:UIAlertActionStyleDefault handler:^(UIAlertAction * _Nonnull action) {
            [self copyToClipboard:self.pushManager.deviceToken withMessage:@"设备 Token 已复制到剪贴板"];
        }];
        
        UIAlertAction *cancelAction = [UIAlertAction actionWithTitle:@"取消" style:UIAlertActionStyleCancel handler:nil];
        
        [alert addAction:copyAction];
        [alert addAction:cancelAction];
        [self presentViewController:alert animated:YES completion:nil];
    }
}

- (void)handleDebugInfoRowTap:(NSInteger)row {
    if (row == 3 && self.pushManager.lastError) {
        [self copyToClipboard:self.pushManager.lastError withMessage:@"错误信息已复制到剪贴板"];
    }
}

- (void)handleActionsRowTap:(NSInteger)row {
    switch (row) {
        case 0:
            [self.pushManager registerForPushNotifications];
            [self showToast:@"正在重新注册推送服务..."];
            break;
        case 1:
            [self.pushManager updateDeviceInfo];
            [self showToast:@"正在更新设备信息..."];
            break;
        case 2:
            [self openSettings];
            break;
        case 3: {
            UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"清空通知历史" 
                                                                           message:@"确定要清空所有通知历史吗？此操作不可撤销。" 
                                                                    preferredStyle:UIAlertControllerStyleAlert];
            
            UIAlertAction *cancelAction = [UIAlertAction actionWithTitle:@"取消" style:UIAlertActionStyleCancel handler:nil];
            UIAlertAction *clearAction = [UIAlertAction actionWithTitle:@"清空" style:UIAlertActionStyleDestructive handler:^(UIAlertAction * _Nonnull action) {
                [self.pushManager clearNotifications];
                [self showToast:@"通知历史已清空"];
                [self refreshDebugInfoSection];
            }];
            
            [alert addAction:cancelAction];
            [alert addAction:clearAction];
            [self presentViewController:alert animated:YES completion:nil];
            break;
        }
    }
}

- (void)handleBadgeManagementRowTap:(NSInteger)row {
    switch (row) {
        case 0:
            // Current badge - no action
            break;
        case 1:
            [self updateBadge:5];
            break;
        case 2:
            [self updateBadge:10];
            break;
        case 3:
            [self incrementBadge];
            break;
        case 4:
            [self decrementBadge];
            break;
        case 5: {
            NSInteger randomNumber = arc4random_uniform(99) + 1;
            [self updateBadge:randomNumber];
            break;
        }
        case 6:
            [self updateBadge:0];
            break;
    }
}

- (void)handleAboutRowTap:(NSInteger)row {
    if (row == 2) {
        // Open project URL
        NSURL *url = [NSURL URLWithString:@"https://github.com/doopush/doopush"];
        if (url && [[UIApplication sharedApplication] canOpenURL:url]) {
            [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
        }
    }
}

@end

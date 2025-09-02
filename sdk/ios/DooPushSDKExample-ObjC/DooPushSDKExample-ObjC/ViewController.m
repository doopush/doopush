//
//  ViewController.m
//  DooPushSDKExample-ObjC
//
//  Created by 韦一 on 2025/9/1.
//

#import "ViewController.h"
#import "AppConfig.h"
#import "Logger.h"
#import "PushNotificationManager.h"
#import "SettingsViewController.h"
#import "NotificationDetailViewController.h"
@import DooPushSDK;

@interface ViewController () <UITableViewDataSource, UITableViewDelegate>

// UI Components - programmatically created
@property (nonatomic, strong) UIScrollView *scrollView;
@property (nonatomic, strong) UIView *contentView;
@property (nonatomic, strong) UIImageView *appIconImageView;
@property (nonatomic, strong) UILabel *titleLabel;
@property (nonatomic, strong) UILabel *versionLabel;

// SDK Status Section
@property (nonatomic, strong) UIView *sdkStatusView;
@property (nonatomic, strong) UILabel *sdkStatusLabel;
@property (nonatomic, strong) UIView *sdkStatusIndicator;
@property (nonatomic, strong) UILabel *permissionStatusLabel;
@property (nonatomic, strong) UIView *permissionStatusIndicator;
@property (nonatomic, strong) UILabel *errorLabel;
@property (nonatomic, strong) UILabel *updateLabel;
@property (nonatomic, strong) UIActivityIndicatorView *updateActivityIndicator;

// Device Info Section
@property (nonatomic, strong) UIView *deviceInfoView;
@property (nonatomic, strong) UILabel *deviceTokenLabel;
@property (nonatomic, strong) UILabel *deviceIdLabel;
@property (nonatomic, strong) UILabel *deviceModelLabel;
@property (nonatomic, strong) UILabel *systemVersionLabel;

// Action Buttons
@property (nonatomic, strong) UIButton *registerButton;
@property (nonatomic, strong) UIActivityIndicatorView *registerActivityIndicator;
@property (nonatomic, strong) UIButton *updateDeviceButton;
@property (nonatomic, strong) UIButton *checkPermissionButton;
@property (nonatomic, strong) UIButton *openSettingsButton;

// Notifications Section
@property (nonatomic, strong) UIView *notificationsView;
@property (nonatomic, strong) UILabel *notificationsCountLabel;
@property (nonatomic, strong) UITableView *notificationsTableView;
@property (nonatomic, strong) UIView *noNotificationsView;
@property (nonatomic, strong) UIButton *clearNotificationsButton;

// Toast View
@property (nonatomic, strong) UIView *toastView;
@property (nonatomic, strong) UILabel *toastLabel;
@property (nonatomic, strong) NSLayoutConstraint *toastBottomConstraint;

// Other
@property (nonatomic, strong) PushNotificationManager *pushManager;
@property (nonatomic, strong) NSTimer *rotationTimer;
@property (nonatomic, assign) CGFloat rotationAngle;

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    [self setupUI];
    [self setupPushManager];
    [self updateUI];
}

- (void)viewWillAppear:(BOOL)animated {
    [super viewWillAppear:animated];
    [self updateUI];
}

#pragma mark - Setup Methods

- (void)setupUI {
    // Navigation
    self.navigationItem.title = @"DooPush SDK 示例";
    self.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithTitle:@"设置" 
                                                                              style:UIBarButtonItemStylePlain 
                                                                             target:self 
                                                                             action:@selector(showSettings)];
    
    // Create and setup UI programmatically
    [self createScrollView];
    [self createHeaderSection];
    [self createSDKStatusSection];
    [self createDeviceInfoSection];
    [self createActionButtons];
    [self createNotificationsSection];
    [self createToastView];
    [self setupConstraints];
    
    // Configure refresh control
    UIRefreshControl *refreshControl = [[UIRefreshControl alloc] init];
    [refreshControl addTarget:self action:@selector(refreshData:) forControlEvents:UIControlEventValueChanged];
    self.scrollView.refreshControl = refreshControl;
}

- (void)createScrollView {
    self.scrollView = [[UIScrollView alloc] init];
    self.scrollView.translatesAutoresizingMaskIntoConstraints = NO;
    self.scrollView.backgroundColor = [UIColor systemBackgroundColor];
    [self.view addSubview:self.scrollView];
    
    self.contentView = [[UIView alloc] init];
    self.contentView.translatesAutoresizingMaskIntoConstraints = NO;
    [self.scrollView addSubview:self.contentView];
}

- (void)createHeaderSection {
    // App Icon
    self.appIconImageView = [[UIImageView alloc] init];
    self.appIconImageView.translatesAutoresizingMaskIntoConstraints = NO;
    self.appIconImageView.image = [UIImage imageNamed:@"icon"];
    self.appIconImageView.layer.cornerRadius = 16;
    self.appIconImageView.clipsToBounds = YES;
    self.appIconImageView.contentMode = UIViewContentModeScaleAspectFit;
    [self.contentView addSubview:self.appIconImageView];
    
    // Title
    self.titleLabel = [[UILabel alloc] init];
    self.titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.titleLabel.text = @"DooPush SDK 示例";
    self.titleLabel.font = [UIFont systemFontOfSize:20 weight:UIFontWeightSemibold];
    self.titleLabel.textAlignment = NSTextAlignmentCenter;
    [self.contentView addSubview:self.titleLabel];
    
    // Version
    self.versionLabel = [[UILabel alloc] init];
    self.versionLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.versionLabel.text = [NSString stringWithFormat:@"版本 %@", DooPushManager.sdkVersion];
    self.versionLabel.font = [UIFont systemFontOfSize:14];
    self.versionLabel.textColor = [UIColor secondaryLabelColor];
    self.versionLabel.textAlignment = NSTextAlignmentCenter;
    [self.contentView addSubview:self.versionLabel];
}

- (void)createSDKStatusSection {
    self.sdkStatusView = [self createGroupViewWithTitle:@"SDK 状态"];
    [self.contentView addSubview:self.sdkStatusView];
    
    // SDK Status
    UIStackView *sdkStatusStack = [self createStatusRowWithTitle:@"SDK 状态"];
    self.sdkStatusLabel = (UILabel *)sdkStatusStack.arrangedSubviews[1];
    self.sdkStatusIndicator = [self createStatusIndicator];
    [sdkStatusStack addArrangedSubview:self.sdkStatusIndicator];
    [self.sdkStatusView addSubview:sdkStatusStack];
    
    // Permission Status
    UIStackView *permissionStack = [self createStatusRowWithTitle:@"推送权限"];
    self.permissionStatusLabel = (UILabel *)permissionStack.arrangedSubviews[1];
    self.permissionStatusIndicator = [self createStatusIndicator];
    [permissionStack addArrangedSubview:self.permissionStatusIndicator];
    [self.sdkStatusView addSubview:permissionStack];
    
    // Error Label
    self.errorLabel = [[UILabel alloc] init];
    self.errorLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.errorLabel.font = [UIFont systemFontOfSize:12];
    self.errorLabel.textColor = [UIColor systemRedColor];
    self.errorLabel.numberOfLines = 0;
    self.errorLabel.hidden = YES;
    [self.sdkStatusView addSubview:self.errorLabel];
    
    // Update Label
    self.updateLabel = [[UILabel alloc] init];
    self.updateLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.updateLabel.font = [UIFont systemFontOfSize:12];
    self.updateLabel.textColor = [UIColor systemBlueColor];
    self.updateLabel.numberOfLines = 0;
    self.updateLabel.hidden = YES;
    [self.sdkStatusView addSubview:self.updateLabel];
    
    // Update Activity Indicator
    self.updateActivityIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
    self.updateActivityIndicator.translatesAutoresizingMaskIntoConstraints = NO;
    [self.sdkStatusView addSubview:self.updateActivityIndicator];
}

- (void)createDeviceInfoSection {
    self.deviceInfoView = [self createGroupViewWithTitle:@"设备信息"];
    [self.contentView addSubview:self.deviceInfoView];
    
    UIDevice *device = [UIDevice currentDevice];
    
    self.deviceTokenLabel = [self createInfoLabelWithText:@"设备 Token: 未获取"];
    self.deviceIdLabel = [self createInfoLabelWithText:@"设备 ID: 未获取"];
    self.deviceModelLabel = [self createInfoLabelWithText:[NSString stringWithFormat:@"设备型号: %@", device.model]];
    self.systemVersionLabel = [self createInfoLabelWithText:[NSString stringWithFormat:@"系统版本: iOS %@", device.systemVersion]];
    
    [self.deviceInfoView addSubview:self.deviceTokenLabel];
    [self.deviceInfoView addSubview:self.deviceIdLabel];
    [self.deviceInfoView addSubview:self.deviceModelLabel];
    [self.deviceInfoView addSubview:self.systemVersionLabel];
}

- (void)createActionButtons {
    // Register Button
    self.registerButton = [self createButtonWithTitle:@"注册推送通知" color:[UIColor systemGreenColor] action:@selector(registerButtonTapped:)];
    [self.contentView addSubview:self.registerButton];
    
    self.registerActivityIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
    self.registerActivityIndicator.translatesAutoresizingMaskIntoConstraints = NO;
    self.registerActivityIndicator.hidesWhenStopped = YES;
    [self.registerButton addSubview:self.registerActivityIndicator];
    
    // Update Device Button
    self.updateDeviceButton = [self createButtonWithTitle:@"更新设备信息" color:[UIColor systemBlueColor] action:@selector(updateDeviceButtonTapped:)];
    [self.contentView addSubview:self.updateDeviceButton];
    
    // Check Permission Button
    self.checkPermissionButton = [self createButtonWithTitle:@"检查权限" color:[UIColor systemOrangeColor] action:@selector(checkPermissionButtonTapped:)];
    [self.contentView addSubview:self.checkPermissionButton];
    
    // Open Settings Button
    self.openSettingsButton = [self createButtonWithTitle:@"前往设置开启推送权限" color:[UIColor systemRedColor] action:@selector(openSettingsButtonTapped:)];
    self.openSettingsButton.hidden = YES;
    [self.contentView addSubview:self.openSettingsButton];
}

- (void)createNotificationsSection {
    self.notificationsView = [self createGroupViewWithTitle:@"通知历史"];
    [self.contentView addSubview:self.notificationsView];
    
    self.notificationsCountLabel = [[UILabel alloc] init];
    self.notificationsCountLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.notificationsCountLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
    self.notificationsCountLabel.text = @"通知历史 (0)";
    [self.notificationsView addSubview:self.notificationsCountLabel];
    
    // Table View
    self.notificationsTableView = [[UITableView alloc] init];
    self.notificationsTableView.translatesAutoresizingMaskIntoConstraints = NO;
    self.notificationsTableView.dataSource = self;
    self.notificationsTableView.delegate = self;
    self.notificationsTableView.rowHeight = UITableViewAutomaticDimension;
    self.notificationsTableView.estimatedRowHeight = 60;
    self.notificationsTableView.backgroundColor = [UIColor clearColor];
    [self.notificationsView addSubview:self.notificationsTableView];
    
    // No Notifications View
    self.noNotificationsView = [[UIView alloc] init];
    self.noNotificationsView.translatesAutoresizingMaskIntoConstraints = NO;
    
    UILabel *noNotificationsLabel = [[UILabel alloc] init];
    noNotificationsLabel.translatesAutoresizingMaskIntoConstraints = NO;
    noNotificationsLabel.text = @"暂无推送通知";
    noNotificationsLabel.textColor = [UIColor secondaryLabelColor];
    noNotificationsLabel.textAlignment = NSTextAlignmentCenter;
    [self.noNotificationsView addSubview:noNotificationsLabel];
    
    [NSLayoutConstraint activateConstraints:@[
        [noNotificationsLabel.centerXAnchor constraintEqualToAnchor:self.noNotificationsView.centerXAnchor],
        [noNotificationsLabel.centerYAnchor constraintEqualToAnchor:self.noNotificationsView.centerYAnchor]
    ]];
    
    [self.notificationsView addSubview:self.noNotificationsView];
    
    // Clear Button
    self.clearNotificationsButton = [self createButtonWithTitle:@"清空历史" color:[UIColor systemRedColor] action:@selector(clearNotificationsButtonTapped:)];
    self.clearNotificationsButton.hidden = YES;
    [self.notificationsView addSubview:self.clearNotificationsButton];
}

- (void)createToastView {
    self.toastView = [[UIView alloc] init];
    self.toastView.translatesAutoresizingMaskIntoConstraints = NO;
    self.toastView.layer.cornerRadius = 12;
    self.toastView.backgroundColor = [[UIColor blackColor] colorWithAlphaComponent:0.8];
    self.toastView.hidden = YES;
    [self.view addSubview:self.toastView];
    
    self.toastLabel = [[UILabel alloc] init];
    self.toastLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.toastLabel.textColor = [UIColor whiteColor];
    self.toastLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightMedium];
    self.toastLabel.textAlignment = NSTextAlignmentCenter;
    self.toastLabel.numberOfLines = 0;
    [self.toastView addSubview:self.toastLabel];
}

// Helper methods for creating UI components
- (UIView *)createGroupViewWithTitle:(NSString *)title {
    UIView *groupView = [[UIView alloc] init];
    groupView.translatesAutoresizingMaskIntoConstraints = NO;
    groupView.layer.cornerRadius = 12;
    groupView.layer.borderWidth = 1;
    groupView.layer.borderColor = [[UIColor systemGray4Color] CGColor];
    groupView.backgroundColor = [UIColor systemBackgroundColor];
    return groupView;
}

- (UIStackView *)createStatusRowWithTitle:(NSString *)title {
    UIStackView *stackView = [[UIStackView alloc] init];
    stackView.translatesAutoresizingMaskIntoConstraints = NO;
    stackView.axis = UILayoutConstraintAxisHorizontal;
    stackView.spacing = 8;
    stackView.alignment = UIStackViewAlignmentCenter;
    
    UILabel *titleLabel = [[UILabel alloc] init];
    titleLabel.text = title;
    titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightMedium];
    [stackView addArrangedSubview:titleLabel];
    
    UILabel *valueLabel = [[UILabel alloc] init];
    valueLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightMedium];
    valueLabel.textAlignment = NSTextAlignmentRight;
    [stackView addArrangedSubview:valueLabel];
    [titleLabel setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
    
    return stackView;
}

- (UIView *)createStatusIndicator {
    UIView *indicator = [[UIView alloc] init];
    indicator.translatesAutoresizingMaskIntoConstraints = NO;
    indicator.layer.cornerRadius = 4;
    [NSLayoutConstraint activateConstraints:@[
        [indicator.widthAnchor constraintEqualToConstant:8],
        [indicator.heightAnchor constraintEqualToConstant:8]
    ]];
    return indicator;
}

- (UILabel *)createInfoLabelWithText:(NSString *)text {
    UILabel *label = [[UILabel alloc] init];
    label.translatesAutoresizingMaskIntoConstraints = NO;
    label.text = text;
    label.font = [UIFont systemFontOfSize:14];
    label.numberOfLines = 0;
    return label;
}

- (UIButton *)createButtonWithTitle:(NSString *)title color:(UIColor *)color action:(SEL)action {
    UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
    button.translatesAutoresizingMaskIntoConstraints = NO;
    [button setTitle:title forState:UIControlStateNormal];
    [button setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    button.backgroundColor = color;
    button.layer.cornerRadius = 8;
    button.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightMedium];
    [button addTarget:self action:action forControlEvents:UIControlEventTouchUpInside];
    return button;
}

- (void)setupConstraints {
    CGFloat padding = 16;
    CGFloat sectionSpacing = 20;
    
    // Scroll View
    [NSLayoutConstraint activateConstraints:@[
        [self.scrollView.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor],
        [self.scrollView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [self.scrollView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [self.scrollView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor]
    ]];
    
    // Content View
    [NSLayoutConstraint activateConstraints:@[
        [self.contentView.topAnchor constraintEqualToAnchor:self.scrollView.topAnchor],
        [self.contentView.leadingAnchor constraintEqualToAnchor:self.scrollView.leadingAnchor],
        [self.contentView.trailingAnchor constraintEqualToAnchor:self.scrollView.trailingAnchor],
        [self.contentView.bottomAnchor constraintEqualToAnchor:self.scrollView.bottomAnchor],
        [self.contentView.widthAnchor constraintEqualToAnchor:self.scrollView.widthAnchor]
    ]];
    
    // Header Section
    [NSLayoutConstraint activateConstraints:@[
        [self.appIconImageView.topAnchor constraintEqualToAnchor:self.contentView.topAnchor constant:sectionSpacing],
        [self.appIconImageView.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
        [self.appIconImageView.widthAnchor constraintEqualToConstant:64],
        [self.appIconImageView.heightAnchor constraintEqualToConstant:64],
        
        [self.titleLabel.topAnchor constraintEqualToAnchor:self.appIconImageView.bottomAnchor constant:8],
        [self.titleLabel.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
        [self.titleLabel.leadingAnchor constraintGreaterThanOrEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.titleLabel.trailingAnchor constraintLessThanOrEqualToAnchor:self.contentView.trailingAnchor constant:-padding],
        
        [self.versionLabel.topAnchor constraintEqualToAnchor:self.titleLabel.bottomAnchor constant:4],
        [self.versionLabel.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
        [self.versionLabel.leadingAnchor constraintGreaterThanOrEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.versionLabel.trailingAnchor constraintLessThanOrEqualToAnchor:self.contentView.trailingAnchor constant:-padding]
    ]];
    
    // SDK Status Section
    [NSLayoutConstraint activateConstraints:@[
        [self.sdkStatusView.topAnchor constraintEqualToAnchor:self.versionLabel.bottomAnchor constant:sectionSpacing],
        [self.sdkStatusView.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.sdkStatusView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-padding]
    ]];
    
    // Setup SDK Status internal constraints
    [self setupSDKStatusConstraints];
    
    // Device Info Section
    [NSLayoutConstraint activateConstraints:@[
        [self.deviceInfoView.topAnchor constraintEqualToAnchor:self.sdkStatusView.bottomAnchor constant:sectionSpacing],
        [self.deviceInfoView.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.deviceInfoView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-padding]
    ]];
    
    // Setup Device Info internal constraints
    [self setupDeviceInfoConstraints];
    
    // Action Buttons
    [NSLayoutConstraint activateConstraints:@[
        [self.registerButton.topAnchor constraintEqualToAnchor:self.deviceInfoView.bottomAnchor constant:sectionSpacing],
        [self.registerButton.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.registerButton.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-padding],
        [self.registerButton.heightAnchor constraintEqualToConstant:44],
        
        [self.updateDeviceButton.topAnchor constraintEqualToAnchor:self.registerButton.bottomAnchor constant:12],
        [self.updateDeviceButton.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.updateDeviceButton.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-padding],
        [self.updateDeviceButton.heightAnchor constraintEqualToConstant:38],
        
        [self.checkPermissionButton.topAnchor constraintEqualToAnchor:self.updateDeviceButton.bottomAnchor constant:12],
        [self.checkPermissionButton.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.checkPermissionButton.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-padding],
        [self.checkPermissionButton.heightAnchor constraintEqualToConstant:38],
        
        [self.openSettingsButton.topAnchor constraintEqualToAnchor:self.checkPermissionButton.bottomAnchor constant:12],
        [self.openSettingsButton.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.openSettingsButton.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-padding],
        [self.openSettingsButton.heightAnchor constraintEqualToConstant:38]
    ]];
    
    // Register Activity Indicator
    [NSLayoutConstraint activateConstraints:@[
        [self.registerActivityIndicator.centerXAnchor constraintEqualToAnchor:self.registerButton.centerXAnchor],
        [self.registerActivityIndicator.centerYAnchor constraintEqualToAnchor:self.registerButton.centerYAnchor]
    ]];
    
    // Notifications Section
    [NSLayoutConstraint activateConstraints:@[
        [self.notificationsView.topAnchor constraintEqualToAnchor:self.openSettingsButton.bottomAnchor constant:sectionSpacing],
        [self.notificationsView.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:padding],
        [self.notificationsView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-padding],
        [self.notificationsView.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor constant:-sectionSpacing]
    ]];
    
    // Setup Notifications internal constraints
    [self setupNotificationsConstraints];
    
    // Toast View
    self.toastBottomConstraint = [self.toastView.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:50];
    [NSLayoutConstraint activateConstraints:@[
        [self.toastView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
        [self.toastView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20],
        self.toastBottomConstraint,
        
        [self.toastLabel.leadingAnchor constraintEqualToAnchor:self.toastView.leadingAnchor constant:16],
        [self.toastLabel.trailingAnchor constraintEqualToAnchor:self.toastView.trailingAnchor constant:-16],
        [self.toastLabel.topAnchor constraintEqualToAnchor:self.toastView.topAnchor constant:12],
        [self.toastLabel.bottomAnchor constraintEqualToAnchor:self.toastView.bottomAnchor constant:-12]
    ]];
}

- (void)setupSDKStatusConstraints {
    UIStackView *sdkStatusStack = (UIStackView *)self.sdkStatusView.subviews[0];
    UIStackView *permissionStack = (UIStackView *)self.sdkStatusView.subviews[1];
    
    [NSLayoutConstraint activateConstraints:@[
        [sdkStatusStack.topAnchor constraintEqualToAnchor:self.sdkStatusView.topAnchor constant:16],
        [sdkStatusStack.leadingAnchor constraintEqualToAnchor:self.sdkStatusView.leadingAnchor constant:16],
        [sdkStatusStack.trailingAnchor constraintEqualToAnchor:self.sdkStatusView.trailingAnchor constant:-16],
        
        [permissionStack.topAnchor constraintEqualToAnchor:sdkStatusStack.bottomAnchor constant:12],
        [permissionStack.leadingAnchor constraintEqualToAnchor:self.sdkStatusView.leadingAnchor constant:16],
        [permissionStack.trailingAnchor constraintEqualToAnchor:self.sdkStatusView.trailingAnchor constant:-16],
        
        [self.errorLabel.topAnchor constraintEqualToAnchor:permissionStack.bottomAnchor constant:8],
        [self.errorLabel.leadingAnchor constraintEqualToAnchor:self.sdkStatusView.leadingAnchor constant:16],
        [self.errorLabel.trailingAnchor constraintEqualToAnchor:self.sdkStatusView.trailingAnchor constant:-16],
        
        [self.updateLabel.topAnchor constraintEqualToAnchor:self.errorLabel.bottomAnchor constant:4],
        [self.updateLabel.leadingAnchor constraintEqualToAnchor:self.sdkStatusView.leadingAnchor constant:16],
        [self.updateLabel.trailingAnchor constraintEqualToAnchor:self.updateActivityIndicator.leadingAnchor constant:-8],
        [self.updateLabel.bottomAnchor constraintEqualToAnchor:self.sdkStatusView.bottomAnchor constant:-16],
        
        [self.updateActivityIndicator.centerYAnchor constraintEqualToAnchor:self.updateLabel.centerYAnchor],
        [self.updateActivityIndicator.trailingAnchor constraintEqualToAnchor:self.sdkStatusView.trailingAnchor constant:-16]
    ]];
}

- (void)setupDeviceInfoConstraints {
    [NSLayoutConstraint activateConstraints:@[
        [self.deviceTokenLabel.topAnchor constraintEqualToAnchor:self.deviceInfoView.topAnchor constant:16],
        [self.deviceTokenLabel.leadingAnchor constraintEqualToAnchor:self.deviceInfoView.leadingAnchor constant:16],
        [self.deviceTokenLabel.trailingAnchor constraintEqualToAnchor:self.deviceInfoView.trailingAnchor constant:-16],
        
        [self.deviceIdLabel.topAnchor constraintEqualToAnchor:self.deviceTokenLabel.bottomAnchor constant:8],
        [self.deviceIdLabel.leadingAnchor constraintEqualToAnchor:self.deviceInfoView.leadingAnchor constant:16],
        [self.deviceIdLabel.trailingAnchor constraintEqualToAnchor:self.deviceInfoView.trailingAnchor constant:-16],
        
        [self.deviceModelLabel.topAnchor constraintEqualToAnchor:self.deviceIdLabel.bottomAnchor constant:8],
        [self.deviceModelLabel.leadingAnchor constraintEqualToAnchor:self.deviceInfoView.leadingAnchor constant:16],
        [self.deviceModelLabel.trailingAnchor constraintEqualToAnchor:self.deviceInfoView.trailingAnchor constant:-16],
        
        [self.systemVersionLabel.topAnchor constraintEqualToAnchor:self.deviceModelLabel.bottomAnchor constant:8],
        [self.systemVersionLabel.leadingAnchor constraintEqualToAnchor:self.deviceInfoView.leadingAnchor constant:16],
        [self.systemVersionLabel.trailingAnchor constraintEqualToAnchor:self.deviceInfoView.trailingAnchor constant:-16],
        [self.systemVersionLabel.bottomAnchor constraintEqualToAnchor:self.deviceInfoView.bottomAnchor constant:-16]
    ]];
}

- (void)setupNotificationsConstraints {
    [NSLayoutConstraint activateConstraints:@[
        [self.notificationsCountLabel.topAnchor constraintEqualToAnchor:self.notificationsView.topAnchor constant:16],
        [self.notificationsCountLabel.leadingAnchor constraintEqualToAnchor:self.notificationsView.leadingAnchor constant:16],
        [self.notificationsCountLabel.trailingAnchor constraintEqualToAnchor:self.notificationsView.trailingAnchor constant:-16],
        
        [self.notificationsTableView.topAnchor constraintEqualToAnchor:self.notificationsCountLabel.bottomAnchor constant:12],
        [self.notificationsTableView.leadingAnchor constraintEqualToAnchor:self.notificationsView.leadingAnchor constant:16],
        [self.notificationsTableView.trailingAnchor constraintEqualToAnchor:self.notificationsView.trailingAnchor constant:-16],
        [self.notificationsTableView.heightAnchor constraintEqualToConstant:200],
        
        [self.noNotificationsView.topAnchor constraintEqualToAnchor:self.notificationsCountLabel.bottomAnchor constant:12],
        [self.noNotificationsView.leadingAnchor constraintEqualToAnchor:self.notificationsView.leadingAnchor constant:16],
        [self.noNotificationsView.trailingAnchor constraintEqualToAnchor:self.notificationsView.trailingAnchor constant:-16],
        [self.noNotificationsView.heightAnchor constraintEqualToConstant:100],
        
        [self.clearNotificationsButton.topAnchor constraintEqualToAnchor:self.notificationsTableView.bottomAnchor constant:12],
        [self.clearNotificationsButton.leadingAnchor constraintEqualToAnchor:self.notificationsView.leadingAnchor constant:16],
        [self.clearNotificationsButton.trailingAnchor constraintEqualToAnchor:self.notificationsView.trailingAnchor constant:-16],
        [self.clearNotificationsButton.heightAnchor constraintEqualToConstant:32],
        [self.clearNotificationsButton.bottomAnchor constraintEqualToAnchor:self.notificationsView.bottomAnchor constant:-16]
    ]];
}

- (void)setupPushManager {
    self.pushManager = [PushNotificationManager shared];
    
    __weak typeof(self) weakSelf = self;
    self.pushManager.statusUpdateCallback = ^{
        dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf updateUI];
        });
    };
}

#pragma mark - UI Update Methods

- (void)updateUI {
    [self updateSDKStatusSection];
    [self updateDeviceInfoSection];
    [self updateActionButtons];
    [self updateNotificationsSection];
}

- (void)updateSDKStatusSection {
    // SDK Status
    self.sdkStatusLabel.text = [self.pushManager displayTextForSDKStatus:self.pushManager.sdkStatus];
    self.sdkStatusIndicator.backgroundColor = [self colorForStatusName:[self.pushManager colorNameForSDKStatus:self.pushManager.sdkStatus]];
    
    // Permission Status
    self.permissionStatusLabel.text = [self.pushManager displayTextForAuthorizationStatus:self.pushManager.pushPermissionStatus];
    self.permissionStatusIndicator.backgroundColor = [self colorForStatusName:[self.pushManager colorNameForAuthorizationStatus:self.pushManager.pushPermissionStatus]];
    
    // Error
    if (self.pushManager.lastError) {
        self.errorLabel.text = self.pushManager.lastError;
        self.errorLabel.hidden = NO;
    } else {
        self.errorLabel.hidden = YES;
    }
    
    // Update message
    if (self.pushManager.updateMessage) {
        self.updateLabel.text = self.pushManager.updateMessage;
        self.updateLabel.hidden = NO;
        
        if (self.pushManager.isUpdatingDevice) {
            [self.updateActivityIndicator startAnimating];
        } else {
            [self.updateActivityIndicator stopAnimating];
        }
    } else {
        self.updateLabel.hidden = YES;
        [self.updateActivityIndicator stopAnimating];
    }
}

- (void)updateDeviceInfoSection {
    self.deviceTokenLabel.text = self.pushManager.deviceToken ?: @"设备 Token: 未获取";
    self.deviceIdLabel.text = self.pushManager.deviceId ? [NSString stringWithFormat:@"设备 ID: %@", self.pushManager.deviceId] : @"设备 ID: 未获取";
}

- (void)updateActionButtons {
    // Register button
    if (self.pushManager.isLoading) {
        [self.registerActivityIndicator startAnimating];
        self.registerButton.enabled = NO;
    } else {
        [self.registerActivityIndicator stopAnimating];
        self.registerButton.enabled = YES;
    }
    
    // Update device button
    if (self.pushManager.isUpdatingDevice) {
        [self.updateDeviceButton setTitle:@"更新中..." forState:UIControlStateNormal];
        self.updateDeviceButton.enabled = NO;
    } else {
        [self.updateDeviceButton setTitle:@"更新设备信息" forState:UIControlStateNormal];
        self.updateDeviceButton.enabled = YES;
    }
    
    // Settings button (show only if permission denied)
    self.openSettingsButton.hidden = (self.pushManager.pushPermissionStatus != UNAuthorizationStatusDenied);
}

- (void)updateNotificationsSection {
    NSUInteger count = self.pushManager.notifications.count;
    self.notificationsCountLabel.text = [NSString stringWithFormat:@"通知历史 (%lu)", (unsigned long)count];
    
    if (count == 0) {
        self.notificationsTableView.hidden = YES;
        self.noNotificationsView.hidden = NO;
        self.clearNotificationsButton.hidden = YES;
    } else {
        self.notificationsTableView.hidden = NO;
        self.noNotificationsView.hidden = YES;
        self.clearNotificationsButton.hidden = NO;
        [self.notificationsTableView reloadData];
    }
}

#pragma mark - Helper Methods

- (UIColor *)colorForStatusName:(NSString *)colorName {
    if ([colorName isEqualToString:@"red"]) {
        return [UIColor systemRedColor];
    } else if ([colorName isEqualToString:@"orange"]) {
        return [UIColor systemOrangeColor];
    } else if ([colorName isEqualToString:@"green"]) {
        return [UIColor systemGreenColor];
    } else {
        return [UIColor systemGrayColor];
    }
}

#pragma mark - Action Methods

- (IBAction)registerButtonTapped:(id)sender {
    [self.pushManager registerForPushNotifications];
}

- (IBAction)updateDeviceButtonTapped:(id)sender {
    [self.pushManager updateDeviceInfo];
}

- (IBAction)checkPermissionButtonTapped:(id)sender {
    [self checkPermissionWithToast];
}

- (IBAction)openSettingsButtonTapped:(id)sender {
    [self openSettings];
}

- (IBAction)clearNotificationsButtonTapped:(id)sender {
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"清空通知历史" 
                                                                   message:@"确定要清空所有通知历史吗？此操作不可撤销。" 
                                                            preferredStyle:UIAlertControllerStyleAlert];
    
    UIAlertAction *cancelAction = [UIAlertAction actionWithTitle:@"取消" style:UIAlertActionStyleCancel handler:nil];
    UIAlertAction *clearAction = [UIAlertAction actionWithTitle:@"清空" style:UIAlertActionStyleDestructive handler:^(UIAlertAction * _Nonnull action) {
        [self.pushManager clearNotifications];
        [self showToast:@"通知历史已清空"];
    }];
    
    [alert addAction:cancelAction];
    [alert addAction:clearAction];
    [self presentViewController:alert animated:YES completion:nil];
}

- (void)showSettings {
    SettingsViewController *settingsVC = [[SettingsViewController alloc] init];
    settingsVC.pushManager = self.pushManager;
    UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:settingsVC];
    [self presentViewController:navController animated:YES completion:nil];
}

- (void)checkPermissionWithToast {
    UNAuthorizationStatus currentStatus = self.pushManager.pushPermissionStatus;
    
    if (currentStatus == UNAuthorizationStatusAuthorized) {
        [self showToast:@"推送权限已经开启，无需重复检查"];
    } else {
        [self.pushManager checkPermissionStatus];
        [self showToast:@"正在检查推送权限状态..."];
    }
}

- (void)openSettings {
    NSURL *settingsURL = [NSURL URLWithString:UIApplicationOpenSettingsURLString];
    if (settingsURL && [[UIApplication sharedApplication] canOpenURL:settingsURL]) {
        [[UIApplication sharedApplication] openURL:settingsURL options:@{} completionHandler:nil];
    }
}

- (void)refreshData:(UIRefreshControl *)refreshControl {
    [self.pushManager checkPermissionStatus];
    
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [refreshControl endRefreshing];
    });
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

#pragma mark - UITableViewDataSource

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    return MIN(self.pushManager.notifications.count, 5); // Show max 5 notifications
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    static NSString *cellIdentifier = @"NotificationCell";
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:cellIdentifier];
    
    if (!cell) {
        cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleSubtitle reuseIdentifier:cellIdentifier];
        cell.accessoryType = UITableViewCellAccessoryDisclosureIndicator;
    }
    
    NotificationInfo *notification = self.pushManager.notifications[indexPath.row];
    
    cell.textLabel.text = notification.title ?: @"推送通知";
    cell.detailTextLabel.text = notification.content;
    cell.detailTextLabel.numberOfLines = 2;
    
    return cell;
}

#pragma mark - UITableViewDelegate

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
    [tableView deselectRowAtIndexPath:indexPath animated:YES];
    
    NotificationInfo *notification = self.pushManager.notifications[indexPath.row];
    NotificationDetailViewController *detailVC = [[NotificationDetailViewController alloc] init];
    detailVC.notification = notification;
    
    UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:detailVC];
    [self presentViewController:navController animated:YES completion:nil];
}

- (NSString *)tableView:(UITableView *)tableView titleForFooterInSection:(NSInteger)section {
    if (self.pushManager.notifications.count > 5) {
        return @"查看更多...";
    }
    return nil;
}

@end
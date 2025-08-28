package xiaomi

// 小米推送常量定义
const (
	// API 地址常量
	URLPush = "https://api.xmpush.xiaomi.com/v3/message/regid"

	// 响应状态常量
	ResultOK    = "ok"    // 成功响应
	ResultError = "error" // 错误响应
	SuccessCode = 0       // 成功状态码

	// 消息类型常量
	PassThroughNotification = "0" // 通知栏消息
	PassThroughMessage      = "1" // 透传消息

	// 通知效果常量
	NotifyEffectDefault  = "1" // 打开应用
	NotifyEffectActivity = "2" // 打开指定Activity
	NotifyEffectWebPage  = "3" // 打开网页
	NotifyEffectDeepLink = "4" // 打开深度链接

	// 时间常量 (毫秒)
	TTLOneHour = "3600000"   // 1小时
	TTLOneDay  = "86400000"  // 1天
	TTLOneWeek = "604800000" // 1周
	TTLDefault = TTLOneDay   // 默认TTL

	// 错误码常量
	ErrorCodeSuccess          = 0     // 成功
	ErrorCodeMessageStructure = 40001 // 消息结构错误
	ErrorCodeMessageTooLong   = 40002 // 消息内容过长
	ErrorCodeInvalidRegID     = 40003 // 无效的注册ID
	ErrorCodeAppNotRegistered = 40004 // 应用未注册
	ErrorCodeAppDisabled      = 40005 // 应用已禁用
	ErrorCodeServerInternal   = 50001 // 服务器内部错误
	ErrorCodeServerBusy       = 50002 // 服务器忙碌
)

// ErrorMessage 错误消息映射
var ErrorMessage = map[int]string{
	ErrorCodeSuccess:          "成功",
	ErrorCodeMessageStructure: "消息结构错误",
	ErrorCodeMessageTooLong:   "消息内容过长",
	ErrorCodeInvalidRegID:     "无效的注册ID",
	ErrorCodeAppNotRegistered: "应用未注册",
	ErrorCodeAppDisabled:      "应用已禁用",
	ErrorCodeServerInternal:   "服务器内部错误",
	ErrorCodeServerBusy:       "服务器忙碌",
}

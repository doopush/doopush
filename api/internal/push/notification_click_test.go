package push

import (
	"encoding/json"
	"net/url"
	"strings"
	"testing"

	"github.com/doopush/doopush/api/internal/models"
)

func TestBuildHuaweiMessageClickIntentAndBadge(t *testing.T) {
	provider := &AndroidProvider{}
	device := &models.Device{
		Token:         "hms-token",
		LauncherClass: "com.example.app.WelcomeActivity",
		App:           models.App{PackageName: "com.example.app"},
	}
	pushLog := &models.PushLog{
		Title:   "标题",
		Content: "内容",
		Badge:   120,
		Payload: `{"data":"{\"dialog_id\":11827,\"msg_id\":\"9 a;b\"}","huawei":{"importance":"NORMAL"},"oppo":{"category":"IM"}}`,
	}
	pushLog.ID = 42

	notification := provider.buildHuaweiMessage(device, pushLog).Message.Android.Notification
	intent := notification.ClickAction.Intent
	if notification.ClickAction.Type != 1 || notification.ClickAction.Action != "" {
		t.Fatalf("unexpected click action: %+v", notification.ClickAction)
	}
	for _, part := range []string{
		"intent://com.example.app/notification/click#Intent;scheme=doopush;action=android.intent.action.VIEW;",
		"component=com.example.app/com.doopush.sdk.DooPushNotificationClickActivity;",
		"B.doopush_notification_clicked=true;",
		"S.push_log_id=42;",
		"S.push_data_push_log_id=42;",
		"S.push_data_dp_source=doopush;",
	} {
		if !strings.Contains(intent, part) {
			t.Fatalf("intent missing %q: %s", part, intent)
		}
	}
	if strings.Contains(intent, "oppo") || strings.Contains(intent, "huawei") {
		t.Fatalf("vendor options must not be forwarded: %s", intent)
	}
	if !strings.HasSuffix(intent, ";end") {
		t.Fatalf("intent must end with ;end: %s", intent)
	}
	// 值按 Uri.encode 转义，Uri.decode（等价 url.PathUnescape）可还原
	for _, field := range strings.Split(intent, ";") {
		if strings.HasPrefix(field, "S.push_data_data=") {
			value, err := url.PathUnescape(strings.TrimPrefix(field, "S.push_data_data="))
			if err != nil || value != `{"dialog_id":11827,"msg_id":"9 a;b"}` {
				t.Fatalf("unexpected data extra %q (%v)", value, err)
			}
		}
	}

	if notification.Badge == nil || notification.Badge.SetNum == nil || *notification.Badge.SetNum != 99 ||
		notification.Badge.Class != "com.example.app.WelcomeActivity" {
		t.Fatalf("unexpected badge: %+v", notification.Badge)
	}
}

func TestBuildHuaweiMessageLegacySDK(t *testing.T) {
	provider := &AndroidProvider{}
	device := &models.Device{Token: "hms-token", App: models.App{PackageName: "com.example.app"}}
	pushLog := &models.PushLog{Title: "标题", Content: "内容", Badge: 0}

	notification := provider.buildHuaweiMessage(device, pushLog).Message.Android.Notification
	if notification.ClickAction.Intent != "" || notification.ClickAction.Action != "Action" {
		t.Fatalf("legacy SDK should keep default action: %+v", notification.ClickAction)
	}
	if notification.Badge != nil {
		t.Fatalf("badge requires launcher class: %+v", notification.Badge)
	}
}

func clickTestDevice(launcherClass string) *models.Device {
	return &models.Device{
		Token:         "vendor-token",
		LauncherClass: launcherClass,
		App:           models.App{PackageName: "com.example.app"},
	}
}

func clickTestPushLog() *models.PushLog {
	pushLog := &models.PushLog{Title: "标题", Content: "内容", Badge: 0, Payload: `{"data":"{\"dialog_id\":11827}"}`}
	pushLog.ID = 42
	return pushLog
}

func assertClickIntent(t *testing.T, vendor, intent string) {
	t.Helper()
	for _, part := range []string{
		"component=com.example.app/" + notificationClickActivity + ";",
		"B.doopush_notification_clicked=true;",
		"S.push_log_id=42;",
	} {
		if !strings.Contains(intent, part) {
			t.Fatalf("%s intent missing %q: %s", vendor, part, intent)
		}
	}
}

func TestBuildHonorMessageClickIntentAndBadge(t *testing.T) {
	provider := &AndroidProvider{}
	notification := provider.buildHonorMessage(clickTestDevice("com.example.app.WelcomeActivity"), clickTestPushLog()).Android.Notification
	if notification.ClickAction.Type != 1 {
		t.Fatalf("unexpected click action: %+v", notification.ClickAction)
	}
	assertClickIntent(t, "honor", notification.ClickAction.Intent)
	// 角标 0 也要下发（清零）
	if notification.Badge == nil || notification.Badge.SetNum == nil || *notification.Badge.SetNum != 0 ||
		notification.Badge.BadgeClass != "com.example.app.WelcomeActivity" {
		t.Fatalf("unexpected badge: %+v", notification.Badge)
	}

	legacy := provider.buildHonorMessage(clickTestDevice(""), clickTestPushLog()).Android.Notification
	if legacy.ClickAction.Type != 3 || legacy.ClickAction.Intent != "" || legacy.Badge != nil {
		t.Fatalf("legacy SDK should only open app without badge: %+v %+v", legacy.ClickAction, legacy.Badge)
	}
}

func TestBuildXiaomiMessageClickIntent(t *testing.T) {
	provider := &AndroidProvider{}
	message := provider.buildXiaomiMessage(clickTestDevice("com.example.app.WelcomeActivity"), clickTestPushLog())
	if message.Extra["notify_effect"] != "2" {
		t.Fatalf("unexpected notify_effect: %v", message.Extra["notify_effect"])
	}
	assertClickIntent(t, "xiaomi", message.Extra["intent_uri"].(string))
	if strings.Contains(message.Payload, "intent_uri") {
		t.Fatalf("intent_uri must not be in payload: %s", message.Payload)
	}

	legacy := provider.buildXiaomiMessage(clickTestDevice(""), clickTestPushLog())
	if _, ok := legacy.Extra["notify_effect"]; ok {
		t.Fatalf("legacy SDK should keep default click: %+v", legacy.Extra)
	}

	custom := clickTestPushLog()
	custom.Payload = `{"notify_effect":"1"}`
	if got := provider.buildXiaomiMessage(clickTestDevice("com.example.app.WelcomeActivity"), custom).Extra; got["notify_effect"] != "1" || got["intent_uri"] != nil {
		t.Fatalf("payload notify_effect must win: %+v", got)
	}
}

func TestBuildOppoMessageClickIntent(t *testing.T) {
	provider := &AndroidProvider{}
	notification := provider.buildOppoMessage(clickTestDevice("com.example.app.WelcomeActivity"), clickTestPushLog()).Notification
	if notification.ClickActionType != 5 || notification.ClickActionUrl != "doopush://com.example.app/notification/click" {
		t.Fatalf("unexpected click action: %d %s", notification.ClickActionType, notification.ClickActionUrl)
	}
	var params map[string]string
	if err := json.Unmarshal([]byte(notification.ActionParameters), &params); err != nil {
		t.Fatalf("action_parameters must be string map: %v %s", err, notification.ActionParameters)
	}
	if params["doopush_notification_clicked"] != "true" || params["push_log_id"] != "42" || params["push_data_data"] != `{"dialog_id":11827}` {
		t.Fatalf("unexpected action_parameters: %s", notification.ActionParameters)
	}

	legacy := provider.buildOppoMessage(clickTestDevice(""), clickTestPushLog()).Notification
	if legacy.ClickActionType != 0 || legacy.ClickActionUrl != "" || strings.Contains(legacy.ActionParameters, "doopush_notification_clicked") {
		t.Fatalf("legacy SDK should launch app: %+v", legacy)
	}
}

func TestBuildVivoMessageClickIntent(t *testing.T) {
	provider := &AndroidProvider{}
	message := provider.buildVivoMessage(clickTestDevice("com.example.app.WelcomeActivity"), clickTestPushLog())
	if message.SkipType != 4 || message.AddBadge {
		t.Fatalf("unexpected vivo message: skipType=%d addBadge=%v", message.SkipType, message.AddBadge)
	}
	assertClickIntent(t, "vivo", message.SkipContent)

	legacy := provider.buildVivoMessage(clickTestDevice(""), clickTestPushLog())
	if legacy.SkipType != 1 || legacy.SkipContent != "" {
		t.Fatalf("legacy SDK should open app: %d %q", legacy.SkipType, legacy.SkipContent)
	}

	custom := clickTestPushLog()
	custom.Payload = `{"vivo":{"skip_type":2,"skip_content":"https://example.com","add_badge":true}}`
	if got := provider.buildVivoMessage(clickTestDevice("com.example.app.WelcomeActivity"), custom); got.SkipType != 2 || got.SkipContent != "https://example.com" || !got.AddBadge {
		t.Fatalf("payload vivo options must win: %+v", got)
	}

	long := clickTestPushLog()
	long.Payload = `{"data":"` + strings.Repeat("x", notificationClickMaxLen) + `"}`
	if got := provider.buildVivoMessage(clickTestDevice("com.example.app.WelcomeActivity"), long); got.SkipType != 4 ||
		len(got.SkipContent) > notificationClickMaxLen || strings.Contains(got.SkipContent, "push_data_data") {
		t.Fatalf("over-long intent should keep essential extras only: %d %q", got.SkipType, got.SkipContent)
	}
}

func TestNotificationClickIntentLengthLimit(t *testing.T) {
	device := clickTestDevice("com.example.app.WelcomeActivity")
	long := map[string]interface{}{
		"push_log_id": uint(42),
		"dedup_key":   "dk",
		"dp_source":   "doopush",
		"data":        strings.Repeat("x", notificationClickMaxLen),
	}
	intent := notificationClickIntent(device, long)
	if intent == "" || len(intent) > notificationClickMaxLen {
		t.Fatalf("over-long intent should be trimmed: %d", len(intent))
	}
	assertClickIntent(t, "trimmed", intent)
	for _, part := range []string{"S.dedup_key=dk;", "S.push_data_dp_source=doopush;"} {
		if !strings.Contains(intent, part) {
			t.Fatalf("trimmed intent missing %q: %s", part, intent)
		}
	}
	if strings.Contains(intent, "push_data_data") {
		t.Fatalf("trimmed intent must drop custom data: %s", intent)
	}

	// 精简后仍超长（如超长 dedup_key）时放弃中转页，由调用方退回打开应用
	long["dedup_key"] = strings.Repeat("k", notificationClickMaxLen)
	if got := notificationClickIntent(device, long); got != "" {
		t.Fatalf("still over-long intent should be empty: %d", len(got))
	}
}

func TestBuildMeizuMessageClickIntent(t *testing.T) {
	provider := &AndroidProvider{}
	parse := func(device *models.Device, pushLog *models.PushLog) *MeizuMessageBody {
		message, err := provider.buildMeizuMessage(device, pushLog)
		if err != nil {
			t.Fatal(err)
		}
		var body MeizuMessageBody
		if err := json.Unmarshal([]byte(message.MessageJSON), &body); err != nil {
			t.Fatal(err)
		}
		return &body
	}

	body := parse(clickTestDevice("com.example.app.WelcomeActivity"), clickTestPushLog())
	if body.ClickTypeInfo == nil || body.ClickTypeInfo.ClickType != 1 || body.ClickTypeInfo.Activity != notificationClickActivity {
		t.Fatalf("unexpected click info: %+v", body.ClickTypeInfo)
	}
	var params map[string]string
	if err := json.Unmarshal([]byte(body.ClickTypeInfo.Parameters), &params); err != nil {
		t.Fatal(err)
	}
	if params["doopush_notification_clicked"] != "true" || params["push_log_id"] != "42" || params["push_data_data"] != `{"dialog_id":11827}` {
		t.Fatalf("unexpected parameters: %+v", params)
	}

	if legacy := parse(clickTestDevice(""), clickTestPushLog()); legacy.ClickTypeInfo != nil {
		t.Fatalf("legacy SDK should open app: %+v", legacy.ClickTypeInfo)
	}

	// 控制台默认表单值视为未指定
	console := clickTestPushLog()
	console.Payload = `{"meizu":{"click_type":0,"activity":"","url":"","parameters":{},"custom_attribute":""}}`
	if got := parse(clickTestDevice("com.example.app.WelcomeActivity"), console); got.ClickTypeInfo.ClickType != 1 || got.ClickTypeInfo.Activity != notificationClickActivity {
		t.Fatalf("console defaults should use click relay: %+v", got.ClickTypeInfo)
	}

	long := clickTestPushLog()
	long.Payload = `{"data":"` + strings.Repeat("x", notificationClickMaxLen) + `"}`
	trimmed := parse(clickTestDevice("com.example.app.WelcomeActivity"), long)
	if trimmed.ClickTypeInfo == nil || len(trimmed.ClickTypeInfo.Parameters) > notificationClickMaxLen ||
		strings.Contains(trimmed.ClickTypeInfo.Parameters, "push_data_data") ||
		!strings.Contains(trimmed.ClickTypeInfo.Parameters, `"doopush_notification_clicked":"true"`) {
		t.Fatalf("over-long parameters should keep essential extras only: %+v", trimmed.ClickTypeInfo)
	}

	custom := clickTestPushLog()
	custom.Payload = `{"meizu":{"click_type":2,"url":"https://example.com"}}`
	if got := parse(clickTestDevice("com.example.app.WelcomeActivity"), custom); got.ClickTypeInfo.ClickType != 2 || got.ClickTypeInfo.Activity != "" {
		t.Fatalf("payload meizu click must win: %+v", got.ClickTypeInfo)
	}
}

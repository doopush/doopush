package xiaomi

type PushResponseData struct {
	MsgID string `json:"id,omitempty"`
}

type PushResponse struct {
	Result      string            `json:"result"`         // "ok" 表示成功
	Description string            `json:"description"`    // 对发送消息失败原因的解释
	Data        *PushResponseData `json:"data,omitempty"` // 本身就是一个json字符串（其中id字段的值就是消息的Id）
	Code        int               `json:"code"`           // 0表示成功，非0表示失败
	Info        string            `json:"info"`           // 详细信息
}

type PushRequest struct {
	RegID       string `json:"regid"`
	Payload     string `json:"payload"`
	Title       string `json:"title"`
	Description string `json:"description"`
	PackageName string `json:"packageName"`
	IntentURI   string `json:"intentURI"`
}

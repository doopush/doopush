# API 认证

DooPush 将客户端接入和服务端调用分成两类应用凭证，任何凭证都不能跨越自己的权限边界。

| 凭证 | 使用位置 | 用途 |
|---|---|---|
| App ID + App Key | 客户端 SDK | 注册设备、连接 Gateway、上报推送统计 |
| App Secret | 客户服务端 | 根据 Scope 调用服务端 API |

## App Key

创建应用时系统会自动生成唯一、长期稳定的 App Key：

```text
dp_ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

App Key 可以包含在 iOS、Android 或 React Native 应用中。它用于 SDK 设备注册、Gateway 连接和统计上报，不能发送推送或访问服务端管理数据。

```http
POST /api/v1/apps/123/devices
X-App-Key: dp_ak_xxx
Content-Type: application/json

{
  "token": "provider_push_token",
  "bundle_id": "com.example.app",
  "platform": "android",
  "channel": "fcm",
  "push_environment": "production"
}
```

SDK 会自动管理设备 token，并在 token 或设备信息变化时重新注册。

## App Secret

App Secret 必须由应用所有者在控制台按需创建，一个应用可以创建多个。完整 Secret 只展示一次：

```text
dp_as_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

服务端通过 Bearer Header 调用 API：

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
  -H "Authorization: Bearer dp_as_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "订单状态更新",
    "content": "您的订单已发货",
    "target": { "type": "devices", "device_ids": [1] }
  }'
```

App Secret 不得包含在客户端应用、Web 前端、公开仓库或 URL Query 参数中。

## Scope

| Scope | 能力 |
|---|---|
| `push:send` | 发送指定设备、用户、标签或分组推送 |
| `push:broadcast` | 向全部设备发送广播，必须同时具备 `push:send` |
| `push:schedule` | 通过推送接口创建定时发送，必须同时具备 `push:send` |

权限不足返回 `403 Forbidden`，错误消息会指出缺少的 Scope。

当前 App Secret 只开放推送发送接口。设备、模板、统计和控制台管理接口仍仅接受用户 JWT；后续开放时会新增对应 Scope，并保持服务身份与用户权限完全分离。

## 安全建议

- 每个后端服务创建独立 App Secret。
- 只授予完成工作所需的最小 Scope。
- 为生产 Secret 设置过期时间并定期轮换。
- 广播权限单独授权，不要默认授予。
- 泄露后立即撤销对应 Secret，不需要修改 App Key。
- 生产与测试应用使用不同凭证。

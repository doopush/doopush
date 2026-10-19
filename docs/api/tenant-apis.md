# 租户接口

租户（共享通道）让多个接入方共享同一个客户端应用的推送能力，而无需把 App Secret 交给任何一方。典型场景：同一个官方 App 可以登录到许多私有部署的业务服务器，每台服务器注册为一个租户，只能向登录过自己的设备推送。

## 工作方式

1. 应用 Owner 在控制台「推送配置 → 租户」打开 **允许租户自助注册**。
2. 接入方服务器用客户端 App Key 注册租户，获得仅展示一次的租户密钥（`dp_ts_` 前缀），自行保存。
3. 客户端 SDK 照常注册设备，并把 **设备推送 Token** 上报给接入方服务器（例如登录后上报）。
4. 接入方服务器用租户密钥按 Token 绑定设备，拿到 DooPush 设备 ID。能提交 Token 即证明该设备登录过这台服务器。
5. 接入方服务器用租户密钥向已绑定的设备推送。

**安全边界**：

- 租户密钥只能调用本页的租户接口，不能调用普通服务端 API（推送、广播、定时等）。
- 一台设备同一时间只属于一个租户，后绑定的覆盖先绑定的：用户换了服务器，旧服务器随即无法再向该设备推送。
- 推送时不属于当前租户的设备会被忽略。
- 每个租户受每日推送上限约束（应用默认值，可在控制台按租户单独设置）。

## 接口概览

| 接口 | 描述 | 认证 |
|------|------|------|
| `POST /apps/{appId}/tenants` | 注册租户 | App Key |
| `POST /apps/{appId}/tenant/devices` | 按 Token 绑定设备 | 租户密钥 |
| `DELETE /apps/{appId}/tenant/devices/{deviceId}` | 解绑设备 | 租户密钥 |
| `POST /apps/{appId}/tenant/push` | 向本租户设备推送 | 租户密钥 |

Base URL：`https://doopush.com/api/v1`

## 注册租户

```http
POST /apps/{appId}/tenants
X-App-Key: dp_ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "name": "DooTask",
  "site_url": "https://dootask.example.com"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 租户名称，最长 100，仅用于控制台识别 |
| `site_url` | string | 否 | 站点地址，最长 255，仅用于控制台识别 |

**响应**（201）：

```json
{
  "code": 201,
  "message": "租户注册成功",
  "data": {
    "tenant_id": 123,
    "tenant_secret": "dp_ts_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

`tenant_secret` 仅返回这一次，DooPush 只保存其摘要。丢失后重新注册即可（会成为新租户，设备需重新绑定）。

| 状态码 | 说明 |
|--------|------|
| 401 | App Key 无效 |
| 403 | 应用未开放租户注册 |
| 429 | 同一 IP 24 小时内注册超过 10 个 |

## 绑定设备

```http
POST /apps/{appId}/tenant/devices
Authorization: Bearer dp_ts_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "token": "device_push_token_here"
}
```

`token` 为客户端 SDK 注册时使用的推送 Token（iOS 为 APNs Token，Android 为对应厂商 / FCM Token）。

**响应**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "device_id": 456,
    "platform": "ios",
    "channel": "apns",
    "push_environment": "production"
  }
}
```

推送时使用返回的 `device_id`，不要信任客户端自报的设备 ID。设备未在 DooPush 注册时返回 404，可稍后重试（例如客户端刚完成注册）。

## 解绑设备

```http
DELETE /apps/{appId}/tenant/devices/{deviceId}
Authorization: Bearer dp_ts_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

用于用户退出登录。设备不属于当前租户时同样返回成功。

## 推送

```http
POST /apps/{appId}/tenant/push
Authorization: Bearer dp_ts_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "title": "新消息",
  "content": "您有一条新消息",
  "badge": 3,
  "payload": {
    "data": "{\"dialog_id\":\"1\"}"
  },
  "device_ids": [456, 789]
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 标题，最长 200 |
| `content` | string | 是 | 内容 |
| `device_ids` | int[] | 是 | 目标设备 ID，1~100 个 |
| `badge` | int | 否 | 角标数 |
| `payload` | object | 否 | 与 [推送接口](./push-apis.md) 的 `payload` 相同（`action` / `url` / `data` 与厂商参数） |

**响应**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "count": 1,
    "unbound_device_ids": [789]
  }
}
```

- `count`：实际创建的推送条数（在线设备由网关直推、停用设备跳过，不计入）。
- `unbound_device_ids`：不属于当前租户的设备（已被其他租户改绑或从未绑定），接入方应清理本地记录。

| 状态码 | 说明 |
|--------|------|
| 401 | 租户密钥无效或租户已被删除，可重新注册 |
| 403 | 租户已被禁用，**不要**重新注册 |
| 429 | 超出今日推送上限 |

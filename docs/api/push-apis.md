# 推送接口

推送接口支持通用目标、单设备、批量和广播发送。客户服务端使用与应用绑定、带 Scope 的 App Secret；Web 控制台使用用户 JWT。

## 接口概览

| 接口 | 描述 |
|------|------|
| `POST /apps/{appId}/push` | 按设备 ID、标签、分组、平台、通道或 APNs 环境发送 |
| `POST /apps/{appId}/push/single` | 按设备 Token 单推 |
| `POST /apps/{appId}/push/batch` | 按设备 Token 批量发送，最多 1000 个 |
| `POST /apps/{appId}/push/broadcast` | 向匹配平台、厂商或 APNs 环境的设备广播 |

## Base URL 与认证

```text
https://doopush.com/api/v1
```

App Secret 和 JWT 都通过 Bearer Header 传递：

```http
Authorization: Bearer dp_as_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

App Secret 至少需要 `push:send`。广播以及通用接口中的 `target.type=all` 还需要 `push:broadcast`；提供 `schedule_time` 时还需要 `push:schedule`。

## 通用推送

### 请求信息

**接口地址**：`POST /apps/{appId}/push`

```json
{
  "title": "推送标题",
  "content": "推送内容",
  "badge": 1,
  "payload": {
    "action": "open_page",
    "url": "https://example.com/page",
    "data": "{\"page\":\"news\"}"
  },
  "target": {
    "type": "all",
    "platform": "ios",
    "push_environment": "production"
  },
  "schedule_time": "2026-08-12T10:00:00Z"
}
```

### 顶层参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `title` | string | 是 | 标题，最多 200 个字符 |
| `content` | string | 是 | 推送正文 |
| `target` | object | 是 | 目标配置 |
| `badge` | integer | 否 | iOS 角标；省略时服务端按 `1` 处理 |
| `payload` | object | 否 | 自定义载荷和 Android 厂商参数 |
| `schedule_time` | string | 否 | ISO 8601 时间；提供后创建定时任务 |

### 目标参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `type` | string | 必填：`all`、`devices`、`tags` 或 `groups` |
| `device_ids` | array&lt;integer&gt; | `devices.id` 主键数组，仅用于 `type=devices` |
| `tags` | array | 标签条件，仅用于 `type=tags` |
| `group_ids` | array&lt;integer&gt; | 设备分组 ID，仅用于 `type=groups` |
| `platform` | string | `ios` 或 `android` |
| `channel` | string | `apns`、`fcm`、`huawei`、`honor`、`xiaomi`、`oppo`、`vivo` 或 `meizu` |
| `push_environment` | string | `development` 或 `production`，仅用于筛选对应 APNs 环境的 iOS 设备 |

`tags` 中每项包含必填的 `tag_name` 和可选的 `tag_value`。多条标签条件按 OR 并集合并；需要 AND 组合时使用设备分组。

::: tip APNs 环境
iOS SDK 会在设备注册时自动上报 APNs 环境。省略 `target.push_environment` 时可以同时匹配开发和生产设备，实际投递仍会按每台设备保存的环境选择 sandbox 或 production endpoint。
:::

### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "Authorization: Bearer dp_as_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "版本更新",
       "content": "新版本已经发布",
       "target": {
         "type": "tags",
         "tags": [{ "tag_name": "user_level", "tag_value": "vip" }],
         "platform": "ios",
         "push_environment": "production"
       }
     }'
```

## 单设备推送

**接口地址**：`POST /apps/{appId}/push/single`

`device_id` 在该接口中表示设备 Token 字符串，不是数据库主键。

```json
{
  "device_id": "device_token_here",
  "title": "个人消息",
  "content": "您有一条新消息",
  "badge": 1,
  "payload": {
    "action": "open_page",
    "data": "{\"message_id\":123}"
  }
}
```

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `device_id` | string | 是 | 设备 Token |
| `title` | string | 是 | 标题，最多 200 个字符 |
| `content` | string | 是 | 推送正文 |
| `badge` | integer | 否 | 角标 |
| `payload` | object | 否 | 自定义载荷 |

单推不需要传 APNs 环境，服务端使用目标设备注册时保存的 `push_environment`。

## 批量推送

**接口地址**：`POST /apps/{appId}/push/batch`

```json
{
  "device_ids": ["device_token_1", "device_token_2"],
  "title": "批量消息",
  "content": "批量推送内容",
  "badge": 1,
  "payload": { "action": "open_page" }
}
```

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `device_ids` | array&lt;string&gt; | 是 | 设备 Token 数组，1 至 1000 个 |
| `title` | string | 是 | 标题，最多 200 个字符 |
| `content` | string | 是 | 推送正文 |
| `badge` | integer | 否 | 角标 |
| `payload` | object | 否 | 自定义载荷 |

查不到或已禁用的 Token 会被跳过；全部 Token 均无效时请求失败。APNs endpoint 按每台设备保存的环境分别选择。

## 广播推送

**接口地址**：`POST /apps/{appId}/push/broadcast`

```json
{
  "title": "系统公告",
  "content": "系统维护通知",
  "platform": "android",
  "vendor": "huawei",
  "badge": 1,
  "payload": { "action": "open_page" }
}
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `title` | string | 必填，最多 200 个字符 |
| `content` | string | 必填，推送正文 |
| `platform` | string | `ios` 或 `android` |
| `vendor` | string | Android 厂商通道筛选，会映射为目标 `channel` |
| `push_environment` | string | `development` 或 `production`，筛选 iOS 设备 |
| `badge` | integer | 角标 |
| `payload` | object | 自定义载荷 |

`vendor` 当前会实际参与通道筛选。iOS 广播可使用 `platform=ios` 和 `push_environment` 区分开发与生产设备。

## 自定义载荷

### 基础字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `action` | string | 客户端动作标识，如 `open_page` |
| `url` | string | 跳转 URL |
| `data` | string | 自定义数据字符串；复杂数据可传 JSON 字符串 |

### Android 厂商字段

`payload` 可包含以下厂商对象，服务端会保留并交给对应通道处理：

| 字段 | 常用参数 |
|------|----------|
| `huawei` | `importance`、`category` |
| `honor` | `importance`、`ttl`、`target_user_type` |
| `xiaomi` | `pass_through`、`notify_type`、`time_to_live`、`channel_id` |
| `oppo` | `channel_id`、`category`、`notify_level`、`off_line`、`off_line_ttl` |
| `vivo` | `classification`、`notify_type`、`skip_type`、`skip_content`、`network_type`、`time_to_live` |
| `meizu` | `notice_msg_type`、`notice_bar_type`、`click_type`、`off_line`、`valid_time`、回执字段等 |

```json
{
  "action": "open_page",
  "huawei": {
    "importance": "NORMAL",
    "category": "IM"
  },
  "xiaomi": {
    "pass_through": 0,
    "notify_type": 1,
    "time_to_live": 3600000
  },
  "vivo": {
    "classification": 1,
    "notify_type": 1,
    "time_to_live": 3600
  }
}
```

厂商字段和值应遵循对应厂商 API 规范。不同厂商的 TTL 单位并不统一，例如小米使用毫秒、vivo 使用秒。

## 响应与异步投递

立即推送成功时，`data` 返回创建的推送日志数组。接口创建日志后即返回，实际厂商调用在后台执行，日志状态随后从 `pending` 更新为 `sent` 或 `failed`。

```json
{
  "code": 200,
  "message": "成功",
  "data": [
    {
      "id": 12346,
      "app_id": 123,
      "device_id": 5001,
      "title": "个人消息",
      "content": "您有一条新消息",
      "channel": "apns",
      "status": "pending",
      "badge": 1,
      "created_at": "2026-08-11T10:00:00Z"
    }
  ]
}
```

提供 `schedule_time` 时返回创建的定时任务，而不是立即投递结果。定时任务的管理路由属于控制台内部接口。

## 消息回执接口

Android 厂商可向以下无需 App Secret 的路由上报送达或点击回执：

| 厂商 | 路由 |
|------|------|
| 华为 | `POST /api/v1/apps/callback/huawei` |
| 荣耀 | `POST /api/v1/apps/callback/honor` |
| OPPO | `POST /api/v1/apps/callback/oppo` |
| vivo | `POST /api/v1/apps/callback/vivo` |
| 小米 | `POST /api/v1/apps/callback/xiaomi` |
| 魅族 | `POST /api/v1/apps/callback/meizu` |

通用兜底入口为 `POST /api/v1/apps/callback?vendor={vendor}`。华为和荣耀通常在厂商后台配置一次回调地址；OPPO、小米、魅族和 vivo 的回调地址按通道要求写入消息。FCM 的 delivery receipt 依赖 Google Cloud Pub/Sub，当前未实现；APNs 不提供 delivery webhook。

## 错误响应

| HTTP 状态码 | 场景 |
|-------------|------|
| 400 | 请求字段错误、目标设备无效或业务校验失败 |
| 401 | App Secret 缺失、无效或不属于路径中的应用 |
| 403 | App Secret 缺少请求所需的 Scope |
| 422 | 部分业务入口无法找到目标设备时返回不可处理错误 |

```json
{
  "code": 400,
  "message": "没有找到目标设备",
  "data": null
}
```

## 最佳实践

- 服务端安全保存 App Secret，不要将其写入客户端、公开仓库或前端代码。
- 为不同后端服务创建独立 App Secret，并只授予所需的最小 Scope。
- 批量发送控制在 1000 个 Token 以内，更大范围使用标签、分组或广播。
- iOS 目标优先依赖 SDK 上报的 APNs 环境；需要隔离测试流量时显式设置 `push_environment`。
- 业务侧保存返回的日志 ID，以便在控制台查看最终投递状态。
- 使用稳定的 `action` 和 `data` 协议，并保持客户端向后兼容。

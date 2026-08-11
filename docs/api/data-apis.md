# 统计上报接口

统计上报接口供 SDK 上报推送点击和打开事件。推送日志、聚合统计和审计日志等 JWT 查询路由属于 Web 控制台内部接口，不作为公开 API 契约。

## 接口概览

| 接口 | 描述 | 认证 |
|------|------|------|
| `POST /apps/{appId}/push/statistics/report` | 上报点击或打开事件 | App Key |

## Base URL

```text
https://doopush.com/api/v1
```

## 上报推送统计

### 请求信息

**接口地址**：`POST /apps/{appId}/push/statistics/report`

**请求头**：

```http
X-App-Key: dp_ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

App Key 必须属于路径中的应用。`device_token` 也必须是该应用中处于启用状态的设备。

### 请求体

单次请求可上报多个事件，所有事件共用同一个设备 Token。

```json
{
  "device_token": "abc123def456...",
  "statistics": [
    {
      "push_log_id": 12345,
      "event": "click",
      "timestamp": 1786442400
    },
    {
      "dedup_key": "push-12345-device-abc",
      "event": "open",
      "timestamp": 1786442405
    }
  ]
}
```

### 顶层参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `device_token` | string | 是 | 已注册且启用的设备 Token |
| `statistics` | array | 是 | 事件数组，至少 1 条 |

### 事件参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `push_log_id` | integer | 否* | 推送日志 ID |
| `dedup_key` | string | 否* | 推送去重键 |
| `event` | string | 是 | `click` 或 `open` |
| `timestamp` | integer | 是 | 事件发生时间，Unix 秒级时间戳 |

*调用方应至少提供 `push_log_id` 或 `dedup_key` 之一。无法定位到该设备对应推送记录的事件会被跳过。

### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push/statistics/report" \
     -H "X-App-Key: dp_ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "device_token": "abc123def456ghi789...",
       "statistics": [
         { "push_log_id": 12345, "event": "click", "timestamp": 1786442400 }
       ]
     }'
```

### 成功响应

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "message": "统计数据上报成功",
    "count": 1
  }
}
```

`data.count` 是请求中的事件数量，不代表每条事件都成功匹配了推送记录。当前接口对无法匹配的单条事件采用跳过处理。

## 错误响应

| HTTP 状态码 | 场景 |
|-------------|------|
| 400 | 请求格式错误或业务处理失败 |
| 401 | App Key 缺失、无效或不属于路径中的应用 |
| 404 | 设备不存在或已禁用 |

```json
{
  "code": 404,
  "message": "设备不存在",
  "data": null
}
```

## 上报建议

- SDK 应在点击或打开事件发生后尽快上报。
- 使用推送负载中的 `push_log_id` 或 `dedup_key` 关联原始推送。
- 网络失败时可在客户端排队重试，但应避免无上限重试。
- App Key 是客户端公开引导标识，不授予推送发送或服务端数据访问权限；不要用 App Secret 替代它。

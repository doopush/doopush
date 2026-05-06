# 数据查询接口

数据查询接口提供了推送日志、统计数据和审计信息的查询功能，帮助您监控推送效果、分析用户行为和追踪操作记录。

## 📋 接口概览

| 分类 | 接口 | 描述 | 认证 |
|------|------|------|------|
| **推送日志** | [获取推送日志](#获取推送日志) | 查询推送记录列表 | JWT |
| | [获取推送详情](#获取推送详情) | 查询单条推送的详细信息 | JWT |
| **推送统计** | [获取推送统计](#获取推送统计) | 查询推送统计数据 | JWT |
| | [上报推送统计](#上报推送统计) | 客户端上报点击 / 送达事件 | API Key |
| **审计日志** | [获取审计日志](#获取审计日志) | 查询操作审计记录 | JWT（应用权限） |
| | [获取操作统计](#获取操作统计) | 查询操作统计数据 | JWT（应用权限） |

## 🌍 Base URL

```
https://doopush.com/api/v1
```

## 🔑 认证要求

- **管理类查询接口**（推送日志、推送统计、审计日志）：需要登录后获得的 **JWT Token**，使用 `Authorization: Bearer <token>` 头
- **客户端上报接口**（`POST /push/statistics/report`）：使用 **API Key**（`X-API-Key`）

API Key 不再分级（不存在 `statistics` / `device` 权限粒度），凭一把 Key 即可访问其授权的全部接口。

## 📊 推送日志

### 获取推送日志

获取应用的推送日志列表，支持多种筛选条件。

#### 请求信息

**接口地址**：`GET /apps/{appId}/push/logs`

**路径参数**：
- `appId` (integer) - 应用ID

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `page` | integer | 否 | 页码，默认1 | `1` |
| `page_size` | integer | 否 | 每页数量，默认20 | `20` |
| `status` | string | 否 | 推送状态：`pending`, `sent`, `failed` | `sent` |
| `platform` | string | 否 | 设备平台：`ios`, `android` | `ios` |

#### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/push/logs?page=1&page_size=10&status=sent&platform=ios" \
     -H "Authorization: Bearer <jwt_token>"
```

#### 响应格式

**成功响应** (200)：使用统一分页结构。`data.data.items` 为推送日志列表，每条带聚合后的成功 / 失败 / 待发数；`data.current_page` / `data.total_items` / `data.total_pages` 描述分页。

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "current_page": 1,
    "page_size": 10,
    "total_items": 100,
    "total_pages": 10,
    "data": {
      "items": [
        {
          "id": 12345,
          "app_id": 123,
          "device_id": 5001,
          "title": "新功能上线",
          "content": "我们推出了令人兴奋的新功能",
          "channel": "apns",
          "status": "sent",
          "badge": 1,
          "send_at": "2024-01-01T10:00:00Z",
          "created_at": "2024-01-01T09:55:00Z",
          "result": { "success": true },
          "total_devices": 1,
          "success_count": 1,
          "failed_count": 0,
          "pending_count": 0,
          "target_type": "single",
          "target_value": 5001
        }
      ]
    }
  }
}
```

### 获取推送详情

获取指定推送日志的详细信息和推送结果。

#### 请求信息

**接口地址**：`GET /apps/{appId}/push/logs/{logId}`

**路径参数**：
- `appId` (integer) - 应用ID
- `logId` (integer) - 推送日志ID

#### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/push/logs/12345" \
     -H "Authorization: Bearer <jwt_token>"
```

#### 响应格式

**成功响应** (200)：返回单条推送日志（含关联 `device`）、对应的所有 `push_result` 记录、以及聚合 `stats`。

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "log": {
      "id": 12345,
      "app_id": 123,
      "device_id": 67890,
      "title": "新功能上线",
      "content": "我们推出了令人兴奋的新功能",
      "payload": "{\"action\":\"open_page\",\"url\":\"https://example.com\"}",
      "channel": "apns",
      "status": "sent",
      "badge": 1,
      "send_at": "2024-01-01T10:00:00Z",
      "created_at": "2024-01-01T09:55:00Z",
      "device": { "id": 67890, "platform": "ios", "model": "iPhone 14" },
      "result": {
        "success": true,
        "error_code": "",
        "error_message": "",
        "response_data": "{\"apns-id\":\"abc-...\"}"
      }
    },
    "results": [
      {
        "id": 1,
        "push_log_id": 12345,
        "success": true,
        "error_code": "",
        "error_message": "",
        "response_data": "{\"apns-id\":\"abc-...\"}",
        "created_at": "2024-01-01T10:00:30Z"
      }
    ],
    "stats": {
      "total_devices": 1,
      "success_count": 1,
      "failed_count": 0
    }
  }
}
```

## 📈 推送统计

### 获取推送统计

获取应用的推送统计数据，包括总体数据和趋势分析。

#### 请求信息

**接口地址**：`GET /apps/{appId}/push/statistics`

**路径参数**：
- `appId` (integer) - 应用ID

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `days` | integer | 否 | 统计天数，默认30天 | `30` |

#### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/push/statistics?days=7" \
     -H "Authorization: Bearer <jwt_token>"
```

#### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total_pushes": 10000,
    "success_pushes": 9500,
    "failed_pushes": 500,
    "total_devices": 5000,
    "total_clicks": 2000,
    "total_opens": 1500,
    "daily_stats": [
      {
        "date": "2024-01-01",
        "total_pushes": 1000,
        "success_pushes": 950,
        "failed_pushes": 50,
        "click_count": 200,
        "open_count": 150
      },
      {
        "date": "2024-01-02",
        "total_pushes": 1200,
        "success_pushes": 1140,
        "failed_pushes": 60,
        "click_count": 240,
        "open_count": 180
      }
    ],
    "platform_stats": [
      {
        "platform": "ios",
        "total_pushes": 6000,
        "success_pushes": 5700,
        "failed_pushes": 300
      },
      {
        "platform": "android",
        "total_pushes": 4000,
        "success_pushes": 3800,
        "failed_pushes": 200
      }
    ]
  }
}
```

### 上报推送统计

客户端上报推送统计信息，如点击、打开等用户行为数据。

#### 请求信息

**接口地址**：`POST /apps/{appId}/push/statistics/report`

**路径参数**：
- `appId` (integer) - 应用ID

**请求体**：单次请求批量上报多个事件，所有事件共用同一个 `device_token`。

```json
{
  "device_token": "abc123def456...",
  "statistics": [
    {
      "push_log_id": 12345,
      "event": "click",
      "timestamp": 1704110400
    },
    {
      "push_log_id": 12345,
      "event": "open",
      "timestamp": 1704110405
    }
  ]
}
```

**顶层参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `device_token` | string | 是 | 设备 Token | `"abc123def456..."` |
| `statistics` | array | 是 | 事件数组，至少 1 条 | 见下方 |

**事件对象 (`statistics[]`)**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `push_log_id` | integer | 否* | 推送日志 ID | `12345` |
| `dedup_key` | string | 否* | 推送去重键，与 `push_log_id` 二选一 | `"abc-123"` |
| `event` | string | 是 | 事件类型：`click` 或 `open` | `"click"` |
| `timestamp` | integer | 是 | 事件发生 Unix 时间戳（秒） | `1704110400` |

*`push_log_id` 与 `dedup_key` 至少提供一个，DooPush 用于定位对应的推送记录。

#### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push/statistics/report" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "device_token": "abc123def456ghi789...",
       "statistics": [
         { "push_log_id": 12345, "event": "click", "timestamp": 1704110400 }
       ]
     }'
```

#### 响应格式

**成功响应** (200)：`data.count` 为本次成功入库的事件条数。

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


## 📋 审计日志

### 获取审计日志

获取指定应用的审计日志，支持权限验证和高级筛选。

#### 请求信息

**接口地址**：`GET /apps/{appId}/audit-logs`

**路径参数**：
- `appId` (integer) - 应用ID

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `user_id` | integer | 否 | 用户ID筛选 | `123` |
| `user_name` | string | 否 | 用户名筛选 | `admin` |
| `action` | string | 否 | 操作类型：`create`, `update`, `delete`, `push`, `login`, `logout` | `create` |
| `resource` | string | 否 | 资源类型：`device`, `push`, `config`, `template`, `group`, `scheduled_push`, `api_key` | `push` |
| `ip_address` | string | 否 | IP地址筛选 | `192.168.1.1` |
| `start_time` | string | 否 | 开始时间 (ISO 8601格式) | `"2024-01-01T00:00:00Z"` |
| `end_time` | string | 否 | 结束时间 (ISO 8601格式) | `"2024-01-31T23:59:59Z"` |
| `page` | integer | 否 | 页码，默认1 | `1` |
| `page_size` | integer | 否 | 每页数量，默认20 | `20` |

#### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/audit-logs?action=push&start_time=2024-01-01T00:00:00Z&end_time=2024-01-31T23:59:59Z&page=1&page_size=10" \
     -H "Authorization: Bearer <jwt_token>"
```

#### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "logs": [
      {
        "id": 12345,
        "user_id": 123,
        "user_name": "admin",
        "action": "create_push",
        "action_label": "创建推送",
        "resource": "push",
        "resource_label": "推送",
        "resource_id": 67890,
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "details": "{\"title\":\"新功能上线\",\"content\":\"推送内容\"}",
        "before_data": null,
        "after_data": "{\"id\":67890,\"title\":\"新功能上线\"}",
        "app_id": 123,
        "app_name": "我的应用",
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 100
  }
}
```

### 获取操作统计

获取指定应用的操作统计数据，用于监控分析。

#### 请求信息

**接口地址**：`GET /apps/{appId}/audit-logs/operation-statistics`

**路径参数**：
- `appId` (integer) - 应用ID

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `days` | integer | 否 | 统计天数，范围 1-365，默认 30 | `7` |
| `limit` | integer | 否 | 返回统计条目数量上限 | `10` |

#### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/audit-logs/operation-statistics?days=7" \
     -H "Authorization: Bearer <jwt_token>"
```

#### 响应格式

**成功响应** (200)：返回按 `(action, resource)` 聚合的操作计数列表，并带统计周期信息。

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "statistics": [
      {
        "action": "push",
        "resource": "push",
        "count": 500,
        "action_label": "推送",
        "resource_label": "推送"
      },
      {
        "action": "create",
        "resource": "device",
        "count": 200,
        "action_label": "创建",
        "resource_label": "设备"
      }
    ],
    "period": {
      "days": 7,
      "app_id": 123,
      "app_name": null
    }
  }
}
```

## 📊 数据模型

### PushLog 对象

```json
{
  "id": 12345,
  "app_id": 123,
  "title": "推送标题",
  "content": "推送内容",
  "payload": "{\"action\":\"open_page\"}",
  "status": "sent",
  "channel": "apns",
  "platform": "ios",
  "target_count": 1000,
  "success_count": 950,
  "failed_count": 50,
  "click_count": 200,
  "open_count": 150,
  "badge": 1,
  "send_at": "2024-01-01T10:00:00Z",
  "created_at": "2024-01-01T09:55:00Z",
  "updated_at": "2024-01-01T10:05:00Z"
}
```

### AuditLog 对象

```json
{
  "id": 12345,
  "user_id": 123,
  "user_name": "admin",
  "action": "create_push",
  "action_label": "创建推送",
  "resource": "push",
  "resource_label": "推送",
  "resource_id": 67890,
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "details": "{\"title\":\"新功能上线\"}",
  "before_data": null,
  "after_data": "{\"id\":67890}",
  "app_id": 123,
  "app_name": "我的应用",
  "created_at": "2024-01-01T10:00:00Z"
}
```

## ❌ 错误响应

### 通用错误格式

```json
{
  "code": 400,
  "message": "错误描述",
  "data": null
}
```

### 常见错误码

| 状态码 | 错误码 | 描述 | 解决方案 |
|--------|--------|------|----------|
| 400 | 400 | 请求参数错误 | 检查查询参数格式 |
| 401 | 401 | 未认证 | 检查 Token / API Key 是否有效 |
| 403 | 403 | 无权限 | 确认当前用户对该应用有访问权限 |
| 404 | 404 | 资源不存在 | 检查推送日志ID是否正确 |

### 错误示例

**权限不足**：
```json
{
  "code": 403,
  "message": "无权限访问该应用",
  "data": null
}
```

**资源不存在**：
```json
{
  "code": 404,
  "message": "推送日志不存在",
  "data": null
}
```

## 💡 使用建议

### 数据查询优化

1. **分页查询**：
   - 合理设置页面大小，避免一次查询过多数据
   - 使用筛选条件减少查询范围
   - 按时间范围查询提高效率

2. **缓存策略**：
   - 统计数据可以适当缓存
   - 避免频繁查询相同数据
   - 根据数据更新频率设置缓存时间

### 监控分析

1. **推送效果分析**：
   - 定期查看推送统计数据
   - 分析不同平台的推送效果
   - 监控推送失败率变化

2. **用户行为分析**：
   - 追踪推送点击率和打开率
   - 分析用户响应时间模式
   - 优化推送时间和内容

### 审计合规

1. **日志管理**：
   - 定期导出审计日志
   - 建立日志保留策略
   - 监控异常操作行为

2. **权限控制**：
   - 严格控制审计日志访问权限
   - 记录敏感操作的详细信息
   - 建立操作审批流程

## ❓ 常见问题

### Q: 推送统计数据多久更新一次？
A: 推送统计数据实时更新，用户行为数据（点击、打开）需要客户端主动上报。

### Q: 审计日志保存多长时间？
A: 审计日志默认保留 365 天（由 `AUDIT_RETENTION_DAYS` 环境变量控制），可通过导出功能备份长期数据。

### Q: 如何获取特定时间段的数据？
A: 大部分接口支持时间筛选参数，使用start_time和end_time指定查询范围。

### Q: 统计数据为什么有延迟？
A: 某些统计数据需要批量处理，可能有5-10分钟的延迟。

### Q: 如何提高查询性能？
A: 使用合适的筛选条件、控制查询范围、避免查询过长时间跨度的数据。

---

*数据查询接口帮助您深入了解推送效果和系统使用情况，合理使用这些数据能够显著优化推送策略和用户体验。*

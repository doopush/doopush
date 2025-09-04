# 数据查询接口

数据查询接口提供了推送日志、统计数据和审计信息的查询功能，帮助您监控推送效果、分析用户行为和追踪操作记录。

## 📋 接口概览

| 分类 | 接口 | 描述 | 权限要求 |
|------|------|------|----------|
| **推送日志** | [获取推送日志](#获取推送日志) | 查询推送记录列表 | `statistics` |
| | [获取推送详情](#获取推送详情) | 查询单条推送的详细信息 | `statistics` |
| **推送统计** | [获取推送统计](#获取推送统计) | 查询推送统计数据 | `statistics` |
| | [上报推送统计](#上报推送统计) | 客户端上报统计信息 | `statistics` |
| **审计日志** | [获取审计日志](#获取审计日志) | 查询操作审计记录 | 管理员权限 |
| | [获取操作统计](#获取操作统计) | 查询操作统计数据 | 管理员权限 |

## 🌍 Base URL

```
https://doopush.com/api/v1
```

## 🔑 认证要求

- **推送数据查询**：需要 API Key 具有 **`statistics` 权限**
- **审计日志查询**：需要 **管理员权限**或对应用的访问权限

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
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

#### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "push_logs": [
      {
        "id": 12345,
        "title": "新功能上线",
        "content": "我们推出了令人兴奋的新功能",
        "status": "sent",
        "channel": "apns",
        "platform": "ios",
        "target_count": 1000,
        "success_count": 950,
        "failed_count": 50,
        "click_count": 200,
        "open_count": 150,
        "send_at": "2024-01-01T10:00:00Z",
        "created_at": "2024-01-01T09:55:00Z"
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 100
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
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

#### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "log": {
      "id": 12345,
      "title": "新功能上线",
      "content": "我们推出了令人兴奋的新功能",
      "payload": "{\"action\":\"open_page\",\"url\":\"https://example.com\"}",
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
      "created_at": "2024-01-01T09:55:00Z"
    },
    "results": [
      {
        "device_id": 67890,
        "device_token": "abc123def456...",
        "status": "sent",
        "error_message": null,
        "delivered_at": "2024-01-01T10:00:30Z"
      },
      {
        "device_id": 67891,
        "device_token": "def456ghi789...",
        "status": "failed",
        "error_message": "Invalid device token",
        "delivered_at": null
      }
    ]
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
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
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

**请求体**：
```json
{
  "push_log_id": 12345,
  "device_token": "abc123def456...",
  "event_type": "click",
  "timestamp": 1704110400
}
```

**参数说明**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `push_log_id` | integer | 是 | 推送日志ID | `12345` |
| `device_token` | string | 是 | 设备Token | `"abc123def456..."` |
| `event_type` | string | 是 | 事件类型：`click`, `open`, `dismiss` | `"click"` |
| `timestamp` | integer | 是 | 事件发生时间戳 | `1704110400` |

#### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push/statistics/report" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "push_log_id": 12345,
       "device_token": "abc123def456ghi789...",
       "event_type": "click",
       "timestamp": 1704110400
     }'
```

#### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "统计数据上报成功",
  "data": {
    "recorded": true,
    "timestamp": "2024-01-01T10:00:00Z"
  }
}
```

## 📋 审计日志

### 获取审计日志

获取指定应用的审计日志，支持权限验证和高级筛选。

#### 请求信息

**接口地址**：`GET /api/v1/apps/{appId}/audit-logs`

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
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
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

**接口地址**：`GET /api/v1/apps/{appId}/audit-logs/operation-statistics`

**路径参数**：
- `appId` (integer) - 应用ID

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `days` | integer | 否 | 统计天数，默认30天 | `7` |

#### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/audit-logs/operation-statistics?days=7" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

#### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "operation_counts": {
      "create": 150,
      "update": 80,
      "delete": 20,
      "push": 500,
      "login": 100,
      "logout": 90
    },
    "resource_counts": {
      "device": 200,
      "push": 500,
      "config": 30,
      "template": 50,
      "group": 25,
      "api_key": 15
    },
    "daily_stats": [
      {
        "date": "2024-01-01",
        "total_operations": 120,
        "unique_users": 8
      },
      {
        "date": "2024-01-02",
        "total_operations": 95,
        "unique_users": 6
      }
    ],
    "top_users": [
      {
        "user_id": 123,
        "user_name": "admin",
        "operation_count": 200
      },
      {
        "user_id": 124,
        "user_name": "operator",
        "operation_count": 150
      }
    ]
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
| 401 | 401 | 未认证 | 检查API Key是否有效 |
| 403 | 403 | 无权限 | 确认API Key具有statistics权限 |
| 404 | 404 | 资源不存在 | 检查推送日志ID是否正确 |

### 错误示例

**权限不足**：
```json
{
  "code": 403,
  "message": "API密钥缺少statistics权限",
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
A: 审计日志默认保存90天，可以通过导出功能备份长期数据。

### Q: 如何获取特定时间段的数据？
A: 大部分接口支持时间筛选参数，使用start_time和end_time指定查询范围。

### Q: 统计数据为什么有延迟？
A: 某些统计数据需要批量处理，可能有5-10分钟的延迟。

### Q: 如何提高查询性能？
A: 使用合适的筛选条件、控制查询范围、避免查询过长时间跨度的数据。

---

*数据查询接口帮助您深入了解推送效果和系统使用情况，合理使用这些数据能够显著优化推送策略和用户体验。*

# 推送接口

推送接口是 DooPush 的核心功能，提供多种推送方式以满足不同的业务需求。所有推送接口都需要 **API Key 认证**。

## 📋 接口概览

| 接口 | 描述 | 推送范围 |
|------|------|----------|
| [发送推送](#发送推送) | 通用推送接口，支持多种目标类型 | 灵活配置 |
| [单设备推送](#单设备推送) | 向指定设备发送推送 | 单个设备 |
| [批量推送](#批量推送) | 向多个设备发送推送 | 最多1000个设备 |
| [广播推送](#广播推送) | 向所有设备发送推送 | 全部设备 |

## 🌍 Base URL

```
https://doopush.com/api/v1
```

## 🔑 认证要求

所有推送接口都需要 **API Key 认证**，并且 API Key 必须具有 **`push` 权限**。

**认证方式**：
```bash
# Header 认证（推荐）
-H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Query 参数认证
?api_key=dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 📨 发送推送

通用推送接口，支持通过 `target` 参数指定不同的推送目标。

### 请求信息

**接口地址**：`POST /apps/{appId}/push`

**路径参数**：
- `appId` (integer) - 应用ID

**请求体**：
```json
{
  "title": "推送标题",
  "content": "推送内容",
  "badge": 1,
  "payload": {
    "action": "open_page",
    "url": "https://example.com/page",
    "data": "自定义数据"
  },
  "target": {
    "type": "broadcast",
    "platform": "ios"
  },
  "schedule_time": "2024-12-31T10:00:00Z"
}
```

**参数说明**：

#### 必填参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `title` | string | 推送标题，最大200字符 | `"新消息"` |
| `content` | string | 推送内容，最大1000字符 | `"您有一条新消息"` |

#### 可选参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `badge` | integer | iOS角标数量 | `1` |
| `payload` | object | 自定义载荷 | 见下方说明 |
| `target` | object | 推送目标配置 | 见下方说明 |
| `schedule_time` | string | 定时发送时间（ISO 8601格式） | `"2024-12-31T10:00:00Z"` |

#### 推送目标配置 (target)

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `type` | string | 目标类型：`all`, `devices`, `tags`, `groups` | `"devices"` |
| `device_ids` | array | 设备ID数组（当type为devices时） | `[1, 2, 3]` |
| `tag_ids` | array | 标签ID数组（当type为tags时） | `[1, 2]` |
| `tags` | array | 设备标签筛选（新版本推荐） | 见标签筛选说明 |
| `group_ids` | array | 分组ID数组（当type为groups时） | `[1, 2]` |
| `platform` | string | 平台筛选：`ios`, `android` | `"android"` |
| `channel` | string | 推送通道筛选 | `"fcm"`, `"huawei"`, `"xiaomi"`, `"oppo"`, `"vivo"` |

#### 标签筛选 (tags)

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `tag_name` | string | 标签名称 | `"user_type"` |
| `tag_value` | string | 标签值（可选） | `"vip"` |

#### Android 推送通道说明

Android 平台支持多种推送通道，系统会根据设备品牌智能选择最优通道：

| 通道 | 适用设备 | 描述 |
|------|----------|------|
| `fcm` | 所有Android设备 | Google Firebase Cloud Messaging，默认通道 |
| `huawei` | 华为设备 | 华为移动服务HMS Push，华为设备专用 |
| `xiaomi` | 小米设备 | 小米推送服务，小米/Redmi设备专用 |
| `oppo` | OPPO设备 | OPPO推送服务，OPPO/OnePlus设备专用 |
| `vivo` | VIVO设备 | VIVO推送服务，VIVO/iQOO设备专用 |

#### 载荷参数 (payload)

**基础载荷参数**：

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `action` | string | 动作类型 | `"open_page"`, `"open_url"` |
| `url` | string | 跳转链接 | `"https://example.com"` |
| `data` | string | 额外数据（JSON字符串） | `"{\"page\":\"news\",\"id\":123}"` |

**Android 厂商特定参数**：

为优化推送效果，支持以下厂商特定参数：

| 厂商 | 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|------|
| 华为 HMS | `huawei` | object | 华为推送参数 | `{"importance": "HIGH", "ttl": 3600}` |
| 小米推送 | `xiaomi` | object | 小米推送参数 | `{"pass_through": 0, "notify_type": 1}` |
| OPPO推送 | `oppo` | object | OPPO推送参数 | `{"channel_id": "important", "notify_level": 2}` |
| VIVO推送 | `vivo` | object | VIVO推送参数 | `{"classification": 1, "notify_type": 1}` |

**厂商参数详细说明**：

- **华为 HMS**：`importance`（重要性）、`ttl`（存活时间）
- **小米推送**：`pass_through`（透传模式）、`notify_type`（通知类型）、`time_to_live`（存活时间）
- **OPPO推送**：`channel_id`（通道ID）、`category`（消息分类）、`notify_level`（通知级别）
- **VIVO推送**：`classification`（消息分类）、`notify_type`（通知类型）、`skip_type`（跳转类型）、`time_to_live`（存活时间）

### 请求示例

#### 基础广播推送
```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "新功能上线",
       "content": "我们推出了令人兴奋的新功能，快来体验吧！",
       "badge": 1,
       "payload": {
         "action": "open_page",
         "url": "https://example.com/new-feature",
         "data": "{\"feature_id\":\"new_feature_v2\"}"
       },
       "target": {
         "type": "all",
         "platform": "ios"
       }
     }'
```

#### Android 厂商推送示例
```bash
# 向所有华为设备推送
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "华为用户专享优惠",
       "content": "华为用户专享活动，限时优惠等您来抢！",
       "payload": {
         "action": "open_page",
         "url": "https://example.com/huawei-special",
         "huawei": {
           "importance": "HIGH",
           "ttl": 3600
         }
       },
       "target": {
         "type": "all",
         "platform": "android",
         "channel": "huawei"
       }
     }'

# 向所有VIVO设备推送（带厂商参数）
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "VIVO用户专属通知",
       "content": "VIVO设备优化推送，体验更佳消息送达！",
       "payload": {
         "action": "open_page",
         "url": "https://example.com/vivo-special",
         "vivo": {
           "classification": 1,
           "notify_type": 1,
           "skip_type": 1,
           "time_to_live": 3600
         }
       },
       "target": {
         "type": "all",
         "platform": "android",
         "channel": "vivo"
       }
     }'

# 向指定设备组推送（自动选择推送通道）
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "VIP用户消息",
       "content": "您的VIP权益即将到期，请及时续费",
       "payload": {
         "action": "open_page",
         "url": "https://example.com/vip-renewal"
       },
       "target": {
         "type": "tags",
         "tags": [
           {
             "tag_name": "user_level", 
             "tag_value": "vip"
           }
         ],
         "platform": "android"
       }
     }'

# 向特定设备列表推送
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "订单状态更新",
       "content": "您的订单状态已更新，请查看详情",
       "payload": {
         "action": "open_page",
         "url": "https://example.com/orders"
       },
       "target": {
         "type": "devices",
         "device_ids": [101, 102, 103]
       }
     }'
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "推送发送成功",
  "data": [
    {
      "id": 12345,
      "app_id": 123,
      "title": "新功能上线",
      "content": "我们推出了令人兴奋的新功能，快来体验吧！",
      "status": "sent",
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

## 📱 单设备推送

向指定的单个设备发送推送通知。

### 请求信息

**接口地址**：`POST /apps/{appId}/push/single`

**请求体**：
```json
{
  "title": "个人消息",
  "content": "您有一条个人消息",
  "device_id": "device_token_here",
  "badge": 1,
  "payload": {
    "action": "open_page",
    "url": "https://example.com/message",
    "data": "message_data"
  }
}
```

**参数说明**：

#### 必填参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `title` | string | 推送标题 | `"个人消息"` |
| `content` | string | 推送内容 | `"您有一条个人消息"` |
| `device_id` | string | 设备Token | `"device123..."` |

#### 可选参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `badge` | integer | iOS角标数量 | `1` |
| `payload` | object | 自定义载荷 | 见载荷参数说明 |

### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push/single" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "订单状态更新",
       "content": "您的订单 #12345 已发货，预计3天内到达",
       "device_id": "abc123def456...",
       "badge": 1,
       "payload": {
         "action": "open_page",
         "url": "https://example.com/order/12345",
         "data": "{\"order_id\":12345,\"status\":\"shipped\"}"
       }
     }'
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "推送发送成功",
  "data": {
    "push_id": 12346,
    "device_count": 1,
    "status": "sent"
  }
}
```

## 📋 批量推送

向多个指定设备同时发送推送通知，最多支持 1000 个设备。

### 请求信息

**接口地址**：`POST /apps/{appId}/push/batch`

**请求体**：
```json
{
  "title": "批量消息",
  "content": "批量推送消息内容",
  "device_ids": [
    "device_token_1",
    "device_token_2",
    "device_token_3"
  ],
  "badge": 1,
  "payload": {
    "action": "open_page",
    "url": "https://example.com/batch",
    "data": "batch_data"
  }
}
```

**参数说明**：

#### 必填参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `title` | string | 推送标题 | `"批量消息"` |
| `content` | string | 推送内容 | `"批量推送消息内容"` |
| `device_ids` | array | 设备Token数组，1-1000个 | `["device1", "device2"]` |

#### 可选参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `badge` | integer | iOS角标数量 | `1` |
| `payload` | object | 自定义载荷 | 见载荷参数说明 |

### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push/batch" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "会员专享活动",
       "content": "VIP会员专享活动开始了，限时优惠不容错过！",
       "device_ids": [
         "vip_user_device_1",
         "vip_user_device_2",
         "vip_user_device_3"
       ],
       "badge": 1,
       "payload": {
         "action": "open_page",
         "url": "https://example.com/vip-activity",
         "data": "{\"activity_id\":\"vip_2024_01\",\"discount\":\"50%\"}"
       }
     }'
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "推送发送成功",
  "data": {
    "push_id": 12347,
    "device_count": 3,
    "status": "sent"
  }
}
```

## 📢 广播推送

向应用的所有活跃设备发送推送通知。

### 请求信息

**接口地址**：`POST /apps/{appId}/push/broadcast`

**请求体**：
```json
{
  "title": "系统公告",
  "content": "系统维护通知",
  "badge": 1,
  "platform": "android",
  "channel": "huawei",
  "payload": {
    "action": "open_page",
    "url": "https://example.com/announcement",
    "data": "announcement_data"
  }
}
```

**参数说明**：

#### 必填参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `title` | string | 推送标题 | `"系统公告"` |
| `content` | string | 推送内容 | `"系统维护通知"` |

#### 可选参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `badge` | integer | iOS角标数量 | `1` |
| `platform` | string | 指定平台：`ios`, `android` | `"ios"` |
| `channel` | string | 指定推送通道：`fcm`, `huawei`, `xiaomi`, `oppo`, `vivo` | `"huawei"` |
| `payload` | object | 自定义载荷 | 见载荷参数说明 |

### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push/broadcast" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "重要系统更新",
       "content": "系统将于今晚22:00-24:00进行维护升级，期间服务可能暂时中断，请提前做好准备。",
       "badge": 1,
       "platform": "ios",
       "payload": {
         "action": "open_page",
         "url": "https://example.com/maintenance-notice",
         "data": "{\"maintenance_time\":\"2024-01-01 22:00-24:00\"}"
       }
     }'
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "推送发送成功",
  "data": {
    "push_id": 12348,
    "device_count": 5000,
    "status": "sent"
  }
}
```

## 📊 推送日志

查询应用的推送历史记录。

### 请求信息

**接口地址**：`GET /apps/{appId}/push/logs`

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `page` | integer | 否 | 页码，默认1 | `1` |
| `page_size` | integer | 否 | 每页数量，默认20 | `20` |
| `status` | string | 否 | 状态筛选：`pending`, `sent`, `failed` | `sent` |
| `platform` | string | 否 | 平台筛选：`ios`, `android` | `ios` |

### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/push/logs?page=1&page_size=10&status=sent" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 响应格式

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
        "target_count": 1000,
        "success_count": 950,
        "failed_count": 50,
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 100
  }
}
```

## 📈 推送统计

查询应用的推送统计数据。

### 请求信息

**接口地址**：`GET /apps/{appId}/push/statistics`

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `start_date` | string | 否 | 开始日期 (YYYY-MM-DD) | `2024-01-01` |
| `end_date` | string | 否 | 结束日期 (YYYY-MM-DD) | `2024-01-31` |

### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/push/statistics?start_date=2024-01-01&end_date=2024-01-31" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total_pushes": 1000,
    "success_pushes": 950,
    "failed_pushes": 50,
    "total_clicks": 200,
    "total_opens": 150,
    "daily_stats": [
      {
        "date": "2024-01-01",
        "total_pushes": 100,
        "success_pushes": 95,
        "failed_pushes": 5,
        "click_count": 20,
        "open_count": 15
      }
    ],
    "platform_stats": [
      {
        "platform": "ios",
        "total_pushes": 600,
        "success_pushes": 580,
        "failed_pushes": 20
      },
      {
        "platform": "android",
        "total_pushes": 400,
        "success_pushes": 370,
        "failed_pushes": 30
      }
    ]
  }
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
| 400 | 400 | 请求参数错误 | 检查请求参数格式和内容 |
| 401 | 401 | 未认证或API密钥无效 | 检查API Key是否正确和有效 |
| 403 | 403 | 无权限 | 确认API Key具有push权限 |
| 422 | 422 | 参数验证失败 | 检查必填参数和格式要求 |

### 错误示例

**认证错误**：
```json
{
  "code": 401,
  "message": "未认证或API密钥无效",
  "data": null
}
```

**权限错误**：
```json
{
  "code": 403,
  "message": "API密钥缺少push权限",
  "data": null
}
```

**参数错误**：
```json
{
  "code": 400,
  "message": "推送标题不能为空",
  "data": null
}
```

## 💡 最佳实践

### 推送内容优化

1. **标题建议**：
   - 控制在20-30个字符内
   - 突出核心信息和价值
   - 使用动作词汇吸引点击

2. **内容建议**：
   - 提供具体的行动指引
   - 包含时间敏感性信息
   - 个性化内容提高相关性

### 载荷使用

1. **跳转处理**：
   ```json
   {
     "action": "open_url",
     "url": "https://example.com/news/123",
     "data": "{\"page\":\"news\",\"id\":123}"
   }
   ```

2. **页面导航**：
   ```json
   {
     "action": "open_page",
     "data": "{\"page\":\"profile\",\"tab\":\"orders\"}"
   }
   ```

### 批量处理

1. **设备Token管理**：
   - 及时清理无效Token
   - 批量推送不超过1000个设备
   - 使用设备分组简化管理

2. **错误处理**：
   - 监控推送成功率
   - 处理失败重试机制
   - 记录和分析失败原因

### 频率控制

1. **避免过度推送**：
   - 根据用户偏好设置频率
   - 重要消息优先级处理
   - 建立推送日历计划

2. **时间优化**：
   - 基于用户活跃时间发送
   - 考虑用户所在时区
   - 避开用户休息时间

## ❓ 常见问题

### Q: 推送失败的原因有哪些？
A: 常见原因包括设备Token失效、设备离线、推送配置错误、用户关闭推送权限等。

### Q: 如何提高推送送达率？
A: 定期清理无效Token、确保推送配置正确、选择用户活跃时间发送、优化推送内容。

### Q: 批量推送有什么限制？
A: 单次批量推送最多支持1000个设备Token，超过需要分批发送。

### Q: 载荷数据有大小限制吗？
A: iOS APNs限制载荷总大小为4KB，建议载荷数据控制在合理范围内。

### Q: 如何处理推送重复？
A: 可以通过推送日志查询历史记录，避免在短时间内发送相同内容。

---

*推送接口是实现用户触达的重要工具，合理使用能够显著提升用户参与度和应用活跃度。*

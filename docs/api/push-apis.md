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

所有推送接口都支持 **API Key** (`X-API-Key`) 或登录后的 **JWT Token** (`Authorization: Bearer`) 认证。当前 API Key 不再分级，凭一把 Key 即可调用全部推送接口。

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
    "type": "all",
    "platform": "ios"
  },
  "schedule_time": "2024-12-31T10:00:00Z"
}
```

**参数说明**：

#### 必填参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `title` | string | 推送标题，API 强制 ≤ 200 字符 | `"新消息"` |
| `content` | string | 推送内容，必填。API 不强制长度上限（DB 列为 `TEXT`，最大 64KB）；Web 控制台输入框限制 1000 字符以保证显示效果 | `"您有一条新消息"` |
| `target` | object | 推送目标配置（必填），见下方 | 见下方说明 |

#### 可选参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `badge` | integer | iOS角标数量 | `1` |
| `payload` | object | 自定义载荷 | 见下方说明 |
| `schedule_time` | string | 定时发送时间（ISO 8601格式） | `"2024-12-31T10:00:00Z"` |

#### 推送目标配置 (target)

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `type` | string | 目标类型，**必填**：`all`(全部设备)、`devices`(指定设备 ID)、`tags`(按标签筛选)、`groups`(按设备分组) | `"devices"` |
| `device_ids` | array&lt;integer&gt; | 设备**主键 ID** 数组（注意：是 `devices.id` 数字 ID，**不是** Token 字符串。如果你拿到的是 Token，请改用 `POST /apps/{appId}/push/batch`） | `[101, 102, 103]` |
| `tag_ids` | array | 标签ID数组（当type为tags时） | `[1, 2]` |
| `tags` | array | 设备标签筛选（新版本推荐） | 见标签筛选说明 |
| `group_ids` | array | 分组ID数组（当type为groups时） | `[1, 2]` |
| `platform` | string | 平台筛选：`ios`, `android` | `"android"` |
| `channel` | string | 推送通道筛选：`apns` (iOS) / `fcm` / `huawei` / `honor` / `xiaomi` / `oppo` / `vivo` / `meizu` (Android) | `"huawei"` |

#### 标签筛选 (tags)

数组里每个对象描述一条「`tag_name=tag_value`」匹配；多条之间为 **OR 并集**（后端逐条取 token 然后合并去重）。如需 AND 交集请改用 `target.type = "groups"` + 设备分组。

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `tag_name` | string | 标签名称 | `"user_type"` |
| `tag_value` | string | 标签值（可选，留空匹配该 `tag_name` 下任意值） | `"vip"` |

#### Android 推送通道说明

Android 平台支持多种推送通道，系统会根据设备品牌智能选择最优通道：

| 通道 | 适用设备 | 描述 |
|------|----------|------|
| `fcm` | 所有Android设备 | Google Firebase Cloud Messaging，默认通道 |
| `huawei` | 华为设备 | 华为移动服务HMS Push，华为设备专用 |
| `honor` | 荣耀设备 | 荣耀推送服务，荣耀设备专用，使用OAuth 2.0认证 |
| `xiaomi` | 小米设备 | 小米推送服务，小米/Redmi设备专用 |
| `oppo` | OPPO设备 | OPPO推送服务，OPPO/OnePlus设备专用 |
| `vivo` | VIVO设备 | VIVO推送服务，VIVO/iQOO设备专用 |
| `meizu` | 魅族设备 | 魅族推送服务，魅族设备专用 |

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
| 华为 HMS | `huawei` | object | 华为推送参数 | `{"importance": "NORMAL", "category": "IM"}` |
| 荣耀推送 | `honor` | object | 荣耀推送参数 | `{"importance": "HIGH", "ttl": "3600s", "target_user_type": 0}` |
| 小米推送 | `xiaomi` | object | 小米推送参数 | `{"pass_through": 0, "notify_type": 1}` |
| OPPO推送 | `oppo` | object | OPPO推送参数 | `{"channel_id": "important", "notify_level": 2}` |
| VIVO推送 | `vivo` | object | VIVO推送参数 | `{"classification": 1, "notify_type": 1}` |
| 魅族推送 | `meizu` | object | 魅族推送参数 | `{"notice_msg_type": 0, "click_type": 0, "subtitle": "重要通知"}` |

**厂商参数详细说明**：

- **华为 HMS**：`importance`（消息分类 `NORMAL`=服务通讯类不受频控 / `LOW`=资讯营销类受频控）、`category`（消息分类，如 `IM` / `VOIP` / `SUBSCRIPTION`，与华为 Push Kit 自分类对齐）
- **荣耀推送**：`importance`（消息重要性，`NORMAL` / `HIGH`）、`ttl`（消息存活时间，如 `"3600s"`）、`target_user_type`（`0`=正式消息 / `1`=测试消息）
- **小米推送**：`pass_through`（`0`=通知消息 / `1`=透传消息）、`notify_type`（提醒位掩码：`1`=声音 / `2`=震动 / `4`=指示灯，可按位组合）、`time_to_live`（**毫秒**）、`channel_id`（推送通道 ID）
- **OPPO推送**：`channel_id`（公信通道 ID）、`category`（10 项之一：`IM` / `ACCOUNT` / `DEVICE_REMINDER` / `ORDER` / `TODO` / `SUBSCRIPTION` / `NEWS` / `CONTENT` / `MARKETING` / `SOCIAL`）、`notify_level`（仅 `1` / `2` / `16`）、`off_line`（布尔）、`off_line_ttl`（秒）
- **VIVO推送**：`classification`（`0`=运营消息 / `1`=系统消息）、`notify_type`（`1`=通知栏 / `2`=透传）、`skip_type`（`1`=打开应用 / `2`=打开 URL / `3`=自定义）、`skip_content`（配合 `skip_type` 的内容）、`network_type`（`-1`=不限 / `1`=WiFi）、`time_to_live`（**秒**）
- **魅族推送**：`notice_msg_type`（`0`=公信 / `1`=私信）、`notice_bar_type`（`0`=标准 / `2`=原生）、`notice_expand_type`（`0`=标准 / `1`=文本 / `2`=大图）、`click_type`（`0`=应用 / `1`=页面+`activity` / `2`=URI+`url`）、`off_line` / `valid_time`（小时，1-72）、`subtitle`、`pull_down_top`、`callback` / `callback_param` / `callback_type`（`1`=送达 / `2`=点击 / `3`=送达+点击）

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
           "importance": "NORMAL",
           "category": "IM"
         }
       },
       "target": {
         "type": "all",
         "platform": "android",
         "channel": "huawei"
       }
     }'

# 向所有荣耀设备推送
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "荣耀用户专享通知",
       "content": "荣耀设备专属优化推送，Magic OS用户尊享体验！",
       "payload": {
         "action": "open_page",
         "url": "https://example.com/honor-promo",
         "honor": {
           "importance": "HIGH",
           "ttl": "3600s",
           "target_user_type": 0
         }
       },
       "target": {
         "type": "all",
         "platform": "android",
         "channel": "honor"
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

# 向所有魅族设备推送（带厂商参数）
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "魅族用户专属通知",
       "content": "魅族设备优化推送，体验更佳消息送达！",
       "payload": {
         "action": "open_page",
         "url": "https://example.com/meizu-special",
         "meizu": {
           "notice_msg_type": 0,
           "notice_bar_type": 0,
           "click_type": 0,
           "off_line": 1,
           "valid_time": 24,
           "subtitle": "重要通知"
         }
       },
       "target": {
         "type": "all",
         "platform": "android",
         "channel": "meizu"
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

**成功响应** (200)：`data.push_logs` 为本次创建的推送日志数组，每个目标设备一条记录；定时推送时 `data.message` 改为 `"推送已加入定时队列"`。

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "message": "推送发送成功",
    "count": 1,
    "push_logs": [
      {
        "id": 12345,
        "app_id": 123,
        "device_id": 5001,
        "title": "新功能上线",
        "content": "我们推出了令人兴奋的新功能，快来体验吧！",
        "channel": "apns",
        "status": "pending",
        "badge": 1,
        "created_at": "2024-01-01T10:00:00Z"
      }
    ]
  }
}
```

::: tip 异步发送
`POST /apps/{appId}/push` 创建推送日志后立即返回，实际投递与厂商调用在后台 goroutine 中进行；状态从 `pending` 异步更新为 `sent` / `failed`。需要查询最终结果请用 `GET /apps/{appId}/push/logs`。
:::

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
| `device_id` | string | 设备 Token（即 `devices.token`，**不是**主键数字 ID） | `"abc123def456..."` |

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

**成功响应** (200)：`data` 为本次创建的推送日志数组（单设备时通常 1 条）。

```json
{
  "code": 200,
  "message": "成功",
  "data": [
    {
      "id": 12346,
      "app_id": 123,
      "device_id": 5001,
      "title": "您有新订单",
      "content": "订单号：DD20240101001",
      "channel": "apns",
      "status": "pending",
      "badge": 1,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
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
| `device_ids` | array&lt;string&gt; | 设备 Token 数组（**字符串**，不是主键数字 ID），数组长度 1-1000 | `["abc123...", "def456..."]` |

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

**成功响应** (200)：`data` 为本次创建的推送日志数组，每个 `device_id` 对应一条；查不到的 token 会被静默跳过，所有 token 均无效时返回 400。

```json
{
  "code": 200,
  "message": "成功",
  "data": [
    {
      "id": 12347,
      "app_id": 123,
      "device_id": 5001,
      "title": "会员专享活动",
      "content": "VIP会员专享活动开始了，限时优惠不容错过！",
      "channel": "apns",
      "status": "pending",
      "badge": 1,
      "created_at": "2024-01-01T10:00:00Z"
    },
    {
      "id": 12348,
      "app_id": 123,
      "device_id": 5002,
      "title": "会员专享活动",
      "content": "VIP会员专享活动开始了，限时优惠不容错过！",
      "channel": "fcm",
      "status": "pending",
      "badge": 1,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
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
  "vendor": "huawei",
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
| `vendor` | string | 指定厂商通道。**注意**：当前 `SendBroadcast` 实现只把 `platform` 透传到 `target.Platform`，并未把 `vendor` 映射到 `target.Channel`，所以这个字段当前不会真的过滤通道。如要按通道过滤，请改用 `POST /apps/{appId}/push` 并设置 `target.channel` | `"huawei"` |
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

**成功响应** (200)：`data` 为本次创建的推送日志数组，每条目标设备一条记录。广播命中设备数较多时数组会很大，注意网络开销。

```json
{
  "code": 200,
  "message": "成功",
  "data": [
    {
      "id": 12349,
      "app_id": 123,
      "device_id": 5001,
      "title": "系统公告",
      "content": "系统维护通知",
      "channel": "apns",
      "status": "pending",
      "badge": 1,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
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

**成功响应** (200)：使用统一分页结构。`data.data.items` 为推送日志列表，每条带聚合后的成功/失败/待发数；`data.current_page` / `data.total_items` / `data.total_pages` 描述分页。

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
          "created_at": "2024-01-01T10:00:00Z",
          "result": {
            "success": true,
            "error_code": "",
            "error_message": ""
          },
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

## 📈 推送统计

查询应用的推送统计数据。

### 请求信息

**接口地址**：`GET /apps/{appId}/push/statistics`

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `days` | integer | 否 | 统计最近 N 天，范围 1-365，默认 30 | `30` |

### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/push/statistics?days=30" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "total_pushes": 1000,
    "success_pushes": 950,
    "failed_pushes": 50,
    "total_devices": 320,
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

## 📮 消息回执接口

DooPush 暴露一组无需认证的回执接收路由，由各厂商推送平台主动调用。接收到的回执按 `(应用, 厂商, 日期)` 累加到回执统计表。

### 路由列表

| 厂商 | 路由 | 配置位置 |
|------|------|----------|
| OPPO | `POST /api/v1/apps/callback/oppo` | DooPush 配置弹窗「消息回执」字段填本路由 URL |
| 小米 | `POST /api/v1/apps/callback/xiaomi` | 同上 |
| 魅族 | `POST /api/v1/apps/callback/meizu` | 同上 |
| vivo | `POST /api/v1/apps/callback/vivo` | vivo 推送后台注册回执，分配的回执 ID 填到 DooPush 弹窗的「消息回执id」字段 |
| 华为 | `POST /api/v1/apps/callback/huawei` | 在华为开发者联盟 Push Kit 后台直接配置本路由 URL |
| 荣耀 | `POST /api/v1/apps/callback/honor` | 在荣耀开发者平台「管理中心 → 推送服务 → 应用回执」配置本路由 URL |

::: tip 💡 配置位置差异
OPPO / 小米 / 魅族 / vivo 的协议要求每条消息在 payload 中携带回执地址，因此在 DooPush 配置弹窗填写；华为 / 荣耀 在厂商后台一次性注册即可，DooPush 弹窗不显示回执字段。
:::

::: warning ⚠️ FCM 与 iOS APNs
**FCM** 的回执通过 `delivery_receipt_requested` + Google Cloud Pub/Sub 订阅传递（不是 webhook URL），DooPush 当前未实现该流程；**iOS APNs** 协议本身不提供 delivery webhook，无法以回执形式获取送达状态。
:::

### 通用入口

```
POST /api/v1/apps/callback?vendor={huawei|honor|oppo|vivo|xiaomi|meizu}
```

`/apps/callback` 是兜底入口，需要通过 `vendor` 查询参数指定厂商。直接使用 `/apps/callback/{vendor}` 即可，无需额外参数。

### 认证

回执接口由厂商推送平台主动调用，**无需 API Key**。请求体格式由各厂商决定，DooPush 按厂商解析。

### 响应

响应行为按入口区分：

- **厂商专用路由** `POST /apps/callback/{vendor}`：无论 body 解析或业务处理成功失败，一律返回 `code` 为 `"0"`，符合多数厂商对回调端"成功响应即 0"的约定，避免厂商因业务异常重复重试。
- **通用兜底入口** `POST /apps/callback`：当缺少 `vendor`、`vendor` 不支持或 body 解析失败时返回 HTTP 400 错误；仅在校验与解析通过后才返回 `code` 为 `"0"`。

成功响应体（HTTP 200）：

```json
{
  "code": "0",
  "message": "success"
}
```

### 统计累加

回执入库后会按 `(app_id, vendor, date)` 唯一键累加以下字段：

| 字段 | 含义 |
|------|------|
| `total_count` | 总回执条数 |
| `success_count` | 成功送达 |
| `failure_count` | 失败 |
| `delivery_count` | 送达事件 |
| `click_count` | 点击事件 |

具体字段填充由各厂商回执报文格式决定。

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
| 403 | 403 | 无权限 | 确认当前用户对该应用有访问权限 |
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
  "message": "无权限发送推送",
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

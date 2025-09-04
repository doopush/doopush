# 设备管理接口

设备管理接口用于管理用户设备的注册、查询、更新和删除操作。通过这些接口，您可以管理设备的推送权限、设备信息以及设备标签。

## 📋 接口概览

| 接口 | 描述 | 权限要求 |
|------|------|----------|
| [注册设备](#注册设备) | 注册设备以接收推送通知 | `device` |
| [查询设备列表](#查询设备列表) | 获取应用的设备列表 | `device` |
| [查询设备详情](#查询设备详情) | 获取指定设备的详细信息 | `device` |
| [更新设备状态](#更新设备状态) | 启用或禁用设备推送 | `device` |
| [删除设备](#删除设备) | 删除设备记录 | `device` |

## 🌍 Base URL

```
https://doopush.com/api/v1
```

## 🔑 认证要求

所有设备管理接口都需要 **API Key 认证**，并且 API Key 必须具有 **`device` 权限**。

**认证方式**：
```bash
# Header 认证（推荐）
-H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Query 参数认证
?api_key=dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 📱 注册设备

注册设备以接收推送通知。需要验证 API Key 属于指定应用且 bundle_id 与应用包名匹配。

### 请求信息

**接口地址**：`POST /apps/{appId}/devices`

**路径参数**：
- `appId` (integer) - 应用ID

**请求体**：
```json
{
  "token": "device_push_token_here",
  "platform": "ios",
  "bundle_id": "com.yourcompany.yourapp",
  "brand": "Apple",
  "model": "iPhone 14",
  "system_version": "17.0",
  "app_version": "1.2.0",
  "user_agent": "MyApp/1.2.0 (iPhone; iOS 17.0)",
  "tags": [
    {
      "tag_name": "user_level",
      "tag_value": "vip"
    }
  ]
}
```

**参数说明**：

#### 必填参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `token` | string | 设备推送Token | `"abc123def456..."` |
| `platform` | string | 设备平台：`ios`, `android` | `"ios"` |
| `bundle_id` | string | 应用包标识符，必须与应用设置一致 | `"com.yourcompany.yourapp"` |

#### 可选参数

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `brand` | string | 设备品牌 | `"Apple"`, `"Huawei"` |
| `model` | string | 设备型号 | `"iPhone 14"`, `"Mate 50"` |
| `system_version` | string | 系统版本 | `"17.0"`, `"Android 13"` |
| `app_version` | string | 应用版本 | `"1.2.0"` |
| `user_agent` | string | 用户代理字符串 | `"MyApp/1.2.0 (iPhone; iOS 17.0)"` |
| `tags` | array | 设备标签数组 | 见下方标签说明 |

#### 标签参数 (tags)

| 参数 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `tag_name` | string | 标签名称 | `"user_level"`, `"city"` |
| `tag_value` | string | 标签值 | `"vip"`, `"beijing"` |

### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/devices" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "token": "abc123def456ghi789...",
       "platform": "ios",
       "bundle_id": "com.yourcompany.yourapp",
       "brand": "Apple",
       "model": "iPhone 14 Pro",
       "system_version": "17.0",
       "app_version": "2.1.0",
       "user_agent": "YourApp/2.1.0 (iPhone; iOS 17.0; Scale/3.00)",
       "tags": [
         {
           "tag_name": "user_level",
           "tag_value": "premium"
         },
         {
           "tag_name": "city",
           "tag_value": "beijing"
         }
       ]
     }'
```

### 响应格式

**成功响应** (201):
```json
{
  "code": 201,
  "message": "设备注册成功",
  "data": {
    "device": {
      "id": 12345,
      "token": "abc123def456ghi789...",
      "platform": "ios",
      "brand": "Apple",
      "model": "iPhone 14 Pro",
      "system_version": "17.0",
      "app_version": "2.1.0",
      "status": 1,
      "created_at": "2024-01-01T10:00:00Z"
    },
    "gateway_config": {
      "host": "gateway.doopush.com",
      "port": 8080,
      "connection_id": "conn_abc123"
    }
  }
}
```

## 📋 查询设备列表

获取应用的设备列表，支持分页和筛选。

### 请求信息

**接口地址**：`GET /apps/{appId}/devices`

**路径参数**：
- `appId` (integer) - 应用ID

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `page` | integer | 否 | 页码，默认1 | `1` |
| `size` | integer | 否 | 每页数量，默认20 | `20` |
| `platform` | string | 否 | 平台筛选：`ios`, `android` | `ios` |
| `status` | string | 否 | 状态筛选：`0`(禁用), `1`(启用) | `1` |

### 请求示例

```bash
curl -X GET "https://doopush.com/api/v1/apps/123/devices?page=1&size=10&platform=ios&status=1" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "devices": [
      {
        "id": 12345,
        "token": "abc123def456...",
        "platform": "ios",
        "brand": "Apple",
        "model": "iPhone 14",
        "system_version": "17.0",
        "app_version": "1.2.0",
        "status": 1,
        "is_online": true,
        "last_seen": "2024-01-01T10:00:00Z",
        "created_at": "2024-01-01T09:00:00Z"
      }
    ],
    "page": 1,
    "total": 100
  }
}
```

## 🔍 查询设备详情

根据设备ID获取设备的详细信息。

### 请求信息

**接口地址**：`GET /apps/{appId}/devices/{deviceId}`

**路径参数**：
- `appId` (integer) - 应用ID
- `deviceId` (string) - 设备ID或设备Token

### 请求示例

```bash
# 使用设备ID查询
curl -X GET "https://doopush.com/api/v1/apps/123/devices/12345" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 使用设备Token查询
curl -X GET "https://doopush.com/api/v1/apps/123/devices/abc123def456..." \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "id": 12345,
    "token": "abc123def456ghi789...",
    "platform": "ios",
    "brand": "Apple",
    "model": "iPhone 14 Pro",
    "system_version": "17.0",
    "app_version": "2.1.0",
    "user_agent": "YourApp/2.1.0 (iPhone; iOS 17.0; Scale/3.00)",
    "channel": "apns",
    "status": 1,
    "is_online": true,
    "last_seen": "2024-01-01T10:00:00Z",
    "last_heartbeat": "2024-01-01T10:00:00Z",
    "created_at": "2024-01-01T09:00:00Z",
    "updated_at": "2024-01-01T10:00:00Z",
    "tags": [
      {
        "tag_name": "user_level",
        "tag_value": "premium"
      }
    ]
  }
}
```

## 🔄 更新设备状态

启用或禁用设备的推送功能。

### 请求信息

**接口地址**：`PUT /apps/{appId}/devices/{deviceId}/status`

**路径参数**：
- `appId` (integer) - 应用ID
- `deviceId` (string) - 设备ID或设备Token

**请求体**：
```json
{
  "status": 1
}
```

**参数说明**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `status` | integer | 是 | 设备状态：`0`(禁用), `1`(启用) | `1` |

### 请求示例

```bash
curl -X PUT "https://doopush.com/api/v1/apps/123/devices/12345/status" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "status": 0
     }'
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备状态更新成功",
  "data": {
    "device_id": 12345,
    "status": 0,
    "updated_at": "2024-01-01T10:30:00Z"
  }
}
```

## 🗑️ 删除设备

删除设备记录，设备将无法接收推送通知。

### 请求信息

**接口地址**：`DELETE /apps/{appId}/devices/{deviceId}`

**路径参数**：
- `appId` (integer) - 应用ID
- `deviceId` (string) - 设备ID或设备Token

### 请求示例

```bash
curl -X DELETE "https://doopush.com/api/v1/apps/123/devices/12345" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 响应格式

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备删除成功",
  "data": null
}
```

## 🏷️ 设备标签管理

设备标签用于对设备进行分类和管理，支持精准推送。

### 查询设备标签

**接口地址**：`GET /apps/{appId}/tags/devices`

**Query 参数**：

| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `tag_name` | string | 是 | 标签名称 | `user_level` |
| `tag_value` | string | 否 | 标签值 | `vip` |

**请求示例**：
```bash
curl -X GET "https://doopush.com/api/v1/apps/123/tags/devices?tag_name=user_level&tag_value=vip" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**响应格式**：
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "device_tokens": [
      "device_token_1",
      "device_token_2"
    ],
    "total": 2
  }
}
```

### 添加设备标签

**接口地址**：`POST /apps/{appId}/devices/{deviceToken}/tags`

**请求体**：
```json
{
  "tag_name": "user_level",
  "tag_value": "premium"
}
```

### 删除设备标签

**接口地址**：`DELETE /apps/{appId}/devices/{deviceToken}/tags`

**Query 参数**：
- `tag_name` - 要删除的标签名称
- `tag_value` - 要删除的标签值（可选）

## 📊 设备数据模型

### Device 对象

```json
{
  "id": 12345,
  "app_id": 123,
  "token": "device_push_token",
  "platform": "ios",
  "brand": "Apple",
  "model": "iPhone 14",
  "system_version": "17.0",
  "app_version": "1.2.0",
  "user_agent": "MyApp/1.2.0 (iPhone; iOS 17.0)",
  "channel": "apns",
  "status": 1,
  "is_online": true,
  "last_seen": "2024-01-01T10:00:00Z",
  "last_heartbeat": "2024-01-01T10:00:00Z",
  "connection_id": "conn_abc123",
  "gateway_node": "gateway-01",
  "created_at": "2024-01-01T09:00:00Z",
  "updated_at": "2024-01-01T10:00:00Z"
}
```

**字段说明**：

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | integer | 设备唯一ID |
| `app_id` | integer | 所属应用ID |
| `token` | string | 设备推送Token |
| `platform` | string | 设备平台：`ios`, `android` |
| `brand` | string | 设备品牌 |
| `model` | string | 设备型号 |
| `system_version` | string | 系统版本 |
| `app_version` | string | 应用版本 |
| `user_agent` | string | 用户代理信息 |
| `channel` | string | 推送通道：`apns`, `fcm`, `huawei` 等 |
| `status` | integer | 设备状态：`0`(禁用), `1`(启用) |
| `is_online` | boolean | 是否在线 |
| `last_seen` | string | 最后活跃时间 |
| `last_heartbeat` | string | 最后心跳时间 |
| `connection_id` | string | 连接ID |
| `gateway_node` | string | 网关节点 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

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
| 401 | 401 | API密钥无效或与应用不匹配 | 检查API Key和应用ID |
| 403 | 403 | 无权限 | 确认API Key具有device权限 |
| 404 | 404 | 设备不存在 | 检查设备ID或Token是否正确 |
| 422 | 422 | Bundle ID与应用包名不匹配 | 确保bundle_id与应用设置一致 |

### 错误示例

**Bundle ID 不匹配**：
```json
{
  "code": 422,
  "message": "Bundle ID与应用包名不匹配",
  "data": null
}
```

**设备不存在**：
```json
{
  "code": 404,
  "message": "设备不存在",
  "data": null
}
```

## 💡 最佳实践

### 设备注册

1. **Token 管理**：
   - 应用启动时检查Token变化
   - Token变化时及时更新注册信息
   - 定期验证Token有效性

2. **信息更新**：
   - 应用版本更新时同步设备信息
   - 系统版本变化时更新版本信息
   - 设备信息变化时及时同步

### 设备状态

1. **状态管理**：
   - 用户关闭推送权限时禁用设备
   - 用户重新开启权限时启用设备
   - 定期清理长期不活跃的设备

2. **在线状态**：
   - 通过心跳机制维护在线状态
   - 根据最后活跃时间判断设备活跃度
   - 离线设备采用不同推送策略

### 标签使用

1. **标签规划**：
   - 建立统一的标签命名规范
   - 合理规划标签层级和分类
   - 避免创建过多无用标签

2. **标签更新**：
   - 用户行为变化时及时更新标签
   - 定期清理过期或无效标签
   - 批量操作时注意性能影响

### 安全考虑

1. **Token 保护**：
   - 不要在日志中记录完整Token
   - 使用HTTPS传输Token信息
   - 定期验证Token有效性

2. **Bundle ID 验证**：
   - 严格验证Bundle ID匹配
   - 防止恶意应用注册设备
   - 监控异常注册行为

## ❓ 常见问题

### Q: 设备Token什么时候会变化？
A: iOS设备在应用重装、系统重置、设备换机时Token会变化；Android设备在应用重装时Token可能变化。

### Q: 如何处理重复注册？
A: 系统会根据Token自动识别重复注册，更新设备信息而不创建新记录。

### Q: 设备离线多久会被清理？
A: 系统不会自动清理离线设备，建议根据业务需求定期清理长期不活跃的设备。

### Q: 标签数量有限制吗？
A: 单个设备建议标签数量不超过50个，标签名称和值长度不超过100个字符。

### Q: 如何批量管理设备？
A: 可以通过设备分组功能实现批量管理，或者使用标签进行分类管理。

---

*设备管理是推送服务的基础，正确的设备信息管理能够确保推送的准确送达和良好的用户体验。*

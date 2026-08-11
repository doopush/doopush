# 设备注册接口

设备注册接口供 SDK 或受信任的业务服务登记推送 Token 和设备信息。设备查询、状态变更、标签管理等 JWT 路由属于 Web 控制台内部接口，不作为公开 API 契约。

## 接口概览

| 接口 | 描述 | 认证 |
|------|------|------|
| `POST /apps/{appId}/devices` | 注册或更新设备 | App Key |

## Base URL

```text
https://doopush.com/api/v1
```

## 注册设备

### 请求信息

**接口地址**：`POST /apps/{appId}/devices`

**请求头**：

```http
X-App-Key: dp_ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

App Key 必须属于路径中的应用，且 `bundle_id` 必须与应用包名一致。

### 请求体

```json
{
  "token": "device_push_token_here",
  "platform": "ios",
  "bundle_id": "com.yourcompany.yourapp",
  "channel": "apns",
  "push_environment": "development",
  "brand": "Apple",
  "model": "iPhone 14 Pro",
  "system_version": "17.0",
  "app_version": "2.1.0",
  "user_agent": "YourApp/2.1.0 (iPhone; iOS 17.0)",
  "tags": [
    { "tag_name": "user_level", "tag_value": "premium" }
  ]
}
```

### 必填参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `token` | string | 设备推送 Token |
| `platform` | string | `ios` 或 `android` |
| `channel` | string | `apns`、`fcm`、`huawei`、`honor`、`xiaomi`、`oppo`、`vivo` 或 `meizu` |
| `bundle_id` | string | 应用包标识符，必须与应用设置一致 |

### 可选参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `push_environment` | string | APNs 环境：`development` 或 `production`。iOS SDK 会自动上报；省略或值为空时按 `production` 保存 |
| `brand` | string | 设备品牌 |
| `model` | string | 设备型号 |
| `system_version` | string | 系统版本 |
| `app_version` | string | 应用版本 |
| `user_agent` | string | 用户代理字符串 |
| `tags` | array | 注册后绑定的设备标签 |

`tags[]` 中的 `tag_name` 和 `tag_value` 均为字符串。标签写入失败不会回滚已经成功的设备注册。

::: tip APNs 环境
开发签名的 iOS 应用应上报 `development`，TestFlight / App Store 应用应上报 `production`。DooPush iOS SDK 会自动识别；自行调用接口时必须确保该值与 Token 所属环境一致，否则 APNs 会拒绝推送。
:::

### 请求示例

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/devices" \
     -H "X-App-Key: dp_ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "token": "abc123def456ghi789...",
       "platform": "ios",
       "channel": "apns",
       "bundle_id": "com.yourcompany.yourapp",
       "push_environment": "development",
       "brand": "Apple",
       "model": "iPhone 14 Pro",
       "system_version": "17.0",
       "app_version": "2.1.0"
     }'
```

### 成功响应

成功时返回 HTTP 201。`data` 为注册后保存的设备对象；相同应用和 Token 再次注册时更新设备信息并重新启用设备。

```json
{
  "code": 201,
  "message": "设备注册成功",
  "data": {
    "id": 12345,
    "app_id": 123,
    "token": "abc123def456ghi789...",
    "platform": "ios",
    "channel": "apns",
    "push_environment": "development",
    "brand": "Apple",
    "model": "iPhone 14 Pro",
    "system_version": "17.0",
    "app_version": "2.1.0",
    "status": 1,
    "created_at": "2026-08-11T10:00:00Z",
    "updated_at": "2026-08-11T10:00:00Z"
  }
}
```

## 错误响应

| HTTP 状态码 | 场景 |
|-------------|------|
| 400 | 请求字段缺失、平台或推送环境取值无效 |
| 401 | App Key 缺失、无效或不属于路径中的应用 |
| 422 | 应用不存在、已禁用、Bundle ID 不匹配或设备保存失败 |

```json
{
  "code": 422,
  "message": "Bundle ID与应用包名不匹配",
  "data": null
}
```

## 最佳实践

- 在应用启动、Token 变化或应用版本变化时重新注册。
- 不要在日志中记录完整 Token。App Key 可以包含在客户端中，但不能用于发送推送或访问管理数据。
- iOS 应用使用官方 SDK 自动上报 APNs 环境，避免开发 Token 和生产 Token 混用。
- 标签较多或需要复杂更新时，应由受信任的服务端统一管理。

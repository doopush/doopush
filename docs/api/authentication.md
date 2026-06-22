# API 认证

DooPush API 使用 **API Key** 进行身份认证。API Key 是一个安全的字符串，用于验证您的身份并确保只有授权的应用程序可以访问您的推送服务。

## 🔑 API Key 概述

### 认证方式

DooPush API 主要使用 **API Key 认证**：
- 🔐 **安全性**：每个应用拥有独立的 API Key
- 🎯 **应用绑定**：API Key 与特定应用一一绑定
- 📊 **使用跟踪**：记录最后使用时间

### API Key 格式

```
dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**格式说明**：
- **前缀**：`dp_live_` (生产环境) 或 `dp_test_` (测试环境)
- **密钥**：32位随机字符串
- **总长度**：40个字符

## 🔧 获取 API Key

### 通过 Web 控制台创建

1. 登录 DooPush 控制台：https://doopush.com
2. 进入 **"应用管理"** 页面
3. 在目标应用所在行末尾点击 **"⋮"** 操作菜单 → 选择 **"API密钥"**
4. 在弹出的对话框中点击 **"创建 API 密钥"** 按钮
5. 填写「密钥名称」（如 `生产环境密钥`）
6. 点击 **"创建"** 按钮
7. **立即复制**并安全保存生成的完整 API Key（**只展示一次**）

::: danger 🔒 重要提醒
API Key 只会在创建时显示一次，请立即复制并安全保存。丢失后需要重新创建。
:::

## 🚀 使用 API Key

### Header 认证（推荐）

在 HTTP 请求头中添加 API Key：

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_your_api_key_here" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "测试推送",
       "content": "这是一条测试消息",
       "target": { "type": "all" }
     }'
```

### Query 参数认证

将 API Key 作为 URL 参数：

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push?api_key=dp_live_your_api_key_here" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "测试推送",
       "content": "这是一条测试消息",
       "target": { "type": "all" }
     }'
```

::: tip 💡 建议使用 Header 认证
Header 认证更安全，不会在 URL 中暴露 API Key，建议优先使用。
:::

## 📋 支持的接口

API Key 仅授予「业务调用」权限，可访问的接口如下；管理类接口（设备列表、推送日志、推送统计、审计日志、应用 / 配置 / 模板管理等）需要登录后获得的 **JWT Token**。

### 推送接口

| 接口 | 描述 |
|------|------|
| `POST /api/v1/apps/{appId}/push` | 发送推送（target 内指定广播 / 设备 / 标签等） |
| `POST /api/v1/apps/{appId}/push/single` | 单设备推送 |
| `POST /api/v1/apps/{appId}/push/batch` | 批量推送 |
| `POST /api/v1/apps/{appId}/push/broadcast` | 广播推送 |

### 设备接口

| 接口 | 描述 |
|------|------|
| `POST /api/v1/apps/{appId}/devices` | 注册设备（SDK 在握手前先调用） |

### 统计上报

| 接口 | 描述 |
|------|------|
| `POST /api/v1/apps/{appId}/push/statistics/report` | 客户端上报推送送达 / 点击事件 |

## 🌍 Base URL

**生产环境**：
```
https://doopush.com/api/v1
```

**API 路径结构**：
```
{baseURL}/apps/{appId}/{resource}/{action}
```

**参数说明**：
- `{appId}` - 应用 ID（数字）
- `{resource}` - 资源类型（push、devices、logs 等）
- `{action}` - 操作类型（send、list、get 等）

## 🔍 请求示例

### 发送推送

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "欢迎使用 DooPush",
       "content": "您的推送服务已经配置成功！",
       "target": { "type": "all" },
       "badge": 1
     }'
```

### 注册设备

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/devices" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "token": "device_token_here",
       "bundle_id": "com.example.app",
       "platform": "ios",
       "channel": "apns",
       "model": "iPhone 14",
       "system_version": "iOS 17.0"
     }'
```

### 上报送达 / 点击事件

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push/statistics/report" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "device_token": "abc123def456...",
       "statistics": [
         { "push_log_id": 12345, "event": "click", "timestamp": 1704110400 }
       ]
     }'
```

## ❌ 错误处理

### 认证错误

当 API Key 认证失败时，会返回以下错误响应：

#### 缺少 API Key

```json
{
  "code": 401,
  "message": "缺少API密钥",
  "data": null
}
```

#### API Key 格式错误

```json
{
  "code": 401,
  "message": "无效的API密钥",
  "data": null
}
```

#### API Key 与应用不匹配

```json
{
  "code": 401,
  "message": "API密钥与应用不匹配",
  "data": null
}
```

## 🔒 安全最佳实践

### 密钥保护

1. **安全存储**：
   - 将 API Key 存储在服务器环境变量中
   - 不要在客户端代码中硬编码 API Key
   - 使用配置文件时确保文件不被版本控制

2. **环境隔离**：
   - 生产环境和测试环境使用不同的 API Key
   - 不同业务/服务建议使用独立的 API Key

3. **定期轮换**：
   - 定期更新 API Key（建议每 3-6 个月）
   - 有安全事件时立即更换 API Key
   - 更新后及时删除旧的 API Key

### 网络安全

1. **HTTPS 传输**：
   - 始终使用 HTTPS 协议
   - 避免在不安全的网络环境中传输 API Key

2. **请求监控**：
   - 监控 API Key 的使用情况
   - 设置异常使用告警
   - 定期查看访问日志

### 代码示例

**环境变量配置**：
```bash
# .env 文件
DOOPUSH_API_KEY=dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DOOPUSH_APP_ID=123
```

**Node.js 示例**：
```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://doopush.com/api/v1',
  headers: {
    'X-API-Key': process.env.DOOPUSH_API_KEY,
    'Content-Type': 'application/json'
  }
});

// 发送推送
async function sendPush(appId, pushData) {
  try {
    const response = await client.post(`/apps/${appId}/push`, pushData);
    return response.data;
  } catch (error) {
    console.error('推送发送失败:', error.response?.data);
    throw error;
  }
}
```

**Python 示例**：
```python
import os
import requests

class DooPushClient:
    def __init__(self):
        self.api_key = os.getenv('DOOPUSH_API_KEY')
        self.base_url = 'https://doopush.com/api/v1'
        self.headers = {
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        }
    
    def send_push(self, app_id, push_data):
        url = f"{self.base_url}/apps/{app_id}/push"
        response = requests.post(url, json=push_data, headers=self.headers)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"推送发送失败: {response.text}")
```

## 🔧 调试指南

### 验证 API Key

API Key 不能访问 GET 类管理接口，可通过发起一次广播推送来验证（命中 0 设备时返回 422 但 Key 仍判定为有效；Key 无效则返回 401）：

```bash
curl -X POST "https://doopush.com/api/v1/apps/123/push" \
     -H "X-API-Key: dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "ping",
       "content": "ping",
       "target": { "type": "all" }
     }'
```

返回 200 / 422 表示 Key 有效，返回 401 表示 Key 无效或与应用不匹配。

### 常见问题排查

1. **401 错误**：
   - 检查 API Key 是否正确
   - 验证 API Key 是否属于该应用
   - 确认应用 ID 是否正确

2. **404 错误**：
   - 检查 URL 路径是否正确
   - 确认应用 ID 是否存在

## ❓ 常见问题

### Q: API Key 丢失了怎么办？
A: API Key 只在创建时显示一次，丢失后需要创建新的 API Key，然后删除旧的。

### Q: 一个应用可以有多个 API Key 吗？
A: 可以。一个应用可以创建多个 API Key，用于不同的环境或用途。

### Q: 如何知道 API Key 是否被泄露？
A: 可以查看 API Key 的最后使用时间，如果发现异常使用立即更换。

### Q: Header 认证和 Query 参数认证有什么区别？
A: Header 认证更安全，不会在 URL 中暴露 API Key，建议优先使用。

---

*API Key 是访问 DooPush 服务的重要凭证，请务必妥善保管并遵循安全最佳实践。*

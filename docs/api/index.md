# API 文档

DooPush 公开 REST API 供第三方业务发送推送、注册设备和上报点击 / 打开事件。

## 🔑 认证方式

公开 API 使用 **API Key**（`X-API-Key` 头或 `?api_key=`）认证。API Key 与应用绑定且不再分级，可调用本文档列出的推送、设备注册和统计上报接口。

::: warning 控制台内部接口
Web 控制台还会调用一组 JWT 管理路由，用于应用、成员、配置、设备查询、模板、分组、定时任务、日志和审计等功能。这些路由属于内部实现，不作为公开 API 契约，也不承诺兼容性；第三方集成不应依赖。
:::

## 📚 API 文档目录

### 🔐 认证相关
- [**API 认证**](./authentication.md) - API Key 获取和使用方法

### 📨 推送相关
- [**推送接口**](./push-apis.md) - 单推、批量、广播推送 API

### 📱 设备相关
- [**设备注册**](./device-apis.md) - 注册或更新设备 Token 与环境

### 📊 数据相关
- [**统计上报**](./data-apis.md) - 上报推送点击与打开事件

## 🌐 API 基础信息

- **Base URL**: `https://doopush.com/api/v1`
- **认证方式**: API Key（Header 或 Query 参数）
- **数据格式**: JSON
- **字符编码**: UTF-8

## 🛠 快速开始

1. 首先阅读 [API 认证](./authentication.md) 了解如何获取 API Key
2. 查看 [推送接口](./push-apis.md) 了解如何发送推送
3. 参考具体接口文档中的代码示例

---

*所有 API 文档基于当前生产环境的实际接口，确保内容准确可用。*

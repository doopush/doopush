# API 文档

DooPush 提供完整的 REST API 接口，支持通过程序化方式实现推送功能。

## 🔑 认证方式

DooPush API 使用 **API Key** 进行认证，支持以下功能：

- ✅ 推送消息发送（单推、批量、广播）
- ✅ 设备管理（注册、查询、分组、标签）
- ✅ 数据查询（推送日志、统计、审计）
- ✅ 配置管理

## 📚 API 文档目录

### 🔐 认证相关
- [**API 认证**](./authentication.md) - API Key 获取和使用方法

### 📨 推送相关
- [**推送接口**](./push-apis.md) - 单推、批量、广播推送 API

### 📱 设备相关  
- [**设备接口**](./device-apis.md) - 设备注册、查询、分组、标签 API

### 📊 数据相关
- [**数据接口**](./data-apis.md) - 推送统计、日志、审计数据查询 API

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

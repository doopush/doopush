# DooPush 推送平台

一个现代化的推送通知管理平台，支持 iOS 和 Android 多平台推送。

## 快速开始

### 环境要求

- Go 1.24+
- Node.js 20+
- Docker & Docker Compose
- MySQL 8.0
- Redis 7

### 准备项目

```bash
# 克隆项目
git clone https://github.com/doopush/doopush.git
cd doopush

# 修改.env文件中的GATEWAY_HOST为你的IP地址，例如：GATEWAY_HOST=192.168.1.7

# 安装依赖
make install
```

### 一键启动

```bash
# 一键启动完整开发环境（包含数据库、后端、前端）
make dev
```

### 手动启动


```bash
# 1. 启动数据库服务
docker-compose up -d

# 2. 启动后端服务
make api-dev

# 3. 启动网关服务
make api-gateway

# 4. 启动前端服务
make web-dev
```

## 项目结构

```
doopush/
├── web/          # 前端管理平台 (React + TypeScript)
├── api/          # 后端API服务 (Go + Gin)
├── sdk/          # 移动端SDK
└── docker-compose.yml  # 数据库服务
```

## 帮助命令

```bash
# 查看所有可用命令
make help
```

## 配置说明

项目配置在 `.env` 文件中，主要包含：
- 端口配置 (前端: 5001, 后端: 5002, 网关: 5003)
- 数据库配置 (MySQL: 33065, Redis: 63795)
- JWT 密钥配置

## 开发规范

- 前端：基于 shadcn-admin 模板，使用 TypeScript + Tailwind CSS
- 后端：Go + Gin + GORM，遵循 RESTful API 设计
- 数据架构：用户 -> 应用 -> 推送 (三层架构)
- 所有 API 接口都有完整的 Swagger 文档

## 许可证

MIT License

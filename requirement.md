# 推送平台需求文档

## 介绍

本推送平台旨在为移动应用提供统一的推送通知服务，支持iOS平台和多个Android厂商通道。平台将提供统一的API接口，自动路由到相应的推送服务提供商，确保消息能够可靠地送达到用户设备。

## 项目结构

```
doopush/
├── web/                    # 前端管理平台 (shadcn-admin)
│   ├── src/
│   │   ├── components/    # UI组件
│   │   ├── features/      # 功能模块 (按业务分组)
│   │   ├── routes/        # 页面路由 (TanStack Router)
│   │   ├── services/      # API服务调用
│   │   ├── types/         # TypeScript类型定义
│   │   ├── stores/        # 状态管理 (Zustand)
│   │   ├── hooks/         # 自定义Hooks
│   │   └── utils/         # 工具函数
│   ├── public/            # 静态资源
│   └── ...                # Vite + React配置文件
├── sdk/                   # 移动端SDK服务
│   ├── ios/
│   └── android/
├── api/                   # 后端API服务
│   ├── cmd/               # 命令行入口 (Cobra)
│   │   ├── root.go        # 根命令配置
│   │   └── serve.go       # API服务器命令
│   ├── internal/          # 内部包
│   │   ├── controllers/   # 控制器层
│   │   ├── services/      # 业务逻辑层
│   │   ├── models/        # 数据模型
│   │   ├── middleware/    # 中间件
│   │   ├── config/        # 配置管理 (Viper)
│   │   ├── database/      # 数据库连接
│   │   └── push/          # 推送服务集成
│   ├── pkg/               # 公共包
│   │   ├── utils/         # 工具函数
│   │   ├── logger/        # 日志包
│   │   └── response/      # 统一响应格式
│   ├── docs/              # Swagger生成的文档
│   ├── go.mod            # Go模块定义
│   ├── go.sum            # Go依赖锁定
│   └── main.go           # 应用入口
├── .env                   # 环境变量配置
├── docker-compose.yml     # 数据库服务
└── Makefile              # 全项目构建脚本
```

## 核心数据结构

本系统采用分层数据结构设计：`用户(User) -> 应用(App) -> 推送(Push)`

### 数据层次关系

1. **用户层级 (User Level)**
   - 平台管理员可以管理多个应用
   - 支持基于角色的权限控制
   - 用户与应用的多对多关系

2. **应用层级 (App Level)**  
   - 每个应用拥有独立的推送配置
   - 应用间数据完全隔离
   - 应用拥有独立的API密钥和权限

3. **推送层级 (Push Level)**
   - 推送消息归属于特定应用
   - 设备token与应用关联
   - 推送统计按应用维度统计

## 技术栈

**前端管理平台 (web/)：**
- Next.js - React框架
- Tailwind CSS - 样式框架  
- shadcn/ui - UI组件库
- shadcn-admin - 基于shadcn/ui的管理后台模板 (https://github.com/satnaing/shadcn-admin)
- TypeScript - 类型安全
- Axios - HTTP客户端 (统一网络请求)

**后端服务 (api/)：**
- Go语言 - 主要开发语言
- Gin - Web框架
- GORM - ORM框架
- MySQL - 数据库
- Cobra - 命令行框架
- Viper - 配置管理
- Docker - 容器化部署
- JWT - 身份认证
- Swagger - API文档自动生成 (swag工具链)

## 数据库设计

### 核心数据表结构

基于 `用户 -> 应用 -> 推送` 的分层架构，数据库设计如下：

```sql
-- 用户表
CREATE TABLE users (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(50) UNIQUE NOT NULL,
  email        VARCHAR(100) UNIQUE NOT NULL,
  password     VARCHAR(255) NOT NULL,
  role         VARCHAR(20) DEFAULT 'admin' COMMENT 'admin, developer',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 应用表
CREATE TABLE apps (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  package_name VARCHAR(200) NOT NULL,
  status       VARCHAR(20) DEFAULT 'active' COMMENT 'active, inactive',
  created_by   BIGINT UNSIGNED NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_apps_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_created_by (created_by),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 应用 API Key 表（支持多密钥与轮换）
CREATE TABLE app_api_keys (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id       BIGINT UNSIGNED NOT NULL,
  key_id       VARCHAR(64) NOT NULL,
  key_hash     VARCHAR(255) NOT NULL COMMENT 'API Key 的哈希值（例如SHA-256）',
  name         VARCHAR(100),
  is_active    BOOLEAN DEFAULT TRUE,
  expires_at   TIMESTAMP NULL,
  last_used_at TIMESTAMP NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_api_keys_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  UNIQUE KEY uk_app_key (app_id, key_id),
  INDEX idx_active_exp (is_active, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户应用关联表 (多对多关系)
CREATE TABLE user_apps (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  app_id       BIGINT UNSIGNED NOT NULL,
  role         VARCHAR(20) DEFAULT 'developer' COMMENT 'owner, developer, viewer',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_apps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_apps_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_app (user_id, app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 应用推送配置表
CREATE TABLE app_push_configs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id       BIGINT UNSIGNED NOT NULL,
  platform     VARCHAR(20) NOT NULL COMMENT 'ios, android',
  provider     VARCHAR(50) NOT NULL COMMENT 'apns, fcm, huawei, xiaomi, oppo, vivo, honor, samsung',
  environment  ENUM('dev','prod') DEFAULT 'prod' COMMENT '仅对 APNs 等区分环境的通道生效',
  config_data  JSON NOT NULL COMMENT '推送配置数据',
  is_enabled   BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_push_cfg_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  UNIQUE KEY uk_app_platform_provider_env (app_id, platform, provider, environment),
  INDEX idx_app_enabled (app_id, is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 设备表
CREATE TABLE devices (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id       BIGINT UNSIGNED NOT NULL,
  user_id      VARCHAR(100) COMMENT '应用内用户ID',
  device_id    VARCHAR(200) NOT NULL,
  token        VARCHAR(500) NOT NULL,
  token_hash   CHAR(64) NOT NULL COMMENT 'token 的 SHA-256，便于唯一约束与索引',
  platform     VARCHAR(20) NOT NULL COMMENT 'ios, android',
  vendor       VARCHAR(50) COMMENT 'huawei, xiaomi, oppo, vivo, honor, samsung',
  is_active    BOOLEAN DEFAULT TRUE,
  last_active  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_devices_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  INDEX idx_app_user (app_id, user_id),
  INDEX idx_app_platform (app_id, platform),
  UNIQUE KEY uk_app_device (app_id, device_id),
  UNIQUE KEY uk_app_platform_token (app_id, platform, token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 推送记录表
CREATE TABLE push_logs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id        BIGINT UNSIGNED NOT NULL,
  message_id    VARCHAR(100) NOT NULL,
  dedup_key     VARCHAR(100) NULL COMMENT '幂等去重键，可选',
  target_type   VARCHAR(20) NOT NULL COMMENT 'single, batch, broadcast',
  platform      VARCHAR(20) NOT NULL,
  provider      VARCHAR(50) NOT NULL,
  title         VARCHAR(200),
  content       TEXT,
  extra_data    JSON COMMENT '额外数据',
  total_count   INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count  INT DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, processing, completed, failed',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_push_logs_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  UNIQUE KEY uk_app_message (app_id, message_id),
  INDEX idx_app_created (app_id, created_at),
  INDEX idx_status (status),
  INDEX idx_dedup (dedup_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 推送结果明细表
CREATE TABLE push_results (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id        BIGINT UNSIGNED NOT NULL,
  push_log_id   BIGINT UNSIGNED NOT NULL,
  device_id     BIGINT UNSIGNED NULL,
  status        VARCHAR(20) NOT NULL COMMENT 'success, failed',
  error_code    VARCHAR(50),
  error_message TEXT,
  sent_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_log FOREIGN KEY (push_log_id) REFERENCES push_logs(id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
  INDEX idx_push_log (push_log_id),
  INDEX idx_device (device_id),
  INDEX idx_app_push (app_id, push_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 消息模板表
CREATE TABLE message_templates (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id       BIGINT UNSIGNED NOT NULL,
  name         VARCHAR(100) NOT NULL,
  title        VARCHAR(200),
  content      TEXT NOT NULL,
  variables    JSON COMMENT '变量定义',
  platform     VARCHAR(20) COMMENT 'ios, android, all',
  locale       VARCHAR(10) DEFAULT 'zh-CN',
  version      INT DEFAULT 1,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   BIGINT UNSIGNED NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_templates_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  CONSTRAINT fk_templates_user FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uk_app_name_locale_ver (app_id, name, locale, version),
  INDEX idx_app_active (app_id, is_active),
  INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户标签表
CREATE TABLE user_tags (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id       BIGINT UNSIGNED NOT NULL,
  user_id      VARCHAR(100) NOT NULL COMMENT '应用内用户ID',
  tag_name     VARCHAR(100) NOT NULL,
  tag_value    VARCHAR(200),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_tags_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  UNIQUE KEY uk_app_user_tag (app_id, user_id, tag_name, tag_value),
  INDEX idx_app_user (app_id, user_id),
  INDEX idx_app_tag (app_id, tag_name),
  INDEX idx_tag_value (tag_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 设备分组表
CREATE TABLE device_groups (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id       BIGINT UNSIGNED NOT NULL,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  filter_rules JSON NOT NULL COMMENT '筛选规则',
  device_count INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   BIGINT UNSIGNED NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dev_groups_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  CONSTRAINT fk_dev_groups_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_app_active (app_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 定时推送任务表
CREATE TABLE scheduled_pushes (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id        BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  template_id   BIGINT UNSIGNED NULL,
  target_type   VARCHAR(20) NOT NULL COMMENT 'group, tag, all',
  target_value  VARCHAR(200) COMMENT '目标群组ID或标签名',
  schedule_time TIMESTAMP NOT NULL,
  timezone      VARCHAR(50) DEFAULT 'UTC',
  repeat_type   VARCHAR(20) DEFAULT 'once' COMMENT 'once, daily, weekly, monthly',
  cron_expr     VARCHAR(200) NULL COMMENT '可选，复杂周期调度表达式',
  next_run_at   TIMESTAMP NULL,
  last_run_at   TIMESTAMP NULL,
  status        VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, active, paused, completed',
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sched_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  CONSTRAINT fk_sched_tpl FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_sched_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_app_schedule (app_id, schedule_time),
  INDEX idx_app_status (app_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 推送统计汇总表 (按日聚合)
CREATE TABLE push_statistics (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id         BIGINT UNSIGNED NOT NULL,
  date           DATE NOT NULL,
  platform       VARCHAR(20) NOT NULL,
  provider       VARCHAR(50) NOT NULL,
  total_pushes   INT DEFAULT 0,
  success_pushes INT DEFAULT 0,
  failed_pushes  INT DEFAULT 0,
  unique_devices INT DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_stats_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  UNIQUE KEY uk_app_date_platform (app_id, date, platform, provider),
  INDEX idx_app_date (app_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 操作审计日志表
CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  app_id       BIGINT UNSIGNED NULL,
  action       VARCHAR(50) NOT NULL COMMENT 'create, update, delete, push',
  resource     VARCHAR(50) NOT NULL COMMENT 'app, device, push, config',
  resource_id  VARCHAR(100),
  old_data     JSON COMMENT '旧数据',
  new_data     JSON COMMENT '新数据',
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_audit_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE SET NULL,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_app_created (app_id, created_at),
  INDEX idx_action_created (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 推送队列表
CREATE TABLE push_queue (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  app_id         BIGINT UNSIGNED NOT NULL,
  priority       INT DEFAULT 5 COMMENT '1-10, 数字越小优先级越高',
  payload        JSON NOT NULL COMMENT '推送数据',
  max_retries    INT DEFAULT 3,
  retry_count    INT DEFAULT 0,
  status         VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, processing, completed, failed, retrying',
  scheduled_at   TIMESTAMP NOT NULL,
  started_at     TIMESTAMP NULL,
  completed_at   TIMESTAMP NULL,
  attempted_at   TIMESTAMP NULL,
  locked_by      VARCHAR(100) NULL,
  lock_expires_at TIMESTAMP NULL,
  error_message  TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_queue_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  INDEX idx_app_status_priority (app_id, status, priority),
  INDEX idx_scheduled_status (scheduled_at, status),
  INDEX idx_status_locked (status, locked_by, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统配置表
CREATE TABLE system_configs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  config_key    VARCHAR(100) UNIQUE NOT NULL,
  config_value  TEXT NOT NULL,
  description   TEXT,
  is_encrypted  BOOLEAN DEFAULT FALSE,
  updated_by    BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_syscfg_user FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 数据结构完整性分析

基于推送平台的功能需求，当前数据库设计覆盖了以下核心功能域：

#### ✅ 完全覆盖的功能
1. **用户权限管理**: users, user_apps 表支持多租户和权限控制
2. **应用多租户**: apps 表实现应用隔离，app_push_configs 支持独立配置
3. **设备管理**: devices 表支持多平台设备注册和状态管理
4. **推送执行**: push_logs, push_results 表记录完整的推送流程
5. **消息模板**: message_templates 表支持模板化和个性化推送
6. **用户标签**: user_tags 表支持精准推送和用户分群
7. **设备分组**: device_groups 表支持批量推送和设备管理
8. **定时推送**: scheduled_pushes 表支持计划任务和重复推送
9. **性能统计**: push_statistics 表预聚合数据，提升查询性能
10. **安全审计**: audit_logs 表记录所有操作，满足合规要求
11. **异步处理**: push_queue 表支持大规模推送的队列处理
12. **系统配置**: system_configs 表统一管理全局配置

#### 📊 数据关系映射
```
用户层级:
  users → user_apps → apps (权限控制)
  
应用层级:
  apps → app_push_configs (推送配置)
  apps → message_templates (消息模板)
  apps → device_groups (设备分组)
  apps → scheduled_pushes (定时任务)
  
推送层级:
  apps → devices (设备管理)
  apps → push_logs → push_results (推送执行)
  apps → push_queue (队列处理)
  apps → user_tags (用户标签)
  apps → push_statistics (统计数据)
  
系统层级:
  audit_logs (审计跟踪)
  system_configs (全局配置)
```

#### 🎯 功能覆盖度评估
- **基础推送功能**: 100% 覆盖
- **多应用管理**: 100% 覆盖
- **用户权限控制**: 100% 覆盖
- **消息个性化**: 100% 覆盖
- **批量和定时推送**: 100% 覆盖
- **统计和监控**: 100% 覆盖
- **安全和审计**: 100% 覆盖
- **性能优化**: 100% 覆盖

#### ⚡ 性能考虑
- 核心查询都有相应索引支持
- 统计数据预聚合减少实时计算
- 队列表支持异步处理大量推送
- 分区策略可按app_id进行数据分区

## API接口规范

### 认证方式
- 管理平台：JWT Token认证
- 推送API：API Key + Secret认证

### 错误处理规范
遵循统一的HTTP状态码和错误响应格式：

```json
{
  "code": "ERROR_CODE",
  "message": "错误描述信息",
  "data": null
}
```

**状态码规范：**
- 200: 操作成功
- 400: 请求格式错误
- 401: 认证错误（自动跳转登录）
- 403: 权限错误
- 422: 数据验证错误
- 500: 服务器内部错误

### 核心API接口

#### 1. 应用管理 API
```
GET    /api/v1/apps                    # 获取应用列表
POST   /api/v1/apps                    # 创建应用
GET    /api/v1/apps/:id                # 获取应用详情
PUT    /api/v1/apps/:id                # 更新应用信息
DELETE /api/v1/apps/:id                # 删除应用
```

#### 2. 设备管理 API
```
GET    /api/v1/apps/:appId/devices           # 获取应用设备列表
POST   /api/v1/apps/:appId/devices           # 注册设备
PUT    /api/v1/apps/:appId/devices/:deviceId # 更新设备信息
DELETE /api/v1/apps/:appId/devices/:deviceId # 删除设备
```

#### 3. 推送服务 API
```
POST   /api/v1/apps/:appId/push/single       # 单设备推送
POST   /api/v1/apps/:appId/push/batch        # 批量推送
POST   /api/v1/apps/:appId/push/broadcast    # 广播推送
GET    /api/v1/apps/:appId/push/logs         # 推送日志查询
GET    /api/v1/apps/:appId/push/stats        # 推送统计数据
```

#### 4. 配置管理 API
```
GET    /api/v1/apps/:appId/configs           # 获取推送配置
PUT    /api/v1/apps/:appId/configs           # 更新推送配置
POST   /api/v1/apps/:appId/configs/test      # 测试推送配置
```

#### 5. 消息模板 API
```
GET    /api/v1/apps/:appId/templates         # 获取模板列表
POST   /api/v1/apps/:appId/templates         # 创建消息模板
GET    /api/v1/apps/:appId/templates/:id     # 获取模板详情
PUT    /api/v1/apps/:appId/templates/:id     # 更新消息模板
DELETE /api/v1/apps/:appId/templates/:id     # 删除消息模板
```

#### 6. 用户标签管理 API
```
GET    /api/v1/apps/:appId/users/:userId/tags     # 获取用户标签
POST   /api/v1/apps/:appId/users/:userId/tags     # 添加用户标签
DELETE /api/v1/apps/:appId/users/:userId/tags/:tagName  # 删除用户标签
GET    /api/v1/apps/:appId/tags               # 获取所有标签统计
```

#### 7. 设备分组管理 API
```
GET    /api/v1/apps/:appId/device-groups     # 获取设备分组列表
POST   /api/v1/apps/:appId/device-groups     # 创建设备分组
GET    /api/v1/apps/:appId/device-groups/:id # 获取分组详情和设备列表
PUT    /api/v1/apps/:appId/device-groups/:id # 更新设备分组
DELETE /api/v1/apps/:appId/device-groups/:id # 删除设备分组
```

#### 8. 定时推送管理 API
```
GET    /api/v1/apps/:appId/scheduled-pushes  # 获取定时任务列表
POST   /api/v1/apps/:appId/scheduled-pushes  # 创建定时推送
GET    /api/v1/apps/:appId/scheduled-pushes/:id    # 获取任务详情
PUT    /api/v1/apps/:appId/scheduled-pushes/:id    # 更新定时推送
DELETE /api/v1/apps/:appId/scheduled-pushes/:id    # 删除定时推送
POST   /api/v1/apps/:appId/scheduled-pushes/:id/pause   # 暂停任务
POST   /api/v1/apps/:appId/scheduled-pushes/:id/resume  # 恢复任务
```

#### 9. 审计日志 API
```
GET    /api/v1/audit-logs                    # 获取审计日志 (管理员)
GET    /api/v1/apps/:appId/audit-logs        # 获取应用审计日志
```

## 前端架构设计

### 页面结构
- **应用管理页面**: 应用列表、创建应用、应用配置
- **设备管理页面**: 设备列表、设备详情、设备状态监控
- **推送管理页面**: 发送推送、推送模板、推送历史
- **统计分析页面**: 推送统计、设备分析、性能监控
- **系统设置页面**: 用户管理、权限配置、系统配置

### 组件设计原则
- 优先使用 shadcn/ui 组件库
- 使用 Tailwind CSS 进行样式设计
- 右侧内容区域采用全宽布局
- 确认操作统一使用 Dialog 组件，不使用原生 alert 或 confirm
- 避免使用 'any' 类型，保持TypeScript类型安全

### 状态管理
- 使用 Context API 管理全局状态
- 应用切换状态管理
- 用户认证状态管理
- 推送任务状态跟踪

## 需求

### 需求 1 - iOS推送支持

**用户故事：** 作为开发者，我希望能够向iOS设备发送推送通知，以便及时通知用户重要信息。

#### 验收标准

1. 当开发者调用推送API时，系统应当能够通过Apple Push Notification Service (APNs)发送通知到iOS设备
2. 当iOS设备token无效时，系统应当返回相应的错误信息并记录日志
3. 当推送消息包含标题、内容和自定义数据时，系统应当正确格式化并发送到iOS设备
4. 当需要发送静默推送时，系统应当支持content-available标志

### 需求 2 - Android厂商通道支持

**用户故事：** 作为开发者，我希望能够通过各大Android厂商的推送通道发送通知，以提高消息到达率和用户体验。

#### 验收标准

1. 当目标设备为华为设备时，系统应当通过华为推送服务(HMS Push)发送通知
2. 当目标设备为小米设备时，系统应当通过小米推送服务(Mi Push)发送通知  
3. 当目标设备为OPPO设备时，系统应当通过OPPO推送服务(ColorOS Push)发送通知
4. 当目标设备为VIVO设备时，系统应当通过VIVO推送服务(Funtouch OS Push)发送通知
5. 当目标设备为荣耀设备时，系统应当通过荣耀推送服务(Honor Push)发送通知
6. 当目标设备为三星设备时，系统应当通过三星推送服务(Samsung Push Service)发送通知
7. 当无法识别设备厂商时，系统应当使用Firebase Cloud Messaging (FCM)作为默认通道

### 需求 3 - 统一API接口

**用户故事：** 作为开发者，我希望使用统一的API接口发送推送，而不需要关心底层的推送服务提供商差异，并且能够管理多个应用的推送服务。

#### 验收标准

1. 当开发者调用推送API时，系统应当提供统一的请求格式，包含应用ID、设备标识、消息内容、目标平台等信息
2. 当系统接收到推送请求时，应当根据应用ID验证权限，并根据设备信息自动选择合适的推送通道
3. 当推送完成时，系统应当返回统一格式的响应，包含推送状态和消息ID
4. 当推送失败时，系统应当返回详细的错误信息和错误代码
5. 当API认证时，系统应当根据API密钥识别对应的应用，确保只能操作授权的应用数据
6. 当提供应用管理API时，系统应当支持创建、更新、删除和查询应用配置的接口
7. 当切换应用上下文时，系统应当确保所有操作都在正确的应用范围内执行

### 需求 4 - 设备管理

**用户故事：** 作为开发者，我希望能够管理设备token和设备信息，以便准确地向目标设备发送推送，并且每个应用的设备数据需要相互隔离。

#### 验收标准

1. 当用户注册设备时，系统应当存储设备token、平台类型、厂商信息和应用标识，确保设备与特定应用关联
2. 当设备token更新时，系统应当能够更新存储的设备信息，并维护应用关联关系
3. 当设备token失效时，系统应当能够标记或删除无效的设备记录，仅影响对应应用的设备数据
4. 当查询设备信息时，系统应当能够根据应用ID和用户ID或设备ID返回相关设备列表，确保应用间数据隔离
5. 当管理多应用设备时，系统应当提供按应用筛选和管理设备的功能
6. 当同一设备安装多个应用时，系统应当支持同一设备在不同应用下的独立管理

### 需求 5 - 批量推送

**用户故事：** 作为开发者，我希望能够批量发送推送通知，以提高推送效率和系统性能。

#### 验收标准

1. 当需要向多个设备发送相同消息时，系统应当支持批量推送接口
2. 当批量推送时，系统应当根据设备平台和厂商自动分组处理
3. 当批量推送完成时，系统应当返回每个设备的推送结果统计
4. 当部分设备推送失败时，系统应当继续处理其他设备并记录失败详情

### 需求 6 - 推送统计和监控

**用户故事：** 作为开发者，我希望能够查看推送统计数据和监控推送服务状态，以便优化推送策略。

#### 验收标准

1. 当推送消息发送时，系统应当记录推送日志，包含时间戳、目标设备、消息内容和推送结果
2. 当查询推送统计时，系统应当提供按时间段、平台、厂商维度的统计数据
3. 当推送服务异常时，系统应当记录错误日志并提供告警机制
4. 当需要监控系统健康状态时，系统应当提供健康检查接口

### 需求 7 - 消息模板和个性化

**用户故事：** 作为开发者，我希望能够使用消息模板和个性化内容，以提供更好的用户体验。

#### 验收标准

1. 当创建推送消息时，系统应当支持消息模板，包含占位符和默认值
2. 当发送个性化消息时，系统应当能够根据用户数据替换模板中的占位符
3. 当消息包含多语言内容时，系统应当根据设备语言设置选择合适的消息内容
4. 当消息需要富媒体内容时，系统应当支持图片、声音等附件

### 需求 8 - 管理平台界面

**用户故事：** 作为系统管理员，我希望有一个直观的Web管理界面来配置和管理推送服务，以便高效地进行日常运维工作，并且能够方便地管理多个应用。

#### 验收标准

1. 当管理员访问管理平台时，系统应当提供基于Next.js和shadcn-admin模板的响应式Web界面
2. 当配置推送服务时，系统应当提供友好的表单界面，使用shadcn/ui组件库构建
3. 当查看推送统计时，系统应当提供图表和数据展示，使用Tailwind CSS进行样式设计
4. 当操作界面时，系统应当提供TypeScript类型安全和良好的开发体验
5. 当管理多个应用时，系统应当在界面上提供应用选择器，支持快速切换不同应用的管理视图
6. 当使用shadcn-admin模板时，系统应当包含完整的管理后台功能，如用户管理、权限控制、数据展示等
7. 当展示数据时，系统应当按应用维度组织信息，确保界面清晰易用
8. 当进行应用配置时，系统应当提供直观的配置向导和验证反馈

### 需求 9 - 后端API服务

**用户故事：** 作为开发者，我希望有一个高性能的后端API服务来处理推送请求和数据管理。

#### 验收标准

1. 当处理推送请求时，系统应当使用Go语言和Gin框架提供高性能的API服务
2. 当操作数据库时，系统应当使用GORM进行数据模型管理和查询操作
3. 当存储数据时，系统应当使用MySQL数据库进行高性能数据存储
4. 当提供API接口时，系统应当支持RESTful API设计规范

### 需求 10 - 安全和认证

**用户故事：** 作为系统管理员，我希望推送平台具有完善的安全机制，以防止未授权访问和数据泄露。

#### 验收标准

1. 当调用推送API时，系统应当验证API密钥或JWT token的有效性
2. 当存储敏感信息时，系统应当对推送证书、密钥等信息进行加密存储
3. 当传输数据时，系统应当使用HTTPS协议确保数据传输安全
4. 当访问系统时，系统应当记录操作日志，包含用户身份、操作时间和操作内容

### 需求 11 - 多应用支持

**用户故事：** 作为平台管理员，我希望能够在同一个推送平台上管理多个应用程序，每个应用程序都有独立的推送配置和设备管理，以便为不同的产品提供隔离的推送服务。

#### 验收标准

1. 当创建新应用时，系统应当为每个应用分配唯一的应用ID和API密钥
2. 当配置推送服务时，系统应当支持为每个应用单独配置iOS证书、Android厂商渠道密钥等信息
3. 当管理设备时，系统应当按应用隔离设备数据，确保不同应用的设备信息不会混淆
4. 当发送推送时，系统应当根据应用ID自动使用对应应用的推送配置和设备列表
5. 当查看统计数据时，系统应当提供按应用维度的统计报告和监控数据
6. 当管理用户权限时，系统应当支持为不同用户分配不同应用的管理权限
7. 当在管理平台操作时，系统应当提供应用切换功能，允许管理员在不同应用间快速切换
8. 当删除应用时，系统应当安全地清理该应用的所有相关数据，包括设备信息、推送记录和配置数据

### 需求 12 - 分层数据架构实现

**用户故事：** 作为系统架构师，我希望系统严格按照"用户 -> 应用 -> 推送"的分层数据结构进行设计和实现，确保数据的层次性和隔离性。

#### 验收标准

1. 当用户访问系统时，系统应当基于用户身份返回其有权限访问的应用列表
2. 当用户选择应用时，系统应当切换到该应用的上下文，所有后续操作都在该应用范围内进行
3. 当执行推送操作时，系统应当确保推送数据与当前应用强关联，不能跨应用操作
4. 当查询数据时，系统应当按照用户 -> 应用 -> 推送的层次过滤数据
5. 当进行权限验证时，系统应当验证用户对特定应用的操作权限
6. 当数据存储时，系统应当维护清晰的外键关联关系和数据完整性约束
7. 当删除上层数据时，系统应当级联处理下层关联数据或阻止删除操作

### 需求 13 - 前后端项目分离

**用户故事：** 作为开发团队，我希望前后端项目完全分离，各自独立开发、部署和维护，提高开发效率和系统可扩展性。

#### 验收标准

1. 当开发前端时，前端项目 (web/) 应当独立于后端项目运行和构建
2. 当开发后端时，后端项目 (api/) 应当独立于前端项目运行和测试
3. 当前端调用后端时，应当通过配置的API基础地址进行网络请求
4. 当部署系统时，前后端应当支持独立部署到不同的服务器或容器
5. 当开发环境配置时，前后端应当各自拥有独立的依赖管理和构建脚本
6. 当版本控制时，前后端应当能够独立进行版本发布和回滚
7. 当API接口变更时，应当通过OpenAPI/Swagger文档进行接口契约管理

### 需求 14 - 部署和运维

**用户故事：** 作为运维工程师，我希望系统具备完善的部署配置和监控能力，确保生产环境的稳定运行。

#### 验收标准

1. 当部署前端时，系统应当提供Docker配置文件和构建脚本
2. 当部署后端时，系统应当提供独立的Docker镜像和启动配置
3. 当配置环境时，系统应当支持通过环境变量进行配置管理
4. 当监控系统时，系统应当提供健康检查接口和日志收集机制
5. 当扩展服务时，系统应当支持水平扩展和负载均衡
6. 当备份数据时，系统应当提供数据库备份和恢复机制
7. 当升级系统时，系统应当支持滚动更新和版本回滚

## 环境配置

### .env 配置文件

项目使用 `.env` 文件进行环境变量配置管理，只包含必要的数据库和缓存配置。

**配置内容：**
- **数据库配置**: MySQL 连接参数  
- **Redis配置**: 缓存和队列服务

**配置原则：**
- 保持 `.env` 文件简洁，只包含基础服务配置
- 推送服务配置存储在数据库 `app_push_configs` 表中
- 应用级配置通过管理平台界面进行可视化配置
- 其他系统配置在代码中使用合理默认值

### Docker 容器化部署

`docker-compose.yml` 配置了 MySQL 和 Redis 服务，使用 `.env` 文件中的变量：

**服务组成：**
- **MySQL 8.0**: 主数据库，支持 utf8mb4 字符集
- **Redis 7**: 缓存和队列服务

**启动命令：**
```bash
# 启动所有服务
docker-compose up -d

# 只启动数据库
docker-compose up -d mysql

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f mysql redis
```

**环境变量配置：**
- MySQL 数据库名、密码等从 `.env` 读取
- Redis 端口配置使用环境变量
- 推送服务配置存储在数据库中，每应用独立管理
- 支持通过修改 `.env` 文件快速调整基础配置

## Swagger API 文档

### 工具链配置

使用 swag 工具链自动生成 Swagger API 文档：

```go
// 核心依赖包
github.com/gin-gonic/gin v1.9.1      // Web 框架
github.com/spf13/cobra v1.8.0        // 命令行框架  
github.com/spf13/viper v1.18.2       // 配置管理
gorm.io/gorm v1.25.5                 // ORM 框架
gorm.io/driver/mysql v1.5.2          // MySQL 驱动

// Swagger 文档工具链
github.com/swaggo/files v1.0.1       // 静态文件服务
github.com/swaggo/gin-swagger v1.6.0 // Gin框架集成
github.com/swaggo/swag v1.16.4       // 核心注释解析工具

// 其他工具包
github.com/golang-jwt/jwt/v5 v5.2.0  // JWT 认证
github.com/go-redis/redis/v8 v8.11.5 // Redis 客户端
```

### 注释规范示例

**主函数注释：**
```go
// @title           DooPush Platform API
// @version         1.0
// @description     企业级推送平台API服务
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:5002
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

// @securityDefinitions.apikey ApiKeyAuth  
// @in header
// @name X-API-Key
// @description API Key for application authentication
```

**接口注释示例：**
```go
// CreateApp
// @Summary      创建新应用
// @Description  创建一个新的推送应用，生成API密钥
// @Tags         applications
// @Accept       json
// @Produce      json
// @Param        request body CreateAppRequest true "应用创建请求"
// @Success      200  {object}  ApiResponse{data=AppResponse}
// @Failure      400  {object}  ApiResponse
// @Failure      401  {object}  ApiResponse 
// @Failure      422  {object}  ApiResponse
// @Security     BearerAuth
// @Router       /apps [post]
func (c *AppController) CreateApp(ctx *gin.Context) {
    // 实现逻辑
}
```

**模型注释示例：**
```go
// CreateAppRequest 创建应用请求
type CreateAppRequest struct {
    Name        string `json:"name" binding:"required" example:"我的推送应用"`
    PackageName string `json:"package_name" binding:"required" example:"com.example.app"`
} // @name CreateAppRequest

// AppResponse 应用响应
type AppResponse struct {
    ID          uint   `json:"id" example:"1"`
    Name        string `json:"name" example:"我的推送应用"`
    PackageName string `json:"package_name" example:"com.example.app"`
    APIKey      string `json:"api_key" example:"ak_1234567890abcdef"`
    Status      string `json:"status" example:"active"`
    CreatedAt   string `json:"created_at" example:"2024-01-01T00:00:00Z"`
} // @name AppResponse
```

### 文档生成和访问

**生成命令：**
```bash
# 安装 swag 命令行工具
go install github.com/swaggo/swag/cmd/swag@latest

# 生成 swagger 文档
swag init -g main.go -o ./docs

# 启动服务后访问文档
http://localhost:5002/swagger/index.html
```

**集成到 Gin 路由：**
```go
import (
    swaggerFiles "github.com/swaggo/files"
    ginSwagger "github.com/swaggo/gin-swagger"
)

// 添加 swagger 路由
r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
```

## Cobra 命令行架构

### 核心命令设计

使用 Cobra 框架提供简洁的启动方式：

```bash
# 启动 API 服务器 (必须指定环境文件)
./doopush serve --env-file .env

# 显示版本
./doopush version
```

### Viper 配置管理

简化的配置加载，主要从 `.env` 文件读取配置：

**配置加载示例:**
```go
// 加载 .env 文件
func loadConfig(envFile string) {
    viper.SetConfigFile(envFile)
    viper.SetConfigType("env")
    
    if err := viper.ReadInConfig(); err != nil {
        log.Printf("配置文件读取失败: %v", err)
    }
    
    // 简单的默认值
    viper.SetDefault("API_PORT", "5002")
}

// 获取配置
func GetConfig(key string) string {
    return viper.GetString(key)
}
```

### 命令结构示例

**root.go (根命令):**
```go
var rootCmd = &cobra.Command{
    Use:   "doopush",
    Short: "企业级推送平台服务",
}

func Execute() {
    if err := rootCmd.Execute(); err != nil {
        log.Fatal(err)
    }
}
```

**serve.go (服务命令):**
```go
var serveCmd = &cobra.Command{
    Use:   "serve",
    Short: "启动API服务器",
    Run: func(cmd *cobra.Command, args []string) {
        // 获取环境文件路径
        envFile, _ := cmd.Flags().GetString("env-file")
        if envFile == "" {
            log.Fatal("必须指定环境文件: --env-file .env")
        }
        
        // 加载配置文件
        loadConfig(envFile)
        
        // 启动服务器
        startServer()
    },
}

func init() {
    rootCmd.AddCommand(serveCmd)
    serveCmd.Flags().StringP("env-file", "e", "", "环境变量文件路径 (必需)")
    serveCmd.MarkFlagRequired("env-file")
}
```

## 开发规范

### 代码规范

**前端 (web/)：**
- 使用 TypeScript 进行类型安全开发，避免使用 'any' 类型
- 遵循 Next.js 13+ App Router 约定
- 使用 Axios 进行统一的HTTP请求处理
- 配置请求/响应拦截器处理认证和错误
- 使用 shadcn/ui 组件库，避免自定义CSS类名
- 右侧内容区域采用全宽布局
- 确认操作统一使用 Dialog 组件，不使用原生 alert 或 confirm

**后端 (api/)：**
- 遵循 RESTful API 设计规范
- 使用统一的错误处理中间件
- 实现请求参数验证和响应格式标准化
- 使用 GORM 进行数据库操作
- 实现JWT认证和API Key认证双重机制
- 编写完整的 Swagger 注释，自动生成 API 文档

### Git工作流规范

**提交规范：**
- feat: 新功能
- fix: 错误修复
- docs: 文档更新
- style: 代码格式化
- refactor: 代码重构
- test: 测试相关
- chore: 构建/工具相关

**分支策略：**
- main: 生产环境分支
- develop: 开发环境分支
- feature/*: 功能开发分支
- hotfix/*: 紧急修复分支

### 错误处理规范

**HTTP状态码使用：**
- 200: 操作成功
- 400: 请求格式错误
- 401: 认证错误（自动跳转登录）
- 403: 权限错误
- 422: 数据验证错误
- 500: 服务器内部错误

**错误响应格式：**
```json
{
  "code": "SPECIFIC_ERROR_CODE",
  "message": "用户友好的错误描述",
  "data": null
}
```

## 项目里程碑

### 第一阶段：后端基础架构 (api/)
1. **项目初始化**
   - 初始化 Go 模块和基础目录结构
   - 配置 Cobra + Viper 简单启动命令
   - 设置 GORM 数据库连接

2. **数据库和模型**
   - 创建数据库模型 (12张核心表)
   - 数据库自动迁移
   - 基础数据初始化

3. **基础API框架**
   - Gin 路由和中间件配置
   - 统一错误处理和响应格式
   - Swagger 文档集成

4. **认证系统**
   - JWT 认证中间件
   - API Key 认证机制
   - 基础用户管理

### 第二阶段：后端核心功能 (api/)
1. **应用管理API**
   - 应用CRUD操作
   - 应用权限管理
   - API Key 生成和管理

2. **设备管理API**
   - 设备注册和更新
   - 设备分组功能
   - 设备状态监控

3. **推送配置API**
   - 多平台推送配置管理
   - 推送服务测试接口
   - 配置加密存储

4. **推送服务集成**
   - iOS APNs 推送实现
   - Android FCM 推送实现
   - 各厂商推送通道集成 (华为、小米、OPPO等)
   - 完善推送相关 API 的 Swagger 文档

### 第三阶段：后端高级功能 (api/)
1. **推送服务优化**
   - 统一推送API (单推、批量、广播)
   - 异步推送队列处理
   - 推送结果跟踪和统计

2. **消息模板系统**
   - 模板管理API
   - 变量替换和个性化
   - 多语言支持

3. **定时推送系统**
   - 定时任务调度
   - 重复推送规则
   - 任务状态管理

4. **统计和监控**
   - 推送统计API
   - 性能监控接口
   - 系统健康检查
   - 完整的 Swagger API 文档生成

### 第四阶段：前端管理平台 (web/)
1. **前端基础架构**
   - Next.js 项目初始化
   - shadcn/ui + Tailwind CSS 配置
   - Axios 网络请求配置
   - 基于后端 Swagger 文档生成 TypeScript 类型定义

2. **核心管理界面**
   - 用户登录和权限管理
   - 应用管理界面 (创建、配置、切换)
   - 设备管理界面 (列表、分组、状态)

3. **推送管理界面**
   - 推送配置页面 (各平台配置)
   - 推送发送页面 (单推、批量、定时)
   - 消息模板管理

4. **数据展示界面**
   - 推送统计图表
   - 实时监控面板
   - 审计日志查看

### 第五阶段：集成优化和部署
1. **前后端集成测试**
   - API接口联调
   - 端到端功能测试
   - 性能压力测试

2. **生产环境准备**
   - Docker 镜像构建
   - 环境配置优化
   - 安全配置加固

3. **文档和部署**
   - Swagger API 文档最终完善和导出
   - 部署文档编写
   - 生产环境部署

## 技术决策记录

### 为什么选择这个技术栈？

**前端选择 Next.js + shadcn/ui：**
- Next.js 提供优秀的SSR/SSG能力和开发体验
- shadcn/ui 基于 Radix UI，组件质量高且可定制
- shadcn-admin 提供完整的管理后台模板，加速开发
- Tailwind CSS 提供原子化CSS，开发效率高

**后端选择 Go + Gin + Cobra：**
- Go 语言性能优秀，适合高并发推送场景
- Gin 框架轻量级，中间件生态丰富
- GORM 提供良好的ORM支持
- Cobra + Viper 提供企业级的命令行和配置管理
- MySQL 成熟稳定，支持高并发和大数据量处理

**数据库选择 MySQL：**
- 成熟稳定，广泛应用于生产环境
- 支持高并发读写，适合推送服务场景
- 完整的事务支持和数据一致性保障
- 丰富的监控和优化工具生态
- 使用 Docker 容器化部署，便于环境管理

**API文档选择 Swagger (swag)：**
- 基于代码注释自动生成，确保文档与代码同步
- 提供交互式API测试界面，开发调试效率高
- 支持多种认证方式 (JWT + API Key)
- 与 Gin 框架深度集成，配置简单
- 生成标准的 OpenAPI 3.0 规范文档

**命令行框架选择 Cobra + Viper：**
- Cobra 提供强大的子命令和参数解析能力
- Viper 支持多种配置源，配置管理灵活
- 广泛应用于企业级项目 (Kubernetes、Hugo等)
- 支持优雅的服务启动、停止和重启
- 便于生产环境的运维管理和自动化部署
- 命令行工具与API服务器分离，架构清晰

### 后端优先开发策略

**开发流程：**
1. **后端先行** (第1-3阶段): 完整实现后端API和功能
2. **文档驱动** (每个阶段): 通过 Swagger 文档验证API设计
3. **前端跟进** (第4阶段): 基于稳定的API和文档开发界面
4. **集成优化** (第5阶段): 前后端联调和生产部署

**优势分析：**
- **依赖清晰**: 前端依赖后端API，避免开发阻塞
- **文档同步**: Swagger 确保API文档与实现同步
- **早期验证**: 后端功能可独立测试和验证
- **类型安全**: 可从 Swagger 生成前端 TypeScript 类型
- **并行开发**: 后端完成后支持团队并行开发

**工具配合：**
- 后端开发时用 Swagger UI 测试API
- 前端开发时用 swagger-codegen 生成客户端代码
- 接口变更通过 Swagger 文档进行契约管理

## 风险评估

### 技术风险
1. **Android厂商通道兼容性**: 各厂商推送API差异较大，需要详细的适配和测试
2. **推送到达率**: 受系统版本、用户设置等因素影响，需要监控和优化
3. **证书管理**: iOS推送证书有效期管理，需要自动化续签机制

### 业务风险
1. **数据隔离**: 多应用环境下的数据安全和隔离性至关重要
2. **权限控制**: 用户权限管理复杂度较高，需要详细的权限矩阵设计
3. **性能瓶颈**: 大量并发推送时的系统性能和稳定性

### 解决方案
1. 建立完善的测试环境和自动化测试
2. 实现详细的日志记录和监控告警
3. 设计良好的错误处理和降级机制
4. 制定详细的运维手册和应急预案
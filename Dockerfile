# DooPush Platform Dockerfile
# 多阶段构建：Go API + 前端 Web + 文档

# ===================== 阶段1: 构建 Go API =====================
FROM golang:1.24.4-bookworm AS api-builder

# 设置工作目录
WORKDIR /app

# 复制后端相关文件和目录
COPY api/ ./

# 安装依赖
RUN go mod tidy

# 生成 Swagger 文档 (如果需要)
RUN go install github.com/swaggo/swag/cmd/swag@latest && \
    swag init -g main.go -o ./docs --templateDelims "[[,]]"

# 构建 API
RUN CGO_ENABLED=0 go build -a -installsuffix cgo -ldflags="-w -s -extldflags '-static'" -o api main.go

# ===================== 阶段2: 构建前端 Web =====================
FROM node:22-slim AS web-builder

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制前端源代码
COPY web/ ./

# 安装依赖
RUN pnpm install --force

# 构建前端
RUN pnpm run build

# ===================== 阶段3: 构建文档 =====================
FROM node:22-slim AS docs-builder

# 安装git
RUN apt-get update && apt-get install -y git

# 设置工作目录
WORKDIR /app

# 复制文档源代码
COPY docs/ ./

# 安装依赖
RUN npm install

# 构建文档
RUN npm run build

# ===================== 阶段4: 最终运行时镜像 =====================
FROM nginx:alpine AS runtime

# 安装运行时依赖
RUN apk add --no-cache \
    supervisor \
    ca-certificates \
    tzdata && \
    rm -rf /var/cache/apk/*

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 创建目录
RUN mkdir -p /doopush/conf \
             /doopush/web \
             /doopush/logs \
             /doopush/uploads \
             /etc/supervisor/conf.d

# 复制构建产物
COPY --from=api-builder /app/api /doopush/
COPY --from=web-builder /app/dist/ /doopush/web/
COPY --from=docs-builder /app/.vitepress/dist/ /doopush/web/docs/

# 复制配置文件
COPY conf/nginx.conf /doopush/conf/nginx.conf
COPY conf/supervisord.conf /doopush/conf/supervisord.conf

# 创建软链接
RUN rm -f /etc/nginx/nginx.conf && \
    rm -f /etc/supervisord.conf && \
    ln -s /doopush/conf/nginx.conf /etc/nginx/nginx.conf && \
    ln -s /doopush/conf/supervisord.conf /etc/supervisord.conf

# 创建应用用户
RUN adduser -D -s /bin/sh doopush

# 设置权限
RUN chown -R doopush:doopush /doopush

# 设置启动脚本权限
RUN chmod +x /doopush/api

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -fsSL http://localhost/api/v1/health || exit 1

# 设置工作目录
WORKDIR /doopush

# 启动应用
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]

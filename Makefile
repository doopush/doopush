# 项目根目录的构建脚本
BINARY_NAME=doopush

# 默认目标
.PHONY: default
default: help

# 后端命令
.PHONY: api-dev
api-dev: ## 运行后端开发服务器
	cd api && air --build.cmd "go build -o ./tmp/dev main.go" --build.exclude_dir "uploads,tmp" --build.full_bin "./tmp/dev serve --env-file ../.env"

.PHONY: api-gateway
api-gateway: ## 运行网关开发服务器
	cd api && air --build.cmd "go build -o ./tmp/gateway main.go" --build.exclude_dir "uploads,tmp" --build.full_bin "./tmp/gateway gateway --env-file ../.env"

.PHONY: api-build
api-build: ## 构建后端项目
	cd api && go build -o ./release/$(BINARY_NAME) main.go

.PHONY: api-docs api-doc
api-docs api-doc: ## 生成后端 Swagger 文档
	cd api && swag init -g main.go -o ./docs --templateDelims "[[,]]"

.PHONY: api-test
api-test: ## 运行后端测试
	cd api && go test -v ./...

.PHONY: api-tidy
api-tidy: ## 整理后端依赖
	cd api && go mod tidy

# 前端命令
.PHONY: web-dev
web-dev: ## 运行前端开发服务器
	cd web && pnpm run dev

.PHONY: web-build
web-build: ## 构建前端项目
	cd web && pnpm run build

.PHONY: web-install
web-install: ## 安装前端依赖
	cd web && pnpm install

.PHONY: web-lint
web-lint: ## 前端代码检查
	cd web && pnpm run lint

.PHONY: web-format
web-format: ## 前端代码格式化
	cd web && pnpm run format

# 文档命令
.PHONY: docs-install
docs-install: ## 安装文档依赖
	cd docs && npm install

.PHONY: docs-dev
docs-dev: ## 运行文档开发服务器
	cd docs && npm run dev

.PHONY: docs-build
docs-build: ## 构建文档项目
	cd docs && npm run build

.PHONY: docs-preview
docs-preview: ## 预览构建后的文档
	cd docs && npm run preview

# 全项目命令
.PHONY: dev
dev: ## 启动完整开发环境（数据库、后端、前端并行启动）
	@echo "启动数据库服务..."
	@docker-compose up -d
	@echo "启动后端和前端服务..."
	@$(MAKE) -j api-dev api-gateway web-dev

.PHONY: build
build: api-build web-build ## 构建整个项目

.PHONY: install
install: ## 安装所有依赖
	@echo "安装前端依赖..."
	@make web-install
	@echo "安装后端依赖..."
	@make api-tidy

# 快捷命令
api: api-dev
gateway: api-gateway
web: web-dev
docs: docs-dev

# 帮助命令
help:
	@echo ""
	@echo "用法: make <target>"
	@echo ""
	@echo "可用命令："
	@echo "  \033[36m dev \033[0m         启动完整开发环境（包含数据库、后端、前端）"
	@echo "  \033[36m build \033[0m       构建整个项目（前后端）"
	@echo "  \033[36m install \033[0m     安装所有依赖"
	@echo ""
	@echo "后端命令："
	@echo "  \033[36m api-dev \033[0m     运行后端开发服务器 (支持热重载)"
	@echo "  \033[36m api-gateway \033[0m 运行网关开发服务器 (支持热重载)"
	@echo "  \033[36m api-build \033[0m   构建后端可执行文件"
	@echo "  \033[36m api-docs \033[0m    生成后端 Swagger 文档"
	@echo "  \033[36m api-test \033[0m    运行后端单元测试"
	@echo "  \033[36m api-tidy \033[0m    整理后端 Go 依赖"
	@echo ""
	@echo "前端命令："
	@echo "  \033[36m web-dev \033[0m     运行前端开发服务器 (Vite)"
	@echo "  \033[36m web-build \033[0m   构建前端项目"
	@echo "  \033[36m web-install \033[0m 安装前端依赖 (pnpm)"
	@echo "  \033[36m web-lint \033[0m    前端代码检查"
	@echo "  \033[36m web-format \033[0m  前端代码格式化"
	@echo ""
	@echo "  \033[36m help \033[0m        显示本帮助信息"
	@echo ""
	@echo "示例: \033[4mmake dev\033[0m"
	@echo ""
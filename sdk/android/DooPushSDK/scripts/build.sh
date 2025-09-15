#!/bin/bash

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 项目配置
PROJECT_NAME="DooPushSDK"
OUTPUT_DIR="build/outputs/aar"

echo_info "开始构建 $PROJECT_NAME AAR..."

# 检查 gradlew 是否存在
if [ ! -f "./gradlew" ]; then
    echo_error "找不到 gradlew 文件"
    exit 1
fi

# 给予 gradlew 执行权限
chmod +x ./gradlew

echo_info "清理之前的构建..."
./gradlew clean

echo_info "开始构建 Release AAR..."
./gradlew assembleRelease

# 检查构建是否成功
if [ ! -d "$OUTPUT_DIR" ]; then
    echo_error "AAR 输出目录不存在: $OUTPUT_DIR"
    exit 1
fi

# 查找生成的 AAR 文件
RELEASE_AAR=$(find "$OUTPUT_DIR" -name "*-release.aar" | head -1)

if [ -z "$RELEASE_AAR" ]; then
    echo_error "未找到生成的 Release AAR 文件"
    echo_info "输出目录内容:"
    ls -la "$OUTPUT_DIR"
    exit 1
fi

echo_info "找到 AAR 文件: $RELEASE_AAR"

# 复制并重命名 AAR 文件
AAR_FINAL_PATH="$OUTPUT_DIR/$PROJECT_NAME.aar"
cp "$RELEASE_AAR" "$AAR_FINAL_PATH"
echo_info "AAR 文件已复制到: $AAR_FINAL_PATH"

# 显示 AAR 文件信息
echo_info "AAR 文件信息:"
ls -lh "$AAR_FINAL_PATH"

echo_info "✅ $PROJECT_NAME AAR 构建完成!"
echo_info "📦 输出文件: $AAR_FINAL_PATH"
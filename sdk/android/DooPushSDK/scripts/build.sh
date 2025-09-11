#!/bin/bash

# DooPush Android SDK 构建脚本

set -e

# 配置
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
OUTPUT_DIR="$BUILD_DIR/outputs/aar"
VERSION_FILE="$PROJECT_ROOT/version.properties"
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

# 帮助信息
show_help() {
    echo "DooPush Android SDK 构建脚本"
    echo
    echo "用法: $0 [选项] [任务]"
    echo
    echo "选项:"
    echo "  -h, --help     显示帮助信息"
    echo "  -v, --version  显示版本信息"
    echo "  --clean        清理构建产物"
    echo "  --release      构建发布版本"
    echo "  --debug        构建调试版本（默认）"
    echo
    echo "任务:"
    echo "  build          构建 AAR 文件"
    echo "  test           运行单元测试"
    echo "  lint           代码质量检查"
    echo "  javadoc        生成文档"
    echo "  publish        发布到仓库"
    echo "  all            执行所有任务"
    echo
    echo "示例:"
    echo "  $0 build                    # 构建调试版本"
    echo "  $0 --release build          # 构建发布版本"
    echo "  $0 --clean all              # 清理并执行所有任务"
}

# 获取版本信息
get_version() {
    if [[ -f "$VERSION_FILE" ]]; then
        grep "version=" "$VERSION_FILE" | cut -d'=' -f2
    else
        echo "1.0.0"
    fi
}

# 创建版本文件
create_version_file() {
    local version="${1:-1.0.0}"
    local build_number="${2:-$(date +%Y%m%d%H%M)}"
    
    cat > "$VERSION_FILE" << EOF
# DooPush Android SDK 版本信息
version=$version
build_number=$build_number
build_time=$(date -Iseconds)
commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
EOF
    
    log "版本文件已创建: $version (构建号: $build_number)"
}

# 清理构建产物
clean_build() {
    log "清理构建产物..."
    
    if [[ -d "$BUILD_DIR" ]]; then
        rm -rf "$BUILD_DIR"
        success "构建目录已清理"
    fi
    
    # 清理Gradle缓存
    if command -v ./gradlew &> /dev/null; then
        ./gradlew clean
        success "Gradle缓存已清理"
    fi
}

# 检查环境
check_environment() {
    log "检查构建环境..."
    
    # 检查Java版本
    if command -v java &> /dev/null; then
        java_version=$(java -version 2>&1 | head -n1 | cut -d'"' -f2)
        log "Java版本: $java_version"
    else
        error "Java未安装或未添加到PATH"
        exit 1
    fi
    
    # 检查Android SDK
    if [[ -z "$ANDROID_HOME" ]]; then
        warning "ANDROID_HOME 环境变量未设置"
    else
        log "Android SDK: $ANDROID_HOME"
    fi
    
    # 检查Gradle
    if [[ -f "./gradlew" ]]; then
        log "使用项目Gradle Wrapper"
    elif command -v gradle &> /dev/null; then
        gradle_version=$(gradle --version | grep "Gradle" | head -n1)
        log "$gradle_version"
    else
        error "Gradle未找到"
        exit 1
    fi
    
    success "环境检查通过"
}

# 构建AAR
build_aar() {
    local build_type="${1:-debug}"
    
    log "开始构建 $build_type 版本..."
    
    # 创建输出目录
    mkdir -p "$OUTPUT_DIR"
    
    # 构建命令
    local gradle_task
    if [[ "$build_type" == "release" ]]; then
        gradle_task="assembleRelease"
    else
        gradle_task="assembleDebug"
    fi
    
    # 执行构建
    if [[ -f "./gradlew" ]]; then
        ./gradlew $gradle_task
    else
        gradle $gradle_task
    fi
    
    # 检查构建结果
    if [[ -f "$OUTPUT_DIR/DooPushSDK-${build_type}.aar" ]]; then
        success "AAR构建成功: DooPushSDK-${build_type}.aar"
        
        # 显示文件信息
        local aar_path="$OUTPUT_DIR/DooPushSDK-${build_type}.aar"
        local file_size=$(ls -lh "$aar_path" | awk '{print $5}')
        log "文件大小: $file_size"
        log "文件路径: $aar_path"
        
        # 复制到根目录
        cp "$aar_path" "$PROJECT_ROOT/DooPushSDK-${build_type}-$(get_version).aar"
        success "AAR已复制到根目录"
        
    else
        error "AAR构建失败"
        exit 1
    fi
}

# 运行测试
run_tests() {
    log "运行单元测试..."
    
    if [[ -f "./gradlew" ]]; then
        ./gradlew test
    else
        gradle test
    fi
    
    success "测试完成"
}

# 代码质量检查
run_lint() {
    log "执行代码质量检查..."
    
    if [[ -f "./gradlew" ]]; then
        ./gradlew lint
    else
        gradle lint
    fi
    
    success "代码质量检查完成"
}

# 生成文档
generate_javadoc() {
    log "生成API文档..."
    
    if [[ -f "./gradlew" ]]; then
        ./gradlew javadoc
    else
        gradle javadoc
    fi
    
    success "文档生成完成"
}

# 发布到仓库
publish_aar() {
    log "发布AAR到仓库..."
    
    # 这里可以添加发布逻辑，比如：
    # - 发布到Maven Central
    # - 发布到JitPack
    # - 发布到私有仓库
    
    warning "发布功能需要根据具体需求配置"
}

# 执行所有任务
run_all() {
    local build_type="${1:-debug}"
    
    log "执行完整构建流程..."
    
    check_environment
    run_tests
    run_lint
    build_aar "$build_type"
    generate_javadoc
    
    success "完整构建流程已完成"
}

# 主函数
main() {
    local build_type="debug"
    local clean_first=false
    local task="build"
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                echo "DooPush Android SDK 构建脚本 v1.0.0"
                echo "SDK版本: $(get_version)"
                exit 0
                ;;
            --clean)
                clean_first=true
                shift
                ;;
            --release)
                build_type="release"
                shift
                ;;
            --debug)
                build_type="debug"
                shift
                ;;
            build|test|lint|javadoc|publish|all)
                task="$1"
                shift
                ;;
            *)
                error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 切换到项目根目录
    cd "$PROJECT_ROOT"
    
    log "DooPush Android SDK 构建开始"
    log "项目路径: $PROJECT_ROOT"
    log "构建类型: $build_type"
    log "执行任务: $task"
    
    # 创建版本文件
    create_version_file
    
    # 清理（如果需要）
    if [[ "$clean_first" == true ]]; then
        clean_build
    fi
    
    # 执行任务
    case $task in
        build)
            check_environment
            build_aar "$build_type"
            ;;
        test)
            check_environment
            run_tests
            ;;
        lint)
            check_environment
            run_lint
            ;;
        javadoc)
            check_environment
            generate_javadoc
            ;;
        publish)
            check_environment
            publish_aar
            ;;
        all)
            run_all "$build_type"
            ;;
    esac
    
    success "构建完成！"
}

# 执行主函数
main "$@"

#!/bin/bash

# DooPush SDK 完整Framework构建脚本
# 构建包含真机和模拟器架构的完整Framework

set -e

# 配置参数
SCHEME_NAME="DooPushSDK"
FRAMEWORK_NAME="DooPushSDK"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
OUTPUT_DIR="$PROJECT_DIR/output"

echo "🚀 开始构建完整Framework（真机+模拟器）..."
echo "📁 项目目录: $PROJECT_DIR"
echo "📁 构建目录: $BUILD_DIR"

# 清理和创建目录
rm -rf "$BUILD_DIR"
rm -rf "$OUTPUT_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

cd "$PROJECT_DIR"

# 检查Package.swift
if [ ! -f "Package.swift" ]; then
    echo "❌ 错误: 找不到Package.swift文件"
    exit 1
fi

# 第一步：构建iOS设备版本（arm64）
echo "📱 构建iOS设备版本 (arm64)..."
xcodebuild build \
    -scheme "$SCHEME_NAME" \
    -destination "generic/platform=iOS" \
    -configuration Release \
    -derivedDataPath "$BUILD_DIR/ios-device" \
    BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
    SKIP_INSTALL=NO \
    CODE_SIGNING_ALLOWED=NO || {
    echo "⚠️ iOS设备版本构建失败，尝试不同的构建方式..."
    
    # 备用构建方式
    xcodebuild build \
        -scheme "$SCHEME_NAME" \
        -sdk iphoneos \
        -configuration Release \
        -derivedDataPath "$BUILD_DIR/ios-device-alt" \
        BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
        CODE_SIGNING_ALLOWED=NO || {
        echo "❌ iOS设备版本构建完全失败"
        # 不退出，继续用模拟器版本
    }
}

# 第二步：构建iOS模拟器版本（x86_64 + arm64）
echo "💻 构建iOS模拟器版本 (x86_64 + arm64)..."
xcodebuild build \
    -scheme "$SCHEME_NAME" \
    -destination "generic/platform=iOS Simulator" \
    -configuration Release \
    -derivedDataPath "$BUILD_DIR/ios-simulator" \
    BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
    SKIP_INSTALL=NO || {
    echo "❌ iOS模拟器版本构建失败"
    exit 1
}

# 查找构建产物
echo "🔍 查找构建产物..."

# 查找iOS设备构建产物
DEVICE_BINARY=""
DEVICE_SWIFTMODULE=""

# 尝试多个可能的路径
DEVICE_SEARCH_PATHS=(
    "$BUILD_DIR/ios-device"
    "$BUILD_DIR/ios-device-alt"
)

for search_path in "${DEVICE_SEARCH_PATHS[@]}"; do
    if [ -d "$search_path" ]; then
        # 查找二进制文件 - 优先查找DooPushSDK.o，然后是任何.o文件
        found_binary=$(find "$search_path" -name "${FRAMEWORK_NAME}.o" -path "*Release-iphoneos*" | head -1)
        if [ -z "$found_binary" ]; then
            found_binary=$(find "$search_path" -name "*.o" -path "*Release-iphoneos*" | head -1)
        fi
        if [ -z "$found_binary" ]; then
            found_binary=$(find "$search_path" -name "lib${FRAMEWORK_NAME}.a" -path "*Release-iphoneos*" | head -1)
        fi
        
        if [ -n "$found_binary" ]; then
            DEVICE_BINARY="$found_binary"
            echo "✅ 找到iOS设备二进制文件: $DEVICE_BINARY"
        fi
        
        # 查找Swift模块
        found_swiftmodule=$(find "$search_path" -name "${FRAMEWORK_NAME}.swiftmodule" -path "*Release-iphoneos*" -type d | head -1)
        if [ -n "$found_swiftmodule" ]; then
            DEVICE_SWIFTMODULE="$found_swiftmodule"
            echo "✅ 找到iOS设备Swift模块: $DEVICE_SWIFTMODULE"
        fi
        
        # 如果找到了，跳出循环
        if [ -n "$DEVICE_BINARY" ] && [ -n "$DEVICE_SWIFTMODULE" ]; then
            break
        fi
    fi
done

# 查找iOS模拟器构建产物
SIMULATOR_BINARY=$(find "$BUILD_DIR/ios-simulator" -name "${FRAMEWORK_NAME}.o" -path "*Release-iphonesimulator*" | head -1)
if [ -z "$SIMULATOR_BINARY" ]; then
    SIMULATOR_BINARY=$(find "$BUILD_DIR/ios-simulator" -name "*.o" -path "*Release-iphonesimulator*" | head -1)
fi
if [ -z "$SIMULATOR_BINARY" ]; then
    SIMULATOR_BINARY=$(find "$BUILD_DIR/ios-simulator" -name "lib${FRAMEWORK_NAME}.a" -path "*Release-iphonesimulator*" | head -1)
fi

SIMULATOR_SWIFTMODULE=$(find "$BUILD_DIR/ios-simulator" -name "${FRAMEWORK_NAME}.swiftmodule" -path "*Release-iphonesimulator*" -type d | head -1)

echo "模拟器二进制文件: $SIMULATOR_BINARY"
echo "模拟器Swift模块: $SIMULATOR_SWIFTMODULE"

# 验证必要文件存在
if [ -z "$SIMULATOR_BINARY" ] || [ -z "$SIMULATOR_SWIFTMODULE" ]; then
    echo "❌ 找不到模拟器构建产物"
    echo "请检查构建日志"
    exit 1
fi

# 第三步：创建Framework结构
echo "🔨 创建Framework结构..."
FRAMEWORK_PATH="$OUTPUT_DIR/${FRAMEWORK_NAME}.framework"
mkdir -p "$FRAMEWORK_PATH"
mkdir -p "$FRAMEWORK_PATH/Headers"
mkdir -p "$FRAMEWORK_PATH/Modules"
mkdir -p "$FRAMEWORK_PATH/Modules/${FRAMEWORK_NAME}.swiftmodule"

# 第四步：智能合并二进制文件
echo "🔀 合并二进制文件..."

if [ -n "$DEVICE_BINARY" ] && [ -f "$DEVICE_BINARY" ]; then
    echo "✅ 找到设备二进制，创建智能通用二进制"
    
    # 检查模拟器二进制的架构
    SIMULATOR_ARCHS=$(lipo -archs "$SIMULATOR_BINARY" 2>/dev/null || echo "unknown")
    echo "📊 模拟器架构: $SIMULATOR_ARCHS"
    
    # 如果模拟器包含x86_64，提取它并与设备arm64合并
    if [[ "$SIMULATOR_ARCHS" == *"x86_64"* ]]; then
        echo "✅ 提取x86_64模拟器架构并与设备arm64合并"
        
        # 提取x86_64架构
        TMP_X86_64="/tmp/simulator_x86_64.o"
        lipo -extract x86_64 "$SIMULATOR_BINARY" -output "$TMP_X86_64" 2>/dev/null
        
        if [ -f "$TMP_X86_64" ]; then
            # 合并设备arm64 + 模拟器x86_64
            lipo -create "$DEVICE_BINARY" "$TMP_X86_64" -output "$FRAMEWORK_PATH/$FRAMEWORK_NAME"
            rm -f "$TMP_X86_64"
            echo "✅ 成功创建通用二进制 (arm64 + x86_64)"
        else
            echo "⚠️ 无法提取x86_64，使用设备arm64"
            cp "$DEVICE_BINARY" "$FRAMEWORK_PATH/$FRAMEWORK_NAME"
        fi
    else
        echo "⚠️ 模拟器不包含x86_64，只使用设备arm64"
        cp "$DEVICE_BINARY" "$FRAMEWORK_PATH/$FRAMEWORK_NAME"
    fi
else
    echo "⚠️ 只使用模拟器架构创建二进制"
    cp "$SIMULATOR_BINARY" "$FRAMEWORK_PATH/$FRAMEWORK_NAME"
fi

# 第五步：复制Swift模块文件
echo "📄 复制Swift模块文件..."

# 复制模拟器的Swift模块
if [ -d "$SIMULATOR_SWIFTMODULE" ]; then
    cp -R "$SIMULATOR_SWIFTMODULE/"* "$FRAMEWORK_PATH/Modules/${FRAMEWORK_NAME}.swiftmodule/"
fi

# 复制设备的Swift模块（如果存在）
if [ -n "$DEVICE_SWIFTMODULE" ] && [ -d "$DEVICE_SWIFTMODULE" ]; then
    # 查找设备特定的Swift模块文件
    find "$DEVICE_SWIFTMODULE" -name "*.swiftmodule" -o -name "*.swiftdoc" -o -name "*.swiftinterface" -o -name "*.abi.json" | while read -r file; do
        filename=$(basename "$file")
        # 如果包含arm64-apple-ios（不是模拟器），则复制
        if [[ "$filename" == *"arm64-apple-ios"* ]] && [[ "$filename" != *"simulator"* ]]; then
            cp "$file" "$FRAMEWORK_PATH/Modules/${FRAMEWORK_NAME}.swiftmodule/"
            echo "✅ 复制设备Swift模块: $filename"
        fi
    done
fi

# 第六步：创建头文件
echo "📝 创建头文件..."
cat > "$FRAMEWORK_PATH/Headers/${FRAMEWORK_NAME}.h" << 'EOF'
//
//  DooPushSDK.h
//  DooPushSDK
//
//  Framework umbrella header
//

#import <Foundation/Foundation.h>

//! Project version number for DooPushSDK.
FOUNDATION_EXPORT double DooPushSDKVersionNumber;

//! Project version string for DooPushSDK.
FOUNDATION_EXPORT const unsigned char DooPushSDKVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <DooPushSDK/PublicHeader.h>

EOF

# 第七步：创建module.modulemap
echo "🗺️ 创建module.modulemap..."
cat > "$FRAMEWORK_PATH/Modules/module.modulemap" << 'EOF'
framework module DooPushSDK {
    umbrella header "DooPushSDK.h"
    
    export *
    module * { export * }
    
    explicit module Swift {
        header "DooPushSDK-Swift.h"
        requires objc
    }
}
EOF

# 第八步：创建Info.plist
echo "📋 创建Info.plist..."
cat > "$FRAMEWORK_PATH/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>DooPushSDK</string>
    <key>CFBundleIdentifier</key>
    <string>com.doopush.DooPushSDK</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>DooPushSDK</string>
    <key>CFBundlePackageType</key>
    <string>FMWK</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>MinimumOSVersion</key>
    <string>12.0</string>
    <key>CFBundleSupportedPlatforms</key>
    <array>
        <string>iPhoneOS</string>
        <string>iPhoneSimulator</string>
    </array>
</dict>
</plist>
EOF

# 第九步：查找并复制Swift头文件
echo "🔍 查找Swift头文件..."
SWIFT_HEADER_PATHS=(
    "$BUILD_DIR/ios-simulator"
    "$BUILD_DIR/ios-device"
    "$BUILD_DIR/ios-device-alt"
)

for search_path in "${SWIFT_HEADER_PATHS[@]}"; do
    if [ -d "$search_path" ]; then
        swift_header=$(find "$search_path" -name "${FRAMEWORK_NAME}-Swift.h" | head -1)
        if [ -n "$swift_header" ] && [ -f "$swift_header" ]; then
            cp "$swift_header" "$FRAMEWORK_PATH/Headers/${FRAMEWORK_NAME}-Swift.h"
            echo "✅ 复制Swift头文件: $swift_header"
            break
        fi
    fi
done

# 第十步：验证Framework
echo "🔍 验证Framework..."

if [ -f "$FRAMEWORK_PATH/$FRAMEWORK_NAME" ]; then
    echo "📊 Framework架构信息:"
    lipo -info "$FRAMEWORK_PATH/$FRAMEWORK_NAME" || echo "单一架构Framework"
    
    echo ""
    echo "📁 Framework结构:"
    ls -la "$FRAMEWORK_PATH"
    
    echo ""
    echo "📁 Swift模块内容:"
    ls -la "$FRAMEWORK_PATH/Modules/${FRAMEWORK_NAME}.swiftmodule/"
    
    echo ""
    echo "🎉 Framework构建完成!"
    echo "📍 位置: $FRAMEWORK_PATH"
    echo ""
    echo "🔨 使用方法:"
    echo "1. 将Framework拖拽到Xcode项目中"
    echo "2. 设置为 'Embed & Sign'"
    echo "3. 导入: import DooPushSDK"
    echo ""
    echo "✅ 支持架构:"
    lipo -archs "$FRAMEWORK_PATH/$FRAMEWORK_NAME" 2>/dev/null || echo "检测架构失败，但Framework已创建"
else
    echo "❌ Framework构建失败: 找不到二进制文件"
    exit 1
fi

# 清理构建缓存
echo "🧹 清理构建缓存..."
rm -rf "$BUILD_DIR"

echo "✅ 构建完成!"

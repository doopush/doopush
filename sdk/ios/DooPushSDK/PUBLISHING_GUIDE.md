# DooPushSDK 发布指南

## 📦 如何发布新版本

### 步骤 1：更新版本号
编辑 `DooPushSDK.podspec` 文件：
```ruby
spec.version = "1.1.0"  # 改为新版本号
```

### 步骤 2：提交推送
```bash
git add .
git commit -m "发布版本 1.1.0"
git push origin main
```

### 步骤 3：等待自动发布
- 代码会自动同步到 iOS SDK 仓库
- 自动构建 Framework 并创建 GitHub Release
- 大约需要 5-10 分钟完成

## 📏 版本号规范

使用格式：`主版本号.次版本号.修订号`

- `1.0.1` - Bug 修复
- `1.1.0` - 新功能
- `2.0.0` - 重大更新

## 📱 发布产物

每次发布自动生成：
- `DooPushSDK.framework.zip` - 可直接使用的 Framework
- `DooPushSDK.podspec` - CocoaPods 规格文件

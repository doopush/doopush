# TCP→WebSocket 迁移后续工作

迁移于 2026-05-06 完成（commit `b89c6dc`..`01961c4`），以下事项未在本次范围内完成：

## 已知遗留

1. **`api/docs/docs.go` 已刷新** — `swag init` 已成功运行，`gateway_node` / `connection_id` / `DeviceRegistrationResponse` / `GatewayConfig` 等已删字段引用已从生成文档中消除。`api/.gitignore` 中 `docs/` 目录被忽略，swag 生成文件不提交到 git，需在 CI/CD 流水线中运行 `cd api && swag init -g main.go -o ./docs`。

2. **手动联调（Task 8 / 14）尚未在 subagent 流程中执行**：
   - Task 8：用 wscat 验证握手鉴权 + Redis 在线态写入 + MySQL is_online 切换
   - Task 14：经 nginx 端到端验证 SDK demo 能连上、心跳维持、断开能清理在线态、双连互踢
   需要在有真实 MySQL + Redis + nginx 的环境下做。

3. **生产部署侧待办**：
   - 旧 5003 端口防火墙关闭
   - 单实例预生产先跑一周观察连接数曲线
   - 用 Go 模拟客户端阶梯压测到 10 万连接

## 已知技术债（重构时可考虑）

- `online.go` 的 `MarkOnline` / `MarkOffline` DB 写在两个独立 goroutine，同 token 在快速断连场景仍有 race（部分缓解，未根治）。完整修复需 per-token 串行化。
- `device_online:<token>` Redis key 缺 appID prefix；目前依赖 token 跨 app 不重复（FCM/APNs token 是设备唯一的）。如未来引入跨 app 共享 token 的产品形态需重新设计。
- iOS SDK 应用前台 `applicationDidBecomeActive` 不再主动重连；依赖 OkHttp/URLSession 自身的心跳检测。规模化后若发现回前台后连接恢复慢，考虑加显式 nudge。

## 验收清单（spec §10）

仍需在真实环境验证：
- [ ] 鉴权失败三段（缺参/错 appkey/错 token）→ 400/401/403
- [ ] 握手成功 → Redis device_online + MySQL is_online=true
- [ ] 主动断开 → 清理 Redis + MySQL
- [ ] 同 token 二次连接 → 旧连收到 close 4001
- [ ] mock client 30s 不响应 → 服务端 75s 内 Close
- [ ] Android / iOS demo 端到端跑通：连上 + 心跳 + 断网重连 + 鉴权失败不重连

# OpenReader 交接文档

> 更新：2026-10-24 · 维护者交接材料 · 配合仓库根目录的 README 使用

## 一、项目是什么

自托管网页阅读器（小说/电子书），Go + Vue 3 重构自 `changshengyu/reader-dev`。
技术栈：Go（Gin、GORM、SQLite/CGO）+ Vue 3（Vite、Pinia、Element Plus），单 Docker 容器交付，支持 amd64/arm64（NAS、树莓派、Apple Silicon 等）。

- 后端：`backend/`（api / services / engine 分层清晰，几乎每个子系统都有契约测试）
- 前端：`frontend/`（composable 化，约 170 个测试文件；液态玻璃重设计基线见 `docs/compat/design-tokens-glass-baseline.md`）
- 契约文档：`docs/compat/`（100+ 份，记录每个子系统的行为边界与设计原因）

2026-10-24 功能面变化：WebDAV 协议与手动备份/恢复已整体移除（见 `docs/compat/webdav-removal-notice.md`，每日自动备份保留）；远程书源 URL 列表服务端化多端同步；iOS 主屏 PWA（图标/全屏/安全区/应用壳离线缓存，`docs/compat/pwa-application-shell-contract.md`）；移动端改为底部悬浮玻璃标签栏。

## 二、仓库与发布

- 仓库：`ZevAlain/openreader`（fork 自 `changshengyu/openreader`，**已决定脱离上游独立维护**）
- 镜像：`ghcr.io/zevalain/openreader`（**必须全小写**——GitHub 用户名 `ZevAlain` 含大写，docker 会拒绝大写镜像名，CI 已做小写化处理）
- 标签策略：`latest` + 7 位 commit 号（如 `:b7575a0`），可精确回滚
- **GPL-3.0 义务**（镜像公开分发 = 分发行为）：
  - 仓库必须保持公开，且与镜像 commit 对应
  - LICENSE 里原作者版权行不可删（已追加 ZevAlain 行）
  - README 的"基于 changshengyu/openreader 修改"声明不可删
  - 若仓库转私有，必须停止公开镜像分发

## 三、CI/CD（2026-10-23 重建后）

`.github/workflows/docker-publish.yml`，4 个并行 job：

| Job | Runner | 职责 | 实测耗时 |
|---|---|---|---|
| `validate` | ubuntu-latest | go test + 三道 advisory 门禁 + 前端测试/构建 + compose/存储契约 | 2.0 分钟 |
| `build-amd64` | ubuntu-latest（按需） | 原生构建 → 卷备份冒烟 ×2 → 按 digest 推送 | 跳过（默认） |
| `build-arm64` | **ubuntu-24.04-arm 原生** | 原生构建 → 卷备份冒烟 ×2 → 按 digest 推送 | 2.9 分钟 |
| `release` | ubuntu-latest | 拉回 digest → OS APK 门禁 → `imagetools create` 合并发布 → 校验 | 0.5 分钟 |

- **平台选择**：push 到 main 默认**只构建 arm64**；Actions 页手动 Run workflow 可选 `arm64` / `amd64` / `all`
- **总耗时约 3.5 分钟**（重建前单 job + QEMU 模拟构建 arm64 需 25–30 分钟）
- 历史：重建前的 arm64 构建走 QEMU 用户态模拟（后端 CGO 编译慢 5–10 倍）；现已完全原生
- ⚠️ **重要**：`scripts/check-{go,frontend,os}-advisories.test.mjs` 会**读取 workflow 文件做结构断言**（步骤名、顺序、触发条件）。改 CI / Dockerfile / 构建相关文件前，先本地跑：
  ```bash
  node --test scripts/check-go-advisories.test.mjs scripts/check-frontend-advisories.test.mjs scripts/check-os-advisories.test.mjs
  ```
- 发布路径：validate 与两平台构建并行 → 各自按 digest 推送 → release 拉回、门禁、合并打 tag。单平台发布时 OS 门禁自动只校验该平台（脚本已支持 1–2 个镜像引用）

## 四、测试与本地开发

```bash
# 后端
cd backend && go test ./...

# 前端（全部测试）
cd frontend && npm ci && npm test

# CI 门禁测试（改构建相关文件必跑）
node --test scripts/check-*-advisories.test.mjs
```

原维护者机器备注（若换机器可忽略）：
- 本机 `/usr/local/bin` 下的 node/git/gh 是 x86_64 二进制且 Rosetta 不可用，需用 `/usr/bin/git`；node 用 DSH 内置版
- npm 默认走了 taobao 镜像源且证书已过期，安装依赖加 `--registry https://registry.npmjs.org`

## 五、部署

```bash
docker compose up -d   # 镜像 ghcr.io/zevalain/openreader:latest，pull_policy: always
```

- 三个卷：`data`（数据库/配置/每日自动备份）、`cache`、`library`（书仓）——**升级前备份三卷**
- 回滚：把 `image` 固定为具体 commit 标签即可；不要混用新旧数据库文件

## 六、维护责任（脱离上游后自负）

1. **三道 advisory 门禁 = CVE 雷达，永远不要删**：每次 push 都会拉最新漏洞库扫描（Go govulncheck / npm 锁文件 / Alpine secdb），CI 失败会点名出问题的依赖
2. **每 1–2 个月主动升级依赖**：`backend/go.mod` 的 Go 版本（stdlib CVE 靠它）、`go get -u` 谨慎升、npm 侧让门禁验证，推上去让 CI 把关
3. **部署面收敛**：尽量内网/VPN 访问，不要裸暴露公网
4. 书源失效基本是数据问题：Legado 格式书源 JSON 由社区维护，换源即可，很少需要改解析代码
5. Service Worker 只做应用壳缓存；离线阅读（章节正文缓存）是已确认的后续迭代，改动时必须保持 `/api/` 永不缓存的整体策略，只为章节内容开受控白名单
5. `docs/compat/` 里的 `changshengyu/reader-dev@fa22f27`、`ghcr.io/changshengyu/openreader:<sha>`、Actions run 链接是**历史验证记录**，不要改成自己的

## 七、AI 协作工作记录（2026-10-22 ~ 10-23）

以下提交由 AI（DeepSeek Harness / glm 编码代理）在维护者指导下完成，全部经本地测试 + CI 验证：

| 提交 | 内容 |
|---|---|
| `5c88321` | **前端功能修复**：远程书源从"每次弹输入框"改为管理界面（列表 + 新增/同步/删除，localStorage 按用户隔离存储）；书源管理与远程导入增加加载动效（v-loading），解决大文件导入无反馈"卡住"的问题。仅改 2 个 Vue 文件，761 个前端测试通过 |
| `369550d` | **CI 触发**：移除 paths 过滤，push 到 main 即触发（原为命中特定路径才触发） |
| `9d48aae` | **品牌迁移**：compose/Dockerfile/双 README/应用内 GitHub 链接/4 个构建脚本全部指向 ZevAlain 仓库；镜像引用统一小写；历史记录与上游致谢按 GPL 要求保留 |
| `5e7eb1f` | **GHCR 小写修复**：`ghcr.io/ZevAlain/openreader` 会被 docker/buildx 拒绝（repository name must be lowercase），workflow 中用 `${IMAGE_NAME,,}` 小写化 |
| `56713d5` | **GPL §5(a) 合规**：双 README 增加"基于 changshengyu/openreader 修改，遵循 GPL-3.0 发布"声明 |
| `ca09db5` | **门禁契约测试更新**：触发断言改为"push 触发且无 paths 过滤"（更强契约）；此前的 CI 失败正是这三个测试对旧 paths 过滤的结构断言所致 |
| `b7575a0` | **CI 重建**：单 QEMU job 拆为 4 并行 job（见第三节）；OS APK 门禁支持单平台校验（parseArguments 接受 1–2 个镜像、评估器允许平台子集、apk 对比助手自适应）；平台可选、push 默认 arm64-only；132 个门禁测试 + 761 前端测试通过，run #5 全绿 |
| 本次合并 | 交接文档 + 移除触发列表中的临时分支名 |

验证基准：CI run #4（重建前全链路，30 分钟）、run #5（重建后默认路径，3.5 分钟全绿）。

## 八、其他

- 仓库根目录的 `AGENTS.md` 是 **gitignored 的 AI 协作记忆**（修改原则、环境坑、CI 方案存档），新维护者接手后 AI 工具会自动读取；本文件（HANDOVER.md）是人类可读的等价物
- fork 关系仍保留：将来若想重新吸收上游修复，随时可以 `git fetch upstream`（需权衡：本仓库 CI 与门禁测试已深度定制，workflow 处可能冲突）
- 仓库 Issues 默认关闭（fork 特性），需要的话在 Settings → Features 开启

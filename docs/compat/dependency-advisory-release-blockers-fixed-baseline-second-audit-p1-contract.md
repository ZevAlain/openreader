# 发布门新增依赖公告维护合同（P1）

固定上游：`changshengyu/reader-dev@fa22f271849d45f93349ae1636223e27b16a4691`（本切片不涉及上游可见行为）

当前实施基线：`OpenReader@9e77cd9`（认证会话 P0 修复分支，见
[`authenticated-session-legacy-public-secret-fixed-baseline-second-audit-p0-contract.md`](authenticated-session-legacy-public-secret-fixed-baseline-second-audit-p0-contract.md)）；
`origin/main` 为 `a1a1795`。

审查日期：2026-10-22
状态：**contract-only**

前置合同：Go 依赖与工具链见
[`runtime-dependency-advisory-fixed-baseline-second-audit-p2-contract.md`](runtime-dependency-advisory-fixed-baseline-second-audit-p2-contract.md)
第 10–12 节和 [`go-advisory-release-gate-contract.md`](go-advisory-release-gate-contract.md)；前端依赖与全锁审计门见
[`frontend-dependency-advisory-fixed-baseline-second-audit-p2-contract.md`](frontend-dependency-advisory-fixed-baseline-second-audit-p2-contract.md)。
这些合同的已签收结论不重开。

## 1. 范围与结论

认证会话 P0 修复完成后，按 `openreader-regression` 在本地运行与 CI 相同的发布门。上次成功发布是 Actions
`39125862052`（2026-10-18，`238e3f3`）；之后公开了三组新公告，两个失败关闭的门在当前树上都失败：

| 门 | 结果 |
| --- | --- |
| `node scripts/check-go-advisories.mjs` | exit 1：`unreviewed advisory GO-2026-6809` |
| `node scripts/check-frontend-advisories.mjs` | exit 1：`npm audit` 报 2 个 high（`follow-redirects`、`vite`） |

CI 在构建镜像前运行同样的门，所以此时任何合入 main 的提交都不会产生镜像，P0 修复也发不出去。用户在本会话
确认按独立切片一并修复（2026-10-22）。裁决：**must-fix（发布阻塞）**，按第 4 节做最小升级。

## 2. 公告与适用性

| 编号 | 公告 | 当前版本 | 修复版本 | 适用性 |
| --- | --- | --- | --- | --- |
| A1 | [GO-2026-6809](https://pkg.go.dev/vuln/GO-2026-6809)（CVE-2026-111943），`crypto/x509` 不再信任被攻破的中间证书；2026-10-21 公开 | Go 1.26.9 | Go 1.26.10 | **可达**。govulncheck v1.9.0 符号级发现：`crypto/x509 Certificate.Verify` 经 `crypto/tls` 客户端握手可达（发现轨迹之一从 `services/backup` 的读取进入）。对外 HTTPS 请求（例如备份、书源、封面与章节图片抓取）用系统根证书校验服务端证书链；1.26.9 仍会接受经这些中间证书签发的证书链。 |
| A2 | vite：GHSA-698v-4r3x-3vcv、GHSA-r825-w8mm-5pxw、GHSA-587h-7wmj-h5pm（`launch-editor`）、GHSA-9jrq-w75r-8gcw（自定义中间件跨源脚本执行）、GHSA-rq7h-c2jc-7f22（`server.fs.allow` 绕过）；影响 `>=8.0.0 <=8.1.5` | 8.0.16（devDependency，精确固定） | 8.1.6 | 只影响开发服务器（`npm run dev` / `vite preview`）。生产镜像由 Go 二进制服务 `vite build` 的静态产物，不运行 vite。 |
| A3 | follow-redirects：GHSA-q3jh-wrc6-jgq8、GHSA-8r9p-f939-6h3c（跨源跳转时没剥掉凭据请求头）；影响 `>=1.16.0 <1.16.1` | 1.16.0（经 `axios@1.20.0` 引入的生产依赖） | 1.16.1 | axios 的浏览器构建使用 XHR/fetch 适配器，follow-redirects 只服务 Node 端 http 适配器，预期不进入浏览器产物（第 6 节核验）。全锁门不区分运行时可达性，必须升级。 |

`GO-2026-5932`（不再维护的 `crypto/openpgp`）的既有不适用结论及其审查期限不变。

## 3. 差异分类

| 编号 | 分类 |
| --- | --- |
| A1 | **must-fix**：可达的标准库安全修复，无可签收的例外理由 |
| A2 | **must-fix**：只影响开发服务器，但全锁门失败关闭；没有 8.0.x 修复版，最小修复是 8.1 线的安全回补版 8.1.6 |
| A3 | **must-fix**：预期不在浏览器产物里，但全锁门失败关闭 |

不得通过给门加例外、放宽严重度或跳过开发依赖来过门。

## 4. 目标与不变项

### 4.1 Go 1.26.10（A1）

- `backend/go.mod` 的 `go` 指令 `1.26.9` → `1.26.10`；模块依赖与 `go.sum` 不变。CI 的 `setup-go` 读取
  `go-version-file: backend/go.mod`，随之使用 1.26.10。
- `Dockerfile` 后端构建阶段改为官方 `golang:1.26.10-alpine3.23` 的 OCI index
  `sha256:107301490755aa2ea1b0b43788b6e62cff2faae45a538028b193becc06aaffba`（`linux/amd64`
  `sha256:9d1e2c4fda593efb2c405e1c855c75ec17fe42dc02f6b7142a5ea7af7f386bf4`、`linux/arm64/v8`
  `sha256:8c61d9486d6cf1e494c4cdd9704f52ad817938bc7aee2b1de816b46f6712e6e6`；2026-10-21T21:25:10Z 由
  `docker-library/golang@650cf2f338d22da87df8c773cfc88afa26699502` 构建，base `alpine:3.23`）。
- 运行时 `alpine:3.23.6` pin、构建期签名 zlib `1.3.2-r1`、`node:22-alpine3.23` 前端构建阶段、CGO/vendor 构建方式、
  单二进制、挂载目录与环境变量都不变。

### 4.2 前端锁文件（A2、A3）

- `frontend/package.json`：`vite` `8.0.16` → `8.1.6`（继续精确固定）；`overrides` 增加
  `"follow-redirects": "1.16.1"`，与既有 `postcss`/`nanoid`/`source-map-js` 精确 override 同一做法。
- 用 `npm install --package-lock-only` 重新生成 `package-lock.json`；锁文件变化只允许是 vite、follow-redirects
  及 vite 8.1.6 自身声明需要的传递依赖。不升级 axios、vue、element-plus 或其他直接依赖，不批量 latest，
  不选 8.3.x（8.3.5 发布不足两天）。

### 4.3 不变项

- 发布门脚本、其合同测试与 `GO-2026-5932` 例外不改；不新增例外。
- 不改 API、数据、前端源码和界面行为，不改 schema、备份或启动流程。
- README 里的 “Go 1.26.9+” 字样（徽章、源码构建要求、技术栈表）不在本切片修改：README 正由分支
  `claude/readme-user-facing` 整体改写，届时同步为 1.26.10。在此之前，`go` 1.26.9 用默认的
  `GOTOOLCHAIN=auto` 构建源码时会自动下载 1.26.10 工具链。

## 5. 红（既有发布门即红测）

本切片不新增测试代码：两个发布门本身就是已提交、在 CI 中强制执行的失败关闭检查，它们在当前树上的失败
（第 1 节）就是本切片的红；门的精度与失败处理已由 `scripts/check-*-advisories.test.mjs` 覆盖（本地 128/128）。
GO-2026-6809 涉及的具体中间证书不在本仓库可控范围内，不编写证书链行为测试。

## 6. 验证门（实现后）

1. backend 内 `go version` 为 `go1.26.10`；`go test ./...`、`go vet ./...`、`go test -race ./api ./db ./services/...`
   （api 需 `-timeout 40m`）全部通过。
2. 实际 Go 门 exit 0，扫描配置 `go_version=go1.26.10`，不再有 GO-2026-6809 发现，GO-2026-5932 前提照旧成立。
3. 前端 `npm ci`、`npm test`、`npm run build` 通过；实际前端门 exit 0（npm audit 0 漏洞）；构建产物中没有
   follow-redirects（A3 适用性核验）。
4. `docker compose config --quiet`、`node scripts/smoke/store-read-list-lifecycle-contract.mjs` 通过。
5. 合入 main 后，可信 Actions 完整运行双平台候选镜像构建、OS APK 门、fresh / historical 卷门并发布；用
   `gh run view` 与 `docker buildx imagetools inspect` 核验 run 结论、OCI index digest 与两平台。

## 7. 非目标

- 不升级到 vite 8.3.x，不升级 axios 或其他依赖，不改 Node 22 构建镜像。
- 不修改 README（见 4.3）；不处理与本次发布无关的其它开放审计项。

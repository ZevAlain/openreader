# Go advisory 发布门合同（2026-10-16）

状态：contract-only，测试/工具/workflow 尚未实现。补充
[`runtime-dependency-advisory-fixed-baseline-second-audit-p2-contract.md`](runtime-dependency-advisory-fixed-baseline-second-audit-p2-contract.md)
第4–5节；不是另一个产品行为或数据库迁移。上游固定 fa22f271 的认证、规则、旧书和持久化合同不变。

## 判定边界

- 新增 Node 标准库工具，内部启动固定官方 `govulncheck@v1.9.0 -json ./...`，不接受外部 JSON
  冒充一次成功扫描。运行时、包图和工具链来自同一 `backend` cwd；不改全局 Go、代理或凭证。
- 工具必须真实终态 exit0；超时/被杀/DB不可用/解析错误/空或截断输出均失败。JSON exit0 不代表
  无 finding。验证 v1.0.0、scanner/version、source/symbol、官方 DB、实际 Go、非空 SBOM/root。
- DB时点不得晚于当前时刻24小时或落后14天；时间不可解析即失败，无环境变量绕过。
- 正确解析连续 JSON object，包括字符串中的括号/转义；拒绝未知消息、重复 config/SBOM、未知
  finding OSV、空 trace、缺失模块/版本以及不一致 metadata。无 findings 是有效结果，不要求返回
  OSV 数量固定；OSV记录本身不等于版本匹配。
- 所有包级、符号级 finding 和未知模块级 finding 阻止发布；这是一条维护门槛，不将每个报告
  自动称为公网可达漏洞。binary/extract/模块扫描不能传入此 source 判定器获 clean。

## 唯一有条件不适用项

仅 GO-2026-5932 的纯模块级 x/crypto finding 可单列 not-applicable，必须同时满足：

1. OSV只影响 `golang.org/x/crypto`，Go imports列表非空且每个包均为 `openpgp` 或其子包；
   无已修复版本、finding与实际选中 crypto/SBOM 版本一致，不以 advisory ID 单独放行。
2. 现场重新产生的完整宿主 `./...` 依赖图和 Linux amd64/arm64、CGO1 的 main 依赖图均非空，
   有 main/bcrypt 且都无 OpenPGP 族。保留 bcrypt；不能通过删除认证依赖消除模块。
3. 任一图引入该族、OSV新增其它受影响包、出现包/符号 trace、版本不一致或证据不全即失败。
4. 该裁决有效期至 **2026-11-16T00:00:00Z**，过期需显式复审，不设永久/通配 CVE ignore。

## 证据和发布接线

输出原始扫描、实际 Go env、三份图及结构化 summary 到独立临时目录并显示路径；summary明确
source目标平台/CGO、DB时间、不适用项和未覆盖 C/OS/Node/frontend，不称 whole-image clean。
记录失败原始结果，不用过滤后的空文件代替。测试仅使用小型自有协议 fixture，覆盖格式错误、
工具错误、元数据错配、陈旧DB、precision混淆及 OpenPGP 前提失效。

先独立提交合同，再添加新工具的合同测试（不存在的工具只算 availability/TDD red，不冒称新的
上游漏洞行为 red），后实现并跑真实扫描。已有6个依赖行为反例仍单列，不合并计数。
在可信 Docker workflow 的 Node setup 之后、镜像构建/登录/推送之前运行测试及真实门。
保留 backend/frontend/HTTP/Compose/新旧卷/portable门；新 gate 的脚本/测试变化也应触发 workflow。
精确剥离候选的 binary 扫描另记模块级精度，不能通过此 source gate 宣称两架构二进制均零可达。

未完成：实现/合同测试/真实 gate/可信 Actions 接线及发布；更广 frontend、OS/C、真实设备及整体
重构继续开放。当前候选4487203尚非正式镜像，生产另一台Mac不作写入或升级。

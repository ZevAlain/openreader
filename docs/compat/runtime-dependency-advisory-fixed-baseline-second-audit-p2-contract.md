# 运行时与依赖 advisory 第二轮固定基准合同（P2）

审查日期：2026-10-15。固定上游：`changshengyu/reader-dev@fa22f271849d45f93349ae1636223e27b16a4691`。
源码基线：`36e0697f777d54a2df224cc0d9df9d10eba25781`；已发布应用：`b4ff9ca`。
状态：**inventory-complete / behavioral-reds-pending / implementation-not-started**。

本提交仅合同，不修改应用、测试、模块图、锁文件、Dockerfile或工作流。不是生产受攻击结论；
已恢复的原书故障不重开，生产另一台Mac不升级、不写入。旧“npm8high/advisory待审计”记录由本项
开始逐证据收敛，不以扫描数量或版本陈旧直接宣称可利用。

## 1. 固定上游和必须保持的产品合同

本轮从 pinned raw source 再读：

- `src/main/java/com/htmake/reader/api/controller/BaseController.kt:87–172`：登录生成独立token，
  保存当前namespace会话；自动登录核验用户及token期限，续期既有会话。上游不是Go JWT，不能
  将依赖漏洞或版本号当上游功能要求；OpenReader JWT/SQLite/多用户为已签约适配。
- `src/main/java/io/legado/app/model/analyzeRule/AnalyzeRule.kt:204–244,270–326`：列表和文本
  根据规则mode分派，XPath参与同一变量/替换/组合链。
- 同目录 `AnalyzeByXPath.kt` 全文：节点/元素和文本求值，以及`&&/||/%%`合并、回退和交错。
  不从当前Go节点适配器推导JVM标量XPath完整对齐，更不复制Go依赖的无限循环。

已签收的认证会话、source evaluator/fetcher、HTML安全处理、Reader、local import、WebDAV和backup
合同保持。安全适配可以修补不终止/过量分配、维护支持中的构建链，但不得改成功协议来迎合依赖。

## 2. 初始取证及扫描精度

官方工具`golang.org/x/vuln/cmd/govulncheck@v1.9.0`，数据库`https://vuln.go.dev`，本次
`db_last_modified=2026-10-08T22:31:09Z`。只读元数据/扫描不改变`go.mod/go.sum`；工具通过
独立`go run ...@v1.9.0`使用缓存，未添加为应用依赖。官方文档说明JSON模式即使发现漏洞也exit0，
因此必须检查消息和findings，不能将工具exit0称“通过”。

- 当前源码source/symbol扫描使用本机`go1.26.5/darwin-arm64`，不含test；246条返回OSV中，
  57条有版本/包匹配、28条有报告的符号路径。28由x/text1、jwt1、xpath1、x/net9、stdlib16组成。
  静态接口/反射和OS前提仍需复核；不是28个已复现漏洞，也不是正式Linux工具链扫描。
- 已核验自有`openreader-import-durable-local:b4ff9ca`完整OCI revision后，以非root、断网、只读、
  无挂载/端口的短命cat容器提取`/app/openreader`；没有运行服务，容器已移除。`go version -m`
  证明实际`go1.24.13`、CGO1、linux/arm64和现有模块版本，不拿宿主1.26.5冒充候选。
- 对这份精确候选的binary扫描匹配76条，但官方extract仅有build/module信息，**pkgSymbols=0**。
  已读官方v1.9.0 `internal/vulncheck/binary.go:105–114`：该情形退化为go.mod级精度并枚举已知
  affected symbols；输出仍标symbol不等于实际可达。`go mod why golang.org/x/crypto/ssh`明确
  main不需要SSH。因此76只能记模块级保守匹配，不能记76实际符号/生产漏洞。
- `npm audit --json --package-lock-only`终态exit1，8个high受影响包、无critical/moderate包计数；
  一个包可关联多条不同严重度advisory。未执行fix/install脚本、未改lock；8不等于8独立漏洞。

本地证据：`/private/tmp/openreader-dependency-govuln-source-initial.json`、
`/private/tmp/openreader-dependency-govuln-binary-b4.json`、
`/private/tmp/openreader-advisory-b4.JjgmeY/govuln-extract.json`、
`/private/tmp/openreader-dependency-audit-npm-initial.json`。精度校验器只在tmp，不依赖extract格式
作为长期公开协议；原始结果保留，不删报错或用空输出当clean。

## 3. 可达性、版本和分类矩阵

| 面 | 初始证据 | 裁决与约束 |
|---|---|---|
| JWT malformed分段 | v5.2.1，`authsession.parseClaims→jwt.ParseWithClaims→ParseUnverified`；[GO-2025-3553](https://pkg.go.dev/vuln/GO-2025-3553)指向分段过量分配，v5.2.2修复。 | `must-fix dependency`，需有界自有输入实际分配红测；不改HS256、claims、sessionTTL、legacy默认secret兼容或401。扫描不是行为red。 |
| XPath true布尔列表 | v1.3.3，`sourceRuleXPathElements→htmlquery.QueryAll`；[GO-2026-4526](https://pkg.go.dev/vuln/GO-2026-4526)指向logicalQuery.Select对true条件不终止，v1.3.6修复。 | `must-fix dependency`，必须在可杀的自有worker中真实调用当前evaluator，不在主测试进程泄漏死循环；不删除XPath/简单黑名单或借机重做标量语义。 |
| x/net HTML/IDNA/HTTP2、x/text | v0.33.0/v0.21.0；source符号路径到远程HTML、EPUB、网络策略、文本初始化；HTML死循环/复杂度和HTTP2等有官方OSV。 | `must-fix version baseline`，逐类保持正常解析/编码/namespace/网络策略黄金输出；不能从input byte limit或末尾ctx推导底层CPU问题已修复。 |
| Go标准库和构建工具链 | 正式候选Go1.24.13，宿主1.26.5均有后续安全补丁；[官方支持政策及发布记录](https://go.dev/doc/devel/release)确认1.26.9/1.27.2于2026-10-08发布。 | `must-fix maintained runtime`，选择支持中且覆盖已确认修复的精确patch/index；本轮最低必要目标Go1.26.9，不无故跨到1.27。依赖x/net0.60.0要求Go1.26.0，须显式记录最低构建版本变化。 |
| Alpine runtime与builder | 当前runtime为固定3.20 digest；[官方release表](https://www.alpinelinux.org/releases/)列3.20普通支持止于2026-04-01，之后on-request。 | `must-fix support baseline`，选择支持中的精确官方镜像并核验真实平台/包/CGO/CA。EOL不是某CVE可利用证据；govulncheck不覆盖musl、SQLite C、Node或OS包。 |
| Axios | lock1.16.1，多项Node/HTTP2/原型污染gadget；实际`client.js`仅axios.create实例，普通方法alias，浏览器XHR/fetch。 | `mixed: maintenance must-fix / exploitability conditional`，不称Node代理/HTTP2已部署；[默认实例method advisory](https://github.com/axios/axios/security/advisories/GHSA-9fr6-4gfg-395g)明确区分create/alias。仍核对header/auth/form/fetch边界，不因无Node运行时忽略浏览器gadget。 |
| Vue/SSR | lockvue/server-renderer3.5.34；[维护者SSR advisory](https://github.com/vuejs/core/security/advisories/GHSA-g2v6-rqmx-r4w6)涉及不可信属性键；应用main.js使用createApp，无SSR server。 | `not proven production SSR exposure`；npm修复range与维护者页面“None”不同，目标版本须再用发布/源码/行为核验，不能只相信fixAvailable。正常Reader/Index响应式行为必须回归。 |
| Vite开发服务器 | lock8.0.13；[维护者advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)要求Windows/NTFS等条件，修复8.0.16；当前dev命令确有host0.0.0.0。 | `development maintenance must-fix`，不是Linux Go生产server的任意文件泄漏；保留已签收静态树防护，不能将修复变成启用生产Vite或SSR。 |
| form-data/nanoid/postcss/source-map-js | lock4.0.5/3.3.12/8.5.14/1.2.1；分别涉及Node multipart、非安全generator边界、构建map读取、indexed map offsets。 | `unknown reachability / maintenance pending`，逐一查依赖链、实际bundle/构建输入及维护者patch；不运行不可信外部PoC、不用omit-dev消除报告。 |
| 其它模块/包/平台 | module-only匹配（例如SSH）、Windows-only、未测试反射路径、SQLite C与基础OS包。 | `unknown/conditional`，单列证据和处置；不能把本机darwin source或剥离binary扫描升级成两架构全覆盖或“所有依赖无漏洞”。 |

## 4. 修复范围和不变项

1. 本轮覆盖实际部署二进制/工具链、Go模块、前端客户端与构建依赖、官方基础镜像和发布审计门。
   目标是已确认advisory修复、或逐条有证据的不可达/不适用说明；不是只把npm数字清零或只改JWT。
2. 选择与当前major兼容的必要修复版本及MVS传递更新，记录精确前后graph、Go最低版本和官方
   registry digest。不做无证据全量latest、`audit fix --force`、GORM/SQLite schema或Vue架构重写。
3. 认证继续Bearer/既有WebDAV/WS入口；旧合法JWT和会话继续可用，不重新签发、强制所有人退出、
   更换secret或修改claims/TTL/error/status；异常输入只做原协议的安全拒绝，不能暴露原token。
4. CSS/JSONPath/XPath/regex/变量/分页、HTML清理、charset/encoding、relative URL、安全网络规则和
   已签收Reader布局/交互保持。布尔XPath须有界结束，但本项不授权新标量产品功能或移除XPath。
5. Go/Alpine变更不能改变public/私有权限、native原实体/取消/补偿、同源/CA/代理和持久路径；
   `data/cache/library`、numeric URL、SQLite/backup、进度/书签/分组、prepared tokens和前端key不迁移。
6. 工具退出码与漏洞结论分开。发布门必须分清source配置、精确候选binary精度、OS/架构/CGO与
   锁文件作用域；解析失败、DB不可用、空文件或剥离符号不能默认为clean。不得为了绿灯忽略dev、
   整类CVE或未验证路径；必要豁免需逐项证据，不能宽泛永久排除。

## 5. 合同→实际红测→实施门禁

此合同和matrix/API/data/security须先独立提交推送、核验精确SHA；之后才添加测试。

1. JWT：固定安全小输入（仅大量`.`、无凭证）调用当前authsession/parseClaims路径；真实分配
   统计需充分预热、定次数和宽裕线性上界，独立正常HS256及错误算法控制。编译失败、版本字符串
   断言或扫描metadata不计行为red；不向生产发送输入。
2. XPath：`@XPath:1=1`和`@XPath:true()`真实evaluator调用，隔离自有subprocess，握手证明已进入
   工作再观察终态，超时必须杀掉并Wait回收。普通节点/text/attribute/false/组合作为控制；不以
   留后台死循环或虚假sleep驱动red，不锁定尚未签约的标量返回内容。
3. HTML/编码/HTTP/parser及其它advisory：优先使用维护者最小fixture或同等自有fixture，逐条
   区分已绿控制与实际red；保留既有完整parser/认证/RootedFS/网络策略测试。
4. 再更新必要模块/锁文件/精确builder/runtime与审计门；补清scan格式、失败模式、平台和工具链
   差异控制。每个readable失败应是实际行为/确定缺少安全版本，不把故意red推main发布。
5. focused/race/fullGo/vet、frontend全量/build、真实Go+SQLite/HTTP+Chromium1440×900/
   390×844/360×800、非root native Linux两平台可执行范围、同SHA候选fresh/historical/
   portable/backup/restart、可信Actions双架构与独立OCI/config/二进制审计全部逐项记证。
6. 修改后的审计结果需注明DB时点和未涵盖C/OS/Node内容。包/符号精度不充分时保留未完成，
   不宣布完整安全审计、全parser CPU取消、跨进程exactly-once或整个重构完成。

## 6. 当前版本和开放项

Git HEAD36e0697，main最后核验9e10ba3（纯发布ledger）；应用Docker b4ff9ca/latest OCI index
`sha256:60e97193265ff47808a3910cae1d0bf8a8cec6a3c7b5b4a12efeb7bab144c6ee`。
生产最后只读仍完整`b2b32f7b40bb8cefc18d316aefb29865aede9872`/statusok；无本轮生产变更。
所有scanner/提取容器已终态，工具缓存/自有tmp证据保留，工作树仍未改应用。
本合同的行为红测、修复、后置审计及全部新候选门尚未进行。完整parser CPU/regex/DOM抢占、
scan/峰值FD预算、late-tx控制、真实设备签收和其它action-level/整体审计仍未完成。

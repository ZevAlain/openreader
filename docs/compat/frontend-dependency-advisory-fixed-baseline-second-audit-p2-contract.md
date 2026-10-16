# 前端客户端与构建依赖 advisory 固定基准补充合同（P2）

日期2026-10-16；固定上游 `changshengyu/reader-dev@fa22f271849d45f93349ae1636223e27b16a4691`。
当前源码/远端main `b573aed010419e870afa03a8d3b986d12c0ccd78`（发布后纯ledger），Docker应用
`b2632a4c248a53ce7bade8bdba7bdef66b89b236`。状态 **contract-committed / behavioral-reds-reproduced /
implementation-not-started**。补充运行时合同第3–5节，不把上一Go维护切片当作完整依赖审计完成。

## 1. 固定上游与已签收适配

本地pinned checkout不存在，重新只读读取精确commit（不取浮动HEAD）：

- `web/src/plugins/axios.js`全文：独立Axios.create、可变服务baseURL、300秒timeout、返回原response/
  transport error；request.get/post保留params/data/options；accessToken进入请求参数，NEED_LOGIN
  打开根登录框。版本0.21/Vue2不是本项目安全版本要求，更不复制旧依赖的漏洞。
- `web/src/main.js`全文及`web/package.json`：Vue2浏览器`new Vue(...).$mount('#app')`和Vue CLI
  构建，没有本轮新SSR/Node应用服务。OpenReader Vue3/Pinia/Vite/Element Plus为已签收运行时适配。
- `web/src/plugins/vuex.js:229–241`与`web/src/App.vue:524–541`：打开登录框使loginAuth失效，登录
  后保存token、同步用户localStorage并`init(true)`。继续遵守已实施的Reader重新认证隔离合同，
  不因依赖维护回退到整页刷新、跨用户旧正文或旧401清空新token。

OpenReader现行REST/JWT/12秒客户端及独立30秒章节请求预算，是既有签约协议，不在本轮改成
上游请求参数token/300秒或isSuccess包装。维护选择安全版本，不重做产品架构。

## 2. 当前证据及差异矩阵

原锁离线`npm ci --ignore-scripts`终态0且manifest/lock无diff；完整`npm audit --json
--package-lock-only`终态1，再次确认8个high**受影响包**，不是8个独立CVE或8个生产可利用漏洞。
完整锁图132依赖（prod/dev/optional有重叠，不相加冒充独立总数）。实际图：Axios→form-data；
Vue精确同版本的compiler/runtime/shared/server-renderer；Vite与compiler-sfc→PostCSS→NanoID/
source-map-js，compiler-core也用source-map-js。没有添加SSR服务器或生产Vite。

| 面/必要版本 | 适用性与本轮裁决 | 行为门/不能推出的结论 |
| --- | --- | --- |
| Axios1.16.1→1.20.0 | `maintenance must-fix / conditional gadgets`；[Basic-auth subfields](https://github.com/axios/axios/security/advisories/GHSA-xj6q-8x83-jv6g)需既有污染+own auth对象缺失子字段；当前app无该空auth用法。 | 隔离worker实际共享resolver的继承值拒绝/own值控制、formToJSON深度边界；库级反例不冒称公网请求可触发。保留真实app两个Axios实例的认证/取消/错误/上传正常控制。 |
| 其它Axios报告 | 当前拦截器mutate并return同config，不满足[重建config且丢own headers](https://github.com/axios/axios/security/advisories/GHSA-j8rh-479h-cp32)前提；[getHeaders gadget](https://github.com/axios/axios/security/advisories/GHSA-4hqw-qxg8-jxx2)在非标准浏览器分支，默认实例method与create/alias也不同。Node HTTP2/代理/dataURL不在已部署Go进程。 | 按已读维护者条件区分，不将任一Node fixture作浏览器production证明；1.20.0覆盖已确认必要修复区间，不盲目升级所有包。无污染源证明，不称自动凭证窃取。 |
| Vue/server-renderer3.5.34→3.5.42 | `maintenance must-fix / SSR not deployed`；[维护者advisory](https://github.com/vuejs/core/security/advisories/GHSA-g2v6-rqmx-r4w6)仍未列patched版本，但真实v3.5.42 shared属性名正则已补CR。 | 小型ssrRenderAttrs属性名反例及正常转义控制；明确库级，app仍createApp SPA，不能称已复现生产SSR XSS。Vue家族保持同一精确patch。 |
| Vite8.0.13→8.0.16 | `dev maintenance must-fix / Windows条件`；[alternate-path advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)和UNC启动编辑器条件不在Mac/Linux已复现范围。 | 必要版本/构建/dev配置保持；不伪造Windows红测，不把生产Go静态服务换成Vite，不关闭static-tree边界。 |
| form-data4.0.5→4.0.6 | `conditional Node multipart / maintenance`；[维护者修复](https://github.com/form-data/form-data/security/advisories/GHSA-hmw2-7cc7-3qxx)转义field/filename CR/LF/quotes。app实际用浏览器原生FormData，固定字段。 | 自有Node库buffer拒绝注入行+正常Unicode值/文件名；不使用用户文件/网络，不称app正在运行Node multipart。 |
| PostCSS8.5.14→8.5.23 | `build maintenance`；[缺from残余修复](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp)。 | 自有临时.map/CSS，验证非预期map内容不能进入结果，正常CSS/map控制；不读宿主秘密，不将构建库当生产CSS处理API。 |
| NanoID3.3.12→3.3.18 | `build dependency / maintenance`；[3.x最终native分支补丁](https://github.com/ai/nanoid/commit/e10f8d40ce9d1ab47f66d65a16b48086432730d0)，3.3.17不足以覆盖所有报告分支。 | public customRandom/non-secure边界用自有随机提供者/计数看门狗有界证明0或负值不得继续生成，正常ID控制；无app native/async调用证明，不额外安装expo-random或升major5。 |
| source-map-js1.2.1→1.2.2 | `build/compiler maintenance`；[维护者补丁](https://github.com/7rulnik/source-map-js/commit/cf7658058ceeaa8619d5ae0ec90be6905209d016)。 | 构造期拒绝无效/超上界/嵌套超界offset，不实际展开巨大map；小深度sources getter计数验证线性工作，正常indexed map/lookup控制。库级，不是生产Node入口。 |

七个必要版本均已通过官方npm Registry实际version/integrity/repository/engines元数据核验，非
fixAvailable猜测；Vite8.0.16必要包含rolldown1.0.3，Vue成套patch和Axios/PostCSS必要传递边变更
需逐项列图。原始证据`/private/tmp/openreader-frontend-advisory-current-audit.json`、
`*-baseline-graph.txt`、`/private/tmp/openreader-frontend-minimum-patch-metadata.json`及维护者源码/
patch记录保留。不执行下载的外部PoC；只依据已读边界设计自有微小fixture。

## 3. 必须保持的客户端/API/数据/界面合同

1. `src/api/client.js`两个独立create实例：API baseURL `/api`、root无API前缀，默认timeout12000；
   显式Authorization不得被默认Bearer覆盖。原localStorage key、返回response.data形状和错误对象
   保持。Node测试用自己拥有的adapter/loopback，不联系生产或打印真实token。
2. 仅非login/register、仍等于storage当前Bearer的401可移除该token并发一次auth-required；迟到A
   的401不得清空B，保留rejectedToken的一次性scope提示和既有generation隔离，不吞掉401。
3. 正常JSON、native FormData/file/title/tocRule/token、Basic/WebDAV、下载及AbortSignal/timeout
   必须继续工作；取消不能触发登录失效，旧Reader请求预算/队列/同章合并不得重做。
4. Reader/Index/overlay/路由、数值bookURL+resume、字体/主题/布局、触摸/键盘/原生wheel+点击翻页、
   居中几何、登录恢复和本地导入顺序/重新解析/批量状态机保持既有合同；不添加UI业务改动。
5. SQLite/GORM/data/cache/library/WebDAV/backup、进度/书签/分组、旧会话和browser存储key均不迁移。
   Go1.26.9及Go审计门保持已签收结果，不顺手改Go模块/基镜像/架构或新生产运行模式。

## 4. 红测、实施与准确发布门

此补充和matrix/API/frontend/data/security先独立提交推送并核验SHA，再添加测试，后改manifest/
lock/工具或workflow。小输入/计数阈值是行为门，不靠版本字符串、编译失败或扫描数量当漏洞red。

- 库级危险分支在自有Node子进程中执行；进入工作握手后计时，V8堆上限、输出上限、启动/工作
  deadline、SIGINT/SIGTERM/超时均杀掉并close回收。计数看门狗限制实际随机/映射工作，不故意
  sleep、不在主测试进程留死循环/OOM/污染。正常控制与真实失败数量分开，重复稳定后独立red
  checkpoint推送；在未实现前不可推main发布。
- 增补真实app Axios正常控制，既有源字符串接线测试不能替代实际实例行为。局部prototype污染
  只在worker使用固定无秘密值并finally恢复，不触碰用户浏览器或构造跨主机恶意请求。
- 然后只提高必要依赖floor并用npm生成lock，保持当前majors，不audit-fix-force、不全量latest、
  不将transitive包新增为app direct dependency。必要传递更新逐项说明；若实际发现更多必要修复
  先补证据/合同，不用宽泛override或忽略绕过。
- 新增准确的全锁npm发布门：内部运行官方registry的npm audit JSON，显式包含dev/optional/peer，
  使用真实退出码、完整auditReportVersion2/schema/计数及同一lock哈希校验，保留raw/summary。
  registry/工具错误、空/截断/解析失败、未知schema、缺失dev证据或任一severity finding均阻断；
  不接受外部结果冒充新扫描，不设置漏洞ignore。npm未提供Go式DB时间，记录观测时间/registry/
  npm/Node/lock范围而非捏造DB时点；无finding不等于Go/C/OS/生产全清。
- npm门本身先有合同测试；工具未存在仅算availability/TDD red，不是新的依赖漏洞反例。复用
  已验证的owned-process规则，Actions在Node setup后、镜像构建/登录/推送前运行门和测试，并
  增加脚本路径触发。原Go审计门、HTTP及卷门不得删除/降级。

## 5. 后置验收与范围不缩小

相同测试预算原样green；完整frontend全量/build，Node22与本机Node分别记录；实际Go+SQLite+
三视口Chromium1440×900/390×844/360×800，含Reader工具/面板/中心/wheel/点击、正常认证和
native上传/导入/正文/会话边界；完整backend/fullrace/vet/Go审计与Compose保持；精确候选新旧卷/
portable/backup/restart，可信Actions两平台、独立OCI/config/实际binary审计逐项终态证据。
不得用“8high消失”替代产品回归，不能靠放宽断言/隐藏错误/omit-dev/改业务API通过。

当前未添加测试/未实现，前端版本仍原锁。已发布Go切片b2632a4/index
`sha256:936939c55f86fe456af4425ac35506fccd7ba93dd2858402446b7ba01d2284ab`不含本项补丁。
生产另一台Mac不操作、不升级、不重新推断commit；最后独立记录b2仅历史事实，已恢复原书事件
关闭。OS/C、完整parserCPU/scan/峰值FD/late-tx、真实设备和更广重构仍继续，不能缩小为只升Axios。

## 6. 独立合同后的真实旧锁红测（2026-10-16）

合同 `7ff39d9de7845056d007e95de5aa852c629c28a6` 先推送并精确核验。额度检查中断的首次大
patch未执行；恢复后再次核对cleanHEAD/远端，确认没有worker文件/红测进程，再正常审批添加
测试。中断前原锁全量762/762已终态通过；未执行的调用不倒填为证据。

仅新增隔离worker、父测试和npm门合同测试，应用/manifest/lock/Go/base/workflow均未改。
最终26项重复三轮每轮 **13个实际库级red、13个正常/生命周期控制通过**（合计39/39），
0skip/0cancel；2.302/2.250/2.268秒。实际固定Node22.23.3/linux-arm64/非root/断网/只读容器
原样26项仍13red/13green（3.822秒），不是Windows复现或整个镜像功能签收。

- Axios2叶：共享resolver将自有污染用户名/密码用于empty-own-auth Basic；300层、不到1KiB字段
  名的formToJSON未拒绝深度。own-auth和普通表单控制通过；当前app并未被证明有污染源/空auth。
- Vue1叶：SSR属性名含单个CR仍原样输出；正常Unicode/HTML转义通过。仍是库级SSR，不称SPA受攻。
- form-data2叶：自有field/filename的微小CRLF在buffer内成为额外header行；正常Unicode文件/值通过。
- PostCSS1叶：没有from的自有CSS读取另一个自有.map，其marker进入输出map；正常基路径map通过。
  不读取用户路径/秘密，也不将这个构建库控制称为生产CSS处理入口。
- NanoID2叶：public customRandom(0)、non-secure customAlphabet(-1)均进入自有随机计数第33次，
  在32次工作预算处安全抛出；没有等待无限循环或触发OOM，正常短ID通过，native/Expo分支未运行。
- source-map-js5叶：6层小map读取最内层sources达729次（预算14）；negative/fraction/单层超界/
  嵌套总offset超界构造未拒绝。没有展开巨大line字符串/大量节点，正常段内lookup保持正确source。

首轮21项为12fail/9pass，其中一个拟正常控制在旧indexed-map的精确section边界column0返回
null，属于另外的库查询行为，**不算本轮advisory red、也不声称已解决**。正常控制改为同一
已映射段内column1，仍严格要求fixture.js，不锁定错误null输出；之后补齐fraction/nested合同，
再加3项父harness正向控制，形成最终13/13。三控制真实验证deadline、SIGTERM、输出超限时
kill并await close，不作为漏洞反例；无startup/工作deadline失败或遗留worker。

真实app3叶全部通过：实际两个Axios实例在自有127.0.0.1 HTTP上的API/root URL、显式Basic不被
Bearer覆盖、JSON/nativeFormData、当前/旧/重复401及login/register排除、AbortSignal和timeout。
全frontend **788项/775pass/13fail**（3.964秒），失败精确为上述13个库级反例，原762项仍绿。
npm发布门尚未存在，其单独测试仅 **1个ERR_MODULE_NOT_FOUND availability/TDD red**，没有
执行协议分支，不是第14个漏洞反例。

原始日志`/private/tmp/openreader-frontend-advisory-{initial,final,node22,full}-red.log`、
`*-repeat-red-{1,2,3}.log`和`*-gate-availability-red.log`保留；初轮控制差异不隐藏。先独立推送test/docs checkpoint，之后才
改版本/lock/门/workflow，不能将故意红灯状态推main发布。后置全量/真实浏览器/候选卷/发布及
整体advisory仍未完成；Docker仍b2632a4，生产未操作/未新核验。

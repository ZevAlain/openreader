# SQLite WAL 与 OS/C 依赖固定基准补充合同（P2）

2026-10-16；固定上游 `changshengyu/reader-dev@fa22f271849d45f93349ae1636223e27b16a4691`。
提取时Git/main `24e55bab922e6c55206ef0a64d7fd64c02374da4`，已发布应用
`fc4692c474df30d1f0427cba57e7ebc67c91b156`，OCI index
`sha256:74ef48fd0c9f5547fff9787fb97763fff22e3500a376be05d5379f19dd8af765`。
状态 **inventory-complete / contract-only / behavioral-tests-pending / implementation-not-started**。
前端维护交付保持，不把npm/Go扫描当作C、OS或数据库持久性问题的覆盖。生产另一Mac不操作，
原书已恢复事件关闭；本合同不声称发现生产数据库损坏或远程利用。

## 1. 上游产品语义与已签收适配

MAIN读取精确fa22的 `WebdavController.kt:726–823`：登录及secure下enable_webdav权限、
GET query/POST body路径、用户WebDAV home、ZIP格式、恢复及备份的可见成功/失败；备份复用
最新Legado ZIP，恢复调用namespace的syncFromWebdav。
`BookController.kt:2099–2255`相关sync/save函数：ZIP中bookSource/bookshelf/bookGroup/
rssSources/replaceRule/bookmark JSON及bookProgress数据对应当前namespace；备份写回逻辑数据。
这不是要求OpenReader复制上游物理删除/路径拼接或容错缺陷。

OpenReader的SQLite/GORM、事务、多用户授权、rooted文件路径及portable-v1/v2为既有运行时/
安全适配。`backend/db/db.go`启用WAL、busy_timeout5000、synchronousNORMAL；不限制单连接，
现有连接池合同实际持有两个连接。`backup_restore.go`的有界ZIP、`backup_restore_plan.go`的
已识别JSON工件/预校验/事务恢复，不是直接打开上传的任意SQLite DB。现有settings/source/
progress等UPSERT为固定列/绑定值；尚不能以局部检索宣称所有SQL路径已审计。

必须保持所有API/认证、进度/书签/分组、旧numeric Reader URL、本地归档、cache/library/data、
WebDAV/backup、浏览器key及已签收原实体I/O/取消/补偿合同。没有schema、存储格式、secret/
token迁移；不禁用WAL、不改成单连接串行化、不复制裸db文件来代替已签收逻辑备份。

## 2. 真实版本、精度与差异矩阵

当前go-sqlite3 **v1.14.22**，C amalgamation **SQLite3.45.1**。自有`:memory:`实际宿主查询
sqlite_version/source_id/compile_options：FTS3/FTS3_PARENTHESIS/RTREE/THREADSAFE1，无FTS5。
两份真实发布Linux binary含同一3.45.1 source ID；静态标记FTS3/RTREE存在、FTS5不出现。
静态字符串只作交叉证据，不冒称已对实际binary执行compile_options SQL。还需Linux同构建
条件的原生探针，不能用宿主Go扫描、包版本或未编译的C分支宣称所有C风险清除。

| 面 | 已读证据与适用性 | 裁决/实施及验证约束 |
| --- | --- | --- |
| WAL-reset | [SQLite官方WAL说明](https://sqlite.org/wal.html#walresetbug)：3.7.0至3.51.2的罕见并发时序可能损坏DB；3.51.3及后续或指定回移分支修复。项目有WAL+多连接，满足必要运行条件，但未证明该时序已发生。 | **must-fix persistence maintenance**。最低候选driver v1.14.36/SQLite3.51.3；不能将Go race或普通并发绿灯当C竞态已覆盖。需要源补丁/真实runtime版本及有界确定性时序证据；若未能触发，诚实保留未复现，绝不把版本检查计实际损坏red。 |
| SQLite正常SQL正确性 | [3.45.2修复记录](https://sqlite.org/releaselog/3_45_2.html)列UPSERT索引一致性与空聚合NOT NULL过度优化；维护者论坛919c6579c8/440f2a2f17已读。当前app未观察到冗余REPLACE+双ON CONFLICT或此空聚合表达式。 | **conditional library / maintenance**。自有微型SQL库级反例及正常控制，不能叫当前API漏洞；不是通过可疑SQL损坏用户DB。当前固定单UPSERT/普通NULL与空表控制保持。 |
| FTS5/CAPI/恶意DB等报告 | [SQLite维护者CVE表](https://sqlite.org/cves.html)将SQL注入、可控DB、FTS5、zipfile/session扩展和CAPI参数等条件分开；部分编号并非SQLite缺陷。 | **conditional / audit-open**。不做整类CVE永久忽略；不添加FTS5/zipfile/Session或危险CAPI来制造可达性，不以“不支持任意SQL”替代逐入口授权/参数及恢复路径审计。 |
| zlib runtime包 | 官方Alpine v3.23 secdb main列CVE-2026-85091在1.3.2-r1修复；两个真实发布平台均1.3.2-r0。aports提交b92621a8及其补丁指向维护者df84af25：非阻塞gzwrite错误返回后重置输入状态。Go服务实际ldd仅musl，没有应用请求到C gzwrite的证据。 | **must-fix image maintenance / exploit conditional**。最低1.3.2-r1，同3.23系列；不称生产RCE。优先官方已修复base重建；当前tag/digest未变，若无该重建，允许仅在构建期安装签名验证的官方精确zlib APK，记录包/来源/两平台哈希。不可生产启动时apk upgrade、全量latest或关闭签名校验。 |
| 其余APK及构建C | 两平台16个安装包/10个origin，官方main/community记录已逐origin和原生apk版本比较；未列记录的5个origin不是clean证明。 | **inventory / remaining audit**。必须核对最终层没有覆盖包清单/库；复制的CA、嵌入SQLite、Node内置C和builder APK分开。不得将base安全数据当全镜像扫描，亦不凭Go/npm门签收这些范围。 |

WAL修复候选标签v1.14.36精确commit `4ea2a9fb44c7ecc6eee436d26a32ab34a79a87ce`，header
source ID `2026-03-13 10:38:09 737ae4a34738ffa0c3ff7f9bb18df914dd1cad163f28fd6b6e114a344fe6d618`。
Go校验下载Sum `h1:EyQAxPedU6e4/lGrYcT2+1yVcOLT7ERS6jvTYKzfzgY=`，最低Go1.19，当前
应用Go1.26.9不变。这里只验证标签/缓存，**没有改go.mod/go.sum**。该driver还涉及Rows.Close/
绑定清理等变更，须测试真实取消/复用/Rows.Close，不能当作只换C常量。GitHub release对象404
不代表标签不存在；标签、绑定header及Go校验和已各自核验。

v1.14.52/SQLite3.53.4仅作为最新维护元数据，不直接采用；3.53系列还涉及浮点文本等语义，
无依据跨到该系列不是本合同选择。若后续适用性或维护者证据要求高于最低候选，先补合同再改。

## 3. OS 取证结果与不能推出的结论

自有只读工具重新按Registry digest/size核验两平台manifest和所有已保存层，读取普通
`usr/lib/os-release`及APK installed DB；后续层仅应用/前端/CA，未覆盖APK DB或系统动态库。
官方secdb main最后修改2026-10-13T20:35:17Z，community为2026-10-09T18:09:41Z；原始JSON/
hash/包origin/所有比较保留，**没有使用字符串或semver词法代替apk版本规则**。

实际两平台安装图相同：当前secdb已列条目中，未达修复版本的是zlib1.3.2-r0→r1；这只是
这两个官方数据文件的比较结果，不是零漏洞/全面可利用性结论。5个未列origin（baselayout、
keys、alpine-base、CA、pax-utils）单列unknown；source-package origin而非安装子包名作为关联键。
初次盘点器读tar符号链接的空内容而失败，未冒称镜像版本错误；改读已核实普通目标，并显式
支持noarch。原失败日志保留，不把工具错误算漏洞red。运行期间的短命对比容器均自有/断网/无卷。

08:13:13Z官方Registry重新核验：当前alpine3.23.6、Go1.26.9-alpine3.23、Node22-alpine3.23
仍为既有三个pin；故“刷新同一个tag”不能自动补齐zlib。后续候选真实APK取证必须再验证。
主要证据：`/private/tmp/openreader-os-c-inventory-final.log`及其报告目录、
`/private/tmp/openreader-os-c-current-official-base-images.json`、
`/private/tmp/openreader-sqlite-host-inventory.json`、`/private/tmp/openreader-sqlite-1.14.36-module-metadata.json`。

## 4. 合同后独立测试，再实施

本合同和matrix/API/data/security先独立提交、推送、精确核验；然后才添加仓库测试。当前没有
新增SQL行为测试、Go模块/Dockerfile/workflow/应用变更，原图仍v1.14.22。

1. 自有worker只接触临时DB/内存DB，严格小表/短值/步数/输出/工作deadline；进入工作握手，
   超时/SIGINT/SIGTERM杀掉并Wait回收。C分配不能只靠Go软内存限制，必要时用容器硬限制。
2. 自有无秘密微型UPSERT/索引与空聚合NULL正确性反例；普通绑定值、Unicode/NULL/空表、
   单UPSERT、多行rollback/索引完整性控制。先重复确认实际old行为；已绿fixture算控制，不凑red。
3. WAL正常多连接/写入/checkpoint/reopen/完整性/并发取消控制，并调查确定性调度/测试VFS。
   不盲跑随机压力等待损坏，不向生产发SQL，不删除WAL/SHM，不靠篡改SQLite核心算法造red；
   调度缝只可test-only且必须证明旧/新都实际进入同一临界序列。不能安全重现则如实保留该项。
4. 若加OS/C发布门：先工具合同测试（命令失败/空/截断/未知schema/过期数据/漏origin/错架构/
   版本比较错误/层覆盖/未签名包/符号精度不足等均失败关闭），再实现；扫描退出0不等于无发现。
   维护者非阻塞gzip异常只允许自有受限worker中设计；不用下载的外部PoC或宿主大分配崩溃。
   APK版本/缺门仅算维护/availability red，不能计为实际gzwrite溢出。
5. 独立test/docs checkpoint推送后，才选择必要模块/精确APK和最小Docker调整；不改Go最低、
   GORM、auth/schema/会话、Reader预算/队列或现有frontend锁。保留原Go/npm精确门。

## 5. 后置签收范围

同一断言/预算的实际反例green；正常SQL/取消/复用/事务/WAL/恢复控制保持。全Go、关键包race/
vet、frontend788/build、两原有审计门、真实HTTP+SQLite/三视口、精确候选native两平台、旧DB/
原挂载目录/新旧卷/portable-v1-v2/备份/跨用户/重启，以及可信Actions双平台+独立OCI/配置/
真实binary/Csource与APK取证逐项终态。不得用SQLite版本常量、base digest或单一库测试支持
整库持久性或生产修复结论，不将“C无Go报告”解释为C安全。

允许差异仅已签收技术栈/多用户安全适配和必要持久性/依赖维护；任何备份格式或WAL/SQL运行
语义变化均须先另签合同。OS/C广度、完整parserCPU/scan/峰值FD/late-tx、设备及全量重构仍开放。
本轮未发布新镜像、未改变生产；上一fc4692c维护交付不重做、不倒填为本项已完成。

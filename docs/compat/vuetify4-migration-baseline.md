# Vuetify 4 重构迁移基线(2026-10-25)

> **状态:已完成(2026-10-25,v1.1.3–v1.1.34)。** P1–P4 逐文件迁移完毕(v-dialog 共享玻璃卡 `.app-dialog-card` 体系、v-data-table(v-model 存 id + 深度 watch 回_EMIT 行对象、click:row 的 item 即原始行)、v-select/v-combobox/v-text-field、@mdi/js SVG 图标集 `defaultSet:'svg'`、ElMessage/ElMessageBox → 自研 useAppFeedback(message/confirm/prompt 含 distinguishCancelAndClose 与多行)。P5 已移除 element-plus 与 @element-plus/icons-vue 依赖、EP 皮肤 CSS 与 --el-* 令牌桥,契约测试重定基。下表为迁移前功能快照与验证方式,仍作为回归清单使用。

## 功能点清单与验证方式

验证方式缩写:CT = 前端契约测试(node --test)、BT = 浏览器逐步断言(Flash/真实浏览器,每步检查布局溢出/残留 overlay/console 错误)、FT = Flash 代码审查。

### App 壳(AppLayout)
| 功能点 | 验证 |
|---|---|
| 底部玻璃标签栏(书架/搜索/我的,药丸形,内容宽度) | CT appMobileNavigation + BT |
| 「我的」整页(iOS 设置风分组+账户区+主题切换) | CT + BT |
| 「我的」静态信息行(后端状态/版本/GitHub) | CT indexSettingsActionSurface + BT |
| 桌面侧栏(品牌+搜索+搜索设置+最近阅读+分组导航) | CT appSidebarShell + BT(桌面视口) |
| 侧栏搜索(关键词+单/多源+并发)与结果跳转 | BT |
| 旧缓存提示条(SW 更新→刷新加载) | CT pwaShellContract |
| 断网提示 | BT |
| 昼夜切换(html.dark 派生全套令牌) | CT designTokensGlassContract + BT |

### 书架(Home)
| 功能点 | 验证 |
|---|---|
| 书卡列表(分组过滤、封面、最近章节、加入书架状态) | CT bookshelfVisibleLayout + BT |
| 分组 chips、编辑模式(删除/编辑)、刷新缓存 | BT |
| 书卡点击→详情 overlay;行点击→继续阅读 | BT |
| 分组管理 overlay(建/排序/保存) | CT overlayBookGroups + BT |
| 书籍管理 overlay(批量删除/分组/换源) | BT |
| 书籍信息 overlay(详情/更新/缓存管理) | BT |
| 导入书籍 overlay(本地 TXT/EPUB/UMD/CBZ) | CT localBookImport* + BT |
| 书仓管理(上传/下载/删除/导入) | BT |
| 存储导入(直传/书仓选择→解析→导入) | CT storageImport* + BT |

### 搜索(Search 工作区)
| 功能点 | 验证 |
|---|---|
| 胶囊搜索条(关键词+宽松/严格+并发选择器+搜索) | CT + BT |
| 分组 chips(全部+top12 组) | CT + BT |
| 最近搜索(记录/点击重搜/清除) | CT + BT |
| 流式多源搜索(首窗快排/逐窗追加/状态条/停止) | CT indexSearchExplore + BT |
| 结果排序(完全>前缀>包含;严格=全字) | CT + BT |
| 结果行(封面/标题/最新章节/加入书架/预览/编辑 JSON) | BT |
| 加载更多(手动胶囊)/失败卡片/失败统计 toast | CT + BT |
| 关键词包含过滤(书名或作者含词) | 后端契约 + BT |
| 换源 overlay(候选列表/搜索更多/切换) | BT |

### 发现(Discover 工作区)
| 功能点 | 验证 |
|---|---|
| 书海选择器(分组/源选择→结果) | CT indexWorkspaceRoute + BT |
| 结果行为同搜索(加入/预览/编辑) | BT |

### 阅读(Reader + 16 个子组件)
| 功能点 | 验证 |
|---|---|
| 正文渲染(文本/漫画/EPUB/音频) | CT readerTextMode/epub/audio + BT |
| 翻页模式(scroll/scroll2/flip)+点击区+手势 | CT readerVolume/continuous + BT |
| 移动 chrome(顶部工具/悬浮按钮/底部进度滑条) | CT readerMobilePrimaryPopover + BT |
| 设置面板(字号/行距/字体/主题9预设/背景图/自定义色) | CT readerSettingsPanel + BT |
| 目录/书签/书架面板、TTS 条、缓存管理 | CT + BT |
| 阅读进度(乐观更新/断点续读/WS 同步) | CT readerProgressPersistence + BT |
| 书内搜索 overlay | CT overlayBookContentSearch + BT |
| 阅读页上下安全区(玻璃带不遮按钮) | CT readerTextModeFrame + BT(真机最终确认) |

### 弹窗体系(全局)
| 功能点 | 验证 |
|---|---|
| 全部弹窗居中弹出+弹入动画 | CT designTokensGlassContract + BT |
| 全屏弹窗上下安全区 padding | CT + BT |
| 弹窗玻璃皮肤(令牌驱动,明暗) | CT + BT |
| 消息条(toast)位置/主题化 | BT |

### 用户/设置
| 功能点 | 验证 |
|---|---|
| 登录/注册(AuthForm+AuthDialog) | BT |
| 注销、会话过期重登 | BT |
| 用户管理(管理员:CRUD/密码重置/批量删除/权限开关) | CT overlayUserManagement + 双角色 BT |
| 权限边界(普通用户无管理入口,API 403) | 后端契约 + 双角色 BT |
| 远程书源(命名条目/复选/批量同步/两步新增/联动清理) | CT remoteSourceServerSync + BT |
| 书源管理(393 源分页/批量删除/恢复默认/失效检测) | CT sourceManager* + BT |
| 失效书源管理 | BT |
| 替换规则 overlay | CT replaceRule* + BT |
| RSS 订阅 overlay | BT |
| 缓存管理(服务端/浏览器多组清理) | BT |

### PWA / 离线
| 功能点 | 验证 |
|---|---|
| 安装元数据(图标/状态栏/双 theme-color) | CT pwaShellContract |
| SW 壳缓存(assets cache-first/导航 network-first/离线页) | CT + 部署后 BT |
| 旧缓存检测→提示条→SKIP_WAITING 刷新 | CT(真机最终确认) |

### 通用约束(全程守护)
- 玻璃令牌单一取值源 tokens.css;blur≤32px;正文滚动区禁 blur;动画只 transform/opacity
- 移动输入 ≥16px;tab 触摸无缩放;逐步断言含布局溢出/残留 overlay/console
- 后端 28 包 + 前端全量 + 三门禁每 Phase 跑一次
- Vuetify 依赖必须过 npm advisory 门禁(check-frontend-advisories,官方 registry)

## 迁移 Phase 划分
- **P0(本次)**:基线文档+Flash 全功能点快照+安装 Vuetify 4(共存)+Login 试点
- **P1**:App 壳(AppLayout 桌面侧栏+我的页+标签栏→Vuetify 组件)
- **P2**:弹窗体系全局皮肤与 Overlay 家族(16 个)
- **P3**:Home/书架/搜索/发现工作区
- **P4**:Reader chrome(16 个子组件,尊重 --reader-* 主题派生)
- **P5**:移除 EP 依赖与全部 el-* 残留;源码契约测试终版重定基;性能验收(包体对比)

每 Phase 交付:功能点复测表(基线→现状)、CT 全绿、Flash 逐步断言 PASS、版本号 bump。

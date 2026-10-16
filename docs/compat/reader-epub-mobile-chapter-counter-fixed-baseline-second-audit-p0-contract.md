# Reader EPUB 移动端章节计数合同裁决（P0）

状态：**contract-only**。本切片只改浏览器合同脚本与文档，Reader 产品代码不改。

固定上游：`changshengyu/reader-dev@fa22f271849d45f93349ae1636223e27b16a4691`。  
当前基线：`OpenReader@5bc38a3`（= `origin/main`；已发布镜像 `186c762` 与 `fc4692c` 之间
`git diff -- frontend scripts/smoke` 为空）。

## 1. 触发与证据

- 2026-10-16 对已发布镜像 `ghcr.io/changshengyu/openreader:186c762`（index
  `sha256:bfda54269b4cf53bab46f1debdd3d9bef640f23c4de5a7f6b248ed081c43f83c`）做本地三视口真实浏览器回归：
  `openreader-smoke`、`reader-mobile-contract`、`reader-cbz-contract`、静态资源树检查全部通过；唯一失败是
  `scripts/smoke/reader-epub-contract.mjs:710` 在 390×844 与 360×800 执行
  `page.waitForFunction(() => document.body.textContent.includes('3 / 3'))` 30 秒超时，1440×900 通过。
- 仓库外诊断副本只把这一步改为记录：移动端运行标题为 `第 3 章 第二章`，工具层可见，页码标签为
  `第 1/2 页`，其后返回书架、封面页、自定义黑色夜间/日间步骤全部通过；桌面为 `第 3 章 第二章` + `3 / 3`。
- 这不是 `186c762` 引入的回归，而是自 2026-09-14 起测试与模板之间一直存在的分歧（见第 4 节）。
- 原始日志、截图和诊断 patch 留在仓库外的本地会话笔记 `browser-regression-186c762/`，不入库。

## 2. 上游证据（fa22f271 `web/src/views/Reader.vue`）

| 位置 | 行为 |
| --- | --- |
| L227–229 `.chapter > .top-bar` | `{{ $store.state.miniInterface ? title : "" }}`：mini 只显示当前章节 `title`，桌面渲染空字符串。 |
| L1684–1712 `epubLocationChangeHandler` | 跨 XHTML 跳转后按 iframe 路径匹配目录行，提交 `readingBook.index`，并把 `title` 设为该行标题。 |
| L113–119、L1857–1859 | mini 且非音频时 `.read-bar .progress` 滑条标签为 `formatProgressTip()`，即章内页码 `第 x/y 页`。 |
| L140–143、L692–700 | 底部 tools 显示 `阅读进度: N%`，`readingProgress = parseInt((chapterIndex + 1) * 100 / catalog.length) + "%"`。 |
| L241–248、L586–594 | `.bottom-bar` 的 `第${currentPage}/${totalPages}页` 只在 `isSlideRead` 时渲染；EPUB 强制 `isSlideRead = false`。 |
| L1–251（整个模板） | 不引用 `catalog` 或 `chapterIndex`；任何视口都没有 `N / M` 章节计数。 |

**裁决：上游移动端不显示 `N / M` 章节计数。** 移动端可见的章节状态是 top-bar 的当前章节标题；
页内进度是 `第 x/y 页`，全书进度是 `阅读进度: N%`。

## 3. 当前 OpenReader

- `frontend/src/views/Reader.vue:146–149`：文本/EPUB 的 `.reader-page-head` 渲染
  `.reader-running-chapter-title`（`第 N 章 章节名`）；`chapterLabel`（`N / total`）只在 `!isMobileReader` 时渲染。
- `frontend/src/views/Reader.vue:1425–1427`：`chapterLabel`、`runningChapterLabel`、`showRunningChapterHeader`。
- `frontend/src/composables/useReaderProgressControls.js:27`：移动滑条标签 `第 X/Y 页`；`bookProgressLabel`
  供移动 `阅读进度: N%`。
- 单元合同已经固定这一模板：`frontend/tests/readerTextModeFrameContract.test.mjs`（`v-if="!isMobileReader"`
  只保留桌面计数、mini 不得 `display:none`）与 `frontend/tests/readerMobileProgressContract.test.mjs`
  （移动进度按钮不含 `chapterLabel`）。
- 来源：`e1631d0`（2026-09-14）按
  [`reader-running-chapter-header-device-feedback-p0-contract.md`](reader-running-chapter-header-device-feedback-p0-contract.md)
  恢复上游 mini 章节栏。该提交同步改写了 `reader-continuous-contract.mjs`，但没有运行或改写 EPUB 合同。

## 4. 冲突成因

`3 / 3` 断言来自 `307db75`（2026-07-18），当时 EPUB 目录对齐为 3 行
`封面 / 第一章（下） / 第二章`。那时 mini 的 `.reader-page-head` 被 CSS `display: none` 隐藏，但
`<span>{{ chapterLabel }}</span>` 仍在 DOM 中；`document.body.textContent` 不受 CSS 影响，所以移动端一直由
**不可见**的计数满足断言。该断言实际验证的是“跨 XHTML 链接后当前目录状态更新为第 3 行”，并不证明
移动端有可见计数。`e1631d0` 把计数改为 `v-if` 后 DOM 中不再有这段文本，移动端从此必然超时。

## 5. 差异分类

| 项目 | 上游 | 当前 | 判定 |
| --- | --- | --- | --- |
| 移动端章节 `N / M` 计数 | 不显示 | 不显示（`e1631d0` 起） | 产品 `aligned`；EPUB 合同移动端等待 `3 / 3` 是过时断言，测试合同 `must-fix` |
| 移动端当前章节标注 | top-bar 显示 `title` | `第 N 章 title` | `acceptable-change`：用户要求的 1-based 序号（运行标题合同第 6 条），不重开 |
| 移动端页内进度 | `第 x/y 页` | `第 X/Y 页` | `aligned`（[`reader-mobile-progress-p0-contract.md`](reader-mobile-progress-p0-contract.md)） |
| 移动端 `阅读进度: N%` | 按章整数百分比 | 含章内比例的平滑百分比 | `acceptable-change`，移动进度合同已裁决，不重开 |
| 桌面运行标注与 `N / total` | top-bar 渲染空字符串 | `第 N 章 title` + `N / total` | `unknown`：运行标题合同第 5 条保留了桌面计数，但未对照上游空 top-bar 分类；本切片不重开，桌面 `3 / 3` 断言保持不变，需另行盘点 |

## 6. 目标合同（浏览器）

`reader-epub-contract.mjs` 在点击 `#next-chapter` 跨 XHTML 跳转、`第二章 EPUB 文档` 出现后：

1. 所有视口：等待 `.reader-running-chapter-title` 文本精确为 `第 3 章 第二章`。序号和目录第 3 行标题
   必须同时成立，保留原断言“目录状态已更新”的意图。
2. 桌面（宽 > 750px）：仍然等待 `document.body.textContent.includes('3 / 3')`，原样保留。
3. 移动（宽 ≤ 750px，mini interface）：
   - 运行标题可见，不能再由不可见的 DOM 文本满足；
   - 工具层可见时页码标签符合上游 `第 x/y 页`（`^第 \d+/\d+ 页$`）；
   - `.reader-page-head` 文本只等于运行标题，且 `document.body.textContent` 不含 `3 / 3`：
     可见或隐藏的章节计数都不允许存在。

不删除、不跳过、不弱化其余任何断言。

## 7. 阶段与测试门

1. **合同**：本文件、gap analysis 与 matrix 独立提交。
2. **红测**：先在合同脚本中加入第 6 节的移动端上游控制（运行标题精确值、可见性、页码格式），保留旧的
   无条件 `3 / 3` 等待。预期结果：桌面通过；移动端新控制通过后，仍在同一 `3 / 3` 等待超时，复现已记录的失败。
3. **实现**：产品代码不需要改，Reader.vue 自 `e1631d0` 起已与上游一致，单元合同也已固定。只把 `3 / 3`
   等待限定为桌面，移动端改为第 6 节的“无章节计数”断言。
4. **回归**：本地 Go 服务加生产构建的前端，EPUB 合同在 1440×900、390×844、360×800 全部通过；
   再跑 frontend `npm test` 与 `npm run build`。另做三项临时变异（不提交），证明移动端断言不是空洞的：
   - mini 也渲染 `chapterLabel`：移动端“无章节计数”断言失败；
   - 运行标题序号滞后一章：所有视口的运行标题等待失败；
   - mini 重新对 `.reader-page-head` 设 `display: none`：移动端可见性断言失败。
5. **记录**：把提交号、各视口结果、变异结果和状态标签写回本文件、gap analysis 与 matrix。

## 8. 不重开

- Reader 产品代码、单元合同、移动进度百分比算法、`第 N 章` 序号差异、桌面 `N / total` 的保留。
- API、数据库、浏览器存储 key、持久文件、镜像与生产：本切片都不改；不在本地构建或推送镜像，不做任何生产操作。

# PWA 应用壳与 iOS 主屏安装契约(2026-10-23)

## 安装体验

- `frontend/index.html`:`viewport-fit=cover`(安全区生效的前提)、`black-translucent` 状态栏(edge-to-edge)、明暗双 `theme-color`(跟随系统)、`apple-touch-icon` 180px PNG。
- `frontend/public/icons/`:192/512 `any` + 512 `maskable` PNG,由 `scripts/generate-pwa-icons.mjs` 纯 Node(zlib PNG 编码器 + SDF 书本图形)生成;**改图标设计改脚本再跑,不要手改 PNG**。
- manifest:`standalone`、竖屏、图标如上;SVG favicon 保留给桌面浏览器标签页。

## Service Worker(`frontend/public/sw.js`)

策略表:

| 请求 | 策略 |
|---|---|
| `/assets/*`(带哈希) | cache-first |
| 其他同源静态(icons/themes/bg/manifest) | stale-while-revalidate |
| 导航请求(HTML) | network-first;失败回退缓存的 `/`,再回退内置离线提示页(503) |
| `/api/`、`/uploads/`、`/ws/`、非 GET、跨域 | 永不缓存,直通 |

- 版本控制:`CACHE_VERSION` 常量;activate 时删除所有旧版本缓存;`skipWaiting` + `clients.claim`。
- 注册:`main.js` 在 `load` 后注册 `/sw.js`;非 secure context(纯 http 内网部署)浏览器不暴露 `navigator.serviceWorker`,注册自动跳过,应用照常运行(仅无壳缓存)。
- **离线阅读(章节正文缓存)是明确的后续迭代**,不在本契约内;SW 的"永不缓存 /api/"规则届时需为章节内容响应开受控白名单。

## 移动壳行为

- 底部悬浮玻璃标签栏:书架 / 搜索 / 发现 / 我的;前三个通过 `/` 路由的 `?workspace=` 查询驱动 Home 工作区,「我的」打开底部 sheet(复用侧栏 navSections + 账户区 + 主题切换)。
- 旧汉堡抽屉、左缘手势、`--mobile-nav-width` 内联样式已移除(`useAppMobileNavigation` 只保留 isMobile 探测)。
- iOS 交互细节:移动端 input ≥16px(防聚焦缩放)、`-webkit-tap-highlight-color: transparent`、`overscroll-behavior-y: none`、standalone 下禁长按选择(输入框除外)。
- 契约测试:`frontend/tests/pwaShellContract.test.mjs`。

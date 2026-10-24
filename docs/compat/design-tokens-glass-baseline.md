# 设计令牌与液态玻璃基线(2026-10-23 重设计)

## 结构

- `frontend/src/styles/tokens.css` 是唯一取值源:亮色在 `:root`,暗色复用 `html.dark-reader`(App 级主题由阅读器主题开关驱动,`App.vue` 同步附加 `html.dark` 以启用 Element Plus 官方暗色变量)。**阅读器正文主题(9 预设/背景图/自定义色)与此完全独立**,仍由 `--reader-*` 变量族表达。
- 组件只消费 `--app-*` / `--glass-*` 名称,不写死值;EP 组件经 `--el-*` 桥接继承应用色板。

## 玻璃材质分级

| 级别 | 用途 | 令牌 | blur 上限 |
|---|---|---|---|
| chrome | 顶栏、标签栏、阅读器工具条 | `--glass-chrome-bg/border` + `--glass-blur-chrome` | 22px |
| panel | 侧栏、对话框、弹层、更新提示条 | `--glass-panel-bg/border` + `--glass-blur-panel` | 30px |
| scrim | 模态遮罩 | `.el-overlay` | 2px |

## 性能护栏(硬约束,见 designTokensGlassContract / readerMobilePrimaryPopoverContract 测试)

1. blur 半径 ≤32px——低配 NAS/树莓派客户端的合成开销约束。
2. `backdrop-filter` 只用于 chrome/panel 小面积与弹层;**滚动正文区域(reader-body)永不做 blur**。
3. 大位移动画只用 `transform`/`opacity`(标签栏、sheet、抽屉均已如此)。
4. 阅读器玻璃颜色必须从 `--reader-popup-bg`/`--reader-popup-text` color-mix 派生,保证任意用户主题下可读;边框用 `color-mix(popup-text 14~16%, transparent)`,不写死色值。
5. 「我的」移动页是整页平铺(`--app-bg` 不透明底),不是弹层;页面入场只用 transform/opacity。

## 圆角刻度

sm 10 / md 14 / lg 20 / xl 26(dialog、sheet、登录卡)/ 胶囊 999。

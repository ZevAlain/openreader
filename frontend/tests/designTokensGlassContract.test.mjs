import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const globalCss = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8')

test('design tokens define paired light and dark values with glass materials', () => {
  for (const token of [
    '--app-bg',
    '--app-surface',
    '--app-primary',
    '--app-radius-lg',
    '--glass-blur-chrome',
    '--glass-blur-panel',
    '--glass-chrome-bg',
    '--glass-panel-bg',
    '--glass-highlight',
  ]) {
    assert.match(tokens, new RegExp(`${token.replace(/-/g, '\\-')}\\s*:`), `light theme must define ${token}`)
  }
  assert.match(tokens, /html\.dark-reader[\s\S]*--glass-panel-bg/, 'dark theme must redefine glass materials')
  assert.match(tokens, /--app-radius-lg:\s*20px/, 'the redesign baseline sets a 20px large radius')
})

test('Element Plus surfaces inherit the app palette through the token bridge', () => {
  assert.match(tokens, /--el-color-primary:\s*var\(--app-primary\)/, 'EP primary follows the app brand')
  assert.match(tokens, /--el-dialog-border-radius:\s*var\(--app-radius-xl\)/, 'dialogs use the extra-large radius')
})

test('the dark EP bridge is complete so components never fall back to EP blue', () => {
  // element-plus/theme-chalk/dark targets html.dark with the same specificity
  // as html.dark-reader; every --el-* value must be re-asserted inside the
  // dark block or the official dark palette (blue) wins the cascade.
  const darkBlock = tokens.match(/html\.dark-reader\s*\{[\s\S]*?\n\}/)[0]
  for (const token of [
    '--el-color-primary',
    '--el-color-primary-dark-2',
    '--el-color-success',
    '--el-color-warning',
    '--el-color-danger',
    '--el-color-info',
    '--el-text-color-primary',
    '--el-text-color-regular',
    '--el-border-color',
    '--el-fill-color',
    '--el-bg-color',
    '--el-bg-color-overlay',
  ]) {
    assert.match(
      darkBlock,
      new RegExp(token.replace(/-/g, '\\-') + '\\s*:\\s*var\\(--(?:app|glass)-'),
      `dark block must bridge ${token} back to the app palette`,
    )
  }
  // The light-3..9 ramp is a hand-picked teal scale; requiring an explicit
  // definition proves every EP dark blue value is overridden.
  for (const level of ['3', '4', '5', '6', '7', '8', '9']) {
    assert.match(
      darkBlock,
      new RegExp(`--el-color-primary-light-${level}\\s*:`),
      `dark block must override EP's blue light-${level} with the teal ramp`,
    )
  }
  // Deep tiers (status ramps, fills, card/shadow) must also leave EP's
  // static dark values behind and derive from the app palette.
  for (const token of [
    '--el-color-success-light-3',
    '--el-color-warning-light-5',
    '--el-color-danger-light-7',
    '--el-color-info-light-9',
    '--el-color-success-dark-2',
    '--el-border-color-dark',
    '--el-border-color-darker',
    '--el-fill-color-dark',
    '--el-fill-color-darker',
    '--el-fill-color-lighter',
    '--el-text-color-disabled',
    '--el-card-bg-color',
    '--el-button-disabled-text-color',
    '--el-empty-fill-color-0',
    '--el-box-shadow',
    '--el-box-shadow-light',
  ]) {
    assert.match(
      darkBlock,
      new RegExp(token.replace(/-/g, '\\-') + '\\s*:\\s*(?:var\\(--(?:app|glass)-|color-mix\\(in srgb, var\\(--app-)'),
      `dark block must derive ${token} from the app palette`,
    )
  }
  assert.match(darkBlock, /--el-color-primary:\s*var\(--app-primary\)/, 'the primary button color must follow the brand, not EP blue')
})

test('the shelf page consumes theme tokens instead of hardcoded surfaces', () => {
  const shelfCss = readFileSync(new URL('../src/styles/home-shelf.css', import.meta.url), 'utf8')
  assert.match(shelfCss, /\.shelf-page\s*\{[\s\S]*?color:\s*var\(--app-text\);[\s\S]*?background:\s*var\(--app-bg\)/, 'the shelf page background/text must follow the theme')
  assert.doesNotMatch(shelfCss, /color:\s*#2c3e50/, 'the legacy EP slate text color must be gone')
  assert.doesNotMatch(shelfCss, /background:\s*#fff/, 'hardcoded white shelf surfaces must be gone')
})

test('scoped components no longer emit collapsed :global dark rules', () => {
  const layout = readFileSync(new URL('../src/layouts/AppLayout.vue', import.meta.url), 'utf8')
  const bookInfo = readFileSync(new URL('../src/components/BookInfoPanel.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(layout, /:global\(html\.dark-reader\)/, 'the sidebar dark skin must live in plain rules that survive the build')
  assert.doesNotMatch(bookInfo, /:global\(html\.dark-reader\)/, 'book-info dark overrides must not rely on :global')
  assert.doesNotMatch(layout, /#1f6feb/, 'the sidebar must not carry GitHub-blue accents')
})

test('the shelf stays tokenized in both themes', () => {
  const shelfCss = readFileSync(new URL('../src/styles/home-shelf.css', import.meta.url), 'utf8')
  assert.doesNotMatch(shelfCss, /html\.dark-reader[^{]*\{[^}]*#[0-9a-fA-F]{3,6}\b/, 'manual dark hex patches must stay retired; tokens drive both themes')
})

test('shell surfaces stay tokenized with no legacy hex leftovers', () => {
  const layout = readFileSync(new URL('../src/layouts/AppLayout.vue', import.meta.url), 'utf8')
  const globalCss2 = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8')
  for (const hex of ['#fffdf8', '#e4d9c8', '#26394a', '#1f6feb', '#24201b', '#a09282', '#f4e4c5', '#fffaf0', '#fde6bd', '#b5b5b5', '#8f8f8f', '#9d9d9d', '#766a5c']) {
    assert.ok(!layout.includes(hex), `AppLayout must not hardcode ${hex}`)
    assert.ok(!globalCss2.includes(hex), `global.css must not hardcode ${hex}`)
  }
  assert.match(layout, /linear-gradient\(180deg, var\(--app-surface\), var\(--app-bg\)\)/, 'the shell gradient must ride the tokens')
  assert.match(layout, /\.profile-avatar[\s\S]*?color:\s*var\(--app-on-primary\)/, 'avatar ink uses the on-primary token')
  assert.match(globalCss2, /--el-button-text-color:\s*var\(--app-on-primary\)/, 'primary-button ink uses the token, not a hex')
})

test('the floating tab bar never covers the last shelf rows', () => {
  const shelfCss = readFileSync(new URL('../src/styles/home-shelf.css', import.meta.url), 'utf8')
  assert.match(
    shelfCss,
    /\.books-wrapper\s*\{[\s\S]*?padding-bottom:\s*calc\(92px \+ env\(safe-area-inset-bottom\)\)/,
    'the shared shelf scroller must reserve room for the floating tab bar',
  )
})

test('dialogs pop from the screen center instead of dropping from the top', () => {
  assert.match(globalCss, /\.el-overlay-dialog\s*\{[\s\S]*?align-items:\s*center/, 'the overlay centers dialogs vertically')
  assert.match(globalCss, /\.el-dialog\s*\{[\s\S]*?margin:\s*0 !important/, 'per-dialog top offsets are neutralized')
  assert.match(globalCss, /app-dialog-pop[\s\S]*?transform:\s*scale/, 'the pop animation is transform-only')
  assert.match(globalCss, /\.el-dialog\.is-fullscreen\s*\{[\s\S]*?max-height:\s*none/, 'mobile fullscreen dialogs keep covering the viewport')
})

test('fullscreen dialogs bound their top and bottom edges', () => {
  assert.match(globalCss, /\.el-dialog\.is-fullscreen\s*\{[\s\S]*?padding-top:\s*calc\(18px \+ env\(safe-area-inset-top\)\)/, 'fullscreen dialogs clear the status-bar band')
  assert.match(globalCss, /\.el-dialog\.is-fullscreen\s*\{[\s\S]*?padding-bottom:\s*calc\(12px \+ env\(safe-area-inset-bottom\)\)/, 'fullscreen dialogs clear the home indicator')
  assert.match(globalCss, /display-mode: standalone\)\s*\{[\s\S]*?\.el-dialog\.is-fullscreen[\s\S]*?30px/, 'standalone shells get the wider headroom')
})

test('glass blur is bounded for low-power clients', () => {
  const blurs = [...tokens.matchAll(/--glass-blur-(?:chrome|panel):\s*(\d+)px/g)].map(match => Number(match[1]))
  assert.ok(blurs.length >= 2, 'chrome and panel blur radii must be tokenized')
  assert.ok(blurs.every(blur => blur <= 32), 'blur radii stay at or below 32px for weak hardware')
})

test('global glass skin applies to dialogs and poppers but not the reading content', () => {
  assert.match(globalCss, /\.el-dialog[\s\S]*?backdrop-filter:\s*blur\(var\(--glass-blur-panel\)\)/, 'dialogs get panel glass')
  assert.match(globalCss, /\.el-overlay[\s\S]*?backdrop-filter:\s*blur\(2px\)/, 'the modal scrim stays a faint blur only')
  assert.doesNotMatch(globalCss, /reader-body[\s\S]*?backdrop-filter/, 'reading content must never be blurred')
})

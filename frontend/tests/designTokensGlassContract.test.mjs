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

test('Element Plus is fully removed from the frontend', () => {
  assert.doesNotMatch(tokens, /--el-/, 'the retired EP token bridge must not linger')
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.doesNotMatch(main, /element-plus/, 'main.js must not register Element Plus')
  assert.match(main, /defaultSet: 'svg'/, 'Vuetify SVG icons stay the default set')
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
  const feedbackHost = readFileSync(new URL('../src/components/AppFeedbackHost.vue', import.meta.url), 'utf8')
  assert.match(feedbackHost, /\.app-confirm-btn\.ok\s*\{[\s\S]*?color:\s*var\(--app-on-primary\)/, 'confirm-button ink uses the token, not a hex')
})

test('the floating tab bar never covers the last shelf rows', () => {
  const shelfCss = readFileSync(new URL('../src/styles/home-shelf.css', import.meta.url), 'utf8')
  assert.match(
    shelfCss,
    /\.books-wrapper\s*\{[\s\S]*?padding-bottom:\s*calc\(92px \+ env\(safe-area-inset-bottom\)\)/,
    'the shared shelf scroller must reserve room for the floating tab bar',
  )
})

test('dialogs ride the shared v-dialog glass card', () => {
  assert.match(globalCss, /\.app-dialog-card\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 48px\)/, 'dialog cards stay inside the viewport')
  assert.match(globalCss, /\.v-dialog--fullscreen \.app-dialog-card\s*\{[\s\S]*?max-height:\s*100dvh/, 'mobile fullscreen dialogs keep covering the viewport')
})

test('fullscreen dialogs bound their top and bottom edges', () => {
  assert.match(globalCss, /\.v-dialog--fullscreen \.app-dialog-head\s*\{[\s\S]*?padding-top:\s*calc\(18px \+ env\(safe-area-inset-top\)\)/, 'fullscreen dialogs clear the status-bar band')
  assert.match(globalCss, /\.v-dialog--fullscreen \.app-dialog-actions\s*\{[\s\S]*?padding-bottom:\s*calc\(18px \+ env\(safe-area-inset-bottom\)\)/, 'fullscreen dialogs clear the home indicator')
})

test('glass blur is bounded for low-power clients', () => {
  const blurs = [...tokens.matchAll(/--glass-blur-(?:chrome|panel):\s*(\d+)px/g)].map(match => Number(match[1]))
  assert.ok(blurs.length >= 2, 'chrome and panel blur radii must be tokenized')
  assert.ok(blurs.every(blur => blur <= 32), 'blur radii stay at or below 32px for weak hardware')
})

test('global glass skin applies to dialogs and menus but not the reading content', () => {
  assert.match(globalCss, /\.app-dialog-card[\s\S]*?backdrop-filter:\s*blur\(var\(--glass-blur-panel\)\)/, 'dialogs get panel glass')
  assert.match(globalCss, /\.v-overlay__scrim\s*\{[\s\S]*?backdrop-filter:\s*blur\(2px\)/, 'the modal scrim stays a faint blur only')
  assert.doesNotMatch(globalCss, /reader-body[\s\S]*?backdrop-filter/, 'reading content must never be blurred')
})

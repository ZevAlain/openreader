import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { useAppMobileNavigation } from '../src/composables/useAppMobileNavigation.js'

function createController(overrides = {}) {
  let viewportWidth = 390
  const controller = useAppMobileNavigation({
    currentViewportWidth: () => viewportWidth,
    getPageMode: () => 'auto',
    shouldUseMiniInterface: (_mode, width) => width <= 750,
    ...overrides,
  })
  return {
    controller,
    setViewportWidth: value => {
      viewportWidth = value
    },
  }
}

test('derives mobile mode and updates the viewport width', () => {
  const fixture = createController()
  assert.equal(fixture.controller.isMobile.value, true)

  fixture.setViewportWidth(1024)
  fixture.controller.updateViewport()
  assert.equal(fixture.controller.isMobile.value, false)
})

test('the retired drawer API stays retired', () => {
  const { controller } = createController()
  assert.equal(controller.visible, undefined, 'no drawer visibility state')
  assert.equal(controller.handleTouchStart, undefined, 'no edge-swipe gestures')
  assert.equal(controller.navigationStyle, undefined, 'no drawer inline styles')
})

test('the mobile shell replaces the drawer with a floating glass tab bar', () => {
  const source = readFileSync(new URL('../src/layouts/AppLayout.vue', import.meta.url), 'utf8')
  assert.match(source, /class="mobile-tabbar"/, 'the shell must render the floating tab bar')
  assert.match(source, /@click="handleMobileTab\(tab\)"/, 'tabs route through one handler')
  assert.doesNotMatch(source, /mobile-nav-open/, 'the retired drawer-open state must be gone')
  assert.doesNotMatch(source, /--mobile-nav-width/, 'no off-canvas sidebar sizing remains')
  assert.match(source, /\.mobile-tabbar\s*\{[\s\S]*?backdrop-filter:\s*blur\(var\(--glass-blur-chrome\)\)/, 'the tab bar uses chrome glass')
  assert.match(source, /\.mobile-tabbar\s*\{[\s\S]*?border-radius:\s*999px/, 'the bar is a floating iOS-style pill')
  assert.match(source, /\.mobile-tabbar\s*\{[\s\S]*?width:\s*fit-content/, 'the pill hugs its content instead of stretching towards screen width')
  const tabBlock = source.match(/\.mobile-tab\s*\{[^}]*\}/)
  assert.ok(tabBlock, 'the mobile tab rule exists')
  assert.doesNotMatch(tabBlock[0], /flex:\s*1\b/, 'tabs keep their natural width')
  assert.match(source, /bottom:\s*calc\(14px \+ env\(safe-area-inset-bottom\)\)/, 'the tab bar respects the home indicator')
  assert.match(source, /\.mobile-tab:active\s*\{[\s\S]*?transform:\s*scale\(0\.92\)/, 'tabs respond to press with a transform spring')
  assert.match(source, /\.mobile-tab\s*\{[\s\S]*?border-radius:\s*999px/, 'each tab is capsule-shaped')
  assert.match(source, /\.mobile-tab\.active\s*\{[\s\S]*?background:\s*var\(--app-primary-soft\)/, 'the active tab carries a tinted capsule background')
})

test('the tab bar keeps exactly shelf, search, and profile', () => {
  const source = readFileSync(new URL('../src/layouts/AppLayout.vue', import.meta.url), 'utf8')
  assert.match(source, /\{ key: 'shelf', label: '书架'/, 'shelf tab exists')
  assert.match(source, /\{ key: 'search', label: '搜索', icon: mdiMagnify, workspace: 'search' \}/, 'search tab drives the Home workspace query')
  assert.match(source, /\{ key: 'profile', label: '我的', icon: mdiAccountOutline, workspace: null \}/, 'profile tab exists')
  assert.doesNotMatch(source, /key: 'explore', label: '发现'/, 'the explore tab is retired from the bar')
  const tabsArray = source.match(/const mobileTabs = \[([\s\S]*?)\]/)
  assert.ok(tabsArray, 'mobileTabs must be a literal array')
  assert.equal((tabsArray[1].match(/\{ key: '/g) || []).length, 3, 'exactly three tabs are declared')
})

test('switching tabs closes the explore popover and the profile page', () => {
  const source = readFileSync(new URL('../src/layouts/AppLayout.vue', import.meta.url), 'utf8')
  assert.match(
    source,
    /function handleMobileTab\(tab\) \{[\s\S]*?if \(exploreChooserVisible\.value\) closeExploreChooser\(\)[\s\S]*?router\.push/,
    'leaving a tab must dismiss the explore chooser before navigating',
  )
  assert.match(source, /if \(profilePageVisible\.value\) profilePageVisible\.value = false/, 'leaving the profile tab must close the profile page')
})

test('the mobile search workspace owns a visible search entry', () => {
  const search = readFileSync(new URL('../src/views/Search.vue', import.meta.url), 'utf8')
  const shelfCss = readFileSync(new URL('../src/styles/home-shelf.css', import.meta.url), 'utf8')
  assert.match(search, /class="search-entry-bar"/, 'the search workspace renders an entry bar')
  assert.match(search, /v-model="keyword"[\s\S]*?@keyup\.enter="doSearch"/, 'enter submits the search')
  assert.match(search, /@click="doSearch"/, 'the go button submits the search')
  assert.match(shelfCss, /\.search-entry-bar\s*\{[\s\S]*?display:\s*none/, 'the bar stays hidden on desktop where the sidebar owns quick-search')
  assert.match(shelfCss, /@media \(max-width:\s*750px\)\s*\{[\s\S]*?\.search-entry-bar\s*\{[\s\S]*?display:\s*flex/, 'the bar appears on the mobile shell')
  assert.match(shelfCss, /\.search-entry-bar \.el-input__inner\s*\{[\s\S]*?font-size:\s*16px/, 'the input keeps iOS from zooming on focus')
})

test('the profile view is a full page, not a bottom sheet', () => {
  const source = readFileSync(new URL('../src/layouts/AppLayout.vue', import.meta.url), 'utf8')
  assert.match(source, /class="profile-page"/, 'the profile view renders as a page')
  assert.match(source, /aria-label="我的"/, 'the page must exist for the profile tab')
  assert.match(source, /v-for="section in navSections"[\s\S]*?profile-group/, 'the page reuses the sidebar nav sections')
  assert.match(source, /\.profile-page\s*\{[\s\S]*?inset:\s*0[\s\S]*?background:\s*var\(--app-bg\)/, 'the page fills the viewport with the app background')
  assert.match(source, /@keyframes profile-page-in[\s\S]*?transform: translateY\(14px\)/, 'the page enters with a transform/opacity motion only')
  assert.doesNotMatch(source, /profile-sheet-backdrop|translate\(-50%, 100%\)/, 'no bottom-sheet machinery remains')
})

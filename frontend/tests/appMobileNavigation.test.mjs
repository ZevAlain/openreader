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
  assert.match(source, /bottom:\s*calc\(14px \+ env\(safe-area-inset-bottom\)\)/, 'the tab bar respects the home indicator')
})

test('the profile sheet aggregates the account surface behind the profile tab', () => {
  const source = readFileSync(new URL('../src/layouts/AppLayout.vue', import.meta.url), 'utf8')
  assert.match(source, /aria-label="我的"/, 'the sheet must exist for the profile tab')
  assert.match(source, /v-for="section in navSections"[\s\S]*?profile-group/, 'the sheet reuses the sidebar nav sections')
  assert.match(source, /workspace: 'search'/, 'the search tab drives the Home workspace query')
  assert.match(source, /workspace: 'explore'/, 'the explore tab drives the Home workspace query')
  assert.match(source, /transform: translate\(-50%, 100%\)/, 'the sheet slides with transform only')
})

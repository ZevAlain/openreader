import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const globalCss = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8')

test('iOS home-screen install surface is complete', () => {
  assert.match(index, /viewport-fit=cover/, 'viewport must enable safe-area insets')
  assert.match(index, /apple-mobile-web-app-status-bar-style.*black-translucent/, 'status bar must blend with edge-to-edge content')
  assert.match(index, /apple-touch-icon[^>]*href="\/icons\/icon-180\.png"/, 'iOS needs a 180px PNG touch icon')
  assert.match(index, /theme-color[^>]*media="\(prefers-color-scheme: light\)"/, 'light theme-color must be declared')
  assert.match(index, /theme-color[^>]*media="\(prefers-color-scheme: dark\)"/, 'dark theme-color must be declared')
})

test('manifest ships PNG icons for any and maskable purposes', () => {
  const purposes = Object.fromEntries(manifest.icons.map(icon => [icon.purpose, icon]))
  assert.ok(purposes.any?.src.endsWith('.png') && purposes.any.sizes === '512x512', 'a 512 PNG any icon is required')
  assert.ok(purposes.maskable?.src.endsWith('.png'), 'a PNG maskable icon is required')
  assert.equal(manifest.display, 'standalone')
})

test('application-shell service worker never caches live data', () => {
  assert.match(sw, /request\.method !== 'GET'/, 'non-GET requests must bypass the cache')
  assert.match(sw, /'\/api\/', '\/uploads\/', '\/ws\/'/, 'API, uploads, and websocket paths must never be cached')
  assert.match(sw, /networkFirstNavigation/, 'navigations must be network-first')
  assert.match(sw, /cacheFirst/, 'hashed assets must be cache-first')
  assert.match(sw, /CACHE_VERSION/, 'activation must evict previous cache versions')
  assert.match(sw, /offlineFallback/, 'offline navigations need a readable fallback page')
})

test('a stale cached shell offers a tap-to-reload update path', () => {
  const updateHook = readFileSync(new URL('../src/composables/useShellUpdate.js', import.meta.url), 'utf8')
  const layout = readFileSync(new URL('../src/layouts/AppLayout.vue', import.meta.url), 'utf8')
  const server = readFileSync(new URL('../../backend/main.go', import.meta.url), 'utf8')
  assert.match(sw, /__OPENREADER_BUILD_ID__/, 'the cache version carries a build-id placeholder')
  assert.match(sw, /SKIP_WAITING/, 'the worker honors the skip-waiting handoff')
  assert.match(updateHook, /navigator\.serviceWorker\.register\('\/sw\.js'\)/, 'the hook registers the shell worker')
  assert.match(updateHook, /registration\.waiting/, 'a waiting worker must surface the update prompt')
  assert.match(updateHook, /postMessage\(\{ type: 'SKIP_WAITING' \}\)/, 'applying the update asks the waiting worker to activate')
  assert.match(layout, /shellUpdateReady/, 'the shell shows the update banner when a new version waits')
  assert.match(layout, /刷新加载/, 'the banner offers an explicit reload action')
  assert.match(server, /__OPENREADER_BUILD_ID__/, 'the Go server stamps sw.js so every deploy changes its bytes')
})

test('iOS interaction details stay guardrailed', () => {
  assert.match(globalCss, /-webkit-tap-highlight-color: transparent/, 'tap highlights stay suppressed')
  assert.match(globalCss, /font-size: max\(16px, 1em\)/, 'mobile inputs stay at or above 16px to prevent focus zoom')
  assert.match(globalCss, /env\(safe-area-inset-top\)/, 'mobile page padding must respect the top inset')
})

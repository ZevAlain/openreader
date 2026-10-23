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

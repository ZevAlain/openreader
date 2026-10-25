import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const feedbackHost = readFileSync(new URL('../src/components/AppFeedbackHost.vue', import.meta.url), 'utf8')
const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

test('toast stack is pinned bottom-right with safe-area padding', () => {
  const stackRule = feedbackHost.match(/\.app-toast-stack\s*\{([^}]*)\}/)
  assert.ok(stackRule, 'the .app-toast-stack rule must exist')
  assert.match(stackRule[1], /position:\s*fixed/, 'toasts float over the app chrome')
  assert.match(stackRule[1], /right:\s*16px/, 'the stack is pinned to the right edge')
  assert.match(stackRule[1], /bottom:\s*calc\(16px \+ env\(safe-area-inset-bottom\)\)/, 'the stack sits at the bottom and clears the home indicator')
})

test('mobile toasts keep the 84px offset above the floating tab bar', () => {
  assert.match(
    feedbackHost,
    /@media \(max-width: 750px\)\s*\{\s*\.app-toast-stack\s*\{[^}]*bottom:\s*calc\(84px \+ env\(safe-area-inset-bottom\)\)/,
    'mobile toasts lift 84px so they never hide behind the glass tab bar',
  )
})

test('tokens.css carries the shared dark navy and violet palette', () => {
  const darkBlock = tokens.match(/html\.dark-reader\s*\{([^}]*)\}/)
  assert.ok(darkBlock, 'the dark token block must exist')
  assert.match(darkBlock[1], /--app-bg:\s*#0b1322;/, 'dark background is the deep navy #0b1322')
  assert.match(darkBlock[1], /--app-surface:\s*#182235;/, 'dark surface is #182235')
  assert.match(darkBlock[1], /--app-primary:\s*#8d51f9;/, 'dark primary is the violet #8d51f9')
})

test('the light palette uses the iOS system grey', () => {
  const rootBlock = tokens.match(/:root\s*\{([^}]*)\}/)
  assert.ok(rootBlock, 'the light token block must exist')
  assert.match(rootBlock[1], /--app-bg:\s*#f2f2f7;/, 'light background is the iOS grey #f2f2f7')
})

test('the Vuetify theme registers the same palette in both modes', () => {
  assert.match(main, /defaultTheme: 'appDark'/, 'the dark app theme is the default')
  assert.match(main, /appDark: \{ dark: true, colors: themeColors \}/, 'the dark theme wires the shared color table')
  assert.match(main, /appLight: \{ dark: false, colors: themeColorsLight \}/, 'the light theme wires its color table')
  assert.match(main, /primary: '#8d51f9'/, 'Vuetify primary matches --app-primary')
  assert.match(main, /background: '#0b1322'/, 'Vuetify dark background matches --app-bg')
  assert.match(main, /surface: '#182235'/, 'Vuetify surface matches --app-surface')
  assert.match(main, /background: '#f2f2f7'/, 'Vuetify light background matches the iOS grey --app-bg')
})

test('Vuetify component defaults keep surfaces flat and ripple off', () => {
  assert.match(main, /VBtn: \{ elevation: 0, ripple: false \}/, 'buttons default to flat with no ripple')
  const rippleCount = (main.match(/ripple: false/g) || []).length
  assert.ok(rippleCount >= 4, `VBtn, VChip, VTab and VListItem must all opt out of ripple (found ${rippleCount})`)
})

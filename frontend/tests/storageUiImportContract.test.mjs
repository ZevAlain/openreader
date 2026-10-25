import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const localStoreOverlay = readFileSync(new URL('../src/components/overlays/OverlayLocalStore.vue', import.meta.url), 'utf8')
const localStore = readFileSync(new URL('../src/components/workspace/LocalStoreManager.vue', import.meta.url), 'utf8')
const directImport = readFileSync(new URL('../src/components/overlays/OverlayBookImport.vue', import.meta.url), 'utf8')

test('uses the upstream storage-manager dialog labels without a competing embedded title', () => {
  assert.match(localStoreOverlay, /app-dialog-title">\s*书仓文件管理\s*</, 'LocalStore root dialog must retain the upstream title')
  assert.doesNotMatch(localStore, /embedded-store-title/, 'LocalStore body must not duplicate the root dialog title')
})

test('keeps the direct-import chooser on the fixed upstream format set', () => {
  assert.match(directImport, /accept="\.txt,\.epub,\.umd,\.cbz"/i, 'direct import must expose only TXT / EPUB / UMD / CBZ')
  assert.doesNotMatch(directImport, /accept="[^"]*\.(?:pdf|md|text)[^"]*"/i, 'direct import must not advertise legacy-only PDF/Markdown/.text formats')
  assert.doesNotMatch(localStore, /accept=/, 'upstream LocalStore upload must manage arbitrary files instead of filtering chooser extensions')
})

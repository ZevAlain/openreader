import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const overlay = readFileSync(new URL('../src/components/workspace/SourceTransferOverlay.vue', import.meta.url), 'utf8')

test('remote source URL list persists through the per-user server setting', () => {
  assert.match(overlay, /api\.get\('\/settings\/remoteSourceUrls'\)/, 'opening the manager must load the server-side URL list')
  assert.match(overlay, /api\.put\('\/settings\/remoteSourceUrls', \{ value: urls, force: true \}\)/, 'every list mutation must save the whole list server-side')
  assert.doesNotMatch(overlay, /localStorage\.setItem/, 'the list must no longer persist to browser storage')
})

test('legacy browser storage is migrated once and then removed', () => {
  assert.match(overlay, /migrateLegacyRemoteEntries/, 'loading must attempt the one-time migration when the server list is empty')
  assert.match(overlay, /safeLocalStorageRemove\(`\$\{scope\}@remoteSourceUrls`\)/, 'the migrated list key must be cleared after upload')
  assert.match(overlay, /safeLocalStorageRemove\(`\$\{scope\}@lastRemoteSourceUrl`\)/, 'the retired prompt-flow key must be cleared after upload')
})

test('server failures roll back optimistic list edits', () => {
  assert.match(overlay, /rememberRemoteEntry[\s\S]*?remoteEntries\.value = remoteEntries\.value\.filter\(item => item !== url\)/, 'a failed save must drop the optimistically added URL')
  assert.match(overlay, /removeRemoteEntry[\s\S]*?await saveRemoteEntries\(next\)[\s\S]*?remoteEntries\.value = next/, 'removal must only apply after the server accepts it')
})

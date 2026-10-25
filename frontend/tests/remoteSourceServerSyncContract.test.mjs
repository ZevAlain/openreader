import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const overlay = readFileSync(new URL('../src/components/workspace/SourceTransferOverlay.vue', import.meta.url), 'utf8')

test('remote source list persists through the per-user server setting', () => {
  assert.match(overlay, /api\.get\('\/settings\/remoteSourceUrls'\)/, 'opening the manager must load the server-side list')
  assert.match(overlay, /await saveRemoteEntries\(entries\)/, 'list mutations save the named entries server-side')
  assert.match(overlay, /\{ name: remoteEntryName\(item\.trim\(\)\), url: item\.trim\(\) \}/, 'legacy plain-URL values migrate to named entries')
  assert.match(overlay, /v-model="selectedRemoteUrls"[\s\S]*?type="checkbox"/, 'entries carry multi-select checkboxes')
  assert.match(overlay, /同步选中[\s\S]*?syncSelectedRemote/, 'a batch action syncs every selected entry')
  assert.doesNotMatch(overlay, /localStorage\.setItem/, 'the list must no longer persist to browser storage')
})

test('legacy browser storage is migrated once and then removed', () => {
  assert.match(overlay, /migrateLegacyRemoteEntries/, 'loading must attempt the one-time migration when the server list is empty')
  assert.match(overlay, /safeLocalStorageRemove\(`\$\{scope\}@remoteSourceUrls`\)/, 'the migrated list key must be cleared after upload')
  assert.match(overlay, /safeLocalStorageRemove\(`\$\{scope\}@lastRemoteSourceUrl`\)/, 'the retired prompt-flow key must be cleared after upload')
})

test('deleting a remote entry offers to clean up its imported sources', () => {
  const overlay = readFileSync(new URL('../src/components/workspace/SourceTransferOverlay.vue', import.meta.url), 'utf8')
  assert.match(overlay, /\/sources\/origin-count/, 'deletion first counts sources imported from that link')
  assert.match(overlay, /删除并清理书源/, 'the confirm offers linked cleanup')
  assert.match(overlay, /仅删除链接/, 'keeping the imported sources is an explicit choice')
  assert.match(overlay, /distinguishCancelAndClose/, 'closing without choosing aborts the deletion')
  assert.match(overlay, /\/sources\/origin[^-]/, 'linked cleanup calls the origin delete endpoint')
})

test('server failures keep the authoritative list', () => {
  assert.match(overlay, /function persistRemoteEntries[\s\S]*?message\.error\(readError\(error, '保存远程书源列表失败'\)\)/, 'a failed save reports instead of silently diverging')
  assert.match(overlay, /removeRemoteEntry[\s\S]*?await saveRemoteEntries\(next\)[\s\S]*?remoteEntries\.value = next/, 'removal must only apply after the server accepts it')
})

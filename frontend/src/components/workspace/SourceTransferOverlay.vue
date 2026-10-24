<template>
  <input
    ref="sourceUploadRef"
    class="source-upload-input"
    type="file"
    accept=".json,application/json"
    @change="handleSourceFile"
    @cancel="requestClose"
  />

  <el-dialog
    :model-value="visible && intent === 'remote'"
    title="远程书源管理"
    width="min(1000px, max(750px, 70vw))"
    top="15vh"
    :fullscreen="isMobile"
    class="source-remote-manage-dialog"
    @update:model-value="value => !value && requestClose()"
  >
    <section
      v-loading="remoteLoading"
      element-loading-text="正在读取远程书源文件…"
      class="source-remote-list"
    >
      <p v-if="!remoteEntries.length && !remoteLoading" class="source-remote-tip">
        暂无远程书源，点击“新增”填写名称和链接。
      </p>
      <label v-for="entry in remoteEntries" :key="entry.url" class="source-remote-item">
        <input
          v-model="selectedRemoteUrls"
          type="checkbox"
          class="source-remote-check"
          :value="entry.url"
          :disabled="remoteLoading || batchSyncing"
        >
        <el-link type="primary" :href="entry.url" target="_blank" class="source-remote-url">
          {{ entry.name }}
        </el-link>
        <span class="source-remote-actions">
          <el-button link type="primary" :disabled="remoteLoading || batchSyncing" @click="syncRemoteEntry(entry.url)">
            同步
          </el-button>
          <el-button link type="danger" :disabled="remoteLoading || batchSyncing" @click="removeRemoteEntry(entry.url)">
            删除
          </el-button>
        </span>
      </label>
    </section>
    <template #footer>
      <div class="source-import-footer">
        <span class="check-tip">已选 {{ selectedRemoteUrls.length }}/{{ remoteEntries.length }}</span>
        <el-button :disabled="remoteLoading || batchSyncing || !selectedRemoteUrls.length" @click="syncSelectedRemote">
          {{ batchSyncing ? `同步中 ${batchSyncProgress.done}/${batchSyncProgress.total}` : '同步选中' }}
        </el-button>
        <el-button type="primary" :loading="remoteLoading" @click="addRemoteEntry">
          新增
        </el-button>
        <el-button :disabled="remoteLoading || batchSyncing" @click="requestClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>

  <el-dialog
    v-model="showImportPreview"
    title="导入书源"
    width="min(1000px, max(750px, 70vw))"
    top="15vh"
    :fullscreen="isMobile"
    append-to-body
    class="source-import-preview-dialog"
    @closed="handlePreviewClosed"
  >
    <el-checkbox-group
      v-model="checkedImportSourceIndexes"
      class="source-import-list"
      @change="handleImportSelectionChange"
    >
      <el-checkbox
        v-for="(source, index) in importPreviewSources"
        :key="index"
        :label="index"
        class="source-import-item"
      >
        <strong>{{ importSourceName(source) || '未命名书源' }}</strong>
        <span>{{ importSourceURL(source) || '未设置地址' }}</span>
        <em v-if="importSourceTags(source)">{{ importSourceTags(source) }}</em>
        <small
          v-if="importSourceCompatibilityHint(source)"
          class="source-compatibility-hint"
        >
          {{ importSourceCompatibilityHint(source) }}
        </small>
      </el-checkbox>
    </el-checkbox-group>

    <template #footer>
      <div class="source-import-footer">
        <el-checkbox
          v-model="importCheckAll"
          :indeterminate="importCheckIndeterminate"
          border
          @change="toggleImportCheckAll"
        >
          全选
        </el-checkbox>
        <span class="check-tip">已选择 {{ checkedImportSourceIndexes.length }} 个</span>
        <el-button @click="cancelImportPreview">取消</el-button>
        <el-button type="primary" :loading="importPreviewSaving" @click="confirmImport">
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  exportSources,
  importRemoteSource,
  importSources,
  previewRemoteSource,
} from '../../api/sources'
import api from '../../api/client'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useSourceTransfer } from '../../composables/useSourceTransfer'
import { useUserStore } from '../../stores/user'

const props = defineProps({
  visible: { type: Boolean, default: false },
  intent: { type: String, default: 'import' },
  isMobile: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])
const operations = useAuthenticatedOperationGuard()
const user = useUserStore()
const ownerClosing = ref(false)
const remoteEntries = ref([])
const selectedRemoteUrls = ref([])
const batchSyncing = ref(false)
const batchSyncProgress = ref({ done: 0, total: 0 })
const pendingRemoteURL = ref('')
let activation = 0

const {
  remoteURL,
  remoteLoading,
  sourceUploadRef,
  showImportPreview,
  importPreviewSources,
  checkedImportSourceIndexes,
  importCheckAll,
  importCheckIndeterminate,
  importPreviewSaving,
  importFile,
  openSourceImportPicker,
  importRemote,
  closeImportPreview,
  toggleImportCheckAll,
  handleImportSelectionChange,
  importSourceName,
  importSourceURL,
  importSourceTags,
  importSourceCompatibilityHint,
  saveSelectedImportSources,
} = useSourceTransfer({
  operationGuard: operations,
  previewRemoteSource,
  importSources,
  exportSources,
  reloadSources: async () => {},
  getSelection: () => [],
  download: () => {},
  onInfo: message => ElMessage.info(message),
  onWarning: message => ElMessage.warning(message),
  onSuccess: message => ElMessage.success(message),
  onError: (error, fallback) => {
    const detail = readError(error, '')
    ElMessage.error(detail ? `${fallback} ${detail}` : fallback)
  },
})

watch(
  () => [props.visible, props.intent],
  async ([visible, intent]) => {
    activation += 1
    const current = activation
    ownerClosing.value = false
    if (!visible) {
      closeImportPreview()
      pendingRemoteURL.value = ''
      return
    }
    if (intent === 'import') {
      await nextTick()
      if (current !== activation || !props.visible) return
      if (sourceUploadRef.value) sourceUploadRef.value.value = ''
      openSourceImportPicker()
      return
    }
    if (intent === 'remote') {
      await loadRemoteEntries()
      return
    }
    requestClose()
  },
  { immediate: true },
)

async function handleSourceFile(event) {
  const file = event.target?.files?.[0]
  if (!file) {
    requestClose()
    return
  }
  await importFile({ raw: file })
  event.target.value = ''
  if (!showImportPreview.value) requestClose()
}

function userStorageScope() {
  return user.profile?.username || user.profile?.id || 'user'
}

// The remote source list lives in the per-user server settings so every
// device converges. Entries carry a user-chosen name plus the URL; older
// plain-URL values (strings) migrate to {name: hostname, url} once.
async function loadRemoteEntries() {
  try {
    const { data } = await api.get('/settings/remoteSourceUrls')
    let entries = normalizeRemoteEntries(data?.value)
    if (!entries.length) entries = await migrateLegacyRemoteEntries()
    remoteEntries.value = entries
    selectedRemoteUrls.value = []
  } catch {
    remoteEntries.value = []
    selectedRemoteUrls.value = []
  }
}

function normalizeRemoteEntries(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const entries = []
  for (const item of value) {
    let entry = null
    if (typeof item === 'string' && item.trim()) {
      entry = { name: remoteEntryName(item.trim()), url: item.trim() }
    } else if (item && typeof item === 'object' && String(item.url || '').trim()) {
      const url = String(item.url).trim()
      entry = { name: String(item.name || '').trim() || remoteEntryName(url), url }
    }
    if (!entry || seen.has(entry.url)) continue
    seen.add(entry.url)
    entries.push(entry)
  }
  return entries
}

function remoteEntryName(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

async function migrateLegacyRemoteEntries() {
  const scope = userStorageScope()
  const local = parseRemoteURLs(safeLocalStorageGet(`${scope}@remoteSourceUrls`))
  const legacyPrompt = safeLocalStorageGet(`${scope}@lastRemoteSourceUrl`).trim()
  if (legacyPrompt && !local.includes(legacyPrompt)) local.push(legacyPrompt)
  if (!local.length) return []
  const entries = normalizeRemoteEntries(local)
  try {
    await saveRemoteEntries(entries)
    safeLocalStorageRemove(`${scope}@remoteSourceUrls`)
    safeLocalStorageRemove(`${scope}@lastRemoteSourceUrl`)
  } catch {
    // Keep the local copy when the server is unreachable; retry on next open.
  }
  return entries
}

function parseRemoteURLs(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.map(item => String(item || '').trim()).filter(Boolean))]
    }
  } catch {
    // A corrupted cache must not break the management list.
  }
  return []
}

async function saveRemoteEntries(entries) {
  await api.put('/settings/remoteSourceUrls', { value: entries, force: true })
}

async function persistRemoteEntries() {
  const snapshot = [...remoteEntries.value]
  try {
    await saveRemoteEntries(snapshot)
  } catch (error) {
    remoteEntries.value = snapshot.length ? remoteEntries.value : snapshot
    ElMessage.error(readError(error, '保存远程书源列表失败'))
    return false
  }
  selectedRemoteUrls.value = selectedRemoteUrls.value.filter(url =>
    remoteEntries.value.some(entry => entry.url === url))
  return true
}

async function rememberRemoteEntry(url) {
  if (!url || remoteEntries.value.some(entry => entry.url === url)) return
  remoteEntries.value = [{ name: remoteEntryName(url), url }, ...remoteEntries.value]
  await persistRemoteEntries()
}

async function addRemoteEntry() {
  let nameResult
  let urlResult
  try {
    nameResult = await ElMessageBox.prompt('为这个书源起个名字', '新增远程书源 · 名称', {
      confirmButtonText: '下一步',
      cancelButtonText: '取消',
      inputValuePlaceholder: '例如：我的书源合集',
    })
    urlResult = await ElMessageBox.prompt('输入远程书源链接（JSON 地址）', '新增远程书源 · 链接', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  const name = String(nameResult?.value || '').trim()
  const url = String(urlResult?.value || '').trim()
  if (!url || !props.visible) return
  if (remoteEntries.value.some(entry => entry.url === url)) {
    ElMessage.warning('该链接已存在')
    return
  }
  remoteEntries.value = [{ name: name || remoteEntryName(url), url }, ...remoteEntries.value]
  const saved = await persistRemoteEntries()
  if (saved) await startRemoteImport(url)
}

async function syncSelectedRemote() {
  const targets = remoteEntries.value.filter(entry => selectedRemoteUrls.value.includes(entry.url))
  if (!targets.length || batchSyncing.value) return
  batchSyncing.value = true
  batchSyncProgress.value = { done: 0, total: targets.length }
  let succeeded = 0
  for (const entry of targets) {
    try {
      await importRemoteSource(entry.url)
      succeeded += 1
    } catch {
      // The per-entry summary below reports failures; keep syncing the rest.
    }
    batchSyncProgress.value.done += 1
  }
  batchSyncing.value = false
  const failed = targets.length - succeeded
  if (failed) ElMessage.warning(`同步完成：${succeeded} 成功，${failed} 失败`)
  else ElMessage.success(`同步完成：${succeeded} 个远程书源已更新`)
}

async function syncRemoteEntry(url) {
  await startRemoteImport(url)
}

async function startRemoteImport(url) {
  if (!url || !props.visible || remoteLoading.value) return
  remoteURL.value = url
  pendingRemoteURL.value = url
  await importRemote()
  if (!showImportPreview.value) pendingRemoteURL.value = ''
}

async function removeRemoteEntry(url) {
  let importedCount = 0
  try {
    const { data } = await api.get('/sources/origin-count', { params: { url } })
    importedCount = Number(data?.count || 0)
  } catch {
    importedCount = 0
  }
  let cleanup = false
  if (importedCount > 0) {
    try {
      await ElMessageBox.confirm(
        `该链接曾导入 ${importedCount} 个书源。是否连同这些书源一起删除？`,
        '移除远程书源',
        {
          confirmButtonText: '删除并清理书源',
          cancelButtonText: '仅删除链接',
          distinguishCancelAndClose: true,
          type: 'warning',
        },
      )
      cleanup = true
    } catch (action) {
      // 'close' (X) means abort; 'cancel' means keep the imported sources.
      if (action === 'close') return
    }
  } else {
    try {
      await ElMessageBox.confirm(
        '确认要移除该远程书源链接吗？没有从该链接导入的书源。',
        '移除远程书源',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
      )
    } catch {
      return
    }
  }
  if (cleanup) {
    try {
      const { data } = await api.delete('/sources/origin', { params: { url } })
      const deleted = Number(data?.deleted || 0)
      const skipped = Number(data?.skippedInUse || 0)
      if (skipped) ElMessage.warning(`已清理 ${deleted} 个书源，${skipped} 个因在用保留`)
      else ElMessage.success(`已清理 ${deleted} 个书源`)
    } catch (error) {
      ElMessage.error(readError(error, '清理书源失败，链接未删除'))
      return
    }
  }
  const next = remoteEntries.value.filter(item => item.url !== url)
  try {
    await saveRemoteEntries(next)
    remoteEntries.value = next
    selectedRemoteUrls.value = selectedRemoteUrls.value.filter(item => item !== url)
  } catch (error) {
    ElMessage.error(readError(error, '保存远程书源列表失败'))
  }
}

async function confirmImport() {
  await saveSelectedImportSources()
  if (showImportPreview.value) return
  if (pendingRemoteURL.value) {
    rememberRemoteEntry(pendingRemoteURL.value)
    pendingRemoteURL.value = ''
  }
  if (props.intent !== 'remote') requestClose()
}

function cancelImportPreview() {
  if (props.intent === 'remote') {
    closeImportPreview()
    return
  }
  closePreviewAndOwner()
}

function closePreviewAndOwner() {
  ownerClosing.value = true
  closeImportPreview()
  requestClose()
}

function handlePreviewClosed() {
  pendingRemoteURL.value = ''
  if (props.intent === 'remote') return
  if (ownerClosing.value || !showImportPreview.value) requestClose()
}

function requestClose() {
  emit('close')
}

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function safeLocalStorageRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // A blocked storage backend must not block the import flow.
  }
}

function readError(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.error || fallback
}
</script>

<style scoped>
.source-upload-input {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  opacity: 0;
  pointer-events: none;
}

.source-import-list {
  display: grid;
  max-height: min(62dvh, 560px);
  min-width: 0;
  overflow: auto;
  gap: 8px;
}

.source-import-item {
  display: block;
  min-width: 0;
  margin-right: 0;
  padding: 9px 10px;
  border-bottom: 1px solid var(--app-border);
}

.source-import-item :deep(.el-checkbox__label) {
  display: grid;
  min-width: 0;
  gap: 2px;
  line-height: 1.5;
  white-space: normal;
}

.source-import-item span,
.source-import-item em,
.source-import-item small {
  overflow-wrap: anywhere;
  color: var(--app-text-muted);
  font-size: 12px;
  font-style: normal;
}

.source-compatibility-hint {
  color: #b26a00;
}

.source-remote-list {
  display: grid;
  min-height: 96px;
  min-width: 0;
  max-height: min(62dvh, 560px);
  overflow: auto;
  align-content: start;
  gap: 4px;
}

.source-remote-tip {
  margin: 0;
  padding: 24px 0;
  color: var(--app-text-muted);
  text-align: center;
}

.source-remote-check {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--app-primary);
}

.source-remote-item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 2px;
  border-bottom: 1px solid var(--app-border);
}

.source-remote-url {
  min-width: 0;
  flex: 1;
}

.source-remote-url :deep(.el-link__inner) {
  overflow-wrap: anywhere;
}

.source-remote-actions {
  flex: 0 0 auto;
  white-space: nowrap;
}

.source-remote-actions :deep(.el-button + .el-button) {
  margin-left: 8px;
}

.source-import-footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.source-import-footer .check-tip {
  color: var(--app-text-muted);
  white-space: nowrap;
}

@media (max-width: 750px) {
  .source-import-list {
    max-height: calc(100dvh - 150px);
  }

  .source-import-footer {
    flex-wrap: wrap;
  }
}
</style>

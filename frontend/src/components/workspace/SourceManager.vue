<template>
  <v-dialog
    v-if="isNormalPage"
    :model-value="visible"
    width="min(1000px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="global-source-manage-dialog"
    @update:model-value="handleDialogModel"
    @after-leave="handleClosed"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <div class="source-dialog-title">
          <h2 class="app-dialog-title">{{ isFailureMode ? '失效书源管理' : '书源管理' }}</h2>
          <div v-if="!isFailureMode" class="source-title-actions">
            <v-btn variant="text" color="primary" size="small" @click="openEditor()">新增</v-btn>
            <v-btn variant="text" color="primary" size="small" @click="exportAllSources">导出</v-btn>
            <v-btn variant="text" color="primary" size="small" :loading="restoring" @click="restoreDefaults">恢复默认</v-btn>
            <v-btn variant="text" color="error" size="small" :loading="clearing" @click="clearAllSources">清空</v-btn>
          </div>
        </div>
      </header>

      <div class="app-dialog-body">
        <section class="source-manager-body">
          <div v-if="isFailureMode" class="source-check-form">
            <span class="source-check-label">搜索词：</span>
            <v-text-field v-model="checkConfig.keyword" density="compact" variant="outlined" hide-details class="source-check-input" />
            <span class="source-check-label source-timeout-label">超时(ms)：</span>
            <v-text-field
              v-model.number="checkConfig.timeout"
              type="number"
              :min="1000"
              :max="15000"
              :step="500"
              density="compact"
              variant="outlined"
              hide-details
              class="source-check-number"
            />
            <span class="source-check-label">并发数：</span>
            <v-text-field
              v-model.number="checkConfig.concurrent"
              type="number"
              :min="3"
              :max="15"
              :step="1"
              density="compact"
              variant="outlined"
              hide-details
              class="source-check-number"
            />
          </div>

          <div class="source-group-wrapper">
            <button
              v-for="group in sourceShowGroups"
              :key="group"
              type="button"
              class="source-group-btn"
              :class="{ selected: selectedGroup === group }"
              @click="setSourceGroup(group)"
            >
              {{ group }}
            </button>
          </div>

          <v-data-table
            v-model:page="sourcePage"
            v-model:items-per-page="sourcePageSize"
            :headers="tableHeaders"
            :items="filteredSources"
            item-value="id"
            density="compact"
            :items-per-page-options="sourcePageSizeOptions"
            :items-per-page-text="'每页'"
            no-data-text="暂无数据"
            :loading="listLoading"
            class="source-table"
            :height="tableHeight"
          >
            <template #header.data-table-select>
              <v-checkbox-btn
                :model-value="allSelectableSelected"
                :indeterminate="someSelectableSelected && !allSelectableSelected"
                @update:model-value="checked => toggleAllSelectable(checked)"
              />
            </template>
            <template #item.data-table-select="{ item }">
              <v-checkbox-btn
                v-if="isSourceSelectable(item)"
                :model-value="selectedSourceIds.includes(item.id)"
                @update:model-value="checked => toggleSourceSelection(item, checked)"
              />
            </template>
            <template #item.baseUrl="{ item }">
              <a :href="item.baseUrl" target="_blank" rel="noopener noreferrer" class="source-base-url">
                {{ item.baseUrl }}
              </a>
            </template>
            <template #item.usedBookNames="{ item }">
              <pre class="source-used-books">{{ (item.usedBookNames || []).join('\n') }}</pre>
            </template>
            <template #item.actions="{ item }">
              <v-btn variant="text" color="primary" size="small" @click="openEditor(item)">编辑</v-btn>
            </template>
          </v-data-table>
        </section>
      </div>

      <footer class="app-dialog-actions">
        <div class="source-dialog-footer">
          <span class="check-tip">已选择 {{ selection.length }} 个</span>
          <v-btn color="error" variant="outlined" :loading="deleting" @click="deleteSelectedSources">
            批量删除
          </v-btn>
          <v-btn
            v-if="isFailureMode"
            variant="outlined"
            :disabled="checking"
            @click="checkInvalidSources"
          >
            {{ checking ? '正在' : '' }}检测书源 {{ checkProgress }}
          </v-btn>
          <v-btn variant="text" @click="requestClose">取消</v-btn>
        </div>
      </footer>
    </div>
  </v-dialog>

  <v-dialog
    v-model="showEditor"
    width="min(1000px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="source-json-editor-dialog"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">编辑书源</h2>
      </header>
      <div class="app-dialog-body">
        <v-alert
          v-if="editorCompatibilityMessage"
          class="source-json-compatibility-warning"
          type="warning"
          variant="tonal"
          density="compact"
          title="此书源包含当前服务不会执行或仅保留的配置"
        >
          {{ editorCompatibilityMessage }}
        </v-alert>
        <v-textarea
          v-model="sourceJSON"
          class="source-json-editor"
          :rows="isMobile ? 24 : 22"
          variant="outlined"
          hide-details
          spellcheck="false"
        />
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="showEditor = false">取 消</v-btn>
        <v-btn color="primary" :loading="saving" @click="saveSourceJSON">保 存</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { confirm, message } from '../../composables/useAppFeedback.js'
import {
  batchSources,
  batchTestSources,
  clearSources,
  createSource,
  exportSources,
  getSource,
  listInvalidSources,
  listSources,
  restoreDefaultSources,
  updateSource,
} from '../../api/sources'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useReaderStore } from '../../stores/reader'
import {
  analyzeSourceCompatibility,
  sourceCompatibilityMessage,
} from '../../utils/bookSourceCompatibility'
import {
  buildBookSourcePayload,
  buildReaderDevBookSource,
  sourceToEditorSnapshot,
} from '../../utils/bookSourceEditor'

const props = defineProps({
  visible: { type: Boolean, default: false },
  failureMode: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const reader = useReaderStore()
const operations = useAuthenticatedOperationGuard()
const sources = ref([])
const failureSources = ref([])
const listLoading = ref(false)
const selectedSourceIds = ref([])
const selectedGroup = ref('')
const sourcePage = ref(1)
const sourcePageSize = ref(25)
const sourcePageSizes = [25, 50, 100, 200, 300, 400]
const checkConfig = reactive({
  keyword: '斗罗大陆',
  timeout: 5000,
  concurrent: 5,
})
const checking = ref(false)
const checkProgress = ref('')
const deleting = ref(false)
const clearing = ref(false)
const restoring = ref(false)
const showEditor = ref(false)
const editingSourceId = ref(null)
const sourceJSON = ref('')
const saving = ref(false)
let sourceReloadTimer

const isNormalPage = computed(() => reader.pageType === 'normal')
const isFailureMode = computed(() => props.failureMode)
const sourceList = computed(() => (
  isFailureMode.value ? failureSources.value : sources.value
))
const sourceShowGroups = computed(() => {
  if (isFailureMode.value) return [...failureGroupOrder]
  const groups = []
  const seen = new Set()
  for (const source of sourceList.value) {
    const group = String(source?.group || '').trim()
    if (!group || seen.has(group)) continue
    seen.add(group)
    groups.push(group)
  }
  groups.push('未分组')
  return groups
})
const filteredSources = computed(() => {
  if (!selectedGroup.value) return sourceList.value
  if (isFailureMode.value) {
    return sourceList.value.filter(source => (
      String(source.errorMessage || '').includes(selectedGroup.value)
    ))
  }
  if (selectedGroup.value === '未分组') {
    return sourceList.value.filter(source => !String(source.group || '').trim())
  }
  return sourceList.value.filter(source => source.group === selectedGroup.value)
})
const selectableSources = computed(() => filteredSources.value.filter(isSourceSelectable))
const selection = computed(() => (
  filteredSources.value.filter(source => selectedSourceIds.value.includes(source.id))
))
const allSelectableSelected = computed(() => (
  selectableSources.value.length > 0 &&
  selectableSources.value.every(source => selectedSourceIds.value.includes(source.id))
))
const someSelectableSelected = computed(() => (
  selectableSources.value.some(source => selectedSourceIds.value.includes(source.id))
))
const sourcePageSizeOptions = computed(() => sourcePageSizes.map(size => ({ title: String(size), value: size })))
const tableHeight = computed(() => {
  if (props.isMobile) {
    return `calc(100dvh - ${isFailureMode.value ? 300 : 268}px)`
  }
  return `calc(min(70dvh - 184px, 400px) - ${isFailureMode.value ? 116 : 84}px)`
})
const tableHeaders = computed(() => {
  const headers = [
    { key: 'data-table-select', fixed: props.isMobile ? 'start' : false, width: 44 },
    { title: '书源名称', key: 'name', fixed: props.isMobile ? 'start' : false, minWidth: 120 },
    { title: '书源链接', key: 'baseUrl', minWidth: 120 },
  ]
  if (isFailureMode.value) headers.push({ title: '错误信息', key: 'errorMessage', minWidth: 120 })
  headers.push({ title: '书架书籍', key: 'usedBookNames', sortable: false, minWidth: 120 })
  if (!isFailureMode.value) headers.push({ title: '操作', key: 'actions', sortable: false, width: 100 })
  return headers
})
const editorCompatibilityMessage = computed(() => {
  try {
    return sourceCompatibilityMessage(analyzeSourceCompatibility(JSON.parse(sourceJSON.value)))
  } catch {
    return ''
  }
})

const failureGroupOrder = [
  'UnknownHostException',
  'ConnectException: Failed to connect',
  'SocketException: Connection reset',
  'SSLHandshakeException',
  'responseCode: 307',
  'responseCode: 400',
  'responseCode: 403',
  'responseCode: 404',
  'responseCode: 500',
  'responseCode: 502',
  'responseCode: 503',
  'responseCode: 504',
  'responseCode: 513',
  'timeout',
]

watch(isNormalPage, normal => {
  if (!normal && props.visible) requestClose()
})

watch(
  () => [props.visible, props.failureMode],
  async ([visible, failure], [wasVisible] = []) => {
    if (!visible) {
      showEditor.value = false
      return
    }
    await handleOpen()
    if (!visible || !failure || wasVisible) return
    await loadInvalidSourceHealth()
  },
)

watch(sourceShowGroups, groups => {
  if (selectedGroup.value && !groups.includes(selectedGroup.value)) {
    selectedGroup.value = ''
  }
})

if (typeof window !== 'undefined') {
  window.addEventListener('openreader:sources-update', handleSourcesUpdate)
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('openreader:sources-update', handleSourcesUpdate)
    if (sourceReloadTimer) window.clearTimeout(sourceReloadTimer)
  }
})

async function handleOpen() {
  const operation = operations.begin('open-source-manager')
  try {
    await loadSources(operation)
    if (isFailureMode.value) await loadInvalidSourceHealth(operation)
  } catch (error) {
    if (operations.canCommit(operation)) {
      message.error(readError(error, '加载书源失败'))
    }
  }
}

function handleDialogModel(value) {
  if (!value) requestClose()
}

function handleClosed() {
  selectedGroup.value = ''
  selectedSourceIds.value = []
  checkProgress.value = ''
  operations.reset()
}

function requestClose() {
  emit('close')
}

async function loadSources(parentOperation = null) {
  if (parentOperation && !operations.canCommit(parentOperation)) return false
  const operation = operations.begin('load-source-list')
  listLoading.value = true
  try {
    const { data } = await listSources()
    if (!operations.canCommit(operation)) return false
    sources.value = Array.isArray(data) ? data : []
    return true
  } finally {
    if (operations.canCommit(operation)) listLoading.value = false
  }
}

async function loadInvalidSourceHealth(parentOperation = null) {
  if (parentOperation && !operations.canCommit(parentOperation)) return false
  const operation = operations.begin('load-invalid-source-health')
  listLoading.value = true
  try {
    const { data } = await listInvalidSources()
    if (!operations.canCommit(operation)) return false
    failureSources.value = (Array.isArray(data) ? data : []).map(source => ({
      ...source,
      errorMessage: visibleFailureCategory(source.errorMessage),
      usedBookNames: Array.isArray(source.usedBookNames)
        ? source.usedBookNames
        : sourceNamesFromActiveList(source.id),
    }))
    return true
  } finally {
    if (operations.canCommit(operation)) listLoading.value = false
  }
}

function sourceNamesFromActiveList(sourceId) {
  return sources.value.find(source => Number(source.id) === Number(sourceId))?.usedBookNames || []
}

function handleSourcesUpdate() {
  if (!props.visible || typeof window === 'undefined') return
  if (sourceReloadTimer) window.clearTimeout(sourceReloadTimer)
  sourceReloadTimer = window.setTimeout(async () => {
    sourceReloadTimer = undefined
    const operation = operations.begin('sync-source-manager')
    try {
      await loadSources(operation)
      if (isFailureMode.value) await loadInvalidSourceHealth(operation)
    } catch {
      // Keep the current list visible; the next durable event/open retries.
    }
  }, 250)
}

function setSourceGroup(group) {
  selectedGroup.value = selectedGroup.value === group ? '' : group
}

function isSourceSelectable(source) {
  return Number(source?.usedBookCount || 0) === 0
}

function toggleSourceSelection(source, checked) {
  const current = new Set(selectedSourceIds.value)
  if (checked) current.add(source.id)
  else current.delete(source.id)
  selectedSourceIds.value = [...current]
}

function toggleAllSelectable(checked) {
  if (checked) {
    const current = new Set(selectedSourceIds.value)
    selectableSources.value.forEach(source => current.add(source.id))
    selectedSourceIds.value = [...current]
  } else {
    const keep = new Set(selectedSourceIds.value)
    selectableSources.value.forEach(source => keep.delete(source.id))
    selectedSourceIds.value = [...keep]
  }
}

function confirmDeletion(text) {
  return confirm({
    title: '提示',
    message: text,
    tone: 'warning',
  }).then(action => {
    if (action !== 'confirm') throw 'cancel'
  })
}

async function deleteSelectedSources() {
  if (!selection.value.length) {
    message.error('请选择需要删除的源')
    return
  }
  const operation = operations.begin('delete-selected-sources')
  try {
    await confirmDeletion('确认要删除所选择的书源吗?')
    if (!operations.canCommit(operation)) return
    deleting.value = true
    const sourceIds = selection.value.map(source => source.id).filter(Boolean)
    await batchSources({ action: 'delete', sourceIds })
    if (!operations.canCommit(operation)) return
    selectedSourceIds.value = []
    await loadSources(operation)
    if (isFailureMode.value) await loadInvalidSourceHealth(operation)
    if (!operations.canCommit(operation)) return
    message.success('删除书源成功')
  } catch (error) {
    if (!operations.canCommit(operation) || isCancel(error)) return
    message.error(readError(error, '删除书源失败'))
  } finally {
    if (operations.canCommit(operation)) deleting.value = false
  }
}

async function clearAllSources() {
  const operation = operations.begin('clear-all-sources')
  try {
    await confirmDeletion('确认要清空所有书源吗?')
    if (!operations.canCommit(operation)) return
    clearing.value = true
    await clearSources()
    if (!operations.canCommit(operation)) return
    sources.value = []
    failureSources.value = []
    selectedSourceIds.value = []
    message.success('清空书源成功')
  } catch (error) {
    if (!operations.canCommit(operation) || isCancel(error)) return
    message.error(readError(error, '清空书源失败'))
  } finally {
    if (operations.canCommit(operation)) clearing.value = false
  }
}

async function restoreDefaults() {
  const operation = operations.begin('restore-default-sources')
  try {
    await confirmDeletion('确认要恢复默认书源吗?')
    if (!operations.canCommit(operation)) return
    restoring.value = true
    await restoreDefaultSources()
    if (!operations.canCommit(operation)) return
    await loadSources(operation)
    if (!operations.canCommit(operation)) return
    message.success('恢复默认书源成功')
  } catch (error) {
    if (!operations.canCommit(operation) || isCancel(error)) return
    message.error(`操作失败 ${readError(error, '')}`.trimEnd())
  } finally {
    if (operations.canCommit(operation)) restoring.value = false
  }
}

async function exportAllSources() {
  const operation = operations.begin('export-all-sources')
  try {
    const response = await exportSources([])
    if (!operations.canCommit(operation)) return
    downloadJSON(response.data, `reader书源-${currentDateTime()}.json`)
  } catch (error) {
    if (operations.canCommit(operation)) {
      message.error(`导出书源失败 ${readError(error, '')}`.trimEnd())
    }
  }
}

async function openEditor(source = null) {
  const operation = operations.begin('open-source-editor')
  try {
    if (!source) {
      editingSourceId.value = null
      sourceJSON.value = JSON.stringify(newSourceTemplate(), null, 4)
      showEditor.value = true
      return
    }
    const { data } = await getSource(source.id)
    if (!operations.canCommit(operation)) return
    const snapshot = sourceToEditorSnapshot(data)
    const readerDevSource = buildReaderDevBookSource(snapshot.form, snapshot.rules)
    editingSourceId.value = source.id
    sourceJSON.value = JSON.stringify(readerDevSource, null, 4)
    showEditor.value = true
  } catch (error) {
    if (operations.canCommit(operation)) {
      message.error(`加载书源信息失败 ${readError(error, '')}`.trimEnd())
    }
  }
}

async function saveSourceJSON() {
  let parsed
  try {
    parsed = JSON.parse(sourceJSON.value)
  } catch {
    message.error('书源必须是JSON格式')
    return
  }
  const name = String(parsed.bookSourceName || parsed.name || '').trim()
  if (!name) {
    message.error('书源名称不能为空')
    return
  }
  const url = String(parsed.bookSourceUrl || parsed.baseUrl || '').trim()
  if (!url) {
    message.error('书源链接不能为空')
    return
  }

  let payload
  try {
    const snapshot = sourceToEditorSnapshot(parsed)
    payload = buildBookSourcePayload(snapshot.form, snapshot.rules)
  } catch {
    message.error('书源必须是JSON格式')
    return
  }

  const sourceId = editingSourceId.value
  const operation = operations.begin('save-source-json')
  saving.value = true
  try {
    if (sourceId) await updateSource(sourceId, payload)
    else await createSource(payload)
    if (!operations.canCommit(operation)) return
    showEditor.value = false
    await loadSources(operation)
    if (!operations.canCommit(operation)) return
    message.success('保存书源成功')
  } catch (error) {
    if (operations.canCommit(operation)) {
      message.error(`保存书源失败 ${readError(error, '')}`.trimEnd())
    }
  } finally {
    if (operations.canCommit(operation)) saving.value = false
  }
}

async function checkInvalidSources() {
  if (!String(checkConfig.keyword || '').trim()) {
    message.error('请输入搜索关键词')
    return
  }
  const sourceRows = [...sources.value]
  if (!sourceRows.length) {
    checkProgress.value = '0/0'
    return
  }
  const operation = operations.begin('check-invalid-sources')
  checking.value = true
  checkProgress.value = `0/${sourceRows.length}`
  let checked = 0
  try {
    const batchSize = Math.max(3, Math.min(15, Number(checkConfig.concurrent) || 5))
    for (let offset = 0; offset < sourceRows.length; offset += batchSize) {
      const chunk = sourceRows.slice(offset, offset + batchSize)
      const { data } = await batchTestSources({
        sourceIds: chunk.map(source => source.id),
        keyword: String(checkConfig.keyword).trim(),
        timeout: checkConfig.timeout,
        concurrent: checkConfig.concurrent,
      })
      if (!operations.canCommit(operation)) return
      mergeHealthFailures(data?.results || [])
      checked += chunk.length
      checkProgress.value = `${checked}/${sourceRows.length}`
    }
  } catch (error) {
    if (operations.canCommit(operation)) {
      message.error(readError(error, '检测书源失败'))
    }
  } finally {
    if (operations.canCommit(operation)) checking.value = false
  }
}

function mergeHealthFailures(results) {
  for (const result of results) {
    if (result?.ok) continue
    const source = sources.value.find(item => Number(item.id) === Number(result.sourceId))
    if (!source) continue
    const row = {
      ...source,
      errorMessage: visibleHealthError(result),
    }
    const index = failureSources.value.findIndex(item => Number(item.id) === Number(source.id))
    if (index >= 0) failureSources.value.splice(index, 1, row)
    else failureSources.value.push(row)
  }
}

function visibleHealthError(result) {
  return visibleFailureCategory(result?.message, result?.code)
}

function visibleFailureCategory(rawMessage, code = '') {
  const message = String(rawMessage || '')
  if (failureGroupOrder.some(type => message.includes(type))) return message
  if (/timeout|超时/i.test(message)) return 'timeout'
  const status = message.match(/\b(307|400|403|404|500|502|503|504|513)\b/)?.[1]
  if (status) return `responseCode: ${status}`
  if (code === 'source_request_failed' || message === '请求书源失败' || message === 'failed to request book source') {
    return 'ConnectException: Failed to connect'
  }
  return message || '请求书源失败'
}

function newSourceTemplate() {
  return {
    bookSourceComment: '',
    bookSourceGroup: '',
    bookSourceName: '新增书源',
    bookSourceType: 0,
    bookSourceUrl: '',
    bookUrlPattern: '',
    enabled: true,
    enabledExplore: true,
    exploreUrl: '',
    ruleBookInfo: {},
    ruleContent: { content: '' },
    ruleExplore: {},
    ruleSearch: {
      author: '',
      bookList: '',
      bookUrl: '',
      coverUrl: '',
      intro: '',
      kind: '',
      lastChapter: '',
      name: '',
    },
    ruleToc: {
      chapterList: '',
      chapterName: '',
      chapterUrl: '',
    },
    searchUrl: '',
  }
}

function downloadJSON(data, filename) {
  const blob = data instanceof Blob
    ? data
    : new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function currentDateTime() {
  const date = new Date()
  const pad = value => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-')
}

function isCancel(error) {
  return error === 'cancel' || error === 'close'
}

function readError(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.error || fallback
}
</script>

<style scoped>
.source-dialog-title,
.source-title-actions,
.source-dialog-footer,
.source-check-form,
.source-group-wrapper {
  display: flex;
  align-items: center;
}

.source-dialog-title {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: space-between;
  gap: 16px;
}

.source-title-actions {
  min-width: 0;
  overflow-x: auto;
  gap: 4px;
}

.source-title-actions .v-btn {
  white-space: nowrap;
}

.source-manager-body {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.source-check-form {
  min-width: 0;
  gap: 8px;
}

.source-check-form .source-check-input {
  min-width: 120px;
  flex: 1;
}

.source-check-form .source-check-number {
  width: 128px;
  flex: 0 0 auto;
}

.source-check-label {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  white-space: nowrap;
}

.source-timeout-label {
  min-width: 68px;
}

.source-group-wrapper {
  min-width: 0;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 2px;
}

.source-group-btn {
  flex: 0 0 auto;
  padding: 4px 12px;
  color: var(--app-text-muted);
  font-size: 13px;
  background: transparent;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
}

.source-group-btn.selected {
  border-color: var(--app-primary);
  color: var(--app-primary);
  background: var(--app-primary-soft);
}

.source-table {
  width: 100%;
}

.source-base-url {
  overflow-wrap: anywhere;
}

.source-used-books {
  margin: 0;
  color: inherit;
  font: inherit;
  line-height: 1.55;
  white-space: pre-wrap;
}

.source-dialog-footer {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.source-json-editor :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.55;
}
</style>

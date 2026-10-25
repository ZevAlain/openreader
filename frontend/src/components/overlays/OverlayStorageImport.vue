<template>
  <v-dialog
    :model-value="phase === 'preflight'"
    width="min(760px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="storage-import-preflight-dialog"
    @update:model-value="handlePreflightVisible"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">{{ sourceLabel }}导入预检</h2>
      </header>
      <div class="app-dialog-body">
        <p class="storage-import-tip">
          已先冻结所选文件的字节。修正规则后可在同一份暂存数据上重新解析，不会重新读取书仓原文件。
        </p>
        <div class="storage-import-preflight-list">
          <article v-for="row in rows" :key="row.key" :class="['storage-import-preflight-row', { failed: row.error }]">
            <v-chip size="small" :color="row.valid ? 'success' : 'error'" variant="tonal">{{ row.valid ? '可导入' : '待修复' }}</v-chip>
            <div>
              <strong>{{ row.path }}</strong>
              <p v-if="row.error">{{ row.error }}</p>
              <span v-else-if="row.chapterCount === 0">未匹配到目录；可调整规则后重新解析，或保留空目录继续导入。</span>
              <span v-else>已解析 {{ row.chapterCount }} 章</span>
            </div>
            <div v-if="isRuleConfigurable(row.path)" class="storage-import-rule-row">
              <v-combobox
                v-if="isTextLocalPath(row.path)"
                :model-value="row.tocRule"
                :items="txtTocRuleItems"
                clearable
                variant="outlined"
                density="compact"
                hide-details
                placeholder="TXT 目录规则（可选）"
                @update:model-value="value => row.tocRule = value || ''"
              />
              <v-select
                v-else
                v-model="row.tocRule"
                :items="epubTocRuleOptions"
                item-title="label"
                item-value="value"
                variant="outlined"
                density="compact"
                hide-details
                placeholder="EPUB 目录规则"
              />
              <v-btn :loading="row.reparsing" :disabled="!row.importToken" @click="reparse(row)">重新解析</v-btn>
            </div>
          </article>
        </div>
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="workflow.cancelAll">取消</v-btn>
        <v-btn color="primary" :disabled="!validRows.length" @click="workflow.continueAfterPreflight">
          继续导入 {{ validRows.length || '' }} 本
        </v-btn>
      </footer>
    </div>
  </v-dialog>

  <v-dialog
    :model-value="phase === 'choose-mode'"
    width="min(440px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    persistent
    class="storage-import-mode-dialog"
    @update:model-value="handleModeVisible"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">提示</h2>
      </header>
      <div class="app-dialog-body">
        <p class="storage-import-tip">你选择导入多本书籍，请选择导入方式？</p>
      </div>
      <footer class="app-dialog-actions">
        <v-btn color="primary" @click="workflow.chooseBatch">批量导入</v-btn>
        <v-btn variant="text" @click="workflow.chooseSequential">逐一确认导入</v-btn>
      </footer>
    </div>
  </v-dialog>

  <v-dialog
    :model-value="phase === 'batch-groups'"
    width="min(440px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="storage-import-groups-dialog"
    @update:model-value="handleBatchGroupsVisible"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">统一设置分组</h2>
      </header>
      <div class="app-dialog-body">
        <div class="storage-import-groups-body">
          <span>请选择分组：</span>
          <v-select
            v-model="batchCategoryIds"
            :items="categoryItems"
            multiple
            clearable
            chips
            variant="outlined"
            density="compact"
            hide-details
            placeholder="未分组"
          />
        </div>
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="workflow.cancelBatchGroups">取消导入</v-btn>
        <v-btn color="primary" :loading="busy" @click="workflow.confirmBatch">确定</v-btn>
      </footer>
    </div>
  </v-dialog>

  <v-dialog
    :model-value="phase === 'single'"
    width="min(760px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="storage-import-single-dialog"
    @update:model-value="handleSingleVisible"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">导入本地书籍{{ currentLabel }}</h2>
      </header>
      <div class="app-dialog-body">
        <template v-if="currentRow">
          <div class="storage-import-single-form">
            <v-text-field v-model="currentRow.title" placeholder="书名" variant="outlined" density="compact" hide-details />
            <v-text-field v-model="currentRow.author" placeholder="作者（可选）" variant="outlined" density="compact" hide-details />
            <v-select
              v-model="currentRow.categoryIds"
              :items="categoryItems"
              multiple
              clearable
              chips
              variant="outlined"
              density="compact"
              hide-details
              placeholder="未分组"
            />
            <div v-if="isRuleConfigurable(currentRow.path)" class="storage-import-rule-row">
              <v-combobox
                v-if="isTextLocalPath(currentRow.path)"
                :model-value="currentRow.tocRule"
                :items="txtTocRuleItems"
                clearable
                variant="outlined"
                density="compact"
                hide-details
                placeholder="TXT 目录规则（可选）"
                @update:model-value="value => currentRow.tocRule = value || ''"
              />
              <v-select
                v-else
                v-model="currentRow.tocRule"
                :items="epubTocRuleOptions"
                item-title="label"
                item-value="value"
                variant="outlined"
                density="compact"
                hide-details
                placeholder="EPUB 目录规则"
              />
              <v-btn :loading="currentRow.reparsing" :disabled="!currentRow.importToken" @click="reparse(currentRow)">刷新目录</v-btn>
            </div>
            <p v-if="currentRow.chapterCount === 0" class="storage-import-empty-catalog">
              未匹配到目录；可调整规则后刷新目录，或保留空目录继续导入。
            </p>
            <p v-if="currentRow.lastError" class="storage-import-error">{{ currentRow.lastError }}</p>
          </div>
          <div class="storage-import-chapter-title">章节列表（{{ currentRow.chapters.length }}）</div>
          <div class="storage-import-chapter-list">
            <p v-for="chapter in currentRow.chapters" :key="chapter.index">{{ Number(chapter.index) + 1 }}. {{ chapter.title }}</p>
          </div>
        </template>
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="workflow.skipCurrent">取消</v-btn>
        <v-btn color="primary" :loading="busy" :disabled="!currentRow?.valid" @click="workflow.confirmCurrent">确定导入</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from '../../composables/useAppFeedback.js'
import { listTXTTocRules, previewDirectLocalBooks } from '../../api/books'
import { importFromLocalStore, previewLocalStoreImport } from '../../api/localStore'
import { useStorageImportWorkflow } from '../../composables/useStorageImportWorkflow'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useBookshelfStore } from '../../stores/bookshelf'
import { useOverlayStore } from '../../stores/overlay'
import { epubTocRuleOptions, isEPUBLocalPath, isTextLocalPath } from '../../utils/localBookToc'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const overlay = useOverlayStore()
const bookshelf = useBookshelfStore()
const operations = useAuthenticatedOperationGuard()
const txtTocRuleOptions = ref([])
const workflow = useStorageImportWorkflow({
  operationGuard: operations,
  loadCategories: loadImportOptions,
  preview: async (source, payload, options) => {
    if (source === 'direct') return previewDirectLocalBooks(payload, options)
    const response = await previewLocalStoreImport(stripClientKeys(payload), options)
    return response.data
  },
  importItem: async (source, item, categoryIds, options) => {
    if (source === 'direct') {
      const book = await bookshelf.importTXT(
        { ...item, categoryIds },
        { ...options, upsert: false },
      )
      return { imported: [{ key: item.key, path: item.path, book }] }
    }
    const backendItem = stripClientKey(item)
    const response = await importFromLocalStore([backendItem], categoryIds, options)
    return response.data
  },
  onImported: book => bookshelf.upsertBook(book),
  onError: text => message.error(text),
  onComplete: summary => {
    if (summary.succeeded) {
      message.success(`导入 ${summary.succeeded} 本${summary.failed ? `，${summary.failed} 本失败` : ''}`)
    } else if (summary.failed) {
      message.warning(`导入失败 ${summary.failed} 本`)
    }
    overlay.closeStorageImport()
  },
  onCancel: () => overlay.closeStorageImport(),
})

const {
  phase,
  source,
  rows,
  validRows,
  currentRow,
  currentLabel,
  batchCategoryIds,
  busy,
} = workflow

const sourceLabel = computed(() => {
  if (source.value === 'direct') return '本地文件'
  return '本地书仓'
})
const txtTocRuleItems = computed(() => txtTocRuleOptions.value.map(rule => ({ title: rule.name, value: rule.rule })))
const categoryItems = computed(() => bookshelf.categories.map(category => ({ title: category.name, value: Number(category.id) })))

watch(
  () => overlay.storageImportRequest?.requestId,
  async requestId => {
    if (!requestId || !overlay.storageImportVisible || !overlay.storageImportRequest) return
    const started = await workflow.start(overlay.storageImportRequest)
    if (!started && overlay.storageImportRequest?.requestId === requestId) {
      overlay.closeStorageImport()
    }
  },
)

watch(
  () => overlay.storageImportVisible,
  visible => {
    if (!visible) workflow.reset()
  },
)

function handlePreflightVisible(visible) {
  if (!visible) workflow.cancelAll()
}

function handleModeVisible(visible) {
  if (!visible) workflow.cancelMode()
}

function handleBatchGroupsVisible(visible) {
  if (!visible) workflow.cancelBatchGroups()
}

function handleSingleVisible(visible) {
  if (!visible) workflow.skipCurrent()
}

function isRuleConfigurable(path) {
  return isTextLocalPath(path) || isEPUBLocalPath(path)
}

function reparse(row) {
  workflow.reparse(row)
}

async function loadImportOptions() {
  const operation = operations.begin('load-import-options')
  const requests = [bookshelf.ensureCategoriesLoaded()]
  let tocRulesError = null
  if (!txtTocRuleOptions.value.length) {
    requests.push(listTXTTocRules().catch(error => {
      tocRulesError = error
      return null
    }))
  }
  const results = await Promise.all(requests)
  if (!operations.canCommit(operation)) return
  const tocRulesResponse = results[1]
  if (tocRulesResponse) {
    txtTocRuleOptions.value = Array.isArray(tocRulesResponse.data)
      ? tocRulesResponse.data.filter(rule => rule?.rule)
      : []
  }
  if (tocRulesError) message.error(readError(tocRulesError, '加载目录规则失败'))
}

function stripClientKeys(items) {
  return Array.isArray(items) ? items.map(stripClientKey) : items
}

function stripClientKey(item) {
  if (!item || typeof item !== 'object') return item
  const { key: _key, ...payload } = item
  return payload
}

function readError(error, fallback) {
  return error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
}
</script>

<style scoped>
.storage-import-tip,
.storage-import-preflight-row p,
.storage-import-error {
  margin: 0;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.storage-import-preflight-list,
.storage-import-single-form,
.storage-import-chapter-list {
  display: grid;
  gap: 10px;
}

.storage-import-preflight-list {
  max-height: min(56vh, 560px);
  overflow: auto;
  margin-top: 14px;
}

.storage-import-preflight-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
}

.storage-import-preflight-row.failed {
  background: rgba(196, 69, 58, 0.08);
}

.storage-import-preflight-row strong,
.storage-import-preflight-row span {
  display: block;
  overflow-wrap: anywhere;
}

.storage-import-rule-row {
  display: flex;
  grid-column: 1 / -1;
  gap: 8px;
}

.storage-import-rule-row > :first-child {
  min-width: 0;
  flex: 1;
}

.storage-import-groups-body {
  display: grid;
  gap: 10px;
}

.storage-import-chapter-title {
  margin-top: 16px;
  font-weight: 700;
}

.storage-import-chapter-list {
  max-height: min(46vh, 420px);
  overflow: auto;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-soft);
}

.storage-import-chapter-list p {
  margin: 0;
}

.storage-import-error {
  color: var(--app-danger);
}

@media (max-width: 750px) {
  .storage-import-rule-row {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>

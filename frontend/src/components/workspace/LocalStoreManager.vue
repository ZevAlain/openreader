<template>
  <section class="store-page">
    <v-data-table
      :headers="tableHeaders"
      :items="tableItems"
      item-value="path"
      :loading="loading"
      density="compact"
      :items-per-page="-1"
      no-data-text="书仓为空，把文件放入 localStore 目录即可显示"
      class="store-table"
      @dblclick:row="(_, { item }) => openRow(item)"
    >
      <template #header.data-table-select="{ allSelected, someSelected, selectAll }">
        <v-checkbox-btn
          :model-value="allSelected"
          :indeterminate="someSelected && !allSelected"
          @update:model-value="selectAll"
        />
      </template>
      <template #item.data-table-select="{ item }">
        <v-checkbox-btn
          v-if="!item.toParent && !item.loadMore"
          :model-value="selectedIds.includes(item.path)"
          @update:model-value="checked => toggleRow(item, checked)"
        />
      </template>
      <template #item.name="{ item }">
        <button class="file-name" type="button" @click="openRow(item)">
          <v-icon :icon="item.isDir ? mdiFolderOpenOutline : mdiFileDocumentOutline" />
          <span>{{ item.name }}</span>
        </button>
      </template>
      <template #item.size="{ item }">
        {{ item.isDir || item.toParent || item.loadMore ? '-' : formatSize(item.size) }}
      </template>
      <template #item.lastModified="{ item }">
        {{ formatDate(item.lastModified) }}
      </template>
      <template #header.actions>
        <div class="operation-header">
          <span>操作</span>
          <v-text-field
            v-model="keyword"
            density="compact"
            variant="outlined"
            clearable
            hide-details
            placeholder="输入关键字搜索"
          />
        </div>
      </template>
      <template #item.actions="{ item }">
        <v-btn
          v-if="canImport(item)"
          variant="text"
          color="primary"
          size="small"
          :loading="storageImportPending"
          @click="importOne(item)"
        >
          加入书架
        </v-btn>
        <v-btn
          v-if="!item.toParent && !item.loadMore"
          variant="text"
          color="error"
          size="small"
          @click="deleteItem(item)"
        >
          删除
        </v-btn>
      </template>
    </v-data-table>

    <footer v-if="items.length" class="store-batch-footer app-panel">
      <span class="check-tip">已选择 {{ selectedRows.length }} 个</span>
      <v-btn variant="outlined" color="primary" :disabled="!selectedRows.length" @click="deleteSelected">批量删除</v-btn>
      <v-btn
        color="primary"
        :disabled="!selectedImportablePaths.length || storageImportPending"
        :loading="storageImportPending"
        @click="importSelected"
      >
        批量加入书架 {{ selectedImportablePaths.length || '' }}
      </v-btn>
      <input ref="uploadInput" class="hidden-upload" type="file" multiple @change="uploadFiles">
      <v-btn variant="outlined" :loading="uploading" @click="chooseFiles">上传书籍</v-btn>
      <v-btn variant="text" @click="clearSelection">取消</v-btn>
    </footer>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { mdiFileDocumentOutline, mdiFolderOpenOutline } from '@mdi/js'
import { confirm, message } from '../../composables/useAppFeedback.js'
import { deleteFromLocalStore, listLocalStore, uploadToLocalStore } from '../../api/localStore'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useOverlayStore } from '../../stores/overlay'
import { filterLocalStoreItems, visibleLocalStoreItems } from '../../utils/localStoreItems'
import { isLocalStoreImportable } from '../../utils/storageImportable'

const overlay = useOverlayStore()
const operations = useAuthenticatedOperationGuard()
const items = ref([])
const selectedIds = ref([])
const currentPath = ref('')
const keyword = ref('')
const loading = ref(false)
const uploading = ref(false)
const showAllItems = ref(false)
const uploadInput = ref(null)

const filteredItems = computed(() => filterLocalStoreItems(items.value, { keyword: keyword.value }))
const visibleItems = computed(() => visibleLocalStoreItems(filteredItems.value, showAllItems.value))
const remainingItemCount = computed(() => Math.max(0, filteredItems.value.length - visibleItems.value.length))
const tableItems = computed(() => {
  const rows = [...visibleItems.value]
  if (currentPath.value) {
    rows.unshift({
      name: '..',
      path: parentPath(currentPath.value),
      isDir: true,
      toParent: true,
    })
  }
  if (remainingItemCount.value > 0) {
    rows.push({
      name: `加载更多 ${remainingItemCount.value} 项`,
      path: '__load-more__',
      loadMore: true,
    })
  }
  return rows
})
const selectableRows = computed(() => tableItems.value.filter(row => !row.toParent && !row.loadMore))
const selectedRows = computed(() => selectableRows.value.filter(row => selectedIds.value.includes(row.path)))
const selectedImportablePaths = computed(() => selectedRows.value.filter(canImport).map(item => item.path))
const storageImportPending = computed(() => overlay.storageImportVisible)

const tableHeaders = [
  { key: 'data-table-select', width: 42 },
  { title: '文件名', key: 'name', minWidth: 260 },
  { title: '大小', key: 'size', sortable: false, width: 118 },
  { title: '修改时间', key: 'lastModified', sortable: false, width: 156 },
  { title: '操作', key: 'actions', sortable: false, width: 230, fixed: 'end' },
]

watch(keyword, () => {
  showAllItems.value = false
})

onMounted(load)

async function load(parentOperation = null) {
  if (parentOperation && !operations.canCommit(parentOperation)) return false
  const operation = operations.begin('load')
  loading.value = true
  try {
    const { data } = await listLocalStore(currentPath.value)
    if (!operations.canCommit(operation)) return false
    currentPath.value = data.path || ''
    items.value = data.items || []
    showAllItems.value = false
    clearSelection()
    return true
  } catch (err) {
    if (operations.canCommit(operation)) {
      message.error(readError(err, '加载书仓失败'))
    }
    return false
  } finally {
    if (operations.canCommit(operation)) loading.value = false
  }
}

function canImport(row) {
  return !row?.isDir && !row?.toParent && !row?.loadMore && isLocalStoreImportable(row.path || row.name)
}

function toggleRow(row, checked) {
  const current = new Set(selectedIds.value)
  if (checked) current.add(row.path)
  else current.delete(row.path)
  selectedIds.value = [...current]
}

async function openRow(row) {
  if (row.loadMore) {
    showMoreItems()
    return
  }
  if (row.isDir) await goPath(row.path)
}

async function goPath(path) {
  currentPath.value = path
  await load()
}

function showMoreItems() {
  showAllItems.value = true
}

function clearSelection() {
  selectedIds.value = []
}

function chooseFiles() {
  uploadInput.value?.click()
}

async function uploadFiles(event) {
  const files = Array.from(event.target?.files || [])
  if (!files.length) return
  const operation = operations.begin('upload')
  const uploadPath = currentPath.value
  uploading.value = true
  try {
    await uploadToLocalStore({ path: uploadPath, files })
    if (!operations.canCommit(operation)) return
    message.success('文件已上传')
    await load(operation)
  } catch (err) {
    if (operations.canCommit(operation)) {
      message.error(readError(err, '上传失败'))
    }
  } finally {
    if (operations.canCommit(operation)) {
      uploading.value = false
      if (event.target) event.target.value = ''
    }
  }
}

function importOne(row) {
  if (canImport(row)) importPaths([row.path])
}

function importSelected() {
  if (selectedImportablePaths.value.length) importPaths(selectedImportablePaths.value)
}

function importPaths(paths) {
  overlay.openStorageImport('local-store', paths)
}

async function deleteItem(row) {
  const operation = operations.begin('delete')
  try {
    const action = await confirm({
      title: '删除书仓项目',
      message: `确定删除“${row.name}”吗？`,
      tone: 'warning',
    })
    if (action !== 'confirm') throw 'cancel'
    if (!operations.canCommit(operation)) return
    await deleteFromLocalStore(row.path)
    if (!operations.canCommit(operation)) return
    message.success('已删除')
    await load(operation)
  } catch (err) {
    if (err === 'cancel' || err === 'close') return
    if (operations.canCommit(operation)) {
      message.error(readError(err, '删除失败'))
    }
  }
}

async function deleteSelected() {
  if (!selectedRows.value.length) return
  const operation = operations.begin('delete')
  const selected = [...selectedRows.value]
  try {
    const action = await confirm({
      title: '批量删除书仓项目',
      message: `确定删除选中的 ${selected.length} 个书仓项目吗？`,
      tone: 'warning',
    })
    if (action !== 'confirm') throw 'cancel'
    if (!operations.canCommit(operation)) return
    for (const row of selected) {
      await deleteFromLocalStore(row.path)
      if (!operations.canCommit(operation)) return
    }
    message.success('已批量删除')
    await load(operation)
  } catch (err) {
    if (err === 'cancel' || err === 'close') return
    if (operations.canCommit(operation)) {
      message.error(readError(err, '批量删除失败'))
    }
  }
}

function parentPath(path) {
  const parts = String(path || '').split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

function formatSize(bytes) {
  const value = Number(bytes || 0)
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function readError(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.error || fallback
}
</script>

<style scoped>
.store-page {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.store-page {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
}

.store-table {
  width: 100%;
}

.file-name {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 8px;
  padding: 0;
  color: var(--app-text);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.file-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.operation-header {
  display: grid;
  gap: 6px;
}

.store-batch-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}

.check-tip {
  margin-right: auto;
  color: var(--app-text-muted);
  font-size: 13px;
}

.hidden-upload {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 750px) {
  .store-table {
    overflow-x: auto;
  }

  .store-batch-footer {
    position: sticky;
    z-index: 2;
    bottom: max(10px, env(safe-area-inset-bottom));
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    background: var(--app-surface);
    box-shadow: 0 -8px 22px rgba(15, 23, 42, 0.08);
  }

  .check-tip {
    grid-column: 1 / -1;
    margin: 0;
  }

  .store-batch-footer :deep(.v-btn) {
    width: 100%;
    min-height: 38px;
  }
}
</style>

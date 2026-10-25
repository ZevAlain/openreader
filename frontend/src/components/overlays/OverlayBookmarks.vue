<template>
  <v-dialog
    v-model="overlay.bookmarkVisible"
    width="min(1000px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="global-bookmark-dialog"
    @after-leave="handleClosed"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <div class="reader-dialog-title">
          <span class="reader-dialog-title-text">{{ bookTitle }} 书签管理</span>
          <div class="reader-dialog-title-actions">
            <v-btn v-if="canAddCurrentParagraph" variant="text" color="primary" size="small" @click="addCurrentParagraph">添加当前段落</v-btn>
            <v-btn variant="text" color="primary" size="small" @click="pickImportFile">导入</v-btn>
          </div>
        </div>
      </header>

      <input
        ref="fileRef"
        class="bookmark-file-input"
        type="file"
        accept=".json,application/json"
        @change="onImportFileChange"
      />

      <div class="app-dialog-body reader-dialog-table">
        <v-data-table
          v-model="selectedIds"
          :headers="tableHeaders"
          :items="items"
          item-value="id"
          show-select
          density="compact"
          :items-per-page="-1"
          no-data-text="暂无数据"
          :loading="loading"
          :height="isMobile ? 'calc(100dvh - 184px)' : 'min(400px, calc(70dvh - 184px))'"
        >
          <template #item.book="{ }">
            {{ bookIdentity }}
          </template>
          <template #item.excerpt="{ item }">
            {{ item.excerpt }}
          </template>
          <template #item.note="{ item }">
            {{ item.note }}
          </template>
          <template #item.actions="{ item }">
            <v-btn variant="text" color="primary" size="small" @click="jump(item)">跳转</v-btn>
            <v-btn variant="text" color="primary" size="small" @click="openEditor(item)">编辑</v-btn>
          </template>
        </v-data-table>
      </div>

      <footer class="app-dialog-actions">
        <div class="reader-dialog-footer">
          <v-btn color="primary" @click="removeMany(selectedRows)">
            批量删除
          </v-btn>
          <span>已选择 {{ selectedRows.length }} 个</span>
          <v-btn variant="text" @click="overlay.bookmarkVisible = false">取消</v-btn>
        </div>
      </footer>
    </div>
  </v-dialog>

</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { confirm, message } from '../../composables/useAppFeedback.js'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useBookBookmarks } from '../../composables/useBookBookmarks'
import { useOverlayBookmarkActions } from '../../composables/useOverlayBookmarkActions'
import { useOverlayStore } from '../../stores/overlay'

const props = defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const overlay = useOverlayStore()
const operations = useAuthenticatedOperationGuard()
const fileRef = ref(null)
const selectedIds = ref([])
const selectedRows = ref([])
const bookId = computed(() => overlay.bookmarkBook?.id)
const bookTitle = computed(() => (
  overlay.bookmarkBook?.title || overlay.bookmarkBook?.name || '书签'
))
const bookAuthor = computed(() => overlay.bookmarkBook?.author || '')
const bookIdentity = computed(() => `${bookTitle.value} - ${bookAuthor.value}`)
const canAddCurrentParagraph = computed(() => Boolean(
  overlay.bookmarkBook?.id && String(overlay.bookmarkCreateDraft?.excerpt || '').trim(),
))

const {
  items,
  loading,
  load,
  reset,
  removeMany: removeManyData,
  importPayloads,
  handleUpdated,
} = useBookBookmarks({
  operationGuard: operations,
  bookId,
  isActive: () => overlay.bookmarkVisible,
  onLoadError: error => message.error(readError(error, '加载书签失败')),
})

const {
  jump,
  removeMany,
  importRows,
} = useOverlayBookmarkActions({
  operationGuard: operations,
  getBook: () => overlay.bookmarkBook,
  closePanel: () => {
    overlay.bookmarkVisible = false
  },
  navigate: routeLocation => router.push(routeLocation),
  removeMany: removeManyData,
  importPayloads,
  confirm: (text, title, config = {}) =>
    confirm({ message: text, title, tone: config.type === 'warning' ? 'warning' : 'primary' }).then(action => {
      if (action !== 'confirm') return Promise.reject('cancel')
    }),
  onSuccess: text => message.success(text),
  onInvalidSelection: text => message.error(text),
  onInvalidImport: text => message.error(text),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})

const tableHeaders = computed(() => [
  { key: 'data-table-select', fixed: props.isMobile ? 'start' : false, width: 44 },
  { title: '书籍', key: 'book', fixed: props.isMobile ? 'start' : false, minWidth: 150 },
  { title: '章节', key: 'title', minWidth: 160 },
  { title: '内容', key: 'excerpt', sortable: false, minWidth: 200 },
  { title: '备注', key: 'note', sortable: false, minWidth: 160 },
  { title: '操作', key: 'actions', sortable: false, width: 150 },
])

// v-model holds selected row ids; the batch actions consume row objects.
watch(selectedIds, ids => {
  selectedRows.value = items.value.filter(bookmark => ids.includes(Number(bookmark.id)))
}, { deep: true })

watch(
  () => overlay.bookmarkVisible,
  async (visible) => {
    if (!visible) {
      selectedIds.value = []
      selectedRows.value = []
      reset()
      return
    }
    await load()
  },
)

onMounted(() => {
  window.addEventListener('openreader:bookmarks-updated', handleUpdated)
})

onBeforeUnmount(() => {
  window.removeEventListener('openreader:bookmarks-updated', handleUpdated)
})

function pickImportFile() {
  fileRef.value?.click()
}

function addCurrentParagraph() {
  if (!canAddCurrentParagraph.value) return
  overlay.openBookmarkForm(
    overlay.bookmarkBook,
    overlay.bookmarkCreateDraft,
    { mode: 'create' },
  )
}

function handleClosed() {
  selectedIds.value = []
  selectedRows.value = []
  overlay.clearBookmark()
}

function openEditor(bookmark) {
  overlay.openBookmarkForm(overlay.bookmarkBook, bookmark, { mode: 'edit' })
}

function onImportFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const rows = JSON.parse(String(reader.result || '[]'))
      if (!Array.isArray(rows)) {
        message.error('书签文件错误')
        return
      }
      importRows(rows)
    } catch {
      message.error('书签文件错误')
    }
  }
  reader.onerror = () => message.error('读取书签文件失败')
  reader.readAsText(file)
}

function readError(error, fallback) {
  return error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    fallback
}
</script>

<style scoped>
.reader-dialog-title,
.reader-dialog-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reader-dialog-title {
  flex: 1 1 auto;
  justify-content: space-between;
  min-width: 0;
}

.reader-dialog-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 700;
}

.reader-dialog-title-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
}

.reader-dialog-table {
  min-height: 180px;
}

.reader-dialog-footer {
  flex: 1 1 auto;
}

.reader-dialog-footer span {
  flex: 1;
  color: var(--app-text-muted);
  text-align: left;
}

.bookmark-file-input {
  display: none;
}

@media (max-width: 750px) {
  .reader-dialog-footer {
    flex-wrap: wrap;
  }

  .reader-dialog-footer span {
    order: 3;
    flex-basis: 100%;
  }
}
</style>

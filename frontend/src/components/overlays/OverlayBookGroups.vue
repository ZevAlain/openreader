<template>
  <v-dialog
    v-if="isNormalPage"
    v-model="overlay.bookGroupVisible"
    width="min(1000px, max(750px, 70vw))"
    :fullscreen="isMobile"
    class="global-book-group-dialog"
    @after-enter="handleOpened"
    @after-leave="handleClosed"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">{{ overlay.bookGroupMode === 'set' ? '设置分组' : '分组管理' }}</h2>
      </header>

      <div class="app-dialog-body">
        <section class="book-group-dialog-body">
          <v-data-table
            ref="groupTableEl"
            v-model="selectedGroupIds"
            :key="isSetMode"
            :headers="tableHeaders"
            :items="groupRows"
            item-value="id"
            show-select
            density="compact"
            :items-per-page="-1"
            no-data-text="暂无数据"
            :class="{ 'book-group-table': true, 'hide-select': !isSetMode }"
            :height="isMobile ? 'calc(100dvh - 184px)' : 'min(400px, calc(70dvh - 184px))'"
            @update:model-value="onTableSelectionChange"
          >
            <template #item.name="{ item }">
              <span class="group-name-cell">
                <span class="group-drag-icon" aria-hidden="true">
                  <v-icon :icon="mdiDragVertical" />
                </span>
                <span>{{ displayBookGroupName(item) }}</span>
              </span>
            </template>
            <template #item.show="{ item }">
              <v-switch
                :model-value="item.show !== false"
                :loading="visibilitySavingId === (item.key || item.id)"
                color="primary"
                density="compact"
                hide-details
                @update:model-value="value => toggleVisibility(item, value)"
              />
            </template>
            <template #item.actions="{ item }">
              <v-btn variant="text" size="small" @click="renameGroup(item)">编辑</v-btn>
              <v-btn
                v-if="!isSetMode && item.kind === 'category' && groupBookCount(item) === 0"
                variant="text"
                size="small"
                color="error"
                @click="deleteGroup(item)"
              >
                删除
              </v-btn>
            </template>
          </v-data-table>
        </section>
      </div>

      <footer class="app-dialog-actions">
        <div class="dialog-footer">
          <v-btn variant="outlined" @click="createCategory">
            添加分组
          </v-btn>
          <v-btn
            v-if="isGroupOrderDirty"
            variant="outlined"
            :loading="groupOrderSaving"
            @click="saveOrder"
          >
            保存排序
          </v-btn>
          <v-btn
            v-if="isSetMode"
            color="primary"
            :loading="settingCategorySaving"
            @click="saveSetting"
          >
            确认
          </v-btn>
          <v-btn variant="text" @click="overlay.bookGroupVisible = false">
            取消
          </v-btn>
        </div>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import { mdiDragVertical } from '@mdi/js'
import { confirm, message, prompt } from '../../composables/useAppFeedback.js'
import { updateBookCategory } from '../../api/books'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useOverlayBookGroups } from '../../composables/useOverlayBookGroups'
import { useBookshelfStore } from '../../stores/bookshelf'
import { useOverlayStore } from '../../stores/overlay'
import { useReaderStore } from '../../stores/reader'
import { createBookCategoryNameResolver } from '../../utils/bookCategory'
import { newestBookProgress, sortByShelfOrder } from '../../utils/bookOrder'

const props = defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const bookshelf = useBookshelfStore()
const overlay = useOverlayStore()
const reader = useReaderStore()
const operations = useAuthenticatedOperationGuard()
const groupTableEl = ref(null)
const selectedGroupIds = ref([])
const categoryName = createBookCategoryNameResolver(() => bookshelf.categories)
const managedBooks = computed(() => (
  sortByShelfOrder(bookshelf.books, reader.progressByBook)
))
const isSetMode = computed(() => overlay.bookGroupMode === 'set')
const isNormalPage = computed(() => reader.pageType === 'normal')
const bookGroupProjectionRevision = computed(() => JSON.stringify(
  bookshelf.bookGroups.map(group => [group.key, group.name, group.show, group.sortOrder]),
))
const categoryProjectionRevision = computed(() => JSON.stringify(
  bookshelf.categories.map(category => [category.id, category.name, category.show, category.sortOrder]),
))

const tableHeaders = computed(() => {
  const headers = [
    { key: 'data-table-select', width: 44 },
    { title: '分组名', key: 'name', minWidth: 100 },
  ]
  if (!isSetMode.value) headers.push({ title: '显示', key: 'show', sortable: false, minWidth: 80 })
  headers.push({ title: '操作', key: 'actions', sortable: false, width: 130 })
  return headers
})

function onTableSelectionChange(ids) {
  const rows = groupRows.value.filter(row => ids.includes(String(row.id)))
  handleSelectionChange(rows)
}

const {
  setGroupTableAdapter,
  settingCategorySaving,
  visibilitySavingId,
  groupOrderSaving,
  groupRows,
  isGroupOrderDirty,
  groupBookCount,
  displayBookGroupName,
  prepareOpen,
  handleBookGroupSelectionChange: handleSelectionChange,
  saveBookGroupSetting: saveSetting,
  createCategory,
  renameGroup,
  toggleGroupVisibility: toggleVisibility,
  deleteGroup,
  handleBookGroupOpened: handleOpened,
  destroyGroupSortable: destroySortable,
  handleModeChange,
  saveGroupOrderDraft: saveOrder,
} = useOverlayBookGroups({
  operationGuard: operations,
  overlay,
  bookshelf,
  getManagedBooks: () => managedBooks.value,
  updateBookCategory,
  categoryName,
  getBookProgress: book => newestBookProgress(book, reader.progressByBook),
  emitBookInfoUpdated: data => {
    window.dispatchEvent(new CustomEvent('openreader:book-info-updated', {
      detail: { book: data },
    }))
  },
  prompt: (text, title, config = {}) => prompt({
    title,
    message: text,
    value: config.inputValue ?? '',
    validator: config.inputValidator,
    confirmText: config.confirmButtonText,
    cancelText: config.cancelButtonText,
  }),
  confirm: (text, title, config = {}) =>
    confirm({ message: text, title, tone: config.type === 'warning' ? 'warning' : 'primary' }).then(action => {
      if (action !== 'confirm') return Promise.reject('cancel')
    }),
  createSortable: (...args) => Sortable.create(...args),
  nextFrame: nextTick,
  onSuccess: text => message.success(text),
  onWarning: text => message.warning(text),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})

watch(groupTableEl, (el) => {
  if (!el) {
    setGroupTableAdapter(null)
    return
  }
  setGroupTableAdapter({
    $el: el.$el,
    doLayout: () => {},
    clearSelection: () => {
      selectedGroupIds.value = []
    },
    toggleRowSelection: (row, selected) => {
      const key = row.key ?? row.id
      const current = new Set(selectedGroupIds.value)
      if (selected) current.add(key)
      else current.delete(key)
      selectedGroupIds.value = [...current]
    },
  })
}, { immediate: true })

watch(
  () => overlay.bookGroupVisible,
  async (visible) => {
    if (!visible) return
    const operation = operations.begin('open-book-groups')
    try {
      await Promise.all([
        bookshelf.ensureCategoriesLoaded(),
        overlay.bookGroupMode === 'manage'
          ? bookshelf.loadBookGroups({ force: true })
          : bookshelf.ensureBookGroupsLoaded(),
        bookshelf.ensureBooksLoaded({ all: true }),
      ])
    } catch (error) {
      if (!operations.canCommit(operation)) return
      message.error(readError(error, '加载分组失败'))
      return
    }
    if (!operations.canCommit(operation)) return
    await prepareOpen()
  },
)

watch(
  () => overlay.bookGroupMode,
  mode => handleModeChange(mode),
)

watch(bookGroupProjectionRevision, async (revision, previous) => {
  if (!previous || revision === previous || !overlay.bookGroupVisible || isSetMode.value) return
  await prepareOpen('manage')
  await handleOpened()
})

watch(categoryProjectionRevision, async (revision, previous) => {
  if (!previous || revision === previous || !overlay.bookGroupVisible || !isSetMode.value) return
  handleSelectionChange([])
  await nextTick()
  selectedGroupIds.value = []
  await handleOpened()
})

watch(isNormalPage, (normal) => {
  if (normal || !overlay.bookGroupVisible) return
  overlay.bookGroupVisible = false
})

onBeforeUnmount(destroySortable)

function handleClosed() {
  destroySortable()
  overlay.bookGroupMode = 'manage'
}

function readError(error, fallback) {
  return error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    fallback
}
</script>

<style scoped>
.book-group-dialog-body {
  min-width: 0;
}

.group-name-cell {
  display: inline-flex;
  min-width: 0;
  align-items: center;
}

.group-drag-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  margin-right: 5px;
  cursor: move;
  user-select: none;
}

.group-name-cell > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-footer {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-height: 32px;
}

/* manage mode hides the checkbox column that only exists for set-book groups */
.book-group-table.hide-select :deep(th:first-child),
.book-group-table.hide-select :deep(td:first-child) {
  display: none;
}
</style>

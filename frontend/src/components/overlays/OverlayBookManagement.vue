<template>
  <v-dialog
    v-if="isNormalPage"
    v-model="overlay.bookManageVisible"
    width="min(1000px, max(750px, 70vw))"
    :fullscreen="isMobile"
    class="global-book-manage-dialog"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <span class="book-manage-title">
          <h2 class="app-dialog-title">书架管理</h2>
          <span class="book-manage-cache-tip">❗️只能缓存文本内容</span>
        </span>
      </header>

      <div class="app-dialog-body">
        <section class="book-manage-dialog-body">
          <BookManagementToolbar v-model="manageKeyword" />
          <BookManagementTable
            ref="bookTableRef"
            :books="filteredManagedBooks"
            :is-mobile="isMobile"
            :is-caching-book="isCachingBook"
            :category-name="categoryName"
            :server-cache-count="serverCacheCount"
            :local-cache-count="localCacheCount"
            @selection-change="onManageSelectionChange"
            @open-info="overlay.openBookInfo"
            @open-edit="overlay.openBookEdit"
            @set-group="setBookGroup"
            @cache="cacheBook"
            @export="exportBook"
          />
        </section>
      </div>

      <footer class="app-dialog-actions">
        <BookManagementBatchFooter
          :categories="bookshelf.categories"
          :selected-count="selectedBookIds.length"
          :busy="batchBusy"
          @delete-selected="batchDeleteBooks"
          @add-category="batchAddCategory"
          @remove-category="batchRemoveCategory"
          @close="overlay.bookManageVisible = false"
        />
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { confirm, message } from '../../composables/useAppFeedback.js'
import { cacheBookContent, cacheBookContentStream, listChapters } from '../../api/books'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useOverlayBookCacheState } from '../../composables/useOverlayBookCacheState'
import { useOverlayBookManagement } from '../../composables/useOverlayBookManagement'
import { useBookshelfStore } from '../../stores/bookshelf'
import { useOverlayStore } from '../../stores/overlay'
import { useReaderStore } from '../../stores/reader'
import {
  cacheBookChaptersToBrowser,
  clearBookBrowserChapterCache,
  countBooksBrowserCachedChapters,
} from '../../utils/bookChapterCache'
import { bookCategoryIds } from '../../utils/bookCategory'
import BookManagementBatchFooter from './BookManagementBatchFooter.vue'
import BookManagementTable from './BookManagementTable.vue'
import BookManagementToolbar from './BookManagementToolbar.vue'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const bookshelf = useBookshelfStore()
const overlay = useOverlayStore()
const reader = useReaderStore()
const operations = useAuthenticatedOperationGuard()
const manageKeyword = ref('')
const bookTableRef = ref(null)
const managedBooks = computed(() => bookshelf.books)
const isNormalPage = computed(() => reader.pageType === 'normal')
const filteredManagedBooks = computed(() => {
  const q = manageKeyword.value.trim().toLowerCase()
  if (!q) return managedBooks.value
  return managedBooks.value.filter(book => (
    String(book.title || '').toLowerCase().includes(q) ||
    String(book.author || '').toLowerCase().includes(q)
  ))
})

const {
  refreshManagedBrowserCacheCounts,
  localCacheCount,
  serverCacheCount,
  updateServerCacheCount,
} = useOverlayBookCacheState({
  operationGuard: operations,
  overlay,
  bookshelf,
  getManagedBooks: () => managedBooks.value,
  countBrowserCachedChapters: countBooksBrowserCachedChapters,
})

const {
  selectedBookIds,
  batchBusy,
  isCachingBook,
  onManageSelectionChange,
  clearManagedSelection,
  pruneManagedSelection,
  batchAddCategory,
  batchRemoveCategory,
  batchDeleteBooks,
  cacheBook,
  exportBook,
} = useOverlayBookManagement({
  operationGuard: operations,
  bookshelf,
  getManagedBooks: () => managedBooks.value,
  cacheBookContent,
  cacheBookContentStream,
  listChapters,
  cacheBrowserChapters: cacheBookChaptersToBrowser,
  clearBrowserChapterCache: clearBookBrowserChapterCache,
  updateServerCacheCount,
  refreshManagedBrowserCacheCounts,
  reloadManagedBooks: () => reloadManagedBooks(),
  saveBlob: downloadBlob,
  confirm: (text, title, config = {}) =>
    confirm({ message: text, title, tone: config.type === 'warning' ? 'warning' : 'primary' }).then(action => {
      if (action !== 'confirm') return Promise.reject('cancel')
    }),
  now: () => Date.now(),
  onSuccess: text => message.success(text),
  onInfo: text => message.info(text),
  onValidationError: text => message.error(text),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})

watch(
  () => overlay.bookManageVisible,
  async (visible) => {
    if (!visible) {
      clearManagedSelection()
      await nextTick()
      bookTableRef.value?.clearSelection()
      return
    }
    await reloadManagedBooks({ categories: true })
  },
)

watch(isNormalPage, (normal) => {
  if (normal || !overlay.bookManageVisible) return
  overlay.bookManageVisible = false
})

watch(
  () => managedBooks.value.map(book => Number(book.id)),
  bookIds => pruneManagedSelection(bookIds),
  { flush: 'sync' },
)

async function reloadManagedBooks({ categories = false } = {}) {
  const operation = operations.begin('load-book-manager')
  const [categoryResult, booksResult] = await Promise.allSettled([
    categories ? bookshelf.ensureCategoriesLoaded() : Promise.resolve(),
    bookshelf.loadBooks({ force: true, all: true }),
  ])
  if (!operations.canCommit(operation)) return false
  if (booksResult.status === 'rejected') {
    message.error(readError(booksResult.reason, '获取书架信息失败'))
    return false
  }
  if (categoryResult.status === 'rejected') {
    message.warning(
      readError(categoryResult.reason, '分组加载失败，书架管理仍可使用'),
    )
  }
  await refreshManagedBrowserCacheCounts()
  return operations.canCommit(operation)
}

function categoryName(book) {
  const names = bookCategoryIds(book)
    .map(id => bookshelf.categories.find(category => Number(category.id) === id)?.name)
    .filter(Boolean)
  return names.join(' ')
}

function setBookGroup(book) {
  overlay.openBookGroup('set', book)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function readError(error, fallback) {
  return error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    fallback
}
</script>

<style scoped>
.book-manage-dialog-body {
  min-width: 0;
}

.book-manage-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
  padding-right: 32px;
}

.book-manage-cache-tip {
  margin-right: 10px;
  color: var(--app-text-muted);
  font-size: 14px;
  font-weight: 400;
}
</style>

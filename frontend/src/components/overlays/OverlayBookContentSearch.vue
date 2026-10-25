<template>
  <v-dialog
    v-if="isNormalPage"
    v-model="overlay.searchBookContentVisible"
    width="min(1000px, max(750px, 70vw))"
    :fullscreen="isMobile"
    class="global-content-search-dialog"
    @after-enter="handleOpened"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <v-text-field
          v-model="keyword"
          class="content-search-title-input"
          density="compact"
          variant="outlined"
          :prepend-inner-icon="mdiMagnify"
          placeholder="搜索书籍内容"
          hide-details
          @keyup.enter="search"
        />
      </header>

      <div class="app-dialog-body reader-dialog-table">
        <v-data-table
          ref="resultTableRef"
          :headers="resultHeaders"
          :items="results"
          density="compact"
          no-data-text="暂无数据"
          :height="isMobile ? 'calc(100dvh - 184px)' : 'min(400px, calc(70dvh - 184px))'"
          @click:row="(_, { item }) => jumpToResult(item)"
        />
        <v-alert
          v-if="searchNotice"
          class="reader-search-notice"
          type="warning"
          variant="tonal"
          density="compact"
        >
          {{ searchNotice }}
        </v-alert>
      </div>

      <footer class="app-dialog-actions">
        <div class="reader-dialog-footer">
          <div class="reader-dialog-footer-left">
            <v-btn color="primary" :disabled="loading" @click="loadMore">
              {{ loading ? '加载中' : '加载更多' }}
            </v-btn>
            <v-btn v-if="!isMobile && hasMore" variant="outlined" :disabled="loading" @click="loadAll">搜完全书</v-btn>
            <v-btn v-if="lastScrollTop > 0" color="primary" @click="restoreScrollTop">跳转上次位置</v-btn>
          </div>
          <v-btn variant="text" @click="overlay.searchBookContentVisible = false">取消</v-btn>
        </div>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { mdiMagnify } from '@mdi/js'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message } from '../../composables/useAppFeedback.js'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useBookContentSearch } from '../../composables/useBookContentSearch'
import { useOverlayStore } from '../../stores/overlay'
import { useReaderStore } from '../../stores/reader'
import { bookContentSearchBookIdentity } from '../../utils/readerBookSearch'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const overlay = useOverlayStore()
const reader = useReaderStore()
const operations = useAuthenticatedOperationGuard()
const resultTableRef = ref(null)
const lastScrollTop = ref(0)
const book = computed(() => overlay.searchBook)
const bookId = computed(() => overlay.searchBook?.id)
const isNormalPage = computed(() => reader.pageType === 'normal')
const activeBookKey = ref('')
const resultHeaders = [
  { title: '章节', key: 'chapterTitle', width: '30%' },
  { title: '搜索结果', key: 'resultText' },
]

const {
  keyword,
  results,
  loading,
  hasMore,
  incomplete,
  unavailableChapters,
  truncated,
  notice: searchNotice,
  cancel,
  reset,
  search,
  loadMore,
  loadAll,
} = useBookContentSearch({
  operationGuard: operations,
  bookId,
  book,
  chapters: [],
  onError: error => message.error(readError(error, '搜索正文失败')),
})

watch(
  () => bookContentSearchBookIdentity(overlay.searchBook),
  (key) => {
    if (key === activeBookKey.value) return
    activeBookKey.value = key
    resetSearch()
  },
)

watch(
  () => overlay.searchBookContentVisible,
  (visible) => {
    if (!visible) {
      cancel()
      return
    }
    const key = bookContentSearchBookIdentity(overlay.searchBook)
    if (!key || key === activeBookKey.value) return
    activeBookKey.value = key
    resetSearch()
  },
)

watch(isNormalPage, (normal) => {
  if (normal || !overlay.searchBookContentVisible) return
  overlay.searchBookContentVisible = false
  resetSearch()
})

onBeforeUnmount(cancel)

function resetSearch() {
  keyword.value = ''
  lastScrollTop.value = 0
  reset()
}

function jumpToResult(result) {
  captureScrollTop()
  overlay.requestSearchBookContentJump(result, keyword.value)
}

function getResultScrollElement() {
  return resultTableRef.value?.$el?.querySelector('.v-table__wrapper') || null
}

function captureScrollTop() {
  lastScrollTop.value = Math.max(0, getResultScrollElement()?.scrollTop || 0)
}

function restoreScrollTop() {
  nextTick(() => {
    const scrollEl = getResultScrollElement()
    if (scrollEl) scrollEl.scrollTop = lastScrollTop.value
  })
}

function handleOpened() {
  restoreScrollTop()
}

function readError(error, fallback) {
  return error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    fallback
}
</script>

<style scoped>
.reader-dialog-table {
  position: relative;
}

.reader-dialog-footer {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reader-dialog-footer-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reader-search-notice {
  position: absolute;
  right: 8px;
  bottom: 8px;
  left: 8px;
  z-index: 2;
}

.content-search-title-input {
  display: inline-block;
  width: 75%;
  margin: 0 auto;
  transform: translateX(20%);
}

@media (max-width: 750px) {
  .reader-dialog-footer-left {
    min-width: 0;
  }
}
</style>

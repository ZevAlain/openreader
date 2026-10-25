<template>
  <section class="app-page shelf-page result-shelf-page search-page">
    <div class="shelf-title">
      <div class="shelf-title-main">
        <strong>搜索</strong>
      </div>
      <div class="title-actions" />
    </div>

    <div v-if="mobileGroupChips.length" class="search-group-chips" role="tablist" aria-label="书源分组">
      <button
        v-for="chip in mobileGroupChips"
        :key="chip.key"
        class="group-chip search-group-chip"
        :class="{ active: activeGroupKey === chip.key }"
        type="button"
        @click="applyMobileGroupChip(chip.key)"
      >{{ chip.label }}</button>
    </div>

    <div v-if="streamingMore && searched" class="search-stream-status" role="status">
      <span>已找到 {{ results.length }} 条，仍在搜索其他书源…</span>
      <button class="search-stream-stop" type="button" @click="stopSearchStream">停止</button>
    </div>

    <div class="search-entry-bar">
      <v-text-field
        v-model="keyword"
        class="search-entry-field"
        placeholder="搜索书籍 / 作者"
        clearable
        density="compact"
        variant="outlined"
        hide-details
        :disabled="searchMode !== 'remote'"
        @keyup.enter="doSearch"
      />
      <button
        class="search-mode-toggle"
        type="button"
        :title="matchMode === 'strict' ? '严格匹配：书名必须完全一致' : '宽松匹配：书名包含关键词即可'"
        @click="toggleMatchMode"
      >{{ matchMode === 'strict' ? '严格' : '宽松' }}</button>
      <button
        class="search-concurrent-toggle"
        type="button"
        title="同时搜索的书源数量"
        @click="openConcurrentPicker"
      >{{ concurrentCount }}线程</button>
      <v-btn
        color="primary"
        class="search-entry-go"
        :loading="searchStarting || searching"
        :disabled="searchMode === 'remote' && !keyword.trim()"
        @click="doSearch"
      >搜索</v-btn>
    </div>

    <v-dialog
      v-model="concurrentPickerVisible"
      width="min(360px, calc(100vw - 48px))"
    >
      <div class="app-dialog-card">
        <header class="app-dialog-head">
          <h2 class="app-dialog-title">搜索线程数</h2>
        </header>
        <div class="app-dialog-body">
          <p class="search-concurrent-hint">多源搜索时同时请求的书源数量。线程越多出结果越快，但也更容易被书站限流。</p>
          <div class="search-concurrent-options">
            <button
              v-for="count in concurrentOptions"
              :key="count"
              class="search-concurrent-option"
              :class="{ active: count === concurrentCount }"
              type="button"
              @click="applyConcurrentCount(count)"
            >{{ count }}</button>
          </div>
        </div>
      </div>
    </v-dialog>

    <section v-if="showRecentSearches && recentSearches.length" class="search-rank-board" aria-label="最近搜索">
      <div class="search-rank-header">
        <span class="search-rank-title">最近搜索</span>
        <button class="search-stream-stop" type="button" @click="clearRecentSearches">清除</button>
      </div>
      <ol class="search-rank-list">
        <li v-for="term in recentSearches" :key="term">
          <button class="search-rank-item" type="button" @click="searchRecent(term)">
            <span class="search-rank-info">
              <strong>{{ term }}</strong>
            </span>
            <v-icon :icon="mdiMagnify" />
          </button>
        </li>
      </ol>
    </section>

    <section v-if="showRankBoard" class="search-rank-board" aria-label="热门榜单">
      <div class="search-rank-header">
        <span class="search-rank-title">热门榜单</span>
        <span class="search-rank-sub">24 小时畅销 · 点击搜索本书</span>
      </div>
      <p v-if="hotRankError && !hotRankItems.length" class="search-rank-empty">
        {{ hotRankError }}
      </p>
      <ol v-else class="search-rank-list" :class="{ loading: hotRankLoading }">
        <li v-for="item in hotRankItems" :key="item.bookId || item.rank">
          <button class="search-rank-item" type="button" @click="searchHotTitle(item.title)">
            <span class="search-rank-no" :class="{ top: item.rank <= 3 }">{{ item.rank }}</span>
            <span class="search-rank-info">
              <strong>{{ item.title }}</strong>
              <small>{{ item.author || '—' }}</small>
            </span>
            <v-icon :icon="mdiMagnify" />
          </button>
        </li>
      </ol>
    </section>

    <main class="shelf-main">
      <div ref="resultArea" class="books-wrapper">
        <div v-if="searchFailed" class="search-failed-card">
          <p>所有书源搜索失败，通常是书源站点不可达或网络受限。</p>
          <p class="search-failed-hint">可尝试：更换书源、稍后重试，或在「我的 → 书源管理」中检查失效书源。</p>
        </div>
        <RemoteBookResultList
          v-if="!searchFailed && searchMode === 'remote'"
          :books="results"
          :adding-book-key="addingRemoteBookKey"
          :is-night="reader.themeType === 'night'"
          @preview="openPreview"
          @read="openRemoteReader"
          @add="addResultToShelf"
          @edit="openResultEditor"
        />

        <button
          v-if="searchMode === 'remote' && searched && remoteHasMore && !streamingMore"
          class="search-load-more"
          type="button"
          :disabled="searching || loadingMore"
          @click="loadMoreRemote"
        >{{ remoteSearchActionLabel }}</button>

        <div v-else-if="shownLocalResults.length" class="local-result-list">
          <article
            v-for="item in shownLocalResults"
            :key="localResultKey(item)"
            class="local-result-card app-panel"
          >
            <v-icon class="local-file-icon" :icon="mdiFileDocumentOutline" />
            <div class="result-main">
              <div class="result-title">
                <h3>{{ localBookTitle(item) }}</h3>
                <v-chip size="x-small" :color="item.book ? 'success' : 'primary'" variant="tonal">{{ item.book ? '已在书架' : (item.extension || '文件') }}</v-chip>
              </div>
              <p>{{ localBookSubline(item) }}</p>
              <p class="latest-chapter">{{ localBookMeta(item) }}</p>
            </div>
            <div class="result-actions" @click.stop>
              <template v-if="item.book">
                <v-btn color="primary" size="small" @click="readLocalShelfBook(item.book)">阅读</v-btn>
                <v-btn variant="outlined" size="small" @click="openLocalShelfDetail(item.book)">详情</v-btn>
              </template>
              <v-btn v-else color="primary" size="small" :loading="importingLocal" @click="importLocalOne(item)">导入书架</v-btn>
            </div>
          </article>
        </div>

        <p v-else-if="searched && !searching" class="search-empty-tip">没有找到本地书籍文件</p>
        <p v-else-if="searchMode === 'local'" class="search-empty-tip">输入关键词搜索本地书仓，或直接搜索显示全部可导入文件</p>
      </div>
    </main>

    <RemoteBookJsonEditorDialog
      :visible="resultEditorVisible"
      :content="resultEditorContent"
      :saving="resultEditorSaving"
      :is-mobile="isMobileResult"
      @update:content="resultEditorContent = $event"
      @close="closeResultEditor"
      @save="saveResultEditor"
    />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { confirm, message } from '../composables/useAppFeedback.js'
import { mdiFileDocumentOutline, mdiMagnify } from '@mdi/js'
import { createRemoteReaderSession } from '../api/remoteReader'
import { createRemoteBook } from '../api/books'
import { importFromLocalStore, listLocalStore } from '../api/localStore'
import api from '../api/client'
import RemoteBookResultList from '../components/RemoteBookResultList.vue'
import RemoteBookJsonEditorDialog from '../components/RemoteBookJsonEditorDialog.vue'
import { useRemoteBookAddToShelf } from '../composables/useRemoteBookAddToShelf'
import { useRemoteBookResultEditor } from '../composables/useRemoteBookResultEditor'
import { useBookshelfStore } from '../stores/bookshelf'
import { useOverlayStore } from '../stores/overlay'
import { useUserStore } from '../stores/user'
import { getHotRank } from '../api/hotRank'
import { useReaderStore } from '../stores/reader'
import { usePreferencesStore } from '../stores/preferences'
import { useIndexWorkspaceStore } from '../stores/indexWorkspace'
import { newestBookProgress } from '../utils/bookOrder'
import { isLocalBook, localBookSearchText, normalizeLocalBookSearch } from '../utils/localBook'
import { readerRouteQueryFromBook } from '../utils/readerRoute'
import { createAuthenticatedOperationGuard } from '../utils/authenticatedOperation'
import {
  DEFAULT_SEARCH,
  SEARCH_CONCURRENT_OPTIONS,
  normalizeSearchConcurrent,
} from '../utils/searchPreference.js'
import {
  remoteBookCreatePayload,
  remoteBookKey,
  remoteBookReaderPayload,
  remoteBookSourceId,
  remoteBookSourceName,
} from '../utils/remoteBookResult'
import {
  captureWorkspaceRequest,
  createAsyncRequestGate,
  isWorkspaceRequestCurrent,
  mergeRemoteSearchResults,
} from '../utils/workspaceContinuation.js'
import { currentViewportWidth, shouldUseMiniInterface } from '../utils/responsive.js'

const router = useRouter()
const bookshelf = useBookshelfStore()
const overlay = useOverlayStore()
const user = useUserStore()
const reader = useReaderStore()
const preferences = usePreferencesStore()
const workspace = useIndexWorkspaceStore()

const keyword = ref('')
const STRICT_SEARCH_KEY = 'searchMatchMode'
const matchMode = ref((() => {
  try {
    return localStorage.getItem(STRICT_SEARCH_KEY) === 'strict' ? 'strict' : 'loose'
  } catch {
    return 'loose'
  }
})())

function toggleMatchMode() {
  matchMode.value = matchMode.value === 'strict' ? 'loose' : 'strict'
  try {
    localStorage.setItem(STRICT_SEARCH_KEY, matchMode.value)
  } catch {
    // Preference stays session-only when storage is blocked.
  }
  if (searched.value && keyword.value.trim()) doSearch()
}
const lastSearchStats = ref({ attempted: 0, failed: 0 })
const searchFailed = ref(false)
const streamingMore = ref(false)
// Bumped by every new doSearch so an in-flight stream can tell it was
// superseded (the gate token is rotated by each streaming window itself).
let searchStreamSerial = 0

function finishSearchFeedback(added) {
  const stats = lastSearchStats.value
  if (added) {
    if (stats.failed) message.success(`共找到 ${results.value.length} 条结果（${stats.failed} 个书源失败）`)
    else message.success(`共找到 ${results.value.length} 条结果`)
  } else if (stats.failed && stats.attempted && stats.failed >= stats.attempted) {
    message.error(`${stats.failed} 个书源全部搜索失败，请检查网络或书源可用性`)
    searchFailed.value = true
  } else {
    message.info('没有找到相关书籍')
  }
}

let searchStreamAbort = null

function stopSearchStream() {
  // Supersede the stream and abort the live SSE connection so late server
  // events cannot mutate the list the user just stopped on.
  searchStreamSerial += 1
  remoteRequestGate.invalidate()
  if (searchStreamAbort) {
    searchStreamAbort.abort()
    searchStreamAbort = null
  }
  streamingMore.value = false
  loadingMore.value = false
  remoteHasMore.value = false
  workspace.setResultLoading(false)
  message.info(`已停止搜索，保留当前 ${results.value.length} 条结果`)
}

// One SSE connection sweeps every source; each event is a single source's
// answer, so results paint at the speed of the fastest source instead of
// waiting for whole batches.
async function runSearchStreamSSE(serial, requestToken, workspaceStamp) {
  streamingMore.value = true
  workspace.setResultLoading(true)
  const controller = new AbortController()
  searchStreamAbort = controller
  try {
    const token = localStorage.getItem('openreader_token')
    const response = await fetch('/api/search/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        keyword: activeSearchKeyword.value,
        sourceIds: activeSourceIds.value,
        concurrentCount: activeConcurrentCount.value,
      }),
      signal: controller.signal,
    })
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '')
      let message_ = `搜索失败 (HTTP ${response.status})`
      try {
        const parsed = JSON.parse(detail)
        message_ = parsed?.error || message_
      } catch { /* keep the HTTP fallback */ }
      throw new Error(message_)
    }
    searched.value = true
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let streamDone = false
    while (!streamDone) {
      if (serial !== searchStreamSerial) return
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let frameEnd
      while ((frameEnd = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, frameEnd)
        buffer = buffer.slice(frameEnd + 2)
        const dataLine = frame.split('\n').find(line => line.startsWith('data: '))
        if (!dataLine) continue
        let event
        try {
          event = JSON.parse(dataLine.slice(6))
        } catch {
          continue
        }
        if (!isActiveRemoteRequest(requestToken, workspaceStamp)) return
        lastSearchStats.value.attempted = Number(event.attempted || 0)
        lastSearchStats.value.failed = Number(event.failed || 0)
        if (Array.isArray(event.list) && event.list.length) {
          applyRemoteRows(event.list, true)
        }
        if (event.done) streamDone = true
      }
    }
    remoteHasMore.value = false
    if (isActiveRemoteRequest(requestToken, workspaceStamp)) {
      finishSearchFeedback(results.value.length > 0)
    }
  } catch (err) {
    if (err?.name === 'AbortError') return
    if (serial === searchStreamSerial && isActiveRemoteRequest(requestToken, workspaceStamp)) {
      message.error(err?.message || readError(err, '搜索失败'))
    }
  } finally {
    if (serial === searchStreamSerial) {
      streamingMore.value = false
      workspace.setResultLoading(false)
    }
    if (searchStreamAbort === controller) searchStreamAbort = null
  }
}
// The hot-rank board is temporarily retired from the UI; flip this flag to
// bring it back (all rendering, loading, and tap-to-search code is kept).
const HOT_RANK_ENABLED = false

const hotRankItems = ref([])
const hotRankLoading = ref(false)
const hotRankError = ref('')
const showRankBoard = computed(() => (
  HOT_RANK_ENABLED
  && searchMode.value === 'remote' && !searched.value && !results.value.length && !searchStarting.value
))

async function loadHotRank() {
  if (!HOT_RANK_ENABLED) return
  hotRankLoading.value = true
  hotRankError.value = ''
  try {
    const { data } = await getHotRank()
    hotRankItems.value = Array.isArray(data?.items) ? data.items : []
  } catch {
    hotRankItems.value = []
    hotRankError.value = '热门榜单暂时不可用（服务器访问外网受限），可稍后再试。'
  } finally {
    hotRankLoading.value = false
  }
}

const RECENT_SEARCH_LIMIT = 8
const concurrentPickerVisible = ref(false)
const concurrentOptions = SEARCH_CONCURRENT_OPTIONS

function openConcurrentPicker() {
  concurrentPickerVisible.value = true
}

function applyConcurrentCount(count) {
  concurrentCount.value = count
  concurrentPickerVisible.value = false
  saveSearchPreference()
}

const recentSearches = ref([])
const showRecentSearches = computed(() => (
  !HOT_RANK_ENABLED
  && searchMode.value === 'remote' && !searched.value && !results.value.length && !searchStarting.value
))

function recentSearchScope() {
  return user.profile?.username || user.profile?.id || 'user'
}

function loadRecentSearches() {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${recentSearchScope()}@recentSearches`) || '[]')
    recentSearches.value = Array.isArray(parsed)
      ? [...new Set(parsed.map(item => String(item || '').trim()).filter(Boolean))].slice(0, RECENT_SEARCH_LIMIT)
      : []
  } catch {
    recentSearches.value = []
  }
}

function rememberRecentSearch(term) {
  const value = String(term || '').trim()
  if (!value) return
  const next = [value, ...recentSearches.value.filter(item => item !== value)].slice(0, RECENT_SEARCH_LIMIT)
  recentSearches.value = next
  try {
    localStorage.setItem(`${recentSearchScope()}@recentSearches`, JSON.stringify(next))
  } catch {
    // A blocked storage backend must not break the search flow.
  }
}

function clearRecentSearches() {
  recentSearches.value = []
  try {
    localStorage.removeItem(`${recentSearchScope()}@recentSearches`)
  } catch {
    // Ignore storage failures.
  }
}

function searchRecent(term) {
  keyword.value = term
  doSearch()
}

function searchHotTitle(title) {
  keyword.value = title
  doSearch()
}


const searchMode = ref('remote')
const sources = ref([])
const mobileGroupChips = computed(() => {
  const counts = new Map()
  for (const source of enabledSources.value) {
    const key = String(source.group || '').trim()
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [
    { key: '', label: '全部' },
    ...[...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key, count]) => ({ key, label: `${key} ${count}` })),
  ]
})

const activeGroupKey = computed(() => (searchType.value === 'group' ? selectedGroup.value : ''))

function applyMobileGroupChip(key) {
  if (!key) {
    searchType.value = 'all'
    selectedGroup.value = ''
  } else {
    searchType.value = 'group'
    selectedGroup.value = key
  }
  syncSelection()
  saveSearchPreference()
  if (keyword.value.trim()) doSearch()
}
const selectedIds = ref([])
const selectedGroup = ref(preferences.search.group)
const singleSourceId = ref(Number(preferences.search.sourceId || 0) || null)
const targetCategoryIds = ref([])
const searchType = ref(preferences.search.searchType)
const concurrentCount = ref(normalizeSearchConcurrent(preferences.search.concurrent))
const results = ref([])
const searching = ref(false)
const loadingMore = ref(false)
const searched = ref(false)
const searchStarting = ref(false)
const searchPage = ref(1)
const searchLastIndex = ref(-1)
const remoteHasMore = ref(false)
const activeSearchKeyword = ref('')
const activeSourceIds = ref([])
const activeConcurrentCount = ref(1)
const activeSearchIsSingleSource = ref(false)
const resultArea = ref(null)
const resultWindowWidth = ref(currentViewportWidth())
const remoteRequestGate = createAsyncRequestGate()
const searchSessionOperations = createAuthenticatedOperationGuard()
const resultAddToShelf = useRemoteBookAddToShelf({
  operationGuard: searchSessionOperations,
  selectCategories: initialCategoryIds => overlay.selectBookAddCategories(initialCategoryIds),
  buildPayload: (book, categoryIds, context) => remoteBookCreatePayload(book, categoryIds, context),
  createRemoteBook,
  upsertBook: book => bookshelf.upsertBook(book),
  onSuccess: message => message.success(message),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})
const addingRemoteBookKey = resultAddToShelf.addingBookKey
const resultEditor = useRemoteBookResultEditor({
  operationGuard: searchSessionOperations,
  confirm: (text, title, config = {}) =>
    confirm({ message: text, title, tone: config.type === 'warning' ? 'warning' : 'primary' }).then(action => {
      if (action !== 'confirm') return Promise.reject('cancel')
    }),
  createRemoteBook,
  upsertBook: book => bookshelf.upsertBook(book),
  onSuccess: message => message.success(message),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})
const {
  visible: resultEditorVisible,
  content: resultEditorContent,
  saving: resultEditorSaving,
} = resultEditor
const localItems = ref([])
const localRecursiveScan = ref(true)
const importingLocal = ref(false)
const workspaceSearchReady = ref(false)

const enabledSources = computed(() => sources.value.filter(source => source.enabled))
const isMobileResult = computed(() => shouldUseMiniInterface(reader.pageMode, resultWindowWidth.value))
const remoteSearchActionLabel = computed(() => {
  if (searchStarting.value || searching.value || loadingMore.value) return '加载中...'
  if (searched.value && !remoteHasMore.value) return '没有更多了'
  return '加载更多'
})

const localShelfBooks = computed(() => (bookshelf.books || []).filter(isLocalBook))
const shownLocalResults = computed(() => {
  if (!searched.value || searchMode.value !== 'local') return []
  const value = normalizeLocalSearch(keyword.value)
  const shelfResults = localShelfBooks.value
    .filter(book => !value || localShelfSearchText(book).includes(value))
    .map(book => ({
      type: 'shelf',
      book,
      name: book.title,
      path: book.originalFile || book.libraryPath || book.url || '',
      extension: fileExtension(book.originalFile || book.libraryPath || book.title),
      importable: false,
    }))
  const storeResults = localItems.value
    .filter(item => {
      if (!item.importable) return false
      if (!value) return true
      return localFileSearchText(item).includes(value)
    })
    .map(item => ({ ...item, type: 'file' }))
  return [...shelfResults, ...storeResults]
})
onMounted(async () => {
  updateResultViewport()
  window.addEventListener('resize', updateResultViewport)
  window.addEventListener('orientationchange', updateResultViewport)
  loadHotRank()
  loadRecentSearches()
  const mountOperation = searchSessionOperations.begin('mount')
  applyWorkspaceSearchIntent()
  const shelfReady = await warmSearchShelf()
  if (!shelfReady || !searchSessionOperations.canCommit(mountOperation)) return
  if (searchMode.value === 'remote') {
    try {
      const sourcesReady = await loadSources()
      if (!sourcesReady || !searchSessionOperations.canCommit(mountOperation)) return
    } catch (err) {
      if (!searchSessionOperations.canCommit(mountOperation)) return
      message.warning(readError(err, '加载书源失败'))
    }
  } else {
    loadSources().catch(() => {})
  }
  if (!searchSessionOperations.canCommit(mountOperation)) return
  syncSelection()
  workspaceSearchReady.value = true
  // A resumed session (tab round-trip) already carries its keyword in the
  // store; apply it before the mount-time search check or the restored
  // search never re-runs.
  applyWorkspaceSearchIntent()
  if (keyword.value || searchMode.value === 'local') doSearch()
})

onBeforeUnmount(() => {
  // Leaving the workspace suspends the session (Home's route watcher runs
  // before unmount); enrich it with the live keyword so returning restores
  // and re-runs the exact search instead of dropping back to the rank board.
  if (workspace.suspendedSession?.mode === 'search') {
    workspace.suspendedSession.search = {
      ...workspace.suspendedSession.search,
      keyword: keyword.value,
      searchType: searchType.value,
      group: selectedGroup.value,
      sourceId: singleSourceId.value != null ? String(singleSourceId.value) : '',
      concurrent: concurrentCount.value,
    }
  }
  window.removeEventListener('resize', updateResultViewport)
  window.removeEventListener('orientationchange', updateResultViewport)
  remoteRequestGate.invalidate()
  resultEditor.reset()
  searchSessionOperations.reset()
})

async function warmSearchShelf() {
  const operation = searchSessionOperations.begin('warm-shelf')
  const jobs = [
    ['categories', bookshelf.ensureCategoriesLoaded()],
    ['books', bookshelf.ensureBooksLoaded({ all: true })],
  ]
  const results = await Promise.allSettled(jobs.map(([, job]) => job))
  if (!searchSessionOperations.canCommit(operation)) return false
  results.forEach((result, index) => {
    if (result.status !== 'rejected') return
    const type = jobs[index][0]
    if (type === 'books') {
      message.warning(readError(result.reason, '加载书架失败，部分已入架状态可能暂不可用'))
    } else {
      message.warning(readError(result.reason, '分组加载失败，部分筛选状态可能暂不可用'))
    }
  })
  return true
}

watch(searchType, () => {
  syncSelection()
  saveSearchPreference()
})
watch([selectedGroup, singleSourceId, concurrentCount], saveSearchPreference)
watch(
  () => [workspace.mode, workspace.searchRevision],
  () => {
    if (workspace.mode !== 'search') return
    applyWorkspaceSearchIntent()
    if (!workspaceSearchReady.value) return
    if (keyword.value || searchMode.value === 'local') doSearch()
  },
)

async function loadSources() {
  const operation = searchSessionOperations.begin('sources')
  try {
    const { data } = await api.get('/sources')
    if (!searchSessionOperations.canCommit(operation)) return false
    sources.value = data
    if (!singleSourceId.value && enabledSources.value.length) singleSourceId.value = enabledSources.value[0].id
    return true
  } catch (error) {
    if (!searchSessionOperations.canCommit(operation)) return false
    throw error
  }
}

function syncSelection() {
  if (searchType.value === 'all') {
    selectedIds.value = enabledSources.value.map(source => source.id)
  } else if (searchType.value === 'group') {
    selectedIds.value = enabledSources.value
      .filter(source => (source.group || '默认分组') === selectedGroup.value)
      .map(source => source.id)
  } else if (searchType.value === 'single') {
    selectedIds.value = singleSourceId.value ? [singleSourceId.value] : []
  }
}

function saveSearchPreference() {
  if (searchType.value === 'custom') return
  preferences.setSearchConfig({
    searchType: searchType.value,
    group: selectedGroup.value,
    sourceId: singleSourceId.value || '',
    concurrent: concurrentCount.value,
  })
}

async function doSearch() {
  if (searchMode.value === 'local') {
    remoteRequestGate.invalidate()
    await searchLocalBooks()
    return
  }
  searchSessionOperations.invalidate('local-search')
  const value = keyword.value.trim()
  if (!value) {
    searchStarting.value = false
    searching.value = false
    return
  }
  if (!selectedIds.value.length) {
    searchStarting.value = false
    searching.value = false
    message.warning('未配置书源')
    return
  }
  workspace.setResultLoading(true)
  searching.value = true
  searchStarting.value = false
  searched.value = false
  searchFailed.value = false
  results.value = []
  resetRemotePagination()
  lastSearchStats.value = { attempted: 0, failed: 0 }
  searchStreamSerial += 1
  streamingMore.value = false
  const requestToken = remoteRequestGate.begin()
  const workspaceStamp = captureWorkspaceRequest(workspace, 'search')
  activeSearchKeyword.value = value
  rememberRecentSearch(value)
  activeSourceIds.value = [...selectedIds.value]
  activeConcurrentCount.value = searchType.value === 'single' ? 1 : concurrentCount.value
  activeSearchIsSingleSource.value = activeSourceIds.value.length === 1
  try {
    if (!activeSearchIsSingleSource.value) {
      // The whole multi-source sweep runs over one SSE connection; each
      // source's hits render the moment that source answers.
      runSearchStreamSSE(searchStreamSerial, requestToken, workspaceStamp)
      return
    }
    const { added, current } = await requestRemoteSearch({
      append: false,
      page: 1,
      lastIndex: -1,
      requestToken,
      workspaceStamp,
    })
    if (!current) return
    searched.value = true
    finishSearchFeedback(added)
  } catch (err) {
    if (isActiveRemoteRequest(requestToken, workspaceStamp)) {
      message.error(readError(err, '搜索失败'))
    }
  } finally {
    // Clear unconditionally: the streaming continuation rotates the gate
    // token on its first window, and a stale check here would leave the
    // search button latched in its loading state after the stream ends.
    searching.value = false
    if (isActiveRemoteRequest(requestToken, workspaceStamp)) {
      workspace.setResultLoading(false)
    }
  }
}

// Returns 'busy' when another load owns the flag (the auto-stream treats
// that as abort), 'skipped' when there is nothing to do, 'done' otherwise.
async function loadMoreRemote(options = {}) {
  if (loadingMore.value) return 'busy'
  if (!remoteHasMore.value) {
    if (!options.auto) message.info('没有更多了')
    return 'skipped'
  }
  const requestToken = remoteRequestGate.begin()
  const workspaceStamp = captureWorkspaceRequest(workspace, 'search')
  const nextPage = searchPage.value + 1
  const nextLastIndex = activeSearchIsSingleSource.value ? -1 : searchLastIndex.value
  rememberResultScroll()
  loadingMore.value = true
  workspace.setResultLoading(true)
  try {
    const { added, current } = await requestRemoteSearch({
      append: true,
      page: nextPage,
      lastIndex: nextLastIndex,
      requestToken,
      workspaceStamp,
    })
    if (!current) return 'skipped'
    if (!options.auto && !added) {
      message.info(remoteHasMore.value ? '本批没有新增结果，仍可继续加载' : '没有更多了')
    }
    return 'done'
  } catch (err) {
    if (isActiveRemoteRequest(requestToken, workspaceStamp)) {
      message.error(readError(err, options.auto ? '继续搜索失败，可点击列表尾部继续' : '加载更多失败'))
    }
    return 'error'
  } finally {
    // Always clear the busy flag this call owns; a stale gate must never
    // leave loadingMore latched true or the auto-stream spins on it.
    loadingMore.value = false
    if (isActiveRemoteRequest(requestToken, workspaceStamp)) {
      workspace.setResultLoading(false)
    }
  }
}

function applyRemoteRows(incoming, append) {
  const { rows, added } = mergeRemoteSearchResults(append ? results.value : [], incoming)
  const ranked = rankSearchResults(rows, activeSearchKeyword.value)
  results.value = matchMode.value === 'strict'
    ? ranked.filter(item => String(item?.title || '').trim().toLowerCase() === String(activeSearchKeyword.value || '').trim().toLowerCase())
    : ranked
  workspace.replaceResultRows(results.value, remoteWorkspaceContinuation())
  return added
}

function isActiveRemoteRequest(requestToken, workspaceStamp) {
  return remoteRequestGate.isCurrent(requestToken)
    && isWorkspaceRequestCurrent(workspace, workspaceStamp)
}

// Exact title matches float to the top, then prefix matches, then partial
// matches, so the book the user typed surfaces above loose hits no matter
// which source window delivered it.
function rankSearchResults(rows, keyword) {
  const needle = String(keyword || '').trim().toLowerCase()
  if (!needle) return rows
  const tier = item => {
    const title = String(item?.title || '').trim().toLowerCase()
    if (title === needle) return 0
    if (title.startsWith(needle)) return 1
    if (title.includes(needle)) return 2
    return 3
  }
  return [...rows].sort((a, b) => tier(a) - tier(b))
}

function remoteSearchPayload(page, lastIndex) {
  const payload = {
    keyword: activeSearchKeyword.value,
    sourceIds: activeSourceIds.value,
    // The first window only fans out to a few sources so the first results
    // paint quickly; the auto-stream continuation uses the full concurrency.
    concurrentCount: lastIndex === -1 && !activeSearchIsSingleSource.value
      ? Math.min(activeConcurrentCount.value, 4)
      : activeConcurrentCount.value,
  }
  if (activeSearchIsSingleSource.value) {
    payload.page = page
  } else {
    payload.lastIndex = lastIndex
    payload.searchSize = 20
  }
  return payload
}

async function requestRemoteSearch({ append, page, lastIndex, requestToken, workspaceStamp }) {
  // Multi-source search fans out server-side and can legitimately run past
  // the default axios timeout (12s); give it room instead of racing it.
  const response = await api.post('/search', remoteSearchPayload(page, lastIndex), { timeout: 90000 })
  const data = response.data
  const headers = response.headers || {}
  // Streaming searches run one window per request; accumulate the stats so
  // the final summary covers every window, not just the last one.
  lastSearchStats.value.attempted += Number(data?.attempted ?? headers['x-openreader-search-attempted'] ?? 0)
  lastSearchStats.value.failed += Number(data?.failed ?? headers['x-openreader-search-failed'] ?? 0)
  if (!isActiveRemoteRequest(requestToken, workspaceStamp)) {
    return { added: 0, current: false }
  }
  const incoming = Array.isArray(data) ? data : (data?.list || [])
  const added = applyRemoteRows(incoming, append)
  if (activeSearchIsSingleSource.value) {
    searchPage.value = Number(data?.page || page)
    searchLastIndex.value = -1
  } else {
    searchPage.value = page
    searchLastIndex.value = Number.isInteger(data?.lastIndex) ? data.lastIndex : lastIndex
  }
  remoteHasMore.value = Boolean(data?.hasMore)
  workspace.replaceResultRows(results.value, remoteWorkspaceContinuation())
  return { added, current: true }
}

function resetRemotePagination() {
  searchPage.value = 1
  searchLastIndex.value = -1
  remoteHasMore.value = false
  loadingMore.value = false
  activeSearchKeyword.value = ''
  activeSourceIds.value = []
  activeConcurrentCount.value = 1
  activeSearchIsSingleSource.value = false
}

function rememberResultScroll() {
  workspace.rememberResultScroll(resultArea.value?.scrollTop || 0)
}

async function searchLocalBooks() {
  const operation = searchSessionOperations.begin('local-search')
  const workspaceStamp = captureWorkspaceRequest(workspace, 'search')
  workspace.setResultLoading(true)
  searching.value = true
  searched.value = false
  results.value = []
  try {
    const [storeResult, shelfResult] = await Promise.allSettled([
      listLocalStore('', localRecursiveScan.value),
      bookshelf.loadBooks({ all: true }),
    ])
    if (!isActiveLocalSearch(operation, workspaceStamp)) return
    if (storeResult.status === 'rejected' && shelfResult.status === 'rejected') {
      throw storeResult.reason || shelfResult.reason
    }
    localItems.value = storeResult.status === 'fulfilled' ? (storeResult.value.data.items || []) : []
    searched.value = true
    workspace.replaceResultRows(shownLocalResults.value, {
      page: 1,
      lastIndex: -1,
      hasMore: false,
    })
    if (shelfResult.status === 'rejected') {
      message.warning(`书架本地书加载失败，已仅搜索本地书仓：${readError(shelfResult.reason, '加载失败')}`)
    }
    if (storeResult.status === 'rejected') {
      message.warning(`本地书仓扫描失败，已仅搜索书架本地书：${readError(storeResult.reason, '扫描失败')}`)
      return
    }
    message.success(shownLocalResults.value.length ? `找到 ${shownLocalResults.value.length} 条本地结果` : '没有找到本地书籍')
  } catch (err) {
    if (isActiveLocalSearch(operation, workspaceStamp)) {
      message.error(readError(err, '搜索本地书仓失败'))
    }
  } finally {
    if (isActiveLocalSearch(operation, workspaceStamp)) {
      searching.value = false
      workspace.setResultLoading(false)
    }
  }
}

function isActiveLocalSearch(operation, workspaceStamp) {
  return searchSessionOperations.canCommit(operation)
    && isWorkspaceRequestCurrent(workspace, workspaceStamp)
}

function remoteWorkspaceContinuation() {
  return {
    page: searchPage.value,
    lastIndex: searchLastIndex.value,
    hasMore: remoteHasMore.value,
  }
}

function applyWorkspaceSearchIntent() {
  const intent = workspace.search
  searchMode.value = intent.mode === 'local' ? 'local' : 'remote'
  keyword.value = intent.keyword || ''
  if (!intent.keyword) {
    // A keyword-less intent is a fresh mount: keep the persisted search-type
    // and group preferences instead of resetting them to the defaults (and
    // letting the preference watcher write that reset back to the server).
    searched.value = false
    searchStarting.value = false
    return
  }
  searchType.value = ['all', 'group', 'single', 'custom'].includes(intent.searchType)
    ? intent.searchType
    : DEFAULT_SEARCH.searchType
  selectedGroup.value = intent.group || ''
  singleSourceId.value = Number(intent.sourceId || 0) || null
  concurrentCount.value = normalizeSearchConcurrent(intent.concurrent)
  searched.value = false
  searchStarting.value = searchMode.value === 'remote' && Boolean(keyword.value.trim())
}

async function importLocalOne(item) {
  if (!item?.importable) return
  await importLocalPaths([item.path])
}

async function importLocalPaths(paths) {
  const operation = searchSessionOperations.begin('local-import')
  importingLocal.value = true
  try {
    const categoryIds = targetCategoryIds.value.map(Number).filter(Boolean)
    const { data } = await importFromLocalStore(paths, categoryIds)
    if (!searchSessionOperations.canCommit(operation)) return
    const imported = data.imported || []
    imported.forEach(item => {
      if (item.book) bookshelf.upsertBook(item.book)
    })
    markImportedLocalItems(imported)
    const success = imported.filter(item => item.book).length
    const failed = imported.filter(item => item.error).length
    message.success(`导入 ${success} 本` + (failed ? `，${failed} 本失败` : ''))
  } catch (err) {
    if (searchSessionOperations.canCommit(operation)) {
      message.error(readError(err, '导入本地书失败'))
    }
  } finally {
    if (searchSessionOperations.canCommit(operation)) importingLocal.value = false
  }
}

function markImportedLocalItems(imported) {
  const importedByPath = new Map(
    imported
      .filter(item => item?.book && item?.path)
      .map(item => [item.path, item.book]),
  )
  if (!importedByPath.size) return
  localItems.value = localItems.value.map(item => {
    const book = importedByPath.get(item.path)
    if (!book) return item
    return { ...item, book, importable: false }
  })
}

function localBookTitle(item) {
  if (item?.book) return item.book.title || '未命名本地书'
  return String(item?.name || '未命名本地书').replace(/\.[^.]+$/, '')
}

function localBookSubline(item) {
  if (item?.book) {
    const parts = []
    if (item.book.author) parts.push(item.book.author)
    if (item.book.chapterCount) parts.push(`共${item.book.chapterCount}章`)
    return parts.join(' · ') || item.path || '本地书籍'
  }
  return item?.path || ''
}

function localBookMeta(item) {
  if (item?.book) {
    if (item.book.lastChapter) return `最新：${item.book.lastChapter}`
    if (item.path) return `来源：${item.path}`
    return '已导入书架'
  }
  return `大小：${formatSize(item?.size)}`
}

function localResultKey(item) {
  return item?.book ? `shelf-${item.book.id}` : `file-${item.path}`
}

function localShelfSearchText(book) {
  return localBookSearchText(book, [
    localBookSubline({ book }),
    localBookMeta({ book }),
  ])
}

function localFileSearchText(item) {
  return normalizeLocalSearch([
    item.name,
    item.path,
    item.extension,
    item.mimeType,
  ].filter(Boolean).join(' '))
}

function normalizeLocalSearch(value) {
  return normalizeLocalBookSearch(value)
}

function fileExtension(value) {
  const match = String(value || '').match(/\.([^.\\/]+)$/)
  return match ? match[1].toUpperCase() : '本地'
}

function readLocalShelfBook(book) {
  router.push({ name: 'reader', params: { id: book.id }, query: readerRouteQueryForLocalBook(book) })
}

function readerRouteQueryForLocalBook(book) {
  return readerRouteQueryFromBook(book, readerProgressForBook(book))
}

function readerProgressForBook(book) {
  const shelfBook = bookshelf.books.find(item => item.id === book?.id)
  const mergedBook = shelfBook ? { ...book, progress: shelfBook.progress || book?.progress } : book
  return newestBookProgress(mergedBook, reader.progressByBook)
}

function openLocalShelfDetail(book) {
  overlay.openBookInfo(book, {
    statusLabel: '本地书籍',
    statusType: 'info',
  })
}

async function openRemoteReader(item) {
  const operation = searchSessionOperations.begin('remote-reader')
  try {
    const { data } = await createRemoteReaderSession(remoteBookReaderPayload(item, {
      sourceId: remoteBookSourceId(item),
      sourceName: remoteBookSourceName(item),
    }))
    if (!searchSessionOperations.canCommit(operation)) return
    if (!data?.id) throw new Error('远程阅读会话无效')
    router.push({ name: 'remote-reader', params: { sessionId: data.id }, query: { chapter: 0 } })
  } catch (error) {
    if (searchSessionOperations.canCommit(operation)) {
      message.error(readError(error, '打开临时阅读失败'))
    }
  }
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function openPreview(item) {
  overlay.openBookInfo(item, {
    sourceName: remoteBookSourceName(item),
    statusLabel: '搜索结果',
    statusType: 'info',
  })
}

async function addResultToShelf(item) {
  await resultAddToShelf.addRemoteBookWithCategories(item, {
    key: remoteBookKey(item),
    sourceId: remoteBookSourceId(item),
    sourceName: remoteBookSourceName(item),
  })
}

function openResultEditor(item) {
  resultEditor.open(item, {
    sourceId: remoteBookSourceId(item),
    sourceName: remoteBookSourceName(item),
  })
}

function closeResultEditor() {
  resultEditor.close()
}

async function saveResultEditor() {
  await resultEditor.save()
}

function updateResultViewport() {
  resultWindowWidth.value = currentViewportWidth()
}

function readError(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || fallback
}
</script>

<style scoped>
.search-page {
  display: flex;
  min-width: 0;
  gap: 0;
}

.result-title,
.result-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-title {
  justify-content: space-between;
}
.local-result-list {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.local-result-card:hover,
.local-result-card.selected {
  border-color: var(--app-primary);
}

.local-result-card {
  display: flex;
  align-items: start;
  gap: 12px;
  padding: 14px;
  cursor: pointer;
}

.local-file-icon {
  display: grid;
  width: 42px;
  height: 54px;
  place-items: center;
  flex: 0 0 42px;
  color: var(--app-primary-strong);
  background: var(--app-primary-soft);
  border-radius: 5px;
  font-size: 24px;
}

.result-main {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 6px;
}

.result-main h3,
.result-main p {
  margin: 0;
}

.result-main h3 {
  font-size: 17px;
}

.result-main p {
  color: var(--app-text-muted);
  font-size: 13px;
}

.latest-chapter {
  color: var(--app-primary-strong) !important;
}

.result-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 750px) {
  .search-page {
    gap: 0;
  }

  .result-actions {
    display: grid;
  }
  .local-result-list {
    gap: 8px;
  }

  .result-actions {
    justify-content: stretch;
  }

  .result-actions :deep(.el-button) {
    width: 100%;
    min-height: 36px;
    margin-left: 0;
  }

  .local-result-card {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    gap: 10px;
    padding: 10px;
  }

  .local-file-icon {
    width: 34px;
    height: 46px;
    font-size: 20px;
  }

  .result-title {
    display: grid;
    gap: 4px;
  }

  .result-main h3 {
    overflow: hidden;
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-main p {
    min-width: 0;
    font-size: 12px;
  }

}
</style>

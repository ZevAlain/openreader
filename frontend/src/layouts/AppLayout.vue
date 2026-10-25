<template>
  <div
    class="app-shell"
    :class="{ 'mobile-shell': isMobileShell }"
  >
    <div v-if="offline" class="app-offline">网络已断开，部分同步能力会在恢复连接后继续。</div>
    <div v-if="shellUpdateReady" class="app-update" role="status">
      <span>当前是旧缓存页面，已有新版本。</span>
      <button type="button" @click="applyShellUpdate">刷新加载</button>
    </div>

    <aside class="app-sidebar">
      <div class="app-sidebar-scroll">
      <div class="app-brand" @click="goHome">
        <div class="app-brand-mark">阅</div>
        <div>
          <div class="app-brand-title-row">
            <div class="app-brand-title">阅读</div>
            <button class="app-version-text" type="button" @click.stop="refreshHealthInfo(true)">{{ appVersionLabel }}</button>
          </div>
          <div class="app-brand-subtitle">清风不识字，何故乱翻书</div>
        </div>
      </div>

      <div class="app-shell-search">
        <v-text-field
          v-model="quickSearch"
          placeholder="搜索书籍"
          :prepend-inner-icon="mdiMagnify"
          clearable
          density="compact"
          variant="outlined"
          hide-details
          @keyup.enter="goSearch"
          @click:clear="clearSearchQuery"
        />
      </div>

      <section class="app-search-setting">
        <p class="app-nav-title">搜索设置</p>
        <v-select
          v-model="sidebarSearchType"
          :items="sidebarSearchTypeItems"
          class="setting-select"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-select
          v-if="sidebarSearchType === 'multi'"
          v-model="sidebarSearchGroup"
          :items="sidebarGroupItems"
          class="setting-select"
          density="compact"
          variant="outlined"
          hide-details
          placeholder="全部分组"
        />
        <v-autocomplete
          v-if="sidebarSearchType === 'single'"
          v-model="sidebarSourceId"
          :items="sidebarSourceItems"
          class="setting-select"
          density="compact"
          variant="outlined"
          hide-details
          placeholder="选择书源"
        />
        <v-select
          v-if="sidebarSearchType === 'multi'"
          v-model="sidebarConcurrent"
          :items="sidebarConcurrentItems"
          class="setting-select"
          density="compact"
          variant="outlined"
          hide-details
        />
      </section>

      <section class="sidebar-recent">
        <div class="sidebar-recent-title">
          <p class="app-nav-title">最近阅读</p>
          <button v-if="recentBook" type="button" @click="clearRecentBook">清除</button>
        </div>
        <button
          class="sidebar-recent-book"
          type="button"
          :disabled="!recentBook"
          @click="openRecentBook"
        >
          <span>{{ recentBook?.title || '暂无阅读记录' }}</span>
          <small>{{ recentBook ? recentSubTitle(recentBook) : '打开一本书后会显示在这里' }}</small>
        </button>
      </section>

      <nav class="app-nav">
        <section
          v-for="section in navSections"
          :key="section.key"
          :ref="node => captureSidebarSection(section, node)"
          class="app-nav-section"
          :class="{ 'is-compat-focused': compatFocusedSection === section.key }"
          :data-sidebar-section="section.key"
        >
          <p class="app-nav-title">
            <span>{{ section.title }}</span>
            <button
              v-if="section.headingAction"
              class="app-nav-title-action"
              type="button"
              @click="section.headingAction.action"
            >{{ section.headingAction.label }}</button>
          </p>
          <button
            v-for="item in section.items"
            :key="item.key"
            class="app-nav-item"
            :class="{ active: isNavActive(item) }"
            type="button"
            @click="runNavAction(item)"
          >
            <span>{{ item.label }}</span>
          </button>
        </section>
      </nav>
      </div>

      <div class="sidebar-bottom-icons" aria-label="侧栏快捷入口">
        <a class="sidebar-bottom-icon" href="https://github.com/ZevAlain/openreader" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.5 4.6 18.5 5 18.5 5c.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"
            />
          </svg>
        </a>
        <button class="sidebar-bottom-icon theme-toggle" type="button" :class="{ night: isNightTheme }" :aria-label="isNightTheme ? '切换日间主题' : '切换夜间主题'" @click="toggleNightTheme">
          <v-icon v-if="isNightTheme" :icon="mdiWeatherSunny" />
          <v-icon v-else :icon="mdiWeatherNight" />
        </button>
      </div>
    </aside>

    <ExploreWorkspacePopover
      v-show="exploreChooserVisible"
      :is-mobile="isMobileShell"
      :style="exploreChooserStyle"
      @close="closeExploreChooser"
      @selected="handleExploreSelected"
    />

    <v-dialog
      v-model="cacheManageVisible"
      :fullscreen="isMobileShell"
      max-width="min(480px, calc(100vw - 48px))"
      @update:model-value="value => value && loadCacheStats()"
    >
      <div class="app-dialog-card">
        <header class="app-dialog-head">
          <h2 class="app-dialog-title">缓存管理</h2>
        </header>
        <div class="app-dialog-body">
          <div class="cache-stat-list">
            <div class="cache-stat-row">
              <span>服务器缓存</span>
              <strong>{{ cacheServerSizeLabel }}</strong>
            </div>
            <div v-for="row in cacheBrowserRows" :key="row.group" class="cache-stat-row">
              <span>{{ row.label }}</span>
              <strong>{{ row.size }}</strong>
            </div>
          </div>
          <p class="cache-manage-hint">一键清理会删除服务器章节缓存与当前浏览器的四类本地缓存;书籍、书源与阅读进度不受影响。</p>
        </div>
        <footer class="app-dialog-actions">
          <v-btn variant="text" @click="cacheManageVisible = false">关闭</v-btn>
          <v-btn color="error" :loading="cacheClearingAll || cacheClearing" @click="clearAllCaches">一键清理</v-btn>
        </footer>
      </div>
    </v-dialog>

    <div class="app-workspace" @click="handleWorkspaceBackgroundClick">
      <main class="app-content">
        <slot />
      </main>
    </div>

    <nav v-if="isMobileShell" class="mobile-tabbar" aria-label="主导航">
      <button
        v-for="tab in mobileTabs"
        :key="tab.key"
        class="mobile-tab"
        :class="{ active: tab.key === activeMobileTab }"
        type="button"
        @click="handleMobileTab(tab)"
      >
        <v-icon :icon="tab.icon" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <section
      v-if="isMobileShell && profilePageVisible"
      class="profile-page"
      aria-label="我的"
    >
      <header class="profile-page-header">
        <h1>我的</h1>
      </header>
      <div class="profile-page-account">
          <div class="profile-avatar">{{ profileInitial }}</div>
          <div class="profile-account-text">
            <strong>{{ userStore.profile?.username || '未登录' }}</strong>
            <small>{{ userStore.profile?.role === 'admin' ? '管理员' : '成员' }}</small>
          </div>
          <button
            v-if="isNightTheme"
            class="profile-theme-toggle"
            type="button"
            aria-label="切换日间主题"
            @click="toggleNightTheme"
          ><v-icon :icon="mdiWeatherSunny" /></button>
          <button
            v-else
            class="profile-theme-toggle"
            type="button"
            aria-label="切换夜间主题"
            @click="toggleNightTheme"
          ><v-icon :icon="mdiWeatherNight" /></button>
        </div>
        <div class="profile-page-scroll">
          <section
            v-for="section in navSections"
            :key="section.key"
            class="profile-group"
            :data-sidebar-section="section.key"
          >
            <p class="profile-group-title">{{ section.title }}</p>
            <template v-for="item in section.items" :key="item.key">
              <div v-if="item.info" class="profile-group-item profile-group-static">
                <span>{{ item.label }}</span>
                <span class="profile-static-value">{{ item.info }}</span>
              </div>
              <button
                v-else
                class="profile-group-item"
                type="button"
                @click="runNavAction(item); closeProfileSheet()"
              >
                <span>{{ item.label }}</span>
                <v-icon :icon="mdiChevronRight" />
              </button>
            </template>
          </section>
          <section class="profile-group">
            <p class="profile-group-title">关于</p>
            <div class="profile-group-item profile-group-static">
              <span>版本</span>
              <span class="profile-static-value">{{ appVersionLabel }}</span>
            </div>
            <a class="profile-group-item" href="https://github.com/ZevAlain/openreader" target="_blank" rel="noopener noreferrer">
              <span>GitHub 仓库</span>
              <v-icon :icon="mdiChevronRight" />
            </a>
          </section>
        </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirm, message } from '../composables/useAppFeedback.js'
import { mdiAccountOutline, mdiBookOpenOutline, mdiChevronRight, mdiMagnify, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { useUserStore } from '../stores/user'
import { useOverlayStore } from '../stores/overlay'
import { useBookshelfStore } from '../stores/bookshelf'
import { useReaderStore } from '../stores/reader'
import { usePreferencesStore } from '../stores/preferences'
import { useIndexWorkspaceStore } from '../stores/indexWorkspace'
import { CACHE_BROWSER_GROUPS, useAppCacheManagement } from '../composables/useAppCacheManagement'
import { useAppMobileNavigation } from '../composables/useAppMobileNavigation'
import { useAppRecentReading } from '../composables/useAppRecentReading'
import { useShellUpdate } from '../composables/useShellUpdate'
import { useAppSidebarSearch } from '../composables/useAppSidebarSearch'
import { useAuthenticatedOperationGuard } from '../composables/useAuthenticatedOperationGuard'
import { useIndexWorkspaceRefresh } from '../composables/useIndexWorkspaceRefresh'
import { useSync } from '../composables/useSync'
import ExploreWorkspacePopover from '../components/workspace/ExploreWorkspacePopover.vue'
import { clearCache, getCacheStats } from '../api/cache'
import { listSources } from '../api/sources'
import api from '../api/client'
import { cacheFirstRequest, networkFirstRequest, removeBrowserCache } from '../utils/browserCache'
import { clearBrowserLocalCacheGroup, currentBrowserLocalCacheStats } from '../utils/localCacheStats'
import { currentViewportWidth, shouldUseMiniInterface } from '../utils/responsive'
import { currentUserScope } from '../utils/authScope'
import { createShelfForegroundReconciler } from '../utils/shelfSyncFreshness'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const overlay = useOverlayStore()
const bookshelf = useBookshelfStore()
const reader = useReaderStore()
const preferences = usePreferencesStore()
const workspace = useIndexWorkspaceStore()
const exploreChooserVisible = ref(false)
const exploreChooserStyle = ref({})
const compatFocusedSection = ref('')
const sidebarSectionNodes = new Map()
const offline = ref(false)
const healthInfo = ref(null)
const routeBookInfoLoadingId = ref(null)
const routeBookInfoOpenedKey = ref('')
const routeBookInfoOperations = useAuthenticatedOperationGuard()
let compatibilityFocusTimer
const { connect, disconnect } = useSync()
const backendConnected = computed(() => Boolean(healthInfo.value))
const shelfForegroundReconciler = createShelfForegroundReconciler({
  loadShelf: options => loadShelfForShell(options),
  isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
})
const {
  isMobile: isMobileShell,
  updateViewport: updateViewportFlags,
} = useAppMobileNavigation({
  currentViewportWidth,
  getViewportWidth: () => window.innerWidth,
  getViewportHeight: () => window.innerHeight,
  getPageMode: () => reader.pageMode,
  shouldUseMiniInterface,
  now: () => Date.now(),
})
const {
  clearingServer: cacheClearing,
  sectionTitle: cacheSectionTitle,
  serverStats: cacheServerStats,
  browserStats: cacheBrowserStats,
  loadStats: loadCacheStats,
  clearServer: clearSystemCache,
  resetScope: resetCacheScope,
  formatSize: formatCacheSize,
} = useAppCacheManagement({
  getServerStats: getCacheStats,
  getBrowserStats: currentBrowserLocalCacheStats,
  clearServerCache: clearCache,
  clearBrowserGroup: clearBrowserLocalCacheGroup,
  confirm: (text, title, config = {}) =>
    confirm({ message: text, title, tone: config.type === 'warning' ? 'warning' : 'primary' }).then(action => {
      if (action !== 'confirm') return Promise.reject('cancel')
    }),
  onSuccess: text => message.success(text),
  onInfo: text => message.info(text),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})
const {
  recentBook,
  open: openRecentBook,
  clear: clearRecentBook,
  subtitle: recentSubTitle,
  refreshScope: refreshRecentReadingScope,
} = useAppRecentReading({
  getBooks: () => bookshelf.books,
  getProgressByBook: () => reader.progressByBook,
  getUserScope: currentUserScope,
  getStorage: () => window.localStorage,
  now: () => Date.now(),
  navigate: route => router.push(route),
})
const canAccessLocalStore = computed(() => userStore.profile?.canAccessStore !== false)

const profilePageVisible = ref(false)
const { updateReady: shellUpdateReady, applyUpdate: applyShellUpdate } = useShellUpdate()
const mobileTabs = [
  { key: 'shelf', label: '书架', icon: mdiBookOpenOutline, workspace: '' },
  { key: 'search', label: '搜索', icon: mdiMagnify, workspace: 'search' },
  { key: 'profile', label: '我的', icon: mdiAccountOutline, workspace: null },
]
const activeMobileTab = computed(() => {
  if (profilePageVisible.value) return 'profile'
  if (route.query.workspace === 'search') return 'search'
  return 'shelf'
})
const profileInitial = computed(() => String(userStore.profile?.username || '访').slice(0, 1).toUpperCase())

function handleMobileTab(tab) {
  if (tab.workspace === null) {
    profilePageVisible.value = !profilePageVisible.value
    return
  }
  if (profilePageVisible.value) profilePageVisible.value = false
  if (exploreChooserVisible.value) closeExploreChooser()
  router.push({ path: '/', query: tab.workspace ? { workspace: tab.workspace } : {} })
}

function closeProfileSheet() {
  profilePageVisible.value = false
}
const navSections = computed(() => [
  {
    key: 'library',
    title: '书库',
    items: [
      { key: 'bookManage', label: '书籍管理', action: () => overlay.openBookManage() },
      { key: 'bookGroup', label: '分组管理', action: () => overlay.openBookGroup('manage') },
      { key: 'importBook', label: '导入书籍', action: () => overlay.openImportBook() },
      ...(canAccessLocalStore.value
        ? [{ key: 'localStore', label: '浏览书仓', action: () => overlay.openLocalStore() }]
        : []),
    ],
  },
  {
    key: 'sources',
    title: '书源',
    items: [
      { key: 'sources', label: '书源管理', action: () => overlay.openSourceManage('manage') },
      { key: 'sourceHealth', label: '失效书源', action: () => overlay.openSourceManage('health') },
      { key: 'sourceDebug', label: '调试书源', action: openSourceDebugWorkspace },
    ],
  },
  {
    key: 'system',
    title: '系统',
    items: [
      { key: 'cacheManage', label: cacheSectionTitle.value, action: () => { cacheManageVisible.value = true } },
      { key: 'backendStatus', label: '后端状态', info: backendConnected.value ? '在线' : '未连接' },
    ],
  },
  {
    key: 'account',
    title: userStore.profile?.username ? `用户空间 · ${userStore.profile?.username}` : '用户空间',
    headingAction: userStore.profile ? { label: '注销', action: logoutUser } : null,
    items: [
      ...(userStore.profile?.role === 'admin'
        ? [{ key: 'userManage', label: '管理用户空间', action: () => overlay.openUserManage() }]
        : []),
    ],
  },
])

const cacheManageVisible = ref(false)
const cacheClearingAll = ref(false)
const cacheServerSizeLabel = computed(() => formatCacheSize(Number(cacheServerStats.value?.size || 0)))
const cacheBrowserRows = computed(() => CACHE_BROWSER_GROUPS.map(row => {
  const stats = cacheBrowserStats.value?.groups?.[row.group]
  return {
    ...row,
    size: formatCacheSize(Number(stats?.size || 0)),
  }
}))

// One click clears the server chapter cache plus every browser cache group;
// books and sources are untouched.
async function clearAllCaches() {
  const action = await confirm({
    title: '清理缓存',
    message: '将清理服务器章节缓存与当前浏览器的全部本地缓存,书籍与书源数据不受影响。',
    tone: 'warning',
  })
  if (action !== 'confirm') return
  const operation = operations.begin('clear-all-caches')
  cacheClearingAll.value = true
  let failed = 0
  try {
    const jobs = [
      clearCache().catch(() => { failed += 1 }),
      ...CACHE_BROWSER_GROUPS.map(row => clearBrowserLocalCacheGroup(row.group, operation.scope).catch(() => { failed += 1 })),
    ]
    await Promise.all(jobs)
    if (!operations.canCommit(operation)) return
    await loadCacheStats()
    if (failed) message.warning(`清理完成,${failed} 项失败`)
    else message.success('缓存已清理')
  } finally {
    if (operations.canCommit(operation)) cacheClearingAll.value = false
  }
}

const {
  quickSearch,
  concurrentOptions,
  searchType: sidebarSearchType,
  searchGroup: sidebarSearchGroup,
  sourceId: sidebarSourceId,
  concurrent: sidebarConcurrent,
  enabledSources: sidebarEnabledSources,
  sourceGroups: sidebarSourceGroups,
  concurrentLabel,
  goSearch,
  clearSearchQuery,
  loadSources: loadSidebarSources,
  refreshSourcesCache: refreshSidebarSourcesCache,
  handleSourcesUpdated,
  dispose: disposeSidebarSearch,
} = useAppSidebarSearch({
  preferences,
  route,
  router,
  listSources,
  cacheFirstRequest,
  networkFirstRequest,
  removeBrowserCache,
  getUserScope: currentUserScope,
  onWarning: text => message.warning(text),
  onWorkspaceSearch: beginWorkspaceSearch,
  onSearchConfigChange: handleSidebarSearchConfigChange,
  afterNavigate: () => {
    if (isMobileShell.value) profilePageVisible.value = false
  },
  afterSourcesUpdated: () => loadCacheStats(),
})
const {
  loading: workspaceRefreshLoading,
  refresh: refreshWorkspaceData,
  resetScope: resetWorkspaceRefreshScope,
} = useIndexWorkspaceRefresh({
  refreshShelf: refreshWorkspaceShelf,
  refreshSources: refreshWorkspaceSources,
  refreshPreferences: refreshWorkspacePreferences,
  refreshReaderSettings: refreshWorkspaceReaderSettings,
  refreshOverlays: refreshWorkspaceOverlays,
  refreshCacheStats: loadCacheStats,
  onSuccess: text => message.success(text),
  onWarning: text => message.warning(text),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})
const sidebarSearchTypeItems = [
  { title: '单源搜索', value: 'single' },
  { title: '多源搜索(过滤书名/作者名)', value: 'multi' },
]
const sidebarGroupItems = computed(() => sidebarSourceGroups.value.map(group => ({ title: `${group.label} (${group.count})`, value: group.value })))
const sidebarSourceItems = computed(() => sidebarEnabledSources.value.map(source => ({ title: source.name, value: source.id })))
const sidebarConcurrentItems = computed(() => concurrentOptions.value.map(count => ({ title: concurrentLabel(count), value: count })))
const isNightTheme = computed(() => reader.themeType === 'night')
const appVersionLabel = computed(() => {
  const version = String(healthInfo.value?.version || '').trim()
  const commit = shortCommit(healthInfo.value?.commit)
  if (version && !['dev', 'unknown'].includes(version)) {
    // Versions are always displayed as Vx.y.z (capital V, v-prefixed line).
    return version.startsWith('V') ? version : `V${version.replace(/^v/, '')}`
  }
  return commit ? `dev (${commit})` : 'V-dev'
})
function goHome() {
  workspace.backToShelf()
  if (route.name !== 'home') {
    router.push({ name: 'home' })
    return
  }
  if (route.query.workspace !== undefined) {
    router.replace({ name: 'home', query: withoutWorkspaceQuery(route.query) })
  }
}

function runNavAction(item) {
  if (exploreChooserVisible.value) {
    closeExploreChooser()
  }
  if (item.action) {
    item.action()
    if (isMobileShell.value && item.closeMobile) profilePageVisible.value = false
    return
  }
  if (item.route) {
    const query = navRouteQuery(item)
    router.push({ name: item.route, query })
    if (isMobileShell.value && item.closeMobile) profilePageVisible.value = false
  }
}

function beginWorkspaceSearch(query = {}) {
  workspace.beginSearch({
    keyword: query.q || '',
    mode: query.mode,
    searchType: query.searchType,
    group: query.group,
    sourceId: query.sourceId,
    concurrent: query.concurrent,
  })
  if (route.name !== 'home') router.push({ name: 'home' })
}

function handleSidebarSearchConfigChange(query = {}) {
  if (!workspace.isSearchResult || workspace.search.mode !== 'remote' || !workspace.search.keyword) return
  beginWorkspaceSearch({
    ...query,
    q: workspace.search.keyword,
    mode: workspace.search.mode,
  })
}

function handleWorkspaceBackgroundClick() {
  if (exploreChooserVisible.value) closeExploreChooser()
}

function captureSidebarSection(section, node) {
  if (!section?.key) return
  if (node) {
    sidebarSectionNodes.set(section.key, node)
    return
  }
  sidebarSectionNodes.delete(section.key)
}

function focusSidebarSection(sectionKey) {
  if (!['account', 'cache'].includes(sectionKey)) return
  if (isMobileShell.value) profilePageVisible.value = true
  compatFocusedSection.value = sectionKey
  clearTimeout(compatibilityFocusTimer)
  nextTick(() => {
    sidebarSectionNodes.get(sectionKey)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  })
  compatibilityFocusTimer = setTimeout(() => {
    if (compatFocusedSection.value === sectionKey) compatFocusedSection.value = ''
  }, 2200)
}

function openExploreChooser() {
  nextTick(() => {
    positionExploreChooser()
    exploreChooserVisible.value = true
  })
}

function closeExploreChooser() {
  exploreChooserVisible.value = false
}

function handleExploreSelected() {
  closeExploreChooser()
  if (route.name !== 'home') router.push({ name: 'home' })
}

function positionExploreChooser() {
  if (isMobileShell.value) {
    exploreChooserStyle.value = {
      top: '0px',
      left: '0px',
      width: '100vw',
    }
    return
  }
  const left = 272
  exploreChooserStyle.value = {
    top: '0px',
    left: `${Math.max(12, left)}px`,
    width: '600px',
  }
}

function withoutWorkspaceQuery(query = {}) {
  const {
    workspace: _workspace,
    q: _query,
    mode: _mode,
    searchType: _searchType,
    group: _group,
    sourceId: _sourceId,
    concurrent: _concurrent,
    url: _url,
    name: _name,
    ...rest
  } = query
  return rest
}

function navRouteQuery(item) {
  return item.query || (item.panel ? { panel: item.panel } : {})
}

function isNavActive(item) {
  if (!item.route || route.name !== item.route) return false
  if (item.key === 'sources') return !route.query.panel && !route.query.action
  if (item.query) {
    return Object.entries(item.query).every(([key, value]) => String(route.query[key] || '') === String(value))
  }
  if (!item.panel) return true
  return String(route.query.panel || 'account') === item.panel
}

function logoutUser() {
  userStore.logout()
  router.replace({ name: 'login' })
}

async function refreshHealthInfo(showMessage = false) {
  try {
    const { data } = await api.get('/health')
    healthInfo.value = data || {}
    if (showMessage) {
      const commit = shortCommit(data?.commit) || '-'
      const buildText = data?.buildDate && data.buildDate !== 'unknown' ? `构建 ${data.buildDate}` : '开发构建'
      message.success(`${buildText} · ${commit}`)
    }
  } catch (err) {
    healthInfo.value = null
    if (showMessage) message.error(readError(err, '读取版本信息失败'))
  }
}

function shortCommit(value) {
  if (!value || value === 'unknown') return ''
  return String(value).slice(0, 12)
}

function toggleNightTheme() {
  reader.setNightTheme(!isNightTheme.value)
}

async function refreshWorkspaceShelf() {
  const [categoryResult, bookGroupResult, booksResult] = await Promise.allSettled([
    bookshelf.loadCategories({ force: true }),
    bookshelf.loadBookGroups({ force: true }),
    bookshelf.loadBooks({ force: true, all: true, settleProgress: true }),
  ])
  if (booksResult.status === 'rejected') throw booksResult.reason
  const groupFailure = [categoryResult, bookGroupResult].find(result => result.status === 'rejected')
  if (groupFailure) throw groupFailure.reason
}

async function refreshWorkspaceSources() {
  const refreshed = await refreshSidebarSourcesCache()
  if (!refreshed) throw new Error('书源刷新失败')
}

async function refreshWorkspacePreferences() {
  await preferences.loadPreferences({ createIfMissing: false })
  const error = Object.values(preferences.syncError).find(value => value && value !== '没有备份文件')
  if (error) throw new Error(error)
}

async function refreshWorkspaceReaderSettings() {
  await reader.loadReaderSettings({ createIfMissing: false })
  if (reader.settingsSyncError && reader.settingsSyncError !== '没有备份文件') {
    throw new Error(reader.settingsSyncError)
  }
}

function refreshWorkspaceOverlays() {
  window.dispatchEvent(new CustomEvent('openreader:rss-updated', {
    detail: { sources: true, articles: true },
  }))
  window.dispatchEvent(new CustomEvent('openreader:replace-rules-updated'))
  window.dispatchEvent(new CustomEvent('openreader:bookmarks-updated'))
}

async function openRouteBookInfoOverlay() {
  const rawId = route.query.bookInfo
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId)
  if (!Number.isFinite(id) || id <= 0 || route.name === 'reader') {
    routeBookInfoOperations.invalidate('route-book-info')
    return
  }
  const key = `${route.name || ''}:${id}`
  if (routeBookInfoOpenedKey.value === key && overlay.bookInfoVisible) return
  const operation = routeBookInfoOperations.begin('route-book-info')
  routeBookInfoLoadingId.value = id
  try {
    const { data } = await api.get(`/books/${id}`)
    if (!routeBookInfoOperations.canCommit(operation)) return
    if (!data?.id) return
    const shelfBook = bookshelf.books.find(book => Number(book.id) === Number(data.id))
    const mergedBook = shelfBook ? mergeShelfBookForRoute(shelfBook, data) : data
    if (shelfBook) bookshelf.upsertBook(mergedBook)
    overlay.openBookInfo(mergedBook, {
      progress: routeBookProgress(mergedBook)?.percent || 0,
    })
    routeBookInfoOpenedKey.value = key
  } catch (error) {
    if (!routeBookInfoOperations.canCommit(operation)) return
    message.error(readError(error, '加载书籍信息失败'))
    if ([403, 404].includes(Number(error?.response?.status))) {
      clearRouteBookInfoOverlayIntent()
    }
  } finally {
    if (routeBookInfoOperations.canCommit(operation)) routeBookInfoLoadingId.value = null
  }
}

function clearRouteBookInfoOverlayIntent() {
  if (overlay.bookInfoVisible || !route.query.bookInfo || route.name === 'reader' || route.name === 'remote-reader') return
  routeBookInfoOpenedKey.value = ''
  const { bookInfo: _bookInfo, ...query } = route.query
  router.replace({ name: 'home', query })
}

function openRouteSourceManageOverlay() {
  if (route.name === 'reader' || route.query.overlay !== 'sources') return
  overlay.openSourceManage(route.query.sourceAction)
}

function openSourceDebugWorkspace() {
  const target = router.resolve({ name: 'source-debug' })
  window.open(target.href, '_target')
}

function clearRouteSourceManageOverlayIntent() {
  if (overlay.sourceManageVisible || route.query.overlay !== 'sources') return
  const { overlay: _overlay, sourceAction: _sourceAction, ...query } = route.query
  router.replace({ name: 'home', query })
}

function openRouteWorkspaceOperationOverlay() {
  if (route.name === 'reader') return
  switch (route.query.overlay) {
    case 'local-store':
      if (canAccessLocalStore.value) overlay.openLocalStore()
      break
    case 'replace-rules':
      overlay.openReplaceRules()
      break
    case 'rss':
      overlay.openRSS()
      break
    case 'user-manage':
      overlay.openUserManage()
      break
  }
}

function clearRouteWorkspaceOperationOverlayIntent() {
  const overlayName = String(route.query.overlay || '')
  if (!overlayName || overlayName === 'sources') return
  const visibleByOverlay = {
    'local-store': overlay.localStoreVisible,
    'replace-rules': overlay.replaceRulesVisible,
    rss: overlay.rssVisible,
    'user-manage': overlay.userManageVisible,
  }
  if (visibleByOverlay[overlayName] === undefined || visibleByOverlay[overlayName]) return
  const { overlay: _overlay, ...query } = route.query
  router.replace({ name: 'home', query })
}

function consumeWorkspaceFocusIntent() {
  if (route.name === 'reader') return
  const sectionKey = String(route.query.workspaceFocus || '')
  if (!['account', 'cache'].includes(sectionKey)) return
  // The old cache sidebar section became the cache dialog; account keeps
  // focusing its persistent sidebar section.
  if (sectionKey === 'cache') cacheManageVisible.value = true
  else focusSidebarSection(sectionKey)
  const { workspaceFocus: _workspaceFocus, ...query } = route.query
  router.replace({ name: 'home', query })
}

function consumeWorkspaceNoticeIntent() {
  if (route.name === 'reader' || String(route.query.workspaceNotice || '') !== 'reader-settings') return
  message.info('阅读设置已迁移至书籍阅读页，请打开书籍后使用阅读器中的设置。')
  const { workspaceNotice: _workspaceNotice, ...query } = route.query
  router.replace({ name: 'home', query })
}

function routeBookProgress(book) {
  return reader.progressByBook?.[book?.id] || book?.progress || null
}

function mergeShelfBookForRoute(current, incoming) {
  return {
    ...current,
    ...incoming,
    progress: incoming?.progress || current?.progress,
    categories: incoming?.categories || current?.categories,
    categoryIds: incoming?.categoryIds || current?.categoryIds,
  }
}

function refreshShelfInForeground() {
  if (!userStore.token) return
  shelfForegroundReconciler.refresh().catch(() => {})
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    connect()
    refreshShelfInForeground()
  }
}

function setOffline() {
  offline.value = true
}

function setOnline() {
  offline.value = false
  refreshShelfInForeground()
}

watch(
  () => userStore.token,
  (token) => {
    routeBookInfoOperations.reset()
    resetCacheScope()
    resetWorkspaceRefreshScope()
    refreshRecentReadingScope()
    if (token) {
      connect()
      loadCacheStats()
    } else {
      disconnect()
    }
  },
  { immediate: true },
)

watch(
  () => [route.name, route.query.overlay, userStore.token],
  () => {
    if (!userStore.token) return
    openRouteWorkspaceOperationOverlay()
  },
  { immediate: true },
)

watch(
  () => [route.name, route.query.workspaceFocus, route.query.workspaceNotice, userStore.token],
  () => {
    if (!userStore.token) return
    consumeWorkspaceFocusIntent()
    consumeWorkspaceNoticeIntent()
  },
  { immediate: true },
)

watch(
  () => workspace.exploreChooserRevision,
  (revision) => {
    if (!revision || !workspace.consumeExploreChooserRequest()) return
    if (exploreChooserVisible.value) closeExploreChooser()
    else openExploreChooser()
  },
)

watch(
  () => [route.name, route.query.bookInfo, userStore.token, bookshelf.books.length],
  () => {
    if (!userStore.token) return
    openRouteBookInfoOverlay()
  },
  { immediate: true },
)

watch(
  () => overlay.bookInfoVisible,
  () => clearRouteBookInfoOverlayIntent(),
)

watch(
  () => [route.name, route.query.overlay, route.query.sourceAction, userStore.token],
  () => {
    if (!userStore.token) return
    openRouteSourceManageOverlay()
  },
  { immediate: true },
)

watch(
  () => overlay.sourceManageVisible,
  () => clearRouteSourceManageOverlayIntent(),
)

watch(
  () => [
    overlay.localStoreVisible,
    overlay.replaceRulesVisible,
    overlay.rssVisible,
    overlay.userManageVisible,
  ],
  () => clearRouteWorkspaceOperationOverlayIntent(),
)

onMounted(() => {
  updateViewportFlags()
  window.addEventListener('offline', setOffline)
  window.addEventListener('online', setOnline)
  window.addEventListener('resize', updateViewportFlags)
  window.addEventListener('orientationchange', updateViewportFlags)
  window.addEventListener('resize', positionExploreChooser)
  window.addEventListener('orientationchange', positionExploreChooser)
  window.addEventListener('focus', refreshShelfInForeground)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('openreader:sources-update', handleSourcesUpdated)
  offline.value = !navigator.onLine
  if (userStore.token && !userStore.profile) {
    userStore.loadMe().catch(() => {})
  }
  if (userStore.token && !bookshelf.books.length) {
    loadShelfForShell({ all: true }).catch(() => {})
  }
  if (userStore.token) loadSidebarSources()
  if (workspace.consumeExploreChooserRequest()) openExploreChooser()
  refreshHealthInfo(false)
})

onBeforeUnmount(() => {
  routeBookInfoOperations.reset()
  resetWorkspaceRefreshScope()
  disposeSidebarSearch()
  clearTimeout(compatibilityFocusTimer)
  window.removeEventListener('offline', setOffline)
  window.removeEventListener('online', setOnline)
  window.removeEventListener('resize', updateViewportFlags)
  window.removeEventListener('orientationchange', updateViewportFlags)
  window.removeEventListener('resize', positionExploreChooser)
  window.removeEventListener('orientationchange', positionExploreChooser)
  window.removeEventListener('focus', refreshShelfInForeground)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('openreader:sources-update', handleSourcesUpdated)
})

async function loadShelfForShell(options = {}) {
  const [categoryResult, booksResult] = await Promise.allSettled([
    bookshelf.loadCategories(options),
    bookshelf.loadBooks(options),
  ])
  if (booksResult.status === 'rejected') throw booksResult.reason
  return {
    books: booksResult.value,
    categories: categoryResult.status === 'fulfilled' ? categoryResult.value : bookshelf.categories,
    categoryError: categoryResult.status === 'rejected' ? categoryResult.reason : null,
  }
}

function readError(err, fallback) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  background:
    linear-gradient(180deg, var(--app-surface), var(--app-bg));
}

.app-update {
  position: fixed;
  z-index: 65;
  top: calc(10px + env(safe-area-inset-top));
  left: 50%;
  display: flex;
  max-width: calc(100vw - 24px);
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--glass-panel-border);
  border-radius: 999px;
  background: var(--glass-panel-bg);
  backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  color: var(--app-text);
  font-size: 13px;
  transform: translateX(-50%);
}

.app-update button {
  flex: 0 0 auto;
  padding: 5px 12px;
  border: 0;
  border-radius: 999px;
  background: var(--app-primary);
  color: var(--app-on-primary);
  font-size: 13px;
  cursor: pointer;
}

.app-offline {
  position: fixed;
  z-index: 66;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 14px;
  color: #fff9ed;
  background: var(--app-warning);
  border-radius: 999px;
  box-shadow: var(--app-shadow-md);
  font-size: 13px;
}

.app-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 30;
  display: block;
  width: var(--app-sidebar-width);
  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
  padding: 0;
  overflow: hidden;
  color: var(--app-text);
  background: var(--app-nav-bg);
  backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  border-right: 1px solid var(--glass-panel-border);
  scrollbar-width: none;
}

.app-sidebar-scroll {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 48px 36px 88px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}

.app-sidebar-scroll::-webkit-scrollbar {
  display: none;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  cursor: pointer;
}

.app-brand-title-row {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 12px;
}

.app-brand-mark {
  display: inline-grid;
  width: 0;
  height: 0;
  place-items: center;
  flex: 0 0 0;
  overflow: hidden;
  color: transparent;
  background: transparent;
  border-radius: 0;
  font-weight: 800;
}

.app-brand-title {
  color: var(--app-text);
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
  word-break: keep-all;
}

.app-version-text {
  min-width: 0;
  padding: 0;
  color: var(--app-text-subtle);
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  overflow-wrap: anywhere;
  text-align: left;
}

.app-version-text:hover {
  color: var(--app-text-subtle);
}

.app-brand-subtitle {
  margin-top: 18px;
  color: var(--app-text-subtle);
  font-size: 16px;
  line-height: 1.35;
  white-space: normal;
  word-break: keep-all;
}

.app-shell-search {
  margin: 24px 0 28px;
}

.cache-stat-list {
  display: grid;
  gap: 2px;
  padding: 4px 0 10px;
}

.cache-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 12px;
  border-radius: var(--app-radius-md, 14px);
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 13px;
}

.cache-stat-row strong {
  color: var(--app-text);
  font-size: 13px;
}

.cache-manage-hint {
  margin: 0;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 1.6;
}

.app-shell-search :deep(.v-field) {
  border-radius: 14px;
  background: var(--app-surface);
}

.app-shell-search :deep(.v-field__outline__start),
.app-shell-search :deep(.v-field__outline__end) {
  border-color: var(--app-border);
}

.app-shell-search :deep(.v-field--focused) .v-field__outline__start,
.app-shell-search :deep(.v-field--focused) .v-field__outline__end {
  border-color: var(--app-primary);
}

.app-shell-search :deep(.v-field__input) {
  font-size: 14px;
}

.app-search-setting {
  display: grid;
  gap: 12px;
  margin: 0 0 36px;
}

.setting-select {
  width: 100%;
}

.setting-select :deep(.v-field) {
  border-radius: 10px;
  background: var(--app-surface);
}

.setting-select :deep(.v-field__outline__start),
.setting-select :deep(.v-field__outline__end) {
  border-color: var(--app-border);
}

.setting-select :deep(.v-field--focused) .v-field__outline__start,
.setting-select :deep(.v-field--focused) .v-field__outline__end {
  border-color: var(--app-primary);
}

.setting-select :deep(.v-field__input),
.setting-select :deep(.v-select__selection-text) {
  font-size: 13px;
}

.sidebar-recent {
  display: grid;
  gap: 18px;
  margin: 0 0 36px;
}

.sidebar-recent-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-recent-title .app-nav-title {
  margin: 0;
}

.sidebar-recent-title button {
  flex: 0 0 auto;
  padding: 0;
  color: var(--app-text-subtle);
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 13px;
  line-height: 1.35;
  cursor: pointer;
}

.sidebar-recent-title button:hover {
  color: var(--app-accent);
}

.sidebar-recent-book {
  display: grid;
  gap: 4px;
  min-width: 0;
  width: fit-content;
  max-width: 100%;
  padding: 9px 12px;
  color: var(--app-warning);
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
}

.sidebar-recent-book:disabled {
  cursor: default;
  opacity: 0.7;
}

.sidebar-recent-book span,
.sidebar-recent-book small {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}

.sidebar-recent-book span {
  font-size: 13px;
  font-weight: 700;
}

.sidebar-recent-book small {
  color: var(--app-text-muted);
  font-size: 12px;
}

.app-nav {
  display: block;
  padding: 0 0 20px;
}

.sidebar-bottom-icons {
  position: absolute;
  bottom: 30px;
  left: 36px;
  z-index: 31;
  display: flex;
  width: calc(var(--app-sidebar-width) - 72px);
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.app-nav-section {
  display: block;
  margin-bottom: 36px;
  scroll-margin-block: 24px;
}

.app-nav-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 4px;
  color: var(--app-text-subtle);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: 0;
  white-space: normal;
  word-break: keep-all;
}

.app-nav-title-action {
  flex: 0 0 auto;
  padding: 0;
  color: var(--app-text-subtle);
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 1.35;
}

.app-nav-title-action:hover {
  color: var(--app-accent);
}

.app-nav-section.is-compat-focused {
  animation: sidebar-compat-focus 2.2s ease-out both;
}

@keyframes sidebar-compat-focus {
  0%, 55% {
    background: color-mix(in srgb, var(--app-accent) 12%, transparent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-accent) 9%, transparent);
  }
  100% {
    background: transparent;
    box-shadow: none;
  }
}

.app-nav-item {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  padding: 7px 14px;
  color: var(--app-text-muted);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 999px;
  cursor: pointer;
  margin-right: 15px;
  margin-bottom: 15px;
  text-align: center;
  transition: color 160ms ease, background-color 160ms ease;
}

.app-nav-item:hover {
  color: var(--app-primary-strong);
  background: var(--app-surface-muted);
}

.app-nav-item.active {
  color: var(--app-primary-strong);
  background: var(--app-primary-soft);
  border-color: var(--app-primary-soft);
}

.app-nav-item span {
  min-width: 0;
  overflow: visible;
  font-size: 13px;
  line-height: 1.3;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}

.sidebar-bottom-icon {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--app-text);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
}

.sidebar-bottom-icon svg {
  width: 32px;
  height: 32px;
}

.theme-toggle {
  color: var(--app-text);
  background: var(--app-surface-muted);
}

.theme-toggle.night {
  color: var(--app-primary-strong);
  background: var(--app-primary-soft);
}

.app-workspace {
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding-left: var(--app-sidebar-width);
  overflow-x: hidden;
}

.explore-workspace-popover {
  position: fixed;
  z-index: 35;
}

.app-content {
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-x: hidden;
}

.app-shell.mobile-shell {
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
}

.app-shell.mobile-shell .app-sidebar {
  display: none;
}

.app-shell.mobile-shell .app-sidebar-scroll {
  padding: max(48px, env(safe-area-inset-top)) 36px 88px;
}

.app-shell.mobile-shell .app-workspace {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding-left: 0;
  overflow-x: hidden;
}

.app-shell.mobile-shell .explore-workspace-popover {
  top: 0;
  left: 0;
  z-index: 35;
  width: 100vw;
}

.app-shell.mobile-shell .app-content {
  min-height: 100vh;
}

.app-shell.mobile-shell .app-brand {
  display: flex;
  min-width: 0;
  max-width: 100%;
  justify-items: initial;
  gap: 12px;
  padding: 8px 0 18px;
}

.app-shell.mobile-shell .app-brand > div:last-child {
  display: block;
}

.app-shell.mobile-shell .app-shell-search {
  display: block;
  min-width: 0;
  max-width: 100%;
  margin: 0 0 18px;
}

.app-shell.mobile-shell .app-search-setting {
  min-width: 0;
  max-width: 100%;
  margin: 0 0 22px;
  gap: 10px;
}

.app-shell.mobile-shell .app-brand-mark {
  display: none;
}

.app-shell.mobile-shell .app-nav {
  display: block;
  padding: 0 0 20px;
}

.app-shell.mobile-shell .app-nav-section {
  display: block;
  margin-bottom: 36px;
}

.app-shell.mobile-shell .app-nav-title {
  margin: 0 0 8px;
  overflow: visible;
  color: var(--app-text-subtle);
  font-size: 14px;
  line-height: 1.3;
  text-align: left;
  white-space: normal;
  word-break: keep-all;
}

.app-shell.mobile-shell .app-nav-item {
  display: inline-flex;
  width: fit-content;
  min-width: 0;
  min-height: 32px;
  height: auto;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  margin-bottom: 15px;
  padding: 7px 14px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 999px;
}

.app-shell.mobile-shell .app-nav-item span {
  overflow: hidden;
  font-size: 12px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: keep-all;
}

.app-shell.mobile-shell .sidebar-recent {
  min-width: 0;
  max-width: 100%;
  margin: 0 0 8px;
}

.app-shell.mobile-shell .sidebar-recent .app-nav-title,
.app-shell.mobile-shell .sidebar-recent-book small {
  display: block;
}

.app-shell.mobile-shell .sidebar-recent-book {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: auto;
  padding: 9px 10px;
  place-items: initial;
  text-align: left;
}

.app-shell.mobile-shell .sidebar-recent-book span {
  display: block;
  min-width: 0;
  font-size: 13px;
  line-height: 1.25;
  overflow-wrap: anywhere;
  white-space: normal;
  word-break: break-word;
}

.app-shell.mobile-shell .sidebar-bottom-icons {
  position: absolute;
  right: auto;
  bottom: 30px;
  left: 36px;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.app-shell.mobile-shell .sidebar-bottom-icon {
  background: transparent;
  border: 0;
  box-shadow: none;
}

.app-shell.mobile-shell .sidebar-bottom-icon svg {
  width: 22px;
  height: 22px;
}

.app-shell.mobile-shell .theme-toggle {
  color: var(--app-text);
  background: var(--app-surface-muted);
  border-color: var(--app-surface-muted);
}

.app-shell.mobile-shell .theme-toggle.night {
  color: var(--app-primary-strong);
  background: var(--app-primary-soft);
  border-color: var(--app-primary-soft);
}


/* ---- Mobile floating glass tab bar (iOS 26 Liquid Glass style) ---- */
.mobile-tabbar {
  position: fixed;
  left: 50%;
  bottom: calc(14px + env(safe-area-inset-bottom));
  z-index: 60;
  display: flex;
  width: fit-content;
  max-width: calc(100vw - 28px);
  padding: 7px;
  border: 1px solid var(--glass-chrome-border);
  border-radius: 999px;
  background: var(--glass-chrome-bg);
  backdrop-filter: blur(var(--glass-blur-chrome)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur-chrome)) saturate(var(--glass-saturate));
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  transform: translateX(-50%);
}

.mobile-tab {
  flex: 0 0 auto;
  min-width: 64px;
  touch-action: manipulation;
  display: grid;
  justify-items: center;
  gap: 1px;
  padding: 8px 6px 6px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 500;
  transition: color 180ms ease, background-color 180ms ease, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.mobile-tab:active {
  transform: scale(0.92);
}

.mobile-tab .v-icon {
  font-size: 22px;
  transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.mobile-tab.active {
  color: var(--app-primary-strong);
  background: var(--app-primary-soft);
}

.mobile-tab.active .v-icon {
  transform: scale(1.06);
}

/* ---- "My profile" full page (mobile) ---- */
.profile-page {
  position: fixed;
  inset: 0;
  z-index: 55;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  background: var(--app-bg);
  animation: profile-page-in 220ms ease;
}

@keyframes profile-page-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.profile-page-header {
  padding: calc(30px + env(safe-area-inset-top)) 20px 8px;
}

.profile-page-header h1 {
  margin: 0;
  color: var(--app-text);
  font-size: 28px;
  font-weight: 800;
}

.profile-page-account {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px 16px;
  border-bottom: 1px solid var(--app-border);
}

.profile-avatar {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  background: var(--app-primary);
  color: var(--app-on-primary);
  font-size: 19px;
  font-weight: 600;
}

.profile-account-text {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.profile-account-text small {
  color: var(--app-text-muted);
}

.profile-theme-toggle {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--app-border);
  border-radius: 50%;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 17px;
}

.profile-page-scroll {
  flex: 1;
  overflow: auto;
  padding: 8px 16px calc(24px + env(safe-area-inset-bottom) + 96px);
}

.profile-group {
  margin: 14px 0;
}

.profile-group-title {
  margin: 0 0 6px 10px;
  color: var(--app-text-subtle);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.profile-group-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 15px;
  text-align: left;
  text-decoration: none;
}

.profile-group-item:first-of-type {
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
}

.profile-group-item:last-of-type {
  border-bottom: 0;
  border-bottom-left-radius: 14px;
  border-bottom-right-radius: 14px;
}

.profile-group-item .v-icon {
  color: var(--app-text-subtle);
  font-size: 14px;
}

.profile-group-static {
  cursor: default;
}

.profile-static-value {
  color: var(--app-primary-strong);
  font-size: 13px;
  font-weight: 600;
}
</style>

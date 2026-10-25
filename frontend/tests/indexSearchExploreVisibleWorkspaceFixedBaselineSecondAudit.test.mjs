import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  storedSearchType,
  visibleSearchGroupOptions,
  visibleSearchMode,
} from '../src/utils/indexSearchPresentation.js'
import {
  expandedExploreSources,
  exploreSourceGroupOptions,
  filteredExploreSources,
  toggledExploreGroup,
} from '../src/utils/exploreChooserPresentation.js'

const root = resolve(import.meta.dirname, '..')
const read = relative => readFileSync(resolve(root, relative), 'utf8')

test('sidebar exposes the upstream single/multi search surface while preserving internal compatibility', () => {
  const layout = read('src/layouts/AppLayout.vue')
  const sidebarSearch = read('src/composables/useAppSidebarSearch.js')
  const presentation = read('src/utils/indexSearchPresentation.js')

  assert.match(layout, /title: '单源搜索', value: 'single'/)
  assert.match(layout, /title: '多源搜索\(过滤书名\/作者名\)', value: 'multi'/)
  assert.doesNotMatch(layout, /label="分组搜索"/)
  assert.match(layout, /v-if="sidebarSearchType === 'multi'"[\s\S]*v-model="sidebarSearchGroup"/)
  assert.match(layout, /v-if="sidebarSearchType === 'single'"[\s\S]*v-model="sidebarSourceId"/)
  assert.match(layout, /v-if="sidebarSearchType === 'multi'"[\s\S]*v-model="sidebarConcurrent"/)
  assert.match(sidebarSearch, /visibleSearchMode/)
  assert.match(sidebarSearch, /storedSearchType/)
  assert.match(presentation, /label: '全部分组'/)
  assert.match(sidebarSearch, /onSearchConfigChange/)
})

test('visible search presentation preserves internal all/group/single values and first-seen groups', () => {
  assert.equal(visibleSearchMode('single'), 'single')
  assert.equal(visibleSearchMode('all'), 'multi')
  assert.equal(visibleSearchMode('group'), 'multi')
  assert.equal(storedSearchType('single', '奇幻'), 'single')
  assert.equal(storedSearchType('multi', ''), 'all')
  assert.equal(storedSearchType('multi', '奇幻'), 'group')
  assert.deepEqual(visibleSearchGroupOptions([
    { id: 1, enabled: true, group: '奇幻' },
    { id: 2, enabled: true, group: '' },
    { id: 3, enabled: true, group: '都市' },
    { id: 4, enabled: true, group: '奇幻' },
    { id: 5, enabled: false, group: '禁用' },
  ]), [
    { label: '全部分组', value: '', count: 4 },
    { label: '奇幻', value: '奇幻', count: 2 },
    { label: '都市', value: '都市', count: 1 },
  ])
})

test('search and explore share one flat upstream result list and result editor', () => {
  const flatPath = resolve(root, 'src/components/RemoteBookResultList.vue')
  const oldPath = resolve(root, 'src/components/RemoteBookResultGroups.vue')
  const editorPath = resolve(root, 'src/components/RemoteBookJsonEditorDialog.vue')
  assert.equal(existsSync(flatPath), true)
  assert.equal(existsSync(editorPath), true)
  assert.equal(existsSync(oldPath), false)

  const result = read('src/components/RemoteBookResultList.vue')
  const search = read('src/views/Search.vue')
  const discover = read('src/views/Discover.vue')
  const editor = read('src/components/RemoteBookJsonEditorDialog.vue')

  assert.match(result, /class="book-list wrapper remote-result-list"/)
  assert.match(result, /v-for="book in books"/)
  assert.match(result, /class="book-row book remote-result-book"/)
  assert.match(result, /fallbackSourceId/)
  assert.match(result, /cover-img[\s\S]*book-operation[\s\S]*class="name edit"[\s\S]*class="last-chapter"[\s\S]*result-add-book/)
  assert.doesNotMatch(result, /class="sub"/, 'the metadata sub-line under the title is retired')
  assert.match(result, /@click\.stop="\$emit\('edit', book\)"/)
  assert.match(result, /@click\.stop="\$emit\('add', book\)"/)
  assert.doesNotMatch(result, /source-result-group|source-result-head|result-intro|remoteBookKind|remoteBookWordCount|remoteBookUpdateTime/)

  for (const source of [search, discover]) {
    assert.match(source, /<RemoteBookResultList/)
    assert.match(source, /<RemoteBookJsonEditorDialog/)
    assert.match(source, /@edit="openResultEditor"/)
    assert.match(source, /class="app-page shelf-page result-shelf-page/)
    assert.doesNotMatch(source, /workspace-result-subtitle|el-empty[^>]+没有找到相关书籍|groupedResults|exploreResultGroups/)
  }
  assert.match(editor, /app-dialog-title">\s*保存书籍\s*</)
  assert.match(editor, /<v-textarea/)
  assert.match(editor, />取 消</)
  assert.match(editor, />保 存</)
})

test('leaving a workspace returns to the shelf instead of freezing the view', () => {
  const home = read('src/views/Home.vue')
  assert.match(
    home,
    /if \(workspace\.showingResults\) workspace\.backToShelf\(\)/,
    'clearing the workspace query must reset an on-screen search/explore view',
  )
})

test('the search workspace shows the built-in hot rank board under the entry', () => {
  const search = read('src/views/Search.vue')
  const css = read('src/styles/home-shelf.css')
  assert.match(search, /class="search-rank-board"/, 'the board renders in the search workspace')
  assert.match(search, /getHotRank\(\)/, 'the board loads the built-in hot rank')
  assert.match(search, /function searchHotTitle\(title\) \{[\s\S]*?keyword\.value = title[\s\S]*?doSearch\(\)/, 'tapping an entry seeds the search flow with the title')
  assert.match(search, /热门榜单暂时不可用/, 'a network failure explains itself instead of a blank board')
  assert.match(css, /\.search-rank-item\s*\{[\s\S]*?border-radius:\s*14px/, 'rank rows are compact cards')
})

test('the search header stays clean; load-more lives at the list tail', () => {
  const search = read('src/views/Search.vue')
  const headerStart = search.indexOf('<div class="title-actions"')
  const headerEnd = search.indexOf('</div>', headerStart)
  const header = search.slice(headerStart, headerEnd)
  assert.ok(headerStart >= 0, 'the search header exists')
  assert.doesNotMatch(header, /书架|加载更多|没有更多/, 'the shelf and load-more buttons moved out of the header')
  assert.match(search, /class="search-load-more"[\s\S]*?@click="loadMoreRemote"/, 'load-more is an inline pill at the results tail')
  assert.match(search, /v-if="searchMode === 'remote' && searched && remoteHasMore && !streamingMore"/, 'the tail button only appears when more pages exist and auto-streaming has paused')
  assert.match(search, /class="search-stream-status"/, 'streaming progress is visible while later windows are still being searched')
  assert.match(search, /runSearchStream/, 'remaining windows stream in automatically after the first paint')
})

test('the search bar exposes the concurrency picker', () => {
  const search = read('src/views/Search.vue')
  const css = read('src/styles/home-shelf.css')
  assert.match(search, /search-concurrent-toggle/, 'the entry bar shows the current thread count')
  assert.match(search, /v-model="concurrentPickerVisible"/, 'the picker opens a dialog')
  assert.match(search, /SEARCH_CONCURRENT_OPTIONS/, 'the picker lists the shared option set')
  assert.match(search, /applyConcurrentCount\(count\)[\s\S]*?saveSearchPreference/, 'choosing a count persists the preference')
  assert.match(css, /\.search-concurrent-option\s*\{[\s\S]*?border-radius:\s*999px/, 'options render as pills')
})

test('a fully failed search explains itself instead of looking empty', () => {
  const search = read('src/views/Search.vue')
  assert.match(search, /全部搜索失败/, 'the toast distinguishes total source failure from no hits')
  assert.match(search, /class="search-failed-card"/, 'the result area keeps a visible failure card')
})

test('remote result scenes reuse the shelf title, grid, loading and night contract', () => {
  const home = read('src/views/Home.vue')
  const css = read('src/styles/home-shelf.css')
  const search = read('src/views/Search.vue')
  const discover = read('src/views/Discover.vue')

  assert.match(home, /<style src="\.\.\/styles\/home-shelf\.css"><\/style>/)
  assert.doesNotMatch(home, /style scoped src="\.\.\/styles\/home-shelf\.css"/)
  assert.doesNotMatch(css, /html\.dark-reader \.shelf-page/, 'night theming rides the tokens, not manual patches')
  assert.doesNotMatch(css, /:global\(/)
  assert.match(css, /\.result-add-book/)

  assert.match(search, /<strong>搜索<\/strong>/, 'the search title carries no result count')
  assert.match(search, /remoteSearchActionLabel/)
  assert.doesNotMatch(search, /v-loading="searching"/)
  assert.match(discover, /<strong>探索 \(\{\{ books\.length \}\}\)<\/strong>/)
  assert.match(discover, /@click\.stop="openExploreChooser">书海<\/button>/)
  assert.doesNotMatch(discover, /v-loading="loadingMore"/)
})

test('Explore chooser restores fixed desktop/mobile popover and multi-collapse behavior', () => {
  const layout = read('src/layouts/AppLayout.vue')
  const chooser = read('src/components/workspace/ExploreWorkspacePopover.vue')
  const chooserPresentation = read('src/utils/exploreChooserPresentation.js')

  assert.doesNotMatch(layout, /explore-popover-backdrop/)
  assert.match(layout, /top: '0px'/)
  assert.match(layout, /width: '600px'/)
  assert.match(chooser, /v-if="isMobile"[^>]+aria-label="关闭书海"/)
  assert.match(chooser, /const expandedSources = ref\(\[\]\)/)
  assert.doesNotMatch(chooser, /accordion/)
  assert.match(chooserPresentation, /label: '未分组'/)
  assert.doesNotMatch(chooser, /localeCompare/)
  assert.match(chooser, /height: 300px/)
  assert.match(chooser, /max-width: 600px/)
  assert.match(chooser, /\.mobile-explore-workspace-popover[\s\S]*width: 100vw/)
  assert.doesNotMatch(chooser, /\.mobile-explore-workspace-popover[\s\S]{0,400}height: 100%/)
  assert.doesNotMatch(chooser, /<el-empty/)
})

test('Explore chooser keeps first-seen groups, a permanent ungrouped option and multi-expand state', () => {
  const sources = [
    { id: 1, group: '玄幻' },
    { id: 2, group: '' },
    { id: 3, group: '都市' },
    { id: 4, group: '玄幻' },
  ]
  assert.deepEqual(exploreSourceGroupOptions(sources), [
    { label: '玄幻', value: '玄幻' },
    { label: '都市', value: '都市' },
    { label: '未分组', value: '未分组' },
  ])
  assert.deepEqual(exploreSourceGroupOptions([{ id: 1, group: '玄幻' }]).at(-1), {
    label: '未分组',
    value: '未分组',
  })
  assert.deepEqual(filteredExploreSources(sources, '未分组').map(source => source.id), [2])
  assert.equal(toggledExploreGroup('玄幻', '玄幻'), '')
  assert.equal(toggledExploreGroup('玄幻', '都市'), '都市')
  assert.deepEqual(expandedExploreSources(['1', '2'], 3), ['1', '2', '3'])
  assert.deepEqual(expandedExploreSources(['1', '2'], 2), ['1', '2'])
})

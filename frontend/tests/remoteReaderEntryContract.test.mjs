import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = relative => readFileSync(resolve(root, relative), 'utf8')

test('remote result cards preserve upstream cover-info and body-read entry split', () => {
  const component = read('src/components/RemoteBookResultList.vue')
  const search = read('src/views/Search.vue')
  const discover = read('src/views/Discover.vue')

  assert.match(component, /class="book-row book remote-result-book"[\s\S]*@click="\$emit\('read', group\.book\)"/)
  assert.match(component, /class="cover-img"[^>]*@click\.stop="\$emit\('preview', group\.book\)"[\s\S]*<BookCover/)
  assert.match(component, /defineEmits\(\['preview', 'read', 'add', 'edit'\]\)/)
  assert.match(component, /@click\.stop="\$emit\('add', group\.book\)"/)
  assert.match(component, /加入书架/)
  assert.match(component, /groupRemoteResultsByBook/, 'cards group same-book rows across sources')
  assert.match(component, /v-if="group\.sources\.length > 1"[\s\S]*?\{\{ group\.sources\.length \}\}源/, 'multi-source books expose a source-count picker')
  assert.match(component, /@click="\$emit\('preview', source\)"/, 'picking a source previews that source row')
  assert.doesNotMatch(component, /result-actions|查看信息|source-result-group/)
  assert.match(search, /@read="openRemoteReader"/)
  assert.match(discover, /@read="openRemoteReader"/)
  assert.match(search, /@add="addResultToShelf"/)
  assert.match(discover, /@add="addResultToShelf"/)
  assert.match(search, /function openRemoteReader\(item\)/)
  assert.match(discover, /function openRemoteReader\(book\)/)
})

test('legacy BookInfo query is consumed when its shared overlay closes', () => {
  const layout = read('src/layouts/AppLayout.vue')
  assert.match(layout, /function clearRouteBookInfoOverlayIntent\(\)/)
  assert.match(layout, /bookInfo: _bookInfo/)
  assert.match(layout, /router\.replace\(\{ name: 'home', query \}\)/)
  assert.match(layout, /watch\(\s*\(\)\s*=>\s*overlay\.bookInfoVisible,[\s\S]*clearRouteBookInfoOverlayIntent\(\)/)
})

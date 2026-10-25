import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const searchSource = readFileSync(new URL('../src/views/Search.vue', import.meta.url), 'utf8')
const resultListSource = readFileSync(new URL('../src/components/RemoteBookResultList.vue', import.meta.url), 'utf8')

test('multi-source remote search is swept by one SSE stream connection', () => {
  assert.match(searchSource, /await fetch\('\/api\/search\/stream'/, 'the stream is fetched directly instead of the axios client')
  assert.match(searchSource, /method:\s*'POST'/, 'the stream endpoint is POST /api/search/stream')
  assert.match(searchSource, /localStorage\.getItem\('openreader_token'\)/, 'fetch bypasses the axios interceptor, so the bearer token is attached manually')
  assert.match(searchSource, /Authorization: `Bearer \$\{token\}`/, 'the stream request carries the same bearer token as the axios client')
  assert.match(
    searchSource,
    /body: JSON\.stringify\(\{\s*keyword: activeSearchKeyword\.value,\s*sourceIds: activeSourceIds\.value,\s*concurrentCount: activeConcurrentCount\.value,\s*\}\)/,
    'the stream body carries the active keyword, sources, and concurrency',
  )
  assert.match(searchSource, /signal: controller\.signal/, 'the fetch is bound to an abort controller so the stream can be stopped')
})

test('the SSE response body is parsed as a ReadableStream of data-line frames', () => {
  assert.match(searchSource, /response\.body\.getReader\(\)/, 'the body is consumed through the ReadableStream reader')
  assert.match(searchSource, /new TextDecoder\(\)/, 'chunks decode through a TextDecoder')
  assert.match(searchSource, /decoder\.decode\(value, \{ stream: true \}\)/, 'chunks decode incrementally across read() calls')
  assert.match(searchSource, /buffer\.indexOf\('\\n\\n'\)/, 'SSE frames split on the blank-line separator')
  assert.match(searchSource, /startsWith\('data: '\)/, 'only data lines carry events')
  assert.match(searchSource, /JSON\.parse\(dataLine\.slice\(6\)\)/, 'each frame payload is JSON after the data: prefix')
  assert.match(searchSource, /lastSearchStats\.value\.attempted = Number\(event\.attempted \|\| 0\)/, 'per-source stats ride each event')
  assert.match(searchSource, /applyRemoteRows\(event\.list, true\)/, 'each source answer appends as it arrives')
  assert.match(searchSource, /if \(event\.done\) streamDone = true/, 'the done event terminates the read loop')
  assert.match(searchSource, /if \(serial !== searchStreamSerial\) return/, 'a superseded stream stops consuming events')
})

test('stopSearchStream aborts the live SSE connection and settles the flags', () => {
  assert.match(searchSource, /@click="stopSearchStream"/, 'the streaming status bar exposes a stop button')
  const stopBody = searchSource.match(/function stopSearchStream\(\) \{[\s\S]*?\n\}/)
  assert.ok(stopBody, 'stopSearchStream must be defined')
  assert.match(stopBody[0], /searchStreamAbort\.abort\(\)/, 'stopping aborts the in-flight SSE fetch')
  assert.match(stopBody[0], /searchStreamSerial \+= 1/, 'stopping supersedes the stream serial')
  assert.match(stopBody[0], /remoteRequestGate\.invalidate\(\)/, 'stopping invalidates the remote request gate')
  assert.match(stopBody[0], /streamingMore\.value = false/, 'stopping clears the streaming flag so the stop bar disappears')
  assert.match(searchSource, /if \(err\?\.name === 'AbortError'\) return/, 'the user-initiated abort must not surface as an error toast')
})

test('multi-source searches go straight to SSE while single-source keeps the windowed endpoint', () => {
  assert.match(searchSource, /activeSearchIsSingleSource\.value = activeSourceIds\.value\.length === 1/, 'the single-source case is detected from the selected source count')
  assert.match(
    searchSource,
    /if \(!activeSearchIsSingleSource\.value\) \{[\s\S]*?runSearchStreamSSE\(searchStreamSerial, requestToken, workspaceStamp\)\s*return/,
    'a multi-source sweep starts the SSE stream immediately and skips the windowed request',
  )
  assert.match(searchSource, /api\.post\('\/search', remoteSearchPayload\(page, lastIndex\)/, 'single-source searches keep paging the windowed POST /search endpoint')
  assert.match(
    searchSource,
    /if \(activeSearchIsSingleSource\.value\) \{\s*payload\.page = page\s*\} else \{\s*payload\.lastIndex = lastIndex\s*payload\.searchSize = 20\s*\}/,
    'single-source pages by page number while the multi-source window tracks lastIndex',
  )
})

test('search results render through RemoteBookResultList with the add wiring', () => {
  assert.match(searchSource, /<RemoteBookResultList/, 'search renders the grouped result list')
  assert.match(searchSource, /:books="results"/, 'the list consumes the merged search results')
  assert.match(searchSource, /@add="addResultToShelf"/, 'the add event lands in the categorized add-to-shelf flow')
})

test('multi-source cards add to the shelf through the source-picker menu', () => {
  const menus = resultListSource.match(/<v-menu[\s\S]*?<\/v-menu>/g) || []
  const addMenu = menus.find(block => block.includes('加入书架'))
  assert.ok(addMenu, 'multi-source cards must offer the add control as a source-picker menu')
  assert.match(addMenu, /v-if="group\.sources\.length > 1"/, 'the picker only renders when several sources produced the book')
  assert.match(addMenu, /class="result-add-book setting-connect"/, 'the menu activator stays the add-to-shelf chip')
  assert.match(addMenu, /加入书架<\/v-chip>/, 'the activator is labelled 加入书架')
  assert.match(addMenu, /:title="sourceName\(source\)"/, 'each picker row names its source')
  assert.match(addMenu, /\$emit\('add', source\)/, 'picking a row adds that source edition, not the card face')
})

test('single-source cards add group.book directly without a picker', () => {
  assert.match(resultListSource, /<\/v-menu>\s*<v-chip\s+v-else/, 'the direct add chip is the v-else fallback of the multi-source picker menu')
  const chip = resultListSource.match(/<v-chip\s+v-else[\s\S]*?<\/v-chip>/)
  assert.ok(chip, 'the single-source add chip must exist')
  assert.match(chip[0], /@click\.stop="\$emit\('add', group\.book\)"/, 'single-source rows add the card book on click')
  assert.match(chip[0], /@keydown\.enter\.prevent\.stop="\$emit\('add', group\.book\)"/, 'keyboard activation keeps the same direct add')
  assert.match(chip[0], /:class="\{ loading: group\.sources\.some\(source => bookKey\(source\) === addingBookKey\) \}"/, 'the chip loading lights for whichever group row is being added')
  assert.match(resultListSource, /defineEmits\(\['preview', 'read', 'add', 'edit'\]\)/, 'add stays a declared component emit')
})

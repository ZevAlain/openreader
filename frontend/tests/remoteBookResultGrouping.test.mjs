import assert from 'node:assert/strict'
import test from 'node:test'

import { groupRemoteResultsByBook } from '../src/utils/remoteBookResult.js'

function row(title, author, sourceName, bookUrl) {
  return { name: title, author, bookUrl, sourceName }
}

test('groups the same title and author across sources into one card', () => {
  const groups = groupRemoteResultsByBook([
    row('遮天', '辰东', '源A', 'https://a/book/1'),
    row('遮天', '辰东', '源B', 'https://b/book/9'),
    row('遮天', '辰东', '源C', 'https://c/x'),
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].sources.length, 3)
  assert.deepEqual(groups[0].sources.map(item => item.sourceName), ['源A', '源B', '源C'])
  assert.equal(groups[0].book.sourceName, '源A', 'the first ranked row stays the card face')
})

test('keeps different authors or titles as separate books', () => {
  const groups = groupRemoteResultsByBook([
    row('遮天', '辰东', '源A', 'https://a/1'),
    row('遮天', '别人', '源B', 'https://b/2'),
    row('别的书', '辰东', '源A', 'https://a/3'),
  ])
  assert.equal(groups.length, 3)
  assert.ok(groups.every(group => group.sources.length === 1))
})

test('whitespace and case differences do not split a book', () => {
  const groups = groupRemoteResultsByBook([
    row(' 遮天 ', '辰东', '源A', 'https://a/1'),
    row('遮天', ' 辰东', '源B', 'https://b/2'),
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].sources.length, 2)
})

test('single-source rows pass through unchanged in order', () => {
  const groups = groupRemoteResultsByBook([
    row('书1', '甲', '源A', 'https://a/1'),
    row('书2', '乙', '源B', 'https://b/2'),
  ])
  assert.deepEqual(groups.map(group => group.book.name), ['书1', '书2'])
  assert.ok(groups.every(group => group.sources.length === 1))
})

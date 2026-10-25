<template>
  <div class="book-list wrapper remote-result-list">
    <article
      v-for="group in groupedBooks"
      :key="bookKey(group.book)"
      class="book-row book remote-result-book"
      role="button"
      tabindex="0"
      @click="$emit('read', group.book)"
      @keyup.enter="$emit('read', group.book)"
    >
      <span class="cover-img" @click.stop="$emit('preview', group.book)">
        <BookCover class="list-cover" :book="group.book" />
      </span>
      <span class="list-main info">
        <span class="book-operation">
          <button class="operation-icon" type="button" title="编辑" @click.stop="$emit('edit', group.book)">
            <v-icon :icon="mdiPencilOutline" />
          </button>
        </span>
        <strong class="name edit">{{ remoteBookTitle(group.book) }}</strong>
        <span v-if="remoteBookLatestChapter(group.book)" class="last-chapter">
          {{ latestChapterLabel(group.book) }}：{{ remoteBookLatestChapter(group.book) }}
        </span>
        <span class="result-add-zone">
          <v-menu v-if="group.sources.length > 1">
            <template #activator="{ props: menuProps }">
              <button
                class="result-source-pick"
                type="button"
                title="查看本书的所有书源"
                v-bind="menuProps"
                @click.stop
              ><v-icon :icon="mdiLayers" size="14" />{{ group.sources.length }}源</button>
            </template>
            <v-list density="compact" class="result-source-list">
              <v-list-item
                v-for="source in group.sources"
                :key="bookKey(source)"
                :title="sourceName(source)"
                :subtitle="remoteBookLatestChapter(source) ? `最新：${remoteBookLatestChapter(source)}` : ''"
                @click="$emit('preview', source)"
              />
            </v-list>
          </v-menu>
          <v-menu v-if="group.sources.length > 1">
            <template #activator="{ props: menuProps }">
              <v-chip
                v-bind="menuProps"
                size="small"
                color="success"
                class="result-add-book setting-connect"
                :class="{ loading: addingBookKey === bookKey(group.book) }"
                @click.stop
                @keydown.enter.prevent.stop
              >加入书架</v-chip>
            </template>
            <v-list density="compact" class="result-source-list">
              <v-list-item
                v-for="source in group.sources"
                :key="bookKey(source)"
                :title="sourceName(source)"
                :subtitle="remoteBookLatestChapter(source) ? `最新：${remoteBookLatestChapter(source)}` : ''"
                @click="$emit('add', source)"
              >
                <template #append>
                  <v-icon :icon="mdiPlusCircleOutline" size="16" color="success" />
                </template>
              </v-list-item>
            </v-list>
          </v-menu>
          <v-chip
            v-else
            size="small"
            color="success"
            class="result-add-book setting-connect"
            :class="{ loading: group.sources.some(source => bookKey(source) === addingBookKey) }"
            role="button"
            tabindex="0"
            @click.stop="$emit('add', group.book)"
            @keydown.enter.prevent.stop="$emit('add', group.book)"
            @keydown.space.prevent.stop="$emit('add', group.book)"
          >加入书架</v-chip>
        </span>
      </span>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { mdiLayers, mdiPencilOutline, mdiPlusCircleOutline } from '@mdi/js'
import BookCover from './BookCover.vue'
import {
  groupRemoteResultsByBook,
  remoteBookAuthor,
  remoteBookChapterCount,
  remoteBookKey,
  remoteBookLastCheckTime,
  remoteBookLatestChapter,
  remoteBookSourceName,
  remoteBookTitle,
} from '../utils/remoteBookResult.js'
import { relativeShelfTimeLabel } from '../utils/shelfPresentation.js'

const props = defineProps({
  books: { type: Array, default: () => [] },
  addingBookKey: { type: String, default: '' },
  fallbackSourceId: { type: [String, Number], default: '' },
  isNight: { type: Boolean, default: false },
})

defineEmits(['preview', 'read', 'add', 'edit'])

// One card per book; every source row stays reachable through the picker.
const groupedBooks = computed(() => groupRemoteResultsByBook(props.books))

function bookKey(book) {
  return remoteBookKey(book, props.fallbackSourceId)
}

function sourceName(source) {
  return remoteBookSourceName(source) || `书源 ${remoteBookSourceIdOf(source) || '?'}`
}

function remoteBookSourceIdOf(source) {
  return source?.sourceId ?? source?.id ?? ''
}

function latestChapterLabel(book) {
  const rawTime = remoteBookLastCheckTime(book)
  return rawTime ? relativeShelfTimeLabel(rawTime) : '最新'
}
</script>

<style scoped>
.result-source-pick {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 10px;
  color: var(--app-primary-strong);
  font-size: 12px;
  font-weight: 600;
  background: var(--app-primary-soft);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
}

.result-source-pick:hover {
  filter: brightness(0.97);
}

.result-source-list {
  max-height: min(320px, 50vh);
  overflow-y: auto;
}
</style>

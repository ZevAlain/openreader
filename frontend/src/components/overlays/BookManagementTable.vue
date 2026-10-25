<template>
  <v-data-table
    v-model="selected"
    :headers="tableHeaders"
    :items="books"
    item-value="id"
    show-select
    density="compact"
    :items-per-page="-1"
    no-data-text="暂无数据"
    :height="isMobile ? 'calc(100dvh - 226px)' : 'min(358px, calc(70dvh - 226px))'"
    class="book-manage-table"
  >
    <template #item.title="{ item }">
      <v-btn variant="text" size="small" class="text-button" @click="emit('open-info', item)">
        {{ item.title }}
      </v-btn>
    </template>
    <template #item.chapters="{ item }">
      <span>共 {{ item.chapterCount || 0 }} 章</span><br>
      <template v-if="Number(item.sourceId || 0) > 0">
        <span>服务器缓存： {{ serverCacheCount(item) }} 章</span><br>
      </template>
      <span>浏览器缓存： {{ localCacheCount(item) }} 章</span>
    </template>
    <template #item.actions="{ item }">
      <BookManagementActions
        :book="item"
        :caching="isCachingBook(item)"
        @edit="emit('open-edit', item)"
        @group="emit('set-group', item)"
        @cache="command => emit('cache', item, command)"
        @export="format => emit('export', item, format)"
      />
    </template>
  </v-data-table>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BookManagementActions from './BookManagementActions.vue'

const props = defineProps({
  books: {
    type: Array,
    default: () => [],
  },
  isMobile: {
    type: Boolean,
    default: false,
  },
  isCachingBook: {
    type: Function,
    required: true,
  },
  categoryName: {
    type: Function,
    required: true,
  },
  serverCacheCount: {
    type: Function,
    required: true,
  },
  localCacheCount: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits([
  'selection-change',
  'open-info',
  'open-edit',
  'set-group',
  'cache',
  'export',
])
const selected = ref([])

const tableHeaders = computed(() => [
  { key: 'data-table-select', fixed: props.isMobile ? 'start' : false, width: 44 },
  { title: '书名名', key: 'title', fixed: props.isMobile ? 'start' : false, minWidth: 100 },
  { title: '作者', key: 'author', minWidth: 100 },
  { title: '分组', key: 'groupName', value: item => props.categoryName(item), minWidth: 120 },
  { title: '章节', key: 'chapters', sortable: false, minWidth: 120 },
  { title: '操作', key: 'actions', sortable: false, width: 240 },
])

// v-model holds the selected row ids (item-value); re-emit the parent's row-object contract.
watch(selected, ids => {
  emit('selection-change', props.books.filter(book => ids.includes(Number(book.id))))
}, { deep: true })

function clearSelection() {
  selected.value = []
}

defineExpose({ clearSelection })
</script>

<style scoped>
.text-button {
  padding: 3px 5px;
}
</style>

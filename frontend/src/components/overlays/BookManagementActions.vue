<template>
  <v-btn variant="text" size="small" class="text-button" @click="emit('edit')">
    编辑
  </v-btn>
  <v-btn variant="text" size="small" class="text-button" @click="emit('group')">
    分组
  </v-btn>
  <v-menu>
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" variant="text" size="small" class="text-button">
        <span v-if="caching" class="cache-loading">
          <v-progress-circular indeterminate size="13" width="2" /> 缓存中
        </span>
        <span v-else>
          缓存<v-icon :icon="mdiChevronDown" size="xs" end />
        </span>
      </v-btn>
    </template>
    <v-list density="compact">
      <v-list-item v-if="!isLocalBook" title="缓存到服务器" @click="emit('cache', 'cacheBook')" />
      <v-list-item title="缓存到浏览器" @click="emit('cache', 'cacheBookLocal')" />
      <v-list-item v-if="!isLocalBook" title="删除服务器缓存" @click="emit('cache', 'deleteBookCache')" />
      <v-list-item title="删除浏览器缓存" @click="emit('cache', 'deleteBookLocalCache')" />
    </v-list>
  </v-menu>
  <v-menu>
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" variant="text" size="small" class="text-button">
        导出<v-icon :icon="mdiChevronDown" size="xs" end />
      </v-btn>
    </template>
    <v-list density="compact">
      <v-list-item title="导出为TXT" @click="emit('export', 'txt')" />
      <v-list-item title="导出为Epub" @click="emit('export', 'epub')" />
    </v-list>
  </v-menu>
</template>

<script setup>
import { computed } from 'vue'
import { mdiChevronDown } from '@mdi/js'

const props = defineProps({
  book: {
    type: Object,
    required: true,
  },
  caching: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['edit', 'group', 'cache', 'export'])
const isLocalBook = computed(() => Number(props.book.sourceId || 0) === 0)
</script>

<style scoped>
.text-button {
  padding: 3px 5px;
  margin-left: 0;
}

.cache-loading {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>

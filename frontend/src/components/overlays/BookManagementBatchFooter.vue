<template>
  <div class="manage-footer">
    <div class="manage-footer-left">
      <v-btn
        color="primary"
        :loading="busy"
        @click="emit('delete-selected')"
      >
        批量删除
      </v-btn>
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" color="primary" :loading="busy">
            批量添加分组<v-icon :icon="mdiChevronDown" size="xs" end />
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="category in categories"
            :key="category.id"
            :title="category.name"
            @click="emit('add-category', category)"
          />
        </v-list>
      </v-menu>
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" color="primary" :loading="busy">
            批量移除分组<v-icon :icon="mdiChevronDown" size="xs" end />
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="category in categories"
            :key="category.id"
            :title="category.name"
            @click="emit('remove-category', category)"
          />
        </v-list>
      </v-menu>
      <span class="check-tip">已选择 {{ selectedCount }} 个</span>
    </div>
    <v-btn variant="text" @click="emit('close')">取消</v-btn>
  </div>
</template>

<script setup>
import { mdiChevronDown } from '@mdi/js'

defineProps({
  categories: {
    type: Array,
    default: () => [],
  },
  selectedCount: {
    type: Number,
    default: 0,
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'delete-selected',
  'add-category',
  'remove-category',
  'close',
])
</script>

<style scoped>
.manage-footer,
.manage-footer-left {
  display: flex;
  align-items: center;
}

.manage-footer {
  min-width: 0;
  justify-content: space-between;
  gap: 10px;
}

.manage-footer-left {
  min-width: 0;
  flex-wrap: wrap;
  gap: 5px;
}

.check-tip {
  margin-left: 5px;
  color: var(--app-text-muted);
  font-size: 13px;
  white-space: nowrap;
}

@media (max-width: 750px) {
  .manage-footer {
    align-items: flex-end;
  }

  .manage-footer-left {
    align-items: flex-start;
  }
}
</style>

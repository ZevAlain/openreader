<template>
  <v-dialog
    :model-value="modelValue"
    width="min(1000px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="rss-source-import-dialog"
    @update:model-value="handleVisibleChange"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">导入RSS源</h2>
      </header>
      <div class="app-dialog-body rss-import-source-list">
        <v-checkbox
          v-for="(source, index) in sources"
          :key="index"
          :model-value="selected.includes(index)"
          density="compact"
          hide-details
          class="rss-source-checkbox"
          @update:model-value="checked => toggleSelected(index, checked)"
        >
          <template #label>
            <span class="rss-source-line">{{ source.sourceName }} {{ source.sourceUrl }} {{ riskText(source) }}</span>
          </template>
        </v-checkbox>
      </div>
      <footer class="app-dialog-actions">
        <div class="rss-import-footer">
          <v-checkbox
            :model-value="checkAll"
            :indeterminate="indeterminate"
            density="compact"
            hide-details
            label="全选"
            @update:model-value="value => $emit('check-all', value)"
          />
          <span class="rss-import-count">已选择 {{ selected.length }} 个</span>
          <span class="rss-import-spacer" />
          <v-btn variant="text" @click="$emit('cancel')">取消</v-btn>
          <v-btn color="primary" :loading="saving" @click="$emit('confirm')">确定</v-btn>
        </div>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { rssSourceRiskTags } from '../../utils/rssSourceImport'

const props = defineProps({
  modelValue: Boolean,
  sources: {
    type: Array,
    default: () => [],
  },
  selected: {
    type: Array,
    default: () => [],
  },
  checkAll: Boolean,
  indeterminate: Boolean,
  isMobile: Boolean,
  saving: Boolean,
})

const emit = defineEmits([
  'update:modelValue',
  'update:selected',
  'check-all',
  'cancel',
  'confirm',
])

function handleVisibleChange(visible) {
  emit('update:modelValue', visible)
  if (!visible) emit('cancel')
}

function toggleSelected(index, checked) {
  const next = props.selected.filter(value => value !== index)
  if (checked) next.push(index)
  next.sort((a, b) => a - b)
  emit('update:selected', next)
}

function riskText(source) {
  return rssSourceRiskTags(source).join('  ')
}
</script>

<style scoped>
.rss-import-source-list {
  max-height: calc(var(--vh, 1vh) * 70 - 114px);
  overflow-y: auto;
}

.rss-source-checkbox {
  display: flex;
  margin: 0;
  padding: 8px 4px;
  white-space: normal;
}

.rss-source-line {
  overflow-wrap: anywhere;
}

.rss-import-footer {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 10px;
}

.rss-import-count {
  font-size: 14px;
}

.rss-import-spacer {
  flex: 1;
}

@media (max-width: 750px) {
  .rss-import-source-list {
    max-height: calc(var(--vh, 1vh) * 100 - 114px);
  }

  .rss-import-footer {
    gap: 6px;
  }
}
</style>

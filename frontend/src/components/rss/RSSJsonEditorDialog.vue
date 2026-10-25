<template>
  <v-dialog
    :model-value="modelValue"
    width="min(1000px, max(750px, 70vw))"
    :fullscreen="isMobile"
    class="rss-source-editor-dialog"
    @update:model-value="handleVisibleChange"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">编辑RSS源</h2>
      </header>
      <div class="app-dialog-body">
        <v-textarea
          :model-value="content"
          class="rss-json-editor"
          :rows="18"
          auto-grow
          max-rows="30"
          variant="outlined"
          hide-details
          spellcheck="false"
          @update:model-value="$emit('update:content', $event)"
        />
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="$emit('close')">取 消</v-btn>
        <v-btn color="primary" :loading="saving" @click="$emit('save')">保 存</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
defineProps({
  modelValue: Boolean,
  content: {
    type: String,
    default: '',
  },
  isMobile: Boolean,
  saving: Boolean,
})

const emit = defineEmits(['update:modelValue', 'update:content', 'close', 'save'])

function handleVisibleChange(visible) {
  emit('update:modelValue', visible)
  if (!visible) emit('close')
}
</script>

<style scoped>
.rss-json-editor :deep(textarea) {
  min-height: min(58vh, 620px);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.55;
  tab-size: 4;
}
</style>

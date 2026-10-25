<template>
  <v-dialog
    :model-value="visible"
    :fullscreen="isMobile"
    :persistent="saving"
    max-width="min(500px, calc(100vw - 48px))"
    @update:model-value="handleVisibilityChange"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">保存书籍</h2>
      </header>
      <div class="app-dialog-body">
        <v-textarea
          :model-value="content"
          :rows="18"
          aria-label="书籍 JSON"
          class="json-editor-field"
          variant="outlined"
          hide-details
          @update:model-value="$emit('update:content', $event)"
        />
      </div>
      <footer class="app-dialog-actions">
        <v-btn :disabled="saving" variant="text" @click="$emit('close')">取 消</v-btn>
        <v-btn color="primary" :loading="saving" @click="$emit('save')">保 存</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  content: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
})

const emit = defineEmits(['update:content', 'close', 'save'])

function handleVisibilityChange(value) {
  if (!value) emit('close')
}
</script>

<style scoped>
.json-editor-field :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  line-height: 1.55;
}
</style>

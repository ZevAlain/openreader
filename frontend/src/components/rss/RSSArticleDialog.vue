<template>
  <v-dialog
    :model-value="modelValue"
    width="500px"
    :fullscreen="isMobile"
    class="rss-article-content-dialog"
    @update:model-value="handleVisibleChange"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">{{ title }}</h2>
      </header>
      <div class="app-dialog-body rss-article-info-container">
        <div
          ref="contentRoot"
          class="rss-article-content"
          v-html="content"
          @click="handleContentClick"
        />
      </div>
    </div>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: Boolean,
  title: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    default: '',
  },
  isMobile: Boolean,
})

const emit = defineEmits(['update:modelValue', 'close', 'preview-images'])
const contentRoot = ref(null)

function handleVisibleChange(visible) {
  emit('update:modelValue', visible)
  if (!visible) emit('close')
}

function handleContentClick(event) {
  const image = event.target?.closest?.('img')
  if (!image || !contentRoot.value) return
  const nodes = Array.from(contentRoot.value.querySelectorAll('img'))
  const images = nodes.map(node => node.currentSrc || node.src).filter(Boolean)
  if (!images.length) return
  emit('preview-images', {
    images,
    index: Math.max(0, nodes.indexOf(image)),
  })
}
</script>

<style scoped>
.rss-article-info-container {
  max-height: calc(var(--vh, 1vh) * 70 - 114px);
  overflow-y: auto;
}

.rss-article-content {
  color: var(--app-text);
}

.rss-article-content :deep(img),
.rss-article-content :deep(video) {
  max-width: 100%;
}

@media (max-width: 750px) {
  .rss-article-info-container {
    max-height: calc(var(--vh, 1vh) * 100 - 94px);
  }
}
</style>

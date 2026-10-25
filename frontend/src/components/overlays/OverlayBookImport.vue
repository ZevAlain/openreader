<template>
  <v-dialog
    v-model="overlay.importBookVisible"
    :fullscreen="isMobile"
    max-width="520px"
    @after-leave="resetPicker"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">导入本地书籍</h2>
      </header>
      <div class="app-dialog-body">
        <div
          class="import-dropzone"
          role="button"
          tabindex="0"
          aria-label="拖入或选择 TXT / EPUB / UMD / CBZ 文件"
          @click="openPicker"
          @keydown.enter="openPicker"
          @drop.prevent="handleDrop"
          @dragover.prevent
        >
          <v-icon :icon="mdiCloudUploadOutline" class="upload-icon" />
          <div class="upload-text">拖入或选择 TXT / EPUB / UMD / CBZ 文件</div>
          <input
            ref="picker"
            type="file"
            multiple
            accept=".txt,.epub,.umd,.cbz"
            class="import-file-input"
            @change="handleInputChange"
          >
        </div>
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="overlay.importBookVisible = false">取消</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { mdiCloudUploadOutline } from '@mdi/js'
import { message } from '../../composables/useAppFeedback.js'
import { useOverlayStore } from '../../stores/overlay'
import { isDirectImportableLocalPath } from '../../utils/localBookToc'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const maxFiles = 64
const overlay = useOverlayStore()
const picker = ref(null)

function openPicker() {
  picker.value?.click()
}

function handleDrop(event) {
  importFiles(event.dataTransfer?.files)
}

function handleInputChange(event) {
  importFiles(event.target?.files)
  resetPicker()
}

function importFiles(fileList) {
  const files = Array.from(fileList || [])
  if (!files.length) return
  if (files.length > maxFiles) {
    message.error(`一次最多导入 ${maxFiles} 本书籍`)
    return
  }
  if (files.some(file => !isDirectImportableLocalPath(file.name))) {
    message.error('仅支持 TXT / EPUB / UMD / CBZ 格式')
    return
  }
  overlay.importBookVisible = false
  overlay.openStorageImport('direct', files)
}

function resetPicker() {
  if (picker.value) picker.value.value = ''
}
</script>

<style scoped>
.import-dropzone {
  display: grid;
  gap: 10px;
  justify-items: center;
  padding: 34px 18px;
  border-radius: var(--app-radius-lg, 16px);
  border: 1px dashed var(--app-border-strong);
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease;
}

.import-dropzone:hover,
.import-dropzone:focus-visible {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  outline: none;
}

.import-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.upload-icon {
  color: var(--app-primary);
  font-size: 32px;
}

.upload-text {
  color: var(--app-text-muted);
  overflow-wrap: anywhere;
}
</style>

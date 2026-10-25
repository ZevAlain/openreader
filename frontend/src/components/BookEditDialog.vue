<template>
  <v-dialog
    :model-value="modelValue"
    max-width="min(540px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">编辑书籍</h2>
      </header>
      <div class="app-dialog-body">
        <div class="book-editor">
          <v-text-field v-model="draft.title" label="书名" variant="outlined" density="compact" hide-details />
          <v-text-field v-model="draft.author" label="作者" variant="outlined" density="compact" hide-details />
          <div class="cover-field">
            <div class="cover-upload-row">
              <v-text-field v-model="draft.customCoverUrl" label="自定义封面（上传）" placeholder="请上传 JPG/PNG 封面" readonly variant="outlined" density="compact" hide-details />
              <v-btn :loading="uploadingCover" @click="pickCover">上传</v-btn>
              <input
                ref="coverInput"
                class="cover-file-input"
                type="file"
                accept="image/jpg,image/png,image/jpeg"
                @change="onCoverChange"
              >
            </div>
          </div>
          <v-textarea v-model="draft.intro" label="简介" :rows="5" variant="outlined" hide-details />
        </div>
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="emit('update:modelValue', false)">取消</v-btn>
        <v-btn color="primary" :loading="saving" @click="submit">保存</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message } from '../composables/useAppFeedback.js'
import { uploadAsset } from '../api/uploads'
import { useReaderStore } from '../stores/reader'
import { currentViewportWidth, shouldUseMiniInterface } from '../utils/responsive'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  book: {
    type: Object,
    default: null,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'save'])
const reader = useReaderStore()
const windowWidth = ref(currentViewportWidth())
const uploadingCover = ref(false)
const coverInput = ref(null)
const draft = reactive({
  title: '',
  author: '',
  customCoverUrl: '',
  intro: '',
})

const isMobile = computed(() => shouldUseMiniInterface(reader.pageMode, windowWidth.value))

watch(
  () => [props.modelValue, props.book],
  ([visible]) => {
    if (visible) resetDraft()
  },
)

onMounted(() => window.addEventListener('resize', updateWindowWidth, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('resize', updateWindowWidth))

function updateWindowWidth() {
  windowWidth.value = currentViewportWidth()
}

function resetDraft() {
  Object.assign(draft, {
    title: props.book?.title || props.book?.name || '',
    author: props.book?.author || '',
    customCoverUrl: props.book?.customCoverUrl || '',
    intro: props.book?.intro || '',
  })
}

function pickCover() {
  coverInput.value?.click()
}

function onCoverChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) uploadCover({ file })
}

async function uploadCover(data) {
  const file = data.raw || data.file
  if (!file) return
  uploadingCover.value = true
  try {
    const { data: result } = await uploadAsset({ file, type: 'cover' })
    draft.customCoverUrl = result.url
    message.success('封面已上传')
  } catch (err) {
    message.error(readError(err, '上传封面失败'))
  } finally {
    uploadingCover.value = false
  }
}

function submit() {
  const title = draft.title.trim()
  if (!title) {
    message.warning('书名不能为空')
    return
  }
  emit('save', {
    title,
    author: draft.author.trim(),
    customCoverUrl: draft.customCoverUrl.trim(),
    intro: draft.intro,
  })
}

function readError(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.error || fallback
}
</script>

<style scoped>
.book-editor {
  display: grid;
  gap: 12px;
}

.cover-upload-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
}

.cover-upload-row .v-text-field {
  min-width: 0;
  flex: 1;
}

.cover-file-input {
  display: none;
}

@media (max-width: 750px) {
  .cover-upload-row {
    align-items: stretch;
  }
}
</style>

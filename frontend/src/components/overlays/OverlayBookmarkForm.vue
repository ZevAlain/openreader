<template>
  <v-dialog
    :model-value="overlay.bookmarkFormVisible"
    width="min(1000px, max(750px, 70vw))"
    :fullscreen="isMobile"
    class="global-bookmark-form-dialog"
    @update:model-value="handleVisibleChange"
    @after-leave="overlay.clearBookmarkForm()"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">书签</h2>
      </header>
      <div class="app-dialog-body">
        <div v-if="draft" class="bookmark-form">
          <v-text-field :model-value="bookTitle" label="书名" readonly variant="outlined" density="compact" hide-details />
          <v-text-field :model-value="bookAuthor" label="作者" readonly variant="outlined" density="compact" hide-details />
          <v-text-field :model-value="draft.title || ''" label="章节" readonly variant="outlined" density="compact" hide-details />
          <v-textarea :model-value="draft.excerpt || ''" label="内容" :rows="5" readonly variant="outlined" hide-details />
          <v-textarea v-model="draft.note" label="备注" :rows="3" variant="outlined" hide-details />
        </div>
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="overlay.finishBookmarkForm({ saved: false, reason: 'cancel' })">取消</v-btn>
        <v-btn color="primary" :loading="saving" @click="save">确定</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { message } from '../../composables/useAppFeedback.js'
import { createBookmark, updateBookmark } from '../../api/books'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useOverlayStore } from '../../stores/overlay'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const overlay = useOverlayStore()
const operations = useAuthenticatedOperationGuard()
const saving = ref(false)
const draft = computed(() => overlay.bookmarkFormDraft)
const book = computed(() => overlay.bookmarkFormBook)
const bookTitle = computed(() => book.value?.title || book.value?.name || '')
const bookAuthor = computed(() => book.value?.author || '')

function handleVisibleChange(visible) {
  if (!visible) overlay.finishBookmarkForm({ saved: false, reason: 'close' })
}

async function save() {
  const currentBook = book.value
  const currentDraft = draft.value
  if (!currentBook?.id) {
    message.error('书籍信息错误')
    return
  }
  if (!String(currentDraft?.excerpt || '').trim()) {
    message.error('书签内容不能为空')
    return
  }

  const operation = operations.begin('save-bookmark')
  saving.value = true
  try {
    const payload = bookmarkPayload(currentDraft)
    let bookmark
    if (overlay.bookmarkFormMode === 'edit' && currentDraft.id) {
      const { data } = await updateBookmark(currentDraft.id, { note: payload.note })
      bookmark = data
      if (!operations.canCommit(operation)) return
      message.success('编辑书签成功')
    } else {
      const { data } = await createBookmark(currentBook.id, payload)
      bookmark = data
      if (!operations.canCommit(operation)) return
      message.success('新增书签成功')
    }
    dispatchBookmarksUpdated(currentBook.id)
    overlay.finishBookmarkForm({
      saved: true,
      bookmarkId: bookmark?.id || currentDraft.id,
    })
  } catch (error) {
    if (operations.canCommit(operation)) {
      message.error(readError(error, `${overlay.bookmarkFormMode === 'edit' ? '编辑' : '新增'}书签失败`))
    }
  } finally {
    if (operations.canCommit(operation)) saving.value = false
  }
}

function bookmarkPayload(source = {}) {
  return {
    chapterId: source.chapterId,
    chapterIndex: Number(source.chapterIndex || 0),
    offset: Math.max(0, Number(source.offset || 0)),
    percent: Number.isFinite(Number(source.percent)) ? Number(source.percent) : 0,
    title: source.title || '',
    excerpt: source.excerpt || '',
    note: source.note || '',
  }
}

function dispatchBookmarksUpdated(bookId) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('openreader:bookmarks-updated', {
    detail: { bookIds: [bookId] },
  }))
}

function readError(error, fallback) {
  return error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    fallback
}
</script>

<style scoped>
.bookmark-form {
  display: grid;
  gap: 12px;
}
</style>

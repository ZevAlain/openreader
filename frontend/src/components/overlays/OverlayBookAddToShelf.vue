<template>
  <v-dialog
    v-model="overlay.bookAddCategoryVisible"
    :fullscreen="isMobile"
    max-width="min(440px, calc(100vw - 48px))"
    @after-leave="overlay.finishBookAddCategories()"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">设置分组</h2>
      </header>
      <div class="app-dialog-body book-add-category-body">
        <span>请选择分组：</span>
        <v-select
          v-model="overlay.bookAddCategoryIds"
          :items="categoryItems"
          multiple
          clearable
          chips
          placeholder="未分组"
          variant="outlined"
          density="compact"
          hide-details
        />
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="overlay.finishBookAddCategories()">暂不加入</v-btn>
        <v-btn color="primary" @click="overlay.finishBookAddCategories(overlay.bookAddCategoryIds)">确定</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, watch } from 'vue'
import { message } from '../../composables/useAppFeedback.js'
import { useBookshelfStore } from '../../stores/bookshelf'
import { useOverlayStore } from '../../stores/overlay'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const bookshelf = useBookshelfStore()
const overlay = useOverlayStore()

const categoryItems = computed(() => bookshelf.categories.map(category => ({ title: category.name, value: Number(category.id) })))

watch(
  () => overlay.bookAddCategoryVisible,
  visible => {
    if (!visible) return
    bookshelf.ensureCategoriesLoaded().catch(() => {
      message.warning('分组加载失败，仍可选择未分组加入书架')
    })
  },
)
</script>

<style scoped>
.book-add-category-body {
  display: grid;
  gap: 12px;
  text-align: center;
}
</style>

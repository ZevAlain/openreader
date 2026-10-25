<template>
  <v-dialog
    :model-value="modelValue"
    :fullscreen="isMiniInterface"
    max-width="500px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">书籍信息</h2>
      </header>
      <div class="app-dialog-body">
        <BookInfoPanel
          v-if="book"
          :book="book"
          :source-name="sourceName"
          :category-name="categoryName"
          :cover-editable="coverEditable"
          :cover-uploading="coverUploading"
          :can-update="canUpdate"
          :update-switch-loading="updateSwitchLoading"
          :in-shelf="inShelf"
          :show-local-refresh-action="showLocalRefreshAction"
          :local-refresh-loading="localRefreshLoading"
          :show-add-action="showAddAction"
          :add-loading="addLoading"
          :is-night="isNight"
          @cover-upload="$emit('coverUpload', $event)"
          @can-update-change="$emit('canUpdateChange', $event)"
          @category-action="$emit('categoryAction')"
          @local-refresh="$emit('localRefresh')"
          @add="$emit('add')"
        />
      </div>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BookInfoPanel from './BookInfoPanel.vue'
import { useReaderStore } from '../stores/reader'
import { currentViewportWidth, shouldUseMiniInterface } from '../utils/responsive'

defineProps({
  modelValue: { type: Boolean, default: false },
  book: { type: Object, default: null },
  sourceName: { type: String, default: '' },
  categoryName: { type: String, default: '' },
  coverEditable: { type: Boolean, default: false },
  coverUploading: { type: Boolean, default: false },
  canUpdate: { type: Boolean, default: true },
  updateSwitchLoading: { type: Boolean, default: false },
  inShelf: { type: Boolean, default: true },
  showLocalRefreshAction: { type: Boolean, default: false },
  localRefreshLoading: { type: Boolean, default: false },
  showAddAction: { type: Boolean, default: false },
  addLoading: { type: Boolean, default: false },
})

defineEmits(['update:modelValue', 'coverUpload', 'canUpdateChange', 'categoryAction', 'localRefresh', 'add'])

const reader = useReaderStore()
const windowWidth = ref(currentViewportWidth())
const isMiniInterface = computed(() => shouldUseMiniInterface(reader.pageMode, windowWidth.value))
const isNight = computed(() => reader.themeType === 'night')

function handleResize() {
  windowWidth.value = currentViewportWidth()
}

onMounted(() => window.addEventListener('resize', handleResize))
onBeforeUnmount(() => window.removeEventListener('resize', handleResize))
</script>

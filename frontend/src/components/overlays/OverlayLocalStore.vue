<template>
  <v-dialog
    v-model="overlay.localStoreVisible"
    :fullscreen="isMobile"
    max-width="min(1120px, calc(100vw - 48px))"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">书仓文件管理</h2>
      </header>
      <div class="app-dialog-body">
        <LocalStoreManager />
      </div>
    </div>
  </v-dialog>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import { useOverlayStore } from '../../stores/overlay'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const LocalStoreManager = defineAsyncComponent(() => import('../workspace/LocalStoreManager.vue'))
const overlay = useOverlayStore()
</script>

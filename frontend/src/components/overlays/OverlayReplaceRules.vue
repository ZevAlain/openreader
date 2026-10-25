<template>
  <v-dialog
    v-model="overlay.replaceRulesVisible"
    width="min(1000px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="global-replace-dialog"
    @after-leave="resetManager"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <div class="replace-dialog-header">
          <h2 class="app-dialog-title">替换规则管理</h2>
          <v-btn
            variant="text"
            :loading="replaceRuleImporting"
            @click="triggerReplaceRuleImport"
          >
            导入
          </v-btn>
          <input
            ref="replaceRuleFileInput"
            class="visually-hidden-file"
            type="file"
            accept=".json,application/json"
            @change="importReplaceRuleFile"
          />
        </div>
      </header>

      <div class="app-dialog-body">
        <section class="replace-overlay">
          <v-data-table
            v-model="selectedRuleKeys"
            :headers="tableHeaders"
            :items="replaceRules"
            item-value="id"
            show-select
            density="compact"
            :items-per-page="-1"
            no-data-text="暂无数据"
            :loading="replaceRulesLoading"
            class="replace-rule-table"
            :height="isMobile ? 'calc(100dvh - 184px)' : 'min(400px, calc(70dvh - 184px))'"
            @update:model-value="onTableSelectionChange"
          >
            <template #item.enabled="{ item }">
              <v-switch
                :model-value="normalizeReplaceRule(item).enabled"
                color="primary"
                density="compact"
                hide-details
                @update:model-value="value => toggleReplaceRule(item, value)"
              />
            </template>
            <template #item.actions="{ item }">
              <v-btn variant="text" size="small" @click="openReplaceRuleEditor(item)">编辑</v-btn>
            </template>
          </v-data-table>
        </section>
      </div>

      <footer class="app-dialog-actions">
        <div class="replace-manager-footer">
          <div>
            <v-btn color="primary" @click="deleteSelectedReplaceRules">
              批量删除
            </v-btn>
            <span>已选择 {{ selectedReplaceRuleIds.length }} 个</span>
          </div>
          <v-btn variant="text" @click="overlay.replaceRulesVisible = false">取消</v-btn>
        </div>
      </footer>
    </div>
  </v-dialog>

  <v-dialog
    v-model="replaceRuleDialog"
    width="min(1000px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="replace-rule-editor-dialog"
    @after-leave="overlay.clearReplaceRuleEditor()"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">替换规则</h2>
      </header>
      <div class="app-dialog-body">
        <div class="replace-rule-form">
          <v-text-field v-model="replaceRuleDraft.name" label="名称" variant="outlined" density="compact" hide-details />
          <v-text-field v-model="replaceRuleDraft.pattern" label="规则" variant="outlined" density="compact" hide-details />
          <v-text-field v-model="replaceRuleDraft.replacement" label="替换为" variant="outlined" density="compact" hide-details />
          <v-text-field
            v-model="replaceRuleDraft.scope"
            label="替换范围"
            placeholder="* 或 书名 或 书名;书籍地址"
            variant="outlined"
            density="compact"
            hide-details
          />
          <div class="replace-rule-checks">
            <v-checkbox v-model="replaceRuleDraft.isRegex" density="compact" hide-details label="使用正则表达式" />
            <v-checkbox v-model="replaceRuleDraft.enabled" density="compact" hide-details label="是否启用" />
          </div>
        </div>
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="replaceRuleDialog = false">取 消</v-btn>
        <v-btn
          color="primary"
          :loading="replaceRuleSaving"
          @click="saveReplaceRule"
        >
          确 定
        </v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { confirm, message } from '../../composables/useAppFeedback.js'
import * as replaceRulesApi from '../../api/replaceRules'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useOverlayReplaceRules } from '../../composables/useOverlayReplaceRules'
import { useOverlayStore } from '../../stores/overlay'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const overlay = useOverlayStore()
const managerOperations = useAuthenticatedOperationGuard()
const editorOperations = useAuthenticatedOperationGuard()
const selectedRuleKeys = ref([])

const {
  rules: replaceRules,
  loading: replaceRulesLoading,
  importing: replaceRuleImporting,
  selectedIds: selectedReplaceRuleIds,
  fileInput: replaceRuleFileInput,
  dialogVisible: replaceRuleDialog,
  saving: replaceRuleSaving,
  draft: replaceRuleDraft,
  load: loadReplaceRules,
  resetManager,
  handleUpdated: handleReplaceRulesUpdated,
  clearRefresh: clearReplaceRulesRefreshTimer,
  changeSelection: onReplaceRuleSelectionChange,
  triggerImport: triggerReplaceRuleImport,
  importFile: importReplaceRuleFile,
  normalize: normalizeReplaceRule,
  openEditor: openReplaceRuleEditor,
  save: saveReplaceRule,
  toggle: toggleReplaceRule,
  removeSelected: deleteSelectedReplaceRules,
} = useOverlayReplaceRules({
  managerOperationGuard: managerOperations,
  editorOperationGuard: editorOperations,
  isActive: () => overlay.replaceRulesVisible,
  ...replaceRulesApi,
  confirm: (text, title, config = {}) =>
    confirm({
      message: text,
      title,
      confirmText: config.confirmButtonText,
      cancelText: config.cancelButtonText,
      tone: config.type === 'warning' ? 'warning' : 'primary',
    }).then(action => {
      if (action !== 'confirm') return Promise.reject('cancel')
    }),
  notifyUpdated: () => {
    window.dispatchEvent(new CustomEvent(
      'openreader:replace-rules-updated',
      { detail: { local: true } },
    ))
  },
  onSuccess: text => message.success(text),
  onWarning: text => message.warning(text),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})

const tableHeaders = computed(() => [
  { key: 'data-table-select', fixed: false, width: 44 },
  { title: '规则名称', key: 'name', minWidth: 150 },
  { title: '替换范围', key: 'scope', minWidth: 150 },
  { title: '是否启用', key: 'enabled', sortable: false, minWidth: 80 },
  { title: '操作', key: 'actions', sortable: false, width: 100 },
])

function onTableSelectionChange(ids) {
  const rows = replaceRules.value.filter(rule => ids.includes(rule.id))
  onReplaceRuleSelectionChange(rows)
}

onMounted(() => {
  window.addEventListener(
    'openreader:replace-rules-updated',
    handleReplaceRulesUpdated,
  )
})

watch(
  () => overlay.replaceRulesVisible,
  visible => {
    if (visible) loadReplaceRules()
  },
)

watch(
  () => overlay.replaceRuleEditorRequest,
  request => {
    if (request > 0) openReplaceRuleEditor(overlay.replaceRuleEditorDraft || {})
  },
)

onBeforeUnmount(() => {
  window.removeEventListener(
    'openreader:replace-rules-updated',
    handleReplaceRulesUpdated,
  )
  clearReplaceRulesRefreshTimer()
})

function readError(error, fallback) {
  return error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    fallback
}
</script>

<style scoped>
.replace-overlay {
  min-height: 0;
}

.replace-rule-form {
  display: grid;
  gap: 12px;
}

.replace-dialog-header,
.replace-manager-footer,
.replace-manager-footer > div,
.replace-rule-checks {
  display: flex;
  align-items: center;
}

.replace-manager-footer {
  flex: 1 1 auto;
  justify-content: space-between;
}

.replace-dialog-header {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: space-between;
  gap: 12px;
}

.replace-dialog-header .app-dialog-title {
  min-width: 0;
}

.replace-manager-footer > div {
  gap: 14px;
}

.replace-manager-footer span {
  color: var(--app-text-muted);
}

.replace-rule-checks {
  flex-wrap: wrap;
  gap: 24px;
}

.visually-hidden-file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  padding: 0;
  margin: -1px;
}

@media (max-width: 750px) {
  .replace-manager-footer {
    gap: 8px;
  }

  .replace-manager-footer > div {
    min-width: 0;
    gap: 8px;
  }

  .replace-manager-footer span {
    white-space: nowrap;
  }
}
</style>

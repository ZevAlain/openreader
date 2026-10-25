<template>
  <v-dialog
    v-model="overlay.userManageVisible"
    width="min(1120px, calc(100vw - 48px))"
    :fullscreen="isMobile"
    class="global-user-dialog"
    @after-leave="resetManager"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <div class="user-dialog-title">
          <h2 class="app-dialog-title">用户管理</h2>
          <v-btn variant="text" color="primary" @click="openCreateUserDialog">新增</v-btn>
        </div>
      </header>
      <div class="app-dialog-body">
        <section class="user-overlay">
          <v-data-table
            v-model="selectedUserKeys"
            :headers="tableHeaders"
            :items="users"
            item-value="id"
            show-select
            density="compact"
            :items-per-page="-1"
            no-data-text="暂无用户，或当前账号无管理员权限"
            :loading="usersLoading"
            class="user-manage-table"
            :height="isMobile ? 'calc(100dvh - 160px)' : 'min(620px, calc(100vh - 250px))'"
            @update:model-value="onTableSelectionChange"
          >
            <template #item.data-table-select="{ item }">
              <v-checkbox-btn
                v-if="isUserSelectable(item)"
                :model-value="selectedUserKeys.includes(item.id)"
                @update:model-value="checked => onToggleSelection(item, checked)"
              />
            </template>
            <template #item.lastLoginAt="{ item }">
              {{ formatUserTime(item.lastLoginAt) }}
            </template>
            <template #item.createdAt="{ item }">
              {{ formatUserTime(item.createdAt, '—') }}
            </template>
            <template #item.canAccessStore="{ item }">
              <v-switch
                v-if="isUserMutable(item)"
                v-model="item.canAccessStore"
                density="compact"
                color="primary"
                hide-details
                :loading="isPermissionUpdating(item, 'canAccessStore')"
                @update:model-value="value => updateUserPermission(item, 'canAccessStore', value)"
              />
            </template>
            <template #item.canEditSources="{ item }">
              <v-switch
                v-if="isUserMutable(item)"
                v-model="item.canEditSources"
                density="compact"
                color="primary"
                hide-details
                :loading="isPermissionUpdating(item, 'canEditSources')"
                @update:model-value="value => updateUserPermission(item, 'canEditSources', value)"
              />
              <span v-else class="protected-user-label">受保护账号</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn v-if="isUserMutable(item)" variant="text" size="small" @click="resetPassword(item)">重置密码</v-btn>
              <v-btn
                variant="text"
                size="small"
                :loading="defaultingSourceUserId === item.id"
                @click="setDefaultSources(item)"
              >
                设为默认书源
              </v-btn>
            </template>
          </v-data-table>

          <footer v-if="users.length" class="user-manage-footer">
            <v-btn
              color="primary"
              :loading="deletingUsers"
              @click="deleteSelectedUsers"
            >
              批量删除
            </v-btn>
            <v-btn
              color="primary"
              :loading="resettingSources"
              @click="resetSelectedSources"
            >
              删除用户书源
            </v-btn>
            <span class="check-tip">已选择 {{ selectedUserIds.length }} 个</span>
            <v-btn class="cancel-button" variant="text" @click="closeUserManager">取消</v-btn>
          </footer>
        </section>
      </div>
    </div>
  </v-dialog>

  <v-dialog
    v-model="userCreateDialog"
    width="420px"
    :fullscreen="isMobile"
  >
    <div class="app-dialog-card">
      <header class="app-dialog-head">
        <h2 class="app-dialog-title">新增用户</h2>
      </header>
      <div class="app-dialog-body">
        <div class="user-create-form">
          <v-text-field v-model="userDraft.username" label="用户名" autocomplete="on" variant="outlined" density="compact" hide-details />
          <v-text-field v-model="userDraft.password" label="密码" type="password" variant="outlined" density="compact" hide-details />
          <div class="permission-row">
            <label class="permission-switch">
              <v-switch v-model="userDraft.canEditSources" density="compact" color="primary" hide-details />
              书源
            </label>
            <label class="permission-switch">
              <v-switch v-model="userDraft.canAccessStore" density="compact" color="primary" hide-details />
              书仓
            </label>
          </div>
        </div>
      </div>
      <footer class="app-dialog-actions">
        <v-btn variant="text" @click="userCreateDialog = false">取消</v-btn>
        <v-btn color="primary" :loading="creatingUser" @click="createManagedUser">确定</v-btn>
      </footer>
    </div>
  </v-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { confirm, message, prompt } from '../../composables/useAppFeedback.js'
import * as adminApi from '../../api/admin'
import { useOverlayUserManagement } from '../../composables/useOverlayUserManagement'
import { useAuthenticatedOperationGuard } from '../../composables/useAuthenticatedOperationGuard'
import { useOverlayStore } from '../../stores/overlay'
import { useUserStore } from '../../stores/user'

defineProps({
  isMobile: {
    type: Boolean,
    default: false,
  },
})

const overlay = useOverlayStore()
const userStore = useUserStore()
const operations = useAuthenticatedOperationGuard()
const selectedUserKeys = ref([])

const {
  users,
  usersLoading,
  deletingUsers,
  resettingSources,
  defaultingSourceUserId,
  creatingUser,
  createDialogVisible: userCreateDialog,
  selectedUserIds,
  selectedDeletableUserIds,
  draft: userDraft,
  load: loadUsers,
  resetManager,
  handleUpdated: handleUsersUpdated,
  clearRefresh: clearUsersRefreshTimer,
  isSelectable: isUserSelectable,
  isMutable: isUserMutable,
  isPermissionUpdating,
  changeSelection: onUserSelectionChange,
  openCreateDialog: openCreateUserDialog,
  create: createManagedUser,
  resetPassword,
  removeSelected: deleteSelectedUsers,
  setDefaultSources,
  resetSelectedSources,
  updatePermission: updateUserPermission,
} = useOverlayUserManagement({
  operationGuard: operations,
  userStore,
  getCurrentUserId: () => userStore.profile?.id || null,
  isActive: () => overlay.userManageVisible,
  ...adminApi,
  prompt: (text, title, config = {}) => prompt({
    title,
    message: text,
    type: config.inputType === 'password' ? 'password' : 'text',
    validator: config.inputValidator,
    confirmText: config.confirmButtonText,
    cancelText: config.cancelButtonText,
  }),
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
  onSuccess: text => message.success(text),
  onWarning: text => message.warning(text),
  onError: (error, fallback) => message.error(readError(error, fallback)),
})

const tableHeaders = computed(() => [
  { key: 'data-table-select', fixed: false, width: 44 },
  { title: '用户名', key: 'username', fixed: false, minWidth: 120 },
  { title: '上次登录', key: 'lastLoginAt', minWidth: 150 },
  { title: '注册时间', key: 'createdAt', minWidth: 150 },
  { title: '书仓', key: 'canAccessStore', sortable: false, minWidth: 80 },
  { title: '书源编辑', key: 'canEditSources', sortable: false, minWidth: 100 },
  { title: '操作', key: 'actions', sortable: false, width: 190 },
])

function onToggleSelection(user, checked) {
  const current = new Set(selectedUserKeys.value)
  if (checked) current.add(user.id)
  else current.delete(user.id)
  selectedUserKeys.value = [...current]
  onUserSelectionChange(users.value.filter(item => selectedUserKeys.value.includes(item.id)))
}

function onTableSelectionChange(ids) {
  selectedUserKeys.value = ids
  onUserSelectionChange(users.value.filter(item => ids.includes(item.id)))
}

watch(
  () => overlay.userManageVisible,
  visible => {
    if (visible) loadUsers()
  },
)

onMounted(() => {
  window.addEventListener('openreader:users-updated', handleUsersUpdated)
})

onBeforeUnmount(() => {
  window.removeEventListener('openreader:users-updated', handleUsersUpdated)
  clearUsersRefreshTimer()
})

function readError(error, fallback) {
  return error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    fallback
}

function closeUserManager() {
  overlay.userManageVisible = false
}

function formatUserTime(value, emptyLabel = '') {
  if (!value) return emptyLabel
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return emptyLabel
  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.user-overlay {
  display: grid;
  gap: 12px;
}

.user-create-form {
  display: grid;
  gap: 12px;
}

.user-dialog-title {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.check-tip,
.protected-user-label {
  color: var(--app-text-muted);
  font-size: 12px;
}

.permission-row,
.user-manage-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.permission-row {
  gap: 12px;
}

.permission-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cancel-button {
  margin-left: auto;
}

@media (max-width: 750px) {
  .user-overlay {
    gap: 8px;
  }
}
</style>

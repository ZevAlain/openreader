<template>
  <v-dialog
    v-model="user.authDialogVisible"
    :persistent="user.authReason === 'session'"
    max-width="420px"
  >
    <div class="auth-dialog-card">
      <h2 class="auth-dialog-title">{{ user.authReason === 'session' ? '重新登录' : '登录' }}</h2>
      <AuthForm :reason="user.authReason" @success="handleSuccess" />
    </div>
  </v-dialog>
</template>

<script setup>
import { useRouter } from 'vue-router'
import AuthForm from './AuthForm.vue'
import { useUserStore } from '../stores/user'

const user = useUserStore()
const router = useRouter()

async function handleSuccess(result = {}) {
  if (!result.sameAuthenticatedScope) {
    await router.replace({ name: 'home' })
  }
  user.completeReauthentication()
}
</script>

<style scoped>
.auth-dialog-card {
  display: grid;
  width: calc(100vw - 28px);
  max-width: 420px;
  padding: 24px;
  border-radius: var(--app-radius-xl, 24px);
  background: var(--glass-panel-bg);
  backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-panel-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  color: var(--app-text);
}

.auth-dialog-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
}
</style>

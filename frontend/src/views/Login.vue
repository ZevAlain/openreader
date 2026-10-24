<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">OpenReader</h1>
      <p class="auth-sub">继续阅读</p>
      <AuthForm :reason="String(route.query.reason || '')" @success="handleSuccess" />
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import AuthForm from '../components/AuthForm.vue'
import { useUserStore } from '../stores/user'
import { safeReturnTo } from '../utils/authNavigation'

const router = useRouter()
const route = useRoute()
const user = useUserStore()

async function handleSuccess(result = {}) {
  if (result.previousScope && !result.sameAuthenticatedScope) {
    await router.replace({ name: 'home' })
    user.completeReauthentication()
    return
  }
  const returnTo = safeReturnTo(route.query.returnTo)
  await router.replace(returnTo)
  user.completeReauthentication()
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: calc(20px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom));
  background:
    radial-gradient(1200px 700px at 18% -8%, color-mix(in srgb, var(--app-primary) 16%, transparent), transparent 62%),
    radial-gradient(900px 620px at 96% 104%, color-mix(in srgb, var(--app-primary) 12%, transparent), transparent 58%),
    var(--app-bg);
}

.auth-card {
  width: min(400px, 100%);
  padding: 42px 36px;
  border: 1px solid var(--glass-panel-border);
  border-radius: var(--app-radius-xl);
  background: var(--glass-panel-bg);
  backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  box-shadow: var(--glass-shadow), var(--glass-highlight);
}

.auth-title {
  margin: 0 0 4px;
  color: var(--app-text);
  font-size: 28px;
  font-weight: 700;
  text-align: center;
}

.auth-sub {
  margin: 0 0 28px;
  color: var(--app-text-muted);
  font-size: 14px;
  text-align: center;
}
</style>

<template>
  <div class="auth-form">
    <v-alert
      v-if="reason === 'session'"
      type="warning"
      variant="tonal"
      icon="$warning"
      density="comfortable"
      class="auth-alert"
    >
      登录状态已失效，请重新登录
    </v-alert>

    <form class="auth-fields" @submit.prevent="submit">
      <v-text-field
        v-model="username"
        label="用户名"
        placeholder="请输入用户名"
        autocomplete="username"
        variant="filled"
        rounded="lg"
        hide-details="auto"
      />
      <v-text-field
        v-model="password"
        label="密码"
        type="password"
        placeholder="请输入密码"
        autocomplete="current-password"
        variant="filled"
        rounded="lg"
        hide-details="auto"
      />
      <v-btn
        type="submit"
        color="primary"
        size="large"
        rounded="pill"
        block
        :loading="loading"
        class="auth-btn"
      >
        {{ mode === 'login' ? '登录' : '注册' }}
      </v-btn>
    </form>

    <div class="auth-switch">
      <v-btn variant="text" color="primary" @click="toggleMode">
        {{ mode === 'login' ? '创建新账号' : '已有账号，去登录' }}
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from '../composables/useAppFeedback.js'
import { useUserStore } from '../stores/user'

defineProps({
  reason: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['success'])
const user = useUserStore()
const username = ref('')
const password = ref('')
const mode = ref('login')
const loading = ref(false)

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
}

async function submit() {
  loading.value = true
  try {
    const result = await user.login(username.value, password.value, mode.value)
    emit('success', result)
  } catch (err) {
    message.error(err?.response?.data?.error?.message || err?.response?.data?.error || '请求失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-alert {
  margin-bottom: 20px;
}

.auth-btn {
  width: 100%;
}

.auth-switch {
  margin-top: 12px;
  text-align: center;
}
</style>

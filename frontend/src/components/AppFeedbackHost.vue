<template>
  <div class="app-feedback-host" aria-live="polite">
    <TransitionGroup name="app-toast" tag="div" class="app-toast-stack">
      <div v-for="item in toastState.items" :key="item.id" class="app-toast" :class="item.kind" @click="dismiss(item.id)">
        <span class="app-toast-dot" />
        <span class="app-toast-text">{{ item.text }}</span>
      </div>
    </TransitionGroup>

    <div v-for="item in confirmState.queue" :key="item.id" class="app-confirm-scrim">
      <div class="app-confirm" role="alertdialog" :aria-label="item.title">
        <div class="app-confirm-sheet">
          <span class="app-confirm-grabber" />
        </div>
        <h2 class="app-confirm-title">{{ item.title }}</h2>
        <p v-if="item.message" class="app-confirm-message">{{ item.message }}</p>
        <div class="app-confirm-actions">
          <button class="app-confirm-btn cancel" type="button" @click="resolveConfirm(item.id, 'cancel')">{{ item.cancelText }}</button>
          <button class="app-confirm-btn ok" :class="item.tone" type="button" @click="resolveConfirm(item.id, 'confirm')">{{ item.confirmText }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAppFeedback } from '../composables/useAppFeedback.js'

const { toastState, confirmState, dismiss, resolveConfirm } = useAppFeedback()
</script>

<style scoped>
.app-feedback-host {
  position: fixed;
  z-index: 3000;
  inset: 0 auto auto 0;
  pointer-events: none;
  display: contents;
}

.app-toast-stack {
  position: fixed;
  left: 50%;
  top: calc(16px + env(safe-area-inset-top));
  display: grid;
  gap: 8px;
  width: min(92vw, 420px);
  transform: translateX(-50%);
}

.app-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  border-radius: 999px;
  background: var(--glass-panel-bg);
  backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-panel-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  color: var(--app-text);
  font-size: 14px;
  pointer-events: auto;
  cursor: pointer;
}

.app-toast-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--app-text-muted);
}

.app-toast.success .app-toast-dot { background: var(--app-success); }
.app-toast.error .app-toast-dot { background: var(--app-danger); }
.app-toast.warning .app-toast-dot { background: var(--app-warning); }
.app-toast.info .app-toast-dot { background: var(--app-primary); }

.app-toast-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition: opacity 180ms ease, transform 220ms cubic-bezier(0.34, 1.3, 0.64, 1);
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.app-confirm-scrim {
  position: fixed;
  inset: 0;
  z-index: 3001;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(16, 18, 17, 0.4);
  pointer-events: auto;
}

.app-confirm {
  display: grid;
  width: min(360px, 100%);
  gap: 10px;
  padding: 10px 20px 20px;
  border-radius: var(--app-radius-xl);
  background: var(--glass-panel-bg);
  backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur-panel)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-panel-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  color: var(--app-text);
  text-align: center;
}

.app-confirm-sheet {
  display: grid;
  justify-items: center;
}

.app-confirm-grabber {
  width: 38px;
  height: 5px;
  border-radius: 999px;
  background: var(--app-border-strong);
}

.app-confirm-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.app-confirm-message {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-line;
}

.app-confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 6px;
}

.app-confirm-btn {
  padding: 11px 12px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 14px;
  font-weight: 600;
}

.app-confirm-btn.ok {
  border: 0;
  color: var(--app-on-primary);
  background: var(--app-primary);
}

.app-confirm-btn.ok.danger {
  background: var(--app-danger);
}
</style>

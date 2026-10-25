<template>
  <div class="app-feedback-host" aria-live="polite">
    <TransitionGroup name="app-toast" tag="div" class="app-toast-stack">
      <div v-for="item in toastState.items" :key="item.id" class="app-toast" :class="item.kind" @click="dismiss(item.id)">
        <span class="app-toast-dot" />
        <span class="app-toast-text">{{ item.text }}</span>
      </div>
    </TransitionGroup>

    <div v-for="item in confirmState.queue" :key="item.id" class="app-confirm-scrim">
      <div class="app-confirm" role="alertdialog" :aria-label="item.title" @keydown.enter="submitItem(item)">
        <div class="app-confirm-sheet">
          <span class="app-confirm-grabber" />
        </div>
        <button
          v-if="item.distinguishCancelAndClose"
          class="app-confirm-close"
          type="button"
          aria-label="关闭"
          @click="resolveConfirm(item.id, item.kind === 'prompt' ? null : 'close')"
        >×</button>
        <h2 class="app-confirm-title">{{ item.title }}</h2>
        <p v-if="item.message" class="app-confirm-message">{{ item.message }}</p>
        <input
          v-if="item.kind === 'prompt' && !item.multiline"
          v-model="item.inputValue"
          class="app-confirm-input"
          :type="item.type || 'text'"
          :placeholder="item.placeholder"
          @keydown.enter.prevent="submitItem(item)"
        >
        <textarea
          v-else-if="item.kind === 'prompt'"
          v-model="item.inputValue"
          class="app-confirm-input"
          rows="3"
          :placeholder="item.placeholder"
        />
        <p v-if="item.error" class="app-confirm-error">{{ item.error }}</p>
        <div class="app-confirm-actions">
          <button class="app-confirm-btn cancel" type="button" @click="resolveConfirm(item.id, item.kind === 'prompt' ? null : 'cancel')">{{ item.cancelText }}</button>
          <button class="app-confirm-btn ok" :class="item.tone" type="button" @click="item.kind === 'prompt' ? submitItem(item) : resolveConfirm(item.id, 'confirm')">{{ item.confirmText }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAppFeedback } from '../composables/useAppFeedback.js'

const { toastState, confirmState, dismiss, resolveConfirm } = useAppFeedback()

function submitItem(item) {
  const error = item.validator?.(item.inputValue)
  if (error !== true && error !== undefined) {
    item.error = String(error || '输入无效')
    return
  }
  item.error = ''
  resolveConfirm(item.id, item.inputValue)
}
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
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  display: grid;
  gap: 8px;
  width: min(92vw, 380px);
  justify-items: end;
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
  transition: opacity 180ms ease, transform 260ms cubic-bezier(0.34, 1.3, 0.64, 1);
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translate(28px, 20px);
}

/* Mobile toasts stay above the floating glass tab bar. */
@media (max-width: 750px) {
  .app-toast-stack {
    right: 12px;
    bottom: calc(84px + env(safe-area-inset-bottom));
    width: min(88vw, 340px);
  }
}

.app-confirm-scrim {
  position: fixed;
  inset: 0;
  z-index: 3001;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--app-scrim);
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

.app-confirm-close {
  justify-self: end;
  width: 30px;
  height: 30px;
  padding: 0;
  color: var(--app-text-muted);
  font-size: 20px;
  background: transparent;
  border: 0;
  cursor: pointer;
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

.app-confirm-input {
  width: 100%;
  padding: 10px 12px;
  color: var(--app-text);
  font-size: 15px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  outline: none;
}

.app-confirm-input:focus {
  border-color: var(--app-primary);
}

textarea.app-confirm-input {
  resize: vertical;
  font-family: inherit;
}

.app-confirm-error {
  margin: 0;
  color: var(--app-danger);
  font-size: 13px;
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

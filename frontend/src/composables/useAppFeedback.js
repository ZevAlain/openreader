import { reactive } from 'vue'

// Framework-agnostic toast + confirm/prompt services (the EP-free replacement
// for ElMessage/ElMessageBox). One global host in App.vue renders them; call
// sites use message.success/error/warning/info, confirm({...}) and prompt({...}).

let seed = 0

export const toastState = reactive({ items: [] })

function push(kind, text) {
  const value = String(text ?? '').trim()
  if (!value) return
  const id = ++seed
  toastState.items.push({ id, kind, text: value })
  setTimeout(() => dismiss(id), 3200)
}

function dismiss(id) {
  const index = toastState.items.findIndex(item => item.id === id)
  if (index >= 0) toastState.items.splice(index, 1)
}

export const message = {
  success: text => push('success', text),
  error: text => push('error', text),
  warning: text => push('warning', text),
  info: text => push('info', text),
}

const confirmState = reactive({ queue: [] })

function resolveConfirm(id, action) {
  const index = confirmState.queue.findIndex(item => item.id === id)
  if (index < 0) return undefined
  const [item] = confirmState.queue.splice(index, 1)
  return item.resolve(action)
}

/**
 * confirm({ title, message, confirmText, cancelText, tone }) →
 * Promise<'confirm' | 'cancel'>. tone 'warning'|'danger' styles the confirm
 * button.
 */
export function confirm(options = {}) {
  return new Promise(resolve => {
    const id = ++seed
    confirmState.queue.push({
      id,
      title: options.title || '确认操作',
      message: options.message || '',
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      tone: options.tone || 'primary',
      resolve,
    })
  })
}

/**
 * prompt({ title, message, value, placeholder, validator, confirmText,
 * cancelText }) → Promise<{ value }>. Matches ElMessageBox.prompt semantics:
 * resolves with the entered value, rejects with 'cancel' when dismissed.
 * validator(value) returns true or a string error message.
 */
export function prompt(options = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seed
    confirmState.queue.push({
      id,
      title: options.title || '请输入',
      message: options.message || '',
      kind: 'prompt',
      inputValue: options.value ?? '',
      placeholder: options.placeholder || '',
      validator: options.validator,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      error: '',
      resolve: action => {
        if (action === null) {
          reject('cancel')
          return undefined
        }
        return resolve({ value: action })
      },
    })
  })
}

export function useAppFeedback() {
  return { toastState, confirmState, dismiss, resolveConfirm }
}

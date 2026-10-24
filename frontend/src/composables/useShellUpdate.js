import { ref } from 'vue'

// Registers the application-shell service worker and surfaces "a new shell
// is waiting" so the user can tap reload instead of living on a stale cached
// page. The server stamps sw.js with the build id on every deploy, which
// makes the browser byte-compare trigger the standard update flow.
export function useShellUpdate() {
  const updateReady = ref(false)
  let registration = null
  let reloading = false

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js')
        if (registration.waiting && registration.active) updateReady.value = true
        registration.addEventListener('updatefound', () => {
          const installing = registration?.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && registration?.active) updateReady.value = true
          })
        })
        await registration.update()
      } catch {
        // Non-secure contexts have no service worker at all; nothing to do.
      }
    })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Only the consented update flow (SKIP_WAITING) should reload; the
      // initial install's claim must not bounce a first visit.
      if (reloading || !updateReady.value) return
      reloading = true
      window.location.reload()
    })
  }

  function applyUpdate() {
    const waiting = registration?.waiting
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' })
      return
    }
    window.location.reload()
  }

  return { updateReady, applyUpdate }
}

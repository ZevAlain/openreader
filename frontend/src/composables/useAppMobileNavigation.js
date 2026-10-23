import { computed, ref } from 'vue'

// The mobile shell replaced the legacy hamburger drawer with a floating glass
// tab bar, so this composable now only answers "are we on the compact
// interface?" plus the viewport listener that keeps the answer current.
export function useAppMobileNavigation(options) {
  const windowWidth = ref(options.currentViewportWidth())

  const isMobile = computed(() => (
    options.shouldUseMiniInterface(
      options.getPageMode(),
      windowWidth.value,
    )
  ))

  function updateViewport() {
    windowWidth.value = options.currentViewportWidth()
  }

  return {
    windowWidth,
    isMobile,
    updateViewport,
  }
}

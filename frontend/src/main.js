import { createApp } from 'vue'
import { createPinia } from 'pinia'
import persistedState from 'pinia-plugin-persistedstate'
// Vuetify 4 migrated off Element Plus; see docs/compat/vuetify4-migration-baseline.md.
import { createVuetify } from 'vuetify'
import * as vuetifyComponents from 'vuetify/components'
import * as vuetifyDirectives from 'vuetify/directives'
import { aliases as mdiSvgAliases } from 'vuetify/iconsets/mdi-svg'
import 'vuetify/styles'

import App from './App.vue'
import router from './router'
import './styles/global.css'

// MoviePilot-style glass palette: deep navy surfaces, white-alpha borders,
// violet accent (dark); iOS system greys/colors (light).
const themeColors = {
  primary: '#8d51f9',
  secondary: '#7c9cc4',
  'on-secondary': '#07101c',
  success: '#69c59a',
  info: '#7c9cc4',
  warning: '#e4b863',
  error: '#ff7b7b',
  'on-primary': '#ffffff',
  background: '#0b1322',
  'on-background': '#f2f5fa',
  surface: '#182235',
  'on-surface': '#f2f5fa',
  'surface-variant': '#202c42',
  'on-surface-variant': 'rgba(242, 245, 250, 0.72)',
}
const themeColorsLight = {
  ...themeColors,
  secondary: '#8d51f9',
  'on-secondary': '#ffffff',
  success: '#248a3d',
  info: '#007aff',
  warning: '#ff9500',
  error: '#ff3b30',
  background: '#f2f2f7',
  'on-background': '#1c1c1e',
  surface: '#ffffff',
  'on-surface': '#1c1c1e',
  'surface-variant': '#e5e5ea',
  'on-surface-variant': 'rgba(60, 60, 67, 0.72)',
}

const vuetify = createVuetify({
  components: vuetifyComponents,
  directives: vuetifyDirectives,
  icons: { defaultSet: 'svg', aliases: mdiSvgAliases },
  theme: {
    defaultTheme: 'appDark',
    themes: {
      appDark: { dark: true, colors: themeColors },
      appLight: { dark: false, colors: themeColorsLight },
    },
  },
  defaults: {
    component: {
      // iOS feel: flat surfaces, no ripple; MoviePilot defaults.
      VBtn: { elevation: 0, ripple: false },
      VCard: { elevation: 0, rounded: 'lg' },
      VChip: { elevation: 0, ripple: false },
      VTab: { ripple: false },
      VListItem: { ripple: false, rounded: 'md' },
      VMenu: { elevation: 0 },
      VDialog: { elevation: 0 },
      VList: { elevation: 0 },
    },
  },
})

// Vuetify components and the CSS-variable chrome share one dark switch.
const syncVuetifyTheme = () => {
  vuetify.theme.change(document.documentElement.classList.contains('dark') ? 'appDark' : 'appLight')
}
new MutationObserver(syncVuetifyTheme).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class'],
})
if (typeof window !== 'undefined') window.addEventListener('load', syncVuetifyTheme)

const app = createApp(App)
const pinia = createPinia()
pinia.use(persistedState)

app.use(pinia)
app.use(vuetify)
app.use(router)

app.mount('#app')

// The application-shell service worker (and its update prompt) is wired up in
// the app shell via useShellUpdate(); registration happens on window load.

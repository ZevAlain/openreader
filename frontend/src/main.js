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

const app = createApp(App)
const pinia = createPinia()
pinia.use(persistedState)

app.use(pinia)
// defaultSet 'svg' renders raw @mdi/js path strings as inline SVG (the font
// class default has no @mdi/font installed and renders nothing).
app.use(createVuetify({
  components: vuetifyComponents,
  directives: vuetifyDirectives,
  icons: { defaultSet: 'svg', aliases: mdiSvgAliases },
}))
app.use(router)

app.mount('#app')

// The application-shell service worker (and its update prompt) is wired up in
// the app shell via useShellUpdate(); registration happens on window load.

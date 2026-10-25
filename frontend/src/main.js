import { createApp } from 'vue'
import { createPinia } from 'pinia'
import persistedState from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
// Vuetify 4 migration: coexists with Element Plus view-by-view until the
// final phase removes EP entirely.
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
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')

// The application-shell service worker (and its update prompt) is wired up in
// the app shell via useShellUpdate(); registration happens on window load.

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import persistedState from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import './styles/global.css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(persistedState)

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')

// The application-shell service worker (and its update prompt) is wired up in
// the app shell via useShellUpdate(); registration happens on window load.

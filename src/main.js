import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import './style.css'
import axios from 'axios'

const isNative = window.location.hostname === 'localhost'
  || window.location.protocol === 'capacitor:'
  || window.location.protocol === 'file:'
  || (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.())

if (isNative) {
  axios.defaults.baseURL = 'https://p2p.ai-airdrop.uk'
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// Vue挂载成功 → 淡出加载屏
window._clearSplashTimer?.()
const splash = document.getElementById('splash')
if (splash) {
  splash.classList.add('hide')
  setTimeout(() => splash.remove(), 350)
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import './style.css'
import axios from 'axios'

// Capacitor 本地打包模式：API 请求指向线上服务器
// 判断是否在 Capacitor/Android 环境（本地 file:// 或 capacitor://）
const isNative = window.location.protocol === 'capacitor:'
  || window.location.protocol === 'file:'
  || (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.())

if (isNative) {
  axios.defaults.baseURL = 'https://p2p.ai-airdrop.uk'
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

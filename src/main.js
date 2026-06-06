import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import './style.css'
import axios from 'axios'

// Capacitor 本地打包模式：API 请求指向线上服务器
// Android WebView 用 http://localhost 或 capacitor://localhost
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

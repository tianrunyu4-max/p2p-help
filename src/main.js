import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
// 禁用自动初始化余额，改为只能通过管理后台或会员互转充值
// import './utils/initAdmin'

// 冒烟测试（开发环境）
if (import.meta.env.DEV) {
  import('./utils/smokeTest.js').then(({ smokeTest }) => {
    window.smokeTest = smokeTest
    console.log('%c🔧 冒烟测试已加载，运行命令：smokeTest.runAll()', 'color: #F7B500; font-weight: bold;')
  })
  // 综合测试（8大模块全覆盖）
  import('./utils/comprehensiveTest.js').then(({ comprehensiveTest }) => {
    window.comprehensiveTest = comprehensiveTest
    window.runComprehensiveTest = () => comprehensiveTest.runAll()
    console.log('%c🔧 综合测试已加载，运行命令：runComprehensiveTest()', 'color: #10AEFF; font-weight: bold;')
  })
  // 端到端用户流程走查
  import('./utils/userWalkthrough.js').then(({ runUserWalkthrough }) => {
    window.runUserWalkthrough = runUserWalkthrough
    console.log('%c🔧 用户走查已加载，运行命令：await runUserWalkthrough()', 'color: #E91E63; font-weight: bold;')
  })
}

// 可选：安全系统初始化（需要时手动启用）
// 如需启用，取消下面的注释
/*
import { initializeSecurity } from './utils/securityInit.js'
initializeSecurity({
  autoRepair: true,
  auditLogger: {
    enableBatchSend: true,
    batchInterval: 30000
  }
}).then(result => {
  if (result.success) {
    console.log('✅ 安全系统初始化成功')
  } else {
    console.warn('⚠️ 安全系统初始化部分失败:', result.message)
  }
}).catch(error => {
  console.error('❌ 安全系统初始化失败:', error)
})
*/

// ==================== 自动更新检测 ====================
// 双保险方案：
// 1. fetchBuildTs：直接读 sw.js 中的 BUILD_TS 注释（浏览器永远不经过 SW 拉取 sw.js）
// 2. registration.update()：触发浏览器原生 SW 更新检查（兜底）
// 两者配合：任何一路生效即可让用户自动拿到新版本
;(async () => {
  if (!('serviceWorker' in navigator)) return

  let refreshing = false

  // ── controllerchange 兜底：新 SW 激活后立即刷新 ──
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) { refreshing = true; window.location.reload() }
  })

  // ── 方案1：读取服务器 sw.js 的 BUILD_TS ──
  // sw.js 永远直接从 origin 拉取（浏览器对 sw.js 的请求绕过 SW），?_= 绕过浏览器 HTTP 缓存
  const fetchBuildTs = async () => {
    try {
      const r = await fetch(`/sw.js?_=${Date.now()}`, { cache: 'no-store' })
      const m = (await r.text()).match(/BUILD_TS:\s*(\d+)/)
      return m?.[1] ?? null
    } catch { return null }
  }

  // 页面加载时记录当前版本
  const initTs = await fetchBuildTs()

  // 检测到版本变化 → 立即 reload（不依赖 SW 生命周期链）
  const checkVersion = async () => {
    const ts = await fetchBuildTs()
    if (ts && initTs && ts !== initTs) {
      if (!refreshing) { refreshing = true; window.location.reload() }
      return
    }
    // ── 方案2：触发浏览器原生 SW 更新检查（双保险） ──
    navigator.serviceWorker.ready.then(r => r.update()).catch(() => {})
  }

  // 触发时机：从后台切回前台
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkVersion()
  })
  // bfcache 恢复
  window.addEventListener('pageshow', e => { if (e.persisted) checkVersion() })
  // 定时轮询（每2分钟）
  setInterval(checkVersion, 2 * 60 * 1000)

  // 页面加载后立即触发一次 SW 更新检查
  navigator.serviceWorker.ready.then(r => { setTimeout(() => r.update().catch(() => {}), 1000) }).catch(() => {})
})()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)
app.mount('#app')

/* build Tue Mar  3 02:25:48     2026 */
// 1775899443

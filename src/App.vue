<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from './stores/userStore.js'
import { computed, onMounted } from 'vue'

const router = useRouter()
const route  = useRoute()
const store  = useUserStore()

const navItems = [
  { path: '/community', icon: '💬', label: '社区' },
  { path: '/myshop',    icon: '🏪', label: '店铺' },
  { path: '/subsidy',   icon: '💰', label: '补贴' },
  { path: '/confirm',   icon: '✅', label: '待确认' },
  { path: '/profile',   icon: '👤', label: '我的' },
]

const hideNav = computed(() => {
  const p = route.path
  return p.startsWith('/admin') || p.startsWith('/participate') || p.startsWith('/payment')
})

// 复投锁定：收款满700且已激活
const needRepurchase = computed(() => {
  const u = store.userInfo
  if (!u || !u.is_active) return false
  return parseFloat(u.total_received || 0) >= 700
})

// 锁定时只允许访问社区和参与页
function handleNavClick(path) {
  if (needRepurchase.value && path !== '/community') {
    alert('⚠️ 收款已满700元，请先复投后再使用其他功能')
    router.push('/community')
    return
  }
  router.push(path)
}

onMounted(() => {
  store.autoInit()
  startVersionCheck()
})

let versionTimer = null
async function startVersionCheck() {
  const getVersion = async () => {
    try {
      const res = await fetch('/version.json?_=' + Date.now(), { cache: 'no-store' })
      if (!res.ok) return null
      const data = await res.json()
      return data.v
    } catch { return null }
  }
  const currentVersion = await getVersion()
  if (!currentVersion) return
  versionTimer = setInterval(async () => {
    const latest = await getVersion()
    if (latest && latest !== currentVersion) {
      clearInterval(versionTimer)
      window.location.reload()
    }
  }, 60000)
}
</script>

<template>
  <div class="app-wrap">
    <!-- 页面内容区（flex:1 撑满剩余空间） -->
    <div class="page-content">
      <router-view />
    </div>

    <!-- 复投提示横幅 -->
    <div v-if="needRepurchase && !hideNav" class="repurchase-banner" @click="router.push('/community')">
      🔄 收款已满700元，请点击"自愿参与"复投，解锁全部功能
    </div>

    <!-- 底部导航 -->
    <nav v-if="!hideNav" class="bottom-nav">
      <div
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path, locked: needRepurchase && item.path !== '/community' }"
        @click="handleNavClick(item.path)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </nav>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; background: #f5f5f5; }
html, body, #app { height: 100%; }

#app { max-width: 480px; margin: 0 auto; height: 100%; }

.app-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 页面内容区：撑满空间，各页面在这里滚动 */
.page-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

/* 社区页特殊处理：需要内部自己管理滚动 */
.page-content:has(.community-container) {
  overflow: hidden;
}

.bottom-nav {
  flex-shrink: 0;
  display: flex;
  background: #fff;
  border-top: 1px solid #eee;
  padding-bottom: env(safe-area-inset-bottom);
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  cursor: pointer;
  color: #999;
}
.nav-item.active { color: #f0a500; }
.nav-icon { font-size: 22px; margin-bottom: 2px; }
.nav-label { font-size: 12px; font-weight: 600; }
.nav-item.locked { opacity: 0.4; }
.repurchase-banner { background: linear-gradient(135deg,#e53e3e,#c53030); color:#fff; text-align:center; font-size:13px; font-weight:600; padding:10px 14px; cursor:pointer; flex-shrink:0; }
</style>

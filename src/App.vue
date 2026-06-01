<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from './stores/userStore.js'
import { computed } from 'vue'

const router = useRouter()
const route  = useRoute()
const store  = useUserStore()

// 底部导航
const navItems = [
  { path: '/',          icon: '🏠', label: '首页' },
  { path: '/myshop',   icon: '🏪', label: '店铺' },
  { path: '/community',icon: '💬', label: '社区' },
  { path: '/confirm',  icon: '✅', label: '待确认' },
  { path: '/profile',  icon: '👤', label: '我的' },
]
const showNav = computed(() => store.isLoggedIn && !route.path.startsWith('/admin'))
</script>

<template>
  <div class="app-wrap">
    <router-view />

    <!-- 底部导航（登录后显示） -->
    <nav v-if="showNav" class="bottom-nav">
      <div
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path }"
        @click="router.push(item.path)"
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
#app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #fff; position: relative; }
.app-wrap { min-height: 100vh; padding-bottom: 60px; }

.bottom-nav {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px;
  display: flex; background: #fff;
  border-top: 1px solid #eee;
  z-index: 100;
}
.nav-item {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 8px 0; cursor: pointer; color: #999; font-size: 12px;
}
.nav-item.active { color: #f0a500; }
.nav-icon { font-size: 22px; margin-bottom: 2px; }
</style>

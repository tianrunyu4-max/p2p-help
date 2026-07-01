<template>
  <div class="app-wrapper">
    <div class="phone-container">

      <!-- 侧边栏遮罩 -->
      <transition name="sidebar-fade">
        <div v-if="showSidebar" class="sidebar-overlay" @click="showSidebar = false"></div>
      </transition>

      <!-- 侧边栏 -->
      <transition name="sidebar-slide">
        <aside v-if="showSidebar" class="sidebar">
          <!-- 用户信息头部 -->
          <div class="sidebar-header">
            <button class="sidebar-close" @click="showSidebar = false">✕</button>
            <div class="sidebar-header-top">
              <div class="sidebar-avatar" @click="openUserCard(); showSidebar = false">
                <img v-if="cardAvatar" :src="cardAvatar" class="sidebar-avatar-img" alt="头像" />
                <span v-else>{{ userInitial }}</span>
              </div>
              <div class="sidebar-user-id-row">
                <span class="sidebar-user-id">ID {{ userId ? displayUserId : '—' }}</span>
                <span v-if="userStore.identityBadge" class="identity-badge" :style="{ color: userStore.identityBadge.color, background: userStore.identityBadge.bg }">{{ userStore.identityBadge.label }}</span>
              </div>
            </div>
            <div class="sidebar-user-desc">
              <p>AI驱动的全球商品出海服务平台</p>
              <p>连接商家、消费者、轻创业者和全球供应链，让每个人都有机会参与全球贸易。</p>
            </div>
          </div>

          <!-- 主导航 -->
          <nav class="sidebar-nav">
            <button @click="sidebarNavTo('/')" :class="['sidebar-item', { 'sidebar-item-active': $route.path === '/' }]">
              <span class="nav-icon-wrap nav-icon-community">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
              </span>
              <span>{{ $t('nav.community') }}</span>
            </button>

            <button @click="sidebarNavTo('/task')" :class="['sidebar-item', { 'sidebar-item-active': $route.path === '/task' }]">
              <span class="nav-icon-wrap nav-icon-shop">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </span>
              <span>{{ $t('nav.shop') }}</span>
            </button>

            <!-- 发布入口已隐藏 -->

            <button @click="sidebarNavTo('/team')" :class="['sidebar-item', { 'sidebar-item-active': $route.path === '/team' }]">
              <span class="nav-icon-wrap nav-icon-team">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </span>
              <span>{{ $t('nav.team') }}</span>
            </button>

            <button @click="sidebarNavTo('/profile')" :class="['sidebar-item', { 'sidebar-item-active': $route.path === '/profile' }]">
              <span class="nav-icon-wrap nav-icon-profile">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <span>{{ $t('nav.mine') }}</span>
            </button>

            <button @click="sidebarNavTo('/checkin')" :class="['sidebar-item', { 'sidebar-item-active': $route.path === '/checkin' }]">
              <span class="nav-icon-wrap nav-icon-checkin">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </span>
              <span>{{ $t('nav.checkin') }}</span>
            </button>
          </nav>

          <!-- AI 助手入口 -->
          <button @click="sidebarNavTo('/hub')" :class="['sidebar-item', { 'sidebar-item-active': $route.path === '/hub' }]" style="margin: 4px 8px; border-radius: 12px; background: linear-gradient(135deg,#1a0d2e,#3b0764); color: #a78bfa; border: 1px solid rgba(124,58,237,0.3);">
            <span style="font-size:18px;">🦀🎱</span>
            <span>AI 智能助手</span>
          </button>

          <div class="sidebar-divider"></div>

          <!-- 工具菜单 -->
          <nav class="sidebar-tools">
            <button class="sidebar-item sidebar-item-sm" @click="sidebarNavTo('/marketplace')">
              <span class="tool-icon">🌐</span>
              <span>全球商品市场</span>
            </button>
            <button class="sidebar-item sidebar-item-sm" @click="sidebarNavTo('/ai-tools')">
              <span class="tool-icon">🧠</span>
              <span>AI 工具中心</span>
            </button>
            <button class="sidebar-item sidebar-item-sm" @click="handlePlusMenuItem('community')">
              <span class="tool-icon">👥</span>
              <span>{{ $t('nav.createCommunity') }}</span>
              <span class="vip-badge">VIP</span>
            </button>
            <button class="sidebar-item sidebar-item-sm" @click="openA2HSheet(); showSidebar = false">
              <span class="tool-icon">📲</span>
              <span>添加到桌面</span>
            </button>
          </nav>

          <div class="sidebar-spacer"></div>
          <button v-if="displayUserId === '82377'" class="sidebar-item sidebar-item-admin" @click="sidebarNavTo('/admin')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93l-1.41 1.41M5.34 16.66l-1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M5.34 7.34L3.93 5.93M12 20v2M12 2v2"/>
            </svg>
            <span>{{ $t('nav.adminPanel') }}</span>
          </button>
        </aside>
      </transition>

      <!-- 顶部导航栏 -->
      <header v-if="isTopLevelRoute" class="header">
        <div class="header-left">
          <button class="hamburger-btn" @click="showSidebar = true">
            <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="0" y1="1" x2="20" y2="1"/>
              <line x1="0" y1="8" x2="20" y2="8"/>
              <line x1="0" y1="15" x2="20" y2="15"/>
            </svg>
          </button>
          <button class="header-shop-btn" @click="router.push('/task')">{{ $t('header.shop') }}</button>
        </div>

        <div class="header-center">
          <div class="header-logo-wrap" @click="router.push('/language')">
            <img src="/uaieproc-logo.jpg" class="header-logo-img" alt="UAE Sourcing" />
          </div>
        </div>

        <div class="header-right">
          <button class="subscribe-btn" @click="router.push('/checkin')" title="每日签到">
            <span class="subscribe-icon">📅</span>
          </button>
          <!-- 用户头像（点击弹出用户卡片） -->
          <div class="header-avatar-btn" @click="openUserCard">
            <img v-if="cardAvatar" :src="cardAvatar" class="header-avatar-img" alt="头像" />
            <template v-else>
              <img src="/checkin-logo.jpg" class="avatar-bg-img" alt="" />
              <span class="header-avatar-initial">{{ userInitial }}</span>
            </template>
          </div>
        </div>
      </header>

      <!-- 主内容区 -->
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" :key="$route.path" />
          </keep-alive>
        </router-view>
      </main>

    </div>

    <!-- 用户信息卡片弹窗 -->
    <transition name="fade">
      <div v-if="showUserCard" class="user-card-overlay" @click.self="showUserCard = false">
        <div class="user-card">
          <button class="user-card-close" @click="showUserCard = false">×</button>
          <div class="user-card-avatar">
            <img v-if="cardAvatar" :src="cardAvatar" class="card-avatar-img" alt="头像" />
            <span v-else class="card-avatar-initial">{{ userInitial }}</span>
          </div>
          <div class="user-card-id">
            ID: {{ displayUserId }}
            <span v-if="userStore.identityBadge" class="identity-badge" :style="{ color: userStore.identityBadge.color, background: userStore.identityBadge.bg }">{{ userStore.identityBadge.label }}</span>
          </div>
          <div class="user-card-name">{{ $t('userCard.greeting') }}</div>
          <button class="user-card-profile-btn" @click="goToProfile">{{ $t('userCard.viewProfile') }}</button>
          <button class="user-card-subscribe-btn" @click="openSubscribeFromCard">{{ $t('userCard.manageSubscription') }}</button>
        </div>
      </div>
    </transition>

    <!-- 发布菜单遮罩 -->
    <transition name="fade">
      <div v-if="showPublishMenu" class="publish-menu-overlay" @click="showPublishMenu = false"></div>
    </transition>

    <!-- 发布菜单（header 下方弹出） -->
    <transition name="publish-menu-slide">
      <div v-if="showPublishMenu" class="publish-menu">
        <button class="publish-menu-item" @click="handlePublishNav">
          <div class="publish-menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <span>{{ $t('publish.publishContent') }}</span>
        </button>
        <button class="publish-menu-item" @click="showPublishMenu = false; router.push('/checkin')">
          <div class="publish-menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <span>{{ $t('publish.dailyCheckin') }}</span>
        </button>
      </div>
    </transition>

    <!-- 发布表单弹窗 -->
    <PublishModal
      v-if="showPublishModal"
      :publish-type="publishType"
      @close="showPublishModal = false"
      @success="handlePublishSuccess"
    />

    <!-- 订阅弹窗 -->
    <SubscriptionModal
      :visible="showSubscribeModal"
      :currentBalance="userStore.balance"
      :helpBalance="userStore.helpBalance"
      :couponCount="userStore.couponCount"
      :isFirstUser="isFirstUser"
      :isActivated="userStore.isActivated"
      :currentCardType="userStore.cardType"
      @close="showSubscribeModal = false"
      @activate="handleSubscriptionActivate"
      @success="handleSubscriptionSuccess"
    />

    <!-- 全局Toast -->
    <Toast
      :visible="toastState.visible"
      :type="toastState.type"
      :title="toastState.title"
      :message="toastState.message"
      :duration="toastState.duration"
    />

    <!-- 信息发布 Drawer（全局，点击顶部发布按钮弹出） -->
    <InfoPublishDrawer
      v-if="showInfoDrawer"
      :default-type="infoDrawerType"
      @close="showInfoDrawer = false"
      @success="showInfoDrawer = false"
      @subscribe-required="showInfoDrawer = false; showSubscribeModal = true"
    />

    <!-- 发布浮窗按钮（已隐藏） -->
    <!-- <button class="publish-fab" @click="showInfoDrawer = true" title="发布信息">
      <img src="/fab-lobster.jpg" class="publish-fab-img" alt="发布" />
    </button> -->

    <!-- 工作/兼职发布弹窗 -->
    <JobPublishModal
      v-if="showJobPublish"
      @close="showJobPublish = false"
      @success="showJobPublish = false; success('发布成功', '您的信息已成功发布')"
    />

    <!-- 添加桌面底部引导 -->
    <transition name="a2h-slide">
      <div v-if="showA2HSheet" class="a2h-overlay" @click.self="showA2HSheet = false">
        <div class="a2h-sheet">
          <div class="a2h-handle"></div>
          <div class="a2h-head">
            <img src="/ai-bot-avatar.jpg" class="a2h-icon" alt="icon" />
            <div>
              <div class="a2h-title">UAE Sourcing</div>
              <div class="a2h-sub">添加到桌面，随时打开</div>
            </div>
          </div>
          <!-- Chrome Android 一键安装 -->
          <button v-if="a2hCanInstall" class="a2h-btn-install" @click="a2hDoInstall">
            📲 一键添加到桌面
          </button>
          <!-- iOS Safari -->
          <div v-else-if="a2hPlatform === 'ios'" class="a2h-steps">
            <div class="a2h-step">
              <span class="a2h-num">1</span>
              <span>点底部 <b>分享</b> 按钮 <span class="a2h-share-icon">⎙</span></span>
            </div>
            <div class="a2h-step">
              <span class="a2h-num">2</span>
              <span>选「<b>添加到主屏幕</b>」即可</span>
            </div>
          </div>
          <!-- 微信浏览器 -->
          <div v-else-if="a2hPlatform === 'wechat'" class="a2h-steps">
            <div class="a2h-step">
              <span class="a2h-num">1</span>
              <span>点右上角 <b>⋯</b> 按钮</span>
            </div>
            <div class="a2h-step">
              <span class="a2h-num">2</span>
              <span>选「<b>在浏览器打开</b>」</span>
            </div>
            <div class="a2h-step">
              <span class="a2h-num">3</span>
              <span>在浏览器菜单选「<b>添加到主屏幕</b>」</span>
            </div>
          </div>
          <!-- 其他安卓 -->
          <div v-else class="a2h-steps">
            <div class="a2h-tip">💡 推荐用 <b>Chrome浏览器</b> 打开，体验最佳</div>
            <div class="a2h-step">
              <span class="a2h-num">1</span>
              <span>先点下方「<b>知道了</b>」关闭提示</span>
            </div>
            <div class="a2h-step">
              <span class="a2h-num">2</span>
              <span>点浏览器右上角 <b>⋮</b> 或 <b>···</b> 菜单</span>
            </div>
            <div class="a2h-step">
              <span class="a2h-num">3</span>
              <span>找到「<b>添加到主屏幕</b>」或「<b>安装应用</b>」点击</span>
            </div>
          </div>
          <button class="a2h-btn-close" @click="showA2HSheet = false">知道了，去操作</button>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getOrCreateUserId } from './utils/auth.js'
import Toast from './components/Toast.vue'
import PublishModal from './components/PublishModal.vue'
import SubscriptionModal from './components/SubscriptionModal.vue'
import InfoPublishDrawer from './components/InfoPublishDrawer.vue'
import JobPublishModal from './components/JobPublishModal.vue'
import { useToast } from './composables/useToast.js'
import { useUserStore } from './stores/userStore.js'

const router = useRouter()
const route = useRoute()
const { toastState, success, error } = useToast()
const userStore = useUserStore()

// ==================== 用户信息 ====================

const userId = ref(getOrCreateUserId())
const displayUserId = computed(() => userId.value || '')

const userInitial = computed(() => {
  if (!userId.value) return '?'
  return userId.value.charAt(0).toUpperCase()
})

const isUserActivated = computed(() => userStore.isActivated)

const isFirstUser = computed(() => false)

const isTopLevelRoute = computed(() => {
  const topLevelNames = ['Community', 'Task', 'Team', 'Profile', 'TaskStream', 'Publish']
  return topLevelNames.includes(route.name)
})

watch(() => route.path, () => {
  userId.value = getOrCreateUserId()
})

// ==================== 用户卡片弹窗 ====================

const showUserCard = ref(false)
const cardAvatar = ref(localStorage.getItem('userAvatarUrl') || '')
const cardEarnings = ref({ balance: 0, income: 0 })

const cardDisplayName = computed(() => {
  return localStorage.getItem('chatUserName') || `用户_${displayUserId.value}`
})

function openUserCard() {
  cardAvatar.value = localStorage.getItem('userAvatarUrl') || ''
  showUserCard.value = true
  userStore.fetchUserStatus()
}

function goToProfile() {
  showUserCard.value = false
  router.push('/profile')
}

async function openSubscribeFromCard() {
  showUserCard.value = false
  await userStore.fetchUserStatus()
  showSubscribeModal.value = true
}

function handleCardStorageChange(e) {
  if (e.key === 'userAvatarUrl') {
    cardAvatar.value = e.newValue || ''
  }
}

// ==================== 侧边栏 ====================

const showSidebar = ref(false)

const sidebarNavTo = (path) => {
  showSidebar.value = false
  router.push(path)
}

const handlePlusMenuItem = (type) => {
  showSidebar.value = false
  switch (type) {
    case 'community': router.push('/create-community'); break
    case 'shipping':  router.push('/shipping-address'); break
    case 'payment':   router.push('/payment-address'); break
    case 'password':  router.push('/transaction-password'); break
  }
}

// ==================== 订阅 ====================

const showSubscribeModal = ref(false)
const userBalance = ref(0)

const loadUserBalance = async () => {
  const id = userId.value
  if (!id) return
  try {
    const res = await fetch(`/api/subscription/status/${id}`)
    const json = await res.json()
    if (json.code === 200 && json.data) {
      userBalance.value = parseFloat(json.data.balance) || 0
      cardEarnings.value.balance = json.data.balance || 0
      cardEarnings.value.income = json.data.totalEarnings || 0
    }
  } catch {}
}

const handleSubscriptionActivate = async (data) => {}
const handleSubscriptionSuccess = () => {
  showSubscribeModal.value = false
  window.location.reload()
}

// ==================== 工作/兼职发布弹窗 ====================

const showJobPublish = ref(false)

// ==================== 信息发布 Drawer ====================

const showInfoDrawer = ref(false)
const infoDrawerType = ref('purchase')

// 监听来自社区/PublishPage 的打开请求（支持携带 type）
onMounted(() => {
  window.addEventListener('openInfoDrawer', (e) => {
    infoDrawerType.value = e.detail?.type || 'purchase'
    showInfoDrawer.value = true
  })
})

// ==================== 发布 ====================

const showPublishMenu = ref(false)
const showPublishModal = ref(false)
const publishType = ref('task')

const handleCenterAction = () => {
  showPublishMenu.value = !showPublishMenu.value
}

const handlePublishNav = () => {
  showPublishMenu.value = false
  router.push('/publish')
}

const handlePublish = (type) => {
  publishType.value = type
  showPublishMenu.value = false
  showPublishModal.value = true
}

const handlePublishSuccess = () => {
  showPublishModal.value = false
  success('发布成功', '内容已发布到任务页面')
  setTimeout(() => router.push('/task'), 1000)
}

// ==================== 添加到桌面 ====================
let deferredA2HPrompt = null
const showA2HSheet = ref(false)
const a2hCanInstall = ref(false)
const a2hPlatform = computed(() => {
  const ua = navigator.userAgent
  if (/MicroMessenger/i.test(ua)) return 'wechat'
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  return 'android'
})
function openA2HSheet() { showA2HSheet.value = true }
async function a2hDoInstall() {
  if (deferredA2HPrompt) {
    deferredA2HPrompt.prompt()
    await deferredA2HPrompt.userChoice
    deferredA2HPrompt = null
    a2hCanInstall.value = false
    showA2HSheet.value = false
  }
}
function handleA2HPrompt(e) {
  e.preventDefault()
  deferredA2HPrompt = e
  a2hCanInstall.value = true
}
function handleAppInstalled() {
  deferredA2HPrompt = null
  a2hCanInstall.value = false
  showA2HSheet.value = false
}

onMounted(() => {
  // balance 由 userStore.fetchUserStatus() 统一管理，无需单独调用 loadUserBalance
  window.addEventListener('storage', handleCardStorageChange)
  window.addEventListener('beforeinstallprompt', handleA2HPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)

})

onUnmounted(() => {
  window.removeEventListener('storage', handleCardStorageChange)
  window.removeEventListener('beforeinstallprompt', handleA2HPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
})
</script>

<style scoped>
/* ==================== 基础布局 ==================== */
.app-wrapper {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  background-color: #EDEDED;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
}

.phone-container {
  width: 100%;
  max-width: 430px;
  height: 100%;
  background-color: #FFFFFF;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ==================== 侧边栏遮罩 ==================== */
.sidebar-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
}
.sidebar-fade-enter-active, .sidebar-fade-leave-active { transition: opacity 0.25s ease; }
.sidebar-fade-enter-from, .sidebar-fade-leave-to { opacity: 0; }

/* ==================== 侧边栏 ==================== */
.sidebar {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 290px;
  background: #fff;
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
}
.sidebar-slide-enter-active, .sidebar-slide-leave-active { transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); }
.sidebar-slide-enter-from, .sidebar-slide-leave-to { transform: translateX(-100%); }

/* 头部 */
.sidebar-header {
  position: relative;
  padding: 14px 20px 16px;
  border-bottom: 1px solid rgba(0,0,0,0.07);
}
.sidebar-close {
  position: absolute;
  top: 12px; right: 14px;
  width: 32px; height: 32px;
  border: none; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #555; font-size: 17px;
  border-radius: 50%; transition: background 0.18s;
}
.sidebar-close:hover { background: rgba(0,0,0,0.07); }

.sidebar-header-top {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}
.sidebar-avatar {
  width: 54px; height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F7B500, #FFC700);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 22px;
  flex-shrink: 0; cursor: pointer; overflow: hidden;
}
.sidebar-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.sidebar-user-id-row { display: flex; align-items: center; gap: 8px; }
.sidebar-user-id { font-size: 19px; font-weight: 700; color: #0f1419; }
.identity-badge { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 10px; white-space: nowrap; }

.sidebar-user-desc {
  display: flex; flex-direction: column; gap: 3px;
}
.sidebar-user-desc p {
  margin: 0;
  font-size: 14px; color: #536471; line-height: 1.5;
}
.sidebar-desc-cta {
  font-size: 13px !important;
  color: #D4772C !important;
  font-weight: 600;
  margin-top: 2px !important;
}

/* 导航 */
.sidebar-nav, .sidebar-tools { display: flex; flex-direction: column; padding: 6px 8px; }

.sidebar-item {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px;
  border: none; background: transparent; border-radius: 50px;
  font-size: 15px; font-weight: 400; color: #0f1419;
  cursor: pointer; transition: background 0.15s; text-align: left; width: 100%;
  letter-spacing: -0.2px;
}
.sidebar-item:hover { background: rgba(15,20,25,0.07); }
.sidebar-item:active { background: rgba(15,20,25,0.12); }
.sidebar-item-active { font-weight: 700; }

.nav-icon-wrap {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.nav-icon-community { background: linear-gradient(135deg, #4facfe, #00c6fb); }
.nav-icon-shop      { background: linear-gradient(135deg, #ff9a44, #fc6076); }
.nav-icon-team      { background: linear-gradient(135deg, #43e97b, #38f9d7); }
.nav-icon-profile   { background: linear-gradient(135deg, #a78bfa, #c084fc); }
.nav-icon-checkin   { background: linear-gradient(135deg, #FFC933, #FFB300); }

.sidebar-item-sm {
  font-size: 16px;
  padding: 11px 14px;
}

.tool-icon { font-size: 20px; width: 24px; text-align: center; flex-shrink: 0; }

.vip-badge {
  margin-left: auto;
  font-size: 10px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, #F7B500, #FFC700);
  padding: 2px 7px; border-radius: 4px;
}

.sidebar-divider { height: 1px; background: rgba(0,0,0,0.07); margin: 4px 0; }
.sidebar-spacer { flex: 1; min-height: 16px; }

.sidebar-item-admin {
  margin: 0 8px 12px;
  font-size: 16px; color: #536471;
  border-radius: 50px;
}
.sidebar-item-admin:hover { background: rgba(15,20,25,0.07); color: #0f1419; }

/* ==================== 顶部导航栏 ==================== */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 52px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(0,0,0,0.07);
  background: #fff;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 2px;
}

.hamburger-btn {
  width: 36px; height: 36px;
  border: none; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px; color: #333; transition: background 0.2s;
}
.hamburger-btn:hover { background: rgba(0,0,0,0.06); }

.header-shop-btn {
  border: none; background: transparent; cursor: pointer;
  font-size: 15px; font-weight: 700; color: #07C160;
  padding: 4px 8px; border-radius: 8px;
  transition: background 0.2s;
}
.header-shop-btn:hover { background: rgba(7,193,96,0.08); }
.header-shop-btn:active { background: rgba(7,193,96,0.15); }

.header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 6px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
}

/* 顶部发布按钮 */
.header-publish-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #1565C0, #1976D2);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(21, 101, 192, 0.35);
}
.header-publish-btn:active { transform: scale(0.95); }
.header-publish-icon { font-size: 15px; line-height: 1; }
.header-publish-text { font-size: 13px; font-weight: 700; }

/* 顶部中央突出圆形Logo */
.header-logo-wrap {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow:
    0 0 0 3px #fff,
    0 0 0 4.5px rgba(200, 140, 0, 0.35),
    0 6px 20px rgba(0, 0, 0, 0.14);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.header-logo-wrap:hover {
  transform: scale(1.07);
  box-shadow: 0 0 0 3px #fff, 0 0 0 4.5px rgba(200,140,0,0.55), 0 8px 24px rgba(200,140,0,0.22);
}
.header-logo-wrap:active { transform: scale(0.93); }

.header-logo-img {
  width: 54px;
  height: 54px;
  object-fit: cover;
  border-radius: 50%;
  display: block;
  pointer-events: none;
}

.header-logo-text {
  font-size: 10px;
  font-weight: 700;
  color: #B8860B;
  letter-spacing: 0.3px;
  white-space: nowrap;
  margin-top: 2px;
  text-align: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.subscribe-btn {
  width: 34px; height: 34px;
  background: linear-gradient(135deg, #4A9EFF, #10AEFF);
  border: none; border-radius: 10px; color: #fff;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(16,174,255,0.3);
  transition: all 0.2s;
}
.subscribe-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16,174,255,0.4); }
.subscribe-icon { font-size: 18px; line-height: 1; }
/* 发布浮窗按钮 */
.publish-fab {
  position: fixed;
  right: 16px;
  bottom: 88px;
  width: 72px; height: 72px;
  border-radius: 50%;
  background: transparent;
  border: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  z-index: 200;
  transition: transform .2s, box-shadow .2s;
}
.publish-fab:active { transform: scale(.93); }
.publish-fab:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
.publish-fab-img {
  width: 150%; height: 150%;
  margin: -25% 0 0 -25%;
  object-fit: cover;
  pointer-events: none;
  display: block;
}
.publish-fab-icon {
  color: #fff;
  font-size: 30px;
  font-weight: 300;
  line-height: 1;
  margin-top: -2px;
}

/* 头像按钮 */
.header-avatar-btn {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F7B500, #FF8C00);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; overflow: hidden;
  position: relative;
  transition: transform 0.15s;
}
.header-avatar-btn:hover { transform: scale(1.08); }
.header-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-bg-img {
  position: absolute; inset: 0;
  width: 150%; height: 150%;
  margin: -25% 0 0 -25%;
  object-fit: cover;
  opacity: 0.85;
  pointer-events: none;
}
.header-avatar-initial {
  position: relative; z-index: 1;
  font-size: 14px; font-weight: 700; color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

/* ==================== 主内容区 ==================== */
.main-content {
  flex: 1;
  position: relative;
  z-index: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-top: 20px; /* 留出弧形logo溢出的空间 */
}
.main-content::-webkit-scrollbar { display: none; }

/* ==================== 用户卡片弹窗 ==================== */
.user-card-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-card {
  background: #fff;
  border-radius: 20px;
  padding: 28px 24px 20px;
  width: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
  box-shadow: 0 8px 40px rgba(0,0,0,0.18);
}

.user-card-close {
  position: absolute;
  top: 14px; right: 16px;
  width: 28px; height: 28px;
  border: none; background: #f0f0f0;
  border-radius: 50%; font-size: 18px; color: #666;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}

.user-card-id {
  font-size: 20px; font-weight: 700; color: #111;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}

.user-card-avatar {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F7B500, #FF8C00);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  margin: 4px 0;
}
.card-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.card-avatar-initial { font-size: 28px; font-weight: 700; color: #fff; }

.user-card-name { font-size: 16px; font-weight: 600; color: #111; }
.user-card-badge { font-size: 12px; color: #07C160; background: #E8F5E9; padding: 3px 10px; border-radius: 20px; }

.user-card-stats {
  display: flex;
  align-items: center;
  gap: 0;
  background: #F8F8F8;
  border-radius: 12px;
  padding: 14px 24px;
  width: 100%;
  margin: 4px 0;
}
.stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-label { font-size: 12px; color: #999; }
.stat-value { font-size: 20px; font-weight: 700; color: #111; }
.stat-divider { width: 1px; height: 36px; background: #e0e0e0; margin: 0 12px; }

.user-card-profile-btn {
  width: 100%;
  padding: 13px;
  background: #F5F5F5;
  border: none; border-radius: 12px;
  font-size: 14px; font-weight: 500; color: #333;
  cursor: pointer; text-align: left;
  transition: background 0.2s;
}
.user-card-profile-btn:hover { background: #EBEBEB; }

.user-card-subscribe-btn {
  width: 100%;
  padding: 13px;
  background: linear-gradient(135deg, #4A9EFF, #10AEFF);
  border: none; border-radius: 12px;
  font-size: 14px; font-weight: 600; color: #fff;
  cursor: pointer; text-align: center;
  transition: opacity 0.2s;
}
.user-card-subscribe-btn:hover { opacity: 0.9; }

/* ==================== 发布菜单 ==================== */
.publish-menu-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 50;
}

.publish-menu {
  position: absolute;
  top: 52px;
  left: 12px;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 55;
  overflow: hidden;
  min-width: 140px;
}

.publish-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 13px 16px;
  background: none;
  border: none;
  font-size: 14px;
  color: #000;
  cursor: pointer;
  text-align: left;
}
.publish-menu-item:not(:last-child) {
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.publish-menu-item:hover { background: #F7F7F7; }
.publish-menu-item:active { background: #EFEFEF; }

.publish-menu-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(7, 193, 96, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #07C160;
  flex-shrink: 0;
}
.publish-menu-item:last-child .publish-menu-icon {
  background: rgba(255, 165, 0, 0.1);
  color: #F7B500;
}

/* 发布菜单动画 */
.publish-menu-slide-enter-active,
.publish-menu-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.publish-menu-slide-enter-from,
.publish-menu-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* ==================== 动画 ==================== */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .app-wrapper { padding: 0; }
  .phone-container { border: none; }
}

/* ==================== 添加到桌面 ==================== */
.a2h-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 9999;
  display: flex; align-items: flex-end; justify-content: center;
}
.a2h-sheet {
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding: 12px 20px 36px;
  width: 100%; max-width: 430px;
  display: flex; flex-direction: column; gap: 16px;
}
.a2h-handle {
  width: 36px; height: 4px;
  background: #e0e0e0; border-radius: 2px;
  margin: 0 auto 4px;
}
.a2h-head {
  display: flex; align-items: center; gap: 14px;
}
.a2h-icon {
  width: 52px; height: 52px; border-radius: 12px;
  object-fit: cover; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.a2h-title {
  font-size: 17px; font-weight: 700; color: #111;
}
.a2h-sub {
  font-size: 13px; color: #777; margin-top: 3px;
}
.a2h-btn-install {
  background: linear-gradient(135deg, #07C160, #05A94F);
  border: none; color: #fff;
  border-radius: 12px; padding: 14px;
  font-size: 16px; font-weight: 700; cursor: pointer;
  box-shadow: 0 3px 12px rgba(7,193,96,0.35);
  transition: transform 0.15s;
}
.a2h-btn-install:active { transform: scale(0.97); }
.a2h-steps {
  display: flex; flex-direction: column; gap: 12px;
  background: #f8f8f8; border-radius: 12px; padding: 14px 16px;
}
.a2h-step {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 14px; color: #333; line-height: 1.5;
}
.a2h-num {
  width: 22px; height: 22px;
  background: #07C160; color: #fff;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 1px;
}
.a2h-share-icon { color: #007aff; font-weight: 700; }
.a2h-tip {
  font-size: 12px; color: #F7A400;
  background: #FFF8E1; border-radius: 8px;
  padding: 7px 10px; margin-bottom: 4px;
}
.a2h-btn-close {
  background: #f0f0f0; border: none;
  border-radius: 12px; padding: 13px;
  font-size: 15px; color: #555; cursor: pointer;
  transition: background 0.15s;
}
.a2h-btn-close:hover { background: #e5e5e5; }

/* 底部引导动画 */
.a2h-slide-enter-active { transition: opacity 0.25s ease; }
.a2h-slide-leave-active { transition: opacity 0.22s ease-in; }
.a2h-slide-enter-from, .a2h-slide-leave-to { opacity: 0; }
.a2h-slide-enter-active .a2h-sheet { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.a2h-slide-leave-active .a2h-sheet { transition: transform 0.22s ease-in; }
.a2h-slide-enter-from .a2h-sheet,
.a2h-slide-leave-to .a2h-sheet { transform: translateY(100%); }
</style>

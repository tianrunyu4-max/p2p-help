import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

// 路由配置（已清理，使用稳定版组件）
const routes = [
  {
    path: '/',
    name: 'Community',
    component: () => import('../views/Community.vue')
  },
  {
    path: '/team',
    name: 'Team',
    component: () => import('../views/Team.vue')
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue')
  },
  {
    path: '/task',
    name: 'Task',
    component: () => import('../views/TaskStreamView.vue')
  },
  {
    path: '/stream',
    name: 'TaskStream',
    component: () => import('../views/TaskStreamView.vue')
  },
  {
    path: '/transfer-history',
    name: 'TransferHistory',
    component: () => import('../views/TransferHistory.vue')
  },
  {
    path: '/transaction-history',
    name: 'TransactionHistory',
    component: () => import('../views/TransactionHistory.vue')
  },
{
    path: '/admin',
    name: 'AdminPanel',
    component: () => import('../views/AdminPanel.vue')
  },
  {
    path: '/checkin',
    name: 'CheckinPage',
    component: () => import('../views/CheckinPage.vue')
  },
  {
    path: '/hub',
    name: 'Hub',
    component: () => import('../views/Hub.vue')
  },
  {
    path: '/deepsook',
    name: 'DeepSook',
    component: () => import('../views/DeepSook.vue')
  },
  {
    path: '/ppx',
    name: 'PPX',
    component: () => import('../views/PPX.vue')
  },
  {
    path: '/healthx',
    name: 'HealthX',
    component: () => import('../views/HealthX.vue')
  },
  {
    path: '/publish',
    name: 'Publish',
    component: () => import('../views/PublishPage.vue')
  },
  {
    path: '/create-community',
    name: 'CreateCommunity',
    component: () => import('../views/CreateCommunity.vue')
  },
  {
    path: '/shipping-address',
    name: 'ShippingAddress',
    component: () => import('../views/ShippingAddress.vue')
  },
  {
    path: '/payment-address',
    name: 'PaymentAddress',
    component: () => import('../views/PaymentAddress.vue')
  },
  {
    path: '/transaction-password',
    name: 'TransactionPassword',
    component: () => import('../views/TransactionPassword.vue')
  },
  {
    path: '/private-chat/:id',
    name: 'PrivateChat',
    component: () => import('../views/PrivateChat.vue')
  },
  {
    path: '/redeem',
    name: 'RedeemCode',
    component: () => import('../views/RedeemCode.vue')
  },
  {
    path: '/lottery-ai',
    name: 'LotteryAI',
    component: () => import('../views/LotteryAI.vue')
  },
  {
    path: '/recharge',
    name: 'RechargePage',
    component: () => import('../views/RechargePage.vue')
  },
  {
    path: '/withdraw',
    name: 'WithdrawPage',
    component: () => import('../views/WithdrawPage.vue')
  },
  {
    path: '/language',
    name: 'Language',
    component: () => import('../views/LanguagePage.vue')
  },
  {
    path: '/marketplace',
    name: 'Marketplace',
    component: () => import('../views/MarketplacePage.vue')
  },
  {
    path: '/ai-tools',
    name: 'AITools',
    component: () => import('../views/AIToolsPage.vue')
  },
  // 404 兜底 - 重定向到首页
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

// 根据环境选择路由模式
// 生产环境使用 Hash 模式兼容 Cloudflare Pages
// 开发环境使用 History 模式
const router = createRouter({
  history: import.meta.env.PROD ? createWebHashHistory() : createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// 路由守卫：处理推荐码
router.beforeEach((to, from, next) => {
  // 处理URL中的推荐码
  if (to.query.ref) {
    localStorage.setItem('pending_referrer', to.query.ref)
  }
  next()
})

export default router


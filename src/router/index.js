import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/',          component: () => import('../views/HomePage.vue') },
  { path: '/activate',  component: () => import('../views/ActivatePage.vue') },
  { path: '/payment/:taskId', component: () => import('../views/PaymentDetail.vue') },
  { path: '/myshop',    component: () => import('../views/MyShop.vue') },
  { path: '/confirm',   component: () => import('../views/PendingConfirm.vue') },
  { path: '/profile',   component: () => import('../views/ProfilePage.vue') },
  { path: '/admin',     component: () => import('../views/AdminPanel.vue') },
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})

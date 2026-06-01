<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

// ── 管理员登录状态 ────────────────────────────
const adminToken  = ref(sessionStorage.getItem('adminToken') || '')
const loginCode   = ref('')
const loginError  = ref('')
const loginLoading = ref(false)

async function handleAdminLogin() {
  if (!loginCode.value) { loginError.value = '请输入管理员密码'; return }
  loginLoading.value = true
  loginError.value = ''
  try {
    // 用后端 /api/admin/verify 验证密码，成功后存 session
    await axios.get('/api/admin/orders', {
      headers: { 'X-Admin-Token': loginCode.value }
    })
    adminToken.value = loginCode.value
    sessionStorage.setItem('adminToken', loginCode.value)
    axios.defaults.headers.common['X-Admin-Token'] = loginCode.value
    loadOrders()
  } catch {
    loginError.value = '密码错误，请重试'
  } finally {
    loginLoading.value = false
  }
}

function handleLogout() {
  adminToken.value = ''
  sessionStorage.removeItem('adminToken')
  delete axios.defaults.headers.common['X-Admin-Token']
}

// ── 数据 ──────────────────────────────────────
const tab     = ref('orders')
const orders  = ref([])
const users   = ref([])
const loading = ref(false)

if (adminToken.value) {
  axios.defaults.headers.common['X-Admin-Token'] = adminToken.value
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/orders')
    orders.value = res.data.data
  } catch (e) {
    if (e.response?.status === 403) handleLogout()
  } finally { loading.value = false }
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/users')
    users.value = res.data.data
  } catch (e) {
    if (e.response?.status === 403) handleLogout()
  } finally { loading.value = false }
}

onMounted(() => { if (adminToken.value) loadOrders() })

async function forceComplete(taskId) {
  if (!confirm('确认强制完成此任务？')) return
  await axios.post(`/api/admin/force-complete/${taskId}`)
  loadOrders()
}

async function toggleFreeze(userId, frozen) {
  await axios.post(`/api/admin/freeze-user`, { userId, frozen: !frozen })
  loadUsers()
}

function switchTab(t) {
  tab.value = t
  if (t === 'orders') loadOrders()
  if (t === 'users')  loadUsers()
}
</script>

<template>
  <div class="page">

    <!-- 未登录：显示管理员验证界面 -->
    <template v-if="!adminToken">
      <div class="login-wrap">
        <div class="lock-icon">🔐</div>
        <h2 class="login-title">管理后台</h2>
        <p class="login-sub">仅限管理员访问</p>
        <div class="form-card">
          <input
            v-model="loginCode"
            type="password"
            placeholder="管理员密码"
            class="input"
            @keyup.enter="handleAdminLogin"
          />
          <p v-if="loginError" class="err-msg">{{ loginError }}</p>
          <button class="btn-main" :disabled="loginLoading" @click="handleAdminLogin">
            {{ loginLoading ? '验证中...' : '进入后台' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 已登录：管理后台内容 -->
    <template v-else>
      <div class="header-row">
        <h2 class="page-title">🔧 管理后台</h2>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>

      <div class="tabs">
        <button :class="['tab', tab==='orders'?'active':'']" @click="switchTab('orders')">订单管理</button>
        <button :class="['tab', tab==='users'?'active':'']"  @click="switchTab('users')">用户管理</button>
      </div>

      <div v-if="loading" class="loading">加载中...</div>

      <!-- 订单列表 -->
      <template v-else-if="tab==='orders'">
        <div v-for="o in orders" :key="o.id" class="order-card">
          <div class="order-top">
            <span class="order-id">订单 #{{ o.id.slice(0,8) }}</span>
            <span :class="['status-badge', o.status]">{{ o.status }}</span>
          </div>
          <div class="order-info">
            付款方：{{ o.payer_no }}  →  收款方：{{ o.receiver_no }}<br/>
            金额：¥{{ o.amount }} · {{ o.type_label }}
          </div>
          <div v-if="o.screenshot_url" class="screenshot-row">
            <img :src="o.screenshot_url" class="thumb" @click="window.open(o.screenshot_url)" />
          </div>
          <div class="order-actions">
            <button
              v-if="o.status !== 'confirmed'"
              class="btn-force"
              @click="forceComplete(o.id)"
            >强制完成</button>
          </div>
        </div>
        <p v-if="!orders.length && !loading" class="empty">暂无订单</p>
      </template>

      <!-- 用户列表 -->
      <template v-else>
        <div v-for="u in users" :key="u.id" class="user-card">
          <div class="user-info">
            <span class="user-no">#{{ u.user_no }}</span>
            <span class="user-email">{{ u.email }}</span>
            <span :class="['freeze-badge', u.is_frozen ? 'frozen' : 'normal']">
              {{ u.is_frozen ? '已冻结' : '正常' }}
            </span>
          </div>
          <div class="user-stats">
            累计收款：¥{{ u.total_received }} · 直推：{{ u.invite_used }}/2人
          </div>
          <button
            :class="u.is_frozen ? 'btn-unfreeze' : 'btn-freeze'"
            @click="toggleFreeze(u.id, u.is_frozen)"
          >
            {{ u.is_frozen ? '解冻' : '冻结账户' }}
          </button>
        </div>
        <p v-if="!users.length && !loading" class="empty">暂无用户</p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 16px; min-height: 100vh; }

/* 登录界面 */
.login-wrap { display: flex; flex-direction: column; align-items: center; padding-top: 80px; }
.lock-icon { font-size: 48px; margin-bottom: 12px; }
.login-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.login-sub { color: #999; font-size: 13px; margin-bottom: 32px; }
.form-card { width: 100%; max-width: 340px; }
.input { width: 100%; padding: 14px 16px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; margin-bottom: 12px; outline: none; box-sizing: border-box; }
.btn-main { width: 100%; padding: 14px; background: #333; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; }
.err-msg { color: #e53e3e; font-size: 13px; margin-bottom: 8px; }

/* 后台内容 */
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; }
.btn-logout { padding: 6px 14px; background: #eee; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; color: #666; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab { padding: 8px 20px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 14px; }
.tab.active { background: #333; color: #fff; border-color: #333; }
.loading { text-align: center; padding: 40px; color: #999; }
.empty { text-align: center; color: #bbb; padding: 40px; font-size: 14px; }
.order-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.order-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
.order-id { font-size: 13px; color: #999; }
.status-badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #eee; }
.status-badge.confirmed { background: #c6f6d5; color: #276749; }
.status-badge.ai_review { background: #fed7d7; color: #9b2c2c; }
.order-info { font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 8px; }
.screenshot-row { margin-bottom: 8px; }
.thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; }
.order-actions { text-align: right; }
.btn-force { padding: 6px 14px; background: #f0a500; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
.user-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.user-info { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.user-no { font-weight: 700; font-size: 15px; }
.user-email { color: #666; font-size: 13px; }
.freeze-badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.freeze-badge.normal { background: #c6f6d5; color: #276749; }
.freeze-badge.frozen { background: #fed7d7; color: #9b2c2c; }
.user-stats { font-size: 13px; color: #888; margin-bottom: 8px; }
.btn-freeze { padding: 6px 14px; background: #e53e3e; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
.btn-unfreeze { padding: 6px 14px; background: #48bb78; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
</style>

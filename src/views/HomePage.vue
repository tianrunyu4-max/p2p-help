<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'

const router = useRouter()
const store  = useUserStore()

const email      = ref('')
const inviteCode = ref('')
const loading    = ref(false)
const error      = ref('')

// 自动生成6位ID（注册后返回）
async function handleRegister() {
  if (!email.value) { error.value = '请输入邮箱'; return }
  loading.value = true
  error.value = ''
  try {
    const res = await axios.post('/api/auth/register', {
      email: email.value,
      inviteCode: inviteCode.value
    })
    store.setToken(res.data.data.token)
    store.setUserInfo(res.data.data.user)
    router.push('/')
  } catch (e) {
    error.value = e.response?.data?.message || '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page home-page">
    <!-- 已登录 -->
    <template v-if="store.isLoggedIn">
      <div class="header-card">
        <div class="id-badge">
          <span class="id-label">我的ID</span>
          <span class="id-number">{{ store.userId }}</span>
        </div>
        <div class="status-badge" :class="store.isActivated ? 'active' : 'inactive'">
          {{ store.isActivated ? '✅ 已激活' : '⏳ 未激活' }}
        </div>
      </div>

      <div v-if="!store.isActivated" class="activate-section">
        <button class="btn-activate" @click="router.push('/activate')">
          立即激活 · 350元
        </button>
        <p class="tip">激活后加入1+1互助模型</p>
      </div>

      <div v-else class="stats-grid">
        <div class="stat-card" @click="router.push('/myshop')">
          <span class="stat-icon">🏪</span>
          <span class="stat-label">我的店铺</span>
        </div>
        <div class="stat-card" @click="router.push('/confirm')">
          <span class="stat-icon">✅</span>
          <span class="stat-label">待确认</span>
        </div>
      </div>
    </template>

    <!-- 未登录/注册 -->
    <template v-else>
      <div class="login-wrap">
        <h1 class="logo-title">🏪 1+1 互助</h1>
        <p class="logo-sub">点对点 · 直接打款 · 全程透明</p>

        <div class="form-card">
          <input v-model="email" type="email" placeholder="邮箱" class="input" />
          <input v-model="inviteCode" type="text" placeholder="邀请码（必填）" class="input" />
          <p v-if="error" class="err-msg">{{ error }}</p>
          <button class="btn-main" :disabled="loading" @click="handleRegister">
            {{ loading ? '处理中...' : '进入系统' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 20px; min-height: 100vh; }
.header-card { background: linear-gradient(135deg, #f0a500, #e08000); border-radius: 16px; padding: 24px; color: #fff; margin-bottom: 20px; }
.id-badge { margin-bottom: 8px; }
.id-label { font-size: 12px; opacity: .8; margin-right: 8px; }
.id-number { font-size: 28px; font-weight: 700; letter-spacing: 3px; }
.status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; background: rgba(255,255,255,.25); }
.activate-section { text-align: center; padding: 30px 0; }
.btn-activate { background: #f0a500; color: #fff; border: none; border-radius: 12px; padding: 16px 40px; font-size: 18px; font-weight: 700; cursor: pointer; }
.tip { margin-top: 8px; color: #999; font-size: 13px; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.stat-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; }
.stat-icon { display: block; font-size: 28px; margin-bottom: 6px; }
.stat-label { font-size: 13px; color: #666; }
.login-wrap { display: flex; flex-direction: column; align-items: center; padding-top: 60px; }
.logo-title { font-size: 32px; margin-bottom: 6px; }
.logo-sub { color: #999; margin-bottom: 40px; font-size: 14px; }
.form-card { width: 100%; }
.input { width: 100%; padding: 14px 16px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; margin-bottom: 12px; outline: none; }
.btn-main { width: 100%; padding: 14px; background: #f0a500; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; }
.err-msg { color: #e53e3e; font-size: 13px; margin-bottom: 8px; }
</style>

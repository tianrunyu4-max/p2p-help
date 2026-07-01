<template>
  <div class="transaction-password-page">
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">交易密码</h1>
      <div class="placeholder"></div>
    </div>

    <div class="page-content">
      <template v-if="!hasPassword">
        <div class="password-card">
          <div class="card-icon">🔐</div>
          <h2 class="card-title">设置交易密码</h2>
          <p class="card-desc">用于提现、转账等敏感操作验证</p>

          <div class="form-group">
            <label>设置密码</label>
            <input v-model="newPassword" type="password" placeholder="请输入6位数字密码" maxlength="6"/>
          </div>
          <div class="form-group">
            <label>确认密码</label>
            <input v-model="confirmPassword" type="password" placeholder="请再次输入密码" maxlength="6"/>
          </div>
          <button class="submit-btn" @click="setPassword" :disabled="isLoading">
            {{ isLoading ? '设置中...' : '确认设置' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="status-card">
          <div class="status-icon">✅</div>
          <h2>交易密码已设置</h2>
        </div>

        <div class="password-card">
          <h3>修改密码</h3>
          <div class="form-group">
            <label>当前密码</label>
            <input v-model="currentPassword" type="password" placeholder="请输入当前密码" maxlength="6"/>
          </div>
          <div class="form-group">
            <label>新密码</label>
            <input v-model="newPassword" type="password" placeholder="请输入新密码" maxlength="6"/>
          </div>
          <div class="form-group">
            <label>确认新密码</label>
            <input v-model="confirmPassword" type="password" placeholder="请再次输入新密码" maxlength="6"/>
          </div>
          <button class="submit-btn" @click="changePassword" :disabled="isLoading">
            {{ isLoading ? '修改中...' : '确认修改' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getUserId } from '../utils/auth'

const API_BASE = import.meta.env.VITE_API_URL || ''

const hasPassword = ref(false)
const isLoading = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

// 检查是否已设置交易密码
onMounted(async () => {
  const userId = getUserId()
  if (!userId) return

  try {
    const res = await fetch(`${API_BASE}/api/auth/user/${userId}`)
    const data = await res.json()
    if (data.code === 200 && data.data) {
      // 使用 has_transaction_password 字段判断
      hasPassword.value = !!data.data.has_transaction_password
    }
  } catch (e) {
    console.error('检查交易密码状态失败:', e)
  }
})

const setPassword = async () => {
  if (!/^\d{6}$/.test(newPassword.value)) { alert('请输入6位数字密码'); return }
  if (newPassword.value !== confirmPassword.value) { alert('两次密码不一致'); return }

  const userId = getUserId()
  if (!userId) { alert('请先登录'); return }

  isLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/auth/transaction-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password: newPassword.value })
    })
    const data = await res.json()
    
    if (data.code === 200) {
      hasPassword.value = true
      newPassword.value = confirmPassword.value = ''
      alert('设置成功')
    } else {
      alert(data.message || '设置失败')
    }
  } catch (e) {
    console.error('设置交易密码失败:', e)
    alert('网络错误，请重试')
  } finally {
    isLoading.value = false
  }
}

const changePassword = async () => {
  if (!/^\d{6}$/.test(newPassword.value)) { alert('请输入6位数字新密码'); return }
  if (newPassword.value !== confirmPassword.value) { alert('两次密码不一致'); return }

  const userId = getUserId()
  if (!userId) { alert('请先登录'); return }

  isLoading.value = true
  try {
    const res = await fetch(`${API_BASE}/api/auth/transaction-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      })
    })
    const data = await res.json()
    
    if (data.code === 200) {
      currentPassword.value = newPassword.value = confirmPassword.value = ''
      alert('修改成功')
    } else {
      alert(data.message || '修改失败')
    }
  } catch (e) {
    console.error('修改交易密码失败:', e)
    alert('网络错误，请重试')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.transaction-password-page { height: 100%; display: flex; flex-direction: column; background: #F5F5F5; }
.page-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #FFF; border-bottom: 1px solid rgba(0,0,0,0.08); }
.back-btn { width: 36px; height: 36px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #333; }
.page-title { font-size: 17px; font-weight: 600; }
.placeholder { width: 36px; }
.page-content { flex: 1; overflow-y: auto; padding: 16px; }
.status-card { background: linear-gradient(135deg, #E8F5E9, #C8E6C9); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 20px; }
.status-icon { font-size: 48px; margin-bottom: 12px; }
.password-card { background: #FFF; border-radius: 16px; padding: 24px; margin-bottom: 16px; }
.card-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
.card-title { font-size: 20px; font-weight: 600; text-align: center; margin: 0 0 8px; }
.card-desc { font-size: 13px; color: #666; text-align: center; margin: 0 0 24px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
.form-group input { width: 100%; padding: 14px; border: 1px solid rgba(0,0,0,0.1); border-radius: 10px; font-size: 18px; letter-spacing: 8px; text-align: center; outline: none; box-sizing: border-box; }
.form-group input:focus { border-color: #07C160; }
.submit-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #07C160, #06AD56); border: none; border-radius: 10px; color: #FFF; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 8px; }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

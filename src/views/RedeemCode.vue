<template>
  <div class="redeem-page">
    <div class="page-header">
      <button class="back-btn" @click="goBack">←</button>
      <h1 class="page-title">兑换激活码</h1>
      <div class="header-spacer"></div>
    </div>

    <div class="redeem-container">
      <div class="icon">🔑</div>
      <h2>输入激活码</h2>
      <p class="hint">输入邀请人提供的激活码</p>

      <input
        v-model="redeemCode"
        type="text"
        placeholder="输入激活码"
        class="code-input"
        @input="redeemCode = redeemCode.toUpperCase()"
      />

      <input
        v-model="inviteCode"
        type="text"
        placeholder="邀请码（必填）"
        class="invite-input"
        @input="inviteCode = inviteCode.toUpperCase()"
      />

      <button class="redeem-btn" @click="handleRedeem" :disabled="!redeemCode || !inviteCode || isRedeeming">
        {{ isRedeeming ? '激活中...' : '立即激活' }}
      </button>

      <!-- 激活成功结果 -->
      <div v-if="activationResult" class="result-card">
        <div class="result-icon">✅</div>
        <div class="result-title">激活成功！</div>
        <div class="result-plan">{{ activationResult.planName }}</div>
        <div class="result-invite">
          <span class="invite-label">我的邀请码：</span>
          <span class="invite-code" @click="copyInviteCode">{{ activationResult.inviteCode }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getOrCreateUserId } from '../utils/auth'
import { useToast } from '../composables/useToast'
import { apiRequest } from '../config/api'
import { useUserStore } from '../stores/userStore.js'

const router = useRouter()
const { success, error } = useToast()
const userStore = useUserStore()

const userId = ref(getOrCreateUserId())
const redeemCode = ref('')
const inviteCode = ref('')
const isRedeeming = ref(false)
const activationResult = ref(null)

async function handleRedeem() {
  if (!redeemCode.value) {
    error('请输入激活码')
    return
  }
  if (!inviteCode.value) {
    error('请输入邀请码')
    return
  }

  isRedeeming.value = true

  try {
    const data = await apiRequest('/redeem/use', {
      method: 'POST',
      body: {
        userId: userId.value,
        code: redeemCode.value,
        inviteCode: inviteCode.value || undefined
      }
    })

    if (data.code === 200) {
      activationResult.value = data.data
      // 激活成功 → 立即更新全局 store
      userStore.setActivated(data.data)
      success('激活成功', `已激活 ${data.data.planName}`)
      redeemCode.value = ''
      inviteCode.value = ''
      setTimeout(() => {
        router.push('/profile')
      }, 2000)
    } else {
      error('激活失败', data.message || '激活码无效')
    }
  } catch (err) {
    error('激活失败', err.message || '网络异常，请稍后重试')
  } finally {
    isRedeeming.value = false
  }
}

function copyInviteCode() {
  if (activationResult.value?.inviteCode) {
    navigator.clipboard.writeText(activationResult.value.inviteCode).catch(() => {})
    success('已复制邀请码')
  }
}

function goBack() {
  router.back()
}
</script>

<style scoped>
.redeem-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: white;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.header-spacer {
  width: 36px;
}

.redeem-container {
  background: white;
  border-radius: 16px;
  padding: 40px 20px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.icon {
  font-size: 64px;
  margin-bottom: 20px;
}

h2 {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.hint {
  font-size: 14px;
  color: #999;
  margin-bottom: 30px;
}

.code-input {
  width: 100%;
  max-width: 300px;
  padding: 16px;
  border: 2px solid #e5e5e5;
  border-radius: 12px;
  font-size: 18px;
  text-align: center;
  font-weight: 600;
  letter-spacing: 2px;
  margin-bottom: 12px;
  box-sizing: border-box;
}

.code-input:focus {
  outline: none;
  border-color: #667EEA;
}

.invite-input {
  width: 100%;
  max-width: 300px;
  padding: 12px 16px;
  border: 2px solid #e5e5e5;
  border-radius: 12px;
  font-size: 15px;
  text-align: center;
  font-weight: 500;
  letter-spacing: 1px;
  margin-bottom: 20px;
  box-sizing: border-box;
  color: #666;
}

.invite-input:focus {
  outline: none;
  border-color: #667EEA;
}

.redeem-btn {
  width: 100%;
  max-width: 300px;
  padding: 16px;
  background: linear-gradient(135deg, #667EEA, #764BA2);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.redeem-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.redeem-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-card {
  margin-top: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #f0fff4, #e6f7ff);
  border-radius: 12px;
  border: 1px solid #b7eb8f;
}

.result-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.result-title {
  font-size: 18px;
  font-weight: 700;
  color: #389e0d;
  margin-bottom: 4px;
}

.result-plan {
  font-size: 15px;
  color: #52c41a;
  margin-bottom: 12px;
}

.result-invite {
  font-size: 14px;
  color: #666;
}

.invite-label {
  color: #888;
}

.invite-code {
  font-size: 16px;
  font-weight: 700;
  color: #667EEA;
  cursor: pointer;
  letter-spacing: 2px;
  margin-left: 4px;
}

.invite-code:hover {
  text-decoration: underline;
}
</style>

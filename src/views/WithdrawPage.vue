<template>
  <div class="withdraw-page">

    <!-- 顶部 Header -->
    <div class="withdraw-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <span class="header-title">🏦 余额提现</span>
      <span class="header-right"></span>
    </div>

    <!-- 当前余额 -->
    <div class="balance-banner">
      <span class="bal-label">可提现余额</span>
      <span class="bal-value">${{ currentBalance.toFixed(2) }}</span>
    </div>

    <div class="withdraw-body">

      <!-- 激活提示 -->
      <div class="warn-box" v-if="!isActivated">
        ⚠️ 请先激活账号才能申请提现
      </div>

      <template v-else>
        <!-- 提现金额 -->
        <div class="section-card">
          <div class="section-title">① 填写提现金额</div>
          <div class="amount-grid">
            <button
              v-for="amt in presetAmounts"
              :key="amt"
              :class="['amount-btn', selectedAmount === amt ? 'amount-selected' : '']"
              @click="selectAmount(amt)">
              ${{ amt }}
            </button>
          </div>
          <div class="custom-amount-wrap">
            <span class="custom-prefix">$</span>
            <input
              v-model="customInput"
              type="number"
              min="10"
              placeholder="自定义金额（最低 $10）"
              class="custom-input"
              @input="onCustomInput" />
          </div>
          <div v-if="selectedAmount" class="amount-confirm-row">
            <span>提现金额：</span>
            <span class="amount-highlight">${{ selectedAmount }} USDT</span>
          </div>
          <div v-if="selectedAmount && selectedAmount > currentBalance" class="err-hint">
            余额不足（当前 ${{ currentBalance.toFixed(2) }}）
          </div>
        </div>

        <!-- 收款地址 -->
        <div class="section-card" v-if="selectedAmount && selectedAmount <= currentBalance">
          <div class="section-title">② 填写收款钱包地址</div>
          <div class="network-badge">📡 网络：BSC (BEP20) 币安智能链</div>
          <input
            v-model="walletAddress"
            type="text"
            class="wallet-input"
            placeholder="0x... （BEP20 地址，42位）"
            maxlength="42" />
          <div class="warning-box">
            ⚠️ 请确认为 <b>BEP20（币安链）</b> 地址，填错将导致资产丢失
          </div>

          <button
            class="submit-btn"
            :class="{ 'submit-loading': submitting }"
            :disabled="!canSubmit"
            @click="submitWithdraw">
            <span v-if="submitting">⏳ 提交中...</span>
            <span v-else>🚀 申请提现</span>
          </button>

          <div v-if="resultMsg" :class="['result-msg', resultSuccess ? 'result-ok' : 'result-err']">
            {{ resultMsg }}
          </div>
        </div>

        <!-- 提现记录 -->
        <div class="section-card" v-if="history.length > 0">
          <div class="section-title">提现记录</div>
          <div v-for="log in history" :key="log.id" class="history-row">
            <div class="history-left">
              <span class="history-amount-neg">-${{ parseFloat(log.amount).toFixed(2) }}</span>
              <span class="history-wallet">{{ log.wallet_address?.slice(0, 10) }}...{{ log.wallet_address?.slice(-6) }}</span>
            </div>
            <span :class="['history-status', 'status-' + log.status]">
              {{ statusText(log.status) }}
            </span>
          </div>
        </div>

        <!-- 说明 -->
        <div class="help-card">
          <div class="help-title">❓ 常见问题</div>
          <div class="help-item"><b>Q: 多久到账？</b><br/>A: 管理员审核后人工打款，通常 1-3 个工作日。</div>
          <div class="help-item"><b>Q: 最低提现多少？</b><br/>A: 最低 $10 USDT。</div>
          <div class="help-item"><b>Q: 支持哪些网络？</b><br/>A: 仅支持 BSC (BEP20) 网络。</div>
          <div class="help-item"><b>Q: 提现被拒怎么办？</b><br/>A: 余额会自动退回，请检查地址后重新申请。</div>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'

const userStore = useUserStore()

const presetAmounts = [10, 30, 50, 100]

const selectedAmount = ref(null)
const customInput = ref('')
const walletAddress = ref('')
const submitting = ref(false)
const resultMsg = ref('')
const resultSuccess = ref(false)
const history = ref([])

const currentBalance = computed(() => parseFloat(userStore.balance) || 0)
const isActivated = computed(() => userStore.isActivated)

const canSubmit = computed(() => {
  return selectedAmount.value >= 10
    && selectedAmount.value <= currentBalance.value
    && /^0x[0-9a-fA-F]{40}$/.test(walletAddress.value.trim())
    && !submitting.value
})

function selectAmount(amt) {
  selectedAmount.value = amt
  customInput.value = ''
  resultMsg.value = ''
}

function onCustomInput() {
  const v = parseFloat(customInput.value)
  selectedAmount.value = (!isNaN(v) && v >= 10) ? v : null
}

function statusText(s) {
  return { pending: '待审核', approved: '已打款', rejected: '已拒绝' }[s] || s
}

async function submitWithdraw() {
  if (!canSubmit.value) return
  submitting.value = true
  resultMsg.value = ''

  const userId = userStore.userId || localStorage.getItem('chatUserId')
  if (!userId) {
    resultMsg.value = '请先登录'
    resultSuccess.value = false
    submitting.value = false
    return
  }

  try {
    const res = await fetch('/api/withdraw/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount: selectedAmount.value, walletAddress: walletAddress.value.trim() })
    })
    const data = await res.json()
    resultSuccess.value = data.code === 200
    resultMsg.value = data.message || (data.code === 200 ? '申请成功，等待审核' : '提交失败')
    if (data.code === 200) {
      selectedAmount.value = null
      walletAddress.value = ''
      customInput.value = ''
      await userStore.fetchUserStatus()
      await loadHistory()
    }
  } catch (e) {
    resultMsg.value = '网络错误，请稍后重试'
    resultSuccess.value = false
  } finally {
    submitting.value = false
  }
}

async function loadHistory() {
  const userId = userStore.userId || localStorage.getItem('chatUserId')
  if (!userId) return
  try {
    const res = await fetch(`/api/withdraw/history?userId=${userId}`)
    const data = await res.json()
    if (data.code === 200) history.value = data.data || []
  } catch {}
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.withdraw-page { min-height: 100vh; background: #F0F7FF; color: #333; padding-bottom: 40px; }

.withdraw-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.back-btn { background: none; border: none; font-size: 28px; color: #333; cursor: pointer; padding: 0 8px; line-height: 1; }
.header-title { font-size: 16px; font-weight: 700; color: #1D4ED8; }
.header-right { width: 40px; }

.balance-banner {
  display: flex; align-items: center; justify-content: space-between;
  margin: 16px; padding: 16px 20px;
  background: linear-gradient(135deg, #3B82F6, #1D4ED8);
  border-radius: 14px; color: #fff;
}
.bal-label { font-size: 13px; opacity: 0.85; }
.bal-value { font-size: 28px; font-weight: 700; }

.withdraw-body { padding: 0 16px; }

.warn-box {
  background: #FFF3CD; border: 1px solid #FBBF24; border-radius: 10px;
  padding: 14px 16px; font-size: 13px; color: #92400E; margin-bottom: 12px;
}

.section-card {
  background: #fff; border-radius: 14px; padding: 16px;
  margin-bottom: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.section-title { font-size: 14px; font-weight: 700; color: #1D4ED8; margin-bottom: 14px; }

.amount-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.amount-btn {
  padding: 10px 0; border: 1.5px solid #E2E8F0;
  border-radius: 8px; font-size: 14px; font-weight: 600;
  background: #F8FAFC; color: #334155; cursor: pointer;
}
.amount-selected { border-color: #3B82F6; background: #EFF6FF; color: #1D4ED8; }

.custom-amount-wrap { display: flex; align-items: center; border: 1.5px solid #E2E8F0; border-radius: 8px; overflow: hidden; }
.custom-prefix { padding: 10px 12px; font-size: 16px; font-weight: 600; color: #64748B; background: #F8FAFC; }
.custom-input { flex: 1; border: none; outline: none; padding: 10px 12px; font-size: 14px; }

.amount-confirm-row { margin-top: 10px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748B; }
.amount-highlight { font-size: 18px; font-weight: 700; color: #1D4ED8; }
.err-hint { margin-top: 8px; font-size: 12px; color: #EF4444; }

.network-badge { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 6px 10px; font-size: 12px; color: #1D4ED8; margin-bottom: 12px; }

.wallet-input {
  width: 100%; box-sizing: border-box;
  border: 1.5px solid #E2E8F0; border-radius: 8px;
  padding: 12px; font-size: 13px; font-family: monospace;
  outline: none; margin-bottom: 10px;
}
.wallet-input:focus { border-color: #3B82F6; }

.warning-box { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #92400E; margin-bottom: 14px; line-height: 1.6; }

.submit-btn {
  width: 100%; padding: 14px;
  background: linear-gradient(135deg, #3B82F6, #1D4ED8);
  color: #fff; border: none; border-radius: 12px;
  font-size: 15px; font-weight: 700; cursor: pointer;
}
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.submit-btn:active:not(:disabled) { transform: scale(0.98); }

.result-msg { margin-top: 12px; padding: 10px 14px; border-radius: 8px; font-size: 13px; text-align: center; }
.result-ok { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
.result-err { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }

.history-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F1F5F9; }
.history-row:last-child { border-bottom: none; }
.history-left { display: flex; flex-direction: column; gap: 3px; }
.history-amount-neg { font-size: 16px; font-weight: 700; color: #EF4444; }
.history-wallet { font-size: 11px; color: #94A3B8; font-family: monospace; }
.history-status { font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 12px; }
.status-pending { background: #FFF7ED; color: #EA580C; }
.status-approved { background: #F0FDF4; color: #16A34A; }
.status-rejected { background: #FEF2F2; color: #DC2626; }

.help-card { background: #fff; border-radius: 14px; padding: 16px; margin-bottom: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.help-title { font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 12px; }
.help-item { font-size: 12px; color: #64748B; margin-bottom: 10px; line-height: 1.6; }
</style>

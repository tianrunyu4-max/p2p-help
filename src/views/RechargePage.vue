<template>
  <div class="recharge-page">

    <!-- 顶部 Header -->
    <div class="recharge-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <span class="header-title">💎 USDT 充值</span>
      <span class="header-right"></span>
    </div>

    <!-- 当前余额 -->
    <div class="balance-banner">
      <span class="bal-label">当前学分</span>
      <span class="bal-value">${{ userStore.balance.toFixed(2) }}</span>
    </div>

    <div class="recharge-body">

      <!-- 第一步：选择金额 -->
      <div class="section-card">
        <div class="section-title">① 选择充值金额</div>
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
          <span>充值金额：</span>
          <span class="amount-highlight">${{ selectedAmount }} USDT</span>
        </div>
      </div>

      <!-- 第二步：转账到平台地址 -->
      <div class="section-card" v-if="selectedAmount">
        <div class="section-title">② 转账到平台地址</div>
        <div class="network-badge">📡 网络：BSC (BEP20) 币安智能链</div>

        <!-- QR码 -->
        <div class="qr-wrap">
          <img
            :src="`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${PLATFORM_ADDRESS}&color=8B6000&bgcolor=FFFDF5`"
            class="qr-img"
            alt="收款地址二维码" />
        </div>

        <!-- 地址显示+复制 -->
        <div class="address-box">
          <span class="address-text">{{ PLATFORM_ADDRESS }}</span>
          <button class="copy-btn" @click="copyAddress">
            {{ copied ? '✅ 已复制' : '📋 复制' }}
          </button>
        </div>

        <div class="warning-box">
          ⚠️ 请确认选择 <b>BEP20（币安链）</b> 网络，发送 <b>USDT</b><br/>
          发送其他币种或错误网络将导致资产丢失
        </div>
      </div>

      <!-- 第三步：粘贴交易哈希 -->
      <div class="section-card" v-if="selectedAmount">
        <div class="section-title">③ 粘贴交易哈希（TXID）</div>
        <p class="step-hint">转账完成后，在钱包/交易所找到这笔交易，复制交易哈希粘贴到下方：</p>

        <textarea
          v-model="txid"
          class="txid-input"
          placeholder="0x..."
          rows="2"
          @paste="onPaste"></textarea>

        <button
          class="verify-btn"
          :class="{ 'verify-loading': verifying }"
          :disabled="!canVerify"
          @click="verifyAndCredit">
          <span v-if="verifying">⏳ 验证中...</span>
          <span v-else>✅ 验证并到账</span>
        </button>

        <div v-if="resultMsg" :class="['result-msg', resultSuccess ? 'result-ok' : 'result-err']">
          {{ resultMsg }}
        </div>
      </div>

      <!-- 充值记录 -->
      <div class="section-card" v-if="history.length > 0">
        <div class="section-title">充值记录</div>
        <div v-for="log in history" :key="log.id" class="history-row">
          <div class="history-left">
            <span class="history-coin">💎 USDT</span>
            <span class="history-time">{{ formatTime(log.created_at) }}</span>
          </div>
          <div class="history-amount">+${{ parseFloat(log.amount).toFixed(2) }}</div>
        </div>
      </div>

      <!-- 帮助说明 -->
      <div class="help-card">
        <div class="help-title">❓ 常见问题</div>
        <div class="help-item">
          <b>Q: 多久到账？</b><br/>
          A: 链上确认后（约1-3分钟）提交哈希，系统实时验证，秒到账。
        </div>
        <div class="help-item">
          <b>Q: 最低充值多少？</b><br/>
          A: 最低 $10 USDT。
        </div>
        <div class="help-item">
          <b>Q: 支持哪些网络？</b><br/>
          A: 仅支持 BSC (BEP20) 网络，请勿使用 TRC20 或 ERC20。
        </div>
        <div class="help-item">
          <b>Q: 交易哈希在哪找？</b><br/>
          A: 在交易所的「提币记录」或钱包的「交易历史」中查看，格式为 0x 开头的长字符串。
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'

const userStore = useUserStore()

// ==================== 常量 ====================
const PLATFORM_ADDRESS = '0x24db08aa8369d4405ada32a133862d63090847fb'
const presetAmounts = [10, 30, 60]

// ==================== 状态 ====================
const selectedAmount = ref(null)
const customInput = ref('')
const txid = ref('')
const verifying = ref(false)
const resultMsg = ref('')
const resultSuccess = ref(false)
const copied = ref(false)
const history = ref([])

// ==================== 计算 ====================
const canVerify = computed(() => {
  return selectedAmount.value && txid.value.trim().startsWith('0x') && txid.value.trim().length === 66 && !verifying.value
})

// ==================== 方法 ====================

function selectAmount(amt) {
  selectedAmount.value = amt
  customInput.value = ''
  resultMsg.value = ''
}

function onCustomInput() {
  const v = parseFloat(customInput.value)
  if (!isNaN(v) && v >= 10) {
    selectedAmount.value = v
  } else {
    selectedAmount.value = null
  }
}

function onPaste(e) {
  // 粘贴后自动去除空格
  setTimeout(() => {
    txid.value = txid.value.trim()
  }, 50)
}

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(PLATFORM_ADDRESS)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback
    const el = document.createElement('textarea')
    el.value = PLATFORM_ADDRESS
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

async function verifyAndCredit() {
  if (!canVerify.value) return
  verifying.value = true
  resultMsg.value = ''

  const userId = userStore.userId || localStorage.getItem('chatUserId')
  if (!userId) {
    resultMsg.value = '请先登录后再充值'
    resultSuccess.value = false
    verifying.value = false
    return
  }

  try {
    const res = await fetch('/api/recharge/usdt-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        txid: txid.value.trim(),
        amount: selectedAmount.value
      })
    })
    const data = await res.json()

    if (data.code === 200) {
      resultMsg.value = data.message
      resultSuccess.value = true
      txid.value = ''
      // 刷新余额
      await userStore.fetchUserStatus()
      // 刷新记录
      await loadHistory()
    } else {
      resultMsg.value = data.message || '验证失败，请重试'
      resultSuccess.value = false
    }
  } catch (e) {
    resultMsg.value = '网络错误，请稍后重试'
    resultSuccess.value = false
  } finally {
    verifying.value = false
  }
}

async function loadHistory() {
  const userId = userStore.userId || localStorage.getItem('chatUserId')
  if (!userId) return
  try {
    const res = await fetch(`/api/recharge/history?userId=${userId}`)
    const data = await res.json()
    if (data.code === 200) history.value = data.data
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
.recharge-page {
  min-height: 100vh;
  background: #FFFDF5;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Header */
.recharge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, #F7B500, #FFD700);
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(247,181,0,0.3);
}
.back-btn {
  background: none;
  border: none;
  color: #5a3e00;
  font-size: 26px;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
}
.header-title {
  font-size: 17px;
  font-weight: 700;
  color: #3a2800;
}
.header-right { width: 40px; }

/* 余额横幅 */
.balance-banner {
  background: linear-gradient(135deg, #FFF3C4, #FFE680);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(247,181,0,0.3);
}
.bal-label { font-size: 13px; color: #8B6000; }
.bal-value { font-size: 24px; font-weight: 800; color: #D97706; }

/* 内容区 */
.recharge-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 卡片 */
.section-card {
  background: #fff;
  border: 1px solid rgba(247,181,0,0.35);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(247,181,0,0.08);
}
.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #8B6000;
  margin-bottom: 12px;
  letter-spacing: 0.3px;
}

/* 金额选择 */
.amount-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.amount-btn {
  padding: 11px 6px;
  background: #FFFDE7;
  border: 1px solid rgba(247,181,0,0.4);
  border-radius: 10px;
  color: #8B6000;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.amount-btn:active { transform: scale(0.95); }
.amount-selected {
  background: linear-gradient(135deg, #F7B500, #FFD700) !important;
  border-color: #F7B500 !important;
  color: #3a2800 !important;
  box-shadow: 0 2px 10px rgba(247,181,0,0.4);
}

.custom-amount-wrap {
  display: flex;
  align-items: center;
  background: #FFFDE7;
  border: 1px solid rgba(247,181,0,0.3);
  border-radius: 10px;
  padding: 0 12px;
  margin-top: 6px;
}
.custom-prefix { color: #D97706; font-weight: 700; font-size: 16px; margin-right: 6px; }
.custom-input {
  flex: 1;
  background: none;
  border: none;
  color: #333;
  font-size: 15px;
  padding: 10px 0;
  outline: none;
}
.custom-input::placeholder { color: #bbb; }

.amount-confirm-row {
  margin-top: 10px;
  font-size: 13px;
  color: #8B6000;
  display: flex;
  align-items: center;
  gap: 6px;
}
.amount-highlight {
  font-size: 18px;
  font-weight: 800;
  color: #D97706;
}

/* 网络标签 */
.network-badge {
  display: inline-block;
  background: rgba(245,158,11,0.12);
  border: 1px solid rgba(245,158,11,0.4);
  color: #D97706;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  margin-bottom: 14px;
}

/* QR码 */
.qr-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}
.qr-img {
  width: 160px;
  height: 160px;
  border-radius: 12px;
  border: 3px solid rgba(247,181,0,0.5);
  background: #FFFDF5;
}

/* 地址框 */
.address-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FFFDE7;
  border: 1px solid rgba(247,181,0,0.3);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.address-text {
  flex: 1;
  font-size: 12px;
  color: #6B4C00;
  word-break: break-all;
  font-family: monospace;
}
.copy-btn {
  flex-shrink: 0;
  background: rgba(247,181,0,0.15);
  border: 1px solid rgba(247,181,0,0.5);
  color: #8B6000;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.copy-btn:active { transform: scale(0.95); }

/* 警告 */
.warning-box {
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  color: #dc2626;
  line-height: 1.6;
}

/* 步骤提示 */
.step-hint {
  font-size: 12px;
  color: #8B6000;
  margin-bottom: 10px;
  line-height: 1.5;
}

/* TXID 输入 */
.txid-input {
  width: 100%;
  background: #FFFDE7;
  border: 1px solid rgba(247,181,0,0.4);
  border-radius: 10px;
  color: #333;
  font-size: 12px;
  font-family: monospace;
  padding: 10px 12px;
  resize: none;
  box-sizing: border-box;
  outline: none;
  margin-bottom: 12px;
}
.txid-input::placeholder { color: #bbb; }
.txid-input:focus { border-color: #F7B500; }

/* 验证按钮 */
.verify-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #F7B500, #FFD700);
  border: none;
  border-radius: 12px;
  color: #3a2800;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s;
  box-shadow: 0 3px 12px rgba(247,181,0,0.4);
}
.verify-btn:disabled {
  background: #F5F5F5;
  box-shadow: none;
  cursor: not-allowed;
  color: #bbb;
  border: 1px solid #eee;
}
.verify-btn:not(:disabled):active { transform: scale(0.98); }
.verify-loading { opacity: 0.8; }

/* 结果消息 */
.result-msg {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}
.result-ok {
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.3);
  color: #16a34a;
}
.result-err {
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.25);
  color: #dc2626;
}

/* 充值记录 */
.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(247,181,0,0.15);
}
.history-row:last-child { border-bottom: none; }
.history-left { display: flex; flex-direction: column; gap: 2px; }
.history-coin { font-size: 14px; color: #8B6000; }
.history-time { font-size: 11px; color: #bbb; }
.history-amount { font-size: 16px; font-weight: 700; color: #16a34a; }

/* 帮助卡片 */
.help-card {
  background: #fff;
  border: 1px solid rgba(247,181,0,0.25);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(247,181,0,0.06);
}
.help-title {
  font-size: 14px;
  font-weight: 700;
  color: #8B6000;
  margin-bottom: 12px;
}
.help-item {
  font-size: 12px;
  color: #666;
  line-height: 1.7;
  margin-bottom: 10px;
}
.help-item b { color: #8B6000; }
</style>

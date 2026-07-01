<template>
  <div class="checkin-page">
    <!-- 返回按钮 -->
    <div v-if="!embedded" class="checkin-back-row">
      <button class="checkin-back-btn" @click="router.back()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        返回
      </button>
    </div>

    <!-- 标签栏 -->
    <div class="tab-bar tab-bar-2">
      <button class="tab-item" :class="{ active: activeTab === 'coin-exchange' }" @click="switchToCoinExchange">
        {{ t('checkin.voucherTab') }}
      </button>
      <button class="tab-item" :class="{ active: activeTab === 'transfer' }" @click="switchToTransfer">
        🔄 {{ t('checkin.transferTab') }}
      </button>
    </div>



    <!-- ===== 拼团券转让面板 ===== -->
    <div v-if="activeTab === 'transfer'" class="main-checkin-card">
      <!-- 我的拼团券 -->
      <div class="today-reward" style="background:linear-gradient(135deg,#FF6B35,#E63900)">
        <div class="reward-label">{{ t('checkin.transferTitle') }}</div>
        <div class="reward-amount">
          <span class="amount-number">{{ voucherCount }}</span>
          <span class="amount-unit">{{ t('checkin.voucherUnit') }}</span>
        </div>
        <div class="reward-tier">{{ t('checkin.voucherHint') }}</div>
      </div>

      <!-- 转让说明 -->
      <div class="panel-info-list">
        <div class="panel-info-item info-ok">
          <span class="info-icon">🎟️</span>
          <span>{{ t('checkin.transferHint1') }}</span>
        </div>
        <div class="panel-info-item">
          <span class="info-icon">💡</span>
          <span>{{ t('checkin.transferHint2') }}</span>
        </div>
      </div>

      <!-- 转让表单 -->
      <div class="exchange-form-group">
        <label>对方邀请码 <span style="color:#f5222d">*</span></label>
        <input
          v-model="voucherTransferCode"
          type="text"
          :placeholder="t('checkin.transferPlaceholder')"
          class="exchange-input"
        />
      </div>
      <div class="exchange-form-group">
        <label>转让张数 <span style="color:#f5222d">*</span></label>
        <div class="voucher-qty-row">
          <button class="voucher-qty-btn" @click="voucherTransferCount > 1 && voucherTransferCount--">-</button>
          <span class="voucher-qty-num">{{ voucherTransferCount }}</span>
          <button class="voucher-qty-btn" @click="voucherTransferCount < voucherCount && voucherTransferCount++">+</button>
          <span style="color:#999;font-size:12px;margin-left:8px">剩余 {{ voucherCount }} 张</span>
        </div>
      </div>

      <button
        class="checkin-btn-main"
        style="margin-top:16px"
        :class="{ 'checked': voucherCount < 1 || !voucherTransferCode.trim() }"
        :disabled="voucherCount < 1 || !voucherTransferCode.trim() || voucherTransferring"
        @click="handleVoucherTransfer">
        <span v-if="voucherCount < 1"><span class="btn-icon">🔒</span>暂无拼团券可转让</span>
        <span v-else><span class="btn-icon">🎁</span>{{ voucherTransferring ? t('checkin.transferring') : `${t('checkin.confirmTransfer')} ${voucherTransferCount}` }}</span>
      </button>
    </div>


    <!-- ===== 拼团券主面板（7天签到 + 领券 + 购买） ===== -->
    <div v-if="activeTab === 'coin-exchange'" class="main-checkin-card">

      <!-- 7天进度 -->
      <div class="voucher-goal-header">
        <div class="vg-title">{{ t('checkin.streakGoal') }}</div>
        <div class="vg-reward">{{ t('checkin.streakReward') }}</div>
      </div>

      <div class="checkin-progress">
        <div class="progress-header">
          <span class="progress-title">签到进度</span>
          <span class="progress-days">{{ Math.min(consecutiveDays, 7) }}/7天</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :style="{ width: progress7Percent + '%' }"></div>
          </div>
          <div class="progress-dots">
            <div v-for="day in 7" :key="day" class="progress-dot"
              :class="{ active: day <= consecutiveDays, current: day === consecutiveDays + 1, milestone: day === 7 }">
              <span class="dot-number">{{ day }}</span>
            </div>
          </div>
        </div>
        <div class="progress-hint">
          <span v-if="day7VoucherGranted" class="unlocked">🎟️ 首次7天已完成，拼团券已发放！</span>
          <span v-else-if="consecutiveDays >= 7" class="unlocked">✅ 7天达标！签到时已自动发放拼团券</span>
          <span v-else>再签到 <strong>{{ 7 - consecutiveDays }}</strong> 天获得 1 张拼团券</span>
        </div>
      </div>

      <!-- 签到按钮 -->
      <button
        class="checkin-btn-main"
        :class="{ 'checked': !canCheckinToday || !isActivated }"
        :disabled="!canCheckinToday || !isActivated || isProcessing"
        @click="handleCheckin">
        <span v-if="!isActivated"><span class="btn-icon">🔒</span>请先激活账号</span>
        <span v-else-if="!canCheckinToday"><span class="btn-icon">✅</span>{{ t('checkin.todayChecked') }}</span>
        <span v-else><span class="btn-icon">✨</span>{{ isProcessing ? t('checkin.checkingIn') : t('checkin.checkinBtn') }}</span>
      </button>

      <!-- 拼团券余额 -->
      <div class="voucher-balance-row">
        <div class="vb-left">
          <span class="vb-label">{{ t('checkin.myVouchers') }}</span>
          <span class="vb-hint">{{ t('checkin.voucherHint') }}</span>
        </div>
        <span class="vb-count">{{ voucherCount }} {{ t('checkin.voucherUnit') }}</span>
      </div>

      <!-- 购买拼团券 -->
      <div class="voucher-buy-section">
        <div class="vbs-title">{{ t('checkin.buyTitle') }}</div>
        <div class="voucher-qty-row">
          <button class="voucher-qty-btn" @click="buyCount > 1 && buyCount--">-</button>
          <span class="voucher-qty-num">{{ buyCount }}</span>
          <button class="voucher-qty-btn" @click="buyCount < 10 && buyCount++">+</button>
          <span class="vbs-total">{{ t('checkin.buyTotal').replace('${total}', buyCount * 5) }}</span>
        </div>
        <button
          class="checkin-btn-main"
          style="margin-top:10px"
          :class="{ checked: userStore.balance < buyCount * 5 }"
          :disabled="userStore.balance < buyCount * 5 || buyingVoucher"
          @click="handleBuyVoucher">
          <span v-if="userStore.balance < buyCount * 5"><span class="btn-icon">💰</span>{{ t('checkin.balanceInsufficient').replace('${balance}', userStore.balance?.toFixed(2)) }}</span>
          <span v-else><span class="btn-icon">🛒</span>{{ buyingVoucher ? t('checkin.buying') : t('checkin.buyBtn').replace('{count}', buyCount) }}</span>
        </button>
      </div>

      <!-- 规则 -->
      <div class="voucher-rules-card">
        <div class="vrc-title">{{ t('checkin.rulesTitle') }}</div>
        <div class="vrc-item">{{ t('checkin.rule1') }}</div>
        <div class="vrc-item">{{ t('checkin.rule2') }}</div>
        <div class="vrc-item">{{ t('checkin.rule3') }}</div>
        <div class="vrc-item">{{ t('checkin.rule4') }}</div>
        <div class="vrc-item">{{ t('checkin.rule5') }}</div>
      </div>
    </div>

    <!-- 拼团券余额卡片 -->
    <div class="balance-card">
      <div class="balance-header">
        <span style="font-size:24px">🎟️</span>
        <span class="balance-title">我的拼团券</span>
      </div>
      <div class="balance-amount">
        <span class="balance-number">{{ voucherCount }}</span>
        <span style="font-size:16px;color:#999;margin-left:6px">张</span>
      </div>
      <div class="balance-actions">
        <button class="action-btn history-btn" style="width:100%" @click="showHistory">
          📊 查看签到记录
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-card">
      <div class="stat-item">
        <div class="stat-value">{{ totalCheckins }}</div>
        <div class="stat-label">累计签到</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ consecutiveDays }}</div>
        <div class="stat-label">连续天数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ voucherCount }}</div>
        <div class="stat-label">拼团券</div>
      </div>
    </div>

    <!-- 规则说明 -->
    <div class="rules-card">
      <div class="rules-title">📜 签到规则</div>
      <div class="rules-list">
        <div class="rule-item">
          <span class="rule-dot">•</span>
          <span>首次连续签到 <b>7天</b> 自动获得 <b>1张</b>拼团券</span>
        </div>
        <div class="rule-item">
          <span class="rule-dot">•</span>
          <span>中断后天数重头累计，拼团券不清零</span>
        </div>
        <div class="rule-item">
          <span class="rule-dot">•</span>
          <span>拼团券 <b>$5/张</b>，参团需消耗 <b>4张</b>（等价 $20 余额），须激活档位</span>
        </div>
        <div class="rule-item">
          <span class="rule-dot">•</span>
          <span>券可通过"互转"面板转让给朋友，不可直接提现</span>
        </div>
      </div>
    </div>

    <!-- 签到记录弹窗 -->
    <div class="history-overlay" v-if="showHistoryModal" @click.self="showHistoryModal = false">
      <div class="history-modal">
        <div class="history-header">
          <span class="history-title">📊 签到记录</span>
          <button class="history-close" @click="showHistoryModal = false">✕</button>
        </div>
        <div class="history-body">
          <div v-if="historyLoading" class="history-loading">加载中...</div>
          <div v-else-if="historyLogs.length === 0" class="history-empty">暂无签到记录</div>
          <div v-else>
            <div v-for="(log, idx) in historyLogs" :key="idx" class="history-item">
              <div class="history-item-left">
                <div class="history-date">{{ log.date }}</div>
                <div class="history-label">{{ log.label }}</div>
              </div>
              <div class="history-amount" :class="log.direction === 'out' ? 'amount-out' : 'amount-in'">
                {{ log.direction === 'out' ? '-' : '+' }}{{ log.amount }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { getOrCreateUserId, getDeviceSecret } from '../utils/auth'
import { useToast } from '../composables/useToast'
import { apiRequest } from '../config/api'
import { useUserStore } from '../stores/userStore.js'
import { useI18n } from '../composables/useI18n.js'

const router = useRouter()
const { success, error, warning } = useToast()
const userStore = useUserStore()
const { t } = useI18n()

const userId = ref(getOrCreateUserId())

const consecutiveDays = ref(0)
const totalCheckins = ref(0)
const canCheckinToday = ref(true)
// 拼团券状态
const voucherCount = ref(0)
const day7VoucherGranted = ref(false)
const voucherTransferCode = ref('')
const voucherTransferCount = ref(1)
const voucherTransferring = ref(false)
const buyCount = ref(1)
const buyingVoucher = ref(false)

// 标签栏
const activeTab = ref('coin-exchange')

const TIER_MAP    = { BASIC: 50, PREMIUM: 100, ELITE: 200, TIER_300: 300, TIER_500: 500 }
const userTier    = computed(() => TIER_MAP[userStore.cardType] || 0)
const isActivated = computed(() => userTier.value > 0)

const props = defineProps({
  embedded: { type: Boolean, default: false }
})

const isProcessing = ref(false)
const showHistoryModal = ref(false)
const historyLoading = ref(false)
const historyLogs = ref([])

const userTierName = computed(() => {
  const names = { BASIC: 'V1', PREMIUM: 'V2', ELITE: 'V3', TIER_300: 'V4', TIER_500: 'V5', TIER_1000: 'V6' }
  return names[userStore.cardType] || '未激活'
})

const progress7Percent = computed(() => Math.min((consecutiveDays.value / 7) * 100, 100))

onMounted(() => {
  if (!userStore.isInitialized) userStore.fetchUserStatus()
  loadCheckinStatus()
})

onActivated(() => {
  loadCheckinStatus()
})

async function loadCheckinStatus() {
  try {
    const data = await apiRequest(`/engine/checkin/${userId.value}`)
    if (data.success) {
      consecutiveDays.value = data.consecutiveDays || 0
      totalCheckins.value = data.totalCheckins || 0
      canCheckinToday.value = data.canCheckinToday !== false
      voucherCount.value = data.voucherCount || userStore.couponCount || 0
      day7VoucherGranted.value = data.day7VoucherGranted || false
    }
  } catch (e) {
    console.error('加载签到状态失败:', e)
  }
}


const handleCheckin = async () => {
  if (isProcessing.value || !canCheckinToday.value) {
    if (!canCheckinToday.value) warning('今天已签到过了')
    return
  }
  isProcessing.value = true
  try {
    const data = await apiRequest('/engine/checkin', {
      method: 'POST',
      body: { userId: userId.value },
      headers: { 'X-Device-Secret': getDeviceSecret() }
    })
    if (data.success) {
      consecutiveDays.value = data.consecutiveDays || consecutiveDays.value
      totalCheckins.value = data.totalCheckins || totalCheckins.value
      canCheckinToday.value = false
      const isProfit = data.checkinType === 'profit'
      if (data.earnedCoupon) {
        success('恭喜！获得拼团券', `🎟️ 连续签到7天达成！已获得 1 张拼团券（$5/张），4张=$20可参团1次`)
        voucherCount.value = (voucherCount.value || 0) + 1
        day7VoucherGranted.value = true
      } else if (isProfit) {
        success('签到成功', `💰 今日分润 +${(data.profitToday || 0).toFixed(4)}，累计分润 ${(data.totalProfitBalance || 0).toFixed(4)}`)
      } else {
        success('签到成功', `✅ 连续签到 ${data.consecutiveDays} 天，还差 ${Math.max(0, 7 - data.consecutiveDays)} 天获得拼团券`)
      }
      userStore.fetchUserStatus()
    } else {
      warning(data.message || '签到失败')
    }
  } catch (err) {
    error('签到失败', err.message)
  } finally {
    isProcessing.value = false
  }
}

const transferToUserId = ref('')
const transferAmount = ref('')
const transferSubmitting = ref(false)

const switchToTransfer = () => { activeTab.value = 'transfer' }

const switchToCoinExchange = async () => {
  activeTab.value = 'coin-exchange'
  await loadCheckinStatus()
  userStore.fetchUserStatus()
}

const handleVoucherTransfer = async () => {
  if (!voucherTransferCode.value.trim()) { warning('请输入对方邀请码'); return }
  if (voucherTransferring.value) return
  voucherTransferring.value = true
  try {
    const res = await apiRequest('/pintuan/voucher/transfer', 'POST', {
      toInviteCode: voucherTransferCode.value.trim(),
      count: voucherTransferCount.value
    })
    if (res.code === 200) {
      success('转让成功', `已转让 ${voucherTransferCount.value} 张拼团券 🎟️`)
      voucherCount.value = Math.max(0, voucherCount.value - voucherTransferCount.value)
      voucherTransferCode.value = ''
      voucherTransferCount.value = 1
    } else {
      warning('转让失败', res.message || '请稍后重试')
    }
  } catch (e) {
    warning('网络错误', '请稍后重试')
  } finally {
    voucherTransferring.value = false
  }
}

const handleBuyVoucher = async () => {
  if (buyingVoucher.value) return
  buyingVoucher.value = true
  try {
    const res = await apiRequest('/pintuan/voucher/buy', 'POST', { count: buyCount.value })
    if (res.code === 200) {
      success('购买成功', `已获得 ${buyCount.value} 张拼团券 🎟️`)
      voucherCount.value = (voucherCount.value || 0) + buyCount.value
      await userStore.fetchUserStatus()
    } else {
      warning('购买失败', res.message || '余额不足')
    }
  } catch (e) {
    warning('网络错误', '请稍后重试')
  } finally {
    buyingVoucher.value = false
  }
}

const showHistory = async () => {
  showHistoryModal.value = true
  historyLoading.value = true
  try {
    const data = await apiRequest(`/checkin/history/${userId.value}`)
    if (data.code === 200) {
      // 新接口返回统一格式 { date, label, amount, direction }
      historyLogs.value = data.data?.logs || []
    }
  } catch (e) {
    console.error('获取签到历史失败:', e)
  } finally {
    historyLoading.value = false
  }
}
</script>

<style scoped>
.checkin-page {
  width: 100%;
  min-height: 100%;
  background: linear-gradient(180deg, #F8F9FA 0%, #E9ECEF 100%);
  padding: 20px;
  padding-bottom: 40px;
}

/* 头部 */
.page-header { margin-bottom: 20px; }

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  font-size: 15px;
  font-weight: 500;
  color: #FFC933;
  cursor: pointer;
  padding: 4px 0;
  margin-bottom: 12px;
  transition: opacity 0.2s;
}
.back-btn:hover { opacity: 0.7; }

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1A1A2E;
}

/* 返回按钮行 */
.checkin-back-row {
  margin-bottom: 10px;
}

.checkin-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: #FFC933;
  cursor: pointer;
  padding: 4px 0;
  transition: opacity 0.2s;
}
.checkin-back-btn:hover { opacity: 0.7; }

/* ── 标签栏 ── */
.tab-bar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}
.tab-bar-4 {
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 6px;
}

.tab-item {
  padding: 10px 6px;
  border: 2px solid #DEE2E6;
  border-radius: 12px;
  background: white;
  font-size: 13px;
  font-weight: 600;
  color: #6C757D;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.tab-item:hover { border-color: #FFC933; color: #FFC933; }

.tab-item.active {
  background: linear-gradient(135deg, #FFC933 0%, #FFB300 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
}

/* 主面板卡片（签到 / 互转 / 兑换共用） */
.main-checkin-card {
  background: white;
  border-radius: 20px;
  padding: 28px;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

/* 今日奖励 / 当前积分展示区 */
.today-reward {
  text-align: center;
  margin-bottom: 32px;
  padding: 24px;
  background: linear-gradient(135deg, #FFC933 0%, #FFB300 100%);
  border-radius: 16px;
}

.reward-label-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}
.reward-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}
.reward-label-icon {
  width: 96px;
  height: 96px;
  object-fit: contain;
  border-radius: 8px;
  flex-shrink: 0;
}

.reward-amount { margin-bottom: 8px; }

.amount-number {
  font-size: 56px;
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1;
}

.amount-unit {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.9);
  margin-left: 8px;
}

.reward-tier {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  display: inline-block;
}

/* 签到进度 */
.checkin-progress { margin-bottom: 24px; }

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.progress-title { font-size: 15px; font-weight: 600; color: #2C3E50; }
.progress-days { font-size: 18px; font-weight: 700; color: #FFC933; }

.progress-bar-container { position: relative; margin-bottom: 16px; }

.progress-bar-bg {
  height: 8px;
  background: #E9ECEF;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #FFC933, #FFB300);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.progress-dots {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
}

.progress-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #E9ECEF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #ADB5BD;
  transition: all 0.3s ease;
}

.progress-dot.active {
  background: linear-gradient(135deg, #FFC933, #FFB300);
  color: white;
  transform: scale(1.1);
}

.progress-dot.current {
  background: #FFC107;
  color: white;
  animation: pulse 1.5s ease-in-out infinite;
}

.progress-dot.milestone { border: 2px solid #FF6B6B; }
.progress-dot.milestone.active { border-color: transparent; box-shadow: 0 0 8px rgba(255, 193, 51, 0.5); }

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

.dot-number { font-size: 13px; }

.progress-hint {
  text-align: center;
  font-size: 14px;
  color: #6C757D;
  padding: 12px;
  background: #F8F9FA;
  border-radius: 8px;
}

.progress-hint strong { color: #FFC933; font-weight: 700; }
.progress-hint .unlocked { color: #28A745; font-weight: 600; }

/* 大按钮（签到 / 互转 / 兑换共用） */
.checkin-btn-main {
  width: 100%;
  padding: 18px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #FFC933 0%, #FFB300 100%);
  color: white;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 16px;
  box-shadow: 0 6px 20px rgba(255, 193, 51, 0.4);
  transition: all 0.3s ease;
}

.checkin-btn-main:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(255, 193, 51, 0.5);
}

.checkin-btn-main:active:not(:disabled) { transform: translateY(-1px); }

.checkin-btn-main:disabled {
  background: #E9ECEF;
  color: #ADB5BD;
  cursor: not-allowed;
  box-shadow: none;
}

.checkin-btn-main.checked { background: #ADB5BD; }

.btn-icon { margin-right: 8px; font-size: 20px; }

/* 断签警告 */
.warning-box {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #FFF3CD;
  border: 2px solid #FFE69C;
  border-radius: 12px;
}

.warning-icon { font-size: 24px; flex-shrink: 0; }
.warning-text { flex: 1; }
.warning-title { font-size: 14px; font-weight: 600; color: #856404; margin-bottom: 4px; }
.warning-desc { font-size: 13px; color: #856404; line-height: 1.5; }

/* 互转面板：条件说明列表 */
.panel-info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
  padding: 16px;
  background: #F8F9FA;
  border-radius: 12px;
}

.panel-info-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: #6C757D;
  line-height: 1.5;
}

.panel-info-item.info-ok { color: #28A745; }
.info-icon { flex-shrink: 0; font-size: 16px; }

/* 兑换面板：表单 */
.exchange-form-group {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.exchange-form-group label { font-size: 13px; color: #495057; font-weight: 500; }

.exchange-input {
  padding: 10px 12px;
  border: 1.5px solid #DEE2E6;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.exchange-input:focus { border-color: #FFC933; }
.exchange-hint { font-size: 12px; color: #6C757D; }

.exchange-tip {
  margin-top: 4px;
  padding: 10px 12px;
  background: #fffbe6;
  border-radius: 8px;
  font-size: 12px;
  color: #8b6914;
}

/* 兑换方向切换 */
.exchange-direction-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 4px;
}
.dir-btn {
  padding: 10px 8px;
  border: 2px solid #DEE2E6;
  border-radius: 10px;
  background: white;
  font-size: 12px;
  font-weight: 600;
  color: #6C757D;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}
.dir-btn:hover { border-color: #f7b500; color: #e09000; }
.dir-btn.active {
  background: linear-gradient(135deg, #f7b500, #e09000);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 12px rgba(247, 181, 0, 0.35);
}

/* 兑换预览 */
.exchange-preview {
  margin-top: 8px;
  padding: 10px 14px;
  background: #f0f9ff;
  border-radius: 8px;
  font-size: 13px;
  color: #0369a1;
  border-left: 3px solid #0ea5e9;
}

/* 金币余额卡片 */
.balance-card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.balance-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.balance-icon { font-size: 28px; }
.balance-title { font-size: 18px; font-weight: 600; color: #2C3E50; }

.balance-amount {
  text-align: center;
  margin-bottom: 20px;
  padding: 24px;
  background: linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%);
  border-radius: 16px;
}

.balance-number { font-size: 42px; font-weight: 700; color: #FFC933; }

.balance-actions { display: flex; }

.action-btn {
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-btn {
  background: #F8F9FA;
  color: #495057;
  border: 2px solid #DEE2E6;
}

.history-btn:hover { background: #E9ECEF; }

/* 统计卡片 */
.stats-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  background: white;
  padding: 20px 16px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.stat-value { font-size: 24px; font-weight: 700; color: #FFC933; margin-bottom: 8px; }
.stat-label { font-size: 13px; color: #6C757D; }

/* 规则卡片 */
.rules-card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.rules-title { font-size: 18px; font-weight: 600; color: #2C3E50; margin-bottom: 16px; }

.rules-list { display: flex; flex-direction: column; gap: 12px; }

.rule-item {
  display: flex;
  gap: 12px;
  font-size: 14px;
  color: #495057;
  line-height: 1.6;
}

.rule-dot { color: #FFC933; font-weight: 700; flex-shrink: 0; }

/* 历史记录弹窗 */
.history-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.history-modal {
  background: white;
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #F0F0F0;
}

.history-title { font-size: 17px; font-weight: 600; color: #2C3E50; }

.history-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #F0F0F0;
  border-radius: 50%;
  font-size: 14px;
  cursor: pointer;
  color: #666;
}

.history-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px 24px;
}

.history-loading,
.history-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
  font-size: 14px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #F5F5F5;
}

.history-item:last-child { border-bottom: none; }
.history-item-left { flex: 1; }
.history-date { font-size: 13px; color: #888; }
.history-label { font-size: 14px; color: #333; margin-top: 2px; }
.history-amount { font-size: 15px; font-weight: 600; white-space: nowrap; padding-left: 8px; }
.amount-in  { color: #07C160; }
.amount-out { color: #E74C3C; }

/* 分润复利面板 */
.profit-formula-card {
  background: linear-gradient(135deg, #fff8e1, #fff3cd);
  border: 1px solid #ffe082;
  border-radius: 14px;
  padding: 16px;
  margin-top: 16px;
}
.formula-title {
  font-size: 13px;
  font-weight: 600;
  color: #b45309;
  margin-bottom: 12px;
}
.formula-body { display: flex; flex-direction: column; gap: 8px; }
.formula-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}
.formula-key { color: #666; }
.formula-val { font-weight: 600; color: #333; }
.formula-row.highlight .formula-key { color: #b45309; font-weight: 600; }
.formula-row.highlight .formula-val { color: #e09000; font-size: 16px; }
.formula-divider {
  height: 1px;
  background: #ffe082;
  margin: 4px 0;
}
.formula-note {
  font-size: 11px;
  color: #999;
  text-align: center;
  margin-top: 4px;
}
/* 拼团券目标头部 */
.voucher-goal-header { text-align: center; padding: 10px 0 14px; }
.vg-title { font-size: 16px; font-weight: 700; color: #FF6B35; }
.vg-reward { font-size: 13px; color: #666; margin-top: 4px; }

/* 拼团券余额行 */
.voucher-balance-row {
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(135deg, #FFF4EE, #FFE5D3);
  border: 1px solid #FFBB9A; border-radius: 12px; padding: 12px 14px;
  margin: 14px 0;
}
.vb-left { display: flex; flex-direction: column; gap: 2px; }
.vb-label { font-size: 14px; font-weight: 700; color: #E63900; }
.vb-hint { font-size: 11px; color: #999; }
.vb-count { font-size: 28px; font-weight: 700; color: #FF6B35; }

/* 购买区 */
.voucher-buy-section {
  background: #F8F9FA; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px;
}
.vbs-title { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 10px; }
.voucher-qty-row { display: flex; align-items: center; gap: 10px; }
.voucher-qty-btn {
  width: 32px; height: 32px; border: 2px solid #FF6B35; border-radius: 50%;
  background: #fff; color: #FF6B35; font-size: 18px; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.voucher-qty-num { font-size: 20px; font-weight: 700; color: #333; min-width: 28px; text-align: center; }
.vbs-total { font-size: 14px; font-weight: 700; color: #E63900; margin-left: auto; }

/* 拼团券规则卡 */
.voucher-rules-card {
  background: #F8F9FA; border-radius: 12px; padding: 12px 14px; margin-top: 4px;
}
.vrc-title { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 8px; }
.vrc-item { font-size: 12px; color: #666; line-height: 1.8; }
</style>

<template>
  <div class="transaction-history">
    <!-- 头部 -->
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">{{ t('transaction.title') }}</h1>
      <button class="filter-btn" @click="showFilterModal = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
        </svg>
      </button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card income">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <div class="stat-label">{{ t('transaction.totalIncome') }}</div>
          <div class="stat-value">+{{ stats.totalIncome }}</div>
        </div>
      </div>
      <div class="stat-card outcome">
        <div class="stat-icon">💸</div>
        <div class="stat-content">
          <div class="stat-label">{{ t('transaction.totalOutcome') }}</div>
          <div class="stat-value">-{{ stats.totalOutcome }}</div>
        </div>
      </div>
    </div>

    <!-- 类型筛选 - 2排Grid布局 -->
    <div class="type-filter-grid">
      <button 
        v-for="type in typeFilters" 
        :key="type.value"
        :class="['filter-chip', { active: selectedType === type.value }]"
        @click="selectType(type.value)">
        <span class="chip-icon">{{ type.icon }}</span>
        <span class="chip-label">{{ type.label }}</span>
      </button>
    </div>

    <!-- 交易列表 -->
    <div class="transaction-list">
      <div v-if="filteredTransactions.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">{{ t('transaction.noData') }}</div>
      </div>

      <div 
        v-for="transaction in filteredTransactions" 
        :key="transaction.id"
        class="transaction-item"
        @click="viewDetail(transaction)">
        <!-- 图标 -->
        <div class="item-icon" :class="transaction.type">
          {{ getTypeIcon(transaction.type) }}
        </div>

        <!-- 内容 -->
        <div class="item-content">
          <div class="item-title">
            <span class="title-text">{{ getTypeLabel(transaction.type) }}</span>
            <span v-if="transaction.generation" class="title-badge">
              第{{ transaction.generation }}代
            </span>
          </div>
          <div class="item-desc">
            <span class="desc-text">{{ formatDescription(transaction) }}</span>
            <span class="desc-time">{{ formatTime(transaction.timestamp) }}</span>
          </div>
        </div>

        <!-- 金额 -->
        <div class="item-amount" :class="getAmountClass(transaction)">
          {{ getAmountText(transaction) }}
        </div>
      </div>
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="load-more">
      <button class="load-more-btn" @click="loadMore">
        {{ t('transaction.loadMore') }}
      </button>
    </div>

    <!-- 筛选弹窗 -->
    <div v-if="showFilterModal" class="modal-overlay" @click="showFilterModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>筛选条件</h3>
          <button class="modal-close" @click="showFilterModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="filter-section">
            <div class="filter-label">交易类型</div>
            <div class="filter-options">
              <label v-for="type in typeFilters" :key="type.value" class="filter-checkbox">
                <input type="radio" :value="type.value" v-model="filterForm.type" />
                <span>{{ type.icon }} {{ type.label }}</span>
              </label>
            </div>
          </div>
          
          <div class="filter-section">
            <div class="filter-label">时间范围</div>
            <div class="filter-date">
              <input type="date" v-model="filterForm.startDate" placeholder="开始日期" />
              <span>至</span>
              <input type="date" v-model="filterForm.endDate" placeholder="结束日期" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn reset" @click="resetFilter">重置</button>
          <button class="modal-btn confirm" @click="applyFilter">确认</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="showDetailModal" class="modal-overlay" @click="showDetailModal = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>交易详情</h3>
          <button class="modal-close" @click="showDetailModal = false">✕</button>
        </div>
        <div class="modal-body" v-if="selectedTransaction">
          <div class="detail-item">
            <span class="detail-label">交易类型</span>
            <span class="detail-value">
              {{ getTypeIcon(selectedTransaction.type) }} 
              {{ getTypeLabel(selectedTransaction.type) }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">交易金额</span>
            <span class="detail-value amount" :class="getAmountClass(selectedTransaction)">
              {{ getAmountText(selectedTransaction) }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">交易时间</span>
            <span class="detail-value">{{ formatFullTime(selectedTransaction.timestamp) }}</span>
          </div>
          <div class="detail-item" v-if="selectedTransaction.fromUserId">
            <span class="detail-label">发起人</span>
            <span class="detail-value">{{ selectedTransaction.fromUserId }}</span>
          </div>
          <div class="detail-item" v-if="selectedTransaction.toUserId">
            <span class="detail-label">接收人</span>
            <span class="detail-value">{{ selectedTransaction.toUserId }}</span>
          </div>
          <div class="detail-item" v-if="selectedTransaction.generation">
            <span class="detail-label">平级代数</span>
            <span class="detail-value">第{{ selectedTransaction.generation }}代</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">交易状态</span>
            <span class="detail-value">
              <span class="status-badge" :style="{ background: getStatusColor(selectedTransaction.status) }">
                {{ getStatusLabel(selectedTransaction.status) }}
              </span>
            </span>
          </div>
          <div class="detail-item" v-if="selectedTransaction.note">
            <span class="detail-label">备注</span>
            <span class="detail-value">{{ selectedTransaction.note }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">交易编号</span>
            <span class="detail-value mono">{{ selectedTransaction.id }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getOrCreateUserId } from '../utils/auth'
import { useI18n } from '../composables/useI18n.js'

const router = useRouter()
const { t } = useI18n()
const userId = ref(getOrCreateUserId())

const transactions = ref([])
const stats = ref({
  totalIncome: 0,
  totalOutcome: 0
})

const selectedType = ref('all')
const showFilterModal = ref(false)
const showDetailModal = ref(false)
const selectedTransaction = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMore = ref(false)
const isLoading = ref(false)

const filterForm = ref({
  type: 'all',
  startDate: '',
  endDate: ''
})

const typeFilters = computed(() => [
  { value: 'all',                  label: t('transaction.all'),          icon: '📋' },
  { value: 'activation',           label: t('transaction.activation'),   icon: '⚡' },
  { value: 'spot_bonus',           label: t('transaction.spotBonus'),    icon: '💰' },
  { value: 'level_bonus',          label: t('transaction.levelBonus'),   icon: '🎁' },
  { value: 'daily_dividend',       label: t('transaction.dailyDividend'),icon: '💎' },
  { value: 'pintuan_profit',       label: t('transaction.pintuanProfit'),icon: '🎰' },
  { value: 'help_bonus',           label: t('transaction.helpBonus'),    icon: '🤝' },
  { value: 'transfer',             label: t('transaction.transfer'),     icon: '💸' },
  { value: 'help_transfer',        label: t('transaction.helpTransfer'), icon: '🛒' },
  { value: 'withdrawal',           label: t('transaction.withdrawal'),   icon: '🔁' },
  { value: 'pintuan_auto_upgrade', label: t('transaction.autoUpgrade'),  icon: '📈' },
  { value: 'pintuan_reinvest',     label: t('transaction.v3Reinvest'),   icon: '♻️' },
  { value: 'coin_exchange',        label: t('transaction.coinExchange'), icon: '💱' },
  { value: 'voucher_buy',          label: t('transaction.voucherBuy'),   icon: '🎟️' },
])

onMounted(() => {
  loadTransactions()
})

async function loadTransactions() {
  isLoading.value = true
  try {
    const baseUrl = import.meta.env.DEV ? '/api' : `${import.meta.env.VITE_API_URL || 'https://ai-airdrop.uk'}/api`
    const typeParam = selectedType.value !== 'all' ? `&type=${selectedType.value}` : ''
    const startDateParam = filterForm.value.startDate ? `&startDate=${filterForm.value.startDate}` : ''
    const endDateParam = filterForm.value.endDate ? `&endDate=${filterForm.value.endDate}` : ''
    const res = await fetch(`${baseUrl}/subscription/transactions/${userId.value}?page=${currentPage.value}&pageSize=${pageSize.value}${typeParam}${startDateParam}${endDateParam}`)
    const data = await res.json()

    if (data.code === 200) {
      if (currentPage.value === 1) {
        transactions.value = data.data?.transactions || []
      } else {
        transactions.value = [...transactions.value, ...(data.data?.transactions || [])]
      }
      hasMore.value = data.data?.hasMore || false

      // 更新统计
      if (data.data?.stats) {
        stats.value = data.data.stats
      }
    }
  } catch (err) {
    console.error('加载交易记录失败:', err)
  } finally {
    isLoading.value = false
  }
}

const filteredTransactions = computed(() => {
  return transactions.value
})

function selectType(type) {
  selectedType.value = type
  currentPage.value = 1
  loadTransactions()
}

function loadMore() {
  currentPage.value++
  loadTransactions()
}

function applyFilter() {
  selectedType.value = filterForm.value.type
  currentPage.value = 1
  loadTransactions()
  showFilterModal.value = false
}

function resetFilter() {
  filterForm.value = {
    type: 'all',
    startDate: '',
    endDate: ''
  }
  selectedType.value = 'all'
  currentPage.value = 1
  loadTransactions()
}

function viewDetail(transaction) {
  selectedTransaction.value = transaction
  showDetailModal.value = true
}

function goBack() {
  router.back()
}

function getTypeLabel(type) {
  const labels = {
    'spot_bonus':           '见点奖',
    'level_bonus':          '平级奖',
    'daily_dividend':       '每日分红',
    'pintuan_profit':       '拼团收益',
    'help_bonus':           '帮扶收益',
    'transfer':             '余额互转',
    'help_transfer':        '购物补贴',
    'admin_transfer':       '管理员充值',
    'withdrawal':           '复购',
    'upgrade':              '升级',
    'activation':           '激活',
    'pintuan_auto_upgrade': '自动升档',
    'pintuan_reinvest':     'V3循环复投',
    'voucher_buy':          '购买拼团券',
    'coin_exchange':        '兑换'
  }
  return labels[type] || type
}

function getTypeIcon(type) {
  const icons = {
    'spot_bonus':           '💰',
    'level_bonus':          '🎁',
    'daily_dividend':       '💎',
    'pintuan_profit':       '🎰',
    'help_bonus':           '🤝',
    'transfer':             '💸',
    'help_transfer':        '🛒',
    'admin_transfer':       '🔄',
    'withdrawal':           '🔁',
    'upgrade':              '⬆️',
    'activation':           '🎊',
    'pintuan_auto_upgrade': '📈',
    'pintuan_reinvest':     '♻️',
    'voucher_buy':          '🎟️',
    'coin_exchange':        '💱'
  }
  return icons[type] || '📝'
}

function getStatusLabel(status) {
  const labels = {
    'pending': '待处理',
    'completed': '已完成',
    'rejected': '已拒绝',
    'processing': '处理中'
  }
  return labels[status] || status
}



function getStatusColor(status) {
  const colors = {
    'pending': '#F7B500',
    'completed': '#07C160',
    'rejected': '#E74C3C'
  }
  return colors[status] || '#999'
}

function getAmountClass(transaction) {
  // 收入类型
  if (['spot_bonus', 'level_bonus', 'daily_dividend', 'admin_transfer',
       'pintuan_profit', 'help_bonus'].includes(transaction.type)) {
    return 'positive'
  }
  // 支出类型
  if (['pintuan_auto_upgrade', 'pintuan_reinvest', 'voucher_buy'].includes(transaction.type)) {
    return 'negative'
  }
  // 互转：收到钱是正，转出是负
  if (transaction.type === 'transfer' || transaction.type === 'help_transfer') {
    return transaction.toUserId === userId.value ? 'positive' : 'negative'
  }
  if (transaction.type === 'withdrawal') {
    return 'negative'
  }
  // 积分兑换：金额为正=积分兑换余额（收入），金额为负=余额兑换积分（支出）
  if (transaction.type === 'coin_exchange') {
    return parseFloat(transaction.amount) >= 0 ? 'positive' : 'negative'
  }
  return ''
}

function getAmountText(transaction) {
  const isPositive = getAmountClass(transaction) === 'positive'
  const prefix = isPositive ? '+' : '-'
  return `${prefix}${transaction.amount}`
}

function formatDescription(transaction) {
  // 互转记录
  if (transaction.type === 'transfer' || transaction.type === 'help_transfer') {
    if (transaction.toUserId === userId.value) {
      return `来自 ${transaction.fromUserId}`
    } else {
      return `转给 ${transaction.toUserId}`
    }
  }
  
  if (transaction.type === 'level_bonus') {
    return `来自推荐人的第${transaction.generation}代`
  }
  
  if (transaction.type === 'spot_bonus' && transaction.fromUserId) {
    return `来自 ${transaction.fromUserId}`
  }
  
  return transaction.note || '系统自动生成'
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${month}-${day} ${hours}:${minutes}`
}

function formatFullTime(timestamp) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
</script>

<style scoped>
.transaction-history {
  width: 100%;
  min-height: 100vh;
  background: #F8F9FA;
  padding-bottom: 30px;
  overflow-x: hidden;
  position: relative;
}

/* 响应式调整 */
@media (max-width: 375px) {
  .page-header {
    padding: 12px 15px !important;
  }
  .stats-cards {
    padding: 12px 15px !important;
    gap: 8px !important;
  }
  .stat-card {
    padding: 12px !important;
    gap: 8px !important;
  }
  .stat-icon {
    font-size: 24px !important;
  }
  .stat-value {
    font-size: 16px !important;
  }
  .type-filter {
    padding: 8px 15px !important;
  }
  .transaction-list {
    padding: 0 15px !important;
  }
  .item-amount {
    font-size: 16px !important;
  }
}

/* 头部 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #E5E5E5;
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn, .filter-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: #2C3E50;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #2C3E50;
}

/* 统计卡片 */
.stats-cards {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
}

.stat-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.stat-icon {
  font-size: 32px;
}

.stat-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
}

.stat-card.income .stat-value {
  color: #07C160;
}

.stat-card.outcome .stat-value {
  color: #E74C3C;
}

/* 类型筛选 - 2排Grid布局 */
.type-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 10px 12px;
  background: #F8F9FA;
}

.filter-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 4px;
  border: none;
  border-radius: 16px;
  background: white;
  color: #666;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  min-width: 0;
}

.filter-chip:hover {
  background: #F0F0F0;
}

.filter-chip.active {
  background: #F7B500;
  color: white;
}

.chip-icon {
  font-size: 12px;
}

.chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 交易列表 */
.transaction-list {
  padding: 0 20px;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.transaction-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

.item-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: #F8F9FA;
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.title-text {
  font-size: 15px;
  font-weight: 500;
  color: #2C3E50;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: #F7B500;
  color: white;
  font-size: 11px;
}

.item-desc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.desc-text {
  font-size: 13px;
  color: #999;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc-time {
  font-size: 12px;
  color: #BDBDBD;
  flex-shrink: 0;
}

.item-amount {
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}

.item-amount.positive {
  color: #07C160;
}

.item-amount.negative {
  color: #E74C3C;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 15px;
  color: #999;
}

/* 加载更多 */
.load-more {
  padding: 16px 20px;
  text-align: center;
}

.load-more-btn {
  padding: 10px 32px;
  border: none;
  border-radius: 20px;
  background: white;
  color: #666;
  font-size: 14px;
  cursor: pointer;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #E5E5E5;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #2C3E50;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #F5F5F5;
  font-size: 20px;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #E5E5E5;
}

.modal-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.modal-btn.reset {
  background: #F5F5F5;
  color: #666;
}

.modal-btn.confirm {
  background: #F7B500;
  color: white;
}

/* 筛选表单 */
.filter-section {
  margin-bottom: 20px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #2C3E50;
  margin-bottom: 12px;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  cursor: pointer;
}

.filter-checkbox input {
  cursor: pointer;
}

.filter-date {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-date input {
  flex: 1;
  padding: 10px;
  border: 1px solid #E5E5E5;
  border-radius: 8px;
  font-size: 14px;
}

/* 详情弹窗 */
.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #F5F5F5;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 14px;
  color: #999;
}

.detail-value {
  font-size: 14px;
  color: #2C3E50;
  font-weight: 500;
  text-align: right;
}

.detail-value.amount {
  font-size: 18px;
  font-weight: 600;
}

.detail-value.mono {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  color: white;
  font-size: 12px;
}
</style>


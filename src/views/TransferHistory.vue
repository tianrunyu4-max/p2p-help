<template>
  <div class="transfer-history">
    <!-- 头部 -->
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">结算明细</h1>
      <div class="header-spacer"></div>
    </div>

    <!-- 提示横幅 -->
    <div class="info-banner">
      <div class="banner-icon">ℹ️</div>
      <div class="banner-content">
        <div class="banner-title">系统结算说明</div>
        <div class="banner-text">平台只做计算和分配，所有奖励自动结算到余额。</div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card out">
        <div class="stat-icon">📤</div>
        <div class="stat-content">
          <div class="stat-label">总支出</div>
          <div class="stat-value">{{ stats.totalTransferOut }}</div>
          <div class="stat-count">{{ stats.transferOutCount }}笔</div>
        </div>
      </div>
      <div class="stat-card in">
        <div class="stat-icon">📥</div>
        <div class="stat-content">
          <div class="stat-label">总收益</div>
          <div class="stat-value">{{ stats.totalTransferIn }}</div>
          <div class="stat-count">{{ stats.transferInCount }}笔</div>
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

    <!-- 互转列表 -->
    <div class="transfer-list">
      <div v-if="filteredTransfers.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">暂无结算记录</div>
      </div>

      <div 
        v-for="transfer in filteredTransfers" 
        :key="transfer.id"
        class="transfer-item"
        @click="viewDetail(transfer)">
        <!-- 图标 -->
        <div class="item-icon" :class="getDirectionClass(transfer)">
          {{ getDirectionIcon(transfer) }}
        </div>

        <!-- 内容 -->
        <div class="item-content">
          <div class="item-title">
            <span class="title-text">{{ getTitle(transfer) }}</span>
            <span class="title-badge">{{ getTypeLabel(transfer.transferType) }}</span>
          </div>
          <div class="item-desc">
            <span class="desc-text">{{ getDescription(transfer) }}</span>
            <span class="desc-time">{{ formatTime(transfer.timestamp) }}</span>
          </div>
        </div>

        <!-- 金额 -->
        <div class="item-amount" :class="getDirectionClass(transfer)">
          {{ getAmountText(transfer) }}
        </div>
      </div>
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="load-more">
      <button class="load-more-btn" @click="loadMore">
        加载更多
      </button>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="showDetailModal" class="modal-overlay" @click="showDetailModal = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>结算详情</h3>
          <button class="modal-close" @click="showDetailModal = false">✕</button>
        </div>
        <div class="modal-body" v-if="selectedTransfer">
          <!-- 系统结算提示 -->
          <div class="detail-notice">
            <div class="notice-icon">💡</div>
            <div class="notice-text">系统自动计算分配，所有奖励自动结算到余额</div>
          </div>

          <div class="detail-item">
            <span class="detail-label">结算类型</span>
            <span class="detail-value">
              {{ getTypeIcon(selectedTransfer.transferType) }} 
              {{ getTypeLabel(selectedTransfer.transferType) }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">结算金额</span>
            <span class="detail-value amount" :class="getDirectionClass(selectedTransfer)">
              {{ selectedTransfer.amount }}
            </span>
          </div>
          <div class="detail-item" v-if="selectedTransfer.modelType">
            <span class="detail-label">档位类型</span>
            <span class="detail-value">{{ selectedTransfer.modelType === 'PREMIUM' ? '300' : '100' }}档</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">结算时间</span>
            <span class="detail-value">{{ formatFullTime(selectedTransfer.timestamp) }}</span>
          </div>
          <div class="detail-item" v-if="selectedTransfer.note">
            <span class="detail-label">备注</span>
            <span class="detail-value">{{ selectedTransfer.note }}</span>
          </div>
          
          <div class="detail-item">
            <span class="detail-label">交易编号</span>
            <span class="detail-value mono">{{ selectedTransfer.id }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn" @click="showDetailModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getOrCreateUserId } from '../utils/auth'

const router = useRouter()
const userId = ref(getOrCreateUserId())

const transfers = ref([])
const stats = ref({
  totalTransferOut: 0,
  totalTransferIn: 0,
  transferOutCount: 0,
  transferInCount: 0
})

const selectedType = ref('all')
const showDetailModal = ref(false)
const selectedTransfer = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMore = ref(false)

const typeFilters = [
  { value: 'all', label: '全部', icon: '📋' },
  { value: 'help', label: '购物补贴', icon: '🛒' },
  { value: 'activation', label: '激活扣款', icon: '⚡' },
  { value: 'manual', label: '系统结算', icon: '📊' }
]

onMounted(() => {
  loadTransfers()
})

async function loadTransfers() {
  try {
    const res = await fetch(`/api/transfer/history/${userId.value}`)
    const data = await res.json()
    
    if (data.code === 200 && data.data) {
      const allTransfers = data.data.map(t => ({
        id: t.id,
        fromUserId: t.from_user_id,
        toUserId: t.to_user_id,
        amount: parseFloat(t.amount) || 0,
        fee: parseFloat(t.fee) || 0,
        transferType: 'manual',
        status: (t.status || 'COMPLETED').toLowerCase(),
        note: '',
        timestamp: new Date(t.created_at).getTime(),
        createdAt: t.created_at,
        fromUser: t.from_user,
        toUser: t.to_user
      }))
      
      transfers.value = allTransfers
      
      // 计算统计
      let totalOut = 0, totalIn = 0, outCount = 0, inCount = 0
      allTransfers.forEach(t => {
        if (t.fromUserId === userId.value) {
          totalOut += t.amount + t.fee
          outCount++
        }
        if (t.toUserId === userId.value) {
          totalIn += t.amount
          inCount++
        }
      })
      stats.value = {
        totalTransferOut: totalOut,
        totalTransferIn: totalIn,
        transferOutCount: outCount,
        transferInCount: inCount
      }
    }
  } catch (err) {
    console.error('加载转账记录失败:', err)
  }
}

const filteredTransfers = computed(() => {
  return transfers.value
})

function selectType(type) {
  selectedType.value = type
  currentPage.value = 1
  loadTransfers()
}

function loadMore() {
  currentPage.value++
  loadTransfers()
}

function viewDetail(transfer) {
  selectedTransfer.value = transfer
  showDetailModal.value = true
}

function goBack() {
  router.back()
}

function getDirectionClass(transfer) {
  return transfer.fromUserId === userId.value ? 'out' : 'in'
}

function getDirectionIcon(transfer) {
  return transfer.fromUserId === userId.value ? '📤' : '📥'
}

function getTitle(transfer) {
  if (transfer.fromUserId === userId.value) {
    const name = transfer.toUser?.username || transfer.toUser?.phone || transfer.toUserId
    return `转账给 ${name}`
  } else {
    const name = transfer.fromUser?.username || transfer.fromUser?.phone || transfer.fromUserId
    return `收到来自 ${name} 的转账`
  }
}

function getDescription(transfer) {
  const type = getTypeLabel(transfer.transferType)
  if (transfer.note) {
    return `${type} - ${transfer.note}`
  }
  return type
}

function getAmountText(transfer) {
  const prefix = transfer.fromUserId === userId.value ? '-' : '+'
  return `${prefix}${transfer.amount}`
}

function getTypeLabel(type) {
  const labels = {
    'help': '购物补贴',
    'activation': '激活扣款',
    'manual': '系统结算'
  }
  return labels[type] || type
}

function getTypeIcon(type) {
  const icons = {
    'help': '🛒',
    'activation': '⚡',
    'manual': '📊'
  }
  return icons[type] || '💰'
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
.transfer-history {
  width: 100%;
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 20px;
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

.back-btn {
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

.header-spacer {
  width: 36px;
}

/* 提示横幅 */
.info-banner {
  display: flex;
  gap: 12px;
  margin: 16px 20px;
  padding: 16px;
  background: linear-gradient(135deg, #FFF9E6 0%, #FFE7BA 100%);
  border-radius: 12px;
  border-left: 4px solid #F7B500;
}

.banner-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.banner-title {
  font-size: 14px;
  font-weight: 600;
  color: #856404;
  margin-bottom: 4px;
}

.banner-text {
  font-size: 13px;
  color: #856404;
  line-height: 1.5;
}

/* 统计卡片 */
.stats-cards {
  display: flex;
  gap: 12px;
  padding: 0 20px 16px;
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

.stat-count {
  font-size: 12px;
  color: #999;
}

.stat-card.out .stat-value {
  color: #E74C3C;
}

.stat-card.in .stat-value {
  color: #07C160;
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

/* 互转列表 */
.transfer-list {
  padding: 0 20px;
}

.transfer-item {
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

.transfer-item:hover {
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
  flex-shrink: 0;
}

.item-icon.out {
  background: #FFEBEE;
}

.item-icon.in {
  background: #E8F5E9;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: #F7B500;
  color: white;
  font-size: 11px;
  flex-shrink: 0;
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

.item-amount.out {
  color: #E74C3C;
}

.item-amount.in {
  color: #07C160;
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
  padding: 20px;
  border-top: 1px solid #E5E5E5;
}

.modal-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #F7B500;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

/* 详情内容 */
.detail-notice {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #FFF9E6;
  border-radius: 8px;
  margin-bottom: 16px;
}

.notice-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notice-text {
  font-size: 13px;
  color: #856404;
  line-height: 1.5;
}

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
  font-size: 20px;
  font-weight: 600;
}

.detail-value.amount.out {
  color: #E74C3C;
}

.detail-value.amount.in {
  color: #07C160;
}

.detail-value.mono {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.detail-proof {
  margin-top: 16px;
}

.proof-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 8px;
}

.proof-image {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #E5E5E5;
}
</style>


<script setup>
import { ref, computed, onMounted, onActivated, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'

const router  = useRouter()
const store   = useUserStore()
const activeNav = ref('model')
const isRefreshing = ref(false)
const copiedCode   = ref('')

// ── 导航（对齐 task-wall Team 8项）──────────────────────────────
const navItems = [
  { id: 'income',   icon: '💰', label: '我的收款',  color: 'linear-gradient(135deg,#10AEFF,#4A9EFF)' },
  { id: 'model',    icon: '🎯', label: '1+1模型',  color: 'linear-gradient(135deg,#FF6B9D,#C44569)' },
  { id: 'team',     icon: '👥', label: '团队数据',  color: 'linear-gradient(135deg,#07C160,#06AD56)' },
  { id: 'bangfu',   icon: '🎁', label: '帮扶奖',   color: 'linear-gradient(135deg,#F43F5E,#E11D48)' },
  { id: 'pingji',   icon: '📊', label: '平级奖',   color: 'linear-gradient(135deg,#14B8A6,#0D9488)' },
  { id: 'partner',  icon: '🤝', label: '合伙人',   color: 'linear-gradient(135deg,#F59E0B,#D97706)' },
  { id: 'earnings', icon: '📈', label: '收益记录',  color: 'linear-gradient(135deg,#F472B6,#EC4899)' },
  { id: 'history',  icon: '📋', label: '结算明细',  color: 'linear-gradient(135deg,#6366F1,#4F46E5)' },
]

// ── 数据 ──────────────────────────────────────────────────────────
const shop = ref(null)
const teamStats = ref({
  directCount: 0, totalCount: 0,
  totalReceived: 0, recentTasks: [], agentsJoined: 0, bossesExited: 0,
  currentTier: null,
  reinvestLocked: false, reinvestThreshold: null,
  reinvestRequiredTier: null, reinvestRequiredTotal: null,
  // 兼容旧字段
  repurchaseNeed: false, repurchaseLimit: 900,
})

// 平级余额
const pingjiiBalance  = ref(0)
const pingjiiWithdrawMsg = ref('')
const pingjiiWithdrawing = ref(false)

async function loadPingjiiBalance() {
  try {
    const res = await axios.get('/api/pingjii/balance')
    if (res.data.code === 200) pingjiiBalance.value = parseFloat(res.data.data.balance || 0)
  } catch {}
}

async function requestPingjiiWithdraw() {
  if (pingjiiWithdrawing.value) return
  pingjiiWithdrawing.value = true
  pingjiiWithdrawMsg.value = ''
  try {
    const res = await axios.post('/api/pingjii/withdraw')
    pingjiiWithdrawMsg.value = res.data.data?.message || '✅ 申请已提交'
    await loadPingjiiBalance()
  } catch (e) {
    pingjiiWithdrawMsg.value = '❌ ' + (e.response?.data?.message || '申请失败')
  } finally { pingjiiWithdrawing.value = false }
}
const me = computed(() => store.userInfo || {})
const isOwner   = computed(() => me.value.role === 'owner')
const isManager = computed(() => me.value.role === 'manager')

// 按类型分类收款记录
// source: 'paid' = 实收款（直接到微信/支付宝）；'balance' = 平级余额记账（提现制）
const jianDianTasks = computed(() => (teamStats.value.recentTasks || []).filter(t => t.type_label?.includes('见点')))
const bangFuTasks   = computed(() => (teamStats.value.recentTasks || []).filter(t => t.type_label?.includes('帮扶')))
// 平级实收：提现被匹配后收到的直接打款
const pingJiTasks   = computed(() => (teamStats.value.recentTasks || []).filter(t => t.type_label?.includes('平级') && t.source !== 'balance'))
// 平级全部（实收+余额记账），结算卡片用
const pingJiAll     = computed(() => (teamStats.value.recentTasks || []).filter(t => t.type_label?.includes('平级')))
// 余额记账记录（平级链 + V1/V2见点帮扶）
const pingJiBalanceRecords = computed(() => (teamStats.value.recentTasks || []).filter(t => t.source === 'balance' && t.type_label?.includes('平级')))

const totalJianDian = computed(() => jianDianTasks.value.reduce((s, t) => s + parseFloat(t.amount), 0))
const totalBangFu   = computed(() => bangFuTasks.value.reduce((s, t) => s + parseFloat(t.amount), 0))
const totalPingJi   = computed(() => pingJiTasks.value.reduce((s, t) => s + parseFloat(t.amount), 0))
const totalPingJiAll = computed(() => pingJiAll.value.reduce((s, t) => s + parseFloat(t.amount), 0))
const totalPingJiBalance = computed(() => pingJiBalanceRecords.value.reduce((s, t) => s + parseFloat(t.amount), 0))

// ── 加载 ──────────────────────────────────────────────────────────
async function loadAll() {
  try {
    const [r1, r2] = await Promise.allSettled([
      axios.get('/api/shop/my'),
      axios.get('/api/shop/team-stats'),
    ])
    if (r1.status === 'fulfilled' && r1.value.data.code === 200) shop.value = r1.value.data.data
    if (r2.status === 'fulfilled' && r2.value.data.code === 200) teamStats.value = r2.value.data.data
  } catch {}
  loadPingjiiBalance()
}

async function refreshAll() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  await loadAll()
  isRefreshing.value = false
}

onMounted(() => {
  store.refreshUser()
  loadAll()
})
// keep-alive 切回店铺时刷新数据
onActivated(() => {
  store.refreshUser()
  loadAll()
})
watch(() => store.userInfo, loadAll)

// ── 工具 ──────────────────────────────────────────────────────────
async function copyCode(code) {
  if (!code) return
  try { await navigator.clipboard.writeText(code) }
  catch { const el = document.createElement('textarea'); el.value = code; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el) }
  copiedCode.value = code
  setTimeout(() => { copiedCode.value = '' }, 2000)
}
function fmt(v) { const n = Number(v) || 0; return Number.isInteger(n) ? n : parseFloat(n.toFixed(2)) }
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<template>
  <div class="team-container">

    <!-- ── 左侧导航 ── -->
    <div class="side-nav">
      <div v-for="nav in navItems" :key="nav.id"
           :class="['nav-item', { active: activeNav === nav.id }]"
           @click="activeNav = nav.id">
        <div class="nav-icon" :style="{ background: nav.color }">
          <span>{{ nav.icon }}</span>
        </div>
        <div class="nav-label">{{ nav.label }}</div>
      </div>
    </div>

    <!-- ── 右侧内容 ── -->
    <div class="content-area">

      <!-- 刷新按钮（所有页共用） -->
      <div class="section-refresh-row">
        <button class="refresh-icon-btn" @click="refreshAll" :class="{ spinning: isRefreshing }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/>
          </svg>
          <span>{{ isRefreshing ? '刷新中...' : '刷新' }}</span>
        </button>
      </div>

      <!-- ════════════ 我的收款 ════════════ -->
      <div class="balance-card" v-if="activeNav === 'income'">
        <div class="balance-header">
          <span class="balance-title">💵 我的收款</span>
          <!-- 当前档位徽章 -->
          <span v-if="teamStats.currentTier" class="tier-badge"
            :class="teamStats.currentTier?.toLowerCase()">
            {{ teamStats.currentTier }}
          </span>
        </div>
        <div class="balance-main">
          <span class="balance-amount-large">{{ fmt(teamStats.totalReceived) }}</span>
          <span class="balance-unit">元</span>
        </div>

        <!-- 复投进度条 -->
        <div class="today-earnings-banner" :class="{ locked: teamStats.reinvestLocked }">
          <span class="earnings-icon">{{ teamStats.reinvestLocked ? '🔒' : '📈' }}</span>
          <span class="earnings-label">{{ teamStats.reinvestLocked ? '已锁定' : '收益进度' }}</span>
          <span class="earnings-amount gold">
            {{ fmt(teamStats.totalEarned ?? teamStats.totalReceived) }} / {{ teamStats.reinvestThreshold || '—' }}
          </span>
        </div>

        <!-- 进度条（口径=实收+余额收益） -->
        <div v-if="teamStats.reinvestThreshold" class="reinvest-progress-wrap">
          <div class="reinvest-progress-bar">
            <div class="reinvest-progress-fill"
              :class="{ locked: teamStats.reinvestLocked }"
              :style="{ width: Math.min(((teamStats.totalEarned ?? teamStats.totalReceived) / teamStats.reinvestThreshold) * 100, 100) + '%' }">
            </div>
          </div>
          <div class="reinvest-progress-tip">
            <span v-if="teamStats.reinvestLocked" class="tip-warn">
              ⚠️ 总收益已满 ¥{{ teamStats.reinvestThreshold }}，账号已锁定
            </span>
            <span v-else class="tip-normal">
              还差 ¥{{ Math.max(0, teamStats.reinvestThreshold - (teamStats.totalEarned ?? teamStats.totalReceived)).toFixed(0) }} 达到复投线
            </span>
          </div>
        </div>

        <!-- 锁定提示 + 复投按钮 -->
        <div v-if="teamStats.reinvestLocked" class="reinvest-alert">
          <div class="ra-lock-icon">🔒</div>
          <div class="ra-lock-info">
            <div class="ra-lock-title">账号已锁定，需要复投解锁</div>
            <div class="ra-lock-sub">
              复投 {{ teamStats.reinvestRequiredTier }}（¥{{ teamStats.reinvestRequiredTotal }}）解锁，继续参与互助
            </div>
          </div>
        </div>
        <div v-else-if="teamStats.reinvestThreshold" class="activate-guide-tip">
          💡 累计收款满 ¥{{ teamStats.reinvestThreshold }} 后需复投{{ teamStats.reinvestRequiredTier }}（¥{{ teamStats.reinvestRequiredTotal }}）继续
        </div>
        <div v-else-if="teamStats.currentTier" class="activate-guide-tip">
          💡 当前档位（{{ teamStats.currentTier }}）无复投限制，收益无上限
        </div>
        <div v-else class="activate-guide-tip">
          💡 激活后查看收款进度
        </div>

        <!-- 收款类型汇总 -->
        <div class="income-breakdown">
          <div class="breakdown-item">
            <div class="bk-icon" style="background:#fffbea">👑</div>
            <div class="bk-info"><div class="bk-name">见点奖</div><div class="bk-hint">按档位</div></div>
            <div class="bk-amount">+{{ fmt(totalJianDian) }}元</div>
          </div>
          <div class="breakdown-item">
            <div class="bk-icon" style="background:#f0fff4">🫱</div>
            <div class="bk-info"><div class="bk-name">帮扶奖</div><div class="bk-hint">按档位</div></div>
            <div class="bk-amount">+{{ fmt(totalBangFu) }}元</div>
          </div>
          <div class="breakdown-item">
            <div class="bk-icon" style="background:#ebf8ff">📊</div>
            <div class="bk-info"><div class="bk-name">平级奖</div><div class="bk-hint">10元/次</div></div>
            <div class="bk-amount">+{{ fmt(totalPingJi) }}元</div>
          </div>
        </div>

        <div class="action-buttons">
          <button v-if="teamStats.reinvestLocked"
            class="action-btn reinvest full-width"
            @click="router.push('/participate')">
            <span class="btn-icon">🔓</span>
            立即复投 {{ teamStats.reinvestRequiredTier }}（¥{{ teamStats.reinvestRequiredTotal }}）解锁账号
          </button>
          <button v-else class="action-btn activate full-width" @click="router.push('/activate')">
            <span class="btn-icon">⚡</span>
            去激活
          </button>
        </div>
      </div>

      <!-- ════════════ 1+1 模型 ════════════ -->
      <template v-if="activeNav === 'model'">
        <!-- 身份卡片 -->
        <div class="identity-card" :class="me.role || 'member'">
          <div class="identity-header">
            <span class="identity-icon">{{ isOwner ? '👑' : '👔' }}</span>
            <div class="identity-info">
              <div class="identity-title">{{ isOwner ? '老板身份' : isManager ? '代理身份' : '未激活' }}</div>
              <div class="identity-subtitle">{{ isOwner ? '永久拿见点奖，不出局' : isManager ? '推满1人后出局开店，成为新老板' : '完成激活后进入店铺' }}</div>
            </div>
            <span class="identity-badge" :class="isOwner ? 'landlord' : isManager ? 'pending' : 'none'">
              {{ isOwner ? '独立店铺' : isManager ? '等待出局' : '未激活' }}
            </span>
          </div>
          <!-- 出局进度 -->
          <div class="contribution-section" v-if="isManager">
            <div class="contribution-header">
              <span class="contribution-label">📋 出局进度</span>
              <span class="contribution-value">{{ teamStats.directCount }}/1</span>
            </div>
            <div class="contribution-bar">
              <div class="contribution-fill" :style="{ width: (teamStats.directCount >= 1 ? 100 : 0) + '%' }"></div>
            </div>
            <div class="contribution-hint" :class="{ warning: teamStats.directCount < 1 }">
              {{ teamStats.directCount >= 1 ? '✅ 已达出局条件' : '⚠️ 推荐1人后出局开店成为老板' }}
            </div>
          </div>
          <div class="contribution-done" v-if="isOwner">
            <span class="done-icon">✅</span>
            <span class="done-text">已出局开店，成为老板，永久拿见点奖</span>
          </div>
        </div>

        <!-- 1+1 模型可视化 -->
        <div class="model-card">
          <div class="model-header">
            <span class="model-title">🏪 1+1 店铺模型</span>
            <span class="model-badge" :class="isOwner ? 'landlord' : 'pending'">
              {{ isOwner ? '我的店铺' : '在职代理' }}
            </span>
          </div>

          <div class="model-diagram">
            <!-- 老板位 -->
            <div class="position-box position-a">
              <div class="position-glow"></div>
              <div class="position-content">
                <div class="position-label">👑 老板</div>
                <div class="position-avatar"><span class="avatar-icon">👑</span></div>
                <div class="position-user">{{ shop?.owner_no || (isOwner ? me.user_no : '等待开店') }}</div>
                <div class="position-invite" v-if="shop?.owner_invite_code || (isOwner && me.invite_code)">
                  <span class="invite-code-text">邀请码：{{ shop?.owner_invite_code || me.invite_code }}</span>
                  <button class="invite-copy-btn" @click="copyCode(shop?.owner_invite_code || me.invite_code)">
                    {{ copiedCode === (shop?.owner_invite_code || me.invite_code) ? '✅' : '复制' }}
                  </button>
                </div>
                <div class="position-desc">永久拿见点奖 · 不出局</div>
              </div>
            </div>

            <!-- 连接线 -->
            <div class="connection-line">
              <div class="line-flow"></div>
              <div class="line-arrow">↓</div>
            </div>

            <!-- 代理位 -->
            <div class="position-box position-b" :class="{ 'has-user': shop?.tenant_no }">
              <div class="position-content">
                <div class="position-label">👔 代理</div>
                <div class="position-avatar"><span class="avatar-icon">{{ shop?.tenant_no ? '👔' : '⏳' }}</span></div>
                <div class="position-user">{{ shop?.tenant_no || '空缺中...' }}</div>
                <div class="position-invite" v-if="shop?.tenant_invite_code || (!isOwner && me.invite_code)">
                  <span class="invite-code-text">邀请码：{{ shop?.tenant_invite_code || me.invite_code }}</span>
                  <button class="invite-copy-btn" @click="copyCode(shop?.tenant_invite_code || me.invite_code)">
                    {{ copiedCode === (shop?.tenant_invite_code || me.invite_code) ? '✅' : '复制' }}
                  </button>
                </div>
                <div class="position-desc">{{ shop?.tenant_no ? '推满1人出局开店' : '等待代理加入' }}</div>
              </div>
            </div>

            <!-- 等待队列 -->
            <div class="waiting-queue" v-if="teamStats.directCount > 0">
              <div class="queue-label">等待队列</div>
              <div class="queue-dots">
                <span v-for="i in Math.min(teamStats.directCount, 5)" :key="i" class="queue-dot"></span>
                <span v-if="teamStats.directCount > 5" class="queue-more">+{{ teamStats.directCount - 5 }}</span>
              </div>
            </div>
          </div>

          <!-- 模型说明 -->
          <div class="model-tips">
            <div class="tip-item">💡 一个店 = 老板 + 代理（2人）</div>
            <div class="tip-item">👑 老板永久拿见点奖（激活金额×20%）</div>
            <div class="tip-item">👔 代理推满1人后出局开店，成为新老板</div>
          </div>
        </div>
      </template>

      <!-- ════════════ 团队数据 ════════════ -->
      <div class="team-card" v-if="activeNav === 'team'">
        <div class="card-title">📊 团队数据</div>
        <!-- 复投提示 -->
        <div v-if="teamStats.reinvestLocked" class="repurchase-alert">
          <div class="ra-icon">🔒</div>
          <div>
            <div class="ra-title">收款已达 ¥{{ teamStats.reinvestThreshold }}，账号已锁定！</div>
            <div class="ra-sub">需复投 {{ teamStats.reinvestRequiredTier }}（¥{{ teamStats.reinvestRequiredTotal }}）才能继续参与互助</div>
          </div>
        </div>

        <div class="team-stats">
          <div class="stat-item">
            <span class="ms-icon">👔</span>
            <span class="stat-value">{{ teamStats.agentsJoined }}</span>
            <span class="stat-label">直推代理</span>
          </div>
          <div class="stat-item">
            <span class="ms-icon">👑</span>
            <span class="stat-value">{{ teamStats.bossesExited }}</span>
            <span class="stat-label">出局老板</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ fmt(teamStats.totalReceived) }}</span>
            <span class="stat-label">累计收款</span>
          </div>
          <div class="stat-item" v-if="teamStats.reinvestThreshold">
            <span class="stat-value" :class="{ 'stat-done': teamStats.reinvestLocked }">
              {{ teamStats.reinvestLocked ? '🔒' : fmt(teamStats.reinvestThreshold - teamStats.totalReceived) }}
            </span>
            <span class="stat-label">距{{ teamStats.reinvestRequiredTier }}复投</span>
          </div>
          <div class="stat-item" v-else>
            <span class="stat-value">—</span>
            <span class="stat-label">复投进度</span>
          </div>
        </div>

        <!-- 我的邀请码（仅激活用户可见）-->
        <div v-if="store.isActivated" class="invite-box">
          <div class="invite-box-title">我的邀请码</div>
          <div class="invite-box-row">
            <span class="invite-big">{{ me.invite_code || '--' }}</span>
            <button class="copy-big-btn" @click="copyCode(me.invite_code)">
              {{ copiedCode === me.invite_code ? '✅ 已复制' : '📋 复制' }}
            </button>
          </div>
          <div class="invite-used-tip">已使用 {{ me.invite_used || 0 }}/2 次（每人最多邀请2位）</div>
        </div>
        <div v-else class="invite-locked">
          🔒 激活后才能获得邀请码
        </div>
      </div>

      <!-- ════════════ 帮扶奖 ════════════ -->
      <div class="subsidy-card" v-if="activeNav === 'bangfu'">
        <div class="subsidy-header">
          <span class="subsidy-title">🫱 帮扶奖说明</span>
          <span class="subsidy-badge">30元 × 2人</span>
        </div>
        <div class="subsidy-balance">
          <div class="balance-box">
            <div class="balance-label">帮扶收款</div>
            <div class="balance-amount">{{ fmt(totalBangFu) }}</div>
            <div class="balance-percent">元</div>
            <div class="balance-hint">已确认到账</div>
          </div>
          <div class="balance-box">
            <div class="balance-label">帮扶次数</div>
            <div class="balance-amount">{{ bangFuTasks.length }}</div>
            <div class="balance-percent">次</div>
            <div class="balance-hint">每次30元</div>
          </div>
        </div>
        <div class="subsidy-features">
          <div class="feature-title">📌 帮扶奖规则</div>
          <div class="feature-item">
            <span class="feature-icon">🫱</span>
            <div class="feature-content">
              <div class="feature-name">帮扶奖 (30元×2)</div>
              <div class="feature-desc">新人激活时，打给老板的2位出局直推；若未出局则匹配给生活补贴参与者</div>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✅</span>
            <div class="feature-content">
              <div class="feature-name">领取条件</div>
              <div class="feature-desc">你的邀请码使用2次且两人均已出局独立开店后，即可接收帮扶打款</div>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">💵</span>
            <div class="feature-content">
              <div class="feature-name">打款方式</div>
              <div class="feature-desc">新人直接扫你的微信/支付宝收款码，点对点实时到账</div>
            </div>
          </div>
        </div>
        <div class="subsidy-rules">
          <div class="rule-item">✅ 帮扶奖：每人激活 → 向你的2位出局直推各付30元</div>
          <div class="rule-item">✅ 如直推未出局，帮扶奖匹配给生活补贴静态玩家</div>
          <div class="rule-item">✅ 全程点对点，资金不经平台</div>
        </div>
      </div>

      <!-- ════════════ 平级奖 ════════════ -->
      <div class="partner-card" v-if="activeNav === 'pingji'">

        <!-- 平级余额卡片 -->
        <div class="pj-balance-card">
          <div class="pj-bal-label">平级余额</div>
          <div class="pj-bal-amount">¥{{ pingjiiBalance.toFixed(0) }}</div>
          <div class="pj-bal-sub">每次有人在你链上激活，自动 +¥10</div>
          <div v-if="pingjiiBalance >= 30">
            <button class="pj-withdraw-btn" :disabled="pingjiiWithdrawing" @click="requestPingjiiWithdraw">
              {{ pingjiiWithdrawing ? '申请中...' : '💸 申请提现 ¥30' }}
            </button>
            <div v-if="pingjiiWithdrawMsg" class="pj-withdraw-msg">{{ pingjiiWithdrawMsg }}</div>
          </div>
          <div v-else class="pj-bal-progress">
            <div class="pj-prog-bar">
              <div class="pj-prog-fill" :style="{ width: Math.min(pingjiiBalance/30*100, 100)+'%' }"></div>
            </div>
            <span class="pj-prog-tip">还差 ¥{{ Math.max(0, 30-pingjiiBalance).toFixed(0) }} 可提现</span>
          </div>
        </div>

        <div class="partner-badge-section qualified">
          <div class="badge-icon">📊</div>
          <div class="badge-info">
            <div class="badge-title">平级奖 · 平级链</div>
            <div class="badge-subtitle">每人激活时，沿邀请链自动分配平级奖，每节点¥10入余额</div>
          </div>
          <span class="badge-status active">✅ 已激活</span>
        </div>

        <div class="partner-dividend-stats" v-if="pingJiTasks.length > 0 || pingJiBalanceRecords.length > 0">
          <div class="stats-header">
            <span class="stats-title">平级奖统计</span>
            <span class="pool-badge">每层奖励先入余额 · 满30提现</span>
          </div>
          <div class="stats-grid">
            <div class="stat-box">
              <span class="stat-label">记入余额累计</span>
              <span class="stat-value gold">{{ fmt(totalPingJiBalance) }}元</span>
            </div>
            <div class="stat-box">
              <span class="stat-label">提现实收</span>
              <span class="stat-value gold">{{ fmt(totalPingJi) }}元</span>
            </div>
          </div>
        </div>

        <div class="partner-dividend-info">
          <div class="info-header"><span class="info-title">📋 平级奖规则</span></div>
          <div class="info-list">
            <div class="info-item"><span class="info-icon">🔗</span><span class="info-text">新人激活时，沿邀请链自动触发平级奖，链上每个节点收10元</span></div>
            <div class="info-item"><span class="info-icon">📊</span><span class="info-text">你在哪个节点位置，就收取对应的10元平级奖</span></div>
            <div class="info-item"><span class="info-icon">💵</span><span class="info-text">全程点对点打款，新人扫码直接付给平级收款人</span></div>
          </div>
        </div>
      </div>

      <!-- ════════════ 合伙人 ════════════ -->
      <div class="hehuo-card" v-if="activeNav === 'partner'">
        <div class="hehuo-badge-section" :class="{ qualified: isOwner }">
          <div class="hehuo-badge-icon">{{ isOwner ? '🏆' : '🎯' }}</div>
          <div class="hehuo-badge-info">
            <div class="hehuo-badge-title">{{ isOwner ? '🤝 老板合伙人' : '合伙人资格' }}</div>
            <div class="hehuo-badge-sub">{{ isOwner ? '已出局开店，成为独立老板合伙人' : '完成激活并出局开店后成为合伙人' }}</div>
          </div>
          <span class="hehuo-badge-status" :class="isOwner ? 'active' : 'pending'">
            {{ isOwner ? '✅ 已达标' : '⏳ 未达标' }}
          </span>
        </div>

        <div class="hehuo-progress-section">
          <div class="hehuo-progress-title">📋 我的邀请码推广</div>
          <div class="invite-box" style="margin-top:0">
            <div class="invite-box-row">
              <span class="invite-big">{{ me.invite_code || '--' }}</span>
              <button class="copy-big-btn" @click="copyCode(me.invite_code)">
                {{ copiedCode === me.invite_code ? '✅ 已复制' : '📋 复制' }}
              </button>
            </div>
            <div class="invite-used-tip">已使用 {{ me.invite_used || 0 }}/2 次</div>
          </div>
          <div class="hehuo-progress-bar-wrap" style="margin-top:12px">
            <div class="hehuo-progress-bar" :style="{ width: ((me.invite_used || 0) / 2 * 100) + '%' }"></div>
          </div>
          <div class="hehuo-progress-hint" v-if="(me.invite_used || 0) < 2">
            还可邀请 <strong>{{ 2 - (me.invite_used || 0) }}</strong> 人
          </div>
        </div>

        <div class="hehuo-rights">
          <div class="hehuo-rights-title">🎖️ 老板权益</div>
          <div class="hehuo-right-item">✅ 永久接收见点奖（每人激活付80元）</div>
          <div class="hehuo-right-item">✅ 接收帮扶奖（2位出局直推各30元）</div>
          <div class="hehuo-right-item">✅ 收取平级链奖励（链上节点每次10元）</div>
          <div class="hehuo-right-item">✅ 邀请码可再次使用（出局后重置）</div>
        </div>
      </div>

      <!-- ════════════ 收益记录 ════════════ -->
      <div class="quick-links" v-if="activeNav === 'earnings'">
        <div class="card-title">📈 收益记录</div>
        <div class="earnings-summary-row">
          <span>累计收款</span>
          <span class="gold-text">{{ fmt(teamStats.totalReceived) }} 元</span>
        </div>
        <div v-if="(teamStats.recentTasks || []).length" class="task-list">
          <div v-for="(t, i) in teamStats.recentTasks" :key="i" class="task-item">
            <div class="task-left">
              <div class="task-type-badge" :class="t.type_label?.includes('见点') ? 'jiandian' : t.type_label?.includes('帮扶') ? 'bangfu' : 'pingji'">
                {{ t.type_label?.includes('见点') ? '见点' : t.type_label?.includes('帮扶') ? '帮扶' : '平级' }}
              </div>
              <div>
                <div class="task-label">{{ t.type_label }}</div>
                <div class="task-time">
                  {{ fmtTime(t.confirmed_at) }}
                  <span v-if="t.source === 'balance'" class="src-badge balance">💰 记入余额</span>
                  <span v-else class="src-badge paid">✅ 实收</span>
                </div>
              </div>
            </div>
            <div class="task-amount" :class="{ 'amount-balance': t.source === 'balance' }">+{{ t.amount }}元</div>
          </div>
        </div>
        <div v-else class="empty-tip">暂无收益记录</div>
      </div>

      <!-- ════════════ 结算明细 ════════════ -->
      <div class="quick-links" v-if="activeNav === 'history'">
        <div class="card-title">📋 结算明细</div>
        <div class="settle-type-grid">
          <div class="settle-type-card jiandian-card">
            <div class="st-icon">👑</div>
            <div class="st-name">见点奖</div>
            <div class="st-amount">{{ fmt(totalJianDian) }}元</div>
            <div class="st-count">{{ jianDianTasks.length }}笔</div>
          </div>
          <div class="settle-type-card bangfu-card">
            <div class="st-icon">🫱</div>
            <div class="st-name">帮扶奖</div>
            <div class="st-amount">{{ fmt(totalBangFu) }}元</div>
            <div class="st-count">{{ bangFuTasks.length }}笔</div>
          </div>
          <div class="settle-type-card pingji-card">
            <div class="st-icon">📊</div>
            <div class="st-name">平级奖</div>
            <div class="st-amount">{{ fmt(totalPingJiAll) }}元</div>
            <div class="st-count">{{ pingJiAll.length }}笔</div>
          </div>
        </div>

        <div class="settle-total-row">
          <span>合计实收款（已到微信/支付宝）</span>
          <span class="gold-text">{{ fmt(teamStats.totalReceived) }} 元</span>
        </div>

        <!-- 平级余额（提现制，与实收款分开） -->
        <div class="pingji-balance-row">
          <div class="pjb-left">
            <span class="pjb-icon">💰</span>
            <div>
              <div class="pjb-title">平级余额（提现制）</div>
              <div class="pjb-sub">链上奖励先记余额，满30元可申请提现</div>
            </div>
          </div>
          <span class="pjb-amount">¥{{ pingjiiBalance.toFixed(0) }}</span>
        </div>

        <div v-if="(teamStats.recentTasks || []).length" class="task-list" style="margin-top:12px">
          <div v-for="(t, i) in teamStats.recentTasks" :key="i" class="task-item">
            <div class="task-left">
              <div class="task-type-badge" :class="t.type_label?.includes('见点') ? 'jiandian' : t.type_label?.includes('帮扶') ? 'bangfu' : 'pingji'">
                {{ t.type_label?.includes('见点') ? '见点' : t.type_label?.includes('帮扶') ? '帮扶' : '平级' }}
              </div>
              <div>
                <div class="task-label">{{ t.type_label }}</div>
                <div class="task-time">
                  {{ fmtTime(t.confirmed_at) }}
                  <span v-if="t.source === 'balance'" class="src-badge balance">💰 记入余额</span>
                  <span v-else class="src-badge paid">✅ 实收</span>
                </div>
              </div>
            </div>
            <div class="task-amount" :class="{ 'amount-balance': t.source === 'balance' }">+{{ t.amount }}元</div>
          </div>
        </div>
        <div v-else class="empty-tip">暂无结算明细</div>
      </div>

    </div><!-- end content-area -->
  </div>
</template>

<style scoped>
/* ══ 容器 ══════════════════════════════════════════════════════ */
.team-container { display:flex; min-height:100vh; background:#F5F5F5; }

/* ══ 左侧导航（完全对齐 task-wall Team.vue）══════════════════════ */
.side-nav {
  width:70px; background:#fff; padding:12px 8px;
  display:flex; flex-direction:column; gap:8px;
  box-shadow:2px 0 8px rgba(0,0,0,.05); overflow-y:auto; flex-shrink:0;
}
.nav-item {
  display:flex; flex-direction:column; align-items:center; gap:4px;
  padding:8px 4px; border-radius:12px; cursor:pointer; transition:all .2s;
}
.nav-item:hover { background:rgba(0,0,0,.03); }
.nav-item.active { background:rgba(16,174,255,.08); }
.nav-icon {
  width:40px; height:40px; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 2px 8px rgba(0,0,0,.15); transition:all .2s;
}
.nav-item:hover .nav-icon { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,.2); }
.nav-icon span { font-size:20px; }
.nav-label { font-size:10px; color:#666; text-align:center; line-height:1.2; word-break:break-all; }
.nav-item.active .nav-label { color:#10AEFF; font-weight:600; }

/* ══ 右侧内容 ══════════════════════════════════════════════════ */
.content-area { flex:1; padding:16px; overflow-y:auto; }
.section-refresh-row { display:flex; justify-content:flex-end; margin-bottom:8px; }
.refresh-icon-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 10px; border:1px solid #E0E0E0; border-radius:20px;
  background:#fff; color:#666; font-size:12px; cursor:pointer;
}
.refresh-icon-btn.spinning svg { animation:spin 1s linear infinite; }
@keyframes spin { 100%{transform:rotate(360deg)} }

/* ══ 我的收款 ══════════════════════════════════════════════════ */
.balance-card { background:#fff; border-radius:12px; padding:16px; margin-bottom:12px; }
.balance-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.balance-title { font-size:15px; font-weight:600; color:#333; }
.balance-main { display:flex; align-items:baseline; justify-content:center; gap:8px; padding:20px 0; }
.balance-amount-large { font-size:48px; font-weight:900; color:#F7B500; line-height:1; }
.balance-unit { font-size:16px; color:#999; }
.today-earnings-banner {
  display:flex; align-items:center; justify-content:center; gap:12px;
  background:linear-gradient(135deg,#FFD89B,#FF9A76);
  padding:14px 20px; border-radius:12px; margin:12px 0;
  box-shadow:0 4px 12px rgba(255,154,118,.3);
}
.earnings-icon { font-size:22px; }
.earnings-label { font-size:15px; font-weight:600; color:#fff; }
.earnings-amount { font-size:20px; font-weight:900; }
.earnings-amount.gold { color:#fff; }
.activate-guide-tip {
  background:linear-gradient(135deg,#FFFDE7,#FFF8CC);
  border:1px solid rgba(247,181,0,.45);
  border-radius:10px; padding:10px 14px;
  margin-bottom:12px; font-size:13px; color:#7a5500;
  font-weight:500; text-align:center;
}

/* 档位徽章 */
.tier-badge { padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; }
.tier-badge.v1 { background:#e8f5e9; color:#2e7d32; }
.tier-badge.v2 { background:#e3f2fd; color:#1565c0; }
.tier-badge.v3 { background:#fff8e1; color:#b7791f; }

/* 复投进度条 */
.reinvest-progress-wrap { margin:8px 0 12px; }
.reinvest-progress-bar { height:8px; background:#eee; border-radius:4px; overflow:hidden; }
.reinvest-progress-fill { height:100%; background:#48bb78; border-radius:4px; transition:width .4s; }
.reinvest-progress-fill.locked { background:#e53e3e; }
.reinvest-progress-tip { display:flex; justify-content:flex-end; font-size:12px; margin-top:4px; }
.tip-warn { color:#c53030; font-weight:600; }
.tip-normal { color:#888; }

/* 锁定告警 */
.reinvest-alert {
  display:flex; align-items:center; gap:12px;
  background:#fff5f5; border:2px solid #e53e3e;
  border-radius:14px; padding:14px; margin-bottom:12px;
}
.ra-lock-icon { font-size:28px; flex-shrink:0; }
.ra-lock-title { font-size:14px; font-weight:900; color:#c53030; }
.ra-lock-sub { font-size:12px; color:#e53e3e; margin-top:2px; }

/* 进度条 locked 状态 */
.today-earnings-banner.locked {
  background:linear-gradient(135deg,#FC8181,#E53E3E) !important;
}

/* 复投按钮 */
.action-btn.reinvest { background:linear-gradient(135deg,#E53E3E,#C53030); color:#fff; }
.action-btn.reinvest:hover { opacity:.9; }
.income-breakdown { display:flex; flex-direction:column; gap:8px; margin:12px 0; }
.breakdown-item { display:flex; align-items:center; gap:10px; padding:10px; background:#f9f9f9; border-radius:10px; }
.bk-icon { width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:18px; }
.bk-info { flex:1; }
.bk-name { font-size:14px; font-weight:600; color:#333; }
.bk-hint { font-size:11px; color:#999; }
.bk-amount { font-size:15px; font-weight:900; color:#276749; }
.action-buttons { display:grid; gap:10px; }
.action-btn { padding:12px; border:none; border-radius:10px; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
.action-btn.activate { background:linear-gradient(135deg,#F7B500,#FFC900); color:#fff; }
.action-btn.full-width { grid-column:1/-1; }

/* ══ 身份卡片 ══════════════════════════════════════════════════ */
.identity-card { background:#fff; border-radius:12px; padding:16px; margin-bottom:12px; }
.identity-card.owner   { border-left:4px solid #F7B500; }
.identity-card.manager { border-left:4px solid #48bb78; }
.identity-card.member  { border-left:4px solid #ccc; }
.identity-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.identity-icon { font-size:28px; }
.identity-info { flex:1; }
.identity-title { font-weight:900; font-size:15px; }
.identity-subtitle { font-size:12px; color:#999; margin-top:2px; }
.identity-badge { padding:3px 10px; border-radius:20px; font-size:12px; }
.identity-badge.landlord { background:#fffbea; color:#b7791f; }
.identity-badge.pending  { background:#f0fff4; color:#276749; }
.identity-badge.none     { background:#f5f5f5; color:#999; }
.contribution-section { margin-top:4px; }
.contribution-header { display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px; }
.contribution-bar { height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; }
.contribution-fill { height:100%; background:#48bb78; border-radius:3px; transition:width .4s; }
.contribution-hint { font-size:12px; color:#666; margin-top:5px; }
.contribution-hint.warning { color:#d69e2e; }
.contribution-done { display:flex; align-items:center; gap:8px; font-size:13px; color:#276749; }

/* ══ 1+1 模型 ══════════════════════════════════════════════════ */
.model-card { background:#fff; border-radius:16px; padding:16px; margin-bottom:12px; }
.model-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
.model-title { font-size:16px; font-weight:900; }
.model-badge { padding:4px 14px; border-radius:20px; font-size:13px; font-weight:600; }
.model-badge.landlord { background:#f0fff4; color:#276749; border:1px solid #48bb78; }
.model-badge.pending  { background:#fffbea; color:#b7791f; border:1px solid #f0a500; }
.model-diagram { display:flex; flex-direction:column; align-items:center; }
.position-box {
  width:100%; max-width:300px; border-radius:16px;
  padding:20px 16px; text-align:center; position:relative; overflow:hidden;
}
.position-a { background:linear-gradient(135deg,#fffbea,#fef3c7); border:2px solid #f0a500; }
.position-b { background:#f0fff4; border:2px dashed #48bb78; }
.position-b.has-user { border-style:solid; }
.position-glow {
  position:absolute; top:-20px; left:50%; transform:translateX(-50%);
  width:80px; height:40px;
  background:radial-gradient(#f6e05e88,transparent);
  pointer-events:none;
}
.position-label { font-weight:900; font-size:14px; margin-bottom:10px; }
.position-avatar { margin-bottom:8px; }
.avatar-icon {
  font-size:52px;
  display:inline-flex; align-items:center; justify-content:center;
  width:72px; height:72px; border-radius:50%;
  background:linear-gradient(135deg,#f6e05e,#f0a500);
  box-shadow:0 4px 12px rgba(240,165,0,.3);
}
.position-b .avatar-icon { background:linear-gradient(135deg,#9ae6b4,#48bb78); box-shadow:0 4px 12px rgba(72,187,120,.3); }
.position-user { font-size:28px; font-weight:800; letter-spacing:2px; margin-bottom:8px; }
.position-invite { display:flex; align-items:center; gap:6px; justify-content:center; margin-top:6px; }
.invite-code-text { font-size:13px; font-weight:600; }
.invite-copy-btn {
  padding:3px 12px; border:1px solid #f0a500;
  border-radius:20px; background:#fff; color:#b7791f;
  font-size:12px; cursor:pointer; font-weight:600;
}
.position-b .invite-copy-btn { border-color:#48bb78; color:#276749; }
.position-desc { font-size:12px; color:#888; margin-top:8px; }
.connection-line { display:flex; flex-direction:column; align-items:center; padding:6px 0; }
.line-flow { width:2px; height:24px; background:linear-gradient(#f0a500,#48bb78); }
.line-arrow { font-size:18px; color:#f0a500; margin-top:-2px; }
.waiting-queue { margin-top:14px; text-align:center; }
.queue-label { font-size:12px; color:#888; margin-bottom:8px; }
.queue-dots { display:flex; gap:8px; justify-content:center; align-items:center; }
.queue-dot { width:12px; height:12px; border-radius:50%; background:#f0a500; }
.queue-more { font-size:12px; color:#f0a500; font-weight:900; }
.model-tips { margin-top:16px; padding-top:12px; border-top:1px solid #f0f0f0; }
.tip-item { font-size:13px; color:#555; padding:4px 0; }

/* ══ 团队数据 ══════════════════════════════════════════════════ */
.team-card, .subsidy-card, .partner-card, .hehuo-card, .quick-links {
  background:#fff; border-radius:12px; padding:16px; margin-bottom:12px;
}
.card-title { font-size:16px; font-weight:900; margin-bottom:14px; }
.repurchase-alert { display:flex; align-items:center; gap:12px; background:#fff5f5; border:2px solid #e53e3e; border-radius:14px; padding:14px; margin-bottom:14px; }
.ra-icon { font-size:28px; flex-shrink:0; }
.ra-title { font-size:15px; font-weight:900; color:#c53030; }
.ra-sub { font-size:12px; color:#e53e3e; margin-top:2px; }
.team-stats { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
.model-stats-row { display:flex; background:#fff; border-radius:14px; padding:14px; margin-bottom:14px; border:1px solid #f0f0f0; }
.ms-item { flex:1; display:flex; align-items:center; gap:10px; justify-content:center; }
.ms-icon { font-size:24px; }
.ms-num { font-size:22px; font-weight:900; color:#f0a500; }
.ms-label { font-size:11px; color:#999; margin-top:1px; }
.ms-divider { width:1px; background:#f0f0f0; margin:0 10px; }
.stat-item { background:#f9fafb; border-radius:10px; padding:14px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:4px; }
.stat-item .ms-icon { font-size:20px; }
.stat-value { display:block; font-size:26px; font-weight:800; color:#1a202c; line-height:1.1; }
.stat-value.stat-done { color:#07C160; font-size:22px; }
.stat-label { display:block; font-size:11px; color:#888; }
/* 平级余额卡片 */
.pj-balance-card { background:linear-gradient(135deg,#4299e1,#3182ce); border-radius:16px; padding:20px; margin-bottom:14px; color:#fff; text-align:center; }
.pj-bal-label { font-size:12px; opacity:.85; margin-bottom:4px; }
.pj-bal-amount { font-size:42px; font-weight:800; line-height:1; margin-bottom:4px; }
.pj-bal-sub { font-size:12px; opacity:.8; margin-bottom:14px; }
.pj-withdraw-btn { background:#fff; color:#3182ce; border:none; border-radius:10px; padding:10px 24px; font-size:14px; font-weight:700; cursor:pointer; }
.pj-withdraw-btn:disabled { opacity:.6; cursor:not-allowed; }
.pj-withdraw-msg { font-size:12px; margin-top:8px; opacity:.9; }
.pj-bal-progress { margin-top:4px; }
.pj-prog-bar { background:rgba(255,255,255,.3); border-radius:10px; height:8px; margin-bottom:6px; }
.pj-prog-fill { background:#fff; border-radius:10px; height:100%; transition:width .4s; }
.pj-prog-tip { font-size:12px; opacity:.8; }

.invite-locked { background:#f5f5f5; border-radius:10px; padding:14px; text-align:center; color:#999; font-size:13px; margin-top:14px; }
.invite-box { background:#fffbea; border-radius:10px; padding:14px; text-align:center; margin-top:14px; }
.invite-box-title { font-size:12px; color:#888; margin-bottom:8px; }
.invite-box-row { display:flex; align-items:center; justify-content:center; gap:10px; }
.invite-big { font-size:26px; font-weight:800; letter-spacing:3px; color:#b7791f; }
.copy-big-btn { padding:6px 14px; background:#f0a500; color:#fff; border:none; border-radius:20px; font-size:13px; cursor:pointer; }
.invite-used-tip { font-size:12px; color:#999; margin-top:6px; }

/* ══ 帮扶奖 ══════════════════════════════════════════════════ */
.subsidy-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.subsidy-title { font-size:16px; font-weight:900; }
.subsidy-badge { padding:3px 10px; background:#fff0f5; color:#c44569; border-radius:20px; font-size:12px; font-weight:600; }
.subsidy-balance { display:flex; gap:12px; margin-bottom:14px; }
.balance-box { flex:1; background:#f9fafb; border-radius:10px; padding:12px; text-align:center; }
.balance-label { font-size:11px; color:#888; }
.balance-amount { font-size:22px; font-weight:800; color:#1a202c; margin:6px 0; }
.balance-percent { font-size:12px; color:#888; }
.balance-hint { font-size:11px; color:#48bb78; margin-top:4px; }
.subsidy-features, .partner-dividend-info { margin-top:14px; }
.feature-title, .info-header .info-title { font-size:13px; font-weight:900; color:#333; margin-bottom:10px; display:block; }
.feature-item, .info-item { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; }
.feature-icon, .info-icon { font-size:18px; flex-shrink:0; }
.feature-name { font-size:13px; font-weight:600; color:#333; }
.feature-desc, .info-text { font-size:12px; color:#888; margin-top:2px; }
.subsidy-rules, .contribution-rules { margin-top:12px; padding-top:12px; border-top:1px solid #f0f0f0; }
.rule-item { font-size:12px; color:#666; padding:3px 0; }

/* ══ 平级奖 ══════════════════════════════════════════════════ */
.partner-badge-section {
  display:flex; align-items:center; gap:10px;
  padding:14px; background:#f9fafb; border-radius:12px; margin-bottom:14px;
}
.partner-badge-section.qualified { background:#f0fff4; }
.badge-icon { font-size:28px; }
.badge-info { flex:1; }
.badge-title { font-size:14px; font-weight:900; }
.badge-subtitle { font-size:12px; color:#888; margin-top:2px; }
.badge-status { padding:3px 10px; border-radius:20px; font-size:12px; }
.badge-status.active  { background:#c6f6d5; color:#276749; }
.badge-status.pending { background:#fef9c3; color:#744210; }
.partner-progress { margin-bottom:14px; }
.progress-item { background:#f9fafb; border-radius:10px; padding:12px; }
.progress-header { display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; }
.progress-bar-wrapper { height:8px; }
.progress-bar-track { height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden; }
.progress-bar-fill { height:100%; background:#F7B500; border-radius:4px; transition:width .4s; }
.progress-bar-fill.fill-green { background:#48bb78; }
.partner-dividend-stats { margin-bottom:14px; }
.stats-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.stats-title { font-size:13px; font-weight:900; }
.pool-badge { padding:2px 8px; background:#e9f5fe; color:#2b6cb0; border-radius:20px; font-size:11px; }
.stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.stat-box { background:#f9fafb; border-radius:8px; padding:12px; text-align:center; }
.stat-box .stat-label { font-size:11px; color:#888; }
.stat-box .stat-value { font-size:18px; font-weight:900; color:#1a202c; margin-top:4px; }
.stat-box .stat-value.gold { color:#c05621; }
.info-list { display:flex; flex-direction:column; gap:8px; }

/* ══ 合伙人 ══════════════════════════════════════════════════ */
.hehuo-badge-section {
  display:flex; align-items:center; gap:10px;
  padding:14px; background:#f9fafb; border-radius:12px; margin-bottom:14px;
}
.hehuo-badge-section.qualified { background:#fffbea; }
.hehuo-badge-icon { font-size:28px; }
.hehuo-badge-info { flex:1; }
.hehuo-badge-title { font-size:14px; font-weight:900; }
.hehuo-badge-sub { font-size:12px; color:#888; margin-top:2px; }
.hehuo-badge-status { padding:3px 10px; border-radius:20px; font-size:12px; }
.hehuo-badge-status.active  { background:#fffbea; color:#b7791f; }
.hehuo-badge-status.pending { background:#f5f5f5; color:#888; }
.hehuo-progress-section { margin-bottom:14px; }
.hehuo-progress-title { font-size:13px; font-weight:900; margin-bottom:10px; }
.hehuo-progress-bar-wrap { height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; }
.hehuo-progress-bar { height:100%; background:#F7B500; border-radius:3px; transition:width .4s; }
.hehuo-progress-hint { font-size:12px; color:#888; margin-top:6px; }
.hehuo-rights { margin-top:14px; padding-top:12px; border-top:1px solid #f0f0f0; }
.hehuo-rights-title { font-size:13px; font-weight:900; margin-bottom:8px; }
.hehuo-right-item { font-size:12px; color:#555; padding:3px 0; }

/* ══ 收益/结算 ══════════════════════════════════════════════════ */
.earnings-summary-row { display:flex; justify-content:space-between; font-size:14px; color:#555; margin-bottom:12px; padding:10px; background:#f9fafb; border-radius:8px; }

/* 来源标签：实收 vs 记入余额 */
.src-badge { font-size:10px; padding:1px 6px; border-radius:6px; font-weight:600; margin-left:4px; }
.src-badge.paid    { background:#f0fdf4; color:#16a34a; }
.src-badge.balance { background:#ecfeff; color:#0e7490; }
.task-amount.amount-balance { color:#0e7490; }

/* 平级余额行（提现制） */
.pingji-balance-row { display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:12px 14px; background:linear-gradient(135deg,#ecfeff,#cffafe); border:1px solid #a5f3fc; border-radius:10px; }
.pjb-left { display:flex; align-items:center; gap:10px; }
.pjb-icon { font-size:22px; }
.pjb-title { font-size:13px; font-weight:700; color:#0e7490; }
.pjb-sub { font-size:11px; color:#0891b2; }
.pjb-amount { font-size:20px; font-weight:900; color:#0e7490; }
.gold-text { font-weight:900; color:#c05621; }
.settle-type-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px; }
.settle-type-card { border-radius:10px; padding:12px; text-align:center; }
.jiandian-card { background:#fffbea; }
.bangfu-card   { background:#f0fff4; }
.pingji-card   { background:#ebf8ff; }
.st-icon   { font-size:22px; margin-bottom:4px; }
.st-name   { font-size:11px; color:#666; }
.st-amount { font-size:16px; font-weight:800; color:#1a202c; margin:4px 0; }
.st-count  { font-size:11px; color:#888; }
.settle-total-row { display:flex; justify-content:space-between; font-size:15px; font-weight:600; color:#333; padding:10px; background:#f9fafb; border-radius:8px; }
.task-list { display:flex; flex-direction:column; gap:8px; }
.task-item { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#f9fafb; border-radius:10px; }
.task-left  { display:flex; align-items:center; gap:8px; }
.task-type-badge { padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; flex-shrink:0; }
.task-type-badge.jiandian { background:#fffbea; color:#b7791f; }
.task-type-badge.bangfu   { background:#f0fff4; color:#276749; }
.task-type-badge.pingji   { background:#ebf8ff; color:#2b6cb0; }
.task-label  { font-size:13px; color:#333; }
.task-time   { font-size:11px; color:#aaa; margin-top:2px; }
.task-amount { font-size:15px; font-weight:900; color:#276749; }
.empty-tip   { text-align:center; color:#bbb; padding:30px; font-size:14px; }
</style>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'

const store  = useUserStore()
const activeNav = ref('model')

const navItems = [
  { id: 'model',    icon: '🎯', label: '1+1模型',  color: 'linear-gradient(135deg,#FF6B9D,#C44569)' },
  { id: 'team',     icon: '👥', label: '团队数据',  color: 'linear-gradient(135deg,#07C160,#06AD56)' },
  { id: 'earnings', icon: '📋', label: '收益记录',  color: 'linear-gradient(135deg,#6366F1,#4F46E5)' },
]

const loading    = ref(true)
const refreshing = ref(false)
const shop       = ref(null)
const teamStats  = ref({ directCount: 0, totalCount: 0, totalReceived: 0, recentTasks: [], repurchaseNeed: false })
const copiedCode = ref('')

// 我的资料
const me = computed(() => store.userInfo || {})

// 身份
const isOwner   = computed(() => me.value.role === 'owner')
const isManager = computed(() => me.value.role === 'manager')
const isMember  = computed(() => !isOwner.value && !isManager.value)

const identityIcon    = computed(() => isOwner.value ? '👑' : '👔')
const identityTitle   = computed(() => isOwner.value ? '店主身份' : '店长身份')
const identitySubtitle = computed(() => isOwner.value ? '永久拿见点奖 · 不出局' : '推满1人后出局开店，成为新店主')
const identityBadge   = computed(() => isOwner.value ? '永久店主' : isManager.value ? '等待出局' : '未激活')
const identityBadgeClass = computed(() => isOwner.value ? 'owner' : isManager.value ? 'pending' : 'inactive')

async function loadAll() {
  try {
    const [shopRes, statsRes] = await Promise.allSettled([
      axios.get('/api/shop/my'),
      axios.get('/api/shop/team-stats'),
    ])
    if (shopRes.status === 'fulfilled' && shopRes.value.data.code === 200) {
      shop.value = shopRes.value.data.data
    }
    if (statsRes.status === 'fulfilled' && statsRes.value.data.code === 200) {
      teamStats.value = statsRes.value.data.data
    }
  } catch (e) { /* ignore */ }
}

onMounted(async () => {
  await loadAll()
  loading.value = false
})

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  await loadAll()
  refreshing.value = false
}

async function copyCode(code) {
  if (!code) return
  try { await navigator.clipboard.writeText(code) } catch {
    const el = document.createElement('textarea')
    el.value = code; document.body.appendChild(el); el.select()
    document.execCommand('copy'); document.body.removeChild(el)
  }
  copiedCode.value = code
  setTimeout(() => { copiedCode.value = '' }, 2000)
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<template>
  <div class="team-container">
    <!-- 左侧导航 -->
    <div class="side-nav">
      <div
        v-for="nav in navItems" :key="nav.id"
        :class="['nav-item', { active: activeNav === nav.id }]"
        @click="activeNav = nav.id">
        <div class="nav-icon" :style="{ background: nav.color }">{{ nav.icon }}</div>
        <div class="nav-label">{{ nav.label }}</div>
      </div>
    </div>

    <!-- 右侧内容 -->
    <div class="content-area">

      <!-- 刷新按钮 -->
      <div class="refresh-row">
        <button class="refresh-btn" @click="refresh" :class="{ spinning: refreshing }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/>
          </svg>
          {{ refreshing ? '刷新中...' : '刷新' }}
        </button>
      </div>

      <div v-if="loading" class="loading-tip">加载中...</div>

      <!-- ========== 1+1 模型 ========== -->
      <template v-if="!loading && activeNav === 'model'">

        <!-- 身份卡片 -->
        <div class="identity-card" :class="me.role || 'member'">
          <div class="identity-header">
            <span class="id-icon">{{ identityIcon }}</span>
            <div class="id-info">
              <div class="id-title">{{ identityTitle }}</div>
              <div class="id-sub">{{ identitySubtitle }}</div>
            </div>
            <span class="id-badge" :class="identityBadgeClass">{{ identityBadge }}</span>
          </div>

          <!-- 未激活引导 -->
          <div class="activate-hint" v-if="isMember">
            💡 完成激活后即可进入店铺，开始接收打款
          </div>

          <!-- 出局进度（店长显示） -->
          <div v-if="isManager" class="exit-progress">
            <div class="progress-header">
              <span>📋 出局进度</span>
              <span>{{ teamStats.directCount }}/1 人</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: teamStats.directCount >= 1 ? '100%' : '0%' }"></div>
            </div>
            <div class="progress-hint" :class="teamStats.directCount >= 1 ? 'done' : ''">
              {{ teamStats.directCount >= 1 ? '✅ 已达出局条件，等待系统处理' : '⚠️ 推荐1人后出局开店成为店主' }}
            </div>
          </div>

          <!-- 店主标记 -->
          <div v-if="isOwner" class="owner-done">
            <span>✅</span>
            <span>已出局开店，成为店主，永久拿见点奖</span>
          </div>
        </div>

        <!-- 1+1 模型可视化 -->
        <div class="model-card">
          <div class="model-header">
            <span class="model-title">🏪 1+1 店铺模型</span>
            <button class="my-shop-btn" @click="activeNav='model'">我的店铺</button>
          </div>

          <div class="model-diagram">
            <!-- 店主位 -->
            <div class="position-box owner-box">
              <div class="pos-glow"></div>
              <div class="pos-label">👑 店主</div>
              <div class="pos-avatar">👑</div>
              <div class="pos-user">{{ shop?.owner_no || (isOwner ? me.user_no : '等待开店') }}</div>
              <div class="pos-invite" v-if="shop?.owner_invite_code || (isOwner && me.invite_code)">
                <span>邀请码：{{ shop?.owner_invite_code || me.invite_code }}</span>
                <button class="copy-btn" @click="copyCode(shop?.owner_invite_code || me.invite_code)">
                  {{ copiedCode === (shop?.owner_invite_code || me.invite_code) ? '✅' : '复制' }}
                </button>
              </div>
              <div class="pos-desc">永久拿见点奖 · 不出局</div>
            </div>

            <!-- 连接线 -->
            <div class="connector">
              <div class="line-flow"></div>
              <div class="line-arrow">↓</div>
            </div>

            <!-- 店长位 -->
            <div class="position-box manager-box" :class="{ 'has-user': shop?.tenant_no }">
              <div class="pos-label">👔 店长</div>
              <div class="pos-avatar">{{ shop?.tenant_no ? '👔' : '⏳' }}</div>
              <div class="pos-user">{{ shop?.tenant_no || '空缺中...' }}</div>
              <div class="pos-invite" v-if="shop?.tenant_invite_code">
                <span>邀请码：{{ shop.tenant_invite_code }}</span>
                <button class="copy-btn" @click="copyCode(shop.tenant_invite_code)">
                  {{ copiedCode === shop.tenant_invite_code ? '✅' : '复制' }}
                </button>
              </div>
              <!-- 店长自己的邀请码 -->
              <div class="pos-invite" v-else-if="isManager && me.invite_code">
                <span>我的邀请码：{{ me.invite_code }}</span>
                <button class="copy-btn" @click="copyCode(me.invite_code)">
                  {{ copiedCode === me.invite_code ? '✅' : '复制' }}
                </button>
              </div>
              <div class="pos-desc">{{ shop?.tenant_no ? '推满1人出局开店' : '等待店长加入' }}</div>
            </div>

            <!-- 等待队列 -->
            <div class="waiting-queue" v-if="teamStats.directCount > 0">
              <div class="queue-label">等待队列</div>
              <div class="queue-dots">
                <span v-for="i in Math.min(teamStats.directCount, 5)" :key="i" class="q-dot"></span>
                <span v-if="teamStats.directCount > 5" class="q-more">+{{ teamStats.directCount - 5 }}</span>
              </div>
            </div>
          </div>

          <!-- 模型说明 -->
          <div class="model-tips">
            <div class="tip">💡 一个店 = 店主 + 店长（2人）</div>
            <div class="tip">👑 店主永久拿见点奖（激活金额×20%）</div>
            <div class="tip">👔 店长推满1人后出局开店，成为新店主</div>
          </div>
        </div>

        <!-- 暂无店铺提示 -->
        <div class="no-shop-tip" v-if="!shop && !loading">
          <div class="no-shop-icon">🏪</div>
          <div>完成激活后自动分配店铺</div>
          <router-link to="/activate" class="activate-link">立即激活 →</router-link>
        </div>

      </template>

      <!-- ========== 团队数据 ========== -->
      <div class="team-card" v-if="!loading && activeNav === 'team'">
        <div class="card-title">📊 团队数据</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-val">{{ teamStats.directCount }}</div>
            <div class="stat-lbl">直推人数</div>
          </div>
          <div class="stat-item">
            <div class="stat-val">{{ teamStats.totalCount }}</div>
            <div class="stat-lbl">团队总人数</div>
          </div>
          <div class="stat-item">
            <div class="stat-val gold">{{ teamStats.totalReceived }}</div>
            <div class="stat-lbl">累计收款(元)</div>
          </div>
          <div class="stat-item" v-if="teamStats.repurchaseNeed">
            <div class="stat-val" style="color:#e53e3e">需复投</div>
            <div class="stat-lbl">累计满1500需重新激活</div>
          </div>
        </div>

        <!-- 复投提示 -->
        <div class="repurchase-tip" v-if="teamStats.repurchaseNeed">
          🔄 累计收款已达 1500 元，请重新激活参与新一轮互助
          <router-link to="/activate" class="activate-link">去激活</router-link>
        </div>

        <!-- 我的邀请码 -->
        <div class="my-invite-card">
          <div class="invite-title">我的邀请码</div>
          <div class="invite-row">
            <span class="invite-code-big">{{ me.invite_code || '--' }}</span>
            <button class="copy-btn-big" @click="copyCode(me.invite_code)">
              {{ copiedCode === me.invite_code ? '✅ 已复制' : '📋 复制邀请码' }}
            </button>
          </div>
          <div class="invite-used-tip">已使用 {{ me.invite_used || 0 }}/2 次</div>
        </div>
      </div>

      <!-- ========== 收益记录 ========== -->
      <div class="earnings-card" v-if="!loading && activeNav === 'earnings'">
        <div class="card-title">📋 收款记录</div>
        <div class="earnings-summary">
          <span>累计收款：</span>
          <span class="gold">{{ teamStats.totalReceived }} 元</span>
        </div>
        <div v-if="teamStats.recentTasks?.length" class="task-list">
          <div v-for="(task, i) in teamStats.recentTasks" :key="i" class="task-item">
            <div class="task-left">
              <div class="task-label">{{ task.type_label }}</div>
              <div class="task-time">{{ fmtTime(task.confirmed_at) }}</div>
            </div>
            <div class="task-amount">+{{ task.amount }} 元</div>
          </div>
        </div>
        <div v-else class="empty-tip">暂无收款记录</div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.team-container {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

/* ——— 左侧导航 ——— */
.side-nav {
  width: 68px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 4px;
  box-shadow: 2px 0 8px rgba(0,0,0,.06);
  overflow-y: auto;
  flex-shrink: 0;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 10px;
  cursor: pointer;
  width: 58px;
  transition: background .2s;
}
.nav-item:hover { background: #f0f0f0; }
.nav-item.active { background: #fff0f5; }
.nav-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
}
.nav-item.active .nav-icon { transform: scale(1.1); box-shadow: 0 2px 8px rgba(0,0,0,.2); }
.nav-label { font-size: 10px; color: #666; text-align: center; }
.nav-item.active .nav-label { color: #c44569; font-weight: 600; }

/* ——— 右侧内容 ——— */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.loading-tip { text-align: center; padding: 40px; color: #999; }

/* 刷新按钮 */
.refresh-row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.refresh-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 12px; border: 1px solid #e2e8f0;
  border-radius: 20px; background: #fff; color: #666;
  font-size: 12px; cursor: pointer;
}
.refresh-btn.spinning svg { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ——— 身份卡片 ——— */
.identity-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid #ccc;
}
.identity-card.owner  { border-left-color: #f0a500; }
.identity-card.manager { border-left-color: #48bb78; }
.identity-header { display: flex; align-items: center; gap: 10px; }
.id-icon { font-size: 28px; }
.id-info { flex: 1; }
.id-title { font-weight: 700; font-size: 15px; }
.id-sub { font-size: 12px; color: #999; margin-top: 2px; }
.id-badge {
  padding: 3px 10px; border-radius: 20px; font-size: 12px;
}
.id-badge.owner   { background: #fffbea; color: #b7791f; }
.id-badge.pending { background: #f0fff4; color: #276749; }
.id-badge.inactive { background: #f5f5f5; color: #999; }

.activate-hint {
  margin-top: 12px; padding: 8px 12px;
  background: #fff8e6; border-radius: 8px;
  font-size: 13px; color: #975a16;
}
.exit-progress { margin-top: 12px; }
.progress-header { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
.progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: #48bb78; border-radius: 3px; transition: width .4s; }
.progress-hint { font-size: 12px; color: #666; margin-top: 5px; }
.progress-hint.done { color: #276749; font-weight: 600; }
.owner-done { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; color: #276749; }

/* ——— 模型卡片 ——— */
.model-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}
.model-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.model-title { font-weight: 700; font-size: 16px; }
.my-shop-btn {
  padding: 4px 12px; border: 1px solid #48bb78;
  border-radius: 20px; background: #f0fff4; color: #276749;
  font-size: 12px; cursor: pointer;
}

/* 模型图 */
.model-diagram { display: flex; flex-direction: column; align-items: center; gap: 0; }

.position-box {
  width: 100%; max-width: 280px;
  border-radius: 14px; padding: 16px; text-align: center;
  position: relative; overflow: hidden;
}
.owner-box {
  background: linear-gradient(135deg,#fffbea,#fef3c7);
  border: 2px solid #f0a500;
}
.manager-box {
  background: #f0fff4;
  border: 2px dashed #48bb78;
}
.manager-box.has-user { border-style: solid; }
.pos-glow {
  position: absolute; top: -20px; left: 50%;
  transform: translateX(-50%);
  width: 80px; height: 40px;
  background: radial-gradient(#f6e05e88, transparent);
}
.pos-label { font-weight: 700; font-size: 14px; margin-bottom: 8px; }
.pos-avatar { font-size: 42px; margin-bottom: 6px; }
.pos-user { font-size: 22px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px; }
.pos-invite { display: flex; align-items: center; gap: 6px; justify-content: center; font-size: 13px; }
.pos-desc { font-size: 12px; color: #999; margin-top: 6px; }

.copy-btn {
  padding: 2px 10px; border: 1px solid #f0a500;
  border-radius: 20px; background: #fff; color: #b7791f;
  font-size: 12px; cursor: pointer;
}
.manager-box .copy-btn { border-color: #48bb78; color: #276749; }

/* 连接线 */
.connector { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; }
.line-flow { width: 2px; height: 20px; background: linear-gradient(#f0a500,#48bb78); }
.line-arrow { font-size: 16px; color: #f0a500; }

/* 等待队列 */
.waiting-queue { margin-top: 12px; text-align: center; }
.queue-label { font-size: 12px; color: #999; margin-bottom: 6px; }
.queue-dots { display: flex; gap: 6px; justify-content: center; align-items: center; }
.q-dot { width: 10px; height: 10px; border-radius: 50%; background: #f0a500; }
.q-more { font-size: 12px; color: #f0a500; font-weight: 600; }

/* 模型说明 */
.model-tips { margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
.tip { font-size: 13px; color: #666; padding: 4px 0; }

/* 无店铺 */
.no-shop-tip {
  text-align: center; padding: 32px 16px;
  background: #fff; border-radius: 16px;
}
.no-shop-icon { font-size: 48px; margin-bottom: 12px; }
.activate-link {
  display: inline-block; margin-top: 12px;
  padding: 8px 20px; background: #f0a500; color: #fff;
  border-radius: 20px; font-size: 14px; text-decoration: none;
}

/* ——— 团队数据 ——— */
.team-card, .earnings-card {
  background: #fff; border-radius: 16px; padding: 16px;
}
.card-title { font-weight: 700; font-size: 16px; margin-bottom: 14px; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.stat-item { background: #f9fafb; border-radius: 10px; padding: 14px; text-align: center; }
.stat-val { font-size: 22px; font-weight: 800; color: #1a202c; }
.stat-val.gold { color: #c05621; }
.stat-lbl { font-size: 12px; color: #888; margin-top: 4px; }

.repurchase-tip {
  background: #fff5f5; border: 1px solid #feb2b2;
  border-radius: 10px; padding: 10px 14px;
  font-size: 13px; color: #c53030; margin-bottom: 14px;
  display: flex; align-items: center; justify-content: space-between;
}

.my-invite-card {
  background: #fffbea; border-radius: 10px; padding: 14px; text-align: center;
}
.invite-title { font-size: 13px; color: #666; margin-bottom: 8px; }
.invite-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
.invite-code-big { font-size: 24px; font-weight: 800; letter-spacing: 3px; color: #b7791f; }
.copy-btn-big {
  padding: 6px 14px; background: #f0a500; color: #fff;
  border: none; border-radius: 20px; font-size: 13px; cursor: pointer;
}
.invite-used-tip { font-size: 12px; color: #999; margin-top: 6px; }

/* ——— 收益记录 ——— */
.earnings-summary { font-size: 15px; color: #444; margin-bottom: 12px; }
.gold { color: #c05621; font-weight: 700; }
.task-list { display: flex; flex-direction: column; gap: 8px; }
.task-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; background: #f9fafb; border-radius: 10px;
}
.task-label { font-size: 14px; color: #333; }
.task-time { font-size: 11px; color: #aaa; margin-top: 3px; }
.task-amount { font-weight: 700; color: #276749; font-size: 15px; }
.empty-tip { text-align: center; color: #bbb; padding: 30px; }
</style>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'

const router = useRouter()
const store  = useUserStore()

// ── 步骤 ──────────────────────────────────────────────────────
// 1: 欢迎/说明  2: 填邀请码+安全问题  3: 等待激活订单  4: 支付清单
const step      = ref(1)
const loading   = ref(false)
const error     = ref('')

// Step 2
const inviteCode    = ref('')
const securityAnswer = ref('')
const showSecTip    = ref(false)

// Step 4
const order = ref(null)

onMounted(async () => {
  // 已绑定推荐人 → 跳到激活步骤
  if (store.hasReferrer && !store.isActivated) {
    step.value = 3
    await loadOrder()
  } else if (store.isActivated) {
    router.replace('/myshop')
  }
})

async function submitParticipate() {
  if (!inviteCode.value.trim()) { error.value = '请输入邀请码'; return }
  if (!securityAnswer.value.trim() || securityAnswer.value.trim().length < 2) {
    error.value = '安全答案至少填2位'; return
  }
  loading.value = true; error.value = ''
  try {
    const res = await axios.post('/api/auth/participate', {
      inviteCode:     inviteCode.value.trim().toUpperCase(),
      securityAnswer: securityAnswer.value.trim(),
    })
    store.setUserInfo(res.data.data.user)
    step.value = 3
    await loadOrder()
  } catch (e) {
    error.value = e.response?.data?.message || '提交失败'
  } finally {
    loading.value = false
  }
}

async function loadOrder() {
  try {
    // 创建或获取激活订单
    const res = await axios.post('/api/activate/create')
    order.value = res.data.data
    if (order.value) step.value = 4
  } catch (e) {
    error.value = e.response?.data?.message || '获取激活订单失败'
  }
}

function getTaskMeta(type) {
  if (type === 'jian_dian')      return { label: '见点奖', color: '#f0a500', icon: '👑', desc: '给老板' }
  if (type === 'bang_fu')        return { label: '帮扶奖', color: '#48bb78', icon: '🤝', desc: '给直推老板' }
  if (type === 'bang_fu_admin')  return { label: '帮扶预留', color: '#a0aec0', icon: '🏦', desc: '管理员代收' }
  return { label: `平级第${type.replace('ping_ji_','')}层`, color: '#4299e1', icon: '📊', desc: '平级奖' }
}

function statusText(s) {
  return { pending:'待打款', screenshot_uploaded:'截图已上传', confirmed:'✅已确认', timeout:'超时', ai_review:'审核中' }[s] || s
}

const pendingCount   = () => (order.value?.tasks || []).filter(t => t.status === 'pending').length
const confirmedCount = () => (order.value?.tasks || []).filter(t => t.status === 'confirmed').length
const totalCount     = () => (order.value?.tasks || []).length
const allDone        = () => totalCount() > 0 && confirmedCount() === totalCount()
</script>

<template>
  <div class="participate-page">

    <!-- ── 顶部 ── -->
    <div class="top-bar">
      <button class="back-btn" @click="router.back()">←</button>
      <span class="top-title">🤝 自愿参与</span>
      <div class="step-dots">
        <span v-for="i in 4" :key="i" :class="['dot', { active: step >= i, done: step > i }]"></span>
      </div>
    </div>

    <!-- ════════ Step 1: 欢迎说明 ════════ -->
    <div v-if="step === 1" class="step-wrap">
      <div class="hero-section">
        <div class="hero-icon">🏪</div>
        <h1 class="hero-title">1+1 点对点互助</h1>
        <p class="hero-sub">自愿参与 · 直接打款 · 全程透明</p>
      </div>

      <!-- 总金额展示 -->
      <div class="amount-card">
        <div class="amount-label">参与总金额</div>
        <div class="amount-big">¥230</div>
        <div class="amount-sub">全部点对点直接打款给真实用户</div>
      </div>

      <!-- 分配说明 -->
      <div class="breakdown-card">
        <div class="breakdown-title">💡 资金分配明细</div>
        <div class="breakdown-item">
          <div class="bi-left">
            <span class="bi-icon">👑</span>
            <div>
              <div class="bi-name">见点奖</div>
              <div class="bi-desc">给邀请你的老板</div>
            </div>
          </div>
          <div class="bi-amount">¥70</div>
        </div>
        <div class="breakdown-item">
          <div class="bi-left">
            <span class="bi-icon">🤝</span>
            <div>
              <div class="bi-name">帮扶奖</div>
              <div class="bi-desc">给老板的2位出局直推</div>
            </div>
          </div>
          <div class="bi-amount">¥30 × 2</div>
        </div>
        <div class="breakdown-item">
          <div class="bi-left">
            <span class="bi-icon">📊</span>
            <div>
              <div class="bi-name">平级奖</div>
              <div class="bi-desc">邀请链向上10代</div>
            </div>
          </div>
          <div class="bi-amount">¥10 × 10</div>
        </div>
        <div class="breakdown-total">
          <span>合计</span>
          <span class="total-num">¥230</span>
        </div>
      </div>

      <!-- 流程步骤 -->
      <div class="flow-card">
        <div class="flow-title">📋 参与流程</div>
        <div class="flow-step" v-for="(s, i) in [
          { icon:'🔑', text:'填写邀请码 + 设置安全问题' },
          { icon:'📋', text:'系统自动生成收款清单' },
          { icon:'📱', text:'逐笔扫码打款' },
          { icon:'📷', text:'上传付款截图' },
          { icon:'✅', text:'对方确认 → 激活成功' },
          { icon:'🎉', text:'获得专属邀请码，开始收款' },
        ]" :key="i">
          <div class="flow-num">{{ i+1 }}</div>
          <span class="flow-icon">{{ s.icon }}</span>
          <span class="flow-text">{{ s.text }}</span>
        </div>
      </div>

      <button class="btn-next" @click="step = 2">
        我已了解，立即参与 →
      </button>
    </div>

    <!-- ════════ Step 2: 填邀请码 + 安全问题 ════════ -->
    <div v-else-if="step === 2" class="step-wrap">
      <div class="step-header">
        <div class="step-num-big">02</div>
        <h2 class="step-title">填写邀请码</h2>
        <p class="step-sub">需要有人邀请才能参与，确保互助链条真实</p>
      </div>

      <!-- 邀请码输入 -->
      <div class="input-section">
        <div class="input-label">🔑 邀请码</div>
        <input
          v-model="inviteCode"
          type="text"
          placeholder="请输入6位邀请码（如：ABC123）"
          class="big-input"
          maxlength="6"
          @input="inviteCode = inviteCode.toUpperCase()"
        />

        <!-- 安全问题 -->
        <div class="input-label" style="margin-top:20px">
          🔒 设置安全问题
          <button class="tip-btn" @click="showSecTip = !showSecTip">?</button>
        </div>
        <div v-if="showSecTip" class="sec-tip">
          安全问题用于换设备时找回账号。建议填写只有自己知道的信息，如身份证后6位、手机后4位等。请牢记答案！
        </div>
        <div class="sec-question-box">
          <div class="sec-q">身份证后6位（或自定义密保）</div>
          <input
            v-model="securityAnswer"
            type="text"
            placeholder="请输入答案（至少2位）"
            class="big-input"
          />
        </div>

        <p v-if="error" class="error-msg">⚠️ {{ error }}</p>

        <button class="btn-next" :disabled="loading" @click="submitParticipate">
          {{ loading ? '提交中...' : '确认参与，查看收款清单 →' }}
        </button>

        <div class="my-id-tip">
          你的ID：<strong>{{ store.userId }}</strong>
          <span>（请记好，换设备时用于找回）</span>
        </div>
      </div>
    </div>

    <!-- ════════ Step 3: 生成订单中 ════════ -->
    <div v-else-if="step === 3" class="step-wrap center">
      <div class="loading-anim">
        <div class="spinner"></div>
        <p class="loading-text">正在按模型生成收款清单...</p>
        <p class="loading-sub">系统自动匹配，全程透明</p>
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </div>

    <!-- ════════ Step 4: 支付清单 ════════ -->
    <div v-else-if="step === 4 && order" class="step-wrap">

      <!-- 完成状态 -->
      <div v-if="allDone()" class="success-banner">
        <div class="success-icon">🎉</div>
        <div class="success-title">全部付款完成！</div>
        <div class="success-sub">激活成功，你已获得专属邀请码</div>
        <div class="invite-code-big">{{ store.inviteCode }}</div>
        <div class="invite-code-hint">把这个邀请码分享给朋友，开始收款</div>
        <button class="btn-next" @click="router.push('/myshop')">进入我的店铺 →</button>
      </div>

      <template v-else>
        <!-- 进度头部 -->
        <div class="payment-header">
          <div class="payment-progress-info">
            <span class="confirmed-count">{{ confirmedCount() }}</span>
            <span class="total-count"> / {{ totalCount() }} 笔已确认</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill"
              :style="{ width: totalCount() ? (confirmedCount()/totalCount()*100) + '%' : '0%' }">
            </div>
          </div>
          <div class="progress-hint">
            {{ pendingCount() > 0 ? `还有 ${pendingCount()} 笔待打款` : '等待对方确认中...' }}
          </div>
        </div>

        <!-- 支付任务列表 -->
        <div class="task-list">
          <div
            v-for="(task, idx) in order.tasks"
            :key="task.id"
            class="task-card"
            :class="[task.status, { clickable: task.status === 'pending' }]"
            @click="task.status === 'pending' && router.push(`/payment/${task.id}`)"
          >
            <!-- 序号 -->
            <div class="task-index" :class="task.status">
              <span v-if="task.status === 'confirmed'">✓</span>
              <span v-else>{{ idx + 1 }}</span>
            </div>

            <!-- 内容 -->
            <div class="task-body">
              <div class="task-top">
                <span class="task-badge"
                  :style="{ background: getTaskMeta(task.type).color + '20', color: getTaskMeta(task.type).color }">
                  {{ getTaskMeta(task.type).icon }} {{ getTaskMeta(task.type).label }}
                </span>
                <span class="task-amount">¥{{ task.amount }}</span>
              </div>
              <div class="task-receiver">
                收款方：#{{ task.receiver_no }}
                <span class="task-desc">{{ getTaskMeta(task.type).desc }}</span>
              </div>
              <div class="task-status-row">
                <span :class="['task-status-badge', task.status]">
                  {{ statusText(task.status) }}
                </span>
                <span v-if="task.status === 'pending'" class="task-action">点击打款 →</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 提示 -->
        <div class="payment-tips">
          <div class="tip-item">💡 按顺序逐笔打款，截图上传后等待对方确认</div>
          <div class="tip-item">⏰ 上传截图后30分钟内对方需确认，超时自动介入</div>
          <div class="tip-item">🔒 所有资金点对点直达，平台不经手</div>
        </div>
      </template>
    </div>

  </div>
</template>

<style scoped>
.participate-page { min-height: 100vh; background: #f5f7fa; padding-bottom: 40px; }

/* ── 顶部 ── */
.top-bar { display:flex; align-items:center; gap:10px; padding:14px 16px; background:#fff; border-bottom:1px solid #eee; position:sticky; top:0; z-index:10; }
.back-btn { background:none; border:none; font-size:20px; cursor:pointer; color:#666; }
.top-title { font-size:16px; font-weight:700; flex:1; }
.step-dots { display:flex; gap:6px; }
.dot { width:8px; height:8px; border-radius:50%; background:#e0e0e0; transition:all .3s; }
.dot.active { background:#f0a500; }
.dot.done { background:#07C160; }

/* ── 通用 ── */
.step-wrap { padding:20px 16px; }
.center { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; }

/* ── Step 1 英雄区 ── */
.hero-section { text-align:center; padding:20px 0 16px; }
.hero-icon { font-size:56px; margin-bottom:10px; }
.hero-title { font-size:26px; font-weight:800; color:#1a1a1a; margin-bottom:4px; }
.hero-sub { font-size:14px; color:#999; }

.amount-card { background:linear-gradient(135deg,#f0a500,#ffc700); border-radius:20px; padding:24px; text-align:center; margin:16px 0; box-shadow:0 8px 24px rgba(240,165,0,.3); }
.amount-label { font-size:13px; color:rgba(255,255,255,.8); margin-bottom:4px; }
.amount-big { font-size:48px; font-weight:800; color:#fff; line-height:1; }
.amount-sub { font-size:12px; color:rgba(255,255,255,.8); margin-top:6px; }

.breakdown-card { background:#fff; border-radius:16px; padding:16px; margin-bottom:14px; }
.breakdown-title { font-size:14px; font-weight:700; margin-bottom:14px; }
.breakdown-item { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f5f5f5; }
.bi-left { display:flex; align-items:center; gap:10px; }
.bi-icon { font-size:20px; width:36px; height:36px; background:#f9f9f9; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.bi-name { font-size:14px; font-weight:600; color:#333; }
.bi-desc { font-size:11px; color:#999; margin-top:1px; }
.bi-amount { font-size:16px; font-weight:700; color:#f0a500; }
.breakdown-total { display:flex; justify-content:space-between; padding-top:12px; font-size:15px; font-weight:700; }
.total-num { color:#f0a500; font-size:20px; }

.flow-card { background:#fff; border-radius:16px; padding:16px; margin-bottom:20px; }
.flow-title { font-size:14px; font-weight:700; margin-bottom:12px; }
.flow-step { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f9f9f9; }
.flow-num { width:22px; height:22px; background:#f0a500; color:#fff; border-radius:50%; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.flow-icon { font-size:16px; }
.flow-text { font-size:13px; color:#444; }

/* ── Step 2 ── */
.step-header { text-align:center; padding:16px 0 20px; }
.step-num-big { font-size:48px; font-weight:800; color:#f0a500; opacity:.3; line-height:1; }
.step-title { font-size:22px; font-weight:700; margin-bottom:4px; }
.step-sub { font-size:13px; color:#999; }

.input-section { background:#fff; border-radius:16px; padding:20px; }
.input-label { font-size:13px; font-weight:600; color:#555; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
.big-input { width:100%; padding:16px; border:2px solid #e0e0e0; border-radius:12px; font-size:18px; font-weight:600; outline:none; letter-spacing:2px; transition:border-color .2s; box-sizing:border-box; }
.big-input:focus { border-color:#f0a500; }
.tip-btn { margin-left:4px; width:18px; height:18px; border-radius:50%; border:1px solid #999; background:none; font-size:11px; color:#999; cursor:pointer; }
.sec-tip { background:#fffbe6; border:1px solid #ffe58f; border-radius:8px; padding:10px 12px; font-size:12px; color:#7c4a00; margin-bottom:10px; line-height:1.6; }
.sec-question-box { background:#f9f9f9; border-radius:12px; padding:12px; margin-top:8px; }
.sec-q { font-size:12px; color:#999; margin-bottom:8px; }
.my-id-tip { text-align:center; font-size:12px; color:#999; margin-top:16px; line-height:1.6; }
.my-id-tip strong { color:#333; font-size:14px; }

/* ── Step 3 loading ── */
.loading-anim { text-align:center; }
.spinner { width:48px; height:48px; border:4px solid #f0f0f0; border-top-color:#f0a500; border-radius:50%; animation:spin .8s linear infinite; margin:0 auto 20px; }
@keyframes spin { to { transform:rotate(360deg); } }
.loading-text { font-size:16px; font-weight:600; color:#333; margin-bottom:6px; }
.loading-sub { font-size:13px; color:#999; }

/* ── Step 4 ── */
.success-banner { text-align:center; padding:30px 0; }
.success-icon { font-size:64px; margin-bottom:12px; }
.success-title { font-size:24px; font-weight:800; color:#07C160; margin-bottom:6px; }
.success-sub { font-size:14px; color:#666; margin-bottom:20px; }
.invite-code-big { font-size:32px; font-weight:800; color:#f0a500; letter-spacing:4px; background:#fffbe6; border:2px dashed #f0a500; border-radius:12px; padding:14px 28px; display:inline-block; margin-bottom:8px; }
.invite-code-hint { font-size:12px; color:#999; margin-bottom:24px; }

.payment-header { background:#fff; border-radius:16px; padding:16px; margin-bottom:14px; }
.payment-progress-info { display:flex; align-items:baseline; margin-bottom:8px; }
.confirmed-count { font-size:32px; font-weight:800; color:#f0a500; }
.total-count { font-size:14px; color:#999; margin-left:4px; }
.progress-bar-wrap { background:#f0f0f0; border-radius:10px; height:10px; overflow:hidden; margin-bottom:6px; }
.progress-bar-fill { height:100%; background:linear-gradient(90deg,#f0a500,#ffc700); border-radius:10px; transition:width .5s ease; }
.progress-hint { font-size:13px; color:#666; }

.task-list { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
.task-card { background:#fff; border-radius:14px; padding:14px; display:flex; align-items:flex-start; gap:12px; border:2px solid transparent; transition:all .2s; }
.task-card.clickable { cursor:pointer; border-color:#f0a50030; }
.task-card.clickable:active { transform:scale(.98); }
.task-card.confirmed { opacity:.6; }
.task-index { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; }
.task-index.pending { background:#fff8e1; color:#f0a500; border:2px solid #f0a500; }
.task-index.screenshot_uploaded { background:#e3f0ff; color:#1976D2; border:2px solid #1976D2; }
.task-index.confirmed { background:#e6f9ee; color:#07C160; border:2px solid #07C160; }
.task-body { flex:1; }
.task-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.task-badge { padding:3px 8px; border-radius:8px; font-size:12px; font-weight:600; }
.task-amount { font-size:20px; font-weight:800; color:#333; }
.task-receiver { font-size:13px; color:#666; margin-bottom:6px; }
.task-desc { color:#aaa; margin-left:6px; font-size:11px; }
.task-status-row { display:flex; justify-content:space-between; align-items:center; }
.task-status-badge { font-size:12px; padding:2px 8px; border-radius:6px; }
.task-status-badge.pending { background:#fff8e1; color:#b7791f; }
.task-status-badge.screenshot_uploaded { background:#e3f0ff; color:#1976D2; }
.task-status-badge.confirmed { background:#e6f9ee; color:#07C160; }
.task-action { font-size:13px; color:#f0a500; font-weight:600; }

.payment-tips { background:#fff; border-radius:14px; padding:14px; }
.tip-item { font-size:12px; color:#888; padding:4px 0; line-height:1.6; }

/* ── 通用按钮 ── */
.btn-next { width:100%; padding:16px; background:linear-gradient(135deg,#f0a500,#e09000); color:#fff; border:none; border-radius:14px; font-size:16px; font-weight:700; cursor:pointer; margin-top:20px; box-shadow:0 6px 20px rgba(240,165,0,.35); transition:all .2s; letter-spacing:.5px; }
.btn-next:disabled { background:#ddd; color:#aaa; box-shadow:none; }
.btn-next:not(:disabled):active { transform:scale(.98); }
.error-msg { background:#fff5f5; border:1px solid #fed7d7; color:#c53030; border-radius:8px; padding:10px 12px; font-size:13px; margin-top:12px; }
</style>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading   = ref(false)
const joining   = ref(false)
const status    = ref(null)
const tasks     = ref({ payTasks: [], receiveTasks: [] })
const error     = ref('')
const activeTab = ref('home') // home | tasks | history

onMounted(() => {
  loadStatus()
  loadTasks()
})

async function loadStatus() {
  try {
    const res = await axios.get('/api/subsidy/status')
    status.value = res.data.data
  } catch (e) {
    error.value = e.response?.data?.message || '加载失败'
  }
}

async function loadTasks() {
  try {
    const res = await axios.get('/api/subsidy/tasks')
    tasks.value = res.data.data
  } catch {}
}

async function joinQueue() {
  joining.value = true
  error.value = ''
  try {
    const res = await axios.post('/api/subsidy/join')
    alert(res.data.data.message)
    await loadStatus()
    await loadTasks()
    activeTab.value = 'tasks'
  } catch (e) {
    error.value = e.response?.data?.message || '加入失败'
  } finally {
    joining.value = false
  }
}

async function uploadScreenshot(taskId) {
  const url = prompt('请输入截图URL（上传后粘贴链接）：')
  if (!url) return
  try {
    await axios.post(`/api/subsidy/task/${taskId}/screenshot`, { screenshotUrl: url })
    alert('截图已上传，等待收款方确认')
    await loadTasks()
  } catch (e) {
    alert(e.response?.data?.message || '上传失败')
  }
}

async function confirmPayment(taskId) {
  if (!confirm('确认已收到30元？')) return
  try {
    await axios.post(`/api/subsidy/task/${taskId}/confirm`)
    alert('已确认收款 ✅')
    await loadStatus()
    await loadTasks()
  } catch (e) {
    alert(e.response?.data?.message || '操作失败')
  }
}

const statusLabel = {
  paying:    '付款中',
  waiting:   '等待收款',
  completed: '已完成',
}
const statusColor = {
  paying:    '#f0a500',
  waiting:   '#1976D2',
  completed: '#07C160',
}
</script>

<template>
  <div class="page">
    <!-- 顶部标题 -->
    <div class="header">
      <h2 class="title">💰 生活补贴</h2>
      <p class="subtitle">点对点互助 · 60进90出 · 净赚30元</p>
    </div>

    <!-- Tab 导航 -->
    <div class="tabs">
      <button :class="['tab', activeTab==='home'?'active':'']" @click="activeTab='home'">首页</button>
      <button :class="['tab', activeTab==='tasks'?'active':'']" @click="activeTab='tasks'">
        我的任务
        <span v-if="tasks.payTasks.length+tasks.receiveTasks.length > 0" class="badge">
          {{ tasks.payTasks.length + tasks.receiveTasks.length }}
        </span>
      </button>
      <button :class="['tab', activeTab==='history'?'active':'']" @click="activeTab='history'">历史记录</button>
    </div>

    <!-- 首页 -->
    <template v-if="activeTab==='home'">
      <!-- 规则卡片 -->
      <div class="rule-card">
        <div class="rule-row">
          <div class="rule-item pay">
            <div class="rule-icon">💸</div>
            <div class="rule-num">60元</div>
            <div class="rule-desc">付出（2×30）</div>
          </div>
          <div class="rule-arrow">→</div>
          <div class="rule-item receive">
            <div class="rule-icon">💰</div>
            <div class="rule-num">90元</div>
            <div class="rule-desc">回收（3×30）</div>
          </div>
          <div class="rule-arrow">→</div>
          <div class="rule-item profit">
            <div class="rule-icon">🎉</div>
            <div class="rule-num">+30元</div>
            <div class="rule-desc">净赚</div>
          </div>
        </div>
      </div>

      <!-- 权限说明 -->
      <div class="perm-card">
        <div class="perm-title">参与资格</div>
        <div class="perm-item">
          <span class="perm-icon">👑</span>
          <span>老板（已出局）：每天 <b>1次</b></span>
        </div>
        <div class="perm-item">
          <span class="perm-icon">👑👑</span>
          <span>直推2个老板：每天 <b>3次</b></span>
        </div>
      </div>

      <!-- 队列状态 -->
      <div v-if="status" class="queue-card">
        <div class="queue-title">当前队列</div>
        <div class="queue-num">{{ status.queueWaiting }}</div>
        <div class="queue-desc">人等待中 / 满{{ status.queueThreshold }}人自动匹配</div>
        <div class="queue-bar-wrap">
          <div class="queue-bar" :style="{ width: Math.min((status.queueWaiting/status.queueThreshold)*100, 100) + '%' }"></div>
        </div>
      </div>

      <!-- 当前进行中 -->
      <div v-if="status?.active" class="active-card">
        <div class="active-title">进行中</div>
        <div class="active-status" :style="{ color: statusColor[status.active.status] }">
          {{ statusLabel[status.active.status] }}
        </div>
        <div class="active-info">
          已付：{{ status.active.paid_count }}/2笔 &nbsp;|&nbsp;
          已收：{{ status.active.received_count }}/3笔
        </div>
        <button class="btn-main" @click="activeTab='tasks'">查看任务</button>
      </div>

      <!-- 加入按钮 -->
      <div v-else class="join-wrap">
        <p v-if="error" class="err-msg">{{ error }}</p>
        <div v-if="status" class="today-info">今日已参与：{{ status.todayCount }} 次</div>
        <button class="btn-join" :disabled="joining" @click="joinQueue">
          {{ joining ? '加入中...' : '🚀 立即参与（60元入场）' }}
        </button>
        <p class="join-tip">付60元给2人，等收90元（3×30）</p>
      </div>
    </template>

    <!-- 我的任务 -->
    <template v-else-if="activeTab==='tasks'">
      <!-- 待付款 -->
      <div class="section-title">待付款 ({{ tasks.payTasks.length }})</div>
      <div v-if="!tasks.payTasks.length" class="empty">暂无待付款任务</div>
      <div v-for="t in tasks.payTasks" :key="t.id" class="task-card pay-card">
        <div class="task-header">
          <span class="task-type">付款任务</span>
          <span class="task-amount">¥{{ t.amount }}</span>
        </div>
        <div class="task-info">收款方：{{ t.receiver?.user_no || '?' }}</div>
        <div v-if="t.receiver?.wechat_qr" class="task-qr">
          <img :src="t.receiver.wechat_qr" class="qr-img" />
          <span class="qr-label">微信收款码</span>
        </div>
        <div v-if="t.receiver?.alipay_qr" class="task-qr">
          <img :src="t.receiver.alipay_qr" class="qr-img" />
          <span class="qr-label">支付宝收款码</span>
        </div>
        <div class="task-status" :class="t.status">
          {{ t.status === 'pending' ? '⏳ 待上传截图' : '✅ 截图已上传，等待确认' }}
        </div>
        <button v-if="t.status === 'pending'" class="btn-upload" @click="uploadScreenshot(t.id)">
          📷 上传付款截图
        </button>
      </div>

      <!-- 待确认收款 -->
      <div class="section-title" style="margin-top:20px">待确认收款 ({{ tasks.receiveTasks.length }})</div>
      <div v-if="!tasks.receiveTasks.length" class="empty">暂无待确认收款</div>
      <div v-for="t in tasks.receiveTasks" :key="t.id" class="task-card receive-card">
        <div class="task-header">
          <span class="task-type receive">收款确认</span>
          <span class="task-amount receive">+¥{{ t.amount }}</span>
        </div>
        <div class="task-info">付款方：{{ t.payer?.user_no || '?' }}</div>
        <div v-if="t.screenshot_url" class="task-screenshot">
          <img :src="t.screenshot_url" class="screenshot-img" @click="window.open(t.screenshot_url)" />
          <span class="screenshot-label">付款截图（点击放大）</span>
        </div>
        <button class="btn-confirm" @click="confirmPayment(t.id)">✅ 确认已收到30元</button>
      </div>
    </template>

    <!-- 历史记录 -->
    <template v-else-if="activeTab==='history'">
      <div v-if="!status?.history?.length" class="empty">暂无历史记录</div>
      <div v-for="h in status?.history" :key="h.id" class="history-card">
        <div class="history-top">
          <span class="history-status completed">✅ 已完成</span>
          <span class="history-date">{{ h.created_at?.slice(0,10) }}</span>
        </div>
        <div class="history-info">
          付出 {{ h.paid_count * 30 }}元 → 收回 {{ h.received_count * 30 }}元
          <span class="history-profit">净赚 +{{ h.received_count * 30 - h.paid_count * 30 }}元</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 16px; padding-bottom: 80px; min-height: 100vh; background: #f5f7fa; }

.header { text-align: center; padding: 16px 0 8px; }
.title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
.subtitle { font-size: 13px; color: #999; margin: 0; }

.tabs { display: flex; gap: 8px; margin: 12px 0; background: #fff; border-radius: 12px; padding: 6px; }
.tab { flex: 1; padding: 8px 0; border: none; background: transparent; border-radius: 8px; font-size: 13px; color: #888; cursor: pointer; position: relative; }
.tab.active { background: #f0a500; color: #fff; font-weight: 700; }
.badge { position: absolute; top: 2px; right: 8px; background: #e53e3e; color: #fff; font-size: 10px; border-radius: 10px; padding: 1px 5px; }

.rule-card { background: #fff; border-radius: 16px; padding: 20px; margin-bottom: 12px; }
.rule-row { display: flex; align-items: center; justify-content: space-around; }
.rule-item { text-align: center; }
.rule-icon { font-size: 24px; margin-bottom: 4px; }
.rule-num { font-size: 18px; font-weight: 700; }
.rule-num { color: #333; }
.rule-item.pay .rule-num { color: #e53e3e; }
.rule-item.receive .rule-num { color: #1976D2; }
.rule-item.profit .rule-num { color: #07C160; }
.rule-desc { font-size: 11px; color: #999; margin-top: 2px; }
.rule-arrow { font-size: 20px; color: #ccc; }

.perm-card { background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
.perm-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
.perm-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #555; margin-bottom: 6px; }
.perm-icon { font-size: 16px; }

.queue-card { background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 12px; text-align: center; }
.queue-title { font-size: 13px; color: #999; margin-bottom: 4px; }
.queue-num { font-size: 36px; font-weight: 700; color: #f0a500; }
.queue-desc { font-size: 12px; color: #999; margin-bottom: 10px; }
.queue-bar-wrap { background: #f0f0f0; border-radius: 10px; height: 8px; overflow: hidden; }
.queue-bar { height: 100%; background: linear-gradient(90deg, #f0a500, #ffc700); border-radius: 10px; transition: width .3s; }

.active-card { background: #fff3cd; border: 1px solid #f0a500; border-radius: 16px; padding: 16px; margin-bottom: 12px; text-align: center; }
.active-title { font-size: 13px; color: #8B6000; margin-bottom: 4px; }
.active-status { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
.active-info { font-size: 13px; color: #666; margin-bottom: 12px; }

.join-wrap { text-align: center; padding: 8px 0; }
.today-info { font-size: 12px; color: #999; margin-bottom: 8px; }
.btn-join { width: 100%; padding: 16px; background: linear-gradient(135deg, #f0a500, #ffc700); color: #3a2800; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(240,165,0,.3); }
.btn-join:disabled { background: #eee; color: #bbb; box-shadow: none; }
.join-tip { font-size: 12px; color: #999; margin-top: 8px; }
.err-msg { color: #e53e3e; font-size: 13px; margin-bottom: 8px; }

.btn-main { padding: 10px 24px; background: #f0a500; color: #fff; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }

.section-title { font-size: 14px; font-weight: 700; color: #333; margin-bottom: 8px; }
.empty { text-align: center; color: #bbb; padding: 30px; font-size: 14px; background: #fff; border-radius: 12px; }

.task-card { background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 10px; }
.pay-card { border-left: 4px solid #e53e3e; }
.receive-card { border-left: 4px solid #07C160; }
.task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.task-type { font-size: 13px; font-weight: 600; color: #e53e3e; }
.task-type.receive { color: #07C160; }
.task-amount { font-size: 18px; font-weight: 700; color: #e53e3e; }
.task-amount.receive { color: #07C160; }
.task-info { font-size: 13px; color: #666; margin-bottom: 8px; }
.task-status { font-size: 12px; color: #999; margin-bottom: 8px; }
.task-qr { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.qr-img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #eee; }
.qr-label { font-size: 12px; color: #666; }
.task-screenshot { margin-bottom: 8px; }
.screenshot-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 10px; cursor: pointer; border: 1px solid #eee; }
.screenshot-label { font-size: 11px; color: #999; display: block; text-align: center; margin-top: 2px; }
.btn-upload { width: 100%; padding: 10px; background: #1976D2; color: #fff; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
.btn-confirm { width: 100%; padding: 10px; background: #07C160; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }

.history-card { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 8px; }
.history-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
.history-status { font-size: 13px; font-weight: 600; }
.history-status.completed { color: #07C160; }
.history-date { font-size: 12px; color: #999; }
.history-info { font-size: 13px; color: #555; }
.history-profit { color: #07C160; font-weight: 700; margin-left: 8px; }
</style>

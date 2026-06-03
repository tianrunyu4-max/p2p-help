<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

// ── 管理员登录状态 ────────────────────────────
const adminToken  = ref(sessionStorage.getItem('adminToken') || '')
const loginCode   = ref('')
const loginError  = ref('')
const loginLoading = ref(false)

async function handleAdminLogin() {
  if (!loginCode.value) { loginError.value = '请输入管理员密码'; return }
  loginLoading.value = true
  loginError.value = ''
  try {
    // 用后端 /api/admin/verify 验证密码，成功后存 session
    await axios.get('/api/admin/orders', {
      headers: { 'X-Admin-Token': loginCode.value }
    })
    adminToken.value = loginCode.value
    sessionStorage.setItem('adminToken', loginCode.value)
    axios.defaults.headers.common['X-Admin-Token'] = loginCode.value
    loadOrders()
  } catch {
    loginError.value = '密码错误，请重试'
  } finally {
    loginLoading.value = false
  }
}

function handleLogout() {
  adminToken.value = ''
  sessionStorage.removeItem('adminToken')
  delete axios.defaults.headers.common['X-Admin-Token']
}

// ── 数据 ──────────────────────────────────────
const tab     = ref('nodes')
const orders  = ref([])
const users   = ref([])
const nodes   = ref([])
const loading = ref(false)

// 节点管理
const creatingNode = ref(false)
const nodeMsg      = ref('')
const setNodeUserId  = ref('')
const setNodeOrder   = ref(1)
const setNodeLoading = ref(false)

if (adminToken.value) {
  axios.defaults.headers.common['X-Admin-Token'] = adminToken.value
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/orders')
    orders.value = res.data.data
  } catch (e) {
    if (e.response?.status === 403) handleLogout()
  } finally { loading.value = false }
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/users')
    users.value = res.data.data
  } catch (e) {
    if (e.response?.status === 403) handleLogout()
  } finally { loading.value = false }
}

async function loadNodes() {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/nodes')
    nodes.value = res.data.data
  } catch (e) {
    if (e.response?.status === 403) handleLogout()
  } finally { loading.value = false }
}

onMounted(() => { if (adminToken.value) loadNodes() })

async function forceComplete(taskId) {
  if (!confirm('确认强制完成此任务？')) return
  await axios.post(`/api/admin/force-complete/${taskId}`)
  loadOrders()
}

async function toggleFreeze(userId, frozen) {
  await axios.post(`/api/admin/freeze-user`, { userId, frozen: !frozen })
  loadUsers()
}

// 快速创建节点账户
async function createNode(order) {
  creatingNode.value = true
  nodeMsg.value = ''
  try {
    const res = await axios.post('/api/admin/create-node', { nodeOrder: order })
    nodeMsg.value = `✅ 节点${order}号创建成功！ID：${res.data.data.user_no}，邀请码：${res.data.data.invite_code}`
    await loadNodes()
  } catch (e) {
    nodeMsg.value = '❌ ' + (e.response?.data?.message || '创建失败')
  } finally { creatingNode.value = false }
}

// 把已有用户设为节点
async function setExistingAsNode() {
  if (!setNodeUserId.value.trim()) { nodeMsg.value = '❌ 请输入用户ID'; return }
  setNodeLoading.value = true
  nodeMsg.value = ''
  try {
    // 先查用户
    const usersRes = await axios.get(`/api/admin/users?q=${setNodeUserId.value.trim()}`)
    const found = usersRes.data.data?.[0]
    if (!found) { nodeMsg.value = '❌ 找不到该用户'; return }
    await axios.post('/api/admin/set-node', { userId: found.id, isNode: true, nodeOrder: setNodeOrder.value })
    nodeMsg.value = `✅ 用户 #${found.user_no} 已设为节点${setNodeOrder.value}号`
    await loadNodes()
  } catch (e) {
    nodeMsg.value = '❌ ' + (e.response?.data?.message || '设置失败')
  } finally { setNodeLoading.value = false }
}

// QR 弹窗
const qrDialog    = ref(null)   // { id, user_no, wechat_qr, alipay_qr }
const qrWechat    = ref('')
const qrAlipay    = ref('')
const qrSaving    = ref(false)

function openQrDialog(node) {
  qrDialog.value = node
  qrWechat.value = node.wechat_qr || ''
  qrAlipay.value = node.alipay_qr || ''
}

async function saveQr() {
  if (!qrDialog.value) return
  qrSaving.value = true
  try {
    await axios.post('/api/admin/node-set-qr', {
      userId:   qrDialog.value.id,
      wechatQr: qrWechat.value.trim() || null,
      alipayQr: qrAlipay.value.trim() || null,
    })
    nodeMsg.value = `✅ #${qrDialog.value.user_no} 收款码已保存`
    qrDialog.value = null
    await loadNodes()
  } catch {
    nodeMsg.value = '❌ 保存失败'
  } finally { qrSaving.value = false }
}

// 移除节点
async function removeNode(userId, userNo) {
  if (!confirm(`确认移除节点用户 #${userNo}？`)) return
  await axios.post('/api/admin/set-node', { userId, isNode: false })
  nodeMsg.value = `✅ 已移除节点 #${userNo}`
  await loadNodes()
}

// ── 生活补贴管理 ──────────────────────────────
const subsidyQueue  = ref([])
const subsidyStats  = ref({ waiting: 0, paying: 0, completed: 0 })
const subsidyLoading = ref(false)
const matchLoading  = ref(false)
const matchMsg      = ref('')

async function loadSubsidy() {
  subsidyLoading.value = true
  try {
    const res = await axios.get('/api/subsidy/admin/queue')
    subsidyQueue.value = res.data.data.queues || []
    subsidyStats.value = res.data.data.stats || {}
  } catch (e) {
    if (e.response?.status === 403) handleLogout()
  } finally { subsidyLoading.value = false }
}

async function triggerMatch() {
  matchLoading.value = true
  matchMsg.value = ''
  try {
    const res = await axios.post('/api/subsidy/admin/match')
    matchMsg.value = '✅ ' + (res.data.data?.message || '匹配完成')
    await loadSubsidy()
  } catch (e) {
    matchMsg.value = '❌ ' + (e.response?.data?.message || '匹配失败')
  } finally { matchLoading.value = false }
}

function switchTab(t) {
  tab.value = t
  if (t === 'orders')  loadOrders()
  if (t === 'users')   loadUsers()
  if (t === 'nodes')   loadNodes()
  if (t === 'subsidy') loadSubsidy()
}
</script>

<template>
  <div class="page">

    <!-- 未登录：显示管理员验证界面 -->
    <template v-if="!adminToken">
      <div class="login-wrap">
        <div class="lock-icon">🔐</div>
        <h2 class="login-title">管理后台</h2>
        <p class="login-sub">仅限管理员访问</p>
        <div class="form-card">
          <input
            v-model="loginCode"
            type="password"
            placeholder="管理员密码"
            class="input"
            @keyup.enter="handleAdminLogin"
          />
          <p v-if="loginError" class="err-msg">{{ loginError }}</p>
          <button class="btn-main" :disabled="loginLoading" @click="handleAdminLogin">
            {{ loginLoading ? '验证中...' : '进入后台' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 已登录：管理后台内容 -->
    <template v-else>
      <div class="header-row">
        <h2 class="page-title">🔧 管理后台</h2>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>

      <div class="tabs">
        <button :class="['tab', tab==='nodes'?'active':'']"   @click="switchTab('nodes')">🔗 内排节点</button>
        <button :class="['tab', tab==='subsidy'?'active':'']" @click="switchTab('subsidy')">💰 生活补贴</button>
        <button :class="['tab', tab==='orders'?'active':'']"  @click="switchTab('orders')">订单管理</button>
        <button :class="['tab', tab==='users'?'active':'']"   @click="switchTab('users')">用户管理</button>
      </div>

      <div v-if="loading" class="loading">加载中...</div>

      <!-- 内排节点管理 -->
      <template v-if="tab==='nodes' && !loading">
        <div class="node-intro">
          <div class="node-intro-title">🔗 内排节点链（10个）</div>
          <div class="node-intro-sub">平级奖链不足10层时，节点账户按序号自动补位收款</div>
        </div>

        <!-- 当前节点链可视化 -->
        <div class="node-chain">
          <div v-for="i in 10" :key="i" class="node-slot">
            <div class="node-order">{{ i }}</div>
            <template v-if="nodes.find(n => n.node_order === i)">
              <div class="node-info">
                <div class="node-id">#{{ nodes.find(n => n.node_order === i).user_no }}</div>
                <div class="node-qr-status">
                  <span :class="nodes.find(n => n.node_order === i).wechat_qr ? 'qr-ok' : 'qr-no'">微信</span>
                  <span :class="nodes.find(n => n.node_order === i).alipay_qr ? 'qr-ok' : 'qr-no'">支付宝</span>
                </div>
                <button class="btn-set-qr" @click="openQrDialog(nodes.find(n=>n.node_order===i))">设收款码</button>
                <button class="btn-remove-node" @click="removeNode(nodes.find(n=>n.node_order===i).id, nodes.find(n=>n.node_order===i).user_no)">移除</button>
              </div>
            </template>
            <template v-else>
              <div class="node-empty">
                <button class="btn-create-node" :disabled="creatingNode" @click="createNode(i)">
                  + 创建
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- 操作反馈 -->
        <div v-if="nodeMsg" class="node-msg" :class="nodeMsg.startsWith('✅') ? 'msg-ok' : 'msg-err'">
          {{ nodeMsg }}
        </div>

        <!-- 把已有用户设为节点 -->
        <div class="set-node-box">
          <div class="set-node-title">把已有用户设为节点</div>
          <div class="set-node-row">
            <input v-model="setNodeUserId" placeholder="输入用户ID（如：830274）" class="node-input" />
            <select v-model="setNodeOrder" class="node-select">
              <option v-for="i in 10" :key="i" :value="i">节点 {{ i }} 号</option>
            </select>
          </div>
          <button class="btn-set-node" :disabled="setNodeLoading" @click="setExistingAsNode">
            {{ setNodeLoading ? '设置中...' : '✅ 设为节点' }}
          </button>
        </div>

        <!-- QR 设置弹窗 -->
        <div v-if="qrDialog" class="qr-overlay" @click.self="qrDialog=null">
          <div class="qr-dialog">
            <div class="qr-dialog-title">设置收款码 · #{{ qrDialog.user_no }}</div>
            <div class="qr-field">
              <label>微信收款码 URL</label>
              <input v-model="qrWechat" placeholder="粘贴图片链接（上传后复制URL）" class="qr-url-input" />
            </div>
            <div class="qr-field">
              <label>支付宝收款码 URL</label>
              <input v-model="qrAlipay" placeholder="粘贴图片链接（上传后复制URL）" class="qr-url-input" />
            </div>
            <div class="qr-dialog-tip">💡 将收款码图片上传到图床（如 imgbb.com），复制图片链接粘贴上来</div>
            <div class="qr-dialog-btns">
              <button class="btn-cancel" @click="qrDialog=null">取消</button>
              <button class="btn-save" :disabled="qrSaving" @click="saveQr">
                {{ qrSaving ? '保存中...' : '✅ 保存' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 说明 -->
        <div class="node-tips">
          <div class="tip">💡 节点账户需上传微信/支付宝收款码才能收到平级奖</div>
          <div class="tip">💡 进入收款码设置：用该节点账号ID登录 → 我的页面 → 上传收款码</div>
          <div class="tip">💡 10个节点按序号1→10形成内排链，补齐平级奖</div>
        </div>
      </template>

      <!-- 生活补贴管理 -->
      <template v-if="tab==='subsidy' && !subsidyLoading">
        <!-- 统计 -->
        <div class="subsidy-stats">
          <div class="ss-item">
            <div class="ss-num">{{ subsidyStats.waiting }}</div>
            <div class="ss-label">等待匹配</div>
          </div>
          <div class="ss-item">
            <div class="ss-num">{{ subsidyStats.paying }}</div>
            <div class="ss-label">付款中</div>
          </div>
          <div class="ss-item">
            <div class="ss-num">{{ subsidyStats.completed }}</div>
            <div class="ss-label">已完成</div>
          </div>
        </div>

        <!-- 手动匹配 -->
        <div class="match-box">
          <div class="match-info">队列人数 ≥ 3 时可手动触发匹配（每人付2×30，等收3×30）</div>
          <button class="btn-match" :disabled="matchLoading" @click="triggerMatch">
            {{ matchLoading ? '匹配中...' : '⚡ 手动触发匹配' }}
          </button>
          <div v-if="matchMsg" class="match-msg" :class="matchMsg.startsWith('✅') ? 'msg-ok' : 'msg-err'">
            {{ matchMsg }}
          </div>
        </div>

        <!-- 队列列表 -->
        <div class="subsidy-list">
          <div v-for="q in subsidyQueue" :key="q.id" class="subsidy-row">
            <div class="sr-left">
              <span class="sr-no">#{{ q.user?.user_no || '?' }}</span>
              <span :class="['sr-status', q.status]">{{ { waiting:'等待', paying:'付款中', completed:'完成' }[q.status] }}</span>
            </div>
            <div class="sr-right">
              付 {{ q.paid_count }}/2 · 收 {{ q.received_count }}/3
              <span class="sr-date">{{ q.created_at?.slice(5,10) }}</span>
            </div>
          </div>
          <p v-if="!subsidyQueue.length" class="empty">暂无记录</p>
        </div>
      </template>
      <div v-if="tab==='subsidy' && subsidyLoading" class="loading">加载中...</div>

      <!-- 订单列表 -->
      <template v-else-if="tab==='orders' && !loading">
        <div v-for="o in orders" :key="o.id" class="order-card">
          <div class="order-top">
            <span class="order-id">订单 #{{ o.id.slice(0,8) }}</span>
            <span :class="['status-badge', o.status]">{{ o.status }}</span>
          </div>
          <div class="order-info">
            付款方：{{ o.payer_no }}  →  收款方：{{ o.receiver_no }}<br/>
            金额：¥{{ o.amount }} · {{ o.type_label }}
          </div>
          <div v-if="o.screenshot_url" class="screenshot-row">
            <img :src="o.screenshot_url" class="thumb" @click="window.open(o.screenshot_url)" />
          </div>
          <div class="order-actions">
            <button
              v-if="o.status !== 'confirmed'"
              class="btn-force"
              @click="forceComplete(o.id)"
            >强制完成</button>
          </div>
        </div>
        <p v-if="!orders.length && !loading" class="empty">暂无订单</p>
      </template>

      <!-- 用户列表 -->
      <template v-else-if="tab==='users' && !loading">
        <div v-for="u in users" :key="u.id" class="user-card">
          <div class="user-info">
            <span class="user-no">#{{ u.user_no }}</span>
            <span class="user-email">{{ u.email }}</span>
            <span :class="['freeze-badge', u.is_frozen ? 'frozen' : 'normal']">
              {{ u.is_frozen ? '已冻结' : '正常' }}
            </span>
          </div>
          <div class="user-stats">
            累计收款：¥{{ u.total_received }} · 直推：{{ u.invite_used }}/2人
          </div>
          <button
            :class="u.is_frozen ? 'btn-unfreeze' : 'btn-freeze'"
            @click="toggleFreeze(u.id, u.is_frozen)"
          >
            {{ u.is_frozen ? '解冻' : '冻结账户' }}
          </button>
        </div>
        <p v-if="!users.length && !loading" class="empty">暂无用户</p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 16px; min-height: 100vh; }

/* 登录界面 */
.login-wrap { display: flex; flex-direction: column; align-items: center; padding-top: 80px; }
.lock-icon { font-size: 48px; margin-bottom: 12px; }
.login-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.login-sub { color: #999; font-size: 13px; margin-bottom: 32px; }
.form-card { width: 100%; max-width: 340px; }
.input { width: 100%; padding: 14px 16px; border: 1px solid #ddd; border-radius: 10px; font-size: 16px; margin-bottom: 12px; outline: none; box-sizing: border-box; }
.btn-main { width: 100%; padding: 14px; background: #333; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; }
.err-msg { color: #e53e3e; font-size: 13px; margin-bottom: 8px; }

/* 后台内容 */
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; }
.btn-logout { padding: 6px 14px; background: #eee; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; color: #666; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab { padding: 8px 20px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 14px; }
.tab.active { background: #333; color: #fff; border-color: #333; }
.loading { text-align: center; padding: 40px; color: #999; }
.empty { text-align: center; color: #bbb; padding: 40px; font-size: 14px; }
.order-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.order-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
.order-id { font-size: 13px; color: #999; }
.status-badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #eee; }
.status-badge.confirmed { background: #c6f6d5; color: #276749; }
.status-badge.ai_review { background: #fed7d7; color: #9b2c2c; }
.order-info { font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 8px; }
.screenshot-row { margin-bottom: 8px; }
.thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; }
.order-actions { text-align: right; }
.btn-force { padding: 6px 14px; background: #f0a500; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
.user-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.user-info { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.user-no { font-weight: 700; font-size: 15px; }
.user-email { color: #666; font-size: 13px; }
.freeze-badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.freeze-badge.normal { background: #c6f6d5; color: #276749; }
.freeze-badge.frozen { background: #fed7d7; color: #9b2c2c; }
.user-stats { font-size: 13px; color: #888; margin-bottom: 8px; }
.btn-freeze { padding: 6px 14px; background: #e53e3e; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
.btn-unfreeze { padding: 6px 14px; background: #48bb78; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }

/* 节点管理 */
.node-intro { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
.node-intro-title { font-size: 14px; font-weight: 700; color: #7c4a00; }
.node-intro-sub { font-size: 12px; color: #a16207; margin-top: 2px; }

.node-chain { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.node-slot { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #f0f0f0; border-radius: 10px; padding: 10px 12px; }
.node-order { width: 28px; height: 28px; background: #f0a500; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.node-info { flex: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.node-id { font-weight: 700; font-size: 14px; }
.node-qr-status { display: flex; gap: 4px; }
.qr-ok { background: #c6f6d5; color: #276749; font-size: 11px; padding: 2px 6px; border-radius: 8px; }
.qr-no { background: #fed7d7; color: #9b2c2c; font-size: 11px; padding: 2px 6px; border-radius: 8px; }
.node-empty { flex: 1; }
.btn-create-node { padding: 5px 14px; background: #eee; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; color: #555; }
.btn-create-node:hover { background: #f0a500; color: #fff; }
.btn-remove-node { padding: 4px 10px; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 6px; font-size: 12px; color: #e53e3e; cursor: pointer; margin-left: auto; }

.node-msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
.msg-ok { background: #c6f6d5; color: #276749; }
.msg-err { background: #fed7d7; color: #9b2c2c; }

.set-node-box { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
.set-node-title { font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #333; }
.set-node-row { display: flex; gap: 8px; margin-bottom: 10px; }
.node-input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; outline: none; }
.node-select { padding: 8px 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; background: #fff; }
.btn-set-node { width: 100%; padding: 10px; background: #333; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }

.node-tips { background: #f9f9f9; border-radius: 10px; padding: 12px; }
.node-tips .tip { font-size: 12px; color: #666; padding: 3px 0; }
.btn-set-qr { padding: 4px 10px; background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 6px; font-size: 12px; color: #2b6cb0; cursor: pointer; }

/* QR 弹窗 */
.qr-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.qr-dialog { background: #fff; border-radius: 16px; padding: 20px; width: 100%; max-width: 400px; }
.qr-dialog-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.qr-field { margin-bottom: 12px; }
.qr-field label { font-size: 12px; color: #666; display: block; margin-bottom: 4px; }
.qr-url-input { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; outline: none; box-sizing: border-box; }
.qr-dialog-tip { font-size: 11px; color: #999; background: #f9f9f9; border-radius: 8px; padding: 8px 10px; margin-bottom: 14px; }
.qr-dialog-btns { display: flex; gap: 10px; }
.btn-cancel { flex: 1; padding: 10px; background: #eee; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
.btn-save { flex: 2; padding: 10px; background: #333; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }

/* 生活补贴 */
.subsidy-stats { display: flex; gap: 10px; margin-bottom: 14px; }
.ss-item { flex: 1; background: #fff; border-radius: 12px; padding: 14px; text-align: center; border: 1px solid #f0f0f0; }
.ss-num { font-size: 28px; font-weight: 700; color: #f0a500; }
.ss-label { font-size: 12px; color: #999; margin-top: 2px; }
.match-box { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 12px; border: 1px solid #f0f0f0; }
.match-info { font-size: 12px; color: #666; margin-bottom: 10px; }
.btn-match { width: 100%; padding: 12px; background: linear-gradient(135deg,#f0a500,#e09000); color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-match:disabled { background: #ddd; color: #aaa; }
.match-msg { margin-top: 10px; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
.subsidy-list { display: flex; flex-direction: column; gap: 8px; }
.subsidy-row { background: #fff; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #f0f0f0; }
.sr-left { display: flex; align-items: center; gap: 8px; }
.sr-no { font-weight: 700; font-size: 14px; }
.sr-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.sr-status.waiting { background: #fffbe6; color: #b7791f; }
.sr-status.paying { background: #e3f0ff; color: #2b6cb0; }
.sr-status.completed { background: #c6f6d5; color: #276749; }
.sr-right { font-size: 12px; color: #888; display: flex; align-items: center; gap: 8px; }
.sr-date { color: #bbb; }
</style>

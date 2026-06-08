<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { uploadImage } from '../services/uploadService.js'

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
const tab     = ref('pingjii')
const orders  = ref([])
const users   = ref([])
const nodes   = ref([])
const loading = ref(false)

// 旧内排节点（保留但不再主用）
const creatingNode = ref(false)
const nodeMsg      = ref('')
const setNodeUserId  = ref('')
const setNodeOrder   = ref(1)
const setNodeLoading = ref(false)

// ── 平级节点 & 提现队列 ────────────────────────
const pingjiiNodes     = ref([])
const pingjiiQueue     = ref({ waiting: [], matched: [], completed: [] })
const pingjiiLoading   = ref(false)
const pingjiiMsg       = ref('')
const creatingPingjii  = ref(false)

async function loadPingjii() {
  pingjiiLoading.value = true
  try {
    const [nodesRes, queueRes] = await Promise.all([
      axios.get('/api/admin/pingjii-nodes'),
      axios.get('/api/pingjii/admin/queue'),
    ])
    pingjiiNodes.value = nodesRes.data.data || []
    pingjiiQueue.value = queueRes.data.data || { waiting: [], matched: [], completed: [] }
  } catch (e) {
    if (e.response?.status === 403) handleLogout()
  } finally { pingjiiLoading.value = false }
}

async function createPingjiiNode(order) {
  creatingPingjii.value = true
  pingjiiMsg.value = ''
  try {
    const res = await axios.post('/api/admin/create-pingjii-node', { nodeOrder: order })
    pingjiiMsg.value = res.data.data.message
    await loadPingjii()
  } catch (e) {
    pingjiiMsg.value = '❌ ' + (e.response?.data?.message || '创建失败')
  } finally { creatingPingjii.value = false }
}

async function completePingjiiWithdraw(id) {
  if (!confirm('确认已打款给该用户？')) return
  try {
    await axios.post(`/api/pingjii/admin/complete/${id}`)
    pingjiiMsg.value = '✅ 已标记完成'
    await loadPingjii()
  } catch (e) {
    pingjiiMsg.value = '❌ 操作失败'
  }
}

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

onMounted(() => { if (adminToken.value) loadPingjii() })

async function forceComplete(taskId) {
  if (!confirm('确认强制完成此任务？')) return
  await axios.post(`/api/admin/force-complete/${taskId}`)
  loadOrders()
}

async function toggleFreeze(userId, frozen) {
  await axios.post(`/api/admin/freeze-user`, { userId, frozen: !frozen })
  loadUsers()
}

async function deleteUser(userId, userNo) {
  if (!confirm(`确认删除用户 #${userNo}？此操作不可恢复！`)) return
  await axios.post('/api/admin/delete-user', { userId })
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
const qrDialog       = ref(null)
const qrWechat       = ref('')
const qrAlipay       = ref('')
const qrSaving       = ref(false)
const qrWechatUpload = ref(false)
const qrAlipayUpload = ref(false)

async function handleQrUpload(type, e) {
  const file = e.target.files[0]; if (!file) return
  if (type === 'wechat') qrWechatUpload.value = true
  else qrAlipayUpload.value = true
  try {
    const { url } = await uploadImage(file)
    if (type === 'wechat') qrWechat.value = url
    else qrAlipay.value = url
  } catch (err) { alert('上传失败: ' + err.message) }
  finally {
    if (type === 'wechat') qrWechatUpload.value = false
    else qrAlipayUpload.value = false
    e.target.value = ''
  }
}

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

// ── 手动内排激活 ──────────────────────────────
const maUserNo     = ref('')   // 要激活的用户ID
const maReferrerNo = ref('')   // 推荐人ID（可留空=根用户）
const maPreview    = ref(null) // 查询到的用户信息
const maMsg        = ref('')
const maLoading    = ref(false)

async function lookupUser() {
  if (!maUserNo.value.trim()) { maMsg.value = '❌ 请输入用户ID'; return }
  maPreview.value = null
  maMsg.value = ''
  try {
    const res = await axios.get(`/api/admin/lookup/${maUserNo.value.trim()}`)
    maPreview.value = res.data.data
  } catch (e) {
    maMsg.value = '❌ ' + (e.response?.data?.message || '用户不存在')
  }
}

async function doManualActivate() {
  if (!maUserNo.value.trim()) { maMsg.value = '❌ 请输入用户ID'; return }
  const label = maReferrerNo.value.trim()
    ? `确认激活 #${maUserNo.value}，推荐人 #${maReferrerNo.value}？`
    : `确认激活 #${maUserNo.value} 为平台第一人（无推荐人）？`
  if (!confirm(label)) return
  maLoading.value = true
  maMsg.value = ''
  try {
    const res = await axios.post('/api/admin/manual-activate', {
      userNo:     maUserNo.value.trim(),
      referrerNo: maReferrerNo.value.trim() || null,
    })
    maMsg.value = res.data.data.message
    maPreview.value = null
    maUserNo.value = ''
    maReferrerNo.value = ''
    loadUsers()
  } catch (e) {
    maMsg.value = '❌ ' + (e.response?.data?.message || '激活失败')
  } finally { maLoading.value = false }
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
  if (t === 'pingjii') loadPingjii()
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
        <button :class="['tab', tab==='pingjii'?'active':'']"  @click="switchTab('pingjii')">📊 平级节点</button>
        <button :class="['tab', tab==='subsidy'?'active':'']" @click="switchTab('subsidy')">💰 生活补贴</button>
        <button :class="['tab', tab==='orders'?'active':'']"  @click="switchTab('orders')">订单管理</button>
        <button :class="['tab', tab==='users'?'active':'']"   @click="switchTab('users')">用户管理</button>
      </div>

      <div v-if="loading" class="loading">加载中...</div>

      <!-- 平级节点管理 -->
      <template v-if="tab==='pingjii' && !pingjiiLoading">
        <!-- 2个平级节点账号 -->
        <div class="pj-section">
          <div class="pj-title">📊 平级节点账号（2个）</div>
          <div class="pj-sub">新用户激活时，平级奖¥30×2打给这2个节点，节点自动给链上用户每层记+5元余额</div>
          <div class="pj-nodes">
            <div v-for="order in [1,2]" :key="order" class="pj-node-slot">
              <div class="pj-node-order">节点{{ order }}</div>
              <template v-if="pingjiiNodes.find(n=>n.pingjii_node_order===order)">
                <div class="pj-node-id">#{{ pingjiiNodes.find(n=>n.pingjii_node_order===order).user_no }}</div>
                <div class="pj-node-qr">
                  <span :class="pingjiiNodes.find(n=>n.pingjii_node_order===order).wechat_qr ? 'qr-ok' : 'qr-no'">
                    微信{{ pingjiiNodes.find(n=>n.pingjii_node_order===order).wechat_qr ? '✅' : '❌' }}
                  </span>
                  <span :class="pingjiiNodes.find(n=>n.pingjii_node_order===order).alipay_qr ? 'qr-ok' : 'qr-no'">
                    支付宝{{ pingjiiNodes.find(n=>n.pingjii_node_order===order).alipay_qr ? '✅' : '❌' }}
                  </span>
                </div>
                <div class="pj-node-stat">累计收款 ¥{{ pingjiiNodes.find(n=>n.pingjii_node_order===order).total_received }}</div>
                <button class="btn-set-qr" style="margin-top:8px;width:100%"
                  @click="openQrDialog(pingjiiNodes.find(n=>n.pingjii_node_order===order))">
                  📷 设置收款码
                </button>
              </template>
              <button v-else class="pj-btn-create" :disabled="creatingPingjii"
                @click="createPingjiiNode(order)">
                {{ creatingPingjii ? '创建中...' : '+ 创建节点' + order }}
              </button>
            </div>
          </div>
          <div v-if="pingjiiMsg" :class="['pj-msg', pingjiiMsg.startsWith('✅')?'ok':'fail']">{{ pingjiiMsg }}</div>
        </div>

        <!-- 提现队列 -->
        <div class="pj-section">
          <div class="pj-title">💸 平级余额提现队列</div>
          <div class="pj-queue-stats">
            <span class="pj-stat-badge waiting">等待中 {{ pingjiiQueue.waiting?.length || 0 }}</span>
            <span class="pj-stat-badge matched">已匹配 {{ pingjiiQueue.matched?.length || 0 }}</span>
            <span class="pj-stat-badge done">已完成 {{ pingjiiQueue.completed?.length || 0 }}</span>
          </div>

          <div v-if="!pingjiiQueue.waiting?.length && !pingjiiQueue.matched?.length" class="empty">暂无待处理提现</div>

          <div v-for="q in [...(pingjiiQueue.matched||[]), ...(pingjiiQueue.waiting||[])]" :key="q.id" class="pj-withdraw-card">
            <div class="pj-w-top">
              <span class="pj-w-user">#{{ q.user_no }}</span>
              <span :class="['pj-w-status', q.status]">{{ q.status === 'waiting' ? '⏳ 等待中' : '🔗 已匹配' }}</span>
              <span class="pj-w-amount">¥{{ q.amount }}</span>
            </div>
            <div class="pj-w-time">申请时间：{{ new Date(q.created_at).toLocaleString('zh-CN') }}</div>
            <button v-if="q.status === 'matched'" class="pj-btn-complete" @click="completePingjiiWithdraw(q.id)">
              ✅ 确认已打款
            </button>
          </div>
        </div>
      </template>
      <div v-if="tab==='pingjii' && pingjiiLoading" class="loading">加载中...</div>

      <!-- 内排节点管理（旧，保留备用）-->
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

        <!-- 手动内排激活 -->
        <div class="ma-card">
          <div class="ma-title">⚡ 手动内排激活</div>
          <div class="ma-sub">跳过打款流程，直接激活为代理（老板身份）</div>
          <div class="ma-row">
            <input v-model="maUserNo" class="ma-input" placeholder="用户ID（如 890494）" @keyup.enter="lookupUser" />
            <button class="ma-btn-query" @click="lookupUser">查询</button>
          </div>
          <!-- 查询预览 -->
          <div v-if="maPreview" class="ma-preview">
            <div class="ma-preview-row">
              <span class="ma-label">用户</span>
              <span class="ma-val">#{{ maPreview.user_no }}</span>
              <span :class="['ma-status', maPreview.is_active ? 'active' : 'inactive']">
                {{ maPreview.is_active ? '已激活' : '未激活' }}
              </span>
            </div>
            <div class="ma-preview-row" v-if="maPreview.referrer_no">
              <span class="ma-label">现推荐人</span>
              <span class="ma-val">#{{ maPreview.referrer_no }}</span>
            </div>
          </div>
          <div class="ma-row" style="margin-top:8px">
            <input v-model="maReferrerNo" class="ma-input" placeholder="推荐人ID（留空=平台第一人）" />
          </div>
          <button class="ma-btn-activate" :disabled="maLoading || !maUserNo" @click="doManualActivate">
            {{ maLoading ? '激活中...' : '⚡ 立即激活' }}
          </button>
          <div v-if="maMsg" :class="['ma-msg', maMsg.startsWith('✅') ? 'ok' : 'fail']">{{ maMsg }}</div>
        </div>

        <div v-for="u in users" :key="u.id" class="user-row">
          <!-- 左：ID信息 + 身份 -->
          <div class="ur-left">
            <div class="ur-ids">
              <span class="ur-self">#{{ u.user_no }}</span>
              <span class="ur-arrow">←</span>
              <span class="ur-ref">{{ u.referrer_no ? '#'+u.referrer_no : '根用户' }}</span>
            </div>
            <div class="ur-badges">
              <span :class="['ur-role', u.role === 'owner' ? 'owner' : 'agent']">{{ u.role === 'owner' ? '👑 老板' : '👔 代理' }}</span>
              <span v-if="u.is_exited" class="ur-exited">出局</span>
              <span v-if="u.is_frozen" class="ur-frozen">冻结</span>
              <span class="ur-stat-inline">¥{{ u.total_received||0 }} · 推{{ u.invite_used||0 }} · 局{{ u.exited_count||0 }}</span>
            </div>
          </div>
          <!-- 右：操作按钮 -->
          <div class="ur-actions">
            <button :class="u.is_frozen ? 'btn-unfreeze' : 'btn-freeze'" @click="toggleFreeze(u.id, u.is_frozen)">
              {{ u.is_frozen ? '解冻' : '冻结' }}
            </button>
            <button class="btn-delete" @click="deleteUser(u.id, u.user_no)">删除</button>
          </div>
        </div>
        <p v-if="!users.length && !loading" class="empty">暂无已激活用户</p>
      </template>
    </template>

    <!-- QR 设置弹窗（全局，不依赖任何tab） -->
    <div v-if="qrDialog" class="qr-overlay" @click.self="qrDialog=null">
      <div class="qr-dialog">
        <div class="qr-dialog-title">设置收款码 · #{{ qrDialog.user_no }}</div>
        <div class="qr-field">
          <label>微信收款码</label>
          <div class="qr-upload-row">
            <img v-if="qrWechat" :src="qrWechat" class="qr-thumb" />
            <div v-else class="qr-thumb-empty">未设置</div>
            <label class="btn-qr-upload" :class="{ loading: qrWechatUpload }">
              {{ qrWechatUpload ? '上传中...' : '📷 上传图片' }}
              <input type="file" accept="image/*" style="display:none"
                :disabled="qrWechatUpload" @change="handleQrUpload('wechat', $event)" />
            </label>
          </div>
        </div>
        <div class="qr-field">
          <label>支付宝收款码</label>
          <div class="qr-upload-row">
            <img v-if="qrAlipay" :src="qrAlipay" class="qr-thumb" />
            <div v-else class="qr-thumb-empty">未设置</div>
            <label class="btn-qr-upload" :class="{ loading: qrAlipayUpload }">
              {{ qrAlipayUpload ? '上传中...' : '📷 上传图片' }}
              <input type="file" accept="image/*" style="display:none"
                :disabled="qrAlipayUpload" @change="handleQrUpload('alipay', $event)" />
            </label>
          </div>
        </div>
        <div class="qr-dialog-btns">
          <button class="btn-cancel" @click="qrDialog=null">取消</button>
          <button class="btn-save" :disabled="qrSaving || qrWechatUpload || qrAlipayUpload" @click="saveQr">
            {{ qrSaving ? '保存中...' : '✅ 保存' }}
          </button>
        </div>
      </div>
    </div>
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
/* 手动激活表单 */
.ma-card { background: #fff; border: 2px solid #f0a500; border-radius: 14px; padding: 16px; margin-bottom: 16px; }
.ma-title { font-size: 15px; font-weight: 700; color: #b7791f; margin-bottom: 2px; }
.ma-sub { font-size: 12px; color: #999; margin-bottom: 12px; }
.ma-row { display: flex; gap: 8px; margin-bottom: 8px; }
.ma-input { flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; outline: none; }
.ma-btn-query { padding: 10px 14px; background: #eee; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.ma-btn-activate { width: 100%; padding: 12px; background: linear-gradient(135deg,#f0a500,#e08000); color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 4px; }
.ma-btn-activate:disabled { background: #ddd; color: #aaa; cursor: not-allowed; }
.ma-preview { background: #fffbe6; border-radius: 8px; padding: 10px 12px; margin-bottom: 4px; }
.ma-preview-row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 4px; }
.ma-label { color: #999; min-width: 52px; }
.ma-val { font-weight: 600; color: #333; }
.ma-status.active { color: #276749; background: #c6f6d5; padding: 1px 8px; border-radius: 8px; font-size: 11px; }
.ma-status.inactive { color: #9b2c2c; background: #fed7d7; padding: 1px 8px; border-radius: 8px; font-size: 11px; }
.ma-msg { margin-top: 8px; font-size: 13px; padding: 8px 10px; border-radius: 8px; }
.ma-msg.ok { background: #c6f6d5; color: #276749; }
.ma-msg.fail { background: #fed7d7; color: #9b2c2c; }

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
/* 用户管理表格 */
.user-row { background:#fff; border:1px solid #f0f0f0; border-radius:10px; padding:8px 12px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.ur-left { display:flex; flex-direction:column; gap:3px; flex:1; min-width:0; }
.ur-ids { display:flex; align-items:center; gap:5px; font-size:14px; font-weight:700; }
.ur-self { color:#333; }
.ur-arrow { color:#ccc; font-size:12px; }
.ur-ref { color:#888; font-size:12px; font-weight:400; }
.ur-badges { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
.ur-role { font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600; }
.ur-role.owner { background:#fffbeb; color:#b7791f; border:1px solid #f6e05e; }
.ur-role.agent { background:#ebf8ff; color:#2b6cb0; border:1px solid #90cdf4; }
.ur-exited { font-size:11px; padding:2px 6px; border-radius:8px; background:#e9d8fd; color:#553c9a; }
.ur-frozen { font-size:11px; padding:2px 6px; border-radius:8px; background:#fed7d7; color:#9b2c2c; }
.ur-stat-inline { font-size:11px; color:#aaa; }
.ur-actions { display:flex; gap:5px; flex-shrink:0; }
.btn-freeze { padding:5px 10px; background:#e53e3e; color:#fff; border:none; border-radius:7px; font-size:12px; cursor:pointer; }
.btn-unfreeze { padding:5px 10px; background:#48bb78; color:#fff; border:none; border-radius:7px; font-size:12px; cursor:pointer; }
.btn-delete { padding:5px 10px; background:#fff; color:#e53e3e; border:1px solid #e53e3e; border-radius:7px; font-size:12px; cursor:pointer; }

/* 平级节点管理 */
.pj-section { background:#fff; border-radius:14px; border:1px solid #f0f0f0; padding:16px; margin-bottom:14px; }
.pj-title { font-size:15px; font-weight:700; color:#333; margin-bottom:4px; }
.pj-sub { font-size:12px; color:#999; margin-bottom:14px; }
.pj-nodes { display:flex; gap:12px; margin-bottom:10px; }
.pj-node-slot { flex:1; background:#f9fafb; border:2px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center; }
.pj-node-order { font-size:12px; color:#999; margin-bottom:6px; }
.pj-node-id { font-size:18px; font-weight:700; color:#333; margin-bottom:6px; }
.pj-node-qr { display:flex; gap:8px; justify-content:center; margin-bottom:6px; font-size:12px; }
.qr-ok { color:#07C160; } .qr-no { color:#e53e3e; }
.pj-node-stat { font-size:12px; color:#888; }
.pj-btn-create { width:100%; padding:10px; background:linear-gradient(135deg,#4299e1,#3182ce); color:#fff; border:none; border-radius:8px; font-size:13px; cursor:pointer; margin-top:8px; }
.pj-btn-create:disabled { background:#ddd; color:#aaa; }
.pj-msg { padding:8px 10px; border-radius:8px; font-size:13px; margin-top:8px; }
.pj-msg.ok { background:#c6f6d5; color:#276749; } .pj-msg.fail { background:#fed7d7; color:#9b2c2c; }
.pj-queue-stats { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
.pj-stat-badge { font-size:12px; padding:4px 12px; border-radius:20px; font-weight:600; }
.pj-stat-badge.waiting { background:#fef3c7; color:#92400e; }
.pj-stat-badge.matched { background:#dbeafe; color:#1e40af; }
.pj-stat-badge.done { background:#d1fae5; color:#065f46; }
.pj-withdraw-card { background:#f9fafb; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:10px; }
.pj-w-top { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.pj-w-user { font-size:15px; font-weight:700; color:#333; }
.pj-w-status { font-size:12px; padding:2px 8px; border-radius:10px; }
.pj-w-status.waiting { background:#fef3c7; color:#92400e; }
.pj-w-status.matched { background:#dbeafe; color:#1e40af; }
.pj-w-amount { margin-left:auto; font-size:18px; font-weight:700; color:#f0a500; }
.pj-w-time { font-size:12px; color:#999; margin-bottom:8px; }
.pj-btn-complete { width:100%; padding:10px; background:#07C160; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }

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
.qr-field { margin-bottom: 16px; }
.qr-field label { font-size: 12px; color: #666; display: block; margin-bottom: 6px; }
.qr-upload-row { display: flex; align-items: center; gap: 12px; }
.qr-thumb { width: 80px; height: 80px; object-fit: contain; border: 1px solid #eee; border-radius: 8px; }
.qr-thumb-empty { width: 80px; height: 80px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #bbb; }
.btn-qr-upload { padding: 10px 18px; background: #07C160; color: #fff; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; user-select: none; }
.btn-qr-upload.loading { background: #aaa; cursor: not-allowed; }
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

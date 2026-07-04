<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route    = useRoute()
const router   = useRouter()
const task     = ref(null)
const allTasks = ref([])   // 全部任务（用于计算进度和下一笔）
const loading  = ref(true)
const uploading = ref(false)
const error    = ref('')
const fileInput = ref(null)
const activeQr  = ref('wechat')
const previewUrl = ref('')

// ── 加载当前任务 + 完整订单 ────────────────────────────────────
onMounted(async () => {
  try {
    const [taskRes, orderRes] = await Promise.all([
      axios.get(`/api/orders/task/${route.params.taskId}`),
      axios.get('/api/activate/order').catch(() => ({ data: { data: null } })),
    ])
    task.value = taskRes.data.data
    allTasks.value = orderRes.data.data?.tasks || []
    if (!task.value?.receiver_wechat_qr && task.value?.receiver_alipay_qr) {
      activeQr.value = 'alipay'
    }
  } catch {
    error.value = '加载失败，请返回重试'
  } finally {
    loading.value = false
  }
})

// ── 刷新订单（上传后用）──────────────────────────────────────
async function refreshOrder() {
  try {
    const res = await axios.get('/api/activate/order')
    allTasks.value = res.data.data?.tasks || []
  } catch {}
}

// ── 计算属性 ──────────────────────────────────────────────────
const currentIdx = computed(() =>
  allTasks.value.findIndex(t => t.id === route.params.taskId)
)
const taskNo = computed(() => currentIdx.value + 1)
const totalNo = computed(() => allTasks.value.length)

// 下一笔待打款的任务
const nextPendingTask = computed(() => {
  for (let i = currentIdx.value + 1; i < allTasks.value.length; i++) {
    if (allTasks.value[i].status === 'pending') return allTasks.value[i]
  }
  return null
})

// 是否全部搞定（含当前已上传）
const allUploaded = computed(() =>
  allTasks.value.length > 0 &&
  allTasks.value.every(t => t.status !== 'pending')
)

const currentQr = computed(() => {
  if (!task.value) return null
  return activeQr.value === 'wechat'
    ? task.value.receiver_wechat_qr
    : task.value.receiver_alipay_qr
})
const hasWechat = computed(() => !!task.value?.receiver_wechat_qr)
const hasAlipay = computed(() => !!task.value?.receiver_alipay_qr)

// ── 类型元信息 ────────────────────────────────────────────────
function getTypeMeta(type) {
  if (type === 'jian_dian')        return { label: '见点奖',   color: '#f0a500', icon: '👑', to: '老板直接收款' }
  if (type === 'bang_fu')          return { label: '帮扶奖',   color: '#48bb78', icon: '🤝', to: '出局老板直接收款' }
  if (type === 'bang_fu_subsidy')  return { label: '帮扶奖',   color: '#48bb78', icon: '🤝', to: '生活补贴参与者直接收款' }
  if (type === 'bang_fu_admin')    return { label: '帮扶预留', color: '#a0aec0', icon: '🏦', to: '预留给生活补贴参与者（管理员代转）' }
  const lv = type.replace('ping_ji_node_', '')
  return { label: `平级第${lv}层`, color: '#4299e1', icon: '📊', to: '平级奖直接收款' }
}

// ── 上传截图 ──────────────────────────────────────────────────
async function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  previewUrl.value = URL.createObjectURL(file)
  uploading.value = true
  error.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const uploadRes = await axios.post('/api/upload?type=image', fd)
    const screenshotUrl = uploadRes.data.data.url

    await axios.post('/api/orders/upload-screenshot', {
      taskId: route.params.taskId,
      screenshotUrl,
    })
    task.value.status = 'screenshot_uploaded'
    task.value.screenshot_url = screenshotUrl
    // 上传成功后刷新订单，获取最新任务状态
    await refreshOrder()
  } catch (e) {
    error.value = e.response?.data?.message || '上传失败，请重试'
    previewUrl.value = ''
  } finally {
    uploading.value = false
  }
}

// ── 跳转下一笔 ────────────────────────────────────────────────
function goNext() {
  if (nextPendingTask.value) {
    router.replace(`/payment/${nextPendingTask.value.id}`)
  } else {
    router.replace('/participate')
  }
}
</script>

<template>
  <div class="page">

    <!-- ── 顶部导航 ── -->
    <div class="top-bar">
      <button class="back-btn" @click="router.replace('/participate')">←</button>
      <div class="top-center">
        <span class="top-title">点对点打款</span>
        <span v-if="totalNo > 0" class="step-badge">第 {{ taskNo }} 笔 / 共 {{ totalNo }} 笔</span>
      </div>
      <div class="p2p-badge">🔒 P2P</div>
    </div>

    <!-- ── 整体进度条 ── -->
    <div v-if="totalNo > 0" class="global-progress">
      <div
        v-for="(t, i) in allTasks"
        :key="t.id"
        class="prog-seg"
        :class="{
          current: t.id === route.params.taskId,
          done: t.status === 'confirmed',
          uploaded: t.status === 'screenshot_uploaded',
        }"
      >
        <span class="prog-num">{{ i + 1 }}</span>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="loading-spin"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="error && !task" class="error-page">
      <p>{{ error }}</p>
      <button @click="router.replace('/participate')">返回</button>
    </div>

    <template v-else-if="task">

      <!-- ── 金额卡片 ── -->
      <div class="amount-card" :style="{ background: `linear-gradient(135deg, ${getTypeMeta(task.type).color}, ${getTypeMeta(task.type).color}cc)` }">
        <div class="type-row">
          <span class="type-icon">{{ getTypeMeta(task.type).icon }}</span>
          <span class="type-label">{{ getTypeMeta(task.type).label }}</span>
        </div>
        <div class="amount-big">¥{{ task.amount }}</div>
        <div class="amount-to">→ {{ getTypeMeta(task.type).to }}</div>
        <div class="receiver-row">收款方：<strong>#{{ task.receiver_no }}</strong></div>
      </div>

      <!-- ══════════════ 已上传截图状态 ══════════════ -->
      <template v-if="task.status === 'screenshot_uploaded'">

        <!-- 已上传提示 -->
        <div class="uploaded-card">
          <div class="uploaded-icon">📤</div>
          <div class="uploaded-title">截图已提交</div>
          <div class="uploaded-sub">等待收款方 <strong>#{{ task.receiver_no }}</strong> 确认（30分钟内）</div>
          <img v-if="task.screenshot_url" :src="task.screenshot_url" class="uploaded-screenshot" />
        </div>

        <!-- 全部打完 -->
        <div v-if="allUploaded" class="all-done-card">
          <div class="all-done-icon">🎉</div>
          <div class="all-done-title">{{ totalNo }} 笔全部提交完成！</div>
          <div class="all-done-sub">等待各收款方逐一确认，确认后自动激活</div>
          <button class="btn-alldone" @click="router.replace('/participate')">
            查看激活进度 →
          </button>
        </div>

        <!-- 还有下一笔 -->
        <div v-else-if="nextPendingTask" class="next-task-card" @click="goNext">
          <div class="nt-left">
            <div class="nt-hint">下一笔待打款</div>
            <div class="nt-info">
              <span class="nt-badge"
                :style="{ background: getTypeMeta(nextPendingTask.type).color + '22', color: getTypeMeta(nextPendingTask.type).color }">
                {{ getTypeMeta(nextPendingTask.type).icon }} {{ getTypeMeta(nextPendingTask.type).label }}
              </span>
              <span class="nt-receiver">→ #{{ nextPendingTask.receiver_no }}</span>
            </div>
          </div>
          <div class="nt-right">
            <div class="nt-amount">¥{{ nextPendingTask.amount }}</div>
            <div class="nt-arrow">立即打 →</div>
          </div>
        </div>

        <!-- 没有下一笔待打款（等待确认） -->
        <div v-else class="waiting-card">
          <div class="waiting-icon">⏳</div>
          <div class="waiting-title">等待对方确认中</div>
          <div class="waiting-sub">其余任务收款方确认后将自动激活</div>
          <button class="btn-back-list" @click="router.replace('/participate')">
            ← 返回收款清单
          </button>
        </div>

      </template>

      <!-- ══════════════ 待打款状态 ══════════════ -->
      <template v-else>

        <!-- 扫码区域 -->
        <div class="qr-card">
          <div class="qr-header">
            <span class="qr-title">📱 扫码打款</span>
            <div class="qr-tabs">
              <button v-if="hasWechat"
                :class="['qr-tab', activeQr==='wechat' ? 'active-wechat' : '']"
                @click="activeQr='wechat'">微信</button>
              <button v-if="hasAlipay"
                :class="['qr-tab', activeQr==='alipay' ? 'active-alipay' : '']"
                @click="activeQr='alipay'">支付宝</button>
            </div>
          </div>

          <div v-if="currentQr" class="qr-wrap">
            <img :src="currentQr" class="qr-img" />
            <div class="qr-amount-hint">打款金额：<strong>¥{{ task.amount }}</strong></div>
            <div class="qr-steps">
              <span>① 截图保存二维码</span>
              <span class="arr">→</span>
              <span>② {{ activeQr==='wechat' ? '微信' : '支付宝' }}扫码</span>
              <span class="arr">→</span>
              <span>③ 输入 ¥{{ task.amount }}</span>
            </div>
          </div>
          <div v-else class="no-qr">
            <div class="no-qr-icon">⚠️</div>
            <p>收款方暂未上传收款码</p>
            <p class="no-qr-hint">请联系 #{{ task.receiver_no }} 上传后再打款</p>
          </div>
        </div>

        <!-- 上传截图 -->
        <div class="upload-card">
          <div class="upload-title">📷 上传打款截图</div>
          <div class="upload-sub">付款完成后，上传截图作为凭证</div>

          <div v-if="previewUrl" class="preview-wrap">
            <img :src="previewUrl" class="preview-img" />
            <div v-if="uploading" class="uploading-overlay">
              <div class="uploading-spin"></div>
              <span>上传中...</span>
            </div>
          </div>

          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="handleFileSelect" />

          <button class="btn-upload" :disabled="uploading" @click="fileInput.click()">
            <span v-if="uploading">⏳ 上传中...</span>
            <span v-else>{{ previewUrl ? '🔄 重新选择截图' : '📸 选择打款截图' }}</span>
          </button>

          <p v-if="error" class="err-msg">⚠️ {{ error }}</p>

          <div class="upload-notice">
            <div class="notice-item">⏰ 上传截图后对方需在30分钟内确认</div>
            <div class="notice-item">🔒 截图仅用于核实，全程点对点</div>
          </div>
        </div>

        <!-- 后续任务预览（还没打的任务列表） -->
        <div v-if="allTasks.length > 1" class="remaining-card">
          <div class="rem-title">📋 全部收款清单</div>
          <div v-for="(t, i) in allTasks" :key="t.id" class="rem-item"
            :class="{ current: t.id === route.params.taskId, done: t.status === 'confirmed', uploaded: t.status === 'screenshot_uploaded' }">
            <div class="rem-num">
              <span v-if="t.status === 'confirmed'">✓</span>
              <span v-else-if="t.status === 'screenshot_uploaded'">📤</span>
              <span v-else>{{ i + 1 }}</span>
            </div>
            <div class="rem-info">
              <span class="rem-badge"
                :style="{ background: getTypeMeta(t.type).color + '22', color: getTypeMeta(t.type).color }">
                {{ getTypeMeta(t.type).icon }} {{ getTypeMeta(t.type).label }}
              </span>
              <span class="rem-receiver">#{{ t.receiver_no }}</span>
            </div>
            <div class="rem-amount">¥{{ t.amount }}</div>
          </div>
        </div>

      </template>

    </template>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: #f5f7fa; padding-bottom: 40px; }

/* ── 顶部 ── */
.top-bar { display:flex; align-items:center; gap:8px; padding:12px 16px; background:#fff; border-bottom:1px solid #eee; position:sticky; top:0; z-index:10; }
.back-btn { background:none; border:none; font-size:20px; cursor:pointer; color:#666; flex-shrink:0; }
.top-center { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; }
.top-title { font-size:15px; font-weight:700; line-height:1; }
.step-badge { font-size:12px; color:#f0a500; font-weight:600; background:#fff8e1; padding:2px 8px; border-radius:10px; }
.p2p-badge { background:#e6f9ee; color:#07C160; font-size:11px; font-weight:600; padding:3px 8px; border-radius:12px; border:1px solid #07C16040; flex-shrink:0; }

/* ── 整体进度条 ── */
.global-progress { display:flex; gap:4px; padding:10px 16px; background:#fff; border-bottom:1px solid #f0f0f0; }
.prog-seg { flex:1; height:32px; border-radius:8px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; border:2px solid transparent; transition:all .3s; }
.prog-seg.current { background:#fff8e1; border-color:#f0a500; }
.prog-seg.done { background:#e6f9ee; border-color:#07C160; }
.prog-seg.uploaded { background:#e3f0ff; border-color:#4299e1; }
.prog-num { font-size:12px; font-weight:700; color:#999; }
.prog-seg.current .prog-num { color:#f0a500; }
.prog-seg.done .prog-num { color:#07C160; }
.prog-seg.uploaded .prog-num { color:#4299e1; }

/* ── loading ── */
.loading { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; gap:12px; color:#999; }
.loading-spin { width:40px; height:40px; border:3px solid #f0f0f0; border-top-color:#f0a500; border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.error-page { text-align:center; padding:60px 20px; color:#999; }
.error-page button { margin-top:12px; padding:10px 24px; background:#f0a500; color:#fff; border:none; border-radius:10px; font-size:14px; cursor:pointer; }

/* ── 金额卡片 ── */
.amount-card { margin:12px 16px; border-radius:20px; padding:20px; color:#fff; text-align:center; box-shadow:0 6px 20px rgba(0,0,0,.15); }
.type-row { display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:8px; }
.type-icon { font-size:20px; }
.type-label { font-size:14px; font-weight:700; background:rgba(255,255,255,.25); padding:2px 10px; border-radius:12px; }
.amount-big { font-size:52px; font-weight:800; line-height:1.1; letter-spacing:-1px; }
.amount-to { font-size:12px; opacity:.85; margin-top:4px; }
.receiver-row { margin-top:8px; font-size:13px; opacity:.9; }
.receiver-row strong { font-size:15px; }

/* ── 已上传状态 ── */
.uploaded-card { margin:0 16px 12px; background:#fff; border-radius:16px; padding:18px; text-align:center; border:2px solid #4299e1; }
.uploaded-icon { font-size:36px; margin-bottom:6px; }
.uploaded-title { font-size:17px; font-weight:700; color:#4299e1; margin-bottom:4px; }
.uploaded-sub { font-size:13px; color:#666; margin-bottom:12px; line-height:1.6; }
.uploaded-screenshot { width:100%; max-height:160px; object-fit:contain; border-radius:10px; border:1px solid #eee; }

/* ── 全部完成 ── */
.all-done-card { margin:0 16px 12px; background:linear-gradient(135deg,#e6f9ee,#d4f5e2); border-radius:16px; padding:20px; text-align:center; border:2px solid #07C160; }
.all-done-icon { font-size:44px; margin-bottom:8px; }
.all-done-title { font-size:18px; font-weight:800; color:#07C160; margin-bottom:4px; }
.all-done-sub { font-size:13px; color:#2d9c5f; margin-bottom:16px; }
.btn-alldone { padding:14px 28px; background:#07C160; color:#fff; border:none; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; width:100%; }

/* ── 下一笔卡片（核心） ── */
.next-task-card { margin:0 16px 12px; background:linear-gradient(135deg,#fff8e1,#fff3cd); border-radius:16px; padding:16px 18px; display:flex; align-items:center; justify-content:space-between; border:2px solid #f0a500; cursor:pointer; transition:all .2s; box-shadow:0 4px 14px rgba(240,165,0,.2); }
.next-task-card:active { transform:scale(.98); }
.nt-left { flex:1; }
.nt-hint { font-size:11px; color:#b7791f; font-weight:600; margin-bottom:6px; letter-spacing:.5px; }
.nt-info { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.nt-badge { font-size:12px; font-weight:600; padding:3px 8px; border-radius:8px; }
.nt-receiver { font-size:13px; color:#555; font-weight:600; }
.nt-right { text-align:right; flex-shrink:0; margin-left:12px; }
.nt-amount { font-size:22px; font-weight:800; color:#f0a500; }
.nt-arrow { font-size:12px; color:#b7791f; font-weight:600; margin-top:2px; }

/* ── 等待确认 ── */
.waiting-card { margin:0 16px 12px; background:#fff; border-radius:16px; padding:20px; text-align:center; }
.waiting-icon { font-size:36px; margin-bottom:8px; }
.waiting-title { font-size:16px; font-weight:700; color:#333; margin-bottom:4px; }
.waiting-sub { font-size:13px; color:#999; margin-bottom:16px; }
.btn-back-list { padding:12px 24px; background:#f5f5f5; border:none; border-radius:10px; font-size:14px; color:#666; cursor:pointer; }

/* ── 扫码区域 ── */
.qr-card { margin:0 16px 12px; background:#fff; border-radius:16px; padding:16px; }
.qr-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.qr-title { font-size:15px; font-weight:700; color:#333; }
.qr-tabs { display:flex; gap:6px; }
.qr-tab { padding:5px 14px; border:1.5px solid #ddd; border-radius:20px; background:#fff; font-size:13px; cursor:pointer; font-weight:500; }
.active-wechat { background:#07C160; color:#fff; border-color:#07C160; }
.active-alipay  { background:#1677FF; color:#fff; border-color:#1677FF; }
.qr-wrap { text-align:center; }
.qr-img { width:220px; height:220px; object-fit:contain; border-radius:12px; border:2px solid #f0f0f0; margin-bottom:10px; }
.qr-amount-hint { font-size:14px; color:#666; margin-bottom:8px; }
.qr-amount-hint strong { color:#f0a500; font-size:16px; }
.qr-steps { display:flex; align-items:center; justify-content:center; gap:4px; font-size:12px; color:#999; flex-wrap:wrap; padding:8px 0; background:#f9f9f9; border-radius:8px; }
.arr { color:#ccc; }
.no-qr { text-align:center; padding:24px 0; color:#999; }
.no-qr-icon { font-size:32px; margin-bottom:8px; }
.no-qr-hint { font-size:12px; color:#bbb; margin-top:4px; }

/* ── 上传截图 ── */
.upload-card { margin:0 16px 12px; background:#fff; border-radius:16px; padding:16px; }
.upload-title { font-size:15px; font-weight:700; color:#333; margin-bottom:4px; }
.upload-sub { font-size:12px; color:#999; margin-bottom:14px; }
.preview-wrap { position:relative; margin-bottom:12px; border-radius:12px; overflow:hidden; }
.preview-img { width:100%; max-height:220px; object-fit:contain; display:block; background:#f5f5f5; }
.uploading-overlay { position:absolute; inset:0; background:rgba(0,0,0,.5); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#fff; font-size:14px; }
.uploading-spin { width:28px; height:28px; border:3px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .8s linear infinite; }
.btn-upload { width:100%; padding:15px; background:linear-gradient(135deg,#f0a500,#e08000); color:#fff; border:none; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer; margin-bottom:12px; }
.btn-upload:disabled { background:#ddd; color:#aaa; }
.err-msg { color:#e53e3e; font-size:13px; text-align:center; margin-bottom:10px; background:#fff5f5; border:1px solid #fed7d7; border-radius:8px; padding:8px 12px; }
.upload-notice { background:#fffbe6; border-radius:8px; padding:10px 12px; }
.notice-item { font-size:12px; color:#8B6000; padding:2px 0; }

/* ── 全部任务清单预览 ── */
.remaining-card { margin:0 16px 12px; background:#fff; border-radius:16px; padding:14px; }
.rem-title { font-size:13px; font-weight:700; color:#666; margin-bottom:12px; }
.rem-item { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f5f5f5; }
.rem-item:last-child { border-bottom:none; }
.rem-item.current { background:#fffbe6; border-radius:8px; padding:8px 6px; margin:0 -6px; }
.rem-item.done { opacity:.5; }
.rem-item.uploaded { opacity:.8; }
.rem-num { width:26px; height:26px; border-radius:50%; background:#f0f0f0; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#999; flex-shrink:0; }
.rem-item.current .rem-num { background:#f0a500; color:#fff; }
.rem-item.done .rem-num { background:#e6f9ee; color:#07C160; }
.rem-item.uploaded .rem-num { background:#e3f0ff; color:#4299e1; }
.rem-info { flex:1; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.rem-badge { font-size:11px; font-weight:600; padding:2px 7px; border-radius:7px; }
.rem-receiver { font-size:12px; color:#888; }
.rem-amount { font-size:15px; font-weight:700; color:#333; flex-shrink:0; }
</style>

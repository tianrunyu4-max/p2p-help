<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route    = useRoute()
const router   = useRouter()
const task     = ref(null)
const loading  = ref(true)
const uploading = ref(false)
const error    = ref('')
const fileInput = ref(null)
const activeQr  = ref('wechat')   // 'wechat' | 'alipay'
const previewUrl = ref('')        // 截图预览

onMounted(async () => {
  try {
    const res = await axios.get(`/api/orders/task/${route.params.taskId}`)
    task.value = res.data.data
    // 默认显示有值的那个
    if (!task.value?.receiver_wechat_qr && task.value?.receiver_alipay_qr) {
      activeQr.value = 'alipay'
    }
  } catch {
    error.value = '加载失败，请返回重试'
  } finally {
    loading.value = false
  }
})

const currentQr = computed(() => {
  if (!task.value) return null
  return activeQr.value === 'wechat'
    ? task.value.receiver_wechat_qr
    : task.value.receiver_alipay_qr
})

const hasWechat = computed(() => !!task.value?.receiver_wechat_qr)
const hasAlipay = computed(() => !!task.value?.receiver_alipay_qr)

function getTypeMeta(type) {
  if (type === 'jian_dian')        return { label: '见点奖',   color: '#f0a500', icon: '👑', to: '老板直接收款' }
  if (type === 'bang_fu')          return { label: '帮扶奖',   color: '#48bb78', icon: '🤝', to: '出局老板直接收款' }
  if (type === 'bang_fu_subsidy')  return { label: '帮扶奖',   color: '#48bb78', icon: '🤝', to: '生活补贴参与者直接收款' }
  if (type === 'bang_fu_admin')    return { label: '帮扶预留', color: '#a0aec0', icon: '🏦', to: '预留给生活补贴参与者（管理员代转）' }
  const lv = type.replace('ping_ji_node_', '')
  return { label: `平级第${lv}层`, color: '#4299e1', icon: '📊', to: `平级奖直接收款` }
}

async function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  // 本地预览
  previewUrl.value = URL.createObjectURL(file)

  uploading.value = true
  error.value = ''
  try {
    // 先上传到 Supabase 获取 URL
    const fd = new FormData()
    fd.append('file', file)
    const uploadRes = await axios.post('/api/upload?type=image', fd)
    const screenshotUrl = uploadRes.data.data.url

    // 提交截图
    await axios.post('/api/orders/upload-screenshot', {
      taskId: route.params.taskId,
      screenshotUrl,
    })
    task.value.status = 'screenshot_uploaded'
    task.value.screenshot_url = screenshotUrl
  } catch {
    error.value = '上传失败，请重试'
    previewUrl.value = ''
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="page">

    <!-- 顶部导航 -->
    <div class="top-bar">
      <button class="back-btn" @click="router.back()">←</button>
      <span class="top-title">点对点打款</span>
      <div class="p2p-badge">🔒 P2P直达</div>
    </div>

    <div v-if="loading" class="loading">
      <div class="loading-spin"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="error && !task" class="error-page">
      <p>{{ error }}</p>
      <button @click="router.back()">返回</button>
    </div>

    <template v-else-if="task">

      <!-- P2P 说明横幅 -->
      <div class="p2p-banner">
        <span class="banner-icon">💸</span>
        <div class="banner-text">
          <div class="banner-title">你的钱直接打给真实用户</div>
          <div class="banner-sub">平台不经手，不收手续费，100%点对点</div>
        </div>
      </div>

      <!-- 金额卡片 -->
      <div class="amount-card">
        <div class="type-row">
          <span class="type-icon">{{ getTypeMeta(task.type).icon }}</span>
          <span class="type-label" :style="{ color: getTypeMeta(task.type).color }">
            {{ getTypeMeta(task.type).label }}
          </span>
        </div>
        <div class="amount-big">¥{{ task.amount }}</div>
        <div class="amount-to">→ {{ getTypeMeta(task.type).to }}</div>
        <div class="receiver-row">
          收款方：<strong>#{{ task.receiver_no }}</strong>
        </div>
      </div>

      <!-- 已上传状态 -->
      <div v-if="task.status === 'screenshot_uploaded'" class="done-card">
        <div class="done-icon">✅</div>
        <div class="done-title">截图已上传</div>
        <div class="done-sub">等待收款方确认（30分钟内）</div>
        <img v-if="task.screenshot_url" :src="task.screenshot_url" class="done-screenshot" />
        <button class="btn-back" @click="router.back()">← 返回收款清单</button>
      </div>

      <template v-else>
        <!-- 扫码区域 -->
        <div class="qr-card">
          <div class="qr-header">
            <span class="qr-title">📱 扫码打款</span>
            <div class="qr-tabs">
              <button
                v-if="hasWechat"
                :class="['qr-tab', activeQr==='wechat' ? 'active-wechat' : '']"
                @click="activeQr='wechat'"
              >微信</button>
              <button
                v-if="hasAlipay"
                :class="['qr-tab', activeQr==='alipay' ? 'active-alipay' : '']"
                @click="activeQr='alipay'"
              >支付宝</button>
            </div>
          </div>

          <div v-if="currentQr" class="qr-wrap">
            <img :src="currentQr" class="qr-img" />
            <div class="qr-amount-hint">打款金额：<strong>¥{{ task.amount }}</strong></div>
            <div class="qr-steps">
              <span>① 截图保存二维码</span>
              <span>→</span>
              <span>② 打开{{ activeQr==='wechat' ? '微信' : '支付宝' }}扫码</span>
              <span>→</span>
              <span>③ 输入金额 ¥{{ task.amount }}</span>
            </div>
          </div>
          <div v-else class="no-qr">
            <div class="no-qr-icon">⚠️</div>
            <p>收款方暂未上传收款码</p>
            <p class="no-qr-hint">请联系收款方 #{{ task.receiver_no }} 上传收款码后再打款</p>
          </div>
        </div>

        <!-- 上传截图 -->
        <div class="upload-card">
          <div class="upload-title">📷 上传打款截图</div>
          <div class="upload-sub">打款完成后，截图作为凭证上传</div>

          <!-- 截图预览 -->
          <div v-if="previewUrl" class="preview-wrap">
            <img :src="previewUrl" class="preview-img" />
            <div v-if="uploading" class="uploading-overlay">
              <div class="uploading-spin"></div>
              <span>上传中...</span>
            </div>
          </div>

          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="handleFileSelect" />

          <button
            class="btn-upload"
            :disabled="uploading"
            @click="fileInput.click()"
          >
            <span v-if="uploading">⏳ 上传中...</span>
            <span v-else>{{ previewUrl ? '🔄 重新选择截图' : '📸 选择打款截图' }}</span>
          </button>

          <p v-if="error" class="err-msg">{{ error }}</p>

          <div class="upload-notice">
            <div class="notice-item">⏰ 上传截图后对方需在30分钟内确认</div>
            <div class="notice-item">🔒 截图仅用于核实，平台不存储金融信息</div>
          </div>
        </div>

      </template>

    </template>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: #f5f7fa; padding-bottom: 30px; }

/* 顶部 */
.top-bar { display:flex; align-items:center; gap:10px; padding:14px 16px; background:#fff; border-bottom:1px solid #eee; }
.back-btn { background:none; border:none; font-size:20px; cursor:pointer; color:#666; }
.top-title { flex:1; font-size:16px; font-weight:700; }
.p2p-badge { background:#e6f9ee; color:#07C160; font-size:12px; font-weight:600; padding:4px 10px; border-radius:20px; border:1px solid #07C160; }

/* loading */
.loading { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; gap:12px; color:#999; }
.loading-spin { width:40px; height:40px; border:3px solid #f0f0f0; border-top-color:#f0a500; border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.error-page { text-align:center; padding:60px 20px; color:#999; }

/* P2P 横幅 */
.p2p-banner { margin:12px 16px; background:linear-gradient(135deg,#e6f9ee,#d4f5e2); border:1px solid #07C16030; border-radius:14px; padding:12px 14px; display:flex; align-items:center; gap:10px; }
.banner-icon { font-size:24px; flex-shrink:0; }
.banner-title { font-size:14px; font-weight:700; color:#1a7a4a; }
.banner-sub { font-size:11px; color:#2d9c5f; margin-top:1px; }

/* 金额卡片 */
.amount-card { margin:0 16px 12px; background:linear-gradient(135deg,#f0a500,#e08000); border-radius:20px; padding:20px; color:#fff; text-align:center; box-shadow:0 6px 20px rgba(240,165,0,.3); }
.type-row { display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:8px; }
.type-icon { font-size:20px; }
.type-label { font-size:14px; font-weight:700; background:rgba(255,255,255,.25); padding:2px 10px; border-radius:12px; }
.amount-big { font-size:52px; font-weight:800; line-height:1.1; letter-spacing:-1px; }
.amount-to { font-size:12px; opacity:.85; margin-top:4px; }
.receiver-row { margin-top:8px; font-size:13px; opacity:.9; }
.receiver-row strong { font-size:15px; }

/* 完成状态 */
.done-card { margin:0 16px 12px; background:#fff; border-radius:16px; padding:20px; text-align:center; border:2px solid #07C160; }
.done-icon { font-size:40px; }
.done-title { font-size:18px; font-weight:700; color:#07C160; margin:8px 0 4px; }
.done-sub { font-size:13px; color:#888; margin-bottom:14px; }
.done-screenshot { width:100%; max-height:200px; object-fit:contain; border-radius:10px; margin-bottom:14px; border:1px solid #eee; }
.btn-back { padding:10px 24px; background:#f5f5f5; border:none; border-radius:10px; font-size:14px; color:#666; cursor:pointer; }

/* 扫码区域 */
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
.qr-steps { display:flex; align-items:center; justify-content:center; gap:6px; font-size:12px; color:#999; flex-wrap:wrap; padding:8px 0; background:#f9f9f9; border-radius:8px; }

.no-qr { text-align:center; padding:24px 0; color:#999; }
.no-qr-icon { font-size:32px; margin-bottom:8px; }
.no-qr-hint { font-size:12px; color:#bbb; margin-top:4px; }

/* 上传截图 */
.upload-card { margin:0 16px; background:#fff; border-radius:16px; padding:16px; }
.upload-title { font-size:15px; font-weight:700; color:#333; margin-bottom:4px; }
.upload-sub { font-size:12px; color:#999; margin-bottom:14px; }

.preview-wrap { position:relative; margin-bottom:12px; border-radius:12px; overflow:hidden; }
.preview-img { width:100%; max-height:220px; object-fit:contain; display:block; background:#f5f5f5; }
.uploading-overlay { position:absolute; inset:0; background:rgba(0,0,0,.5); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#fff; font-size:14px; }
.uploading-spin { width:28px; height:28px; border:3px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .8s linear infinite; }

.btn-upload { width:100%; padding:15px; background:linear-gradient(135deg,#4299e1,#3182ce); color:#fff; border:none; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer; margin-bottom:12px; }
.btn-upload:disabled { background:#ddd; color:#aaa; }

.err-msg { color:#e53e3e; font-size:13px; text-align:center; margin-bottom:10px; }

.upload-notice { background:#fffbe6; border-radius:8px; padding:10px 12px; }
.notice-item { font-size:12px; color:#8B6000; padding:2px 0; }
</style>

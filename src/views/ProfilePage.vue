<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { apiUrl } from '../utils/apiBase.js'

const store   = useUserStore()
const router  = useRouter()
const qrType  = ref('wechat')
const wechatQr  = ref(null)
const alipayQr  = ref(null)
const uploading = ref(false)
const totalReceived = ref(0)
const needRepurchase = ref(false)

onMounted(async () => {
  try {
    const res = await axios.get('/api/user/profile')
    wechatQr.value  = res.data.data.wechat_qr
    alipayQr.value  = res.data.data.alipay_qr
    totalReceived.value = res.data.data.total_received || 0
    needRepurchase.value = totalReceived.value >= 1500 && !res.data.data.repurchase_pending
  } catch (e) { /* ignore */ }
})

const fileInput = ref(null)
async function uploadQr(e) {
  const file = e.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('qr', file)
    fd.append('type', qrType.value)
    const res = await axios.post('/api/user/upload-qr', fd)
    if (qrType.value === 'wechat') wechatQr.value = res.data.data.url
    else alipayQr.value = res.data.data.url
  } catch (e) {
    alert('上传失败')
  } finally { uploading.value = false }
}

function logout() {
  store.logout()
  router.push('/')
}

// ── 设置安全问题 ──────────────────────────────
const hasSecurityAnswer = computed(() => store.userInfo?.has_security_answer)
const showSetSecurity = ref(false)
const securityInput = ref('')
const securityMsg = ref('')
const securityLoading = ref(false)

async function doSetSecurity() {
  if (!securityInput.value.trim()) { securityMsg.value = '❌ 请输入安全答案'; return }
  securityLoading.value = true; securityMsg.value = ''
  try {
    const res = await fetch(apiUrl('/api/auth/set-security'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + store.token },
      body: JSON.stringify({ securityAnswer: securityInput.value.trim() })
    })
    const data = await res.json()
    if (data.code === 200) {
      securityMsg.value = '✅ 安全答案已保存'
      store.userInfo && (store.userInfo.has_security_answer = true)
      securityInput.value = ''
      setTimeout(() => { showSetSecurity.value = false; securityMsg.value = '' }, 1200)
    } else {
      securityMsg.value = '❌ ' + (data.message || '保存失败')
    }
  } catch { securityMsg.value = '❌ 网络错误，请重试' }
  finally { securityLoading.value = false }
}

// ── 换设备找回账号 ──────────────────────────────
const showRecover = ref(false)
const recoverUserId = ref('')
const recoverAnswer = ref('')
const recoverMsg = ref('')
const recoverLoading = ref(false)

const recoverMsgEl = ref(null)

function showRecoverMsg(msg) {
  recoverMsg.value = msg
  nextTick(() => recoverMsgEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}

async function doRecover() {
  if (!recoverUserId.value.trim()) {
    showRecoverMsg('❌ 请输入ID')
    return
  }
  recoverLoading.value = true
  recoverMsg.value = ''
  try {
    const res = await fetch(apiUrl('/api/auth/recover'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: recoverUserId.value.trim() })
    })
    const data = await res.json()
    if (data.code === 200) {
      store.setToken(data.data.token)
      store.setUserInfo(data.data.user)
      localStorage.setItem('p2p_local_id', data.data.user.user_no)
      showRecoverMsg(`✅ 找回成功！欢迎回来 #${data.data.user.user_no}`)
      setTimeout(() => { showRecover.value = false; router.push('/') }, 1500)
    } else {
      showRecoverMsg('❌ ' + (data.message || '找回失败，请检查ID和答案'))
    }
  } catch (e) {
    showRecoverMsg('❌ 网络错误，请重试')
  } finally { recoverLoading.value = false }
}
</script>

<template>
  <div class="page">
    <h2 class="page-title">👤 我的</h2>

    <!-- 基本信息 -->
    <div class="info-card">
      <div class="id-row">
        <span class="id-label">我的ID</span>
        <span class="id-val">{{ store.userId }}</span>
        <button class="btn-set-security" @click="showSetSecurity = !showSetSecurity">
          {{ hasSecurityAnswer ? '🔐 改密保' : '⚠️ 设密保' }}
        </button>
      </div>

      <!-- 设置安全问题内联表单 -->
      <div v-if="showSetSecurity" class="security-form">
        <div class="security-hint">身份证后6位、母亲姓名等，换设备时用于找回账号</div>
        <input v-model="securityInput" class="recover-input" placeholder="输入安全答案（至少2位）" />
        <button class="recover-btn" :disabled="securityLoading" @click="doSetSecurity">
          {{ securityLoading ? '保存中...' : '保存' }}
        </button>
        <div v-if="securityMsg" :class="['recover-msg', securityMsg.startsWith('✅') ? 'ok' : 'fail']">{{ securityMsg }}</div>
      </div>

      <div class="received-row">
        <span>累计收款</span>
        <span class="received-val">¥{{ totalReceived }}</span>
      </div>
      <div v-if="needRepurchase" class="repurchase-tip">
        ⚠️ 累计收款已达1500元，需要复投激活
        <button class="btn-repurchase" @click="router.push('/activate')">立即复投</button>
      </div>
    </div>

    <!-- 收款码管理 -->
    <div class="qr-card">
      <p class="section-title">我的收款码</p>
      <div class="qr-tabs">
        <button :class="['tab', qrType==='wechat'?'active':'']" @click="qrType='wechat'">微信</button>
        <button :class="['tab', qrType==='alipay'?'active':'']" @click="qrType='alipay'">支付宝</button>
      </div>
      <div class="qr-preview">
        <img v-if="qrType==='wechat' && wechatQr" :src="wechatQr" class="qr-img" />
        <img v-else-if="qrType==='alipay' && alipayQr" :src="alipayQr" class="qr-img" />
        <div v-else class="qr-empty">未上传</div>
      </div>
      <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="uploadQr" />
      <button class="btn-upload" :disabled="uploading" @click="fileInput.click()">
        {{ uploading ? '上传中...' : '上传收款码' }}
      </button>
    </div>

    <!-- 换设备找回账号 -->
    <button class="btn-recover" @click="showRecover = !showRecover">📱 换设备？找回我的账号</button>

    <div v-if="showRecover" class="recover-card">
      <div class="recover-title">🔑 切换账号</div>
      <div class="recover-sub">输入你的ID，直接切换登录</div>
      <input v-model="recoverUserId" class="recover-input" placeholder="我的ID（如 830274）" type="number" />
      <div v-if="recoverMsg" ref="recoverMsgEl" :class="['recover-msg', recoverMsg.startsWith('✅') ? 'ok' : 'fail']">{{ recoverMsg }}</div>
      <button class="recover-btn" :disabled="recoverLoading" @click="doRecover">
        {{ recoverLoading ? '切换中...' : '立即切换' }}
      </button>
    </div>

    <button class="btn-logout" @click="logout">退出登录</button>
  </div>
</template>

<style scoped>
.page { padding: 20px; }
.page-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; }
.info-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.id-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.id-label { color: #999; font-size: 14px; }
.id-val { font-size: 20px; font-weight: 700; letter-spacing: 2px; }
.received-row { display: flex; justify-content: space-between; align-items: center; }
.received-val { font-size: 22px; font-weight: 700; color: #f0a500; }
.repurchase-tip { margin-top: 12px; padding: 12px; background: #fff5f5; border-radius: 8px; color: #e53e3e; font-size: 14px; }
.btn-repurchase { display: block; margin-top: 8px; width: 100%; padding: 10px; background: #e53e3e; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
.qr-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.section-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.qr-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.tab { padding: 6px 20px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 14px; }
.tab.active { background: #f0a500; color: #fff; border-color: #f0a500; }
.qr-preview { text-align: center; padding: 16px 0; }
.qr-img { width: 160px; height: 160px; object-fit: contain; border-radius: 8px; border: 1px solid #f0f0f0; }
.qr-empty { width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; background: #f9f9f9; border-radius: 8px; color: #ccc; font-size: 14px; margin: 0 auto; }
.btn-upload { width: 100%; padding: 12px; background: #4299e1; color: #fff; border: none; border-radius: 10px; font-size: 15px; cursor: pointer; }
.btn-recover { width: 100%; padding: 12px; background: #fff; color: #1976d2; border: 1px solid #1976d2; border-radius: 10px; font-size: 14px; cursor: pointer; margin-bottom: 10px; }
.recover-card { background: #f0f7ff; border: 1px solid #90cdf4; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.recover-title { font-size: 15px; font-weight: 700; color: #1976d2; margin-bottom: 4px; }
.recover-sub { font-size: 12px; color: #666; margin-bottom: 12px; }
.recover-input { width: 100%; padding: 11px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; margin-bottom: 10px; outline: none; box-sizing: border-box; }
.recover-btn { width: 100%; padding: 12px; background: #1976d2; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
.recover-btn:disabled { background: #ddd; color: #aaa; }
.recover-msg { margin-top: 10px; padding: 8px 10px; border-radius: 8px; font-size: 13px; }
.recover-msg.ok { background: #c6f6d5; color: #276749; }
.recover-msg.fail { background: #fed7d7; color: #9b2c2c; }
.btn-logout { width: 100%; padding: 12px; background: #fff; color: #e53e3e; border: 1px solid #e53e3e; border-radius: 10px; font-size: 15px; cursor: pointer; }
.btn-set-security { margin-left: auto; padding: 4px 10px; background: #fff; border: 1px solid #f0a500; color: #f0a500; border-radius: 14px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.security-form { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
.security-hint { font-size: 12px; color: #999; margin-bottom: 10px; }
</style>

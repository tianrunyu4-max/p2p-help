<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import { useRouter } from 'vue-router'
import axios from 'axios'

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
</script>

<template>
  <div class="page">
    <h2 class="page-title">👤 我的</h2>

    <!-- 基本信息 -->
    <div class="info-card">
      <div class="id-row">
        <span class="id-label">我的ID</span>
        <span class="id-val">{{ store.userId }}</span>
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
.btn-logout { width: 100%; padding: 12px; background: #fff; color: #e53e3e; border: 1px solid #e53e3e; border-radius: 10px; font-size: 15px; cursor: pointer; }
</style>

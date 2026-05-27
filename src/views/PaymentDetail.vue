<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route  = useRoute()
const router = useRouter()
const task   = ref(null)
const loading = ref(true)
const uploading = ref(false)
const error   = ref('')
const fileInput = ref(null)

onMounted(async () => {
  try {
    const res = await axios.get(`/api/orders/task/${route.params.taskId}`)
    task.value = res.data.data
  } catch (e) {
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
})

async function uploadScreenshot(e) {
  const file = e.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('screenshot', file)
    fd.append('taskId', route.params.taskId)
    await axios.post('/api/orders/upload-screenshot', fd)
    task.value.status = 'screenshot_uploaded'
    router.back()
  } catch (err) {
    error.value = '上传失败，请重试'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <button class="back-btn" @click="router.back()">←</button>
      <h2>打款详情</h2>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else-if="task">
      <div class="amount-card">
        <span class="amount-label">需打款金额</span>
        <span class="amount-value">¥{{ task.amount }}</span>
        <span class="amount-type">{{ task.type_label }}</span>
      </div>

      <!-- 收款码 -->
      <div class="qr-section">
        <p class="section-title">扫码打款</p>
        <div class="qr-tabs">
          <button
            v-if="task.receiver_wechat_qr"
            class="qr-tab active"
          >微信</button>
          <button
            v-if="task.receiver_alipay_qr"
            class="qr-tab"
          >支付宝</button>
        </div>
        <div class="qr-wrap">
          <img :src="task.receiver_wechat_qr || task.receiver_alipay_qr" class="qr-img" />
        </div>
        <p class="qr-tip">截图保存后，打开微信/支付宝扫码</p>
      </div>

      <!-- 上传截图 -->
      <div class="upload-section">
        <p class="section-title">上传打款截图</p>
        <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="uploadScreenshot" />
        <button class="btn-upload" :disabled="uploading" @click="fileInput.click()">
          {{ uploading ? '上传中...' : '📸 选择截图上传' }}
        </button>
        <p class="upload-tip">打款后30分钟内对方确认，超时自动介入</p>
        <p v-if="error" class="err-msg">{{ error }}</p>
      </div>

      <!-- 收款方信息 -->
      <div class="receiver-info">
        <span>收款方ID：#{{ task.receiver_no }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 16px; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.back-btn { background: none; border: none; font-size: 20px; cursor: pointer; }
h2 { font-size: 18px; font-weight: 700; }
.loading { text-align: center; padding: 40px; color: #999; }
.amount-card { background: linear-gradient(135deg,#f0a500,#e08000); border-radius: 16px; padding: 24px; color: #fff; text-align: center; margin-bottom: 20px; }
.amount-label { display: block; font-size: 13px; opacity: .8; margin-bottom: 4px; }
.amount-value { display: block; font-size: 48px; font-weight: 700; }
.amount-type { display: block; font-size: 13px; opacity: .8; margin-top: 4px; }
.section-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #333; }
.qr-section, .upload-section { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid #f0f0f0; }
.qr-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.qr-tab { padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px; background: #fff; font-size: 13px; cursor: pointer; }
.qr-tab.active { background: #f0a500; color: #fff; border-color: #f0a500; }
.qr-wrap { text-align: center; padding: 16px 0; }
.qr-img { width: 200px; height: 200px; object-fit: contain; border-radius: 8px; }
.qr-tip { text-align: center; font-size: 12px; color: #999; }
.btn-upload { width: 100%; padding: 14px; background: #4299e1; color: #fff; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; }
.upload-tip { text-align: center; font-size: 12px; color: #999; margin-top: 8px; }
.err-msg { color: #e53e3e; font-size: 13px; margin-top: 8px; text-align: center; }
.receiver-info { text-align: center; color: #999; font-size: 13px; padding: 8px; }
</style>

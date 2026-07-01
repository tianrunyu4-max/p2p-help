<template>
  <div class="payment-address-page">
    <!-- 顶部导航 -->
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">收款地址</h1>
      <div class="placeholder"></div>
    </div>

    <!-- 主要内容 -->
    <div class="page-content">
      <p class="page-desc">设置您的加密货币收款地址，用于接收提现和转账</p>

      <!-- 币安链 BSC -->
      <div class="chain-card">
        <div class="chain-header">
          <div class="chain-logo bsc">
            <span>BSC</span>
          </div>
          <div class="chain-info">
            <h3>币安智能链 (BSC)</h3>
            <p>BEP-20 Token</p>
          </div>
        </div>

        <div class="chain-form">
          <div class="form-group">
            <label>钱包地址</label>
            <input 
              v-model="bscAddress" 
              type="text" 
              placeholder="请输入BSC钱包地址 (0x...)"
            />
          </div>

          <div class="form-group">
            <label>收款二维码</label>
            <div class="qr-upload" @click="triggerBscUpload">
              <input 
                ref="bscInput" 
                type="file" 
                accept="image/*" 
                style="display: none;"
                @change="handleBscUpload"
              />
              <img v-if="bscQrImage" :src="bscQrImage" class="qr-preview" />
              <div v-else class="upload-placeholder">
                <span class="upload-icon">📷</span>
                <span class="upload-text">点击上传二维码</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 保存按钮 -->
      <button class="save-btn" @click="saveAddresses" :disabled="isLoading">
        {{ isLoading ? '保存中...' : '保存地址' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const bscAddress = ref('')
const bscQrImage = ref('')
const isLoading = ref(false)

const bscInput = ref(null)

const triggerBscUpload = () => {
  bscInput.value?.click()
}

const handleBscUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  if (file.size > 2 * 1024 * 1024) {
    alert('图片大小不能超过2MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    bscQrImage.value = e.target.result
  }
  reader.readAsDataURL(file)
}

const saveAddresses = async () => {
  if (!bscAddress.value) {
    alert('请填写BSC收款地址')
    return
  }

  isLoading.value = true
  try {
    // TODO: 调用后端保存API
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('保存成功')
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败，请重试')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.payment-address-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #F5F5F5;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #FFFFFF;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: #000;
}

.placeholder {
  width: 36px;
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.page-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
}

/* 链卡片 */
.chain-card {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.chain-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.chain-logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #FFFFFF;
}

.chain-logo.bsc {
  background: linear-gradient(135deg, #F0B90B 0%, #E5A800 100%);
}


.chain-info h3 {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px 0;
}

.chain-info p {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.chain-form .form-group {
  margin-bottom: 16px;
}

.chain-form .form-group:last-child {
  margin-bottom: 0;
}

.chain-form label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.chain-form input {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  font-family: monospace;
}

.chain-form input:focus {
  border-color: #07C160;
}

/* 二维码上传 */
.qr-upload {
  width: 120px;
  height: 120px;
  border: 2px dashed rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.qr-upload:hover {
  border-color: #07C160;
  background: rgba(7, 193, 96, 0.05);
}

.qr-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon {
  font-size: 32px;
}

.upload-text {
  font-size: 12px;
  color: #999;
}

/* 保存按钮 */
.save-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
  border: none;
  border-radius: 10px;
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
}
</style>

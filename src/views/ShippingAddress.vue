<template>
  <div class="shipping-address-page">
    <!-- 顶部导航 -->
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">收货地址</h1>
      <button class="add-btn" @click="showAddModal = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- 地址列表 -->
    <div class="page-content">
      <div v-if="addresses.length === 0" class="empty-state">
        <span class="empty-icon">📦</span>
        <p class="empty-text">暂无收货地址</p>
        <button class="add-first-btn" @click="showAddModal = true">添加地址</button>
      </div>

      <div v-else class="address-list">
        <div 
          v-for="addr in addresses" 
          :key="addr.id" 
          class="address-item"
          :class="{ 'is-default': addr.isDefault }"
        >
          <div class="address-content" @click="editAddress(addr)">
            <div class="address-header">
              <span class="address-name">{{ addr.name }}</span>
              <span class="address-phone">{{ addr.phone }}</span>
              <span v-if="addr.isDefault" class="default-tag">默认</span>
            </div>
            <div class="address-detail">
              {{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.address }}
            </div>
          </div>
          <div class="address-actions">
            <button class="action-btn" @click="setDefault(addr)" v-if="!addr.isDefault">
              设为默认
            </button>
            <button class="action-btn delete" @click="deleteAddress(addr)">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <transition name="fade">
      <div v-if="showAddModal" class="modal-overlay" @click="showAddModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ editingId ? '编辑地址' : '添加地址' }}</h3>
            <button class="modal-close" @click="showAddModal = false">✕</button>
          </div>
          
          <div class="modal-body">
            <div class="form-group">
              <label>收货人</label>
              <input v-model="form.name" type="text" placeholder="请输入收货人姓名" />
            </div>
            <div class="form-group">
              <label>手机号</label>
              <input v-model="form.phone" type="tel" placeholder="请输入手机号" />
            </div>
            <div class="form-group">
              <label>所在地区</label>
              <div class="region-inputs">
                <input v-model="form.province" type="text" placeholder="省份" />
                <input v-model="form.city" type="text" placeholder="城市" />
                <input v-model="form.district" type="text" placeholder="区县" />
              </div>
            </div>
            <div class="form-group">
              <label>详细地址</label>
              <textarea v-model="form.address" placeholder="请输入详细地址"></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button class="save-btn" @click="saveAddress">保存</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const addresses = ref([])
const showAddModal = ref(false)
const editingId = ref(null)

const form = reactive({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  address: ''
})

const resetForm = () => {
  form.name = ''
  form.phone = ''
  form.province = ''
  form.city = ''
  form.district = ''
  form.address = ''
  editingId.value = null
}

const saveAddress = () => {
  if (!form.name || !form.phone || !form.address) {
    alert('请填写完整信息')
    return
  }

  if (editingId.value) {
    // 编辑
    const idx = addresses.value.findIndex(a => a.id === editingId.value)
    if (idx > -1) {
      addresses.value[idx] = { ...addresses.value[idx], ...form }
    }
  } else {
    // 新增
    addresses.value.push({
      id: Date.now(),
      ...form,
      isDefault: addresses.value.length === 0
    })
  }

  showAddModal.value = false
  resetForm()
  
  // TODO: 调用后端保存API
}

const editAddress = (addr) => {
  editingId.value = addr.id
  Object.assign(form, addr)
  showAddModal.value = true
}

const setDefault = (addr) => {
  addresses.value.forEach(a => a.isDefault = false)
  addr.isDefault = true
  // TODO: 调用后端API
}

const deleteAddress = (addr) => {
  if (confirm('确定删除此地址？')) {
    addresses.value = addresses.value.filter(a => a.id !== addr.id)
    // TODO: 调用后端API
  }
}
</script>

<style scoped>
.shipping-address-page {
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

.back-btn, .add-btn {
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

.add-btn {
  color: #07C160;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: #000;
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  display: block;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 15px;
  color: #999;
  margin-bottom: 20px;
}

.add-first-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
  border: none;
  border-radius: 24px;
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

/* 地址列表 */
.address-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.address-item {
  background: #FFFFFF;
  border-radius: 12px;
  overflow: hidden;
}

.address-item.is-default {
  border: 2px solid #07C160;
}

.address-content {
  padding: 16px;
  cursor: pointer;
}

.address-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.address-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.address-phone {
  font-size: 14px;
  color: #666;
}

.default-tag {
  font-size: 11px;
  color: #07C160;
  background: rgba(7, 193, 96, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.address-detail {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.address-actions {
  display: flex;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.action-btn {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #F5F5F5;
}

.action-btn.delete {
  color: #FF4D4F;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-width: 28rem;
  background: #FFFFFF;
  border-radius: 16px 16px 0 0;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.modal-header h3 {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #07C160;
}

.form-group textarea {
  min-height: 80px;
  resize: none;
}

.region-inputs {
  display: flex;
  gap: 8px;
}

.region-inputs input {
  flex: 1;
}

.modal-footer {
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

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
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

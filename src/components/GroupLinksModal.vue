<template>
  <!-- 浮窗按钮 -->
  <div class="group-fab-wrap">
    <transition name="group-fab-pop">
      <div v-if="showModal" class="group-modal-overlay" @click.self="showModal = false">
        <div class="group-modal">
          <div class="group-modal-header">
            <span class="group-modal-title">加入社群</span>
            <button class="group-modal-close" @click="showModal = false">✕</button>
          </div>

          <div v-if="loading" class="group-loading">加载中...</div>
          <div v-else-if="groups.length === 0" class="group-empty">暂无群信息</div>
          <div v-else class="group-list">
            <div v-for="g in groups" :key="g.type" class="group-card">
              <div class="group-card-header">
                <span class="group-platform-badge" :class="g.type">
                  {{ g.type === 'whatsapp' ? '📱 WhatsApp' : '💬 WeChat' }}
                </span>
              </div>
              <div class="group-name">{{ g.name }}</div>
              <div v-if="g.price && g.price !== '0' && g.price !== '免费'" class="group-price">
                入群费：{{ g.price }}
              </div>
              <div v-else class="group-price free">免费加入</div>
              <div v-if="g.qr_url" class="group-qr-wrap">
                <img :src="g.qr_url" class="group-qr-img" alt="二维码" />
                <p class="group-qr-hint">扫码加群</p>
              </div>
              <div v-else class="group-qr-placeholder">暂无二维码</div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 悬浮按钮 -->
    <button class="group-fab" @click="toggleModal" title="加入社群">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <span class="group-fab-label">群</span>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const showModal = ref(false)
const loading = ref(false)
const groups = ref([])
let loaded = false

async function loadGroups() {
  if (loaded) return
  loading.value = true
  try {
    const res = await fetch('/api/groups')
    const data = await res.json()
    if (data.code === 200) {
      groups.value = data.data || []
      loaded = true
    }
  } catch {
    groups.value = []
  } finally {
    loading.value = false
  }
}

function toggleModal() {
  showModal.value = !showModal.value
  if (showModal.value) loadGroups()
}
</script>

<style scoped>
.group-fab-wrap {
  position: fixed;
  right: 16px;
  bottom: 100px;
  z-index: 900;
}

.group-fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #25D366 60%, #128C7E);
  border: none;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(37,211,102,0.5);
  transition: transform 0.2s;
}
.group-fab:active { transform: scale(0.93); }
.group-fab-label {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

/* 弹窗遮罩 */
.group-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 9000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* 弹窗主体 */
.group-modal {
  background: #fff;
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 430px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 20px 16px 32px;
  box-sizing: border-box;
}
.group-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.group-modal-title {
  font-size: 17px;
  font-weight: 700;
  color: #111;
}
.group-modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #888;
  cursor: pointer;
  padding: 4px;
}

.group-loading,
.group-empty {
  text-align: center;
  color: #999;
  padding: 32px 0;
  font-size: 14px;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-card {
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}
.group-card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}
.group-platform-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
}
.group-platform-badge.whatsapp {
  background: #e8faf0;
  color: #128C7E;
}
.group-platform-badge.wechat {
  background: #e8f4e8;
  color: #07C160;
}
.group-name {
  font-size: 15px;
  font-weight: 600;
  color: #222;
  margin-bottom: 4px;
}
.group-price {
  font-size: 13px;
  color: #e6841a;
  margin-bottom: 12px;
  font-weight: 500;
}
.group-price.free {
  color: #07C160;
}
.group-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.group-qr-img {
  width: 160px;
  height: 160px;
  object-fit: contain;
  border: 1px solid #eee;
  border-radius: 8px;
}
.group-qr-hint {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}
.group-qr-placeholder {
  color: #ccc;
  font-size: 13px;
  padding: 20px 0;
}

/* 动画 */
.group-fab-pop-enter-active,
.group-fab-pop-leave-active {
  transition: opacity 0.2s, transform 0.25s;
}
.group-fab-pop-enter-from,
.group-fab-pop-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>

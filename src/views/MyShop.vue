<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'

const router = useRouter()
const store  = useUserStore()
const shop   = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await axios.get('/api/shop/my')
    shop.value = res.data.data
  } catch (e) { /* ignore */ } finally { loading.value = false }
})

function copyCode(code) {
  navigator.clipboard.writeText(code)
  alert('已复制：' + code)
}
</script>

<template>
  <div class="page">
    <h2 class="page-title">🏪 我的店铺</h2>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else-if="shop">
      <!-- 店主位 -->
      <div class="slot-card owner">
        <div class="slot-header">
          <span class="crown">👑</span>
          <span class="slot-role">店主</span>
          <span class="slot-tip">永久拿见点奖 · 不出局</span>
        </div>
        <div class="user-avatar">👑</div>
        <div class="user-id">{{ shop.owner_no }}</div>
        <div class="invite-row">
          <span class="invite-label">邀请码：</span>
          <span class="invite-code">{{ shop.owner_invite_code }}</span>
          <button class="copy-btn" @click="copyCode(shop.owner_invite_code)">复制</button>
        </div>
        <div class="invite-used">已邀请 {{ shop.owner_invite_used }}/2 人</div>
      </div>

      <div class="connector-line"></div>

      <!-- 店长位 -->
      <div class="slot-card manager" :class="{ empty: !shop.tenant_no }">
        <div class="slot-header">
          <span class="shirt">👔</span>
          <span class="slot-role">店长</span>
          <span class="slot-tip">推满1人出局开店</span>
        </div>
        <template v-if="shop.tenant_no">
          <div class="user-avatar manager-av">👔</div>
          <div class="user-id">{{ shop.tenant_no }}</div>
          <div class="invite-row">
            <span class="invite-label">邀请码：</span>
            <span class="invite-code">{{ shop.tenant_invite_code }}</span>
            <button class="copy-btn" @click="copyCode(shop.tenant_invite_code)">复制</button>
          </div>
        </template>
        <template v-else>
          <div class="empty-slot">虚位以待</div>
          <div class="my-invite">
            <span>我的邀请码：</span>
            <strong>{{ store.userInfo?.invite_code }}</strong>
            <button class="copy-btn" @click="copyCode(store.userInfo?.invite_code)">复制</button>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 20px; }
.page-title { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
.loading { text-align: center; padding: 40px; color: #999; }
.slot-card { border-radius: 16px; padding: 20px; text-align: center; }
.slot-card.owner { background: #fffbea; border: 2px solid #f0a500; }
.slot-card.manager { background: #f0fff4; border: 2px dashed #48bb78; }
.slot-card.empty { opacity: .8; }
.slot-header { display: flex; align-items: center; gap: 6px; justify-content: center; margin-bottom: 16px; }
.slot-role { font-weight: 700; font-size: 16px; }
.slot-tip { font-size: 12px; color: #999; }
.user-avatar { font-size: 48px; margin-bottom: 8px; }
.manager-av { filter: none; }
.user-id { font-size: 24px; font-weight: 700; letter-spacing: 2px; margin-bottom: 8px; }
.invite-row { display: flex; align-items: center; gap: 6px; justify-content: center; margin-top: 8px; }
.invite-label { font-size: 13px; color: #666; }
.invite-code { font-weight: 700; font-size: 15px; }
.copy-btn { padding: 4px 12px; border: 1px solid #f0a500; border-radius: 20px; background: #fff; color: #f0a500; font-size: 12px; cursor: pointer; }
.invite-used { font-size: 12px; color: #999; margin-top: 6px; }
.connector-line { width: 2px; height: 32px; background: #f0a500; margin: 0 auto; }
.empty-slot { font-size: 16px; color: #ccc; margin: 16px 0; }
.my-invite { display: flex; align-items: center; gap: 6px; justify-content: center; font-size: 14px; }
</style>

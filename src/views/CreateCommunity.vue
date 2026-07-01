<template>
  <div class="create-community-page">
    <!-- 顶部导航 -->
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">创建社区</h1>
      <div class="placeholder"></div>
    </div>

    <!-- 主要内容 -->
    <div class="page-content">
      <!-- VIP 提示（点击跳转到订阅管理） -->
      <div class="vip-notice" style="cursor:pointer" @click="router.push('/team')">
        <span class="vip-icon">👑</span>
        <span class="vip-text">订阅会员可创建私聊社群 → 点击管理订阅</span>
      </div>

      <!-- 创建表单 -->
      <div class="create-form">
        <div class="form-group">
          <label class="form-label">输入对方ID</label>
          <div class="input-wrapper">
            <input 
              v-model="targetUserId" 
              type="text" 
              class="form-input"
              placeholder="请输入要创建私聊的用户ID"
            />
          </div>
          <p class="form-hint">输入ID后将创建一个私聊社群，最多可容纳1000人</p>
        </div>

        <button 
          class="create-btn" 
          :disabled="!targetUserId.trim() || isLoading"
          @click="handleCreate"
        >
          <span v-if="isLoading">创建中...</span>
          <span v-else>创建社群</span>
        </button>
      </div>

      <!-- 已创建的社群列表 -->
      <div class="community-list">
        <h2 class="list-title">我的社群</h2>
        
        <div v-if="communities.length === 0" class="empty-state">
          <span class="empty-icon">💬</span>
          <p class="empty-text">暂无私聊社群</p>
        </div>

        <div v-else class="community-items">
          <div 
            v-for="community in communities" 
            :key="community.id" 
            class="community-item"
            @click="enterCommunity(community)"
          >
            <div class="community-avatar">
              {{ community.name.charAt(0) }}
            </div>
            <div class="community-info">
              <div class="community-name">{{ community.name }}</div>
              <div class="community-members">{{ community.memberCount }}/1000 成员</div>
            </div>
            <svg class="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { createCommunity, fetchCommunities } from '../services/supabaseMessageService'
import { useUserStore } from '../stores/userStore.js'

const router = useRouter()
const userStore = useUserStore()

// 获取当前用户信息 (从 localStorage)
const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('userData')
    if (userData) {
      return JSON.parse(userData)
    }
  } catch (e) {
    console.warn('解析用户数据失败', e)
  }
  return { id: localStorage.getItem('chatUserId') }
}

const currentUser = ref(getCurrentUser())

const targetUserId = ref('')
const isLoading = ref(false)
const communities = ref([])

// 加载社群列表
onMounted(() => {
  if (currentUser.value?.id) {
    loadCommunities()
  } else {
    // 简单的重试机制，等待用户登录
    setTimeout(() => {
      if (currentUser.value?.id) loadCommunities()
    }, 1000)
  }
})

const loadCommunities = async () => {
  if (!currentUser.value?.id) return
  
  isLoading.value = true
  try {
    const list = await fetchCommunities(currentUser.value.id)
    communities.value = list
  } catch (error) {
    console.error('加载社群列表失败:', error)
  } finally {
    isLoading.value = false
  }
}

const handleCreate = async () => {
  if (!targetUserId.value.trim()) return
  if (!currentUser.value?.id) {
    alert('请先登录')
    return
  }
  if (!userStore.isActivated) {
    router.push('/team')
    return
  }
  
  isLoading.value = true
  try {
    // 调用真实 API 创建社群
    const community = await createCommunity(
      `私聊-${targetUserId.value}`, // 默认名称
      currentUser.value.id,
      targetUserId.value,
      'private'
    )

    if (community) {
      alert(`✅ 社群创建成功！\n已与用户 ${targetUserId.value} 建立私聊社群`)
      targetUserId.value = ''
      loadCommunities()
    } else {
      throw new Error('创建失败')
    }
  } catch (error) {
    console.error('创建社群失败:', error)
    alert('创建失败，请确保用户ID存在且网络正常')
  } finally {
    isLoading.value = false
  }
}

const enterCommunity = (community) => {
  router.push(`/private-chat/${community.id}`)
}
</script>

<style scoped>
.create-community-page {
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

/* VIP 提示 */
.vip-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #FFF4E6 0%, #FFE7BA 100%);
  border-radius: 12px;
  margin-bottom: 20px;
}

.vip-icon {
  font-size: 20px;
}

.vip-text {
  font-size: 14px;
  color: #996300;
  font-weight: 500;
}

/* 创建表单 */
.create-form {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.input-wrapper {
  position: relative;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #07C160;
  box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.1);
}

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.create-btn {
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
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
}

/* 社群列表 */
.community-list {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
}

.list-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  color: #999;
}

.community-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.community-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #F8F9FA;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.community-item:hover {
  background: #F0F2F5;
}

.community-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
}

.community-info {
  flex: 1;
}

.community-name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.community-members {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.arrow-icon {
  color: #CCC;
}
</style>

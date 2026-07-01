<template>
  <div class="private-chat-page">
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">{{ communityName }}</h1>
      <button class="menu-btn" @click="showMenu = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div v-for="msg in messages" :key="msg.id" :class="['message-item', msg.isSelf ? 'message-right' : 'message-left']">
        <div class="avatar">{{ msg.userName.charAt(0) }}</div>
        <div class="message-bubble">
          <div class="message-text">{{ msg.content }}</div>
          <div class="message-time">{{ msg.time }}</div>
        </div>
      </div>
      <div ref="messagesEnd"></div>
    </div>

    <div class="chat-input-bar">
      <button class="plus-btn" @click="showMediaMenu = !showMediaMenu">+</button>
      <input v-model="inputText" type="text" class="message-input" placeholder="说点什么..." @keyup.enter="sendMessage"/>
      <button v-if="inputText.trim()" class="send-btn" @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MessageService } from '../logic/messageService' // 直接导入类，每个私聊创建独立实例

const route = useRoute()
const communityId = route.params.id
const communityName = ref('私聊社群')

// 获取当前用户信息
const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('userData')
    if (userData) {
      return JSON.parse(userData)
    }
  } catch (e) {
    console.warn('解析用户数据失败', e)
  }
  return { 
    id: localStorage.getItem('chatUserId'),
    avatarUrl: localStorage.getItem('userAvatarUrl')
  }
}

const currentUser = getCurrentUser()

const messages = ref([])
const inputText = ref('')
const messagesContainer = ref(null)
const messagesEnd = ref(null)
const showMediaMenu = ref(false)
const showMenu = ref(false)

// 创建独立的 MessageService 实例
const messageService = new MessageService(communityId)

onMounted(() => {
  // 订阅消息更新
  messageService.subscribe((newMessages) => {
    messages.value = newMessages
    scrollToBottom()
  })

  // 初始加载
  messages.value = messageService.getMessages()
  scrollToBottom()
  
  // TODO: 可以根据 communityId 获取社群名称
})

onUnmounted(() => {
  // 清理轮询定时器（需要在 MessageService 中暴露 stopPolling 或类似方法，这里简化处理）
  // 实际上 MessageService 实例会被回收，如果 pollingTimer 是实例属性的话
  if (messageService.pollingTimer) {
    clearInterval(messageService.pollingTimer)
  }
})

const scrollToBottom = () => {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

const sendMessage = () => {
  if (!inputText.value.trim()) return

  messageService.addUserMessage(
    inputText.value,
    currentUser?.id || '用户', // 使用当前用户ID或名字
    currentUser?.id,
    currentUser?.avatarUrl
  )
  
  inputText.value = ''
  scrollToBottom()
}
</script>

<style scoped>
.private-chat-page { height: 100%; display: flex; flex-direction: column; background: #F5F5F5; }
.page-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #FFF; border-bottom: 1px solid rgba(0,0,0,0.08); }
.back-btn, .menu-btn { width: 36px; height: 36px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #333; }
.page-title { font-size: 17px; font-weight: 600; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px 12px; display: flex; flex-direction: column; gap: 12px; }
.message-item { display: flex; gap: 8px; max-width: 80%; }
.message-left { align-self: flex-start; }
.message-right { align-self: flex-end; flex-direction: row-reverse; }
.avatar { width: 40px; height: 40px; border-radius: 6px; background: linear-gradient(135deg, #07C160, #06AD56); color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; }
.message-bubble { padding: 10px 14px; border-radius: 8px; background: #FFF; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.message-right .message-bubble { background: #95EC69; }
.message-text { font-size: 14px; line-height: 1.5; }
.message-time { font-size: 10px; color: rgba(0,0,0,0.4); text-align: right; margin-top: 4px; }
.chat-input-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #FFF; border-top: 1px solid rgba(0,0,0,0.08); }
.plus-btn { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #F7B500, #FFC700); border: none; color: #FFF; font-size: 24px; cursor: pointer; }
.message-input { flex: 1; padding: 8px 12px; background: #FFF; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; font-size: 14px; outline: none; }
.message-input:focus { border-color: #07C160; }
.send-btn { padding: 8px 16px; background: linear-gradient(135deg, #95EC69, #8FD564); border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; }
</style>

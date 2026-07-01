<template>
  <div class="deepsook-page">

    <!-- 顶部头部 -->
    <div class="ds-header">
      <button class="ds-back" @click="router.back()">‹ 返回</button>
      <div class="ds-header-info">
        <img src="/deepsook-avatar.jpg" class="ds-avatar" alt="DeepSook" />
        <div>
          <div class="ds-name">大虾 DeepSook 🦞</div>
          <div class="ds-subtitle">私人财富顾问 · 全球视野</div>
        </div>
      </div>
      <div class="ds-balance-chip">
        <span class="ds-balance-icon">🪙</span>
        <span class="ds-balance-val">{{ balance.toFixed(1) }}</span>
      </div>
    </div>

    <!-- 消息区 -->
    <div class="ds-messages" ref="msgBox">

      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="ds-welcome">
        <img src="/deepsook-avatar.jpg" class="ds-welcome-img" alt="DeepSook" />
        <div class="ds-welcome-text">
          <p>你好！我是大虾DeepSook 🦞</p>
          <p>金融·投资·财富管理，思维灵活，为你量身定制</p>
        </div>
        <div class="ds-quick-btns">
          <button v-for="q in quickQuestions" :key="q" class="ds-quick-btn" @click="sendQuick(q)">{{ q }}</button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-for="msg in messages" :key="msg.id" :class="['ds-msg-row', msg.role]">
        <img v-if="msg.role === 'assistant'" src="/deepsook-avatar.jpg" class="ds-msg-avatar" alt="AI" />
        <div class="ds-bubble" :class="msg.role">
          <span class="ds-bubble-text">{{ msg.content }}</span>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="ds-msg-row assistant">
        <img src="/deepsook-avatar.jpg" class="ds-msg-avatar" alt="AI" />
        <div class="ds-bubble assistant ds-typing">
          <span></span><span></span><span></span>
        </div>
      </div>

    </div>

    <!-- Toast 提示 -->
    <transition name="toast-fade">
      <div v-if="toastMsg" class="ds-toast">{{ toastMsg }}</div>
    </transition>

    <!-- 底部输入 -->
    <div class="ds-input-area">
      <div class="ds-input-row">
        <!-- 麦克风按钮 -->
        <button class="ds-mic-btn" :class="{ recording: isRecording }" @click="toggleVoice" :title="isRecording ? '点击停止' : '语音输入'" :disabled="loading">
          <svg v-if="!isRecording" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7 8a1 1 0 0 1 1 1 8 8 0 0 1-16 0 1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1zm-7 10a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1z"/>
          </svg>
          <span v-else class="mic-wave">●</span>
        </button>

        <textarea
          v-model="inputText"
          class="ds-textarea"
          :placeholder="isRecording ? '🎤 正在听...' : '问采购、跨境、理财...'"
          rows="1"
          :disabled="loading"
          @input="autoResize"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button class="ds-send-btn" :disabled="loading || !inputText.trim()" @click="send">
          <span v-if="loading">⏳</span>
          <span v-else>🦞</span>
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'

const router = useRouter()
const userStore = useUserStore()

const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const msgBox = ref(null)
const isRecording = ref(false)
const toastMsg = ref('')
let recognition = null
let toastTimer = null

function showToast(msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2500)
}

const quickQuestions = [
  '💰 怎么制定家庭理财计划？',
  '📈 加密资产如何稳健配置？',
  '🏦 收入怎么分配才合理？',
  '🌍 跨境汇款有哪些省钱方式？'
]

// 键盘弹出时滚动到底部，避免输入框被遮挡
function onViewportResize() {
  scrollBottom()
}
onMounted(() => {
  window.visualViewport?.addEventListener('resize', onViewportResize)
})
onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', onViewportResize)
})

function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

async function sendQuick(q) {
  inputText.value = q
  await send()
}

async function send() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  const userMsg = { id: Date.now(), role: 'user', content: text }
  messages.value.push(userMsg)
  inputText.value = ''
  loading.value = true
  await scrollBottom()

  const history = messages.value.slice(-8).map(m => ({
    role: m.role,
    content: m.content
  }))

  try {
    const res = await fetch('/api/chat/deepsook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userStore.userId,
        message: text,
        history: history.slice(0, -1)
      })
    })
    const data = await res.json()

    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: data.data?.reply || data.message || '出了点问题，稍后再试 🦞'
    })
  } catch (e) {
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: '网络异常，请检查连接后重试 🦞'
    })
  } finally {
    loading.value = false
    await scrollBottom()
  }
}

async function scrollBottom() {
  await nextTick()
  if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
}

// ── 语音输入 ──
function toggleVoice() {
  if (isRecording.value) {
    recognition?.stop()
    return
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    showToast('🎤 当前浏览器不支持语音，请用Chrome或Safari')
    return
  }
  recognition = new SR()
  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = false

  recognition.onstart = () => { isRecording.value = true }
  recognition.onend   = () => { isRecording.value = false }
  recognition.onerror = (e) => {
    isRecording.value = false
    if (e.error === 'not-allowed') showToast('🎤 麦克风权限被拒绝，请在浏览器设置中允许')
    else if (e.error === 'no-speech') showToast('🎤 未检测到语音，请重试')
    else showToast('🎤 语音识别出错，请重试')
  }

  recognition.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript?.trim()
    if (text) {
      inputText.value = text
      // 自动发送
      setTimeout(() => send(), 300)
    }
  }
  recognition.start()
}
</script>

<style scoped>
.deepsook-page {
  display: flex;
  flex-direction: column;
  height: 100dvh; /* 动态视口高度，键盘弹出时自动收缩 */
  background: #f5f6fa;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
@supports not (height: 100dvh) {
  .deepsook-page { height: 100vh; }
}

/* ── 头部 ── */
.ds-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  flex-shrink: 0;
}
.ds-back {
  background: none; border: none; color: rgba(255,255,255,0.7);
  font-size: 20px; cursor: pointer; padding: 0 4px; flex-shrink: 0;
}
.ds-header-info {
  display: flex; align-items: center; gap: 10px; flex: 1;
}
.ds-avatar {
  width: 44px; height: 44px; border-radius: 50%; object-fit: cover;
  border: 2px solid rgba(247,181,0,0.6);
}
.ds-name { font-size: 15px; font-weight: 700; color: #FFD700; }
.ds-subtitle { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 2px; }
.ds-balance-chip {
  display: flex; align-items: center; gap: 4px;
  background: rgba(247,181,0,0.15); border: 1px solid rgba(247,181,0,0.4);
  border-radius: 20px; padding: 4px 10px; flex-shrink: 0;
}
.ds-balance-icon { font-size: 14px; }
.ds-balance-val { font-size: 13px; font-weight: 700; color: #FFD700; }

/* ── 消息区 ── */
.ds-messages {
  flex: 1; overflow-y: auto; padding: 16px 12px;
  display: flex; flex-direction: column; gap: 14px;
}

/* 欢迎区 */
.ds-welcome {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 24px 0;
}
.ds-welcome-img {
  width: 96px; height: 96px; border-radius: 50%; object-fit: cover;
  border: 3px solid #FFD700; box-shadow: 0 4px 20px rgba(247,181,0,0.3);
}
.ds-welcome-text {
  text-align: center; color: #444;
}
.ds-welcome-text p { margin: 4px 0; font-size: 14px; }
.ds-welcome-text p:first-child { font-size: 17px; font-weight: 700; color: #1a1a2e; }
.ds-cost-tip { font-size: 12px; color: #888; margin-top: 8px !important; }
.ds-cost-tip b { color: #F7B500; }
.ds-quick-btns {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px;
}
.ds-quick-btn {
  background: #fff; border: 1px solid #e0e0e0; border-radius: 20px;
  padding: 6px 14px; font-size: 12px; color: #333; cursor: pointer;
  transition: all 0.2s;
}
.ds-quick-btn:hover { background: #FFF8E1; border-color: #F7B500; color: #b8860b; }

/* 消息行 */
.ds-msg-row {
  display: flex; align-items: flex-end; gap: 8px;
}
.ds-msg-row.user { flex-direction: row-reverse; }
.ds-msg-avatar {
  width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
}

/* 气泡 */
.ds-bubble {
  max-width: 72%; padding: 10px 14px; border-radius: 18px;
  font-size: 14px; line-height: 1.6; position: relative;
}
.ds-bubble.assistant {
  background: #fff; color: #333; border-radius: 4px 18px 18px 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.ds-bubble.user {
  background: linear-gradient(135deg, #F7B500, #FF8C00);
  color: #fff; border-radius: 18px 4px 18px 18px;
}
.ds-bubble-text { white-space: pre-wrap; word-break: break-word; }
.ds-bubble-cost {
  display: block; font-size: 10px; color: rgba(255,255,255,0.6);
  text-align: right; margin-top: 4px;
}
.ds-bubble.assistant .ds-bubble-cost { color: #bbb; }

/* 打字动画 */
.ds-typing {
  display: flex; align-items: center; gap: 4px; padding: 14px 18px;
}
.ds-typing span {
  width: 7px; height: 7px; background: #bbb; border-radius: 50%;
  animation: typing-bounce 1.2s infinite;
}
.ds-typing span:nth-child(2) { animation-delay: 0.2s; }
.ds-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-6px); opacity: 1; }
}

/* ── 底部输入 ── */
.ds-input-area {
  background: #fff; padding: 10px 12px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #eee; flex-shrink: 0;
}
.ds-no-balance {
  font-size: 12px; color: #e85d04; text-align: center;
  margin-bottom: 8px;
}
.ds-link { color: #F7B500; font-weight: 600; text-decoration: none; }
.ds-input-row { display: flex; align-items: flex-end; gap: 8px; }
.ds-textarea {
  flex: 1; border: 1px solid #e0e0e0; border-radius: 20px;
  padding: 10px 16px; font-size: 14px; resize: none; outline: none;
  background: #f8f8f8; line-height: 1.5; max-height: 120px;
  transition: border-color 0.2s;
}
.ds-textarea:focus { border-color: #F7B500; background: #fff; }
.ds-textarea:disabled { opacity: 0.5; }
.ds-send-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: linear-gradient(135deg, #F7B500, #FF8C00);
  font-size: 20px; cursor: pointer; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(247,181,0,0.4);
  transition: all 0.2s;
}
.ds-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ds-send-btn:not(:disabled):hover { transform: scale(1.08); }

/* ── Toast 提示 ── */
.ds-toast {
  position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.75); color: #fff; border-radius: 20px;
  padding: 8px 18px; font-size: 13px; z-index: 999; white-space: nowrap;
  max-width: 80vw; text-align: center;
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }

/* ── 麦克风按钮 ── */
.ds-mic-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none; flex-shrink: 0;
  background: #f0f0f0; color: #666; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.ds-mic-btn:hover { background: #e8e8e8; color: #333; }
.ds-mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ds-mic-btn.recording {
  background: #ff3b30;
  color: #fff;
  animation: mic-pulse 1s ease-in-out infinite;
}
.mic-wave { font-size: 16px; }
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255,59,48,0); }
}
</style>

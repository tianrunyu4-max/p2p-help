<template>
  <div class="ppx-page">

    <!-- 顶部头部 -->
    <div class="ppx-header">
      <button class="ppx-back" @click="router.back()">‹ 返回</button>
      <div class="ppx-header-info">
        <div class="ppx-avatar-wrap">
          <img src="/ppx-avatar.jpg" class="ppx-avatar-img" alt="PPX" />
        </div>
        <div>
          <div class="ppx-name">皮皮虾 PPX 🦐</div>
          <div class="ppx-subtitle">私人教育顾问 · 全球视野</div>
        </div>
      </div>
      <div class="ppx-balance-chip">
        <span>🪙</span>
        <span class="ppx-balance-val">{{ balance.toFixed(1) }}</span>
      </div>
    </div>

    <!-- 消息区 -->
    <div class="ppx-messages" ref="msgBox">

      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="ppx-welcome">
        <img src="/ppx-avatar.jpg" class="ppx-welcome-img" alt="PPX" />
        <div class="ppx-welcome-text">
          <p>皮皮虾，我们走！🦐</p>
          <p>教育·成长·财商启蒙，陪孩子探索世界</p>
        </div>
        <div class="ppx-quick-btns">
          <button v-for="q in quickQuestions" :key="q" class="ppx-quick-btn" @click="sendQuick(q)">{{ q }}</button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-for="msg in messages" :key="msg.id" :class="['ppx-msg-row', msg.role]">
        <div v-if="msg.role === 'assistant'" class="ppx-msg-avatar-wrap">
          <img src="/ppx-avatar.jpg" class="ppx-msg-img" alt="PPX" />
        </div>
        <div class="ppx-bubble" :class="msg.role">
          <span class="ppx-bubble-text">{{ msg.content }}</span>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="ppx-msg-row assistant">
        <div class="ppx-msg-avatar-wrap"><span class="ppx-msg-emoji">🦐</span></div>
        <div class="ppx-bubble assistant ppx-typing">
          <span></span><span></span><span></span>
        </div>
      </div>

    </div>

    <!-- Toast 提示 -->
    <transition name="toast-fade">
      <div v-if="toastMsg" class="ppx-toast">{{ toastMsg }}</div>
    </transition>

    <!-- 底部输入 -->
    <div class="ppx-input-area">
      <div class="ppx-input-row">
        <button class="ppx-mic-btn" :class="{ recording: isRecording }" @click="toggleVoice" :title="isRecording ? '点击停止' : '语音输入'" :disabled="loading">
          <svg v-if="!isRecording" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7 8a1 1 0 0 1 1 1 8 8 0 0 1-16 0 1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1zm-7 10a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1z"/>
          </svg>
          <span v-else class="mic-wave">●</span>
        </button>
        <textarea
          v-model="inputText"
          class="ppx-textarea"
          :placeholder="isRecording ? '🎤 正在听...' : '问教育、成长、财商...'"
          rows="1"
          :disabled="loading"
          @input="autoResize"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button class="ppx-send-btn" :disabled="loading || !inputText.trim()" @click="send">
          <span v-if="loading">⏳</span>
          <span v-else>🦐</span>
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
  '📚 孩子几岁开始财商教育最好？',
  '🌍 多语言培养有什么科学方法？',
  '🎯 怎么激发孩子的学习动力？',
  '💡 国际化教育和传统教育怎么选？'
]

function onViewportResize() { scrollBottom() }
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

  messages.value.push({ id: Date.now(), role: 'user', content: text })
  inputText.value = ''
  loading.value = true
  await scrollBottom()

  const history = messages.value.slice(-8).map(m => ({ role: m.role, content: m.content }))

  try {
    const res = await fetch('/api/chat/ppx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userStore.userId,
        message: text,
        history: history.slice(0, -1)
      })
    })
    const data = await res.json()
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: data.data?.reply || data.message || '皮皮虾去冒险了，稍后回来！🦐' })
  } catch (e) {
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: '网络异常，皮皮虾联系不上 🦐' })
  } finally {
    loading.value = false
    await scrollBottom()
  }
}

async function scrollBottom() {
  await nextTick()
  if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
}

function toggleVoice() {
  if (isRecording.value) { recognition?.stop(); return }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { showToast('🎤 当前浏览器不支持语音，请用Chrome或Safari'); return }
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
    if (text) { inputText.value = text; setTimeout(() => send(), 300) }
  }
  recognition.start()
}
</script>

<style scoped>
.ppx-page {
  display: flex; flex-direction: column; height: 100dvh;
  background: #f0f8ff; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
@supports not (height: 100dvh) {
  .ppx-page { height: 100vh; }
}

/* ── 头部（探险绿蓝渐变） ── */
.ppx-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #0a3d62 0%, #1e6b9e 100%);
  color: #fff; flex-shrink: 0;
}
.ppx-back {
  background: none; border: none; color: rgba(255,255,255,0.7);
  font-size: 20px; cursor: pointer; padding: 0 4px; flex-shrink: 0;
}
.ppx-header-info { display: flex; align-items: center; gap: 10px; flex: 1; }
.ppx-avatar-wrap {
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #00b4d8, #90e0ef);
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(144,224,239,0.6); overflow: hidden;
}
.ppx-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.ppx-name { font-size: 15px; font-weight: 700; color: #90e0ef; }
.ppx-subtitle { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 2px; }
.ppx-balance-chip {
  display: flex; align-items: center; gap: 4px;
  background: rgba(144,224,239,0.15); border: 1px solid rgba(144,224,239,0.4);
  border-radius: 20px; padding: 4px 10px; flex-shrink: 0; font-size: 13px;
}
.ppx-balance-val { font-weight: 700; color: #90e0ef; }

/* ── 消息区 ── */
.ppx-messages {
  flex: 1; overflow-y: auto; padding: 16px 12px;
  display: flex; flex-direction: column; gap: 14px;
}

/* 欢迎区 */
.ppx-welcome {
  display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 0;
}
.ppx-welcome-img {
  width: 96px; height: 96px; border-radius: 50%;
  object-fit: cover; box-shadow: 0 4px 20px rgba(0,119,182,0.3);
  border: 3px solid rgba(0,180,216,0.5);
}
.ppx-welcome-text { text-align: center; color: #444; }
.ppx-welcome-text p { margin: 4px 0; font-size: 14px; }
.ppx-welcome-text p:first-child { font-size: 17px; font-weight: 700; color: #0a3d62; }
.ppx-cost-tip { font-size: 12px; color: #888; margin-top: 8px !important; }
.ppx-cost-tip b { color: #00b4d8; }
.ppx-quick-btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px; }
.ppx-quick-btn {
  background: #fff; border: 1px solid #e0e0e0; border-radius: 20px;
  padding: 6px 14px; font-size: 12px; color: #333; cursor: pointer; transition: all 0.2s;
}
.ppx-quick-btn:hover { background: #e0f7ff; border-color: #00b4d8; color: #0077b6; }

/* 消息行 */
.ppx-msg-row { display: flex; align-items: flex-end; gap: 8px; }
.ppx-msg-row.user { flex-direction: row-reverse; }
.ppx-msg-avatar-wrap {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #00b4d8, #0077b6);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.ppx-msg-img { width: 100%; height: 100%; object-fit: cover; }

/* 气泡 */
.ppx-bubble {
  max-width: 72%; padding: 10px 14px; border-radius: 18px;
  font-size: 14px; line-height: 1.6; position: relative;
}
.ppx-bubble.assistant {
  background: #fff; color: #333; border-radius: 4px 18px 18px 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.ppx-bubble.user {
  background: linear-gradient(135deg, #00b4d8, #0077b6);
  color: #fff; border-radius: 18px 4px 18px 18px;
}
.ppx-bubble-text { white-space: pre-wrap; word-break: break-word; }
.ppx-bubble-cost { display: block; font-size: 10px; color: rgba(255,255,255,0.6); text-align: right; margin-top: 4px; }
.ppx-bubble.assistant .ppx-bubble-cost { color: #bbb; }

/* 打字动画 */
.ppx-typing { display: flex; align-items: center; gap: 4px; padding: 14px 18px; }
.ppx-typing span {
  width: 7px; height: 7px; background: #00b4d8; border-radius: 50%;
  animation: ppx-bounce 1.2s infinite;
}
.ppx-typing span:nth-child(2) { animation-delay: 0.2s; }
.ppx-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes ppx-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-6px); opacity: 1; }
}

/* ── 底部输入 ── */
.ppx-input-area { background: #fff; padding: 10px 12px 20px; border-top: 1px solid #eee; flex-shrink: 0; }
.ppx-no-balance { font-size: 12px; color: #e85d04; text-align: center; margin-bottom: 8px; }
.ppx-link { color: #00b4d8; font-weight: 600; text-decoration: none; }
.ppx-input-row { display: flex; align-items: flex-end; gap: 8px; }
.ppx-textarea {
  flex: 1; border: 1px solid #e0e0e0; border-radius: 20px;
  padding: 10px 16px; font-size: 14px; resize: none; outline: none;
  background: #f8f8f8; line-height: 1.5; max-height: 120px; transition: border-color 0.2s;
}
.ppx-textarea:focus { border-color: #00b4d8; background: #fff; }
.ppx-textarea:disabled { opacity: 0.5; }
.ppx-send-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: linear-gradient(135deg, #00b4d8, #0077b6);
  font-size: 20px; cursor: pointer; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,119,182,0.4); transition: all 0.2s;
}
.ppx-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ppx-send-btn:not(:disabled):hover { transform: scale(1.08); }
.ppx-toast {
  position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.75); color: #fff; border-radius: 20px;
  padding: 8px 18px; font-size: 13px; z-index: 999; white-space: nowrap;
  max-width: 80vw; text-align: center;
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
.ppx-mic-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none; flex-shrink: 0;
  background: #f0f0f0; color: #666; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.ppx-mic-btn:hover { background: #e8e8e8; }
.ppx-mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ppx-mic-btn.recording { background: #ff3b30; color: #fff; animation: mic-pulse 1s ease-in-out infinite; }
.mic-wave { font-size: 16px; }
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255,59,48,0); }
}
</style>

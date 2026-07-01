<template>
  <div class="hx-page">

    <!-- 顶部头部 -->
    <div class="hx-header">
      <button class="hx-back" @click="router.back()">‹ 返回</button>
      <div class="hx-header-info">
        <div class="hx-avatar-wrap">
          <img src="/healthx-avatar.jpg" class="hx-avatar-img" alt="HealthX" />
        </div>
        <div>
          <div class="hx-name">养生虾 HealthX 🦀</div>
          <div class="hx-subtitle">私人医生 · 健康守护者</div>
        </div>
      </div>
      <div class="hx-balance-chip">
        <span>🪙</span>
        <span class="hx-balance-val">{{ balance.toFixed(1) }}</span>
      </div>
    </div>

    <!-- 消息区 -->
    <div class="hx-messages" ref="msgBox">

      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="hx-welcome">
        <img src="/healthx-avatar.jpg" class="hx-welcome-img" alt="HealthX" />
        <div class="hx-welcome-text">
          <p>身体是本钱，钱没了可以再赚 🦀</p>
          <p>养生调理·压力管理·健康守护，你的私人医生</p>
        </div>
        <div class="hx-quick-btns">
          <button v-for="q in quickQuestions" :key="q" class="hx-quick-btn" @click="sendQuick(q)">{{ q }}</button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-for="msg in messages" :key="msg.id" :class="['hx-msg-row', msg.role]">
        <div v-if="msg.role === 'assistant'" class="hx-msg-avatar-wrap">
          <img src="/healthx-avatar.jpg" class="hx-msg-img" alt="HealthX" />
        </div>
        <div class="hx-bubble" :class="msg.role">
          <span class="hx-bubble-text">{{ msg.content }}</span>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="hx-msg-row assistant">
        <div class="hx-msg-avatar-wrap"><span class="hx-msg-emoji">🦀</span></div>
        <div class="hx-bubble assistant hx-typing">
          <span></span><span></span><span></span>
        </div>
      </div>

    </div>

    <!-- Toast 提示 -->
    <transition name="toast-fade">
      <div v-if="toastMsg" class="hx-toast">{{ toastMsg }}</div>
    </transition>

    <!-- 底部输入 -->
    <div class="hx-input-area">
      <div class="hx-input-row">
        <button class="hx-mic-btn" :class="{ recording: isRecording }" @click="toggleVoice" :title="isRecording ? '点击停止' : '语音输入'" :disabled="loading">
          <svg v-if="!isRecording" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7 8a1 1 0 0 1 1 1 8 8 0 0 1-16 0 1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1zm-7 10a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1z"/>
          </svg>
          <span v-else class="mic-wave">●</span>
        </button>
        <textarea
          v-model="inputText"
          class="hx-textarea"
          :placeholder="isRecording ? '🎤 正在听...' : '问养生、睡眠、压力管理...'"
          rows="1"
          :disabled="loading"
          @input="autoResize"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button class="hx-send-btn" :disabled="loading || !inputText.trim()" @click="send">
          <span v-if="loading">⏳</span>
          <span v-else>🦀</span>
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
  '😴 睡眠质量差怎么科学改善？',
  '🌿 工作压力大，怎么调理身体？',
  '💪 适合忙碌上班族的养生方法？',
  '🍵 中医养生和西医健康管理怎么结合？'
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
    const res = await fetch('/api/chat/healthx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userStore.userId,
        message: text,
        history: history.slice(0, -1)
      })
    })
    const data = await res.json()
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: data.data?.reply || data.message || '养生虾正在给别人把脉，请稍候 🦀' })
  } catch (e) {
    messages.value.push({ id: Date.now() + 1, role: 'assistant', content: '网络异常，养生虾联系不上 🦀' })
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
.hx-page {
  display: flex; flex-direction: column; height: 100dvh;
  background: #f0fff4; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
@supports not (height: 100dvh) {
  .hx-page { height: 100vh; }
}

/* ── 头部（养生绿渐变） ── */
.hx-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%);
  color: #fff; flex-shrink: 0;
}
.hx-back {
  background: none; border: none; color: rgba(255,255,255,0.7);
  font-size: 20px; cursor: pointer; padding: 0 4px; flex-shrink: 0;
}
.hx-header-info { display: flex; align-items: center; gap: 10px; flex: 1; }
.hx-avatar-wrap {
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #52b788, #95d5b2);
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(149,213,178,0.6); overflow: hidden;
}
.hx-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.hx-name { font-size: 15px; font-weight: 700; color: #95d5b2; }
.hx-subtitle { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 2px; }
.hx-balance-chip {
  display: flex; align-items: center; gap: 4px;
  background: rgba(149,213,178,0.15); border: 1px solid rgba(149,213,178,0.4);
  border-radius: 20px; padding: 4px 10px; flex-shrink: 0; font-size: 13px;
}
.hx-balance-val { font-weight: 700; color: #95d5b2; }

/* ── 消息区 ── */
.hx-messages {
  flex: 1; overflow-y: auto; padding: 16px 12px;
  display: flex; flex-direction: column; gap: 14px;
}

/* 欢迎区 */
.hx-welcome {
  display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 0;
}
.hx-welcome-img {
  width: 96px; height: 96px; border-radius: 50%;
  object-fit: cover; box-shadow: 0 4px 20px rgba(27,67,50,0.3);
  border: 3px solid rgba(82,183,136,0.5);
}
.hx-welcome-text { text-align: center; color: #444; }
.hx-welcome-text p { margin: 4px 0; font-size: 14px; }
.hx-welcome-text p:first-child { font-size: 17px; font-weight: 700; color: #1b4332; }
.hx-cost-tip { font-size: 12px; color: #888; margin-top: 8px !important; }
.hx-cost-tip b { color: #52b788; }
.hx-quick-btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px; }
.hx-quick-btn {
  background: #fff; border: 1px solid #e0e0e0; border-radius: 20px;
  padding: 6px 14px; font-size: 12px; color: #333; cursor: pointer; transition: all 0.2s;
}
.hx-quick-btn:hover { background: #d8f3dc; border-color: #52b788; color: #1b4332; }

/* 消息行 */
.hx-msg-row { display: flex; align-items: flex-end; gap: 8px; }
.hx-msg-row.user { flex-direction: row-reverse; }
.hx-msg-avatar-wrap {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #52b788, #1b4332);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.hx-msg-img { width: 100%; height: 100%; object-fit: cover; }

/* 气泡 */
.hx-bubble {
  max-width: 72%; padding: 10px 14px; border-radius: 18px;
  font-size: 14px; line-height: 1.6; position: relative;
}
.hx-bubble.assistant {
  background: #fff; color: #333; border-radius: 4px 18px 18px 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.hx-bubble.user {
  background: linear-gradient(135deg, #52b788, #1b4332);
  color: #fff; border-radius: 18px 4px 18px 18px;
}
.hx-bubble-text { white-space: pre-wrap; word-break: break-word; }
.hx-bubble-cost { display: block; font-size: 10px; color: rgba(255,255,255,0.6); text-align: right; margin-top: 4px; }
.hx-bubble.assistant .hx-bubble-cost { color: #bbb; }

/* 打字动画 */
.hx-typing { display: flex; align-items: center; gap: 4px; padding: 14px 18px; }
.hx-typing span {
  width: 7px; height: 7px; background: #52b788; border-radius: 50%;
  animation: hx-bounce 1.2s infinite;
}
.hx-typing span:nth-child(2) { animation-delay: 0.2s; }
.hx-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes hx-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-6px); opacity: 1; }
}

/* ── 底部输入 ── */
.hx-input-area { background: #fff; padding: 10px 12px 20px; border-top: 1px solid #eee; flex-shrink: 0; }
.hx-no-balance { font-size: 12px; color: #e85d04; text-align: center; margin-bottom: 8px; }
.hx-link { color: #52b788; font-weight: 600; text-decoration: none; }
.hx-input-row { display: flex; align-items: flex-end; gap: 8px; }
.hx-textarea {
  flex: 1; border: 1px solid #e0e0e0; border-radius: 20px;
  padding: 10px 16px; font-size: 14px; resize: none; outline: none;
  background: #f8f8f8; line-height: 1.5; max-height: 120px; transition: border-color 0.2s;
}
.hx-textarea:focus { border-color: #52b788; background: #fff; }
.hx-textarea:disabled { opacity: 0.5; }
.hx-send-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: linear-gradient(135deg, #52b788, #1b4332);
  font-size: 20px; cursor: pointer; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(27,67,50,0.4); transition: all 0.2s;
}
.hx-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.hx-send-btn:not(:disabled):hover { transform: scale(1.08); }
.hx-toast {
  position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.75); color: #fff; border-radius: 20px;
  padding: 8px 18px; font-size: 13px; z-index: 999; white-space: nowrap;
  max-width: 80vw; text-align: center;
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
.hx-mic-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none; flex-shrink: 0;
  background: #f0f0f0; color: #666; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.hx-mic-btn:hover { background: #e8e8e8; }
.hx-mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.hx-mic-btn.recording { background: #ff3b30; color: #fff; animation: mic-pulse 1s ease-in-out infinite; }
.mic-wave { font-size: 16px; }
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255,59,48,0); }
}
</style>

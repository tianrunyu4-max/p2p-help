<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore.js'
import { getMessageService } from '../services/messageService.js'
import { uploadImage, uploadAvatar, uploadVideo } from '../services/uploadService.js'
import { getOrCreateUserId } from '../utils/auth.js'
import { isAIQuestion, getAIResponse } from '../services/aiBotService.js'
import { apiUrl } from '../utils/apiBase.js'

const router = useRouter()
const store  = useUserStore()

// 身份勋章
const badge = computed(() => {
  const u = store.userInfo
  if (!u || !u.is_active) return { label: '游客', icon: '🌱', color: '#718096', bg: '#EDF2F7' }
  if (u.is_exited || u.role === 'owner') return { label: '老板', icon: '👑', color: '#B7791F', bg: '#FFFFF0' }
  return { label: '代理', icon: '👔', color: '#2B6CB0', bg: '#EBF8FF' }
})

const messageService   = getMessageService()
const messages         = ref(messageService.getMessages())
const inputText   = ref('')
const messagesEnd = ref(null)
const textareaRef = ref(null)
const showAttachMenu = ref(false)
const imageInput  = ref(null)
const videoInput  = ref(null)
const avatarInput = ref(null)
const activeVideoIds = ref(new Set())

const chatMode    = ref(localStorage.getItem('chat_mode') || 'ai')
const currentUserId = ref(getOrCreateUserId())
const userAvatar  = ref(localStorage.getItem('userAvatarUrl') || null)

const typingId    = ref(null)
const typingText  = ref('')
const aiThinking  = ref(false)
let typingTimer   = null

const showImagePreview = ref(false)
const previewImageUrl  = ref('')

const SHRIMP_BOTS = [
  { keywords: ['@大虾','@deepsook'], bot: 'deepsook', type: 'deepsook', fallback: '大虾暂时在忙 🦞' },
  { keywords: ['@皮皮虾','@ppx'],    bot: 'ppx',      type: 'ppx',      fallback: '皮皮虾去冒险了 🦐' },
  { keywords: ['@养生虾','@健康'],   bot: 'healthx',  type: 'healthx',  fallback: '养生虾正在把脉 🦀' },
  { keywords: ['@彩球','@选号'],     bot: 'lottery',  type: 'lottery',  fallback: '彩球博士正在推演 🎱' },
]

let unsubscribe    = null
let prevMsgLen     = 0
let userPollTimer  = null   // 用户状态轮询（管理员激活后自动更新勋章）

onMounted(() => {
  messages.value = messageService.getMessages()
  prevMsgLen = messages.value.length
  unsubscribe = messageService.subscribe(newMsgs => {
    const oldLen = prevMsgLen
    messages.value = newMsgs.map(m => ({ ...m }))
    prevMsgLen = newMsgs.length
    if (newMsgs.length > oldLen) {
      const last = newMsgs[newMsgs.length - 1]
      if (last.type === 'ai') startTyping(last)
      scrollToBottom()
    }
  })
  scrollToBottom()
  messageService.startAutoBroadcast()

  // 立即刷新一次用户状态（管理员激活后无需重启APP即可看到勋章）
  store.refreshUser()
  // 每30秒轮询一次，未激活用户被内排后自动更新
  userPollTimer = setInterval(() => {
    if (!store.isActivated) store.refreshUser()
  }, 30000)
})

// keep-alive 切回社区时：滚到底部 + 静默刷新用户状态
onActivated(() => {
  scrollToBottom()
  store.refreshUser()
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
  if (typingTimer) clearInterval(typingTimer)
  if (userPollTimer) clearInterval(userPollTimer)
  messageService.stopAutoBroadcast()
})

function startTyping(msg) {
  if (typingTimer) clearInterval(typingTimer)
  typingId.value = msg.id; typingText.value = ''; let i = 0
  const content = String(msg.content || '')
  typingTimer = setInterval(() => {
    if (i < content.length) { typingText.value = content.slice(0, i + 1); i++; scrollToBottom() }
    else { clearInterval(typingTimer); typingTimer = null; typingId.value = null }
  }, 16)
}

function isMyMessage(msg) { return msg.userId === currentUserId.value }
function getMessagePosition(msg) {
  if (['ai','deepsook','ppx','healthx','lottery'].includes(msg.type)) return 'msg-left'
  return isMyMessage(msg) ? 'msg-right' : 'msg-left'
}
function getUserInitial(msg) { return (msg.userName || '用')[0].toUpperCase() }
function getCurrentUserName() { return localStorage.getItem('chatUserName') || '用户_' + currentUserId.value.slice(-3) }

const parseMediaInfo = (msg) => {
  if (msg.mediaType && msg.mediaUrl) return { type: msg.mediaType, url: msg.mediaUrl }
  return null
}
const getMediaType = m => parseMediaInfo(m)?.type || null
const getMediaUrl  = m => parseMediaInfo(m)?.url  || null
const getMessageText = m => {
  const media = parseMediaInfo(m)
  if (media) return media.type === 'image' ? '[图片]' : '[视频]'
  return m.content
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  messageService.addUserMessage(text, getCurrentUserName(), currentUserId.value, userAvatar.value)
  inputText.value = ''
  resetTextareaHeight()
  scrollToBottom()

  if (chatMode.value === 'free') return

  const matchedBot = SHRIMP_BOTS.find(b => b.keywords.some(k => text.toLowerCase().includes(k.toLowerCase())))
  if (matchedBot) {
    aiThinking.value = true
    nextTick(() => scrollToBottom())
    try {
      const question = matchedBot.keywords.reduce((t, k) => t.replace(new RegExp(k, 'gi'), ''), text).trim() || text
      const res = await fetch(apiUrl(`/api/chat/${matchedBot.bot}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, userId: currentUserId.value })
      })
      const data = await res.json()
      messageService.addMessage({
        id: Date.now().toString(), type: matchedBot.type,
        content: data.code === 200 ? data.data.reply : matchedBot.fallback,
        time: now()
      })
    } catch { messageService.addMessage({ id: Date.now().toString(), type: matchedBot.type, content: matchedBot.fallback, time: now() }) }
    finally { aiThinking.value = false; nextTick(() => scrollToBottom()) }
    return
  }

  if (isAIQuestion(text)) {
    aiThinking.value = true; nextTick(() => scrollToBottom())
    try {
      const reply = await getAIResponse(text, currentUserId.value)
      if (reply) {
        messageService.addMessage({ id: Date.now().toString(), type: 'ai', content: reply, time: now() })
        nextTick(() => scrollToBottom())
      }
    } catch {} finally { aiThinking.value = false }
  }
}

function now() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function scrollToBottom() { messagesEnd.value?.scrollIntoView({ behavior: 'smooth' }) }
function autoResize() {
  const el = textareaRef.value
  if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }
}
function resetTextareaHeight() { const el = textareaRef.value; if (el) el.style.height = 'auto' }
function setQuickInput(text) { inputText.value = text; nextTick(() => textareaRef.value?.focus()) }
function setChatMode(m) {
  chatMode.value = m
  localStorage.setItem('chat_mode', m)
  if (m === 'zero') onZeroModeActivate()
}
function activateVideo(id) { activeVideoIds.value = new Set([...activeVideoIds.value, id]) }
function selectImage() { showAttachMenu.value = false; imageInput.value?.click() }
function selectVideo() { showAttachMenu.value = false; videoInput.value?.click() }

async function handleImageSelect(e) {
  const file = e.target.files[0]; if (!file) return
  if (file.size > 10*1024*1024) { alert('图片最大10MB'); e.target.value=''; return }
  const localUrl = URL.createObjectURL(file)
  const tempMsg = messageService.addMediaMessage('image', localUrl, file.name, getCurrentUserName(), currentUserId.value, userAvatar.value, true)
  scrollToBottom(); e.target.value = ''
  try { const r = await uploadImage(file); messageService.updateMediaUrl(tempMsg.id, r.url); URL.revokeObjectURL(localUrl) }
  catch (err) { messageService.markMediaUploadFailed(tempMsg.id); alert('上传失败: ' + err.message) }
}

async function handleVideoSelect(e) {
  const file = e.target.files[0]; if (!file) return
  if (file.size > 50*1024*1024) { alert('视频最大50MB'); e.target.value=''; return }
  const localUrl = URL.createObjectURL(file)
  const tempMsg = messageService.addMediaMessage('video', localUrl, file.name, getCurrentUserName(), currentUserId.value, userAvatar.value, true)
  scrollToBottom(); e.target.value = ''
  try { const r = await uploadVideo(file); messageService.updateMediaUrl(tempMsg.id, r.url); URL.revokeObjectURL(localUrl) }
  catch (err) { messageService.markMediaUploadFailed(tempMsg.id); alert('上传失败: ' + err.message) }
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0]; if (!file) return
  if (file.size > 2*1024*1024) { alert('头像最大2MB'); return }
  try {
    const url = await uploadAvatar(file)
    userAvatar.value = url
    localStorage.setItem('userAvatarUrl', url)
    alert('头像更新成功！')
  } catch (err) { alert('上传失败: ' + err.message) }
  e.target.value = ''
}

function previewImage(url) { previewImageUrl.value = url; showImagePreview.value = true }
function closeImagePreview() { showImagePreview.value = false }

// ── 0撸 信息板 ────────────────────────────────────────────────
const zeroPosts    = ref([])
const zeroLoading  = ref(false)
const zeroPage     = ref(1)
const zeroNoMore   = ref(false)

const showZeroPublish = ref(false)
const zeroContent  = ref('')
const zeroImages   = ref([])   // [{url, file}] 最多2张
const zeroTodayCount = ref(0)
const zeroSubmitting = ref(false)
const zeroImgInput = ref(null)

async function loadZeroPosts(reset = false) {
  if (zeroLoading.value) return
  if (reset) { zeroPage.value = 1; zeroNoMore.value = false }
  zeroLoading.value = true
  try {
    const res = await fetch(apiUrl(`/api/zero-posts?page=${zeroPage.value}`))
    const data = await res.json()
    const list = data.data || []
    if (reset) zeroPosts.value = list
    else zeroPosts.value = [...zeroPosts.value, ...list]
    if (list.length < 20) zeroNoMore.value = true
    else zeroPage.value++
  } catch (e) { /* ignore */ }
  finally { zeroLoading.value = false }
}

async function openZeroPublish() {
  // 获取今日发帖数
  const token = localStorage.getItem('token')
  if (!token) { alert('请先登录'); return }
  try {
    const res = await fetch(apiUrl('/api/zero-posts/today-count'), {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    const data = await res.json()
    zeroTodayCount.value = data.data?.count || 0
  } catch {}
  zeroContent.value = ''
  zeroImages.value = []
  showZeroPublish.value = true
}

function selectZeroImage() {
  if (zeroImages.value.length >= 2) { alert('最多2张图片'); return }
  zeroImgInput.value?.click()
}

async function handleZeroImageSelect(e) {
  const file = e.target.files[0]; if (!file) return
  if (file.size > 10*1024*1024) { alert('图片最大10MB'); e.target.value=''; return }
  const localUrl = URL.createObjectURL(file)
  // 先显示本地预览
  zeroImages.value.push({ url: localUrl, uploading: true, file })
  e.target.value = ''
  const idx = zeroImages.value.length - 1
  try {
    const r = await uploadImage(file)
    zeroImages.value[idx] = { url: r.url, uploading: false }
    URL.revokeObjectURL(localUrl)
  } catch (err) {
    zeroImages.value.splice(idx, 1)
    URL.revokeObjectURL(localUrl)
    alert('上传失败: ' + err.message)
  }
}

function removeZeroImage(idx) {
  zeroImages.value.splice(idx, 1)
}

async function submitZeroPost() {
  const content = zeroContent.value.trim()
  const imgs = zeroImages.value.filter(i => !i.uploading).map(i => i.url)
  if (!content && imgs.length === 0) { alert('请填写内容或上传图片'); return }
  if (content.length > 30) { alert('文字最多30字'); return }
  if (zeroTodayCount.value >= 20) { alert('今日已达20条上限'); return }
  const token = localStorage.getItem('token')
  if (!token) { alert('请先登录'); return }
  zeroSubmitting.value = true
  try {
    const res = await fetch(apiUrl('/api/zero-posts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ content, images: imgs })
    })
    const data = await res.json()
    if (data.code === 200) {
      showZeroPublish.value = false
      loadZeroPosts(true)
    } else {
      alert(data.message || '发布失败')
    }
  } catch (e) { alert('发布失败: ' + e.message) }
  finally { zeroSubmitting.value = false }
}

function onZeroModeActivate() {
  loadZeroPosts(true)
}

function formatZeroTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return diffMin + '分钟前'
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return diffH + '小时前'
  return `${d.getMonth()+1}/${d.getDate()}`
}
</script>

<template>
  <div class="community-container">

    <!-- 顶部 ID 栏 + 参与按钮 -->
    <div class="community-topbar">
      <div class="topbar-id">
        <span class="id-icon">🪪</span>
        <span class="id-label">ID</span>
        <span class="id-num">{{ store.userId }}</span>
        <span class="id-badge" :style="{ color: badge.color, background: badge.bg }">
          {{ badge.icon }} {{ badge.label }}
        </span>
      </div>
      <button
        class="btn-participate"
        @click="router.push('/participate')"
      >
        🤝 自愿参与
      </button>
    </div>
    <!-- 消息流 / 0撸 feed -->
    <div class="chat-messages" v-show="chatMode !== 'zero'">

      <!-- 空状态 -->
      <div v-if="messages.length === 0" class="welcome-area">
        <div class="welcome-logo">🏪</div>
        <h2 class="welcome-title">1+1社区</h2>
        <p class="welcome-sub">点对点 · 直接打款 · 全程透明</p>
        <div class="welcome-tags">
          <button class="welcome-tag" @click="setQuickInput('@大虾 ')">🦞 @大虾 咨询</button>
          <button class="welcome-tag" @click="setQuickInput('如何激活')">🤝 如何激活</button>
          <button class="welcome-tag" @click="setQuickInput('收益怎么算')">💰 收益怎么算</button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-for="msg in messages" :key="msg.id" :class="['message-row', getMessagePosition(msg)]">
        <!-- AI 消息（左侧） -->
        <template v-if="msg.type === 'ai'">
          <div class="msg-avatar ai-avatar-wrap"><span>🤖</span></div>
          <div class="msg-body">
            <div class="msg-sender">AI 助手</div>
            <div class="msg-text ai-text" v-html="typingId === msg.id ? typingText : msg.content"></div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <template v-else-if="msg.type === 'deepsook'">
          <div class="msg-avatar deepsook-avatar-wrap"><span>🦞</span></div>
          <div class="msg-body">
            <div class="msg-sender deepsook-sender">大龙虾 DeepSook</div>
            <div class="msg-text ai-text deepsook-text">{{ msg.content }}</div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <template v-else-if="msg.type === 'ppx'">
          <div class="msg-avatar ppx-avatar-wrap"><span>🦐</span></div>
          <div class="msg-body">
            <div class="msg-sender ppx-sender">皮皮虾 PPX</div>
            <div class="msg-text ai-text ppx-text">{{ msg.content }}</div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <template v-else-if="msg.type === 'healthx'">
          <div class="msg-avatar hx-avatar-wrap"><span>🦀</span></div>
          <div class="msg-body">
            <div class="msg-sender hx-sender">养生虾 HealthX</div>
            <div class="msg-text ai-text hx-text">{{ msg.content }}</div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <template v-else-if="msg.type === 'lottery'">
          <div class="msg-avatar lottery-avatar-wrap"><span>🎱</span></div>
          <div class="msg-body">
            <div class="msg-sender lottery-sender">彩球博士</div>
            <div class="msg-text ai-text lottery-text">{{ msg.content }}</div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <!-- 自己消息（右侧） -->
        <template v-else-if="isMyMessage(msg)">
          <div class="msg-body msg-body-right">
            <div class="msg-bubble my-bubble">
              <div v-if="getMediaType(msg) === 'image'" class="msg-media">
                <img :src="getMediaUrl(msg)" class="media-img" @click="!msg.uploading && previewImage(getMediaUrl(msg))" />
                <div v-if="msg.uploading" class="media-upload-overlay"><div class="upload-spin"></div><span>发送中...</span></div>
                <div v-if="msg.uploadFailed" class="media-upload-overlay failed"><span>❌ 发送失败</span></div>
              </div>
              <div v-else-if="getMediaType(msg) === 'video'" class="msg-media">
                <div v-if="msg.uploading" class="video-lazy-cover"><div class="upload-spin"></div><span>发送中...</span></div>
                <div v-else-if="!activeVideoIds.has(msg.id)" class="video-lazy-cover" @click="activateVideo(msg.id)">
                  <div class="video-play-icon">▶</div>
                </div>
                <video v-else :src="getMediaUrl(msg)" class="media-video" controls playsinline autoplay></video>
              </div>
              <span v-else class="msg-text">{{ getMessageText(msg) }}</span>
            </div>
            <div class="msg-time msg-time-right">{{ msg.time }}</div>
          </div>
          <div class="msg-avatar user-avatar-wrap">
            <img v-if="userAvatar" :src="userAvatar" class="avatar-img" @click="avatarInput?.click()" />
            <span v-else class="avatar-initial" @click="avatarInput?.click()">我</span>
          </div>
        </template>

        <!-- 其他用户消息 -->
        <template v-else>
          <div class="msg-avatar other-avatar-wrap">
            <img v-if="msg.avatarUrl" :src="msg.avatarUrl" class="avatar-img" />
            <span v-else class="avatar-initial">{{ getUserInitial(msg) }}</span>
          </div>
          <div class="msg-body">
            <div class="msg-sender">{{ msg.userName || '用户' }}</div>
            <div class="msg-bubble other-bubble">
              <div v-if="getMediaType(msg) === 'image'" class="msg-media">
                <img :src="getMediaUrl(msg)" class="media-img" @click="previewImage(getMediaUrl(msg))" />
              </div>
              <div v-else-if="getMediaType(msg) === 'video'" class="msg-media">
                <div v-if="!activeVideoIds.has(msg.id)" class="video-lazy-cover" @click="activateVideo(msg.id)"><div class="video-play-icon">▶</div></div>
                <video v-else :src="getMediaUrl(msg)" class="media-video" controls playsinline autoplay></video>
              </div>
              <span v-else class="msg-text">{{ getMessageText(msg) }}</span>
            </div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>
      </div>

      <!-- 打字动画 -->
      <div v-if="typingId || aiThinking" class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
      <div ref="messagesEnd"></div>
    </div>

    <!-- 0撸 信息板 feed（chatMode === 'zero'时显示） -->
    <div v-show="chatMode === 'zero'" class="zero-feed">
      <div v-if="zeroLoading && zeroPosts.length === 0" class="zero-empty">加载中...</div>
      <div v-else-if="zeroPosts.length === 0" class="zero-empty">暂无信息，快来发第一条吧 🆓</div>
      <div v-for="post in zeroPosts" :key="post.id" class="zero-post-card">
        <div class="zero-post-header">
          <span class="zero-user-no">用户 {{ post.user_no }}</span>
          <span class="zero-post-time">{{ formatZeroTime(post.created_at) }}</span>
        </div>
        <p v-if="post.content" class="zero-post-content">{{ post.content }}</p>
        <div v-if="post.images && post.images.length" class="zero-post-images">
          <img v-for="(img, i) in post.images" :key="i" :src="img" class="zero-img" @click="previewImage(img)" />
        </div>
      </div>
      <div v-if="!zeroNoMore && zeroPosts.length > 0" class="zero-load-more" @click="loadZeroPosts()">
        {{ zeroLoading ? '加载中...' : '加载更多' }}
      </div>
      <div v-else-if="zeroPosts.length > 0" class="zero-no-more">已加载全部</div>

      <!-- 发布按钮 -->
      <button class="zero-publish-fab" @click="openZeroPublish">✏️ 发布</button>
    </div>

    <!-- 聊天模式切换 -->
    <div class="chat-mode-bar">
      <button :class="['mode-btn', chatMode==='free'?'mode-active-free':'']" @click="setChatMode('free')">💬 自由聊天</button>
      <button :class="['mode-btn', chatMode==='ai'?'mode-active-ai':'']" @click="setChatMode('ai')">🤖 AI问答</button>
      <button :class="['mode-btn', chatMode==='zero'?'mode-active-zero':'']" @click="setChatMode('zero')">🆓 0撸</button>
    </div>

    <!-- 输入栏（0撸模式时隐藏） -->
    <div class="input-area" v-show="chatMode !== 'zero'">
      <button class="icon-btn attach-btn" @click="showAttachMenu = !showAttachMenu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>
      <div class="textarea-wrap">
        <textarea ref="textareaRef" v-model="inputText" class="message-textarea"
          placeholder="@大虾 咨询互助，或直接发言..."
          rows="1" @input="autoResize"
          @keydown.enter.exact.prevent="sendMessage"
          @keydown.shift.enter.exact></textarea>
      </div>
      <button class="icon-btn send-btn" @click="sendMessage">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>

    <!-- 附件菜单（仅聊天时显示） -->
    <transition name="attach-pop">
      <div v-if="showAttachMenu && chatMode !== 'zero'" class="attach-menu">
        <button class="attach-item" @click="selectImage">
          <div class="attach-icon" style="background:#07C160">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
          <span>图片</span>
        </button>
        <button class="attach-item" @click="selectVideo">
          <div class="attach-icon" style="background:#1976D2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </div>
          <span>视频</span>
        </button>
      </div>
    </transition>

    <input ref="imageInput" type="file" accept="image/*" style="display:none" @change="handleImageSelect" />
    <input ref="videoInput" type="file" accept="video/mp4,video/webm,video/quicktime" style="display:none" @change="handleVideoSelect" />
    <input ref="avatarInput" type="file" accept="image/*" style="display:none" @change="handleAvatarUpload" />
    <input ref="zeroImgInput" type="file" accept="image/*" style="display:none" @change="handleZeroImageSelect" />

    <!-- 图片预览 -->
    <transition name="fade">
      <div v-if="showImagePreview" class="preview-overlay" @click="closeImagePreview">
        <img :src="previewImageUrl" class="preview-full" @click.stop />
        <button class="preview-close" @click="closeImagePreview">✕</button>
      </div>
    </transition>

    <!-- 0撸 发布弹窗 -->
    <transition name="fade">
      <div v-if="showZeroPublish" class="zero-modal-overlay" @click.self="showZeroPublish=false">
        <div class="zero-modal">
          <div class="zero-modal-header">
            <span>发布0撸信息</span>
            <button class="zero-modal-close" @click="showZeroPublish=false">✕</button>
          </div>
          <div class="zero-modal-body">
            <div class="zero-quota">今日已发 {{ zeroTodayCount }}/20 条</div>
            <div class="zero-textarea-wrap">
              <textarea
                v-model="zeroContent"
                class="zero-textarea"
                placeholder="分享0撸薅羊毛信息（最多30字）"
                maxlength="30"
                rows="3"
              ></textarea>
              <span class="zero-char-count">{{ zeroContent.length }}/30</span>
            </div>
            <!-- 图片预览区 -->
            <div class="zero-img-list">
              <div v-for="(img, idx) in zeroImages" :key="idx" class="zero-img-thumb">
                <img :src="img.url" class="zero-thumb-img" />
                <div v-if="img.uploading" class="zero-thumb-uploading">
                  <div class="upload-spin"></div>
                </div>
                <button class="zero-thumb-del" @click="removeZeroImage(idx)">✕</button>
              </div>
              <button v-if="zeroImages.length < 2" class="zero-add-img" @click="selectZeroImage">
                <span>📷</span><span>添加图片</span>
              </button>
            </div>
          </div>
          <div class="zero-modal-footer">
            <button class="zero-cancel-btn" @click="showZeroPublish=false">取消</button>
            <button class="zero-submit-btn" :disabled="zeroSubmitting" @click="submitZeroPost">
              {{ zeroSubmitting ? '发布中...' : '发布' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.community-container {
  display:flex; flex-direction:column; background:#fff;
  height: 100%;
  overflow: hidden;
}

.community-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#fff; border-bottom:1px solid #f0f0f0; flex-shrink:0; }
.topbar-id { display:flex; align-items:center; gap:5px; }
.id-icon { font-size:16px; }
.id-label { font-size:11px; color:#999; }
.id-num { font-size:15px; font-weight:700; color:#333; letter-spacing:1px; }
.id-badge { font-size:11px; font-weight:600; padding:2px 8px; border-radius:10px; white-space:nowrap; }
.btn-participate { padding:7px 14px; background:linear-gradient(135deg,#f0a500,#ffc700); color:#fff; border:none; border-radius:20px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(240,165,0,.3); }
.btn-activated { padding:7px 14px; background:#f0fff4; color:#07C160; border:1px solid #07C160; border-radius:20px; font-size:13px; font-weight:600; cursor:pointer; }
.chat-messages { flex:1; overflow-y:auto; padding:16px 16px 8px; display:flex; flex-direction:column; gap:4px; scrollbar-width:none; }
.chat-messages::-webkit-scrollbar { display:none; }


.welcome-area { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px 24px; text-align:center; }
.welcome-banner { width:100%; max-width:340px; border-radius:16px; overflow:hidden; margin-bottom:16px; box-shadow:0 4px 16px rgba(0,0,0,.12); }
.banner-img { width:100%; height:auto; display:block; }
.welcome-title { font-size:22px; font-weight:700; margin-bottom:6px; }
.welcome-sub { font-size:14px; color:#999; margin-bottom:20px; }
.welcome-tags { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.welcome-tag { background:#f5f5f5; border:1px solid #e0e0e0; border-radius:20px; padding:6px 14px; font-size:13px; color:#333; cursor:pointer; }
.welcome-tag:hover { background:#f0a500; border-color:#f0a500; color:#fff; }

.message-row { display:flex; gap:10px; max-width:88%; align-items:flex-start; }
.msg-left  { align-self:flex-start; }
.msg-right { align-self:flex-end; flex-direction:row-reverse; }

.msg-avatar { width:34px; height:34px; border-radius:50%; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:20px; cursor:pointer; }
.ai-avatar-wrap       { background:linear-gradient(135deg,#f7b500,#ffc700); }
.deepsook-avatar-wrap { background:linear-gradient(135deg,#1a1a2e,#16213e); }
.ppx-avatar-wrap      { background:linear-gradient(135deg,#0a3d62,#1e6b9e); }
.hx-avatar-wrap       { background:linear-gradient(135deg,#1b4332,#2d6a4f); }
.lottery-avatar-wrap  { background:linear-gradient(135deg,#1a0d2e,#3b0764); }
.other-avatar-wrap    { background:linear-gradient(135deg,#64b5f6,#42a5f5); }
.user-avatar-wrap     { background:linear-gradient(135deg,#95ec69,#7dd959); }
.avatar-img { width:100%; height:100%; object-fit:cover; }
.avatar-initial { font-size:13px; font-weight:700; color:#fff; }

.msg-body { display:flex; flex-direction:column; gap:3px; max-width:100%; min-width:0; }
.msg-body-right { align-items:flex-end; }
.msg-sender { font-size:12px; font-weight:600; color:#888; padding-left:2px; margin-bottom:2px; }
.deepsook-sender { color:#b8860b; } .ppx-sender { color:#0077b6; } .hx-sender { color:#1b4332; } .lottery-sender { color:#4c1d95; }

.ai-text { font-size:15px; line-height:1.6; color:#1c1b1f; word-break:break-word; }
.deepsook-text { background:linear-gradient(135deg,#fff8e1,#fff3cd); border-left:3px solid #F7B500; padding:8px 12px; border-radius:0 12px 12px 12px; }
.ppx-text      { background:linear-gradient(135deg,#e0f7ff,#caf0f8); border-left:3px solid #00b4d8; padding:8px 12px; border-radius:0 12px 12px 12px; }
.hx-text       { background:linear-gradient(135deg,#d8f3dc,#b7e4c7); border-left:3px solid #52b788; padding:8px 12px; border-radius:0 12px 12px 12px; }
.lottery-text  { background:linear-gradient(135deg,#f5f3ff,#ede9fe); border-left:3px solid #7c3aed; padding:8px 12px; border-radius:0 12px 12px 12px; white-space:pre-wrap; }

.msg-bubble { padding:9px 13px; border-radius:16px; word-break:break-word; max-width:100%; }
.other-bubble { background:#f0f2f5; border-radius:4px 16px 16px 16px; }
.my-bubble    { background:#e8f5e0; border-radius:16px 4px 16px 16px; }
.msg-text { font-size:15px; line-height:1.5; color:#1c1b1f; }
.msg-time { font-size:11px; color:#bdbdbd; padding-left:2px; }
.msg-time-right { padding-left:0; padding-right:2px; text-align:right; }

.msg-media { max-width:220px; border-radius:10px; overflow:hidden; position:relative; }
.media-img { width:100%; max-height:220px; object-fit:cover; cursor:pointer; display:block; }
.media-video { width:100%; max-height:200px; object-fit:contain; background:#000; }
.media-upload-overlay { position:absolute; inset:0; background:rgba(0,0,0,.48); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#fff; font-size:12px; border-radius:10px; }
.media-upload-overlay.failed { background:rgba(180,0,0,.55); }
.video-lazy-cover { width:200px; height:120px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; cursor:pointer; }
.video-play-icon { width:46px; height:46px; background:rgba(255,255,255,.18); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; padding-left:4px; color:#fff; }
.upload-spin { width:24px; height:24px; border:2.5px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation:spin .65s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

.typing-indicator { align-self:flex-start; display:flex; align-items:center; gap:4px; padding:10px 14px; margin-left:44px; }
.typing-indicator span { width:7px; height:7px; border-radius:50%; background:#bdbdbd; animation:bounce 1.2s infinite ease-in-out; }
.typing-indicator span:nth-child(2) { animation-delay:.2s; }
.typing-indicator span:nth-child(3) { animation-delay:.4s; }
@keyframes bounce { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-6px); } }

.chat-mode-bar { display:flex; gap:8px; padding:6px 14px 4px; background:#fff; border-top:1px solid rgba(0,0,0,.06); flex-shrink:0; }
.mode-btn { flex:1; padding:7px 0; border:1.5px solid #e0e0e0; border-radius:20px; background:#f7f7f7; font-size:13px; color:#888; cursor:pointer; font-weight:500; }
.mode-active-free { background:#e8f5e9; border-color:#07C160; color:#07C160; font-weight:700; }
.mode-active-ai   { background:#e3f0ff; border-color:#1976D2; color:#1976D2; font-weight:700; }
.mode-active-zero { background:#fff8e1; border-color:#f59e0b; color:#d97706; font-weight:700; }

/* ── 0撸 feed ─────────────────────────────────────────── */
.zero-feed { flex:1; overflow-y:auto; padding:12px 14px 80px; display:flex; flex-direction:column; gap:10px; position:relative; scrollbar-width:none; }
.zero-feed::-webkit-scrollbar { display:none; }
.zero-empty { text-align:center; color:#aaa; padding:40px 0; font-size:14px; }
.zero-post-card { background:#fff; border:1px solid #f0f0f0; border-radius:12px; padding:12px 14px; box-shadow:0 1px 4px rgba(0,0,0,.05); }
.zero-post-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.zero-user-no { font-size:12px; font-weight:600; color:#666; background:#f5f5f5; padding:2px 8px; border-radius:10px; }
.zero-post-time { font-size:11px; color:#bbb; }
.zero-post-content { font-size:15px; color:#222; line-height:1.6; margin:0 0 8px; word-break:break-all; }
.zero-post-images { display:flex; gap:8px; flex-wrap:wrap; }
.zero-img { width:100px; height:100px; object-fit:cover; border-radius:8px; cursor:pointer; border:1px solid #eee; }
.zero-load-more { text-align:center; color:#1976D2; font-size:13px; padding:10px; cursor:pointer; }
.zero-no-more { text-align:center; color:#ccc; font-size:12px; padding:8px; }
.zero-publish-fab { position:fixed; right:20px; bottom:80px; width:auto; padding:10px 20px; background:linear-gradient(135deg,#f59e0b,#fcd34d); border:none; border-radius:24px; color:#fff; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px rgba(245,158,11,.4); z-index:100; }

/* ── 0撸 发布弹窗 ─────────────────────────────────────── */
.zero-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9000; display:flex; align-items:flex-end; justify-content:center; }
.zero-modal { background:#fff; width:100%; max-width:480px; border-radius:20px 20px 0 0; padding:0 0 env(safe-area-inset-bottom); max-height:80vh; overflow-y:auto; }
.zero-modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 18px 12px; border-bottom:1px solid #f0f0f0; font-size:16px; font-weight:700; color:#333; }
.zero-modal-close { background:none; border:none; font-size:18px; cursor:pointer; color:#888; }
.zero-modal-body { padding:14px 18px; }
.zero-quota { font-size:12px; color:#f59e0b; font-weight:600; margin-bottom:10px; }
.zero-textarea-wrap { position:relative; margin-bottom:12px; }
.zero-textarea { width:100%; border:1.5px solid #e0e0e0; border-radius:10px; padding:10px 12px; font-size:15px; line-height:1.5; resize:none; outline:none; font-family:inherit; box-sizing:border-box; background:#fafafa; }
.zero-textarea:focus { border-color:#f59e0b; background:#fff; }
.zero-char-count { position:absolute; right:10px; bottom:8px; font-size:11px; color:#bbb; }
.zero-img-list { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.zero-img-thumb { position:relative; width:72px; height:72px; border-radius:8px; overflow:hidden; }
.zero-thumb-img { width:100%; height:100%; object-fit:cover; }
.zero-thumb-uploading { position:absolute; inset:0; background:rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; }
.zero-thumb-del { position:absolute; top:2px; right:2px; width:18px; height:18px; background:rgba(0,0,0,.5); border:none; border-radius:50%; color:#fff; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.zero-add-img { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; width:72px; height:72px; border:1.5px dashed #ccc; border-radius:8px; background:#fafafa; cursor:pointer; font-size:12px; color:#999; }
.zero-modal-footer { display:flex; gap:10px; padding:10px 18px 16px; }
.zero-cancel-btn { flex:1; padding:11px; border:1.5px solid #e0e0e0; border-radius:10px; background:#fff; font-size:15px; color:#666; cursor:pointer; }
.zero-submit-btn { flex:2; padding:11px; border:none; border-radius:10px; background:linear-gradient(135deg,#f59e0b,#fbbf24); color:#fff; font-size:15px; font-weight:700; cursor:pointer; }
.zero-submit-btn:disabled { opacity:.5; cursor:not-allowed; }

.input-area { display:flex; align-items:flex-end; gap:8px; padding:8px 12px; padding-bottom:calc(10px + env(safe-area-inset-bottom)); background:#fff; border-top:1px solid rgba(0,0,0,.07); flex-shrink:0; position:relative; }
.textarea-wrap { flex:1; background:#f0f2f5; border-radius:26px; padding:13px 18px; min-height:52px; display:flex; align-items:center; }
.message-textarea { width:100%; background:transparent; border:none; outline:none; resize:none; font-size:16px; line-height:1.5; color:#1c1b1f; overflow-y:hidden; min-height:26px; max-height:120px; font-family:inherit; }
.message-textarea::placeholder { color:#bdbdbd; }
.icon-btn { width:40px; height:40px; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; color:#65676b; flex-shrink:0; }
.send-btn { color:#f0a500; }
.attach-menu { position:absolute; bottom:62px; left:10px; background:#fff; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,.15); padding:12px; display:flex; gap:16px; z-index:50; }
.attach-item { display:flex; flex-direction:column; align-items:center; gap:6px; background:transparent; border:none; cursor:pointer; font-size:12px; color:#333; padding:4px 8px; border-radius:8px; }
.attach-icon { width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; }

.attach-pop-enter-active,.attach-pop-leave-active { transition:all .2s ease; }
.attach-pop-enter-from,.attach-pop-leave-to { opacity:0; transform:translateY(8px) scale(.95); }
.fade-enter-active,.fade-leave-active { transition:opacity .25s ease; }
.fade-enter-from,.fade-leave-to { opacity:0; }

.preview-overlay { position:fixed; inset:0; background:rgba(0,0,0,.88); z-index:9999; display:flex; align-items:center; justify-content:center; }
.preview-full { width:90vw; height:auto; max-height:88vh; object-fit:contain; border-radius:8px; }
.preview-close { position:absolute; top:20px; right:20px; width:40px; height:40px; border-radius:50%; border:none; background:rgba(255,255,255,.18); color:#fff; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
</style>

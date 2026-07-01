<template>
  <div class="community-container">
    <!-- 聊天消息流 -->
    <div class="chat-messages" ref="messagesContainer">

      <!-- 空状态欢迎页 -->
      <div v-if="messages.length === 0" class="welcome-area">
        <div class="welcome-logo">
          <img src="/community-banner.jpg" class="welcome-img" alt="AI Chain Global" />
        </div>
        <div class="welcome-tags">
          <button class="welcome-tag" @click="setQuickInput('项目介绍')">🌐 项目介绍</button>
          <button class="welcome-tag" @click="setQuickInput('如何参与')">🤝 如何参与</button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['message-row', getMessagePosition(msg)]">

        <!-- AI 消息（左侧） -->
        <template v-if="msg.type === 'ai'">
          <div class="msg-avatar ai-avatar-wrap" @click="previewAvatar('ai', null)">
            <img src="/ai-bot-avatar.jpg" class="avatar-img" alt="AI社群" />
          </div>
          <div class="msg-body">
            <div class="msg-sender">AI 顾问</div>
            <div
              v-if="msg.content || typingId === msg.id"
              class="msg-text ai-text"
              v-html="typingId === msg.id ? typingText : msg.content">
            </div>


            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <!-- 🦞 大虾 DeepSook 消息（左侧） -->
        <template v-else-if="msg.type === 'deepsook'">
          <div class="msg-avatar deepsook-avatar-wrap">
            <img src="/checkin-logo.jpg" class="avatar-img" alt="大虾" />
          </div>
          <div class="msg-body">
            <div class="msg-sender deepsook-sender">🦞 大龙虾 DeepSook</div>
            <div class="msg-text ai-text deepsook-text">{{ msg.content }}</div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <!-- 🦐 皮皮虾 PPX 消息（左侧） -->
        <template v-else-if="msg.type === 'ppx'">
          <div class="msg-avatar ppx-avatar-wrap">
            <span class="shrimp-emoji-avatar">🦐</span>
          </div>
          <div class="msg-body">
            <div class="msg-sender ppx-sender">🦐 皮皮虾 PPX</div>
            <div class="msg-text ai-text ppx-text">{{ msg.content }}</div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <!-- 🦀 养生虾 HealthX 消息（左侧） -->
        <template v-else-if="msg.type === 'healthx'">
          <div class="msg-avatar hx-avatar-wrap">
            <span class="shrimp-emoji-avatar">🦀</span>
          </div>
          <div class="msg-body">
            <div class="msg-sender hx-sender">🦀 养生虾 HealthX</div>
            <div class="msg-text ai-text hx-text">{{ msg.content }}</div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <!-- 🎱 彩球博士 消息（左侧） -->
        <template v-else-if="msg.type === 'lottery'">
          <div class="msg-avatar lottery-avatar-wrap">
            <span class="shrimp-emoji-avatar lottery-avatar">🎱</span>
          </div>
          <div class="msg-body">
            <div class="msg-sender lottery-sender">🎱 彩球博士</div>
            <div class="msg-text ai-text lottery-text">{{ msg.content }}</div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

        <!-- 自己的消息（右侧） -->
        <template v-else-if="isMyMessage(msg)">
          <div class="msg-body msg-body-right">
            <div class="msg-bubble my-bubble">
              <div v-if="getMediaType(msg) === 'image'" class="msg-media">
                <img :src="getMediaUrl(msg)" class="media-img" @click="!msg.uploading && previewImage(getMediaUrl(msg))" />
                <div v-if="msg.uploading" class="media-upload-overlay">
                  <div class="upload-spin"></div>
                  <span>发送中...</span>
                </div>
                <div v-if="msg.uploadFailed" class="media-upload-overlay failed">
                  <span>❌ 发送失败</span>
                </div>
              </div>
              <div v-else-if="getMediaType(msg) === 'video'" class="msg-media">
                <div v-if="msg.uploading" class="video-upload-placeholder">
                  <div class="upload-spin"></div>
                  <span>发送中...</span>
                </div>
                <div v-else-if="msg.uploadFailed" class="video-upload-placeholder failed">
                  <span>❌ 发送失败</span>
                </div>
                <div v-else-if="!activeVideoIds.has(msg.id)" class="video-lazy-cover" @click="activateVideo(msg.id)">
                  <div class="video-play-icon">▶</div>
                  <span class="video-play-hint">点击播放</span>
                </div>
                <video v-else :src="getMediaUrl(msg)" class="media-video" controls playsinline autoplay></video>
              </div>
              <span v-else class="msg-text">{{ getMessageText(msg) }}</span>
            </div>
            <div class="msg-time msg-time-right">{{ msg.time }}</div>
          </div>
          <div class="msg-avatar user-avatar-wrap" @click="previewAvatar('user', userAvatar)">
            <img v-if="userAvatar" :src="userAvatar" class="avatar-img" alt="头像" />
            <span v-else class="avatar-initial">我</span>
          </div>
        </template>

        <!-- 其他用户的消息（左侧） -->
        <template v-else>
          <div class="msg-avatar other-avatar-wrap" @click="previewAvatar('other', msg.avatarUrl)">
            <img v-if="msg.avatarUrl" :src="msg.avatarUrl" class="avatar-img" alt="头像" />
            <span v-else class="avatar-initial">{{ getUserInitial(msg) }}</span>
          </div>
          <div class="msg-body">
            <div class="msg-sender">{{ msg.userName || '用户' }}</div>
            <div class="msg-bubble other-bubble">
              <div v-if="getMediaType(msg) === 'image'" class="msg-media">
                <img :src="getMediaUrl(msg)" class="media-img" @click="previewImage(getMediaUrl(msg))" />
              </div>
              <div v-else-if="getMediaType(msg) === 'video'" class="msg-media">
                <div v-if="!activeVideoIds.has(msg.id)" class="video-lazy-cover" @click="activateVideo(msg.id)">
                  <div class="video-play-icon">▶</div>
                  <span class="video-play-hint">点击播放</span>
                </div>
                <video v-else :src="getMediaUrl(msg)" class="media-video" controls playsinline autoplay></video>
              </div>
              <span v-else class="msg-text">{{ getMessageText(msg) }}</span>
            </div>
            <div class="msg-time">{{ msg.time }}</div>
          </div>
        </template>

      </div>

      <!-- AI 正在输入指示器（打字动画中 或 等待后端响应） -->
      <div v-if="typingId || aiThinking" class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <!-- 自动滚动占位 -->
      <div ref="messagesEnd"></div>
    </div>

    <!-- ✦ 行动卡片浮层（完全独立于消息流，不受服务器轮询影响） -->
    <transition name="card-pop">
      <div v-if="currentActionCard" class="action-card-float">
        <button class="action-card-close" @click="closeActionCard">✕</button>

        <!-- ========== 充值面板（已隐藏，改为合伙人点对点服务）========== -->
        <template v-if="false && currentActionCard.type === 'recharge'">
          <div class="panel-title">💎 USDT充值 <span class="panel-net">BSC BEP20</span></div>
          <!-- 余额 -->
          <div class="action-balance-row">
            <span class="action-bal-icon">💰</span>
            <span class="action-bal-amount">当前学分 {{ userStore.balance.toFixed(2) }}</span>
          </div>
          <!-- 金额选择 -->
          <div class="panel-amounts">
            <button v-for="a in [10,30,60,100]" :key="a"
              :class="['panel-amt-btn', rcAmount===a ? 'amt-active' : '']"
              @click="rcAmount=a; rcCustom=''">${{ a }}</button>
            <input v-model="rcCustom" type="number" min="10" placeholder="自定义"
              class="panel-amt-input" @input="rcAmount = parseFloat(rcCustom) || null" />
          </div>
          <!-- 平台收款地址 -->
          <div v-if="rcAmount" class="panel-addr-box">
            <span class="panel-addr-label">转账地址：</span>
            <span class="panel-addr-text">{{ PLATFORM_ADDR }}</span>
            <button class="panel-copy-btn" @click="copyPlatformAddr">{{ rcCopied ? '✅' : '📋' }}</button>
          </div>
          <div v-if="rcAmount" class="panel-hint">请转 <b>${{ rcAmount }} USDT</b>，转完后粘贴交易哈希</div>
          <!-- TXID输入 -->
          <textarea v-if="rcAmount" v-model="rcTxid" class="panel-txid"
            placeholder="粘贴交易哈希 (0x...)" rows="2"></textarea>
          <button v-if="rcAmount" class="panel-submit-btn"
            :disabled="!canSubmitRecharge || rcSubmitting"
            @click="submitRecharge">
            {{ rcSubmitting ? '⏳ 验证中...' : '✅ 验证并到账' }}
          </button>
          <div v-if="rcResult" :class="['panel-result', rcSuccess ? 'result-ok' : 'result-err']">{{ rcResult }}</div>
        </template>

        <!-- ========== 提现面板（已隐藏，改为合伙人点对点服务）========== -->
        <template v-else-if="false && currentActionCard.type === 'withdraw'">
          <div class="panel-title">💸 余额提现</div>
          <!-- 余额 -->
          <div class="action-balance-row">
            <span class="action-bal-icon">💰</span>
            <span class="action-bal-amount">可提 ${{ userStore.balance.toFixed(2) }}</span>
          </div>
          <!-- 金额 -->
          <div class="panel-field">
            <label class="panel-field-label">提现金额 (最低$10)</label>
            <div class="panel-input-row">
              <span class="panel-prefix">$</span>
              <input v-model.number="wdAmount" type="number" min="10" class="panel-input"
                placeholder="输入金额" />
              <button class="panel-max-btn" @click="wdAmount = Math.floor(userStore.balance)">全部</button>
            </div>
          </div>
          <!-- 钱包地址 -->
          <div class="panel-field">
            <label class="panel-field-label">收款钱包地址 (BSC BEP20)</label>
            <input v-model="wdWallet" class="panel-input-full"
              placeholder="0x... (币安链BEP20地址)" />
          </div>
          <button class="panel-submit-btn"
            :disabled="!canSubmitWithdraw || wdSubmitting"
            @click="submitWithdraw">
            {{ wdSubmitting ? '⏳ 处理中...' : '🚀 申请提现' }}
          </button>
          <div v-if="wdResult" :class="['panel-result', wdSuccess ? 'result-ok' : 'result-err']">{{ wdResult }}</div>
        </template>

        <!-- ========== 普通按钮卡片 ========== -->
        <template v-else>
          <div v-if="currentActionCard.showBalance" class="action-balance-row">
            <span class="action-bal-icon">💰</span>
            <span class="action-bal-amount">
              {{ userStore.isInitialized ? '$' + userStore.balance.toFixed(2) : '登录查看' }}
            </span>
            <span v-if="currentActionCard.balanceHint && userStore.isInitialized" class="action-bal-hint">
              · {{ getBalanceHint(userStore.balance, userStore.isActivated) }}
            </span>
          </div>
          <div class="action-btns-row">
            <button
              v-for="btn in currentActionCard.buttons"
              :key="btn.label"
              :class="['action-btn', btn.primary ? 'action-btn-primary' : 'action-btn-secondary']"
              @click="goToPage(btn)">
              {{ btn.label }}
            </button>
          </div>
        </template>
      </div>
    </transition>

    <!-- 聊天模式切换 -->
    <div class="chat-mode-bar">
      <button :class="['mode-btn', chatMode === 'free' ? 'mode-active-free' : '']" @click="setChatMode('free')">
        💬 自由聊天
      </button>
      <button :class="['mode-btn', chatMode === 'ai' ? 'mode-active-ai' : '']" @click="setChatMode('ai')">
        🤖 AI问答
      </button>
    </div>

    <!-- 底部输入栏 -->
    <div class="input-area">
      <button
        class="icon-btn attach-btn"
        @click="showAttachMenu = !showAttachMenu"
        title="附件">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>

      <div class="textarea-wrap">
        <textarea
          ref="textareaRef"
          v-model="inputText"
          class="message-textarea"
          placeholder="有什么想问的？（项目/参与/收益/拼团...）"
          rows="1"
          @input="autoResize"
          @keydown.enter.exact.prevent="sendMessage"
          @keydown.shift.enter.exact></textarea>
      </div>

      <button class="icon-btn send-btn" @click="sendMessage" title="发送">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>

    <!-- 附件菜单 -->
    <transition name="attach-pop">
      <div v-if="showAttachMenu" class="attach-menu">
        <button class="attach-item" @click="selectImage">
          <div class="attach-icon" style="background: #07C160;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <span>图片</span>
        </button>
        <button class="attach-item" @click="selectVideo">
          <div class="attach-icon" style="background: #1976D2;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          </div>
          <span>视频</span>
        </button>
      </div>
    </transition>


    <!-- 隐藏的文件选择器 -->
    <input ref="imageInput" type="file" accept="image/*" style="display: none;" @change="handleImageSelect" />
    <input ref="videoInput" type="file" accept="video/mp4,video/webm,video/quicktime" style="display: none;" @change="handleVideoSelect" />

    <input ref="avatarInput" type="file" accept="image/*" style="display: none;" @change="handleAvatarUpload" />

    <!-- 图片预览遮罩 -->
    <transition name="fade">
      <div v-if="showImagePreview" class="preview-overlay" @click="closeImagePreview">
        <img :src="previewImageUrl" class="preview-full" @click.stop />
        <button class="preview-close" @click="closeImagePreview">✕</button>
      </div>
    </transition>

    <!-- 头像放大预览遮罩 -->
    <transition name="fade">
      <div v-if="showAvatarPreview" class="preview-overlay" @click="closeAvatarPreview">
        <div class="avatar-preview-box" @click.stop>
          <!-- Tab切换（仅自己头像显示Tab） -->
          <div v-if="previewAvatarType === 'user'" class="avatar-preview-tabs">
            <button :class="['apv-tab', previewTab === 'avatar' ? 'active' : '']" @click="previewTab = 'avatar'">头像</button>
            <button :class="['apv-tab', previewTab === 'qrcode' ? 'active' : '']" @click="previewTab = 'qrcode'">微信/QQ码</button>
          </div>

          <!-- 头像Tab -->
          <div v-if="previewTab === 'avatar'" class="avatar-preview-img-wrap">
            <img v-if="previewAvatarSrc" :src="previewAvatarSrc" class="avatar-preview-full" />
            <div
              v-else
              :class="['avatar-preview-placeholder', previewAvatarType === 'ai' ? 'preview-ai' : 'preview-user']">
              {{ previewAvatarType === 'ai' ? 'AI' : '我' }}
            </div>
          </div>

          <!-- 二维码Tab（仅自己） -->
          <div v-if="previewTab === 'qrcode' && previewAvatarType === 'user'" class="qrcode-preview-wrap">
            <div v-if="userQrCode" class="qrcode-img-wrap">
              <img :src="userQrCode" class="qrcode-preview-img" />
              <p class="qrcode-hint">扫码加好友</p>
            </div>
            <div v-else class="qrcode-empty">
              <div class="qrcode-empty-icon">📱</div>
              <p>还没有上传微信/QQ二维码</p>
              <p style="font-size:12px;color:#aaa">上传后别人点你头像可扫码加你</p>
            </div>
          </div>

          <div class="preview-actions">
            <template v-if="previewAvatarType === 'user'">
              <button v-if="previewTab === 'avatar'" class="preview-action-btn" @click.stop="openAvatarUpload">
                📷 更换头像
              </button>
              <button v-if="previewTab === 'qrcode'" class="preview-action-btn qr-upload-btn" @click.stop="openQrUpload">
                {{ userQrCode ? '🔄 重新上传' : '📤 上传二维码' }}
              </button>
            </template>
            <button class="preview-action-btn" @click="closeAvatarPreview">关闭</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 二维码文件选择器 -->
    <input ref="qrCodeInput" type="file" accept="image/*" style="display: none;" @change="handleQrUpload" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getMessageService } from '../logic/messageService.js'
import { uploadImage, uploadAvatar, uploadVideo } from '../services/uploadService.js'
import { getOrCreateUserId } from '../utils/auth.js'
import { isAIQuestion, getAIResponse } from '../services/aiBotService.js'
import { detectActionCard, getBalanceHint } from '../utils/actionCards.js'
import { useUserStore } from '../stores/userStore.js'

const router = useRouter()
const userStore = useUserStore()

// ==================== 状态管理 ====================

const messageService = getMessageService()
const messages = ref(messageService.getMessages())
const inputText = ref('')
const messagesContainer = ref(null)
const messagesEnd = ref(null)
const textareaRef = ref(null)
const showAttachMenu = ref(false)

// ==================== 聊天模式 ====================
const chatMode = ref(localStorage.getItem('chat_mode') || 'ai')
const setChatMode = (mode) => {
  chatMode.value = mode
  localStorage.setItem('chat_mode', mode)
}
const imageInput = ref(null)
const videoInput = ref(null)
const activeVideoIds = ref(new Set())
const activateVideo = (id) => {
  activeVideoIds.value = new Set([...activeVideoIds.value, id])
}

function setQuickInput(text) {
  inputText.value = text
  nextTick(() => { textareaRef.value?.focus() })
}

const avatarInput = ref(null)
const qrCodeInput = ref(null)
const userAvatar = ref(null)
const userQrCode = ref(null)          // 微信/QQ二维码 URL
const isUploadingAvatar = ref(false)
const previewTab = ref('avatar')      // 'avatar' | 'qrcode'

// 当前用户ID
const currentUserId = ref(getOrCreateUserId())

// AI 打字动画状态
const typingId = ref(null)
const typingText = ref('')
let typingTimer = null

// AI 正在思考（等待后端响应）
const aiThinking = ref(false)

// 当前行动卡片（固定浮层，完全独立于消息流，永不被服务器轮询清除）
const currentActionCard = ref(null)

// ==================== 充值 / 提现 面板状态 ====================
const PLATFORM_ADDR = '0x24db08aa8369d4405ada32a133862d63090847fb'

// 充值
const rcAmount = ref(null)
const rcCustom = ref('')
const rcTxid = ref('')
const rcSubmitting = ref(false)
const rcResult = ref('')
const rcSuccess = ref(false)
const rcCopied = ref(false)
const canSubmitRecharge = computed(() =>
  rcAmount.value >= 10 && /^0x[0-9a-fA-F]{64}$/.test(rcTxid.value.trim()) && !rcSubmitting.value
)

// 提现
const wdAmount = ref(null)
const wdWallet = ref('')
const wdSubmitting = ref(false)
const wdResult = ref('')
const wdSuccess = ref(false)
const canSubmitWithdraw = computed(() =>
  wdAmount.value >= 10 &&
  wdAmount.value <= userStore.balance &&
  /^0x[0-9a-fA-F]{40}$/.test(wdWallet.value.trim()) &&
  !wdSubmitting.value
)

let unsubscribe = null
let prevMsgLen = 0

// ==================== 生命周期 ====================

onMounted(() => {
  messages.value = messageService.getMessages()
  prevMsgLen = messages.value.length

  unsubscribe = messageService.subscribe((newMessages) => {
    const oldLen = prevMsgLen
    // 深拷贝每个消息对象，确保 Vue 检测到每个字段的变化（如 mediaUrl、uploading）
    messages.value = newMessages.map(m => ({ ...m }))
    prevMsgLen = newMessages.length

    // 只有新消息到来时才滚底 + 打字动画，消息过期减少不滚底
    if (newMessages.length > oldLen) {
      const lastMsg = newMessages[newMessages.length - 1]
      if (lastMsg.type === 'ai') {
        startTyping(lastMsg)
      }
      scrollToBottom()
    }
  })

  scrollToBottom()
  messageService.startAutoBroadcast()
  loadUserAvatar()
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
  if (typingTimer) clearInterval(typingTimer)
})

// ==================== 打字动画 ====================

function startTyping(msg) {
  if (typingTimer) clearInterval(typingTimer)
  typingId.value = msg.id
  typingText.value = ''
  let i = 0
  const content = String(msg.content || '')
  typingTimer = setInterval(() => {
    if (i < content.length) {
      typingText.value = content.slice(0, i + 1)
      i++
      scrollToBottom()
    } else {
      clearInterval(typingTimer)
      typingTimer = null
      typingId.value = null
    }
  }, 16)
}

// ==================== 用户名/ID ====================

function getCurrentUserName() {
  return localStorage.getItem('chatUserName') || generateUserName()
}

function generateUserName() {
  const code = Math.random().toString(36).substr(2, 3).toUpperCase()
  const name = '用户_' + code
  localStorage.setItem('chatUserName', name)
  return name
}

function isMyMessage(msg) {
  return msg.userId === currentUserId.value
}

function getMessagePosition(msg) {
  if (['ai', 'deepsook', 'ppx', 'healthx', 'lottery'].includes(msg.type)) return 'msg-left'
  return isMyMessage(msg) ? 'msg-right' : 'msg-left'
}

function getUserInitial(msg) {
  const name = msg.userName || msg.user_name || '用户'
  return name.charAt(0).toUpperCase()
}

// ==================== 头像 & 二维码加载 ====================

// 从 localStorage 加载二维码
const cachedQr = localStorage.getItem('userQrCodeUrl')
if (cachedQr) userQrCode.value = cachedQr

async function loadUserAvatar() {
  const cached = localStorage.getItem('userAvatarUrl')
  if (cached) userAvatar.value = cached

  const userData = localStorage.getItem('userData')
  if (!userData) return

  try {
    const user = JSON.parse(userData)
    if (!user.id) return
    const res = await fetch(`/api/auth/avatar/${user.id}`)
    const data = await res.json()
    if (data.code === 200 && data.data?.avatarUrl) {
      userAvatar.value = data.data.avatarUrl
      localStorage.setItem('userAvatarUrl', data.data.avatarUrl)
    }
  } catch (e) {}
}

// ==================== 消息解析 ====================

const parseMediaInfo = (msg) => {
  const type = msg.mediaType || msg.media_type
  const url = msg.mediaUrl || msg.media_url
  if (type && url) return { type, url }

  if (msg.content && typeof msg.content === 'string') {
    const trimmed = msg.content.trim()
    if (trimmed.startsWith('{') && trimmed.includes('"type"')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed.type && (parsed.url || parsed.mediaUrl)) {
          return { type: parsed.type, url: parsed.url || parsed.mediaUrl }
        }
      } catch (e) {}
    }
  }
  return null
}

const getMediaType = (msg) => parseMediaInfo(msg)?.type || null
const getMediaUrl = (msg) => parseMediaInfo(msg)?.url || null
const getMessageText = (msg) => {
  const media = parseMediaInfo(msg)
  if (media) return media.type === 'image' ? '[图片]' : '[视频]'
  return msg.content
}

// ==================== 消息发送 ====================

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text) return

  messageService.addUserMessage(text, getCurrentUserName(), currentUserId.value, userAvatar.value)
  inputText.value = ''
  resetTextareaHeight()
  scrollToBottom()

  // 检测关键词 → 立即显示行动卡片（不等AI回复，与AI完全独立）
  const actionCard = detectActionCard(text)
  if (actionCard) {
    // 切换到新卡片时重置面板状态
    if (!currentActionCard.value || currentActionCard.value.type !== actionCard.type) {
      closeActionCard()
    }
    currentActionCard.value = actionCard
    // 充值/提现：预填金额
    if (actionCard.type === 'recharge' && actionCard.prefillAmount) rcAmount.value = actionCard.prefillAmount
    if (actionCard.type === 'withdraw' && actionCard.prefillAmount) wdAmount.value = actionCard.prefillAmount
  } else {
    currentActionCard.value = null
  }

  // 自由聊天模式：AI不插话，直接返回
  if (chatMode.value === 'free') return

  // 🦞🦐🦀 检测 @召唤 → 调用虾家族 AI（消耗0.5积分/次）
  const SHRIMP_BOTS = [
    { keywords: ['@彩球', '@彩票', '@3D', '@福彩', '@快乐8', '@选号'], bot: 'lottery',  type: 'lottery',  fallback: '彩球博士正在推演数字 🎱' },
    { keywords: ['@大虾', '@大龙虾', '@DeepSook'], bot: 'deepsook', type: 'deepsook', fallback: '大虾暂时在忙 🦞' },
    { keywords: ['@皮皮虾', '@PPX', '@小虾'],      bot: 'ppx',      type: 'ppx',      fallback: '皮皮虾去冒险了 🦐' },
    { keywords: ['@养生虾', '@HealthX', '@健康'],   bot: 'healthx',  type: 'healthx',  fallback: '养生虾正在把脉 🦀' },
  ]
  const matchedBot = SHRIMP_BOTS.find(b => b.keywords.some(k => text.includes(k)))

  if (matchedBot) {
    aiThinking.value = true
    nextTick(() => scrollToBottom())

    try {
      const allKeywords = matchedBot.keywords.join('|').replace(/[@\u0040]/g, '@')
      const question = matchedBot.keywords.reduce((t, k) => t.replace(new RegExp(k, 'g'), ''), text).trim() || text
      const userId = userStore.userId || currentUserId.value

      if (!userId) {
        messageService.addMessage({
          id: Date.now().toString(), type: matchedBot.type,
          content: '请先登录才能召唤虾家族 🦞',
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        })
        aiThinking.value = false
        return
      }

      const res = await fetch(`/api/chat/${matchedBot.bot}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, userId, history: [] })
      })
      const data = await res.json()

      messageService.addMessage({
        id: Date.now().toString(), type: matchedBot.type,
        content: data.code === 200 ? data.data.reply : (data.message || matchedBot.fallback),
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      })
    } catch (e) {
      console.error(`[${matchedBot.bot}] 社区调用失败:`, e)
      messageService.addMessage({
        id: Date.now().toString(), type: matchedBot.type,
        content: `网络异常，虾家族没收到消息`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      })
    } finally {
      aiThinking.value = false
      nextTick(() => scrollToBottom())
    }
    return
  }

  if (isAIQuestion(text)) {
    aiThinking.value = true
    nextTick(() => scrollToBottom())

    try {
      const aiResponse = await getAIResponse(text, currentUserId.value)
      if (aiResponse) {
        messageService.addMessage({
          id: Date.now().toString(),
          type: 'ai',
          content: aiResponse,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        })
        nextTick(() => scrollToBottom())
      }
    } catch (e) {
      console.error('[AI] sendMessage error:', e)
    } finally {
      aiThinking.value = false
    }
  }
}

// 页面跳转（行动按钮点击）— 支持 publishType 打开信息发布抽屉
const goToPage = (btn) => {
  if (btn.publishType) {
    window.dispatchEvent(new CustomEvent('openInfoDrawer', { detail: { type: btn.publishType } }))
    currentActionCard.value = null
    return
  }
  if (btn.path) router.push(btn.path)
}

const scrollToBottom = () => {
  if (messagesEnd.value) {
    messagesEnd.value.scrollIntoView({ behavior: 'smooth' })
  }
}

// ==================== 自动调整高度 ====================

const autoResize = () => {
  const el = textareaRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }
}

const resetTextareaHeight = () => {
  const el = textareaRef.value
  if (el) el.style.height = 'auto'
}

// ==================== 充值 / 提现 ====================

function closeActionCard() {
  currentActionCard.value = null
  // 重置充值面板
  rcAmount.value = null; rcCustom.value = ''; rcTxid.value = ''
  rcResult.value = ''; rcSuccess.value = false; rcCopied.value = false
  // 重置提现面板
  wdAmount.value = null; wdWallet.value = ''
  wdResult.value = ''; wdSuccess.value = false
}

async function copyPlatformAddr() {
  try { await navigator.clipboard.writeText(PLATFORM_ADDR) } catch {
    const el = document.createElement('textarea')
    el.value = PLATFORM_ADDR
    el.style.cssText = 'position:fixed;opacity:0;font-size:16px'
    document.body.appendChild(el); el.focus(); el.select()
    document.execCommand('copy'); document.body.removeChild(el)
  }
  rcCopied.value = true
  setTimeout(() => { rcCopied.value = false }, 2000)
}

async function submitRecharge() {
  if (!canSubmitRecharge.value) return
  rcSubmitting.value = true; rcResult.value = ''
  const userId = userStore.userId || currentUserId.value
  if (!userId) { rcResult.value = '请先登录'; rcSuccess.value = false; rcSubmitting.value = false; return }
  try {
    const res = await fetch('/api/recharge/usdt-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, txid: rcTxid.value.trim(), amount: rcAmount.value })
    })
    const data = await res.json()
    rcSuccess.value = data.code === 200
    rcResult.value = data.message || (data.code === 200 ? '充值成功！' : '验证失败')
    if (data.code === 200) {
      await userStore.fetchUserStatus()
      rcTxid.value = ''
    }
  } catch { rcResult.value = '网络错误，请重试'; rcSuccess.value = false }
  rcSubmitting.value = false
}

async function submitWithdraw() {
  if (!canSubmitWithdraw.value) return
  wdSubmitting.value = true; wdResult.value = ''
  const userId = userStore.userId || currentUserId.value
  if (!userId) { wdResult.value = '请先登录'; wdSuccess.value = false; wdSubmitting.value = false; return }
  try {
    const res = await fetch('/api/withdraw/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount: wdAmount.value, walletAddress: wdWallet.value.trim() })
    })
    const data = await res.json()
    wdSuccess.value = data.code === 200
    wdResult.value = data.message || (data.code === 200 ? '申请成功！' : '提交失败')
    if (data.code === 200) {
      await userStore.fetchUserStatus()
      wdAmount.value = null; wdWallet.value = ''
    }
  } catch { wdResult.value = '网络错误，请重试'; wdSuccess.value = false }
  wdSubmitting.value = false
}

// ==================== 媒体选择 ====================

const handleVoice = () => {
  // 语音功能预留
}

const selectImage = () => {
  showAttachMenu.value = false
  imageInput.value?.click()
}

const selectVideo = () => {
  showAttachMenu.value = false
  videoInput.value?.click()
}

const handleVideoSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 50 * 1024 * 1024) {
    alert('视频大小不能超过50MB')
    event.target.value = ''
    return
  }

  const localUrl = URL.createObjectURL(file)
  const tempMsg = messageService.addMediaMessage(
    'video', localUrl, file.name,
    getCurrentUserName(), currentUserId.value, userAvatar.value, true
  )
  scrollToBottom()
  event.target.value = ''

  try {
    const result = await uploadVideo(file)
    messageService.updateMediaUrl(tempMsg.id, result.url)
    URL.revokeObjectURL(localUrl)
  } catch (error) {
    messageService.markMediaUploadFailed(tempMsg.id)
    alert('视频上传失败: ' + error.message)
  }
}


const handleImageSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    alert('图片大小不能超过10MB')
    event.target.value = ''
    return
  }

  // 1. 立即用本地blob URL秒显示消息，不等待上传
  const localUrl = URL.createObjectURL(file)
  const tempMsg = messageService.addMediaMessage(
    'image', localUrl, file.name,
    getCurrentUserName(), currentUserId.value, userAvatar.value, true
  )
  scrollToBottom()
  event.target.value = ''

  // 2. 后台上传，完成后替换为真实CDN URL
  try {
    const result = await uploadImage(file)
    messageService.updateMediaUrl(tempMsg.id, result.url)
    URL.revokeObjectURL(localUrl) // 释放内存
  } catch (error) {
    messageService.markMediaUploadFailed(tempMsg.id)
    alert('图片上传失败: ' + error.message)
  }
}


// ==================== 图片预览 ====================

const showImagePreview = ref(false)
const previewImageUrl = ref('')

const previewImage = (url) => {
  previewImageUrl.value = url
  showImagePreview.value = true
}

const closeImagePreview = () => {
  showImagePreview.value = false
  previewImageUrl.value = ''
}

// ==================== 头像预览 ====================

const showAvatarPreview = ref(false)
const previewAvatarSrc = ref(null)
const previewAvatarType = ref('user')

const previewAvatar = (type, src) => {
  previewAvatarType.value = type
  previewAvatarSrc.value = src
  previewTab.value = 'avatar'
  showAvatarPreview.value = true
}

const closeAvatarPreview = () => {
  showAvatarPreview.value = false
}

const openAvatarUpload = () => {
  showAvatarPreview.value = false
  setTimeout(() => avatarInput.value?.click(), 100)
}

const openQrUpload = () => {
  setTimeout(() => qrCodeInput.value?.click(), 100)
}

const handleQrUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 3 * 1024 * 1024) {
    alert('图片大小不能超过3MB')
    return
  }
  try {
    const qrUrl = await uploadAvatar(file)
    userQrCode.value = qrUrl
    localStorage.setItem('userQrCodeUrl', qrUrl)
    alert('二维码上传成功！别人点你头像即可扫码加你 ✅')
  } catch (error) {
    alert('上传失败: ' + error.message)
  }
  event.target.value = ''
}

const handleAvatarUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    alert('头像大小不能超过2MB')
    return
  }
  const userId = currentUserId.value
  if (!userId) {
    alert('用户ID异常，请刷新页面')
    return
  }
  isUploadingAvatar.value = true
  try {
    const avatarUrl = await uploadAvatar(file)
    userAvatar.value = avatarUrl
    localStorage.setItem('userAvatarUrl', avatarUrl)
    localStorage.setItem(`avatar_${userId}`, avatarUrl)
    alert('头像更新成功！')
  } catch (error) {
    alert('头像上传失败: ' + error.message)
  } finally {
    isUploadingAvatar.value = false
  }
  event.target.value = ''
}
</script>

<style scoped>
.community-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
  overflow: visible;
  position: relative;
}

/* 消息流 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.chat-messages::-webkit-scrollbar { display: none; }

/* 欢迎页 */
.welcome-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
}
.welcome-logo {
  width: 100%;
  max-width: 340px;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 20px;
}
.welcome-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
}
.welcome-title {
  font-size: 22px;
  font-weight: 700;
  color: #111;
  margin: 0 0 8px;
}
.welcome-sub {
  font-size: 14px;
  color: #999;
  margin: 0 0 16px;
}
.welcome-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  padding: 0 12px;
}
.welcome-tag {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}
.welcome-tag:hover {
  background: #07C160;
  border-color: #07C160;
  color: #fff;
}
.deepsook-tag {
  background: linear-gradient(135deg, #fff8e1, #fff3cd);
  border-color: #F7B500; color: #b8860b; font-weight: 600;
}
.deepsook-tag:hover { background: #F7B500; border-color: #F7B500; color: #fff; }
.ppx-tag {
  background: linear-gradient(135deg, #e0f7ff, #caf0f8);
  border-color: #00b4d8; color: #0077b6; font-weight: 600;
}
.ppx-tag:hover { background: #00b4d8; border-color: #00b4d8; color: #fff; }
.hx-tag {
  background: linear-gradient(135deg, #d8f3dc, #b7e4c7);
  border-color: #52b788; color: #1b4332; font-weight: 600;
}
.hx-tag:hover { background: #52b788; border-color: #52b788; color: #fff; }
.lottery-tag {
  background: linear-gradient(135deg, #f5f3ff, #ede9fe);
  border-color: #7c3aed; color: #4c1d95; font-weight: 600;
}
.lottery-tag:hover { background: #7c3aed; border-color: #7c3aed; color: #fff; }

/* 消息行 */
.message-row {
  display: flex;
  gap: 10px;
  max-width: 88%;
  align-items: flex-start;
}
.msg-left  { align-self: flex-start; }
.msg-right { align-self: flex-end; flex-direction: row-reverse; }

/* 头像 */
.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform .15s ease;
}
.msg-avatar:hover { transform: scale(1.08); }
.ai-avatar-wrap       { background: linear-gradient(135deg, #f7b500, #ffc700); }
.deepsook-avatar-wrap { background: linear-gradient(135deg, #1a1a2e, #16213e); }
.ppx-avatar-wrap      { background: linear-gradient(135deg, #0a3d62, #1e6b9e); }
.hx-avatar-wrap       { background: linear-gradient(135deg, #1b4332, #2d6a4f); }
.other-avatar-wrap    { background: linear-gradient(135deg, #64b5f6, #42a5f5); }
.user-avatar-wrap     { background: linear-gradient(135deg, #95ec69, #7dd959); }
.shrimp-emoji-avatar  { font-size: 20px; }
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-initial {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

/* 消息内容 */
.msg-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 100%;
  min-width: 0;
}
.msg-body-right { align-items: flex-end; }

.msg-sender {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  padding-left: 2px;
  margin-bottom: 2px;
}

/* AI 消息：无气泡，直接显示文字 */
.ai-text {
  font-size: 15px;
  line-height: 1.6;
  color: #1c1b1f;
  font-weight: 400;
  word-break: break-word;
}
/* 大虾 DeepSook */
.deepsook-sender { color: #b8860b; font-weight: 700; }
.deepsook-text {
  background: linear-gradient(135deg, #fff8e1, #fff3cd);
  border-left: 3px solid #F7B500;
  padding: 8px 12px; border-radius: 0 12px 12px 12px; color: #3e2723;
}
/* 皮皮虾 PPX */
.ppx-sender { color: #0077b6; font-weight: 700; }
.ppx-text {
  background: linear-gradient(135deg, #e0f7ff, #caf0f8);
  border-left: 3px solid #00b4d8;
  padding: 8px 12px; border-radius: 0 12px 12px 12px; color: #03045e;
}
/* 养生虾 HealthX */
.hx-sender { color: #1b4332; font-weight: 700; }
.hx-text {
  background: linear-gradient(135deg, #d8f3dc, #b7e4c7);
  border-left: 3px solid #52b788;
  padding: 8px 12px; border-radius: 0 12px 12px 12px; color: #1b4332;
}

/* 彩球博士 */
.lottery-sender { color: #4c1d95; font-weight: 700; }
.lottery-avatar { background: linear-gradient(135deg, #1a0d2e, #3b0764); }
.lottery-avatar-wrap { background: linear-gradient(135deg, #1a0d2e, #3b0764) !important; border: 2px solid #7c3aed !important; }
.lottery-text {
  background: linear-gradient(135deg, #f5f3ff, #ede9fe);
  border-left: 3px solid #7c3aed;
  padding: 8px 12px; border-radius: 0 12px 12px 12px; color: #1e0a3c;
  white-space: pre-wrap;
}

/* 气泡 */
.msg-bubble {
  padding: 9px 13px;
  border-radius: 16px;
  word-break: break-word;
  max-width: 100%;
}
.other-bubble { background: #f0f2f5; border-radius: 4px 16px 16px 16px; }
.my-bubble    { background: #e8f5e0; border-radius: 16px 4px 16px 16px; }

.msg-text {
  font-size: 15px;
  line-height: 1.5;
  color: #1c1b1f;
  font-weight: 400;
}

/* 时间 */
.msg-time {
  font-size: 11px;
  color: #bdbdbd;
  padding-left: 2px;
}
.msg-time-right {
  padding-left: 0;
  padding-right: 2px;
  text-align: right;
}

/* ==================== 行动卡片浮层（固定在输入框上方） ==================== */
.action-card-float {
  position: relative;
  margin: 0 12px 6px;
  background: linear-gradient(135deg, #FFFDE7 0%, #FFF8CC 100%);
  border: 1px solid rgba(247, 181, 0, 0.5);
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 -2px 16px rgba(247, 181, 0, 0.18);
  flex-shrink: 0;
}
.action-card-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: rgba(0,0,0,0.08);
  border: none;
  color: rgba(0,0,0,0.35);
  font-size: 12px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}
.action-card-close:hover { background: rgba(0,0,0,0.14); color: rgba(0,0,0,0.6); }

/* 浮层弹出动画 */
.card-pop-enter-active { transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
.card-pop-leave-active { transition: all 0.15s ease; }
.card-pop-enter-from  { opacity: 0; transform: translateY(10px) scale(0.95); }
.card-pop-leave-to    { opacity: 0; transform: translateY(6px) scale(0.97); }

/* ==================== 行动卡片（消息流内 - 保留样式兼容） ==================== */
.action-card {
  margin-top: 8px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(138, 43, 226, 0.35);
  border-radius: 14px;
  padding: 12px 14px;
  max-width: 260px;
  box-shadow: 0 2px 12px rgba(138, 43, 226, 0.15);
}

/* 余额行 */
.action-balance-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 10px;
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(247, 181, 0, 0.25);
}
.action-bal-icon { font-size: 14px; }
.action-bal-amount {
  font-size: 15px;
  font-weight: 700;
  color: #B8760A;
  letter-spacing: 0.3px;
}
.action-bal-hint {
  font-size: 11px;
  color: #8B6000;
  margin-left: 2px;
}

/* 按钮行 */
.action-btns-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.action-btn {
  flex: 1;
  min-width: 90px;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.action-btn-primary {
  background: linear-gradient(135deg, #F7B500 0%, #FFD700 100%);
  color: #3a2800;
  box-shadow: 0 2px 8px rgba(247, 181, 0, 0.4);
}
.action-btn-primary:active {
  transform: scale(0.96);
  box-shadow: 0 1px 4px rgba(247, 181, 0, 0.25);
}
.action-btn-secondary {
  background: rgba(247, 181, 0, 0.12);
  color: #7a5500;
  border: 1px solid rgba(247, 181, 0, 0.4);
}
.action-btn-secondary:active {
  background: rgba(247, 181, 0, 0.22);
  transform: scale(0.96);
}

/* ==================== 充值/提现 面板 ==================== */
.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #3a2800;
  margin-bottom: 10px;
}
.panel-net {
  font-size: 11px;
  background: rgba(245,158,11,0.15);
  color: #D97706;
  border-radius: 20px;
  padding: 2px 8px;
  margin-left: 6px;
  font-weight: 500;
}
.panel-amounts {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.panel-amt-btn {
  padding: 7px 12px;
  border: 1px solid rgba(247,181,0,0.4);
  border-radius: 8px;
  background: #FFFDE7;
  color: #8B6000;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.12s;
}
.panel-amt-btn.amt-active {
  background: linear-gradient(135deg, #F7B500, #FFD700);
  border-color: #F7B500;
  color: #3a2800;
}
.panel-amt-input {
  flex: 1;
  min-width: 60px;
  padding: 7px 8px;
  border: 1px solid rgba(247,181,0,0.35);
  border-radius: 8px;
  background: #FFFDE7;
  color: #333;
  font-size: 13px;
  outline: none;
}
.panel-amt-input::placeholder { color: #bbb; }
.panel-addr-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #FFFDE7;
  border: 1px solid rgba(247,181,0,0.3);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
}
.panel-addr-label { font-size: 11px; color: #8B6000; white-space: nowrap; }
.panel-addr-text {
  flex: 1;
  font-size: 10px;
  color: #6B4C00;
  font-family: monospace;
  word-break: break-all;
}
.panel-copy-btn {
  flex-shrink: 0;
  background: rgba(247,181,0,0.2);
  border: 1px solid rgba(247,181,0,0.4);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
  color: #8B6000;
}
.panel-hint {
  font-size: 11px;
  color: #D97706;
  margin-bottom: 8px;
  line-height: 1.4;
}
.panel-txid {
  width: 100%;
  box-sizing: border-box;
  background: #FFFDE7;
  border: 1px solid rgba(247,181,0,0.4);
  border-radius: 8px;
  color: #333;
  font-size: 11px;
  font-family: monospace;
  padding: 8px 10px;
  resize: none;
  outline: none;
  margin-bottom: 8px;
}
.panel-txid::placeholder { color: #bbb; }
.panel-field { margin-bottom: 8px; }
.panel-field-label { font-size: 11px; color: #8B6000; display: block; margin-bottom: 4px; }
.panel-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #FFFDE7;
  border: 1px solid rgba(247,181,0,0.35);
  border-radius: 8px;
  padding: 0 8px;
}
.panel-prefix { color: #D97706; font-weight: 700; font-size: 15px; }
.panel-input {
  flex: 1;
  background: none;
  border: none;
  color: #333;
  font-size: 14px;
  padding: 8px 0;
  outline: none;
}
.panel-max-btn {
  background: rgba(247,181,0,0.2);
  border: 1px solid rgba(247,181,0,0.4);
  border-radius: 5px;
  padding: 2px 8px;
  font-size: 11px;
  color: #8B6000;
  cursor: pointer;
}
.panel-input-full {
  width: 100%;
  box-sizing: border-box;
  background: #FFFDE7;
  border: 1px solid rgba(247,181,0,0.35);
  border-radius: 8px;
  color: #333;
  font-size: 12px;
  font-family: monospace;
  padding: 8px 10px;
  outline: none;
}
.panel-input-full::placeholder { color: #bbb; }
.panel-submit-btn {
  width: 100%;
  padding: 11px;
  background: linear-gradient(135deg, #F7B500, #FFD700);
  border: none;
  border-radius: 10px;
  color: #3a2800;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(247,181,0,0.35);
  transition: all 0.15s;
  margin-top: 2px;
}
.panel-submit-btn:disabled {
  background: #F0F0F0;
  box-shadow: none;
  color: #bbb;
  cursor: not-allowed;
}
.panel-submit-btn:not(:disabled):active { transform: scale(0.98); }
.panel-result {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}
.result-ok { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #16a34a; }
.result-err { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.25); color: #dc2626; }

/* 媒体 */
.msg-media {
  max-width: 220px;
  border-radius: 10px;
  overflow: hidden;
  position: relative; /* 上传遮罩需要 */
}
.media-img {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  cursor: pointer;
  display: block;
}
.media-video {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  background: #000;
}

/* 上传中遮罩（图片） */
.media-upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.48);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 12px;
  border-radius: 10px;
  pointer-events: none;
}
.media-upload-overlay.failed { background: rgba(180, 0, 0, 0.55); }

/* 视频懒加载封面 */
.video-lazy-cover {
  width: 200px;
  height: 120px;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  transition: background 0.18s;
}
.video-lazy-cover:hover {
  background: linear-gradient(135deg, #22223e, #1e2a4e);
}
.video-play-icon {
  width: 46px;
  height: 46px;
  background: rgba(255,255,255,0.18);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  padding-left: 4px;
  transition: background 0.18s, transform 0.18s;
}
.video-lazy-cover:hover .video-play-icon {
  background: rgba(255,255,255,0.30);
  transform: scale(1.1);
}
.video-play-hint {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
}

/* 上传中占位（视频） */
.video-upload-placeholder {
  width: 200px;
  height: 120px;
  background: #1a1a1a;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(255,255,255,0.85);
  font-size: 13px;
}
.video-upload-placeholder.failed { background: rgba(120, 0, 0, 0.7); }

/* 上传旋转动画 */
.upload-spin {
  width: 24px;
  height: 24px;
  border: 2.5px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin-upload 0.65s linear infinite;
}
@keyframes spin-upload {
  to { transform: rotate(360deg); }
}

/* 打字动画 */
.typing-indicator {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  margin-left: 44px;
}
.typing-indicator span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #bdbdbd;
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing-indicator span:nth-child(2) { animation-delay: .2s; }
.typing-indicator span:nth-child(3) { animation-delay: .4s; }
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* 聊天模式切换栏 */
.chat-mode-bar {
  display: flex;
  gap: 8px;
  padding: 6px 14px 4px;
  background: #fff;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.mode-btn {
  flex: 1;
  padding: 7px 0;
  border: 1.5px solid #e0e0e0;
  border-radius: 20px;
  background: #f7f7f7;
  font-size: 13px;
  color: #888;
  cursor: pointer;
  transition: all 0.18s;
  font-weight: 500;
}
.mode-active-free {
  background: #e8f5e9;
  border-color: #07C160;
  color: #07C160;
  font-weight: 700;
}
.mode-active-ai {
  background: #e3f0ff;
  border-color: #1976D2;
  color: #1976D2;
  font-weight: 700;
}

/* 输入栏 */
.input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 12px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid rgba(0,0,0,0.07);
  flex-shrink: 0;
  position: relative;
}
.textarea-wrap {
  flex: 1;
  background: #f0f2f5;
  border-radius: 26px;
  padding: 13px 18px;
  min-height: 52px;
  display: flex;
  align-items: center;
}
.message-textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-size: 16px;
  line-height: 1.5;
  color: #1c1b1f;
  overflow-y: hidden;
  min-height: 26px;
  max-height: 120px;
  display: block;
  font-family: inherit;
}
.message-textarea::placeholder { color: #bdbdbd; }

/* 图标按钮 */
.icon-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background .15s ease;
  color: #65676b;
  flex-shrink: 0;
}
.icon-btn:hover  { background: rgba(0,0,0,0.06); }
.icon-btn:active { background: rgba(0,0,0,0.1); transform: scale(.95); }
.send-btn        { color: #07c160; }
.send-btn:hover  { background: rgba(7,193,96,0.1); }
.attach-btn      { color: #65676b; }
.attach-btn:hover { background: rgba(0,0,0,0.06); }
.voice-btn       { color: #65676b; }
.voice-btn:hover { background: rgba(0,0,0,0.06); }

/* 附件菜单 */
.attach-menu {
  position: absolute;
  bottom: 62px;
  left: 10px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  padding: 12px;
  display: flex;
  gap: 16px;
  z-index: 50;
}
.attach-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #333;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background .15s;
}
.attach-item:hover  { background: rgba(0,0,0,0.05); }
.attach-item:active { transform: scale(.96); }
.attach-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 过渡动画 */
.attach-pop-enter-active, .attach-pop-leave-active { transition: all .2s ease; }
.attach-pop-enter-from, .attach-pop-leave-to { opacity: 0; transform: translateY(8px) scale(.95); }

.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 图片预览 */
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.88);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-full {
  /* 始终撑满屏幕宽度的90%，高度自适应但不超过88vh */
  width: 90vw;
  height: auto;
  max-height: 88vh;
  object-fit: contain;
  border-radius: 8px;
  display: block;
}
.preview-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.18);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .2s;
}
.preview-close:hover { background: rgba(255,255,255,0.3); }

/* 头像预览 */
.avatar-preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
.avatar-preview-img-wrap {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.avatar-preview-full {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-preview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64px;
  font-weight: 700;
  color: #fff;
}
.preview-ai   { background: linear-gradient(135deg, #f7b500, #ffc700); }
.preview-user { background: linear-gradient(135deg, #95ec69, #7dd959); }
.preview-actions {
  display: flex;
  gap: 12px;
}
.preview-action-btn {
  padding: 10px 22px;
  border-radius: 24px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: rgba(255,255,255,0.15);
  color: #fff;
  backdrop-filter: blur(8px);
  transition: background .2s;
}
.preview-action-btn:hover { background: rgba(255,255,255,0.25); }
.qr-upload-btn { background: rgba(7,193,96,0.25); }
.qr-upload-btn:hover { background: rgba(7,193,96,0.40); }

/* 头像预览 Tab */
.avatar-preview-tabs {
  display: flex;
  gap: 4px;
  background: rgba(255,255,255,0.12);
  border-radius: 20px;
  padding: 3px;
}
.apv-tab {
  padding: 6px 20px;
  border-radius: 16px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  color: rgba(255,255,255,0.7);
  transition: all .2s;
}
.apv-tab.active {
  background: rgba(255,255,255,0.9);
  color: #333;
  font-weight: 600;
}

/* 二维码预览区 */
.qrcode-preview-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.qrcode-img-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.qrcode-preview-img {
  width: 200px;
  height: 200px;
  object-fit: contain;
  border-radius: 12px;
  background: #fff;
  padding: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.qrcode-hint {
  color: rgba(255,255,255,0.8);
  font-size: 13px;
  margin: 0;
}
.qrcode-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
}
.qrcode-empty-icon { font-size: 48px; }
.qrcode-empty p {
  margin: 0;
  color: rgba(255,255,255,0.8);
  font-size: 14px;
  text-align: center;
}
</style>

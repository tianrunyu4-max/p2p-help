/**
 * 消息服务 - 管理社区页面的消息流
 * 监听引擎事件，生成聊天消息
 * 生产环境使用 Supabase，开发环境支持 Mock 数据
 */

import { useRealSupabase } from '../config/supabase'
import { addMessage, fetchMessages, subscribeToMessages } from '../services/supabaseMessageService'

// ==================== 消息管理类 ====================

export class MessageService {
  constructor(communityId = null) {
    this.messages = []
    this.listeners = []
    this.communityId = communityId

    // 添加初始消息
    this.addInitialMessages()

    // 启动轮询获取新消息
    this.startPolling()
  }

  /**
   * 添加初始消息
   */
  async addInitialMessages() {
    try {
      // 统一从 API/Supabase 获取消息（支持 communityId）
      const dbMessages = await fetchMessages(50, this.communityId)
      if (dbMessages && dbMessages.length > 0) {
        this.messages = dbMessages
        // 关键：通知监听器更新UI
        this.notifyListeners()
      }

      // 开发环境：如果还需要 Mock 实时订阅（可选）
      if (useRealSupabase()) {
        this.unsubscribe = subscribeToMessages((newMessage) => {
          this.addMessageToList(newMessage)
        })
      }
    } catch (error) {
      console.error('❌ 加载初始消息失败:', error)
      this.messages = []
      // 即使失败也通知监听器
      this.notifyListeners()
    }
  }

  /**
   * 添加欢迎消息 - 已禁用系统播报
   */
  async addWelcomeMessage() {
    // 已禁用：不再发送系统播报
  }

  /**
   * 处理引擎事件
   * 简化播报：只播报出局独立，其他事件静默处理
   */
  handleEngineEvent(event) {
    let message = null

    switch (event.type) {
      // ========== 所有业务事件静默处理，不在聊天中播报 ==========
      // case 'EXIT_INDEPENDENT': 已禁用，不再自动播报
      // case 'ACTIVATION_SUCCESS': 已禁用
      // case 'SPOT_BONUS': 已禁用
      // case 'LEVEL_BONUS': 已禁用
      // case 'BALANCE_TRANSFER': 已禁用
      // case 'BALANCE_ACTIVATION': 已禁用
      // case 'EARNINGS_DISTRIBUTED': 已禁用

      case 'ERROR':
        message = this.createErrorMessage(event)
        break
    }

    if (message) {
      this.addMessage(message)
    }
  }

  /**
   * 创建激活成功消息
   */
  createActivationMessage(event) {
    const { userId, modelType, landlordId, isContribution, directPushIndex } = event
    const price = modelType === 'BASIC' ? 100 : modelType === 'ADVANCED' ? 200 : 300

    let content = `🎉 <strong>激活成功</strong><br/>用户 <span style="color:#F7E3AF">${userId}</span> 成功激活${price}档点位`

    // 如果是贡献给上级，添加特殊提示
    if (isContribution) {
      content += `<br/><span style="font-size:12px;color:rgba(255,255,255,0.7)">💝 报恩贡献 → ${landlordId}</span>`
    }

    return {
      id: this.generateId(),
      type: 'ai',
      content,
      time: this.getCurrentTime()
    }
  }

  /**
   * 创建见点奖消息
   */
  createSpotBonusMessage(event) {
    const { receiverId, amount, fromUserId, isContribution, bonusMultiplier } = event

    let content = ''

    if (isContribution) {
      // 报恩贡献
      content = `💝 <strong>报恩见点奖</strong><br/>房东 <span style="color:#F7B500">${receiverId}</span> 收到贡献 <span style="color:#95EC69">+${amount}</span><br/><span style="font-size:12px;color:rgba(255,255,255,0.6)">来自下级 ${fromUserId} 的报恩回馈</span>`
    } else if (bonusMultiplier && bonusMultiplier > 1) {
      // 3倍见点奖（独立后第1个直推）
      content = `🎉 <strong>见点奖 × ${bonusMultiplier}</strong><br/>房东 <span style="color:#F7B500">${receiverId}</span> 收到见点奖 <span style="color:#95EC69">+${amount}</span> <span style="background:rgba(247,181,0,0.2);padding:2px 6px;border-radius:4px;font-size:11px;">×${bonusMultiplier}倍</span><br/><span style="font-size:12px;color:rgba(255,255,255,0.6)">独立后首位成员奖励</span>`
    } else {
      // 正常收租
      content = `💰 <strong>见点奖（收租）</strong><br/>房东 <span style="color:#F7B500">${receiverId}</span> 收到见点奖 <span style="color:#95EC69">+${amount}</span><br/><span style="font-size:12px;color:rgba(255,255,255,0.6)">来自 ${fromUserId}</span>`
    }

    return {
      id: this.generateId(),
      type: 'ai',
      content,
      time: this.getCurrentTime()
    }
  }

  /**
   * 创建平级奖消息
   */
  createLevelBonusMessage(event) {
    const { userId, level, amount, fromUserId } = event

    return {
      id: this.generateId(),
      type: 'ai',
      content: `💸 <strong>平级奖 L${level}</strong><br/>用户 <span style="color:#F7B500">${userId}</span> 收到平级奖 <span style="color:#95EC69">+${amount}</span>`,
      time: this.getCurrentTime()
    }
  }

  /**
   * 创建出局消息
   */
  createExitMessage(event) {
    const { userId } = event

    return {
      id: this.generateId(),
      type: 'ai',
      content: `🚀 <strong>出局独立 签到有礼</strong><br/>用户 <span style="color:#F7B500">${userId}</span> 达成出局条件，独立建组成功！<br/><span style="font-size:12px;color:#95EC69">🎁 签到领取优惠券</span>`,
      time: this.getCurrentTime()
    }
  }

  /**
   * 创建余额互转消息
   */
  createBalanceTransferMessage(event) {
    const { fromUserId, toUserId, amount, modelType } = event
    const typeName = modelType === 'BASIC' ? '100' : modelType === 'ADVANCED' ? '200' : '300'

    return {
      id: this.generateId(),
      type: 'ai',
      content: `💸 <strong>余额互转</strong><br/>用户 <span style="color:#F7B500">${fromUserId}</span> 向 <span style="color:#F7B500">${toUserId}</span> 转账 <span style="color:#95EC69">${amount}</span> (${typeName}档)`,
      time: this.getCurrentTime()
    }
  }

  /**
   * 创建余额激活消息
   */
  createBalanceActivationMessage(event) {
    const { userId, modelType, result } = event
    const typeName = modelType === 'BASIC' ? '100' : modelType === 'ADVANCED' ? '200' : '300'
    const price = modelType === 'BASIC' ? 100 : modelType === 'ADVANCED' ? 200 : 300

    return {
      id: this.generateId(),
      type: 'ai',
      content: `🎊 <strong>系统播报</strong><br/>恭喜 用户<span style="color:#F7B500">${userId}</span> 使用${typeName}档余额成功占位！<br/>推荐人已获报恩收益！💰`,
      time: this.getCurrentTime()
    }
  }

  /**
   * 创建收益分配消息
   */
  createEarningsDistributedMessage(event) {
    const { userId, amount, modelType, reason } = event
    const typeName = modelType === 'BASIC' ? '100' : modelType === 'ADVANCED' ? '200' : '300'

    let reasonText = ''
    switch (reason) {
      case 'spotBonus':
        reasonText = '见点奖'
        break
      case 'levelBonus':
        reasonText = '平级奖'
        break
      default:
        reasonText = '奖励'
    }

    // 计算可提现和锁定
    const withdrawablePercent = 80
    const lockedPercent = 20

    return {
      id: this.generateId(),
      type: 'ai',
      content: `💰 <strong>${reasonText}到账</strong><br/>用户 <span style="color:#F7B500">${userId}</span> 收到 <span style="color:#95EC69">${amount}</span> (${typeName}档)<br/><span style="font-size:12px;color:rgba(255,255,255,0.6)">可提现${withdrawablePercent}% · 锁定${lockedPercent}%</span>`,
      time: this.getCurrentTime()
    }
  }

  /**
   * 创建错误消息
   */
  createErrorMessage(event) {
    return {
      id: this.generateId(),
      type: 'ai',
      content: `⚠️ <strong>系统提示</strong><br/>操作失败：${event.error}`,
      time: this.getCurrentTime()
    }
  }

  /**
   * 添加用户消息 - 乐观更新：先本地显示，再异步保存
   */
  addUserMessage(content, userName = '我', userId = null, avatarUrl = null) {
    // 检查是否已有相同的消息（防止重复添加）
    const existingMessage = this.messages.find(m => 
      m.content === content && 
      m.userId === userId &&
      Math.abs((m.timestamp || 0) - Date.now()) < 2000
    )
    if (existingMessage) {
      console.log('消息已存在，跳过重复添加')
      return existingMessage
    }

    const tempId = this.generateId()
    const timestamp = Date.now()
    const message = {
      id: tempId,
      type: 'user',
      content,
      userName,
      userId,
      avatarUrl,
      timestamp,
      time: this.getCurrentTime(),
      _localOnly: true  // 标记为本地消息，轮询时保留
    }

    // 1. 立即添加到本地列表并通知UI更新
    this.addMessageToList(message)

    // 2. 异步保存到服务器（不阻塞UI）
    this.saveMessageToServer(message, tempId)

    return message
  }

  /**
   * 添加媒体消息（图片/视频）
   * @param {boolean} isUploading - true 时为乐观预览模式，先显示本地blob URL，上传完成后再保存到服务器
   */
  addMediaMessage(mediaType, mediaUrl, fileName, userName = '我', userId = null, avatarUrl = null, isUploading = false) {
    const tempId = this.generateId()
    const timestamp = Date.now()
    const message = {
      id: tempId,
      type: 'user',
      mediaType,   // 'image' 或 'video'
      mediaUrl,    // 媒体文件URL（乐观模式下为本地blob URL）
      content: fileName || (mediaType === 'image' ? '图片' : '视频'),
      userName,
      userId,
      avatarUrl,
      timestamp,
      time: this.getCurrentTime(),
      uploading: isUploading,   // 上传中标志
      uploadFailed: false,
      _localOnly: true  // 防止轮询时被覆盖消失
    }

    // 1. 立即添加到本地列表并通知UI更新（秒显示）
    this.addMessageToList(message)

    // 2. 仅在非乐观模式下立即保存到服务器
    //    乐观模式：等待 updateMediaUrl 拿到真实CDN URL后再保存
    if (!isUploading) {
      this.saveMediaMessageToServer(message, tempId)
    }

    return message
  }

  /**
   * 上传完成后，用真实CDN URL替换本地blob URL，并保存到服务器
   */
  updateMediaUrl(id, newUrl) {
    const msg = this.messages.find(m => m.id === id)
    if (msg) {
      msg.mediaUrl = newUrl
      msg.uploading = false
      this.notifyListeners()
      // 现在有真实URL了，保存到服务器
      this.saveMediaMessageToServer(msg, id)
    }
  }

  /**
   * 标记媒体消息上传失败
   */
  markMediaUploadFailed(id) {
    const msg = this.messages.find(m => m.id === id)
    if (msg) {
      msg.uploadFailed = true
      msg.uploading = false
      this.notifyListeners()
    }
  }

  /**
   * 异步保存媒体消息到服务器
   */
  async saveMediaMessageToServer(message, tempId) {
    try {
      const saved = await addMessage({
        type: 'user',
        content: message.content,
        userId: message.userId || null,
        userName: message.userName || '用户',
        avatarUrl: message.avatarUrl || null,
        mediaType: message.mediaType,
        mediaUrl: message.mediaUrl,
        communityId: this.communityId // 传递社群ID
      })

      if (saved && saved.id) {
        const index = this.messages.findIndex(m => m.id === tempId)
        if (index !== -1) {
          this.messages[index] = { ...this.messages[index], id: saved.id, _localOnly: false }
        }
      }
    } catch (error) {
      console.error('❌ 保存媒体消息失败:', error)
    }
  }

  /**
   * 异步保存消息到服务器
   */
  async saveMessageToServer(message, tempId) {
    try {
      const saved = await addMessage({
        type: message.type || 'user',
        content: message.content,
        userId: message.userId || null,
        userName: message.userName || '用户',
        avatarUrl: message.avatarUrl || null,
        communityId: this.communityId // 传递社群ID
      })

      if (saved && saved.id) {
        // 用服务器返回的真实ID替换临时ID，清除本地标记防止轮询重复
        const index = this.messages.findIndex(m => m.id === tempId)
        if (index !== -1) {
          this.messages[index] = { ...this.messages[index], id: saved.id, _localOnly: false }
        }
      }
    } catch (error) {
      console.error('❌ 保存消息到服务器失败:', error)
      // 消息已经在本地显示了，失败也不影响用户体验
    }
  }

  /**
   * 添加系统消息
   */
  addSystemMessage(content) {
    const message = {
      id: this.generateId(),
      type: 'ai',
      content: `💬 <strong>系统助手</strong><br/>${content}`,
      timestamp: Date.now(),
      time: this.getCurrentTime()
    }

    this.addMessageToList(message)
    return message
  }

  /**
   * 添加消息（用于AI播报等，需要保存到服务器）
   */
  async addMessage(message) {
    // 先本地显示
    const displayMessage = {
      ...message,
      id: message.id || this.generateId(),
      timestamp: message.timestamp || Date.now(),
      time: message.time || this.getCurrentTime()
    }
    this.addMessageToList(displayMessage)

    // 再异步保存
    try {
      await addMessage({
        type: message.type || 'ai',
        content: message.content,
        userId: message.userId || null,
        userName: message.userName || '用户',
        communityId: this.communityId // 传递社群ID
      })
    } catch (error) {
      console.error('❌ 保存消息失败:', error)
    }
  }

  /**
   * 启动轮询，每1秒获取一次新消息（近实时同步）
   */
  startPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer)

    this.pollingTimer = setInterval(async () => {
      try {
        const latestMessages = await fetchMessages(50, this.communityId)
        if (latestMessages && latestMessages.length > 0) {
          // 检查是否有服务器上的新消息（通过比较最新消息的ID或数量变化）
          const lastLocalId = this.messages.length > 0
            ? this.messages[this.messages.length - 1]?.id
            : null
          const lastServerMsg = latestMessages[latestMessages.length - 1]

          // 如果服务器最新消息ID不同，或消息数量变化，则更新
          const hasNewMessages = !lastLocalId ||
            (lastServerMsg && lastServerMsg.id !== lastLocalId) ||
            latestMessages.length !== this.messages.length

          if (hasNewMessages) {
            // 保留本地临时消息（10秒内且带有_localOnly标记的）
            const tenSecondsAgo = Date.now() - 10000
            const localOnlyMessages = this.messages.filter(
              localMsg => localMsg._localOnly && localMsg.timestamp > tenSecondsAgo
            )

            // 检查本地消息是否已在服务器列表中（通过内容和时间匹配）
            const filteredLocalMessages = localOnlyMessages.filter(localMsg => {
              // 如果服务器已有相同内容且时间接近的消息，就不保留本地消息
              return !latestMessages.some(serverMsg => 
                serverMsg.content === localMsg.content && 
                serverMsg.userId === localMsg.userId &&
                Math.abs((serverMsg.timestamp || 0) - localMsg.timestamp) < 5000
              )
            })

            // 合并服务器消息和本地临时消息（去重）
            const allMessages = [...latestMessages, ...filteredLocalMessages]
              .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            
            // 基于content + userId + timestamp去重
            const uniqueMessages = []
            const seen = new Set()
            for (const msg of allMessages) {
              const key = `${msg.content}_${msg.userId}_${Math.floor((msg.timestamp || 0) / 2000)}`
              if (!seen.has(key)) {
                seen.add(key)
                uniqueMessages.push(msg)
              }
            }
            
            this.messages = uniqueMessages.slice(-100)
            this.notifyListeners()
          }
        }
        // 额外执行一次本地内存清理（防止长时间不收到服务器更新时消息不消失）
        this.cleanOldMessages()
      } catch (error) {
        console.warn('⚠️ 轮询消息失败:', error)
      }
    }, 10000) // 10秒轮询（减少频繁刷新干扰体验）
  }

  /**
   * 清理超过6分钟的旧消息（阅后即焚）
   */
  cleanOldMessages() {
    const sixMinutesAgo = Date.now() - 6 * 60 * 1000
    const originalCount = this.messages.length

    this.messages = this.messages.filter(msg => (msg.timestamp || 0) > sixMinutesAgo)

    if (this.messages.length !== originalCount) {
      this.notifyListeners()
    }
  }

  /**
   * 添加消息到本地列表（内部方法）
   */
  addMessageToList(message) {
    // 避免重复添加
    if (this.messages.some(m => m.id === message.id)) return

    this.messages.push(message)
    this.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    this.notifyListeners()
  }

  /**
   * 获取所有消息
   */
  getMessages() {
    return this.messages
  }

  /**
   * 清空消息
   */
  clearMessages() {
    this.messages = []
    this.addInitialMessages()
    this.notifyListeners()
  }

  /**
   * 订阅消息更新
   */
  subscribe(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  /**
   * 通知监听器（传新数组副本，确保 Vue ref 检测到变化并重新渲染）
   */
  notifyListeners() {
    const snapshot = [...this.messages]
    this.listeners.forEach(callback => callback(snapshot))
  }

  /**
   * 生成消息ID
   */
  generateId() {
    return `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取当前时间
   */
  getCurrentTime() {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }

  /**
   * 自动播报已禁用
   * AI 采购员只在用户提问时回复，不主动发送任何消息
   */
  startAutoBroadcast() {
    // 已禁用：不再自动发送出局独立/签到有礼等播报消息
  }

  /**
   * 生成随机用户ID
   */
  generateRandomUserId() {
    return `TJ-${Math.floor(Math.random() * 9000 + 1000)}`
  }

  /**
   * 监听内容发布事件
   */
  listenToPublishEvents() {
    // 通过自定义事件监听发布
    window.addEventListener('contentPublished', (event) => {
      this.handleContentPublished(event.detail)
    })
  }

  /**
   * 处理内容发布
   */
  handleContentPublished(post) {
    // 已禁用：不再发送系统播报
  }
}

// ==================== 单例模式 ====================

let messageServiceInstance = null

/**
 * 获取消息服务实例（单例）
 */
export function getMessageService() {
  if (!messageServiceInstance) {
    messageServiceInstance = new MessageService()
  }
  return messageServiceInstance
}

export default getMessageService

/**
 * 消息服务 - 通过 Worker API 管理消息流
 */

let instance = null

export function getMessageService() {
  if (!instance) instance = new MessageService()
  return instance
}

class MessageService {
  constructor() {
    this.messages = []
    this.listeners = []
    this.pollTimer = null
    this.loadMessages()
  }

  async loadMessages() {
    try {
      const res = await fetch('/api/community/messages?limit=80')
      const data = await res.json()
      if (data.code === 200) {
        this.messages = data.data
        this.notifyListeners()
      }
    } catch (e) {}
  }

  startAutoBroadcast() {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => this.loadMessages(), 8000)
  }

  stopAutoBroadcast() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
  }

  getMessages() { return this.messages }

  subscribe(fn) {
    this.listeners.push(fn)
    return () => { this.listeners = this.listeners.filter(l => l !== fn) }
  }

  notifyListeners() {
    this.listeners.forEach(fn => fn([...this.messages]))
  }

  addUserMessage(content, userName, userId, avatarUrl) {
    const msg = this._makeMsg({ type: 'user', content, userName, userId, avatarUrl })
    this.messages.push(msg)
    this.notifyListeners()
    this._saveToServer(msg)
    return msg
  }

  addMessage(msg) {
    this.messages.push(msg)
    this.notifyListeners()
  }

  addMediaMessage(mediaType, mediaUrl, name, userName, userId, avatarUrl, uploading = false) {
    const msg = this._makeMsg({ type: 'user', content: null, userName, userId, avatarUrl, mediaType, mediaUrl, uploading })
    this.messages.push(msg)
    this.notifyListeners()
    return msg
  }

  updateMediaUrl(id, url) {
    const msg = this.messages.find(m => m.id === id)
    if (msg) { msg.mediaUrl = url; msg.uploading = false; this.notifyListeners(); this._saveToServer(msg) }
  }

  markMediaUploadFailed(id) {
    const msg = this.messages.find(m => m.id === id)
    if (msg) { msg.uploadFailed = true; msg.uploading = false; this.notifyListeners() }
  }

  _makeMsg({ type, content, userName, userId, avatarUrl, mediaType, mediaUrl, uploading }) {
    const now = new Date()
    return {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
      type, content: content || null,
      userId, userName: userName || '用户',
      avatarUrl: avatarUrl || null,
      mediaType: mediaType || null,
      mediaUrl: mediaUrl || null,
      uploading: uploading || false,
      uploadFailed: false,
      time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      timestamp: now.getTime()
    }
  }

  async _saveToServer(msg) {
    if (msg.uploading) return
    try {
      await fetch('/api/community/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: msg.type, content: msg.content,
          userId: msg.userId, userName: msg.userName,
          avatarUrl: msg.avatarUrl,
          mediaType: msg.mediaType, mediaUrl: msg.mediaUrl
        })
      })
    } catch (e) {}
  }
}

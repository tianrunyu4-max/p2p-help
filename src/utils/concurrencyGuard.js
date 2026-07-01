/**
 * 并发防护工具
 * 防止恶意注册、重复点击、并发流量攻击
 */

class ConcurrencyGuard {
  constructor() {
    // 操作锁（防止同一用户同时执行多个操作）
    this.operationLocks = new Map()
    
    // 操作队列（每个资源一个队列）
    this.operationQueues = new Map()
    
    // 频率限制（防止短时间内大量请求）
    this.rateLimits = new Map()
    
    // 操作记录（用于检测异常行为）
    this.operationHistory = []
    
    // 黑名单（临时封禁）
    this.blacklist = new Set()
    
    // 配置
    this.config = {
      // 操作锁超时时间（毫秒）- 从5秒增加到30秒
      lockTimeout: 30000,
      // 队列超时时间（毫秒）
      queueTimeout: 10000,
      // 最大队列大小
      maxQueueSize: 5,
      // 频率限制配置
      rateLimit: {
        activate: { maxCount: 3, windowMs: 60000 },      // 激活：1分钟最多3次
        transfer: { maxCount: 5, windowMs: 60000 },      // 转账：1分钟最多5次
        help: { maxCount: 3, windowMs: 60000 },          // 帮扶：1分钟最多3次
        checkin: { maxCount: 1, windowMs: 60000 },       // 签到：1分钟最多1次
        register: { maxCount: 5, windowMs: 300000 }      // 注册：5分钟最多5次
      },
      // 黑名单封禁时间（毫秒）
      blacklistDuration: 300000, // 5分钟
      // 历史记录保留时间（毫秒）
      historyRetention: 600000   // 10分钟
    }
    
    // 定期清理过期数据
    this.startCleanupTimer()
    
    console.log('🛡️ 并发防护已初始化(增强版)')
  }

  /**
   * 尝试获取操作锁(增强版 - 支持队列)
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   * @param {Object} options - 选项
   * @param {boolean} options.queue - 是否加入队列,默认true
   * @returns {Object|Promise} { success: boolean, message?: string } 或 Promise
   */
  tryLock(userId, operation, options = {}) {
    const { queue = true } = options
    const lockKey = `${userId}:${operation}`
    
    // 检查黑名单
    if (this.isBlacklisted(userId)) {
      return { 
        success: false, 
        message: '操作过于频繁，请5分钟后再试',
        code: 'BLACKLISTED'
      }
    }
    
    // 检查频率限制
    const rateCheck = this.checkRateLimit(userId, operation)
    if (!rateCheck.allowed) {
      // 频繁触发限制，加入黑名单
      if (rateCheck.count > rateCheck.max * 2) {
        this.addToBlacklist(userId)
      }
      return { 
        success: false, 
        message: `操作太频繁，请${Math.ceil(rateCheck.waitTime / 1000)}秒后再试`,
        code: 'RATE_LIMITED'
      }
    }
    
    // 检查操作锁
    if (this.operationLocks.has(lockKey)) {
      const lockInfo = this.operationLocks.get(lockKey)
      const now = Date.now()
      
      // 检查锁是否过期
      if (now - lockInfo.timestamp < this.config.lockTimeout) {
        // 锁未过期
        if (queue) {
          // 加入队列
          return this.addToQueue(lockKey, userId, operation)
        } else {
          return { 
            success: false, 
            message: '操作正在处理中，请稍候',
            code: 'LOCKED'
          }
        }
      }
      
      // 锁已过期，释放
      this.operationLocks.delete(lockKey)
      console.warn(`⚠️ 锁超时自动释放: ${lockKey}`)
    }
    
    // 加锁
    this.operationLocks.set(lockKey, {
      timestamp: Date.now(),
      operation
    })
    
    // 记录操作
    this.recordOperation(userId, operation)
    
    return { success: true }
  }

  /**
   * 将操作加入队列
   * @param {string} lockKey - 锁键
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   * @returns {Promise} 队列Promise
   */
  addToQueue(lockKey, userId, operation) {
    // 获取或创建队列
    if (!this.operationQueues.has(lockKey)) {
      this.operationQueues.set(lockKey, [])
    }
    
    const queue = this.operationQueues.get(lockKey)
    
    // 检查队列大小
    if (queue.length >= this.config.maxQueueSize) {
      return Promise.reject({
        success: false,
        message: '操作队列已满，请稍后再试',
        code: 'QUEUE_FULL'
      })
    }
    
    // 创建队列项
    return new Promise((resolve, reject) => {
      const queueItem = {
        userId,
        operation,
        timestamp: Date.now(),
        resolve,
        reject,
        timeout: null
      }
      
      // 设置队列超时
      queueItem.timeout = setTimeout(() => {
        // 从队列中移除
        const index = queue.indexOf(queueItem)
        if (index > -1) {
          queue.splice(index, 1)
        }
        
        reject({
          success: false,
          message: '等待超时，请重试',
          code: 'QUEUE_TIMEOUT'
        })
      }, this.config.queueTimeout)
      
      // 加入队列
      queue.push(queueItem)
      
      console.log(`📋 操作加入队列: ${lockKey}, 队列长度: ${queue.length}`)
    })
  }

  /**
   * 处理队列中的下一个操作
   * @param {string} lockKey - 锁键
   */
  processQueue(lockKey) {
    const queue = this.operationQueues.get(lockKey)
    
    if (!queue || queue.length === 0) {
      return
    }
    
    // 取出第一个
    const queueItem = queue.shift()
    
    // 清除超时定时器
    if (queueItem.timeout) {
      clearTimeout(queueItem.timeout)
    }
    
    // 加锁
    this.operationLocks.set(lockKey, {
      timestamp: Date.now(),
      operation: queueItem.operation
    })
    
    // 记录操作
    this.recordOperation(queueItem.userId, queueItem.operation)
    
    // 解析Promise
    queueItem.resolve({ success: true })
    
    console.log(`✅ 队列操作开始执行: ${lockKey}, 剩余: ${queue.length}`)
  }

  /**
   * 释放操作锁(增强版 - 处理队列)
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   */
  releaseLock(userId, operation) {
    const lockKey = `${userId}:${operation}`
    this.operationLocks.delete(lockKey)
    
    // 处理队列中的下一个操作
    this.processQueue(lockKey)
  }

  /**
   * 检查频率限制
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   * @returns {Object} { allowed: boolean, count: number, max: number, waitTime?: number }
   */
  checkRateLimit(userId, operation) {
    const rateKey = `${userId}:${operation}`
    const config = this.config.rateLimit[operation] || { maxCount: 10, windowMs: 60000 }
    const now = Date.now()
    
    if (!this.rateLimits.has(rateKey)) {
      this.rateLimits.set(rateKey, {
        count: 0,
        windowStart: now
      })
    }
    
    const limit = this.rateLimits.get(rateKey)
    
    // 检查是否需要重置窗口
    if (now - limit.windowStart >= config.windowMs) {
      limit.count = 0
      limit.windowStart = now
    }
    
    // 检查是否超过限制
    if (limit.count >= config.maxCount) {
      const waitTime = config.windowMs - (now - limit.windowStart)
      return {
        allowed: false,
        count: limit.count,
        max: config.maxCount,
        waitTime
      }
    }
    
    // 增加计数
    limit.count++
    
    return {
      allowed: true,
      count: limit.count,
      max: config.maxCount
    }
  }

  /**
   * 检查是否在黑名单中
   * @param {string} userId - 用户ID
   */
  isBlacklisted(userId) {
    return this.blacklist.has(userId)
  }

  /**
   * 加入黑名单
   * @param {string} userId - 用户ID
   */
  addToBlacklist(userId) {
    this.blacklist.add(userId)
    console.warn(`⚠️ 用户 ${userId} 已加入黑名单`)
    
    // 定时移除
    setTimeout(() => {
      this.blacklist.delete(userId)
      console.log(`✅ 用户 ${userId} 已从黑名单移除`)
    }, this.config.blacklistDuration)
  }

  /**
   * 记录操作（用于分析异常行为）
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   */
  recordOperation(userId, operation) {
    this.operationHistory.push({
      userId,
      operation,
      timestamp: Date.now()
    })
    
    // 检测异常行为
    this.detectAnomalies(userId)
  }

  /**
   * 检测异常行为
   * @param {string} userId - 用户ID
   */
  detectAnomalies(userId) {
    const now = Date.now()
    const recentOps = this.operationHistory.filter(
      op => op.userId === userId && now - op.timestamp < 60000
    )
    
    // 1分钟内超过20次操作，视为异常
    if (recentOps.length > 20) {
      this.addToBlacklist(userId)
      console.error(`🚨 检测到异常行为！用户 ${userId} 1分钟内操作 ${recentOps.length} 次`)
    }
  }

  /**
   * 启动定期清理定时器
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup()
    }, 60000) // 每分钟清理一次
  }

  /**
   * 清理过期数据(增强版 - 包括队列)
   */
  cleanup() {
    const now = Date.now()
    
    // 清理过期的操作锁
    for (const [key, value] of this.operationLocks.entries()) {
      if (now - value.timestamp > this.config.lockTimeout) {
        this.operationLocks.delete(key)
        console.warn(`⚠️ 清理过期锁: ${key}`)
        
        // 处理队列
        this.processQueue(key)
      }
    }
    
    // 清理过期的队列项
    for (const [key, queue] of this.operationQueues.entries()) {
      // 过滤掉超时的队列项
      const validItems = queue.filter(item => {
        if (now - item.timestamp > this.config.queueTimeout) {
          // 清除超时定时器
          if (item.timeout) {
            clearTimeout(item.timeout)
          }
          // 拒绝Promise
          item.reject({
            success: false,
            message: '队列等待超时',
            code: 'QUEUE_TIMEOUT'
          })
          return false
        }
        return true
      })
      
      if (validItems.length === 0) {
        this.operationQueues.delete(key)
      } else if (validItems.length !== queue.length) {
        this.operationQueues.set(key, validItems)
      }
    }
    
    // 清理过期的频率限制记录
    for (const [key, value] of this.rateLimits.entries()) {
      const operation = key.split(':')[1]
      const config = this.config.rateLimit[operation] || { windowMs: 60000 }
      if (now - value.windowStart > config.windowMs * 2) {
        this.rateLimits.delete(key)
      }
    }
    
    // 清理过期的操作历史
    this.operationHistory = this.operationHistory.filter(
      op => now - op.timestamp < this.config.historyRetention
    )
  }

  /**
   * 获取状态信息(增强版 - 包括队列)
   */
  getStatus() {
    let totalQueueSize = 0
    for (const queue of this.operationQueues.values()) {
      totalQueueSize += queue.length
    }
    
    return {
      activeLocks: this.operationLocks.size,
      activeQueues: this.operationQueues.size,
      totalQueuedOperations: totalQueueSize,
      rateLimitRecords: this.rateLimits.size,
      blacklistedUsers: this.blacklist.size,
      historySize: this.operationHistory.length
    }
  }

  /**
   * 重置（测试用 - 增强版）
   */
  reset() {
    // 清理所有队列中的Promise
    for (const queue of this.operationQueues.values()) {
      queue.forEach(item => {
        if (item.timeout) {
          clearTimeout(item.timeout)
        }
        item.reject({
          success: false,
          message: '系统重置',
          code: 'RESET'
        })
      })
    }
    
    this.operationLocks.clear()
    this.operationQueues.clear()
    this.rateLimits.clear()
    this.blacklist.clear()
    this.operationHistory = []
  }
}

// ==================== 单例模式 ====================

let guardInstance = null

export function getConcurrencyGuard() {
  if (!guardInstance) {
    guardInstance = new ConcurrencyGuard()
  }
  return guardInstance
}

export function resetConcurrencyGuard() {
  if (guardInstance) {
    guardInstance.reset()
    guardInstance = null
  }
}

// 全局暴露（方便调试）
if (typeof window !== 'undefined') {
  window.__concurrencyGuard = getConcurrencyGuard()
}

export default ConcurrencyGuard





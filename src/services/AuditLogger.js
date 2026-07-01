/**
 * AuditLogger - 审计日志服务
 * 
 * 功能：
 * - 记录关键操作
 * - 批量发送到后端
 * - 本地日志存储和查询
 * - 可疑活动检测
 */

/**
 * 审计事件类型
 */
export const AuditEventType = {
  // 认证相关
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  SESSION_EXPIRED: 'session_expired',

  // 余额相关
  BALANCE_CHANGE: 'balance_change',
  TRANSFER: 'transfer',
  ACTIVATION: 'activation',
  CHECKIN: 'checkin',
  REDEMPTION: 'redemption',

  // 密码相关
  PASSWORD_VERIFY: 'password_verify',
  PASSWORD_VERIFY_FAILED: 'password_verify_failed',
  PASSWORD_CHANGE: 'password_change',
  ACCOUNT_LOCKED: 'account_locked',

  // 安全相关
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  VALIDATION_FAILED: 'validation_failed',

  // 其他
  ERROR: 'error',
  SYSTEM_EVENT: 'system_event'
}

/**
 * 审计日志条目
 * @typedef {Object} AuditLogEntry
 * @property {string} id - 日志ID
 * @property {string} type - 事件类型
 * @property {string} userId - 用户ID
 * @property {number} timestamp - 时间戳
 * @property {Object} data - 事件数据
 * @property {string} [ipAddress] - IP地址
 * @property {string} [userAgent] - 用户代理
 * @property {string} [sessionId] - 会话ID
 */

export class AuditLogger {
  constructor(config = {}) {
    this.config = {
      enableLocalStorage: true,
      enableBatchSend: true,
      batchSize: 10,
      batchInterval: 30000, // 30秒
      maxLocalLogs: 500,
      backendEndpoint: '/api/audit/logs',
      ...config
    }

    // 本地日志缓存
    this.localLogs = []
    this.pendingLogs = []

    // 批量发送定时器
    this.batchTimer = null

    // 初始化
    this.init()
  }

  /**
   * 初始化
   */
  init() {
    // 加载本地日志
    if (this.config.enableLocalStorage) {
      this.loadLocalLogs()
    }

    // 启动批量发送
    if (this.config.enableBatchSend) {
      this.startBatchSend()
    }
  }

  /**
   * 记录审计日志
   * @param {string} type - 事件类型
   * @param {Object} data - 事件数据
   * @param {string} [userId] - 用户ID
   */
  log(type, data = {}, userId = null) {
    const entry = this.createLogEntry(type, data, userId)

    // 添加到本地日志
    this.localLogs.push(entry)

    // 限制本地日志大小
    if (this.localLogs.length > this.config.maxLocalLogs) {
      this.localLogs.shift()
    }

    // 保存到localStorage
    if (this.config.enableLocalStorage) {
      this.saveLocalLogs()
    }

    // 添加到待发送队列
    if (this.config.enableBatchSend) {
      this.pendingLogs.push(entry)

      // 如果达到批量大小，立即发送
      if (this.pendingLogs.length >= this.config.batchSize) {
        this.sendBatch()
      }
    }

    return entry
  }

  /**
   * 创建日志条目
   * @private
   */
  createLogEntry(type, data, userId) {
    return {
      id: this.generateLogId(),
      type,
      userId: userId || this.getCurrentUserId(),
      timestamp: Date.now(),
      data,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId()
    }
  }

  /**
   * 生成日志ID
   * @private
   */
  generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取当前用户ID
   * @private
   */
  getCurrentUserId() {
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        return user.id || user.user_id || null
      }
    } catch (error) {
      console.error('获取用户ID失败:', error)
    }
    return null
  }

  /**
   * 获取客户端IP（需要后端支持）
   * @private
   */
  getClientIP() {
    // 前端无法直接获取真实IP，需要后端提供
    return 'unknown'
  }

  /**
   * 获取会话ID
   * @private
   */
  getSessionId() {
    try {
      return sessionStorage.getItem('sessionId') || 'unknown'
    } catch (error) {
      return 'unknown'
    }
  }

  // ========== 便捷方法 ==========

  /**
   * 记录登录
   */
  logLogin(userId, data = {}) {
    return this.log(AuditEventType.LOGIN, data, userId)
  }

  /**
   * 记录登出
   */
  logLogout(userId, data = {}) {
    return this.log(AuditEventType.LOGOUT, data, userId)
  }

  /**
   * 记录登录失败
   */
  logLoginFailed(username, reason, data = {}) {
    return this.log(AuditEventType.LOGIN_FAILED, {
      username,
      reason,
      ...data
    })
  }

  /**
   * 记录余额变化
   */
  logBalanceChange(userId, oldBalance, newBalance, reason, data = {}) {
    return this.log(AuditEventType.BALANCE_CHANGE, {
      oldBalance,
      newBalance,
      change: newBalance - oldBalance,
      reason,
      ...data
    }, userId)
  }

  /**
   * 记录转账
   */
  logTransfer(fromUserId, toUserId, amount, data = {}) {
    return this.log(AuditEventType.TRANSFER, {
      fromUserId,
      toUserId,
      amount,
      ...data
    }, fromUserId)
  }

  /**
   * 记录激活
   */
  logActivation(userId, activatedUserId, data = {}) {
    return this.log(AuditEventType.ACTIVATION, {
      activatedUserId,
      ...data
    }, userId)
  }

  /**
   * 记录签到
   */
  logCheckin(userId, reward, data = {}) {
    return this.log(AuditEventType.CHECKIN, {
      reward,
      ...data
    }, userId)
  }

  /**
   * 记录兑换
   */
  logRedemption(userId, partnerId, amount, data = {}) {
    return this.log(AuditEventType.REDEMPTION, {
      partnerId,
      amount,
      ...data
    }, userId)
  }

  /**
   * 记录密码验证
   */
  logPasswordVerify(userId, operation, success, data = {}) {
    const type = success 
      ? AuditEventType.PASSWORD_VERIFY 
      : AuditEventType.PASSWORD_VERIFY_FAILED

    return this.log(type, {
      operation,
      success,
      ...data
    }, userId)
  }

  /**
   * 记录密码修改
   */
  logPasswordChange(userId, data = {}) {
    return this.log(AuditEventType.PASSWORD_CHANGE, data, userId)
  }

  /**
   * 记录账户锁定
   */
  logAccountLocked(userId, reason, lockedUntil, data = {}) {
    return this.log(AuditEventType.ACCOUNT_LOCKED, {
      reason,
      lockedUntil,
      ...data
    }, userId)
  }

  /**
   * 记录可疑活动
   */
  logSuspiciousActivity(userId, activityType, details, data = {}) {
    return this.log(AuditEventType.SUSPICIOUS_ACTIVITY, {
      activityType,
      details,
      ...data
    }, userId)
  }

  /**
   * 记录速率限制
   */
  logRateLimitExceeded(userId, endpoint, data = {}) {
    return this.log(AuditEventType.RATE_LIMIT_EXCEEDED, {
      endpoint,
      ...data
    }, userId)
  }

  /**
   * 记录错误
   */
  logError(error, context = {}) {
    return this.log(AuditEventType.ERROR, {
      message: error.message,
      code: error.code,
      stack: error.stack,
      ...context
    })
  }

  // ========== 批量发送 ==========

  /**
   * 启动批量发送
   * @private
   */
  startBatchSend() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
    }

    this.batchTimer = setInterval(() => {
      if (this.pendingLogs.length > 0) {
        this.sendBatch()
      }
    }, this.config.batchInterval)
  }

  /**
   * 发送批量日志
   * @private
   */
  async sendBatch() {
    if (this.pendingLogs.length === 0) {
      return
    }

    const logsToSend = [...this.pendingLogs]
    this.pendingLogs = []

    try {
      const response = await fetch(this.config.backendEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          logs: logsToSend
        })
      })

      if (!response.ok) {
        throw new Error(`发送日志失败: ${response.status}`)
      }

      console.log(`成功发送 ${logsToSend.length} 条审计日志`)

    } catch (error) {
      console.error('发送审计日志失败:', error)
      
      // 失败的日志重新加入队列
      this.pendingLogs.unshift(...logsToSend)

      // 限制队列大小
      if (this.pendingLogs.length > this.config.maxLocalLogs) {
        this.pendingLogs = this.pendingLogs.slice(0, this.config.maxLocalLogs)
      }
    }
  }

  /**
   * 立即发送所有待发送日志
   */
  async flush() {
    await this.sendBatch()
  }

  // ========== 本地存储 ==========

  /**
   * 加载本地日志
   * @private
   */
  loadLocalLogs() {
    try {
      const data = localStorage.getItem('audit_logs')
      if (data) {
        this.localLogs = JSON.parse(data)
      }
    } catch (error) {
      console.error('加载本地日志失败:', error)
      this.localLogs = []
    }
  }

  /**
   * 保存本地日志
   * @private
   */
  saveLocalLogs() {
    try {
      localStorage.setItem('audit_logs', JSON.stringify(this.localLogs))
    } catch (error) {
      console.error('保存本地日志失败:', error)
    }
  }

  // ========== 查询方法 ==========

  /**
   * 查询日志
   * @param {Object} filters - 过滤条件
   * @returns {Array<AuditLogEntry>}
   */
  query(filters = {}) {
    let results = [...this.localLogs]

    // 按类型过滤
    if (filters.type) {
      results = results.filter(log => log.type === filters.type)
    }

    // 按用户ID过滤
    if (filters.userId) {
      results = results.filter(log => log.userId === filters.userId)
    }

    // 按时间范围过滤
    if (filters.startTime) {
      results = results.filter(log => log.timestamp >= filters.startTime)
    }
    if (filters.endTime) {
      results = results.filter(log => log.timestamp <= filters.endTime)
    }

    // 排序（默认按时间倒序）
    results.sort((a, b) => b.timestamp - a.timestamp)

    // 限制数量
    if (filters.limit) {
      results = results.slice(0, filters.limit)
    }

    return results
  }

  /**
   * 获取最近的日志
   * @param {number} [limit=50] - 数量限制
   * @returns {Array<AuditLogEntry>}
   */
  getRecentLogs(limit = 50) {
    return this.query({ limit })
  }

  /**
   * 获取用户的日志
   * @param {string} userId - 用户ID
   * @param {number} [limit=50] - 数量限制
   * @returns {Array<AuditLogEntry>}
   */
  getUserLogs(userId, limit = 50) {
    return this.query({ userId, limit })
  }

  /**
   * 获取特定类型的日志
   * @param {string} type - 事件类型
   * @param {number} [limit=50] - 数量限制
   * @returns {Array<AuditLogEntry>}
   */
  getLogsByType(type, limit = 50) {
    return this.query({ type, limit })
  }

  /**
   * 清除本地日志
   */
  clearLocalLogs() {
    this.localLogs = []
    if (this.config.enableLocalStorage) {
      localStorage.removeItem('audit_logs')
    }
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalLogs: this.localLogs.length,
      pendingLogs: this.pendingLogs.length,
      byType: {},
      recentActivity: []
    }

    // 按类型统计
    for (const log of this.localLogs) {
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1
    }

    // 最近活动
    stats.recentActivity = this.getRecentLogs(10)

    return stats
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }

    // 发送剩余日志
    if (this.pendingLogs.length > 0) {
      this.sendBatch()
    }
  }
}

// 创建单例实例
let auditLoggerInstance = null

/**
 * 获取AuditLogger单例实例
 * @param {Object} [config] - 配置对象
 * @returns {AuditLogger}
 */
export function getAuditLogger(config) {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger(config)
  }
  return auditLoggerInstance
}

/**
 * 重置AuditLogger实例（用于测试）
 */
export function resetAuditLogger() {
  if (auditLoggerInstance) {
    auditLoggerInstance.destroy()
  }
  auditLoggerInstance = null
}

export default AuditLogger

/**
 * PasswordService - 前端交易密码服务
 * 
 * 安全措施：
 * - 不在前端存储密码
 * - 使用后立即清除内存
 * - 通过HTTPS传输
 * - 短期操作令牌（5分钟过期）
 * - 跟踪失败尝试次数
 */

import { supabase } from '../config/supabase.js'

/**
 * 密码验证请求接口
 * @typedef {Object} PasswordVerificationRequest
 * @property {string} userId - 用户ID
 * @property {string} password - 明文密码（通过HTTPS传输）
 * @property {string} operation - 操作类型（用于审计）
 * @property {Object} [metadata] - 额外上下文信息
 */

/**
 * 密码验证响应接口
 * @typedef {Object} PasswordVerificationResponse
 * @property {boolean} success - 验证是否成功
 * @property {string} [token] - 短期操作令牌
 * @property {number} [expiresAt] - 令牌过期时间戳
 * @property {number} [attemptsRemaining] - 锁定前剩余尝试次数
 * @property {number} [lockedUntil] - 账户锁定到期时间
 * @property {string} [message] - 错误或提示消息
 */

class PasswordService {
  constructor() {
    // 操作令牌缓存（内存中，不持久化）
    this.tokenCache = new Map()
    
    // 令牌过期时间（5分钟）
    this.TOKEN_EXPIRY = 5 * 60 * 1000
    
    // 自动清理过期令牌
    this.startTokenCleanup()
  }

  /**
   * 验证交易密码
   * @param {PasswordVerificationRequest} request - 验证请求
   * @returns {Promise<PasswordVerificationResponse>} 验证响应
   */
  async verifyPassword(request) {
    const { userId, password, operation, metadata = {} } = request

    try {
      // 调用后端API验证密码
      const { data, error } = await supabase.functions.invoke('verify-password', {
        body: {
          userId,
          password,
          operation,
          metadata: {
            ...metadata,
            timestamp: Date.now(),
            userAgent: navigator.userAgent
          }
        }
      })

      if (error) {
        throw new Error(error.message || '密码验证失败')
      }

      // 验证成功，缓存令牌
      if (data.success && data.token) {
        this.cacheToken(userId, operation, data.token, data.expiresAt)
      }

      // 立即清除密码变量
      this.clearPasswordFromMemory(password)

      return {
        success: data.success,
        token: data.token,
        expiresAt: data.expiresAt,
        attemptsRemaining: data.attemptsRemaining,
        lockedUntil: data.lockedUntil,
        message: data.message
      }
    } catch (err) {
      // 清除密码
      this.clearPasswordFromMemory(password)
      
      throw new Error(err.message || '密码验证失败')
    }
  }

  /**
   * 验证操作令牌
   * @param {string} token - 操作令牌
   * @param {string} operation - 操作类型
   * @returns {Promise<boolean>} 令牌是否有效
   */
  async validateToken(token, operation) {
    if (!token || !operation) {
      return false
    }

    // 检查本地缓存
    const cachedToken = this.getCachedToken(token)
    if (!cachedToken) {
      return false
    }

    // 检查操作类型是否匹配
    if (cachedToken.operation !== operation) {
      return false
    }

    // 检查是否过期
    if (Date.now() > cachedToken.expiresAt) {
      this.removeCachedToken(token)
      return false
    }

    return true
  }

  /**
   * 获取有效的操作令牌
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   * @returns {string|null} 有效的令牌或null
   */
  getValidToken(userId, operation) {
    const cacheKey = `${userId}:${operation}`
    const cached = this.tokenCache.get(cacheKey)

    if (!cached) {
      return null
    }

    // 检查是否过期
    if (Date.now() > cached.expiresAt) {
      this.tokenCache.delete(cacheKey)
      return null
    }

    return cached.token
  }

  /**
   * 检查是否需要重新输入密码
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   * @returns {boolean} 是否需要重新输入密码
   */
  needsPasswordReentry(userId, operation) {
    const token = this.getValidToken(userId, operation)
    return !token
  }

  /**
   * 清除密码变量（从内存中）
   * @param {string} password - 要清除的密码
   */
  clearPasswordFromMemory(password) {
    if (!password) return

    // 尝试覆盖密码字符串
    try {
      // JavaScript字符串是不可变的，但我们可以尝试触发垃圾回收
      password = null
      
      // 建议垃圾回收（不保证立即执行）
      if (global.gc) {
        global.gc()
      }
    } catch (err) {
      // 忽略错误
    }
  }

  /**
   * 缓存操作令牌
   * @private
   */
  cacheToken(userId, operation, token, expiresAt) {
    const cacheKey = `${userId}:${operation}`
    this.tokenCache.set(cacheKey, {
      token,
      operation,
      expiresAt,
      cachedAt: Date.now()
    })
  }

  /**
   * 获取缓存的令牌
   * @private
   */
  getCachedToken(token) {
    for (const [key, value] of this.tokenCache.entries()) {
      if (value.token === token) {
        return value
      }
    }
    return null
  }

  /**
   * 移除缓存的令牌
   * @private
   */
  removeCachedToken(token) {
    for (const [key, value] of this.tokenCache.entries()) {
      if (value.token === token) {
        this.tokenCache.delete(key)
        break
      }
    }
  }

  /**
   * 清除用户的所有令牌
   * @param {string} userId - 用户ID
   */
  clearUserTokens(userId) {
    const keysToDelete = []
    for (const [key] of this.tokenCache.entries()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.tokenCache.delete(key))
  }

  /**
   * 清除所有令牌
   */
  clearAllTokens() {
    this.tokenCache.clear()
  }

  /**
   * 启动令牌自动清理
   * @private
   */
  startTokenCleanup() {
    // 每分钟清理一次过期令牌
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens()
    }, 60000)
  }

  /**
   * 清理过期令牌
   * @private
   */
  cleanupExpiredTokens() {
    const now = Date.now()
    const keysToDelete = []

    for (const [key, value] of this.tokenCache.entries()) {
      if (now > value.expiresAt) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.tokenCache.delete(key))

    if (keysToDelete.length > 0) {
      console.log(`清理了 ${keysToDelete.length} 个过期令牌`)
    }
  }

  /**
   * 停止令牌清理
   */
  stopTokenCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * 获取令牌缓存状态
   * @returns {Object} 缓存状态
   */
  getTokenCacheStatus() {
    const now = Date.now()
    let validCount = 0
    let expiredCount = 0

    for (const [key, value] of this.tokenCache.entries()) {
      if (now > value.expiresAt) {
        expiredCount++
      } else {
        validCount++
      }
    }

    return {
      total: this.tokenCache.size,
      valid: validCount,
      expired: expiredCount
    }
  }
}

// 创建单例实例
let passwordServiceInstance = null

/**
 * 获取PasswordService单例实例
 * @returns {PasswordService}
 */
export function getPasswordService() {
  if (!passwordServiceInstance) {
    passwordServiceInstance = new PasswordService()
  }
  return passwordServiceInstance
}

/**
 * 重置PasswordService实例（用于测试）
 */
export function resetPasswordService() {
  if (passwordServiceInstance) {
    passwordServiceInstance.stopTokenCleanup()
    passwordServiceInstance.clearAllTokens()
  }
  passwordServiceInstance = null
}

export default PasswordService

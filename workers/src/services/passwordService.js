/**
 * PasswordVerificationService - 后端密码验证服务
 * 
 * 使用bcrypt进行密码哈希和验证
 * 实现失败尝试跟踪和账户锁定
 * 生成短期操作令牌
 */

import bcrypt from 'bcryptjs'

/**
 * 存储的密码信息
 * @typedef {Object} StoredPassword
 * @property {string} hash - bcrypt哈希值
 * @property {string} algorithm - 算法名称（bcrypt）
 * @property {number} rounds - bcrypt轮数
 * @property {number} updatedAt - 更新时间戳
 */

/**
 * 失败尝试记录
 * @typedef {Object} FailedAttempt
 * @property {string} userId - 用户ID
 * @property {number} timestamp - 时间戳
 * @property {string} ipAddress - IP地址
 * @property {string} userAgent - 用户代理
 */

/**
 * 操作令牌
 * @typedef {Object} OperationToken
 * @property {string} userId - 用户ID
 * @property {string} operation - 操作类型
 * @property {number} issuedAt - 签发时间
 * @property {number} expiresAt - 过期时间
 * @property {string} signature - HMAC签名
 */

export class PasswordVerificationService {
  constructor(supabase, env) {
    this.supabase = supabase
    this.env = env
    
    // bcrypt轮数（最少10轮）
    this.BCRYPT_ROUNDS = 12
    
    // 最大失败尝试次数
    this.MAX_FAILED_ATTEMPTS = 5
    
    // 锁定时长（30分钟）
    this.LOCKOUT_DURATION = 30 * 60 * 1000
    
    // 令牌过期时间（5分钟）
    this.TOKEN_EXPIRY = 5 * 60 * 1000
    
    // 密码重新输入超时（15分钟）
    this.PASSWORD_REENTRY_TIMEOUT = 15 * 60 * 1000
  }

  /**
   * 验证密码
   * @param {string} userId - 用户ID
   * @param {string} password - 明文密码
   * @param {Object} metadata - 元数据（IP、用户代理等）
   * @returns {Promise<Object>} 验证结果
   */
  async verifyPassword(userId, password, metadata = {}) {
    try {
      // 1. 检查账户锁定状态
      const lockStatus = await this.checkLockStatus(userId)
      if (lockStatus.isLocked) {
        return {
          success: false,
          message: `账户已锁定，请在${new Date(lockStatus.lockedUntil).toLocaleTimeString()}后重试`,
          lockedUntil: lockStatus.lockedUntil,
          attemptsRemaining: 0
        }
      }

      // 2. 获取存储的密码哈希
      const { data: user, error } = await this.supabase
        .from('users')
        .select('transaction_password_hash')
        .eq('user_id', userId)
        .single()

      if (error || !user || !user.transaction_password_hash) {
        return {
          success: false,
          message: '用户不存在或未设置交易密码'
        }
      }

      // 3. 验证密码
      const isValid = await bcrypt.compare(password, user.transaction_password_hash)

      if (!isValid) {
        // 记录失败尝试
        await this.recordFailedAttempt(userId, metadata)
        
        // 获取剩余尝试次数
        const attempts = await this.getFailedAttempts(userId)
        const remaining = Math.max(0, this.MAX_FAILED_ATTEMPTS - attempts.length)

        if (remaining === 0) {
          // 锁定账户
          await this.lockAccount(userId)
          return {
            success: false,
            message: `密码错误次数过多，账户已锁定${this.LOCKOUT_DURATION / 60000}分钟`,
            attemptsRemaining: 0,
            lockedUntil: Date.now() + this.LOCKOUT_DURATION
          }
        }

        return {
          success: false,
          message: `密码错误，还剩${remaining}次尝试机会`,
          attemptsRemaining: remaining
        }
      }

      // 4. 密码正确，清除失败记录
      await this.clearFailedAttempts(userId)

      // 5. 生成操作令牌
      const token = await this.generateOperationToken(userId, metadata.operation || 'general')

      return {
        success: true,
        token: token.token,
        expiresAt: token.expiresAt,
        message: '密码验证成功'
      }
    } catch (err) {
      console.error('密码验证错误:', err)
      throw new Error('密码验证失败')
    }
  }

  /**
   * 哈希密码
   * @param {string} password - 明文密码
   * @returns {Promise<StoredPassword>} 存储的密码信息
   */
  async hashPassword(password) {
    const hash = await bcrypt.hash(password, this.BCRYPT_ROUNDS)
    
    return {
      hash,
      algorithm: 'bcrypt',
      rounds: this.BCRYPT_ROUNDS,
      updatedAt: Date.now()
    }
  }

  /**
   * 更新密码
   * @param {string} userId - 用户ID
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   * @returns {Promise<boolean>} 是否成功
   */
  async updatePassword(userId, oldPassword, newPassword) {
    // 验证旧密码
    const verification = await this.verifyPassword(userId, oldPassword)
    if (!verification.success) {
      throw new Error('旧密码错误')
    }

    // 哈希新密码
    const hashedPassword = await this.hashPassword(newPassword)

    // 更新数据库
    const { error } = await this.supabase
      .from('users')
      .update({
        transaction_password_hash: hashedPassword.hash,
        password_updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      throw new Error('密码更新失败')
    }

    // 清除所有令牌
    await this.revokeAllTokens(userId)

    return true
  }

  /**
   * 检查锁定状态
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 锁定状态
   */
  async checkLockStatus(userId) {
    const { data, error } = await this.supabase
      .from('password_lockouts')
      .select('locked_until')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return { isLocked: false }
    }

    const lockedUntil = new Date(data.locked_until).getTime()
    const now = Date.now()

    if (now < lockedUntil) {
      return {
        isLocked: true,
        lockedUntil
      }
    }

    // 锁定已过期，清除记录
    await this.unlockAccount(userId)
    return { isLocked: false }
  }

  /**
   * 锁定账户
   * @param {string} userId - 用户ID
   * @returns {Promise<void>}
   */
  async lockAccount(userId) {
    const lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION).toISOString()

    await this.supabase
      .from('password_lockouts')
      .upsert({
        user_id: userId,
        locked_until: lockedUntil,
        locked_at: new Date().toISOString()
      })
  }

  /**
   * 解锁账户
   * @param {string} userId - 用户ID
   * @returns {Promise<void>}
   */
  async unlockAccount(userId) {
    await this.supabase
      .from('password_lockouts')
      .delete()
      .eq('user_id', userId)
  }

  /**
   * 记录失败尝试
   * @param {string} userId - 用户ID
   * @param {Object} metadata - 元数据
   * @returns {Promise<void>}
   */
  async recordFailedAttempt(userId, metadata) {
    await this.supabase
      .from('password_failed_attempts')
      .insert({
        user_id: userId,
        attempted_at: new Date().toISOString(),
        ip_address: metadata.ipAddress || 'unknown',
        user_agent: metadata.userAgent || 'unknown'
      })
  }

  /**
   * 获取失败尝试记录
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>} 失败尝试列表
   */
  async getFailedAttempts(userId) {
    // 获取最近30分钟内的失败尝试
    const thirtyMinutesAgo = new Date(Date.now() - this.LOCKOUT_DURATION).toISOString()

    const { data, error } = await this.supabase
      .from('password_failed_attempts')
      .select('*')
      .eq('user_id', userId)
      .gte('attempted_at', thirtyMinutesAgo)
      .order('attempted_at', { ascending: false })

    if (error) {
      console.error('获取失败尝试错误:', error)
      return []
    }

    return data || []
  }

  /**
   * 清除失败尝试记录
   * @param {string} userId - 用户ID
   * @returns {Promise<void>}
   */
  async clearFailedAttempts(userId) {
    await this.supabase
      .from('password_failed_attempts')
      .delete()
      .eq('user_id', userId)
  }

  /**
   * 生成操作令牌
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   * @returns {Promise<Object>} 令牌信息
   */
  async generateOperationToken(userId, operation) {
    const issuedAt = Date.now()
    const expiresAt = issuedAt + this.TOKEN_EXPIRY

    // 生成随机令牌
    const tokenData = {
      userId,
      operation,
      issuedAt,
      expiresAt,
      random: Math.random().toString(36).substring(2)
    }

    // 使用HMAC签名
    const signature = await this.signToken(tokenData)
    const token = Buffer.from(JSON.stringify({ ...tokenData, signature })).toString('base64')

    // 存储令牌到数据库
    await this.supabase
      .from('operation_tokens')
      .insert({
        user_id: userId,
        token,
        operation,
        expires_at: new Date(expiresAt).toISOString(),
        created_at: new Date().toISOString()
      })

    return {
      token,
      expiresAt
    }
  }

  /**
   * 验证操作令牌
   * @param {string} token - 令牌
   * @param {string} userId - 用户ID
   * @param {string} operation - 操作类型
   * @returns {Promise<boolean>} 是否有效
   */
  async validateOperationToken(token, userId, operation) {
    try {
      // 解码令牌
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString())

      // 检查用户ID和操作类型
      if (decoded.userId !== userId || decoded.operation !== operation) {
        return false
      }

      // 检查是否过期
      if (Date.now() > decoded.expiresAt) {
        await this.revokeToken(token)
        return false
      }

      // 验证签名
      const expectedSignature = await this.signToken({
        userId: decoded.userId,
        operation: decoded.operation,
        issuedAt: decoded.issuedAt,
        expiresAt: decoded.expiresAt,
        random: decoded.random
      })

      if (decoded.signature !== expectedSignature) {
        return false
      }

      // 检查数据库中是否存在
      const { data, error } = await this.supabase
        .from('operation_tokens')
        .select('*')
        .eq('token', token)
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        return false
      }

      return true
    } catch (err) {
      console.error('令牌验证错误:', err)
      return false
    }
  }

  /**
   * 撤销令牌
   * @param {string} token - 令牌
   * @returns {Promise<void>}
   */
  async revokeToken(token) {
    await this.supabase
      .from('operation_tokens')
      .delete()
      .eq('token', token)
  }

  /**
   * 撤销用户的所有令牌
   * @param {string} userId - 用户ID
   * @returns {Promise<void>}
   */
  async revokeAllTokens(userId) {
    await this.supabase
      .from('operation_tokens')
      .delete()
      .eq('user_id', userId)
  }

  /**
   * 签名令牌数据
   * @private
   */
  async signToken(data) {
    const message = JSON.stringify(data)
    const key = this.env.PASSWORD_TOKEN_SECRET || 'default-secret-key'
    
    // 使用Web Crypto API生成HMAC签名
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key)
    const messageData = encoder.encode(message)
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    return Buffer.from(signature).toString('hex')
  }

  /**
   * 清理过期令牌（定期任务）
   * @returns {Promise<number>} 清理的令牌数量
   */
  async cleanupExpiredTokens() {
    const now = new Date().toISOString()

    const { data, error } = await this.supabase
      .from('operation_tokens')
      .delete()
      .lt('expires_at', now)
      .select()

    if (error) {
      console.error('清理过期令牌错误:', error)
      return 0
    }

    return data?.length || 0
  }
}

export default PasswordVerificationService

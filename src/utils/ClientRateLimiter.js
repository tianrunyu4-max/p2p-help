/**
 * ClientRateLimiter - 客户端速率限制器
 * 
 * 功能：
 * - 滑动窗口速率限制
 * - 可配置的限制规则
 * - 本地速率检查
 */

/**
 * 速率限制规则
 * @typedef {Object} RateLimitRule
 * @property {number} limit - 限制次数
 * @property {number} window - 时间窗口（毫秒）
 */

/**
 * 速率限制结果
 * @typedef {Object} RateLimitResult
 * @property {boolean} allowed - 是否允许
 * @property {number} remaining - 剩余次数
 * @property {number} resetAt - 重置时间戳
 * @property {number} retryAfter - 重试等待时间（毫秒）
 */

export class ClientRateLimiter {
  constructor(config = {}) {
    this.config = {
      // 默认规则
      defaultRule: {
        limit: 100,
        window: 60000 // 1分钟
      },
      // 端点特定规则
      rules: {
        '/api/transfer': { limit: 10, window: 60000 },
        '/api/activate': { limit: 5, window: 60000 },
        '/api/checkin': { limit: 1, window: 86400000 }, // 1天
        '/api/redemption': { limit: 10, window: 60000 },
        '/api/password/verify': { limit: 5, window: 3600000 }, // 1小时
        ...config.rules
      },
      storageKey: 'rate_limit_records',
      ...config
    }

    // 请求记录
    this.records = new Map()

    // 初始化
    this.init()
  }

  /**
   * 初始化
   */
  init() {
    // 加载本地记录
    this.loadRecords()

    // 定期清理过期记录
    this.startCleanup()
  }

  /**
   * 检查速率限制
   * @param {string} endpoint - 端点路径
   * @param {string} [key] - 额外的键（如用户ID）
   * @returns {RateLimitResult}
   */
  check(endpoint, key = '') {
    const rule = this.getRule(endpoint)
    const recordKey = this.getRecordKey(endpoint, key)
    const now = Date.now()

    // 获取或创建记录
    let record = this.records.get(recordKey)
    if (!record) {
      record = {
        requests: [],
        resetAt: now + rule.window
      }
      this.records.set(recordKey, record)
    }

    // 清理过期请求
    record.requests = record.requests.filter(
      timestamp => now - timestamp < rule.window
    )

    // 检查是否超限
    const allowed = record.requests.length < rule.limit
    const remaining = Math.max(0, rule.limit - record.requests.length)

    // 计算重置时间
    if (record.requests.length > 0) {
      const oldestRequest = Math.min(...record.requests)
      record.resetAt = oldestRequest + rule.window
    } else {
      record.resetAt = now + rule.window
    }

    // 计算重试等待时间
    const retryAfter = allowed ? 0 : record.resetAt - now

    return {
      allowed,
      remaining,
      resetAt: record.resetAt,
      retryAfter
    }
  }

  /**
   * 记录请求
   * @param {string} endpoint - 端点路径
   * @param {string} [key] - 额外的键
   * @returns {RateLimitResult}
   */
  record(endpoint, key = '') {
    const result = this.check(endpoint, key)

    if (result.allowed) {
      const recordKey = this.getRecordKey(endpoint, key)
      const record = this.records.get(recordKey)
      
      if (record) {
        record.requests.push(Date.now())
        this.saveRecords()
      }
    }

    return result
  }

  /**
   * 获取规则
   * @private
   */
  getRule(endpoint) {
    // 查找匹配的规则
    for (const [pattern, rule] of Object.entries(this.config.rules)) {
      if (endpoint.includes(pattern)) {
        return rule
      }
    }

    // 返回默认规则
    return this.config.defaultRule
  }

  /**
   * 获取记录键
   * @private
   */
  getRecordKey(endpoint, key) {
    return key ? `${endpoint}:${key}` : endpoint
  }

  /**
   * 加载记录
   * @private
   */
  loadRecords() {
    try {
      const data = localStorage.getItem(this.config.storageKey)
      if (data) {
        const parsed = JSON.parse(data)
        this.records = new Map(Object.entries(parsed))
      }
    } catch (error) {
      console.error('加载速率限制记录失败:', error)
      this.records = new Map()
    }
  }

  /**
   * 保存记录
   * @private
   */
  saveRecords() {
    try {
      const obj = Object.fromEntries(this.records)
      localStorage.setItem(this.config.storageKey, JSON.stringify(obj))
    } catch (error) {
      console.error('保存速率限制记录失败:', error)
    }
  }

  /**
   * 启动清理
   * @private
   */
  startCleanup() {
    // 每分钟清理一次过期记录
    setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * 清理过期记录
   */
  cleanup() {
    const now = Date.now()
    let cleaned = 0

    for (const [key, record] of this.records.entries()) {
      // 清理过期请求
      const before = record.requests.length
      record.requests = record.requests.filter(
        timestamp => now - timestamp < 3600000 // 保留1小时内的
      )

      // 如果没有请求了，删除记录
      if (record.requests.length === 0) {
        this.records.delete(key)
        cleaned++
      } else if (record.requests.length < before) {
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.saveRecords()
      console.log(`清理了 ${cleaned} 条过期速率限制记录`)
    }
  }

  /**
   * 重置端点的限制
   * @param {string} endpoint - 端点路径
   * @param {string} [key] - 额外的键
   */
  reset(endpoint, key = '') {
    const recordKey = this.getRecordKey(endpoint, key)
    this.records.delete(recordKey)
    this.saveRecords()
  }

  /**
   * 重置所有限制
   */
  resetAll() {
    this.records.clear()
    this.saveRecords()
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalEndpoints: this.records.size,
      byEndpoint: {}
    }

    for (const [key, record] of this.records.entries()) {
      const endpoint = key.split(':')[0]
      if (!stats.byEndpoint[endpoint]) {
        stats.byEndpoint[endpoint] = {
          count: 0,
          requests: 0
        }
      }
      stats.byEndpoint[endpoint].count++
      stats.byEndpoint[endpoint].requests += record.requests.length
    }

    return stats
  }

  /**
   * 获取端点状态
   * @param {string} endpoint - 端点路径
   * @param {string} [key] - 额外的键
   * @returns {Object}
   */
  getStatus(endpoint, key = '') {
    const recordKey = this.getRecordKey(endpoint, key)
    const record = this.records.get(recordKey)
    const rule = this.getRule(endpoint)

    if (!record) {
      return {
        requests: 0,
        limit: rule.limit,
        remaining: rule.limit,
        resetAt: null
      }
    }

    return {
      requests: record.requests.length,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - record.requests.length),
      resetAt: record.resetAt
    }
  }
}

// 创建单例实例
let clientRateLimiterInstance = null

/**
 * 获取ClientRateLimiter单例实例
 * @param {Object} [config] - 配置对象
 * @returns {ClientRateLimiter}
 */
export function getClientRateLimiter(config) {
  if (!clientRateLimiterInstance) {
    clientRateLimiterInstance = new ClientRateLimiter(config)
  }
  return clientRateLimiterInstance
}

/**
 * 重置ClientRateLimiter实例（用于测试）
 */
export function resetClientRateLimiter() {
  clientRateLimiterInstance = null
}

export default ClientRateLimiter

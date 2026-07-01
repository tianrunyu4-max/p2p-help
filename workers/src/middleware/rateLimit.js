/**
 * 速率限制中间件
 * 使用Cloudflare KV实现分布式速率限制
 */

/**
 * 速率限制规则配置
 */
const RATE_LIMIT_RULES = {
  // 通用端点：100次/分钟
  default: {
    limit: 100,
    window: 60 // 秒
  },
  
  // 关键操作：10次/分钟
  critical: {
    limit: 10,
    window: 60
  },
  
  // 密码验证：5次/小时
  password: {
    limit: 5,
    window: 3600
  },
  
  // 签到：1次/天
  checkin: {
    limit: 1,
    window: 86400
  }
}

/**
 * 端点规则映射
 */
const ENDPOINT_RULES = {
  '/api/transfer': 'critical',
  '/api/activate': 'critical',
  '/api/redemption': 'critical',
  '/api/password/verify': 'password',
  // 注意：/api/checkin 读操作（balance/stats/history）不限流，避免积分显示0
  // 实际签到写操作由 engine.js 自身防重复机制保护（每日只能签到一次）
  // Engine API 关键操作 - 更严格的限制
  '/api/engine/user/balance': 'critical',      // 余额更新：10次/分钟
  '/api/engine/user/upsert': 'critical',       // 用户创建：10次/分钟
  '/api/engine/model/create': 'critical',      // 模型创建：10次/分钟
  '/api/engine/transaction': 'critical',       // 交易创建：10次/分钟
  '/api/engine/validate-invite': 'critical'    // 邀请码验证：10次/分钟
}

/**
 * 豁免端点（不受速率限制）
 */
const EXEMPT_ENDPOINTS = [
  '/api/health',
  '/api/status',
  '/api/ping'
]

/**
 * 滑动窗口速率限制器
 */
export class SlidingWindowRateLimiter {
  constructor(kv) {
    this.kv = kv
  }

  /**
   * 检查速率限制
   * @param {string} key - 限制键（通常是IP或用户ID）
   * @param {string} endpoint - 端点路径
   * @returns {Promise<Object>}
   */
  async check(key, endpoint) {
    // 获取规则
    const rule = this.getRule(endpoint)
    const kvKey = this.getKVKey(key, endpoint)
    const now = Math.floor(Date.now() / 1000)

    try {
      // 从KV获取记录
      const record = await this.getRecord(kvKey)

      // 清理过期请求
      const validRequests = record.requests.filter(
        timestamp => now - timestamp < rule.window
      )

      // 检查是否超限
      const allowed = validRequests.length < rule.limit
      const remaining = Math.max(0, rule.limit - validRequests.length)

      // 计算重置时间
      let resetAt = now + rule.window
      if (validRequests.length > 0) {
        const oldestRequest = Math.min(...validRequests)
        resetAt = oldestRequest + rule.window
      }

      // 计算重试等待时间
      const retryAfter = allowed ? 0 : resetAt - now

      return {
        allowed,
        remaining,
        resetAt,
        retryAfter,
        limit: rule.limit
      }
    } catch (error) {
      console.error('速率限制检查失败:', error)
      // 失败时允许请求（fail open）
      return {
        allowed: true,
        remaining: rule.limit,
        resetAt: now + rule.window,
        retryAfter: 0,
        limit: rule.limit
      }
    }
  }

  /**
   * 记录请求
   * @param {string} key - 限制键
   * @param {string} endpoint - 端点路径
   * @returns {Promise<Object>}
   */
  async record(key, endpoint) {
    const result = await this.check(key, endpoint)

    if (result.allowed) {
      const rule = this.getRule(endpoint)
      const kvKey = this.getKVKey(key, endpoint)
      const now = Math.floor(Date.now() / 1000)

      try {
        // 获取记录
        const record = await this.getRecord(kvKey)

        // 添加新请求
        record.requests.push(now)

        // 清理过期请求
        record.requests = record.requests.filter(
          timestamp => now - timestamp < rule.window
        )

        // 保存记录（TTL = 窗口时间 + 缓冲）
        await this.saveRecord(kvKey, record, rule.window + 60)
      } catch (error) {
        console.error('记录请求失败:', error)
      }
    }

    return result
  }

  /**
   * 获取规则
   * @private
   */
  getRule(endpoint) {
    // 查找端点规则
    for (const [pattern, ruleName] of Object.entries(ENDPOINT_RULES)) {
      if (endpoint.includes(pattern)) {
        return RATE_LIMIT_RULES[ruleName]
      }
    }

    // 返回默认规则
    return RATE_LIMIT_RULES.default
  }

  /**
   * 获取KV键
   * @private
   */
  getKVKey(key, endpoint) {
    // 简化端点路径作为键的一部分
    const simplifiedEndpoint = endpoint.split('?')[0].replace(/\//g, '_')
    return `rate_limit:${key}:${simplifiedEndpoint}`
  }

  /**
   * 获取记录
   * @private
   */
  async getRecord(kvKey) {
    try {
      const data = await this.kv.get(kvKey, 'json')
      if (data && data.requests) {
        return data
      }
    } catch (error) {
      console.error('获取KV记录失败:', error)
    }

    return { requests: [] }
  }

  /**
   * 保存记录
   * @private
   */
  async saveRecord(kvKey, record, ttl) {
    try {
      await this.kv.put(kvKey, JSON.stringify(record), {
        expirationTtl: ttl
      })
    } catch (error) {
      console.error('保存KV记录失败:', error)
    }
  }

  /**
   * 重置限制
   * @param {string} key - 限制键
   * @param {string} endpoint - 端点路径
   */
  async reset(key, endpoint) {
    const kvKey = this.getKVKey(key, endpoint)
    try {
      await this.kv.delete(kvKey)
    } catch (error) {
      console.error('重置速率限制失败:', error)
    }
  }
}

/**
 * 速率限制中间件
 * @param {Request} request - 请求对象
 * @returns {Promise<Response|null>} 如果被限制返回Response，否则返回null
 */
export async function rateLimitMiddleware(request) {
  const url = new URL(request.url)
  const endpoint = url.pathname

  // 检查是否豁免
  if (EXEMPT_ENDPOINTS.some(exempt => endpoint.includes(exempt))) {
    return null
  }

  // 获取限制键（优先使用用户ID，否则使用IP）
  const userId = request.headers.get('x-user-id')
  const ip = request.headers.get('cf-connecting-ip') || 
             request.headers.get('x-forwarded-for') || 
             'unknown'
  const key = userId || ip

  // 从 request.env 获取 KV 绑定
  const env = request.env
  if (!env || !env.RATE_LIMIT_KV) {
    // 如果没有 KV 绑定，跳过限流（fail open）
    console.warn('[RateLimit] RATE_LIMIT_KV not available, skipping rate limit')
    return null
  }

  // 创建速率限制器
  const rateLimiter = new SlidingWindowRateLimiter(env.RATE_LIMIT_KV)

  // 记录并检查
  const result = await rateLimiter.record(key, endpoint)

  // 如果被限制，返回429响应
  if (!result.allowed) {
    return new Response(JSON.stringify({
      success: false,
      error: '请求过于频繁，请稍后再试',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: result.retryAfter
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetAt.toString(),
        'Retry-After': result.retryAfter.toString()
      }
    })
  }

  // 添加速率限制头到请求
  request.rateLimitInfo = {
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt
  }

  return null
}

/**
 * 添加速率限制响应头
 * @param {Response} response - 响应对象
 * @param {Object} rateLimitInfo - 速率限制信息
 * @returns {Response}
 */
export function addRateLimitHeaders(response, rateLimitInfo) {
  if (!rateLimitInfo) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString())
  headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString())
  headers.set('X-RateLimit-Reset', rateLimitInfo.resetAt.toString())

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export default rateLimitMiddleware

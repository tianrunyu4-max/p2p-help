/**
 * API 配置模块 - 安全版本
 * 
 * ⚠️ 安全原则：
 * 1. 前端不存储任何数据库密钥
 * 2. 所有 API 请求必须经过 Cloudflare Workers
 * 3. 敏感操作需要 JWT Token 认证
 */

// API 基础 URL - 生产环境使用 Worker
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://ai-airdrop.uk'

// 开发环境使用本地代理
const isDev = import.meta.env.DEV
const baseUrl = isDev ? '/api' : `${API_BASE_URL}/api`

// 引擎写操作 API Key（构建时注入，用于替换 x-internal-call 旁路）
const ENGINE_API_KEY = import.meta.env.VITE_ENGINE_API_KEY || ''

/**
 * 获取认证 Token
 */
function getAuthToken() {
    return localStorage.getItem('auth_token') || ''
}

/**
 * 通用 API 请求封装
 * 所有请求都经过 Worker，不直接连接数据库
 */
export async function apiRequest(endpoint, options = {}) {
    const {
        method = 'GET',
        body = null,
        requireAuth = false,
        timeout = 30000,
        headers: customHeaders = {}  // 支持自定义 headers
    } = options

    const headers = {
        'Content-Type': 'application/json',
        ...customHeaders  // 合并自定义 headers
    }

    // 添加认证头
    if (requireAuth) {
        const token = getAuthToken()
        if (!token) {
            throw new Error('未登录，请先登录')
        }
        headers['Authorization'] = `Bearer ${token}`
    }

    // 引擎写操作：附带 API Key（已替换 x-internal-call 旁路）
    if (ENGINE_API_KEY && !headers['x-api-key']) {
        headers['x-api-key'] = ENGINE_API_KEY
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.message || `请求失败: ${response.status}`)
        }

        return data

    } catch (error) {
        clearTimeout(timeoutId)

        if (error.name === 'AbortError') {
            throw new Error('请求超时，请检查网络连接')
        }

        throw error
    }
}

// ==================== API 端点 ====================

/**
 * 认证相关 API
 */
export const authApi = {
    // 登录
    login: (phone, password) => apiRequest('/auth/login', {
        method: 'POST',
        body: { phone, password }
    }),

    // 注册
    register: (phone, password, inviteCode) => apiRequest('/auth/register', {
        method: 'POST',
        body: { phone, password, inviteCode }
    }),

    // 获取当前用户
    getCurrentUser: () => apiRequest('/auth/me', { requireAuth: true }),

    // 刷新 Token
    refreshToken: () => apiRequest('/auth/refresh', { requireAuth: true })
}

/**
 * 挖矿相关 API
 */
export const miningApi = {
    // 执行挖矿
    mine: () => apiRequest('/mining/mine', {
        method: 'POST',
        requireAuth: true
    }),

    // 获取挖矿状态
    getStatus: (userId) => apiRequest(`/mining/status/${userId}`),

    // 获取挖矿记录
    getHistory: (userId) => apiRequest(`/mining/history/${userId}`)
}

/**
 * 转账相关 API
 */
export const transferApi = {
    // 执行转账
    transfer: (toUserId, amount, txPassword) => apiRequest('/transfer/execute', {
        method: 'POST',
        requireAuth: true,
        body: { toUserId, amount, txPassword }
    }),

    // 获取转账记录
    getHistory: (userId) => apiRequest(`/transfer/history/${userId}`, { requireAuth: true }),

    // 获取实时价格
    getPrice: () => apiRequest('/transfer/price')
}

/**
 * 订阅相关 API
 */
export const subscriptionApi = {
    // 订阅
    subscribe: (planType) => apiRequest('/subscription/subscribe', {
        method: 'POST',
        requireAuth: true,
        body: { planType }
    }),

    // 获取订阅状态
    getStatus: (userId) => apiRequest(`/subscription/status/${userId}`, { requireAuth: true })
}

/**
 * 分红相关 API
 */
export const dividendApi = {
    // 获取分红记录
    getHistory: (userId) => apiRequest(`/dividend/history/${userId}`),

    // 获取奖励池状态
    getPools: () => apiRequest('/dividend/pools')
}

/**
 * 审计日志相关 API
 */
export const auditApi = {
    // 批量发送日志
    sendLogs: (logs) => apiRequest('/audit/logs', {
        method: 'POST',
        body: { logs }
    }),

    // 查询日志（管理员）
    queryLogs: (filters) => apiRequest('/audit/logs', {
        method: 'GET',
        requireAuth: true
    }),

    // 获取用户日志
    getUserLogs: (userId, limit = 50) => apiRequest(`/audit/logs/user/${userId}?limit=${limit}`, {
        requireAuth: true
    }),

    // 获取可疑活动（管理员）
    getSuspiciousActivities: (filters) => apiRequest('/audit/suspicious', {
        requireAuth: true
    }),

    // 获取统计信息
    getStats: () => apiRequest('/audit/stats', {
        requireAuth: true
    })
}

/**
 * 健康检查
 */
export const healthApi = {
    check: () => apiRequest('/health')
}

// 导出配置
export const apiConfig = {
    baseUrl,
    isDev,
    // ⚠️ 不导出任何密钥！
}

// 导出 API_BASE_URL 供其他模块使用
export { API_BASE_URL }

export default {
    auth: authApi,
    mining: miningApi,
    transfer: transferApi,
    subscription: subscriptionApi,
    dividend: dividendApi,
    audit: auditApi,
    health: healthApi,
    config: apiConfig
}

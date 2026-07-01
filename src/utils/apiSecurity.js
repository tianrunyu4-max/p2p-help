/**
 * API 安全工具 - API Security Utilities
 * 统一的安全防护函数，用于前端API调用
 */

import { ref } from 'vue'

/**
 * 创建安全的API调用包装器
 * 包含：防重复调用 + 超时控制 + 错误处理
 * 
 * @param {Function} apiFn - API函数
 * @param {Object} options - 配置选项
 * @returns {Object} { execute, isLoading, error }
 */
export function useSafeApi(apiFn, options = {}) {
    const {
        timeout = 30000,          // 超时时间（毫秒）
        retryCount = 0,           // 重试次数
        retryDelay = 1000,        // 重试延迟
        onSuccess = null,         // 成功回调
        onError = null            // 失败回调
    } = options

    const isLoading = ref(false)
    const error = ref(null)
    const lastCallTime = ref(0)

    const execute = async (...args) => {
        // 1. 防重复调用（300ms内的重复请求被忽略）
        const now = Date.now()
        if (now - lastCallTime.value < 300) {
            console.warn('[SafeApi] 请求被防重阻止')
            return null
        }

        // 2. 检查是否正在加载
        if (isLoading.value) {
            console.warn('[SafeApi] 请求正在处理中')
            return null
        }

        lastCallTime.value = now
        isLoading.value = true
        error.value = null

        let attempts = 0
        const maxAttempts = retryCount + 1

        while (attempts < maxAttempts) {
            try {
                // 创建超时Promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('请求超时')), timeout)
                })

                // 执行API调用
                const result = await Promise.race([
                    apiFn(...args),
                    timeoutPromise
                ])

                isLoading.value = false

                if (onSuccess) {
                    onSuccess(result)
                }

                return result

            } catch (err) {
                attempts++

                if (attempts >= maxAttempts) {
                    isLoading.value = false
                    error.value = err.message || '请求失败'

                    if (onError) {
                        onError(err)
                    }

                    throw err
                }

                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, retryDelay))
            }
        }
    }

    return {
        execute,
        isLoading,
        error
    }
}

/**
 * 防止并发调用装饰器
 * 用于保护敏感操作（转账、购买等）
 */
export function withLock(fn, lockRef) {
    return async (...args) => {
        if (lockRef.value) {
            console.warn('[Lock] 操作正在进行中')
            return null
        }

        lockRef.value = true

        try {
            return await fn(...args)
        } finally {
            lockRef.value = false
        }
    }
}

/**
 * 输入验证工具
 */
export const validators = {
    // 用户ID格式验证
    isValidUserId(id) {
        return /^\d{5,10}$/.test(String(id))
    },

    // 金额验证
    isValidAmount(amount, min = 0, max = Infinity) {
        const num = parseFloat(amount)
        return !isNaN(num) && num >= min && num <= max
    },

    // 邀请码验证
    isValidInviteCode(code) {
        return /^\d{5,10}$/.test(String(code))
    },

    // 防XSS清理
    sanitize(input) {
        if (typeof input !== 'string') return input
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
    }
}

/**
 * 简单的防抖函数
 */
export function debounce(fn, delay = 300) {
    let timer = null
    return function (...args) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            fn.apply(this, args)
        }, delay)
    }
}

/**
 * 节流函数
 */
export function throttle(fn, limit = 300) {
    let inThrottle = false
    return function (...args) {
        if (inThrottle) return
        fn.apply(this, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
    }
}

export default {
    useSafeApi,
    withLock,
    validators,
    debounce,
    throttle
}

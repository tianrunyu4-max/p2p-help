/**
 * 点击防护 Composable
 * 防止重复点击和并发操作
 */

import { ref } from 'vue'
import { ErrorFactory, ErrorCode } from '../utils/security/index.js'

/**
 * 创建点击防护
 * @param {Object} options - 配置选项
 * @param {Number} options.minInterval - 最小间隔时间(ms),默认500ms
 * @param {Boolean} options.autoReset - 操作完成后自动重置,默认true
 * @returns {Object} 点击防护对象
 */
export function useClickGuard(options = {}) {
  const {
    minInterval = 500,
    autoReset = true
  } = options

  // 状态
  const isProcessing = ref(false)
  const isDisabled = ref(false)
  const lastClickTime = ref(0)

  /**
   * 尝试执行操作
   * @param {Function} operation - 要执行的操作
   * @returns {Promise} 操作结果
   */
  async function guard(operation) {
    // 检查是否正在处理
    if (isProcessing.value) {
      throw ErrorFactory.createConcurrencyError(
        '操作正在处理中，请稍候',
        ErrorCode.OPERATION_LOCKED,
        { userMessage: '操作正在处理中，请稍候' }
      )
    }

    // 检查最小间隔
    const now = Date.now()
    const timeSinceLastClick = now - lastClickTime.value
    
    if (timeSinceLastClick < minInterval && lastClickTime.value > 0) {
      const waitTime = Math.ceil((minInterval - timeSinceLastClick) / 1000)
      throw ErrorFactory.createConcurrencyError(
        `操作太频繁，请${waitTime}秒后再试`,
        ErrorCode.RATE_LIMITED,
        { 
          userMessage: `操作太频繁，请${waitTime}秒后再试`,
          waitTime 
        }
      )
    }

    // 设置处理状态
    isProcessing.value = true
    isDisabled.value = true
    lastClickTime.value = now

    try {
      // 执行操作
      const result = await operation()
      
      return result
    } finally {
      // 重置状态
      isProcessing.value = false
      
      if (autoReset) {
        // 延迟重新启用按钮,确保用户看到反馈
        setTimeout(() => {
          isDisabled.value = false
        }, Math.min(minInterval, 500))
      }
    }
  }

  /**
   * 手动重置状态
   */
  function reset() {
    isProcessing.value = false
    isDisabled.value = false
  }

  /**
   * 手动禁用
   */
  function disable() {
    isDisabled.value = true
  }

  /**
   * 手动启用
   */
  function enable() {
    isDisabled.value = false
  }

  return {
    // 状态
    isProcessing,
    isDisabled,
    
    // 方法
    guard,
    reset,
    disable,
    enable
  }
}

/**
 * 创建简单的点击防护(用于单个按钮)
 * @param {Function} handler - 点击处理函数
 * @param {Object} options - 配置选项
 * @returns {Object} 包含处理函数和状态的对象
 */
export function useSimpleClickGuard(handler, options = {}) {
  const clickGuard = useClickGuard(options)

  /**
   * 包装后的处理函数
   */
  async function wrappedHandler(...args) {
    try {
      return await clickGuard.guard(() => handler(...args))
    } catch (error) {
      // 如果是并发错误,静默处理(已经有用户提示)
      if (error.code === ErrorCode.OPERATION_LOCKED || 
          error.code === ErrorCode.RATE_LIMITED) {
        console.warn('[ClickGuard]', error.message)
        return
      }
      
      // 其他错误继续抛出
      throw error
    }
  }

  return {
    handler: wrappedHandler,
    isProcessing: clickGuard.isProcessing,
    isDisabled: clickGuard.isDisabled,
    reset: clickGuard.reset
  }
}

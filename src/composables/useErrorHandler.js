/**
 * useErrorHandler Composable - Vue错误处理组合式函数
 * 
 * 提供响应式错误状态管理和重试功能
 */

import { ref, computed } from 'vue'
import { getErrorHandler } from '../services/ErrorHandler.js'

/**
 * 创建错误处理composable
 * @param {Function} [onRetry] - 重试回调函数
 * @returns {Object} 错误处理对象
 */
export function useErrorHandler(onRetry) {
  const error = ref(null)
  const isRetrying = ref(false)
  const retryCount = ref(0)
  const maxRetries = ref(3)

  const errorHandler = getErrorHandler()

  // 是否有错误
  const hasError = computed(() => error.value !== null)

  // 是否可以重试
  const canRetry = computed(() => {
    if (!error.value) return false
    if (retryCount.value >= maxRetries.value) return false
    return errorHandler.shouldRetry(error.value)
  })

  /**
   * 处理错误
   * @param {Error|AppError} err - 错误对象
   * @param {Object} [context] - 额外上下文
   */
  function handleError(err, context = {}) {
    const appError = errorHandler.handle(err, context)
    error.value = appError
  }

  /**
   * 清除错误
   */
  function clearError() {
    error.value = null
    retryCount.value = 0
    isRetrying.value = false
  }

  /**
   * 重试操作
   * @returns {Promise<void>}
   */
  async function retry() {
    if (!canRetry.value || !onRetry) {
      return
    }

    isRetrying.value = true
    retryCount.value++

    try {
      await onRetry()
      clearError()
    } catch (err) {
      handleError(err)
    } finally {
      isRetrying.value = false
    }
  }

  /**
   * 设置最大重试次数
   * @param {number} max - 最大重试次数
   */
  function setMaxRetries(max) {
    maxRetries.value = max
  }

  return {
    // 状态
    error,
    hasError,
    isRetrying,
    canRetry,
    retryCount,

    // 方法
    handleError,
    clearError,
    retry,
    setMaxRetries
  }
}

/**
 * 创建全局错误处理composable
 * @returns {Object} 全局错误处理对象
 */
export function useGlobalErrorHandler() {
  const errorHandler = getErrorHandler()
  const errors = ref([])
  const maxErrors = ref(10)

  /**
   * 添加错误
   * @param {Error|AppError} err - 错误对象
   * @param {Object} [context] - 额外上下文
   */
  function addError(err, context = {}) {
    const appError = errorHandler.handle(err, context)
    
    errors.value.unshift({
      id: Date.now(),
      error: appError,
      timestamp: Date.now()
    })

    // 限制错误数量
    if (errors.value.length > maxErrors.value) {
      errors.value = errors.value.slice(0, maxErrors.value)
    }
  }

  /**
   * 移除错误
   * @param {number} id - 错误ID
   */
  function removeError(id) {
    errors.value = errors.value.filter(e => e.id !== id)
  }

  /**
   * 清除所有错误
   */
  function clearAllErrors() {
    errors.value = []
  }

  /**
   * 获取错误统计
   */
  function getStats() {
    return errorHandler.getStats()
  }

  return {
    errors,
    addError,
    removeError,
    clearAllErrors,
    getStats
  }
}

export default useErrorHandler

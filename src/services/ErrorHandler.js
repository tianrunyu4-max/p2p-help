/**
 * ErrorHandler Service - 统一错误处理服务
 * 
 * 功能：
 * - 错误分类
 * - 错误日志记录
 * - 用户通知
 * - 重试决策
 */

import { ErrorCategory, ErrorFactory } from '../utils/security/errors.js'

/**
 * 错误处理配置
 * @typedef {Object} ErrorHandlerConfig
 * @property {boolean} enableLogging - 是否启用日志
 * @property {boolean} enableUserNotification - 是否启用用户通知
 * @property {string} [logEndpoint] - 日志端点URL
 * @property {Function} [onError] - 错误回调函数
 * @property {Function} [onNotify] - 通知回调函数
 */

export class ErrorHandler {
  constructor(config = {}) {
    this.config = {
      enableLogging: true,
      enableUserNotification: true,
      logEndpoint: null,
      onError: null,
      onNotify: null,
      ...config
    }

    // 错误日志缓存
    this.errorLog = []
    this.maxLogSize = 100

    // 错误统计
    this.errorStats = {
      total: 0,
      byCategory: {},
      byCode: {}
    }
  }

  /**
   * 处理错误
   * @param {Error|AppError} error - 错误对象
   * @param {Object} [context] - 额外上下文
   */
  handle(error, context = {}) {
    try {
      // 1. 分类错误
      const appError = this.categorizeError(error, context)

      // 2. 记录日志
      if (this.config.enableLogging) {
        this.logError(appError)
      }

      // 3. 通知用户
      if (this.config.enableUserNotification) {
        this.notifyUser(appError)
      }

      // 4. 调用错误回调
      if (this.config.onError) {
        this.config.onError(appError)
      }

      // 5. 更新统计
      this.updateStats(appError)

      return appError
    } catch (handlingError) {
      console.error('错误处理失败:', handlingError)
      return error
    }
  }

  /**
   * 分类错误
   * @private
   */
  categorizeError(error, context = {}) {
    // 如果已经是AppError，直接返回
    if (error.category && error.code) {
      return error
    }

    // 根据错误类型和消息分类
    const message = error.message || '未知错误'
    const lowerMessage = message.toLowerCase()

    // 网络错误
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('连接') ||
      lowerMessage.includes('网络') ||
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError'
    ) {
      return ErrorFactory.createNetworkError(
        'NETWORK_ERROR',
        message,
        { originalError: error, ...context }
      )
    }

    // 认证错误
    if (
      lowerMessage.includes('auth') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('认证') ||
      lowerMessage.includes('登录') ||
      lowerMessage.includes('权限')
    ) {
      return ErrorFactory.createAuthError(
        message,
        'AUTH_ERROR',
        { originalError: error, ...context }
      )
    }

    // 验证错误（用户输入错误）
    if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('validation') ||
      lowerMessage.includes('不正确') ||
      lowerMessage.includes('无效') ||
      lowerMessage.includes('格式')
    ) {
      return ErrorFactory.createUserError(
        'VALIDATION_ERROR',
        message,
        { originalError: error, ...context }
      )
    }

    // 并发错误
    if (
      lowerMessage.includes('lock') ||
      lowerMessage.includes('concurrent') ||
      lowerMessage.includes('锁定') ||
      lowerMessage.includes('队列')
    ) {
      return ErrorFactory.createConcurrencyError(
        context.resourceId || 'unknown',
        { originalError: error, ...context }
      )
    }

    // 默认为系统错误
    return ErrorFactory.createSystemError(
      'SYSTEM_ERROR',
      error,
      context
    )
  }

  /**
   * 记录错误日志
   * @private
   */
  logError(error) {
    const logEntry = {
      timestamp: Date.now(),
      category: error.category,
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      context: error.context,
      stack: error.stack
    }

    // 添加到本地日志
    this.errorLog.push(logEntry)

    // 限制日志大小
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift()
    }

    // 控制台输出
    if (error.category === ErrorCategory.SYSTEM_ERROR) {
      console.error('系统错误:', logEntry)
    } else if (error.category === ErrorCategory.NETWORK_ERROR) {
      console.warn('网络错误:', logEntry)
    } else {
      console.log('错误:', logEntry)
    }

    // 发送到后端（如果配置了端点）
    if (this.config.logEndpoint) {
      this.sendLogToBackend(logEntry).catch(err => {
        console.error('发送日志失败:', err)
      })
    }
  }

  /**
   * 发送日志到后端
   * @private
   */
  async sendLogToBackend(logEntry) {
    try {
      await fetch(this.config.logEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEntry)
      })
    } catch (err) {
      // 静默失败，避免无限循环
      console.error('日志发送失败:', err)
    }
  }

  /**
   * 通知用户
   * @private
   */
  notifyUser(error) {
    const notification = {
      type: this.getNotificationType(error),
      title: this.getNotificationTitle(error),
      message: error.userMessage || error.message,
      action: this.getNotificationAction(error)
    }

    // 调用通知回调
    if (this.config.onNotify) {
      this.config.onNotify(notification)
    } else {
      // 默认使用alert（生产环境应该使用更好的UI）
      console.log('通知:', notification)
    }
  }

  /**
   * 获取通知类型
   * @private
   */
  getNotificationType(error) {
    switch (error.category) {
      case ErrorCategory.USER_ERROR:
      case ErrorCategory.VALIDATION_ERROR:
        return 'warning'
      case ErrorCategory.SYSTEM_ERROR:
        return 'error'
      case ErrorCategory.NETWORK_ERROR:
        return 'info'
      default:
        return 'info'
    }
  }

  /**
   * 获取通知标题
   * @private
   */
  getNotificationTitle(error) {
    switch (error.category) {
      case ErrorCategory.USER_ERROR:
      case ErrorCategory.VALIDATION_ERROR:
        return '输入错误'
      case ErrorCategory.SYSTEM_ERROR:
        return '系统错误'
      case ErrorCategory.NETWORK_ERROR:
        return '网络错误'
      case ErrorCategory.AUTH_ERROR:
        return '认证错误'
      case ErrorCategory.RATE_LIMIT_ERROR:
        return '操作过于频繁'
      case ErrorCategory.CONCURRENCY_ERROR:
        return '操作冲突'
      default:
        return '错误'
    }
  }

  /**
   * 获取通知操作建议
   * @private
   */
  getNotificationAction(error) {
    if (error.category === ErrorCategory.NETWORK_ERROR) {
      return '请检查网络连接后重试'
    }
    if (error.category === ErrorCategory.AUTH_ERROR) {
      return '请重新登录'
    }
    if (error.category === ErrorCategory.RATE_LIMIT_ERROR) {
      return '请稍后再试'
    }
    if (error.category === ErrorCategory.CONCURRENCY_ERROR) {
      return '请稍候再试'
    }
    return null
  }

  /**
   * 判断是否应该重试
   * @param {AppError} error - 错误对象
   * @returns {boolean}
   */
  shouldRetry(error) {
    // 网络错误可以重试
    if (error.category === ErrorCategory.NETWORK_ERROR) {
      return true
    }

    // 并发错误可以重试
    if (error.category === ErrorCategory.CONCURRENCY_ERROR) {
      return true
    }

    // 速率限制错误不应立即重试
    if (error.category === ErrorCategory.RATE_LIMIT_ERROR) {
      return false
    }

    // 用户错误不应重试
    if (error.category === ErrorCategory.USER_ERROR || 
        error.category === ErrorCategory.VALIDATION_ERROR) {
      return false
    }

    // 认证错误不应重试
    if (error.category === ErrorCategory.AUTH_ERROR) {
      return false
    }

    // 系统错误默认不重试
    return false
  }

  /**
   * 更新错误统计
   * @private
   */
  updateStats(error) {
    this.errorStats.total++

    // 按类别统计
    const category = error.category || 'unknown'
    this.errorStats.byCategory[category] = (this.errorStats.byCategory[category] || 0) + 1

    // 按代码统计
    const code = error.code || 'unknown'
    this.errorStats.byCode[code] = (this.errorStats.byCode[code] || 0) + 1
  }

  /**
   * 获取错误统计
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.errorStats,
      recentErrors: this.errorLog.slice(-10)
    }
  }

  /**
   * 获取错误日志
   * @param {number} [limit=50] - 返回的日志数量
   * @returns {Array}
   */
  getErrorLog(limit = 50) {
    return this.errorLog.slice(-limit)
  }

  /**
   * 清除错误日志
   */
  clearErrorLog() {
    this.errorLog = []
  }

  /**
   * 清除错误统计
   */
  clearStats() {
    this.errorStats = {
      total: 0,
      byCategory: {},
      byCode: {}
    }
  }
}

// 创建单例实例
let errorHandlerInstance = null

/**
 * 获取ErrorHandler单例实例
 * @param {ErrorHandlerConfig} [config] - 配置对象
 * @returns {ErrorHandler}
 */
export function getErrorHandler(config) {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler(config)
  }
  return errorHandlerInstance
}

/**
 * 重置ErrorHandler实例（用于测试）
 */
export function resetErrorHandler() {
  errorHandlerInstance = null
}

export default ErrorHandler

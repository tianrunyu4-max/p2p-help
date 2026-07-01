/**
 * 错误工厂和基础错误类
 * 用于创建统一的错误对象
 */

/**
 * 错误类别枚举
 */
export const ErrorCategory = {
  USER_ERROR: 'USER_ERROR',           // 用户输入错误
  SYSTEM_ERROR: 'SYSTEM_ERROR',       // 系统内部错误
  NETWORK_ERROR: 'NETWORK_ERROR',     // 网络错误
  VALIDATION_ERROR: 'VALIDATION_ERROR', // 验证错误
  SECURITY_ERROR: 'SECURITY_ERROR',   // 安全错误
  AUTH_ERROR: 'AUTH_ERROR',           // 认证/授权错误
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR', // 速率限制错误
  CONCURRENCY_ERROR: 'CONCURRENCY_ERROR' // 并发错误
}

/**
 * 应用错误基类
 */
export class AppError extends Error {
  constructor(message, category, code, details = {}) {
    super(message)
    this.name = 'AppError'
    this.category = category
    this.code = code
    this.details = details
    this.timestamp = Date.now()
    
    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  /**
   * 判断错误是否可重试
   */
  isRetryable() {
    return this.category === ErrorCategory.NETWORK_ERROR
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage() {
    return this.details.userMessage || this.message
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp
    }
  }
}

/**
 * 错误工厂
 */
export class ErrorFactory {
  /**
   * 创建用户错误
   */
  static createUserError(message, code, details = {}) {
    return new AppError(message, ErrorCategory.USER_ERROR, code, details)
  }

  /**
   * 创建系统错误
   */
  static createSystemError(message, code, details = {}) {
    return new AppError(message, ErrorCategory.SYSTEM_ERROR, code, details)
  }

  /**
   * 创建网络错误
   */
  static createNetworkError(message, code, details = {}) {
    return new AppError(message, ErrorCategory.NETWORK_ERROR, code, details)
  }

  /**
   * 创建验证错误
   */
  static createValidationError(message, code, details = {}) {
    return new AppError(message, ErrorCategory.VALIDATION_ERROR, code, details)
  }

  /**
   * 创建安全错误
   */
  static createSecurityError(message, code, details = {}) {
    return new AppError(message, ErrorCategory.SECURITY_ERROR, code, details)
  }

  /**
   * 创建认证错误
   */
  static createAuthError(message, code, details = {}) {
    return new AppError(message, ErrorCategory.AUTH_ERROR, code, details)
  }

  /**
   * 创建速率限制错误
   */
  static createRateLimitError(message, code, details = {}) {
    return new AppError(message, ErrorCategory.RATE_LIMIT_ERROR, code, details)
  }

  /**
   * 创建并发错误
   */
  static createConcurrencyError(message, code, details = {}) {
    return new AppError(message, ErrorCategory.CONCURRENCY_ERROR, code, details)
  }

  /**
   * 从原始错误创建AppError
   */
  static fromError(error, category = ErrorCategory.SYSTEM_ERROR) {
    if (error instanceof AppError) {
      return error
    }

    const message = error.message || '未知错误'
    const code = error.code || 'UNKNOWN_ERROR'
    
    return new AppError(message, category, code, {
      originalError: error.toString(),
      stack: error.stack
    })
  }
}

/**
 * 常用错误代码
 */
export const ErrorCode = {
  // 用户错误
  INVALID_INPUT: 'INVALID_INPUT',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // 验证错误
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  
  // 并发错误
  OPERATION_LOCKED: 'OPERATION_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  BLACKLISTED: 'BLACKLISTED',
  QUEUE_FULL: 'QUEUE_FULL',
  
  // 网络错误
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  REQUEST_FAILED: 'REQUEST_FAILED',
  
  // 安全错误
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  
  // 系统错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATA_CORRUPTION: 'DATA_CORRUPTION',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}

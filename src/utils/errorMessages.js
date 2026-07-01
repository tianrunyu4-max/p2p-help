/**
 * 错误消息映射 - 中文错误消息和纠正建议
 */

export const errorMessages = {
  // ========== 用户错误 ==========
  INVALID_AMOUNT: {
    message: '请输入有效的金额',
    action: '请输入大于0的数字'
  },
  INSUFFICIENT_BALANCE: {
    message: '余额不足',
    action: '请联系推荐人互转余额或充值'
  },
  INVALID_RECIPIENT: {
    message: '收款人不存在',
    action: '请检查用户ID是否正确'
  },
  INVALID_PASSWORD: {
    message: '交易密码错误',
    action: '请重新输入正确的交易密码'
  },
  VALIDATION_ERROR: {
    message: '输入验证失败',
    action: '请检查输入内容是否符合要求'
  },
  INVALID_INVITE_CODE: {
    message: '邀请码无效',
    action: '请联系推荐人获取正确的邀请码'
  },

  // ========== 系统错误 ==========
  INTERNAL_ERROR: {
    message: '系统错误，请稍后重试',
    action: '如果问题持续，请联系客服'
  },
  DATA_CORRUPTION: {
    message: '数据异常，正在恢复',
    action: '请稍候，系统正在自动修复'
  },
  SYSTEM_ERROR: {
    message: '系统繁忙',
    action: '请稍后重试'
  },

  // ========== 网络错误 ==========
  NETWORK_TIMEOUT: {
    message: '网络超时',
    action: '请检查网络连接后重试'
  },
  CONNECTION_FAILED: {
    message: '连接失败',
    action: '请检查网络连接'
  },
  NETWORK_ERROR: {
    message: '网络错误',
    action: '请检查网络连接后重试'
  },

  // ========== 认证错误 ==========
  SESSION_EXPIRED: {
    message: '登录已过期',
    action: '请重新登录'
  },
  UNAUTHORIZED: {
    message: '无权限执行此操作',
    action: '请联系管理员'
  },
  AUTH_ERROR: {
    message: '认证失败',
    action: '请重新登录'
  },

  // ========== 速率限制错误 ==========
  RATE_LIMIT_EXCEEDED: {
    message: '操作过于频繁',
    action: '请稍后再试'
  },

  // ========== 并发错误 ==========
  RESOURCE_LOCKED: {
    message: '操作正在处理中',
    action: '请稍候'
  },
  QUEUE_FULL: {
    message: '请求队列已满',
    action: '请稍后重试'
  },
  CONCURRENCY_ERROR: {
    message: '操作冲突',
    action: '请稍后重试'
  },

  // ========== 密码相关错误 ==========
  PASSWORD_LOCKED: {
    message: '账户已锁定',
    action: '请在锁定时间结束后重试'
  },
  PASSWORD_ATTEMPTS_EXCEEDED: {
    message: '密码错误次数过多',
    action: '账户已被临时锁定'
  },
  PASSWORD_TOKEN_EXPIRED: {
    message: '操作令牌已过期',
    action: '请重新输入交易密码'
  },

  // ========== 激活相关错误 ==========
  ALREADY_ACTIVATED: {
    message: '账户已激活',
    action: '无需重复激活'
  },
  ACTIVATION_FAILED: {
    message: '激活失败',
    action: '请检查余额是否充足'
  },

  // ========== 转账相关错误 ==========
  TRANSFER_FAILED: {
    message: '转账失败',
    action: '请检查余额和收款人信息'
  },
  SELF_TRANSFER: {
    message: '不能转账给自己',
    action: '请输入其他用户的ID'
  },

  // ========== 默认错误 ==========
  UNKNOWN_ERROR: {
    message: '未知错误',
    action: '请重试或联系客服'
  }
}

/**
 * 获取错误消息
 * @param {string} code - 错误代码
 * @returns {Object} 错误消息对象
 */
export function getErrorMessage(code) {
  return errorMessages[code] || errorMessages.UNKNOWN_ERROR
}

/**
 * 格式化错误消息
 * @param {string} code - 错误代码
 * @param {Object} [params] - 参数对象
 * @returns {string} 格式化后的消息
 */
export function formatErrorMessage(code, params = {}) {
  const errorMsg = getErrorMessage(code)
  let message = errorMsg.message

  // 替换参数
  Object.keys(params).forEach(key => {
    message = message.replace(`{${key}}`, params[key])
  })

  return message
}

export default errorMessages

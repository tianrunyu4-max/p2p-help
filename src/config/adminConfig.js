/**
 * 管理员配置
 * 统一管理管理员相关的配置信息
 */

import { API_BASE_URL } from './api.js'

export const ADMIN_CONFIG = {
  // 管理员权限标识
  AUTH_KEY: 'is_admin_authenticated',
  
  // 敏感操作列表
  SENSITIVE_OPERATIONS: {
    CLEAR_DATA: '清空所有数据',
    DELETE_USER: '删除用户',
    MODIFY_BALANCE: '修改余额',
    GENERATE_CODE: '生成充值码'
  }
}

/**
 * 验证管理员登录码（调用后端 API）
 * @param {string} code - 输入的登录码
 * @returns {Promise<boolean>} 是否验证通过
 */
export async function verifyAdminLoginCode(code) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/verify-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    })
    
    const result = await response.json()
    return result.success
  } catch (error) {
    console.error('验证登录码失败:', error)
    return false
  }
}

/**
 * 验证管理员操作密码（调用后端 API）
 * @param {string} password - 输入的密码
 * @returns {Promise<boolean>} 是否验证通过
 */
export async function verifyAdminPassword(password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/verify-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    })
    
    const result = await response.json()
    return result.success
  } catch (error) {
    console.error('验证操作密码失败:', error)
    return false
  }
}

/**
 * 修改管理员登录码（调用后端 API）
 * @param {string} currentCode - 当前登录码
 * @param {string} newCode - 新登录码
 * @returns {Promise<Object>} 修改结果
 */
export async function changeAdminLoginCode(currentCode, newCode) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/change-login-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentCode, newCode })
    })
    
    const result = await response.json()
    return result
  } catch (error) {
    console.error('修改登录码失败:', error)
    return { success: false, message: '网络错误，请重试' }
  }
}

/**
 * 修改管理员操作密码（调用后端 API）
 * @param {string} currentPassword - 当前密码
 * @param {string} newPassword - 新密码
 * @returns {Promise<Object>} 修改结果
 */
export async function changeAdminPassword(currentPassword, newPassword) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentPassword, newPassword })
    })
    
    const result = await response.json()
    return result
  } catch (error) {
    console.error('修改操作密码失败:', error)
    return { success: false, message: '网络错误，请重试' }
  }
}


/**
 * 检查是否已登录管理员
 * @returns {boolean} 是否已登录
 */
export function isAdminAuthenticated() {
  return localStorage.getItem(ADMIN_CONFIG.AUTH_KEY) === 'true'
}

/**
 * 设置管理员登录状态
 * @param {boolean} authenticated - 是否已登录
 */
export function setAdminAuthenticated(authenticated) {
  if (authenticated) {
    localStorage.setItem(ADMIN_CONFIG.AUTH_KEY, 'true')
  } else {
    localStorage.removeItem(ADMIN_CONFIG.AUTH_KEY)
  }
}

/**
 * 退出管理员登录
 */
export function logoutAdmin() {
  setAdminAuthenticated(false)
}

export default ADMIN_CONFIG

/**
 * 用户认证系统 - 简化版
 * 
 * 功能：
 * - 自动生成8开头的5位数社区ID
 * - 统一使用社区ID（chatUserId）作为唯一标识
 * - 清理旧的 ID 格式
 */

// 统一使用社区ID作为唯一标识
const USER_ID_KEY = 'chatUserId'  // 社区ID，整个平台的唯一ID

/**
 * 清理旧的 ID 格式（U_ 开头的）- 只执行一次
 */
function cleanupOldIds() {
  // 检查是否已经清理过
  const cleanupFlag = localStorage.getItem('id_cleanup_done')
  if (cleanupFlag === 'true') {
    return // 已经清理过，不再执行
  }
  
  // 检查是否有旧的 U_ 开头的 ID
  const currentId = localStorage.getItem(USER_ID_KEY)
  if (currentId && currentId.startsWith('U_')) {
    // 删除旧 ID，重新生成新 ID
    localStorage.removeItem(USER_ID_KEY)
    console.log('清理旧 ID 格式:', currentId)
  }
  
  // 清理其他可能的旧 key
  const oldKeys = ['user_id', 'userId', 'community_id']
  oldKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key)
      console.log('清理旧 key:', key)
    }
  })
  
  // 标记已清理
  localStorage.setItem('id_cleanup_done', 'true')
}

/**
 * 生成用户ID (8开头的6位数字，如：812345)
 * @returns {string} 用户 ID
 */
function generateUserId() {
  const randomPart = Math.floor(10000 + Math.random() * 90000).toString()
  const id = '8' + randomPart
  localStorage.setItem(USER_ID_KEY, id)
  return id
}

/**
 * 获取或创建用户 ID（社区ID）
 * @returns {string} 用户 ID
 */
export function getOrCreateUserId() {
  // 先清理旧数据
  cleanupOldIds()

  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = generateUserId()
  } else if (id.length === 5 && id.startsWith('8')) {
    // 旧5位ID自动升级为6位
    id = generateUserId()
  }
  return id
}

/**
 * 获取当前用户 ID（不创建新 ID）
 * @returns {string|null} 用户 ID 或 null
 */
export function getUserId() {
  return localStorage.getItem(USER_ID_KEY)
}

/**
 * 清除用户 ID
 */
export function clearUserId() {
  localStorage.removeItem(USER_ID_KEY)
}

/**
 * 检查是否已有用户ID（用于兼容）
 */
export function isLoggedIn() {
  return !!localStorage.getItem(USER_ID_KEY)
}

/**
 * 获取或生成设备密钥（用于绑定设备，防止他人冒用 userId 操作）
 * 存储在 localStorage，每台设备唯一，不随 ID 切换而清除
 */
export function getDeviceSecret() {
  let secret = localStorage.getItem('device_secret')
  if (!secret) {
    secret = crypto.randomUUID()
    localStorage.setItem('device_secret', secret)
  }
  return secret
}

/**
 * 获取当前用户信息（兼容旧代码）
 */
export function getCurrentUser() {
  const id = localStorage.getItem(USER_ID_KEY)
  if (!id) return null
  
  return {
    id,
    displayId: id,
    nickname: localStorage.getItem('chatUserName') || '用户_' + id.slice(-3)
  }
}

// 兼容旧代码的空函数
export async function register() {
  return { success: false, error: '已禁用注册功能' }
}

export async function login() {
  return { success: false, error: '已禁用登录功能' }
}

export function logout() {
  clearUserId()
  localStorage.removeItem('chatUserName')
  return { success: true }
}

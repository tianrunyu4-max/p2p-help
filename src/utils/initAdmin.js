/**
 * 管理员初始化工具
 * 自动为当前用户设置初始余额（用于测试）
 */

import { getOrCreateUserId } from './auth.js'

const USERS_KEY = 'taskchain_users' // 统一使用 taijiFlow.js 的键名

/**
 * 初始化当前用户余额
 */
export function initCurrentUserBalance() {
  const userId = getOrCreateUserId()
  if (!userId) return false

  // 从localStorage获取users数据
  let users = []
  try {
    const stored = localStorage.getItem(USERS_KEY)
    if (stored) {
      users = JSON.parse(stored)
    }
  } catch (error) {
    console.error('读取用户数据失败:', error)
  }

  // 查找当前用户
  let currentUser = users.find(u => u.id === userId)

  if (!currentUser) {
    // 创建新用户，给初始余额
    currentUser = {
      id: userId,
      referrerId: 'PLATFORM',
      modelType: 'BASIC',
      isActive: true,
      isIndependent: false,
      directPushCount: 0,
      totalEarnings: 0,
      spotBonusEarnings: 0,
      levelBonusEarnings: 0,
      balance_65: 10000,
      balance_300: 10000,
      withdrawable_65: 0,
      withdrawable_300: 0,
      locked_65: 0,
      locked_300: 0,
      activated_65: false,
      activated_300: false,
      hasContributed: false,
      createdAt: Date.now()
    }
    users.push(currentUser)
    console.log('✅ 新用户创建成功，ID:', userId)
  } else if (currentUser.balance_65 === 0 && currentUser.balance_300 === 0) {
    // 用户存在但余额为0，补充余额
    currentUser.balance_65 = 10000
    currentUser.balance_300 = 10000
    console.log('✅ 已补充用户余额')
  }

  // 保存回localStorage
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
    console.log('💰 65型余额:', currentUser.balance_65)
    console.log('💰 300型余额:', currentUser.balance_300)
    return true
  } catch (error) {
    console.error('保存用户数据失败:', error)
    return false
  }
}

// 禁用自动执行，只能通过管理后台手动调用
// if (typeof window !== 'undefined') {
//   // 延迟执行，确保auth.js已加载
//   setTimeout(() => {
//     const hasInit = sessionStorage.getItem('balance_initialized')
//     if (!hasInit) {
//       initCurrentUserBalance()
//       sessionStorage.setItem('balance_initialized', 'true')
//     }
//   }, 100)
// }

export default initCurrentUserBalance

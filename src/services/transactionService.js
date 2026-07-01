/**
 * 交易记录服务
 * 管理所有资金流水记录
 */

import { USE_NEW_SYSTEM } from '../config/systemConfig.js'
import { supabase } from '../config/supabase.js'
import { API_BASE_URL } from '../config/api.js'

class TransactionService {
  constructor() {
    this.transactions = []
    // 不再从 localStorage 加载，交易明细统一从后端读取
  }

  /**
   * 记录交易
   * @param {Object} transaction - 交易对象
   */
  recordTransaction(transaction) {
    const record = {
      id: this.generateId(),
      userId: transaction.userId,
      type: transaction.type, // 'spot_bonus', 'level_bonus', 'daily_dividend', 'help_transfer', 'withdrawal', 'upgrade'
      amount: transaction.amount,
      fromUserId: transaction.fromUserId || null,
      toUserId: transaction.toUserId || null,
      modelType: transaction.modelType || null,
      balanceType: transaction.balanceType || null, // 'withdraw', 'helpLock', 'upgradeLock'
      generation: transaction.generation || null, // 平级奖代数
      status: transaction.status || 'completed', // 'pending', 'completed', 'rejected'
      note: transaction.note || '',
      timestamp: Date.now(),
      createdAt: new Date().toISOString()
    }
    
    this.transactions.push(record)
    this.saveToStorage()
    
    return record
  }

  /**
   * 获取用户的交易记录（从后端读取）
   * @param {String} userId - 用户ID
   * @param {Object} options - 筛选选项
   * @returns {Promise<Array>}
   */
  async getUserTransactions(userId, options = {}) {
    try {
      const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
      const apiUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
      const baseUrl = isDev ? '/api' : `${apiUrl || 'https://ai-airdrop.uk'}/api`

      const params = new URLSearchParams()
      if (options.page) params.set('page', String(options.page))
      if (options.pageSize) params.set('pageSize', String(options.pageSize))
      if (options.type) params.set('type', options.type)
      if (options.startDate) params.set('startDate', options.startDate)
      if (options.endDate) params.set('endDate', options.endDate)

      const res = await fetch(`${baseUrl}/subscription/transactions/${userId}?${params.toString()}`)
      const data = await res.json()

      if (data.code === 200 && data.data?.transactions) {
        let result = data.data.transactions
        // 后端未支持的 status 过滤在前端兜底
        if (options.status) {
          result = result.filter(t => t.status === options.status)
        }
        return result
      }
      return []
    } catch (error) {
      console.error('获取交易记录失败:', error)
      return []
    }
  }

  /**
   * 获取交易统计
   * @param {String} userId - 用户ID
   */
  getUserTransactionStats(userId) {
    const userTransactions = this.transactions.filter(t => t.userId === userId)
    
    const stats = {
      totalIncome: 0,
      totalOutcome: 0,
      spotBonusTotal: 0,
      levelBonusTotal: 0,
      dailyDividendTotal: 0,
      transferIn: 0,
      transferOut: 0,
      helpTransferIn: 0,
      helpTransferOut: 0,
      withdrawalTotal: 0,
      byType: {},
      byMonth: {}
    }
    
    userTransactions.forEach(t => {
      // 收入统计
      if (['spot_bonus', 'level_bonus', 'daily_dividend'].includes(t.type)) {
        stats.totalIncome += t.amount
      }
      
      // 互转收入
      if (t.type === 'transfer' && t.toUserId === userId) {
        stats.totalIncome += t.amount
        stats.transferIn += t.amount
      }
      
      if (t.type === 'help_transfer' && t.toUserId === userId) {
        stats.totalIncome += t.amount
        stats.helpTransferIn += t.amount
      }
      
      // 支出统计
      if (t.type === 'withdrawal' && t.status === 'completed') {
        stats.totalOutcome += t.amount
        stats.withdrawalTotal += t.amount
      }
      
      // 激活订阅支出
      if (t.type === 'activation' && t.status === 'completed') {
        stats.totalOutcome += t.amount
      }
      
      // 互转支出
      if (t.type === 'transfer' && t.fromUserId === userId) {
        stats.totalOutcome += t.amount
        stats.transferOut += t.amount
      }
      
      if (t.type === 'help_transfer' && t.fromUserId === userId) {
        stats.totalOutcome += t.amount
        stats.helpTransferOut += t.amount
      }
      
      // 按类型统计
      if (!stats.byType[t.type]) {
        stats.byType[t.type] = { count: 0, total: 0 }
      }
      stats.byType[t.type].count++
      stats.byType[t.type].total += t.amount
      
      // 按月份统计
      const month = new Date(t.timestamp).toISOString().slice(0, 7)
      if (!stats.byMonth[month]) {
        stats.byMonth[month] = { count: 0, total: 0 }
      }
      stats.byMonth[month].count++
      stats.byMonth[month].total += t.amount
      
      // 详细分类
      if (t.type === 'spot_bonus') stats.spotBonusTotal += t.amount
      if (t.type === 'level_bonus') stats.levelBonusTotal += t.amount
      if (t.type === 'daily_dividend') stats.dailyDividendTotal += t.amount
    })
    
    return stats
  }

  /**
   * 获取今日交易
   * @param {String} userId - 用户ID
   */
  getTodayTransactions(userId) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()
    
    return this.transactions.filter(t => 
      (t.userId === userId || t.fromUserId === userId || t.toUserId === userId) &&
      t.timestamp >= todayTimestamp
    )
  }

  /**
   * 更新交易状态
   * @param {String} transactionId - 交易ID
   * @param {String} status - 新状态
   * @param {String} note - 备注
   */
  updateTransactionStatus(transactionId, status, note = '') {
    const transaction = this.transactions.find(t => t.id === transactionId)
    
    if (!transaction) {
      throw new Error('交易记录不存在')
    }
    
    transaction.status = status
    if (note) {
      transaction.note = note
    }
    transaction.updatedAt = new Date().toISOString()
    
    this.saveToStorage()
    
    return transaction
  }

  /**
   * 获取交易详情
   * @param {String} transactionId - 交易ID
   */
  getTransactionById(transactionId) {
    return this.transactions.find(t => t.id === transactionId)
  }

  /**
   * 删除交易记录（仅用于测试）
   * @param {String} transactionId - 交易ID
   */
  deleteTransaction(transactionId) {
    const index = this.transactions.findIndex(t => t.id === transactionId)
    
    if (index !== -1) {
      this.transactions.splice(index, 1)
      this.saveToStorage()
      return true
    }
    
    return false
  }

  /**
   * 清空所有交易记录（仅用于测试）
   */
  clearAll() {
    this.transactions = []
    this.saveToStorage()
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  }

  /**
   * 从 localStorage 加载（已废弃，交易明细统一从后端读取）
   * @deprecated
   */
  loadFromStorage() {
    // 不再读取 localStorage，保留方法以防旧代码引用
  }

  /**
   * 保存到 localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem('transactions', JSON.stringify(this.transactions))
    } catch (error) {
      console.error('保存交易记录失败:', error)
    }
  }

  /**
   * 获取交易类型的中文名称
   */
  static getTypeLabel(type) {
    const labels = {
      'spot_bonus': '见点奖',
      'level_bonus': '平级奖',
      'daily_dividend': '每日分红',
      'transfer': '余额互转',
      'help_transfer': '购物补贴',
      'admin_transfer': '管理员充值',
      'withdrawal': '复购',
      'upgrade': '升级',
      'activation': '激活'
    }
    return labels[type] || type
  }

  /**
   * 获取交易类型的图标
   */
  static getTypeIcon(type) {
    const icons = {
      'spot_bonus': '💰',
      'level_bonus': '🎁',
      'daily_dividend': '💎',
      'transfer': '💸',
      'help_transfer': '🛒',
      'admin_transfer': '🔄',
      'withdrawal': '🔁',
      'upgrade': '⬆️',
      'activation': '🎊'
    }
    return icons[type] || '📝'
  }

  /**
   * 获取状态的中文名称
   */
  static getStatusLabel(status) {
    const labels = {
      'pending': '待处理',
      'completed': '已完成',
      'rejected': '已拒绝',
      'processing': '处理中'
    }
    return labels[status] || status
  }
}

// ==================== 单例模式 ====================

let transactionServiceInstance = null

export function getTransactionService() {
  if (!transactionServiceInstance) {
    transactionServiceInstance = new TransactionService()
  }
  return transactionServiceInstance
}

export function resetTransactionService() {
  if (transactionServiceInstance) {
    transactionServiceInstance.clearAll()
    transactionServiceInstance = null
  }
}

export default TransactionService


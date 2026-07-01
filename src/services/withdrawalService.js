/**
 * 提现服务
 * 管理提现申请、审核、记录
 */

import { getTransactionService } from './transactionService.js'

class WithdrawalService {
  constructor() {
    this.withdrawals = []
    this.loadFromStorage()
  }

  /**
   * 创建提现申请
   * @param {Object} request - 提现申请对象
   */
  createWithdrawal(request) {
    const { userId, amount, balanceType, modelType, contactInfo, note } = request
    
    // 验证
    if (!userId || !amount || amount <= 0) {
      throw new Error('提现信息不完整')
    }
    
    if (amount < 50) {
      throw new Error('提现金额不能少于50元')
    }
    
    const withdrawal = {
      id: this.generateId(),
      userId,
      amount,
      balanceType, // 'withdraw', 'helpLock'
      modelType, // 'TYPE_65', 'TYPE_300'
      contactInfo: contactInfo || {},
      note: note || '',
      status: 'pending', // 'pending', 'processing', 'completed', 'rejected'
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processedAt: null,
      processedBy: null,
      rejectReason: null,
      timestamp: Date.now()
    }
    
    this.withdrawals.push(withdrawal)
    this.saveToStorage()
    
    // 记录到交易服务
    const transactionService = getTransactionService()
    transactionService.recordTransaction({
      userId,
      type: 'withdrawal',
      amount,
      balanceType,
      modelType,
      status: 'pending',
      note: note || '提现申请'
    })
    
    return withdrawal
  }

  /**
   * 获取用户的提现记录
   * @param {String} userId - 用户ID
   * @param {Object} options - 筛选选项
   */
  getUserWithdrawals(userId, options = {}) {
    let filtered = this.withdrawals.filter(w => w.userId === userId)
    
    // 按状态筛选
    if (options.status) {
      filtered = filtered.filter(w => w.status === options.status)
    }
    
    // 按时间倒序排序
    filtered.sort((a, b) => b.timestamp - a.timestamp)
    
    // 分页
    if (options.page && options.pageSize) {
      const start = (options.page - 1) * options.pageSize
      const end = start + options.pageSize
      filtered = filtered.slice(start, end)
    }
    
    return filtered
  }

  /**
   * 获取所有待处理的提现申请（管理员用）
   */
  getPendingWithdrawals() {
    return this.withdrawals
      .filter(w => w.status === 'pending')
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * 审核提现申请
   * @param {String} withdrawalId - 提现ID
   * @param {String} action - 动作 ('approve', 'reject')
   * @param {String} processedBy - 审核人
   * @param {String} reason - 拒绝原因（仅在拒绝时需要）
   */
  processWithdrawal(withdrawalId, action, processedBy, reason = '') {
    const withdrawal = this.withdrawals.find(w => w.id === withdrawalId)
    
    if (!withdrawal) {
      throw new Error('提现申请不存在')
    }
    
    if (withdrawal.status !== 'pending') {
      throw new Error('该申请已处理')
    }
    
    if (action === 'approve') {
      withdrawal.status = 'completed'
    } else if (action === 'reject') {
      withdrawal.status = 'rejected'
      withdrawal.rejectReason = reason
    } else {
      throw new Error('无效的操作')
    }
    
    withdrawal.processedAt = new Date().toISOString()
    withdrawal.processedBy = processedBy
    withdrawal.updatedAt = new Date().toISOString()
    
    this.saveToStorage()
    
    // 更新交易记录状态
    const transactionService = getTransactionService()
    const transactions = transactionService.getUserTransactions(withdrawal.userId, {
      type: 'withdrawal',
      status: 'pending'
    })
    
    const matchingTransaction = transactions.find(t => 
      t.amount === withdrawal.amount && 
      Math.abs(t.timestamp - withdrawal.timestamp) < 1000
    )
    
    if (matchingTransaction) {
      transactionService.updateTransactionStatus(
        matchingTransaction.id,
        withdrawal.status,
        action === 'reject' ? reason : '提现成功'
      )
    }
    
    return withdrawal
  }

  /**
   * 取消提现申请（用户主动取消）
   * @param {String} withdrawalId - 提现ID
   * @param {String} userId - 用户ID（验证权限）
   */
  cancelWithdrawal(withdrawalId, userId) {
    const withdrawal = this.withdrawals.find(w => w.id === withdrawalId)
    
    if (!withdrawal) {
      throw new Error('提现申请不存在')
    }
    
    if (withdrawal.userId !== userId) {
      throw new Error('无权取消该申请')
    }
    
    if (withdrawal.status !== 'pending') {
      throw new Error('该申请已处理，无法取消')
    }
    
    withdrawal.status = 'rejected'
    withdrawal.rejectReason = '用户主动取消'
    withdrawal.updatedAt = new Date().toISOString()
    
    this.saveToStorage()
    
    // 更新交易记录
    const transactionService = getTransactionService()
    const transactions = transactionService.getUserTransactions(userId, {
      type: 'withdrawal',
      status: 'pending'
    })
    
    const matchingTransaction = transactions.find(t => 
      t.amount === withdrawal.amount && 
      Math.abs(t.timestamp - withdrawal.timestamp) < 1000
    )
    
    if (matchingTransaction) {
      transactionService.updateTransactionStatus(
        matchingTransaction.id,
        'rejected',
        '用户主动取消'
      )
    }
    
    return withdrawal
  }

  /**
   * 获取提现统计
   * @param {String} userId - 用户ID
   */
  getWithdrawalStats(userId) {
    const userWithdrawals = this.withdrawals.filter(w => w.userId === userId)
    
    const stats = {
      totalAmount: 0,
      completedAmount: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
      totalCount: userWithdrawals.length,
      completedCount: 0,
      pendingCount: 0,
      rejectedCount: 0
    }
    
    userWithdrawals.forEach(w => {
      if (w.status === 'completed') {
        stats.completedAmount += w.amount
        stats.completedCount++
      } else if (w.status === 'pending') {
        stats.pendingAmount += w.amount
        stats.pendingCount++
      } else if (w.status === 'rejected') {
        stats.rejectedAmount += w.amount
        stats.rejectedCount++
      }
      
      stats.totalAmount += w.amount
    })
    
    return stats
  }

  /**
   * 获取提现详情
   * @param {String} withdrawalId - 提现ID
   */
  getWithdrawalById(withdrawalId) {
    return this.withdrawals.find(w => w.id === withdrawalId)
  }

  /**
   * 检查用户是否有待处理的提现
   * @param {String} userId - 用户ID
   */
  hasPendingWithdrawal(userId) {
    return this.withdrawals.some(w => 
      w.userId === userId && w.status === 'pending'
    )
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  }

  /**
   * 从 localStorage 加载
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('withdrawals')
      if (stored) {
        this.withdrawals = JSON.parse(stored)
      }
    } catch (error) {
      console.error('加载提现记录失败:', error)
      this.withdrawals = []
    }
  }

  /**
   * 保存到 localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem('withdrawals', JSON.stringify(this.withdrawals))
    } catch (error) {
      console.error('保存提现记录失败:', error)
    }
  }

  /**
   * 清空所有提现记录（仅用于测试）
   */
  clearAll() {
    this.withdrawals = []
    this.saveToStorage()
  }

  /**
   * 获取状态标签
   */
  static getStatusLabel(status) {
    const labels = {
      'pending': '待审核',
      'processing': '处理中',
      'completed': '已完成',
      'rejected': '已拒绝'
    }
    return labels[status] || status
  }

  /**
   * 获取状态颜色
   */
  static getStatusColor(status) {
    const colors = {
      'pending': '#F7B500',
      'processing': '#3B82F6',
      'completed': '#07C160',
      'rejected': '#E74C3C'
    }
    return colors[status] || '#999'
  }
}

// ==================== 单例模式 ====================

let withdrawalServiceInstance = null

export function getWithdrawalService() {
  if (!withdrawalServiceInstance) {
    withdrawalServiceInstance = new WithdrawalService()
  }
  return withdrawalServiceInstance
}

export function resetWithdrawalService() {
  if (withdrawalServiceInstance) {
    withdrawalServiceInstance.clearAll()
    withdrawalServiceInstance = null
  }
}

export default WithdrawalService


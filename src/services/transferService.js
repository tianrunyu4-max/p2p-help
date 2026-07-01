/**
 * 互转服务
 * 管理用户之间的余额互转（场外结算）
 * 
 * 核心理念：
 * - 平台不碰钱，只做服务和计算
 * - 所有资金流转都在场外（微信/支付宝）
 * - 互转只是记录，不涉及实际资金
 */

class TransferService {
  constructor() {
    this.transfers = []
    this.loadFromStorage()
  }

  /**
   * 创建互转记录
   * @param {Object} transfer - 互转对象
   */
  createTransfer(transfer) {
    const { fromUserId, toUserId, amount, transferType, modelType, proofImage, note } = transfer
    
    // 验证
    if (!fromUserId || !toUserId || !amount || amount <= 0) {
      throw new Error('互转信息不完整')
    }
    
    if (fromUserId === toUserId) {
      throw new Error('不能给自己转账')
    }
    
    const record = {
      id: this.generateId(),
      fromUserId,
      toUserId,
      amount,
      transferType, // 'help' (帮扶), 'activation' (激活), 'manual' (手动)
      modelType, // 'TYPE_65', 'TYPE_300'
      proofImage: proofImage || null, // 场外支付凭证截图（可选）
      note: note || '',
      status: 'completed', // 互转都是即时完成
      createdAt: new Date().toISOString(),
      timestamp: Date.now()
    }
    
    this.transfers.push(record)
    this.saveToStorage()
    
    return record
  }

  /**
   * 获取用户的互转记录
   * @param {String} userId - 用户ID
   * @param {Object} options - 筛选选项
   */
  getUserTransfers(userId, options = {}) {
    let filtered = this.transfers.filter(t => 
      t.fromUserId === userId || t.toUserId === userId
    )
    
    // 按类型筛选
    if (options.transferType) {
      filtered = filtered.filter(t => t.transferType === options.transferType)
    }
    
    // 按时间范围筛选
    if (options.startDate) {
      const startTime = new Date(options.startDate).getTime()
      filtered = filtered.filter(t => t.timestamp >= startTime)
    }
    
    if (options.endDate) {
      const endTime = new Date(options.endDate).getTime()
      filtered = filtered.filter(t => t.timestamp <= endTime)
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
   * 获取互转统计
   * @param {String} userId - 用户ID
   */
  getTransferStats(userId) {
    const userTransfers = this.transfers.filter(t => 
      t.fromUserId === userId || t.toUserId === userId
    )
    
    const stats = {
      totalTransferOut: 0,    // 转出总额
      totalTransferIn: 0,     // 转入总额
      transferOutCount: 0,    // 转出次数
      transferInCount: 0,     // 转入次数
      helpTransferOut: 0,     // 帮扶转出
      helpTransferIn: 0,      // 帮扶转入
      activationTransferOut: 0, // 激活转出
      activationTransferIn: 0,  // 激活转入
      byMonth: {}
    }
    
    userTransfers.forEach(t => {
      // 转出统计
      if (t.fromUserId === userId) {
        stats.totalTransferOut += t.amount
        stats.transferOutCount++
        
        if (t.transferType === 'help') {
          stats.helpTransferOut += t.amount
        } else if (t.transferType === 'activation') {
          stats.activationTransferOut += t.amount
        }
      }
      
      // 转入统计
      if (t.toUserId === userId) {
        stats.totalTransferIn += t.amount
        stats.transferInCount++
        
        if (t.transferType === 'help') {
          stats.helpTransferIn += t.amount
        } else if (t.transferType === 'activation') {
          stats.activationTransferIn += t.amount
        }
      }
      
      // 按月份统计
      const month = new Date(t.timestamp).toISOString().slice(0, 7)
      if (!stats.byMonth[month]) {
        stats.byMonth[month] = { transferOut: 0, transferIn: 0, count: 0 }
      }
      
      if (t.fromUserId === userId) {
        stats.byMonth[month].transferOut += t.amount
      }
      if (t.toUserId === userId) {
        stats.byMonth[month].transferIn += t.amount
      }
      stats.byMonth[month].count++
    })
    
    return stats
  }

  /**
   * 获取今日互转
   * @param {String} userId - 用户ID
   */
  getTodayTransfers(userId) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()
    
    return this.transfers.filter(t => 
      (t.fromUserId === userId || t.toUserId === userId) &&
      t.timestamp >= todayTimestamp
    )
  }

  /**
   * 获取互转详情
   * @param {String} transferId - 互转ID
   */
  getTransferById(transferId) {
    return this.transfers.find(t => t.id === transferId)
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `TF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  }

  /**
   * 从 localStorage 加载
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('transfers')
      if (stored) {
        this.transfers = JSON.parse(stored)
      }
    } catch (error) {
      console.error('加载互转记录失败:', error)
      this.transfers = []
    }
  }

  /**
   * 保存到 localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem('transfers', JSON.stringify(this.transfers))
    } catch (error) {
      console.error('保存互转记录失败:', error)
    }
  }

  /**
   * 清空所有互转记录（仅用于测试）
   */
  clearAll() {
    this.transfers = []
    this.saveToStorage()
  }

  /**
   * 获取结算类型标签
   */
  static getTypeLabel(type) {
    const labels = {
      'help': '购物补贴',
      'activation': '激活扣款',
      'manual': '系统结算'
    }
    return labels[type] || type
  }

  /**
   * 获取结算类型图标
   */
  static getTypeIcon(type) {
    const icons = {
      'help': '🛒',
      'activation': '⚡',
      'manual': '📊'
    }
    return icons[type] || '💰'
  }
}

// ==================== 单例模式 ====================

let transferServiceInstance = null

export function getTransferService() {
  if (!transferServiceInstance) {
    transferServiceInstance = new TransferService()
  }
  return transferServiceInstance
}

export function resetTransferService() {
  if (transferServiceInstance) {
    transferServiceInstance.clearAll()
    transferServiceInstance = null
  }
}

export default TransferService


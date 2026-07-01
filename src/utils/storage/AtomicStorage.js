/**
 * AtomicStorage - 原子存储系统
 * 
 * 功能：
 * - 原子get/set/delete操作
 * - 事务支持(begin, commit, rollback)
 * - 版本跟踪
 * - 事务日志
 * - 数据完整性验证
 */

/**
 * 存储事务
 * @typedef {Object} StorageTransaction
 * @property {string} id - 事务ID
 * @property {Array} operations - 操作列表
 * @property {number} timestamp - 时间戳
 * @property {string} status - 状态: pending, committed, rolled_back
 */

/**
 * 存储操作
 * @typedef {Object} StorageOperation
 * @property {string} type - 操作类型: set, delete
 * @property {string} key - 键名
 * @property {*} [value] - 值
 * @property {*} [previousValue] - 之前的值
 */

/**
 * 版本化数据
 * @typedef {Object} VersionedData
 * @property {*} value - 数据值
 * @property {number} version - 版本号
 * @property {number} timestamp - 时间戳
 */

export class AtomicStorage {
  constructor(options = {}) {
    this.options = {
      enableVersioning: true,
      enableTransactionLog: true,
      maxTransactionLogSize: 100,
      prefix: 'app_',
      versionPrefix: 'version_',
      transactionLogKey: 'transaction_log',
      ...options
    }

    // 当前事务
    this.currentTransaction = null

    // 初始化
    this.init()
  }

  /**
   * 初始化存储
   */
  init() {
    // 清理过期的pending事务
    this.cleanupPendingTransactions()
  }

  /**
   * 获取完整键名
   * @private
   */
  getFullKey(key) {
    return this.options.prefix + key
  }

  /**
   * 获取版本键名
   * @private
   */
  getVersionKey(key) {
    return this.options.versionPrefix + key
  }

  /**
   * 生成事务ID
   * @private
   */
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ========== 基础操作 ==========

  /**
   * 获取数据
   * @param {string} key - 键名
   * @returns {*} 数据值
   */
  get(key) {
    try {
      const fullKey = this.getFullKey(key)
      const data = localStorage.getItem(fullKey)
      
      if (data === null) {
        return null
      }

      return JSON.parse(data)
    } catch (error) {
      console.error(`获取数据失败 [${key}]:`, error)
      return null
    }
  }

  /**
   * 设置数据
   * @param {string} key - 键名
   * @param {*} value - 数据值
   */
  set(key, value) {
    try {
      const fullKey = this.getFullKey(key)
      const previousValue = this.get(key)

      // 如果在事务中，添加到事务操作列表
      if (this.currentTransaction) {
        this.currentTransaction.operations.push({
          type: 'set',
          key: fullKey,
          value,
          previousValue
        })
        return
      }

      // 创建单操作事务
      const transaction = this.createTransaction([{
        type: 'set',
        key: fullKey,
        value,
        previousValue
      }])

      // 执行操作
      this.executeTransaction(transaction)

    } catch (error) {
      console.error(`设置数据失败 [${key}]:`, error)
      throw error
    }
  }

  /**
   * 删除数据
   * @param {string} key - 键名
   */
  delete(key) {
    try {
      const fullKey = this.getFullKey(key)
      const previousValue = this.get(key)

      // 如果在事务中，添加到事务操作列表
      if (this.currentTransaction) {
        this.currentTransaction.operations.push({
          type: 'delete',
          key: fullKey,
          previousValue
        })
        return
      }

      // 创建单操作事务
      const transaction = this.createTransaction([{
        type: 'delete',
        key: fullKey,
        previousValue
      }])

      // 执行操作
      this.executeTransaction(transaction)

    } catch (error) {
      console.error(`删除数据失败 [${key}]:`, error)
      throw error
    }
  }

  // ========== 版本化操作 ==========

  /**
   * 获取带版本的数据
   * @param {string} key - 键名
   * @returns {VersionedData|null}
   */
  getWithVersion(key) {
    try {
      const value = this.get(key)
      if (value === null) {
        return null
      }

      const versionKey = this.getVersionKey(key)
      const version = parseInt(localStorage.getItem(versionKey) || '0')
      const timestamp = parseInt(localStorage.getItem(versionKey + '_ts') || '0')

      return {
        value,
        version,
        timestamp
      }
    } catch (error) {
      console.error(`获取版本化数据失败 [${key}]:`, error)
      return null
    }
  }

  /**
   * 设置带版本的数据
   * @param {string} key - 键名
   * @param {*} value - 数据值
   * @param {number} [expectedVersion] - 期望的版本号（用于乐观锁）
   * @returns {boolean} 是否成功
   */
  setWithVersion(key, value, expectedVersion) {
    try {
      if (!this.options.enableVersioning) {
        this.set(key, value)
        return true
      }

      const versionKey = this.getVersionKey(key)
      const currentVersion = parseInt(localStorage.getItem(versionKey) || '0')

      // 如果指定了期望版本，检查版本冲突
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        console.warn(`版本冲突 [${key}]: 期望=${expectedVersion}, 当前=${currentVersion}`)
        return false
      }

      const newVersion = currentVersion + 1
      const timestamp = Date.now()

      // 设置数据
      this.set(key, value)

      // 更新版本信息
      localStorage.setItem(versionKey, newVersion.toString())
      localStorage.setItem(versionKey + '_ts', timestamp.toString())

      return true
    } catch (error) {
      console.error(`设置版本化数据失败 [${key}]:`, error)
      return false
    }
  }

  // ========== 事务操作 ==========

  /**
   * 开始事务
   * @returns {string} 事务ID
   */
  beginTransaction() {
    if (this.currentTransaction) {
      throw new Error('已有事务正在进行中')
    }

    this.currentTransaction = {
      id: this.generateTransactionId(),
      operations: [],
      timestamp: Date.now(),
      status: 'pending'
    }

    return this.currentTransaction.id
  }

  /**
   * 提交事务
   * @param {string} transactionId - 事务ID
   */
  commit(transactionId) {
    if (!this.currentTransaction) {
      throw new Error('没有正在进行的事务')
    }

    if (this.currentTransaction.id !== transactionId) {
      throw new Error('事务ID不匹配')
    }

    try {
      // 执行事务
      this.executeTransaction(this.currentTransaction)

      // 清除当前事务
      this.currentTransaction = null

    } catch (error) {
      // 回滚事务
      this.rollback(transactionId)
      throw error
    }
  }

  /**
   * 回滚事务
   * @param {string} transactionId - 事务ID
   */
  rollback(transactionId) {
    if (!this.currentTransaction) {
      throw new Error('没有正在进行的事务')
    }

    if (this.currentTransaction.id !== transactionId) {
      throw new Error('事务ID不匹配')
    }

    // 标记为已回滚
    this.currentTransaction.status = 'rolled_back'

    // 记录到日志
    if (this.options.enableTransactionLog) {
      this.logTransaction(this.currentTransaction)
    }

    // 清除当前事务
    this.currentTransaction = null
  }

  /**
   * 创建事务对象
   * @private
   */
  createTransaction(operations) {
    return {
      id: this.generateTransactionId(),
      operations,
      timestamp: Date.now(),
      status: 'pending'
    }
  }

  /**
   * 执行事务
   * @private
   */
  executeTransaction(transaction) {
    try {
      // 记录到日志（pending状态）
      if (this.options.enableTransactionLog) {
        this.logTransaction(transaction)
      }

      // 执行所有操作
      for (const operation of transaction.operations) {
        if (operation.type === 'set') {
          localStorage.setItem(operation.key, JSON.stringify(operation.value))
          
          // 更新版本
          if (this.options.enableVersioning) {
            const versionKey = this.getVersionKey(operation.key.replace(this.options.prefix, ''))
            const currentVersion = parseInt(localStorage.getItem(versionKey) || '0')
            localStorage.setItem(versionKey, (currentVersion + 1).toString())
            localStorage.setItem(versionKey + '_ts', Date.now().toString())
          }
        } else if (operation.type === 'delete') {
          localStorage.removeItem(operation.key)
          
          // 删除版本信息
          if (this.options.enableVersioning) {
            const versionKey = this.getVersionKey(operation.key.replace(this.options.prefix, ''))
            localStorage.removeItem(versionKey)
            localStorage.removeItem(versionKey + '_ts')
          }
        }
      }

      // 标记为已提交
      transaction.status = 'committed'

      // 更新日志
      if (this.options.enableTransactionLog) {
        this.updateTransactionStatus(transaction.id, 'committed')
      }

    } catch (error) {
      // 标记为已回滚
      transaction.status = 'rolled_back'

      // 更新日志
      if (this.options.enableTransactionLog) {
        this.updateTransactionStatus(transaction.id, 'rolled_back')
      }

      // 尝试回滚已执行的操作
      this.rollbackOperations(transaction.operations)

      throw error
    }
  }

  /**
   * 回滚操作
   * @private
   */
  rollbackOperations(operations) {
    try {
      // 反向执行操作
      for (let i = operations.length - 1; i >= 0; i--) {
        const operation = operations[i]
        
        if (operation.type === 'set') {
          // 恢复之前的值
          if (operation.previousValue !== undefined && operation.previousValue !== null) {
            localStorage.setItem(operation.key, JSON.stringify(operation.previousValue))
          } else {
            localStorage.removeItem(operation.key)
          }
        } else if (operation.type === 'delete') {
          // 恢复删除的值
          if (operation.previousValue !== undefined && operation.previousValue !== null) {
            localStorage.setItem(operation.key, JSON.stringify(operation.previousValue))
          }
        }
      }
    } catch (error) {
      console.error('回滚操作失败:', error)
    }
  }

  // ========== 事务日志 ==========

  /**
   * 记录事务到日志
   * @private
   */
  logTransaction(transaction) {
    try {
      const log = this.getTransactionLog()
      
      // 添加新事务
      log.push({
        id: transaction.id,
        operationCount: transaction.operations.length,
        timestamp: transaction.timestamp,
        status: transaction.status
      })

      // 限制日志大小
      if (log.length > this.options.maxTransactionLogSize) {
        log.shift()
      }

      // 保存日志
      localStorage.setItem(
        this.options.transactionLogKey,
        JSON.stringify(log)
      )
    } catch (error) {
      console.error('记录事务日志失败:', error)
    }
  }

  /**
   * 更新事务状态
   * @private
   */
  updateTransactionStatus(transactionId, status) {
    try {
      const log = this.getTransactionLog()
      const transaction = log.find(t => t.id === transactionId)
      
      if (transaction) {
        transaction.status = status
        localStorage.setItem(
          this.options.transactionLogKey,
          JSON.stringify(log)
        )
      }
    } catch (error) {
      console.error('更新事务状态失败:', error)
    }
  }

  /**
   * 获取事务日志
   * @returns {Array<StorageTransaction>}
   */
  getTransactionLog() {
    try {
      const data = localStorage.getItem(this.options.transactionLogKey)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('获取事务日志失败:', error)
      return []
    }
  }

  /**
   * 清理pending事务
   * @private
   */
  cleanupPendingTransactions() {
    try {
      const log = this.getTransactionLog()
      const now = Date.now()
      const timeout = 60000 // 1分钟

      // 标记超时的pending事务为rolled_back
      let updated = false
      for (const transaction of log) {
        if (transaction.status === 'pending' && now - transaction.timestamp > timeout) {
          transaction.status = 'rolled_back'
          updated = true
        }
      }

      if (updated) {
        localStorage.setItem(
          this.options.transactionLogKey,
          JSON.stringify(log)
        )
      }
    } catch (error) {
      console.error('清理pending事务失败:', error)
    }
  }

  // ========== 数据完整性验证 ==========

  /**
   * 验证数据完整性
   * @returns {Object} 验证结果
   */
  verifyIntegrity() {
    const errors = []

    try {
      // 检查孤立的版本记录
      if (this.options.enableVersioning) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          
          if (key && key.startsWith(this.options.versionPrefix)) {
            const dataKey = key.replace(this.options.versionPrefix, this.options.prefix)
            if (!localStorage.getItem(dataKey)) {
              errors.push(`孤立的版本记录: ${key}`)
            }
          }
        }
      }

      // 检查pending事务
      const log = this.getTransactionLog()
      const pendingTransactions = log.filter(t => t.status === 'pending')
      if (pendingTransactions.length > 0) {
        errors.push(`发现 ${pendingTransactions.length} 个pending事务`)
      }

    } catch (error) {
      errors.push(`完整性验证失败: ${error.message}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 从事务日志恢复
   * @param {string} transactionId - 事务ID
   */
  recoverFromLog(transactionId) {
    // 注意：这个方法需要完整的事务操作记录才能恢复
    // 当前简化版本只记录了事务元数据，不记录完整操作
    console.warn('事务恢复功能需要完整的操作记录')
  }

  /**
   * 清除所有数据
   */
  clear() {
    try {
      const keysToRemove = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (
          key.startsWith(this.options.prefix) ||
          key.startsWith(this.options.versionPrefix)
        )) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))
      
    } catch (error) {
      console.error('清除数据失败:', error)
      throw error
    }
  }
}

// 创建单例实例
let atomicStorageInstance = null

/**
 * 获取AtomicStorage单例实例
 * @param {Object} [options] - 配置选项
 * @returns {AtomicStorage}
 */
export function getAtomicStorage(options) {
  if (!atomicStorageInstance) {
    atomicStorageInstance = new AtomicStorage(options)
  }
  return atomicStorageInstance
}

/**
 * 重置AtomicStorage实例（用于测试）
 */
export function resetAtomicStorage() {
  atomicStorageInstance = null
}

export default AtomicStorage

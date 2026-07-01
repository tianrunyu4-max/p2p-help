/**
 * IntegrityChecker - 数据完整性验证器
 * 
 * 功能：
 * - 启动时完整性检查
 * - 从事务日志自动恢复
 * - 孤立数据检测
 * - 数据修复
 */

import { getAtomicStorage } from './AtomicStorage.js'

/**
 * 完整性检查结果
 * @typedef {Object} IntegrityCheckResult
 * @property {boolean} isValid - 是否有效
 * @property {Array<string>} errors - 错误列表
 * @property {Array<string>} warnings - 警告列表
 * @property {Object} stats - 统计信息
 */

export class IntegrityChecker {
  constructor(storage) {
    this.storage = storage || getAtomicStorage()
    this.checkHistory = []
    this.maxHistorySize = 20
  }

  /**
   * 执行完整性检查
   * @returns {IntegrityCheckResult}
   */
  check() {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: {
        totalKeys: 0,
        orphanedVersions: 0,
        pendingTransactions: 0,
        corruptedData: 0
      },
      timestamp: Date.now()
    }

    try {
      // 1. 检查孤立的版本记录
      this.checkOrphanedVersions(result)

      // 2. 检查pending事务
      this.checkPendingTransactions(result)

      // 3. 检查数据损坏
      this.checkCorruptedData(result)

      // 4. 统计总键数
      result.stats.totalKeys = this.countTotalKeys()

      // 判断是否有效
      result.isValid = result.errors.length === 0

    } catch (error) {
      result.errors.push(`完整性检查失败: ${error.message}`)
      result.isValid = false
    }

    // 记录检查历史
    this.recordCheck(result)

    return result
  }

  /**
   * 检查孤立的版本记录
   * @private
   */
  checkOrphanedVersions(result) {
    try {
      const versionPrefix = this.storage.options.versionPrefix
      const dataPrefix = this.storage.options.prefix

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        
        if (key && key.startsWith(versionPrefix)) {
          // 检查对应的数据是否存在
          const dataKey = key.replace(versionPrefix, dataPrefix)
          if (!localStorage.getItem(dataKey)) {
            result.errors.push(`孤立的版本记录: ${key}`)
            result.stats.orphanedVersions++
          }
        }
      }
    } catch (error) {
      result.warnings.push(`检查孤立版本失败: ${error.message}`)
    }
  }

  /**
   * 检查pending事务
   * @private
   */
  checkPendingTransactions(result) {
    try {
      const log = this.storage.getTransactionLog()
      const now = Date.now()
      const timeout = 60000 // 1分钟

      for (const transaction of log) {
        if (transaction.status === 'pending') {
          const age = now - transaction.timestamp
          
          if (age > timeout) {
            result.errors.push(
              `超时的pending事务: ${transaction.id} (${Math.round(age / 1000)}秒)`
            )
          } else {
            result.warnings.push(
              `pending事务: ${transaction.id} (${Math.round(age / 1000)}秒)`
            )
          }
          
          result.stats.pendingTransactions++
        }
      }
    } catch (error) {
      result.warnings.push(`检查pending事务失败: ${error.message}`)
    }
  }

  /**
   * 检查数据损坏
   * @private
   */
  checkCorruptedData(result) {
    try {
      const dataPrefix = this.storage.options.prefix

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        
        if (key && key.startsWith(dataPrefix)) {
          try {
            const data = localStorage.getItem(key)
            if (data) {
              JSON.parse(data) // 尝试解析
            }
          } catch (parseError) {
            result.errors.push(`数据损坏: ${key}`)
            result.stats.corruptedData++
          }
        }
      }
    } catch (error) {
      result.warnings.push(`检查数据损坏失败: ${error.message}`)
    }
  }

  /**
   * 统计总键数
   * @private
   */
  countTotalKeys() {
    let count = 0
    const dataPrefix = this.storage.options.prefix

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(dataPrefix)) {
        count++
      }
    }

    return count
  }

  /**
   * 自动修复
   * @returns {Object} 修复结果
   */
  autoRepair() {
    const repairResult = {
      success: false,
      repaired: [],
      failed: [],
      timestamp: Date.now()
    }

    try {
      // 1. 清理孤立的版本记录
      this.repairOrphanedVersions(repairResult)

      // 2. 清理超时的pending事务
      this.repairPendingTransactions(repairResult)

      // 3. 删除损坏的数据
      this.repairCorruptedData(repairResult)

      repairResult.success = repairResult.failed.length === 0

    } catch (error) {
      repairResult.failed.push(`自动修复失败: ${error.message}`)
    }

    return repairResult
  }

  /**
   * 修复孤立的版本记录
   * @private
   */
  repairOrphanedVersions(repairResult) {
    try {
      const versionPrefix = this.storage.options.versionPrefix
      const dataPrefix = this.storage.options.prefix

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        
        if (key && key.startsWith(versionPrefix)) {
          const dataKey = key.replace(versionPrefix, dataPrefix)
          if (!localStorage.getItem(dataKey)) {
            try {
              localStorage.removeItem(key)
              localStorage.removeItem(key + '_ts')
              repairResult.repaired.push(`删除孤立版本: ${key}`)
            } catch (error) {
              repairResult.failed.push(`删除孤立版本失败: ${key}`)
            }
          }
        }
      }
    } catch (error) {
      repairResult.failed.push(`修复孤立版本失败: ${error.message}`)
    }
  }

  /**
   * 修复pending事务
   * @private
   */
  repairPendingTransactions(repairResult) {
    try {
      const log = this.storage.getTransactionLog()
      const now = Date.now()
      const timeout = 60000 // 1分钟
      let updated = false

      for (const transaction of log) {
        if (transaction.status === 'pending') {
          const age = now - transaction.timestamp
          
          if (age > timeout) {
            transaction.status = 'rolled_back'
            updated = true
            repairResult.repaired.push(`回滚超时事务: ${transaction.id}`)
          }
        }
      }

      if (updated) {
        localStorage.setItem(
          this.storage.options.transactionLogKey,
          JSON.stringify(log)
        )
      }
    } catch (error) {
      repairResult.failed.push(`修复pending事务失败: ${error.message}`)
    }
  }

  /**
   * 修复损坏的数据
   * @private
   */
  repairCorruptedData(repairResult) {
    try {
      const dataPrefix = this.storage.options.prefix
      const keysToRemove = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        
        if (key && key.startsWith(dataPrefix)) {
          try {
            const data = localStorage.getItem(key)
            if (data) {
              JSON.parse(data)
            }
          } catch (parseError) {
            keysToRemove.push(key)
          }
        }
      }

      // 删除损坏的数据
      for (const key of keysToRemove) {
        try {
          localStorage.removeItem(key)
          
          // 同时删除版本信息
          const versionKey = key.replace(dataPrefix, this.storage.options.versionPrefix)
          localStorage.removeItem(versionKey)
          localStorage.removeItem(versionKey + '_ts')
          
          repairResult.repaired.push(`删除损坏数据: ${key}`)
        } catch (error) {
          repairResult.failed.push(`删除损坏数据失败: ${key}`)
        }
      }
    } catch (error) {
      repairResult.failed.push(`修复损坏数据失败: ${error.message}`)
    }
  }

  /**
   * 从事务日志恢复
   * @param {string} [transactionId] - 事务ID（可选，不指定则恢复所有失败事务）
   * @returns {Object} 恢复结果
   */
  recoverFromLog(transactionId) {
    const recoverResult = {
      success: false,
      recovered: [],
      failed: [],
      timestamp: Date.now()
    }

    try {
      const log = this.storage.getTransactionLog()

      // 如果指定了事务ID，只恢复该事务
      if (transactionId) {
        const transaction = log.find(t => t.id === transactionId)
        if (transaction && transaction.status === 'rolled_back') {
          recoverResult.failed.push(`无法恢复已回滚的事务: ${transactionId}`)
        } else if (!transaction) {
          recoverResult.failed.push(`事务不存在: ${transactionId}`)
        } else {
          recoverResult.failed.push(`事务恢复需要完整的操作记录`)
        }
      } else {
        // 恢复所有失败的事务
        recoverResult.failed.push(`批量恢复需要完整的操作记录`)
      }

      recoverResult.success = recoverResult.failed.length === 0

    } catch (error) {
      recoverResult.failed.push(`恢复失败: ${error.message}`)
    }

    return recoverResult
  }

  /**
   * 记录检查历史
   * @private
   */
  recordCheck(result) {
    this.checkHistory.push({
      timestamp: result.timestamp,
      isValid: result.isValid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    })

    // 限制历史大小
    if (this.checkHistory.length > this.maxHistorySize) {
      this.checkHistory.shift()
    }
  }

  /**
   * 获取检查历史
   * @param {number} [limit=10] - 返回的历史数量
   * @returns {Array}
   */
  getCheckHistory(limit = 10) {
    return this.checkHistory.slice(-limit)
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const recentChecks = this.checkHistory.slice(-10)
    const failedChecks = recentChecks.filter(c => !c.isValid).length

    return {
      totalChecks: this.checkHistory.length,
      recentChecks: recentChecks.length,
      failedChecks,
      successRate: recentChecks.length > 0 
        ? ((recentChecks.length - failedChecks) / recentChecks.length * 100).toFixed(2) + '%'
        : 'N/A'
    }
  }
}

// 创建单例实例
let integrityCheckerInstance = null

/**
 * 获取IntegrityChecker单例实例
 * @param {Object} [storage] - 存储实例
 * @returns {IntegrityChecker}
 */
export function getIntegrityChecker(storage) {
  if (!integrityCheckerInstance) {
    integrityCheckerInstance = new IntegrityChecker(storage)
  }
  return integrityCheckerInstance
}

/**
 * 重置IntegrityChecker实例（用于测试）
 */
export function resetIntegrityChecker() {
  integrityCheckerInstance = null
}

/**
 * 在应用启动时执行完整性检查
 * @param {boolean} [autoRepair=true] - 是否自动修复
 * @returns {Promise<Object>}
 */
export async function checkIntegrityOnStartup(autoRepair = true) {
  const checker = getIntegrityChecker()
  
  console.log('执行启动完整性检查...')
  const checkResult = checker.check()

  if (!checkResult.isValid) {
    console.warn('发现数据完整性问题:', checkResult)

    if (autoRepair) {
      console.log('尝试自动修复...')
      const repairResult = checker.autoRepair()
      
      if (repairResult.success) {
        console.log('自动修复成功:', repairResult)
        
        // 再次检查
        const recheckResult = checker.check()
        return {
          initialCheck: checkResult,
          repair: repairResult,
          finalCheck: recheckResult
        }
      } else {
        console.error('自动修复失败:', repairResult)
        return {
          initialCheck: checkResult,
          repair: repairResult
        }
      }
    }
  } else {
    console.log('数据完整性检查通过')
  }

  return {
    initialCheck: checkResult
  }
}

export default IntegrityChecker

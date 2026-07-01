/**
 * ConflictResolver - 数据冲突解决器
 * 
 * 功能：
 * - Last-Write-Wins策略
 * - 冲突检测
 * - 版本比较
 */

/**
 * 版本化数据
 * @typedef {Object} VersionedData
 * @property {*} value - 数据值
 * @property {number} version - 版本号
 * @property {number} timestamp - 时间戳
 * @property {string} [source] - 数据来源（tab/session标识）
 */

/**
 * 冲突解决策略
 */
export const ConflictStrategy = {
  LAST_WRITE_WINS: 'last_write_wins',  // 最后写入获胜
  HIGHEST_VERSION: 'highest_version',   // 最高版本获胜
  MANUAL: 'manual'                      // 手动解决
}

export class ConflictResolver {
  constructor(strategy = ConflictStrategy.LAST_WRITE_WINS) {
    this.strategy = strategy
    this.conflictLog = []
    this.maxLogSize = 50
  }

  /**
   * 解决冲突
   * @param {VersionedData} local - 本地数据
   * @param {VersionedData} remote - 远程数据
   * @returns {VersionedData} 解决后的数据
   */
  resolve(local, remote) {
    // 检测冲突
    const hasConflict = this.detectConflict(local, remote)

    if (hasConflict) {
      // 记录冲突
      this.logConflict(local, remote)
    }

    // 根据策略解决
    switch (this.strategy) {
      case ConflictStrategy.LAST_WRITE_WINS:
        return this.resolveLastWriteWins(local, remote)
      
      case ConflictStrategy.HIGHEST_VERSION:
        return this.resolveHighestVersion(local, remote)
      
      case ConflictStrategy.MANUAL:
        throw new Error('需要手动解决冲突')
      
      default:
        return this.resolveLastWriteWins(local, remote)
    }
  }

  /**
   * Last-Write-Wins策略
   * @private
   */
  resolveLastWriteWins(local, remote) {
    // 比较时间戳
    if (remote.timestamp > local.timestamp) {
      return remote
    }

    // 如果时间戳相同，比较版本号
    if (remote.timestamp === local.timestamp) {
      return remote.version > local.version ? remote : local
    }

    return local
  }

  /**
   * Highest-Version策略
   * @private
   */
  resolveHighestVersion(local, remote) {
    // 比较版本号
    if (remote.version > local.version) {
      return remote
    }

    // 如果版本号相同，比较时间戳
    if (remote.version === local.version) {
      return remote.timestamp > local.timestamp ? remote : local
    }

    return local
  }

  /**
   * 检测冲突
   * @param {VersionedData} local - 本地数据
   * @param {VersionedData} remote - 远程数据
   * @returns {boolean} 是否存在冲突
   */
  detectConflict(local, remote) {
    // 版本不同且时间戳接近（1秒内）认为是冲突
    const versionDifferent = local.version !== remote.version
    const timestampClose = Math.abs(local.timestamp - remote.timestamp) < 1000

    return versionDifferent && timestampClose
  }

  /**
   * 记录冲突
   * @private
   */
  logConflict(local, remote) {
    const conflictEntry = {
      timestamp: Date.now(),
      local: {
        version: local.version,
        timestamp: local.timestamp,
        source: local.source
      },
      remote: {
        version: remote.version,
        timestamp: remote.timestamp,
        source: remote.source
      },
      resolution: this.strategy
    }

    this.conflictLog.push(conflictEntry)

    // 限制日志大小
    if (this.conflictLog.length > this.maxLogSize) {
      this.conflictLog.shift()
    }

    console.warn('检测到数据冲突:', conflictEntry)
  }

  /**
   * 获取冲突日志
   * @param {number} [limit=10] - 返回的日志数量
   * @returns {Array}
   */
  getConflictLog(limit = 10) {
    return this.conflictLog.slice(-limit)
  }

  /**
   * 清除冲突日志
   */
  clearConflictLog() {
    this.conflictLog = []
  }

  /**
   * 获取冲突统计
   * @returns {Object}
   */
  getStats() {
    return {
      totalConflicts: this.conflictLog.length,
      recentConflicts: this.conflictLog.slice(-5)
    }
  }

  /**
   * 设置解决策略
   * @param {string} strategy - 策略名称
   */
  setStrategy(strategy) {
    if (!Object.values(ConflictStrategy).includes(strategy)) {
      throw new Error(`无效的冲突解决策略: ${strategy}`)
    }
    this.strategy = strategy
  }
}

// 创建单例实例
let conflictResolverInstance = null

/**
 * 获取ConflictResolver单例实例
 * @param {string} [strategy] - 解决策略
 * @returns {ConflictResolver}
 */
export function getConflictResolver(strategy) {
  if (!conflictResolverInstance) {
    conflictResolverInstance = new ConflictResolver(strategy)
  }
  return conflictResolverInstance
}

/**
 * 重置ConflictResolver实例（用于测试）
 */
export function resetConflictResolver() {
  conflictResolverInstance = null
}

export default ConflictResolver

/**
 * 分红服务
 * 
 * 处理团队分红和全网分红的计算与结算
 * 
 * 分红规则：
 * - 团队分红(10%)：伞下6代业绩，分给伞下达标人
 * - 全网分红(12%)：全网业绩，分给所有达标年卡
 * 
 * 资格要求：
 * - 半年卡：直推5人 → 获团队分红
 * - 年卡：直推5人 → 获团队分红 + 全网分红
 */

import { getRewardConfig, CARD_TYPES } from '../config/rewardConfig.js'

class DividendService {
    constructor() {
        this.storageKey = 'dividend_pool'
        this.historyKey = 'dividend_history'
        this.config = getRewardConfig()

        // 今日分红池
        this.todayPool = this.loadTodayPool()
    }

    // ==================== 数据存储 ====================

    /**
     * 加载今日分红池
     */
    loadTodayPool() {
        try {
            const saved = localStorage.getItem(this.storageKey)
            if (saved) {
                const pool = JSON.parse(saved)
                // 检查是否是今日的数据
                if (pool.date === this.getTodayDate()) {
                    return pool
                }
            }
        } catch (e) {
            console.error('加载分红池失败:', e)
        }

        // 返回新的今日池
        return this.createEmptyPool()
    }

    /**
     * 创建空的分红池
     */
    createEmptyPool() {
        return {
            date: this.getTodayDate(),
            // 全网分红池
            globalPool: 0,
            globalOrders: [],
            // 团队分红池（按用户ID分组）
            teamPools: {},
            // 统计
            totalOrders: 0,
            totalAmount: 0
        }
    }

    /**
     * 保存分红池
     */
    saveTodayPool() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.todayPool))
        } catch (e) {
            console.error('保存分红池失败:', e)
        }
    }

    /**
     * 获取今日日期字符串
     */
    getTodayDate() {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    }

    // ==================== 订单处理 ====================

    /**
     * 处理新订单（每单都调用）
     * @param {Object} order - 订单信息
     * @param {string} order.userId - 购买用户ID
     * @param {string} order.cardType - 卡类型
     * @param {number} order.amount - 订单金额
     * @param {Array} order.upline6 - 上级6代用户ID列表
     */
    processOrder(order) {
        const { userId, cardType, amount, upline6 = [] } = order
        const rates = this.config.getBonusRates()

        // 计算分红金额
        const teamDividendAmount = amount * rates.teamDividend      // 10%
        const globalDividendAmount = amount * rates.globalDividend  // 12%

        // 1. 添加到全网分红池
        this.todayPool.globalPool += globalDividendAmount
        this.todayPool.globalOrders.push({
            userId,
            cardType,
            amount: globalDividendAmount,
            time: Date.now()
        })

        // 2. 添加到团队分红池（上级6代每人的池子）
        upline6.forEach((referrerId, index) => {
            if (!this.todayPool.teamPools[referrerId]) {
                this.todayPool.teamPools[referrerId] = {
                    pool: 0,
                    orders: []
                }
            }
            this.todayPool.teamPools[referrerId].pool += teamDividendAmount
            this.todayPool.teamPools[referrerId].orders.push({
                userId,
                cardType,
                amount: teamDividendAmount,
                level: index + 1,
                time: Date.now()
            })
        })

        // 3. 更新统计
        this.todayPool.totalOrders++
        this.todayPool.totalAmount += amount

        // 保存
        this.saveTodayPool()

        return {
            teamDividendAmount,
            globalDividendAmount
        }
    }

    // ==================== 分红计算 ====================

    /**
     * 检查用户是否有分红资格
     * @param {Object} user - 用户对象
     * @returns {Object} 资格信息
     */
    checkDividendQualification(user) {
        if (!user) {
            return { teamQualified: false, globalQualified: false }
        }

        const requirements = this.config.getConfig().dividendRequirements
        const cardConfig = this.config.getCardConfig(user.cardType)
        const directPushCount = user.directPushCount || 0

        // 直推满5人
        const hasEnoughDirectPush = directPushCount >= requirements.minDirectPush

        // 团队分红资格：半年卡或年卡 + 直推满5人
        const teamQualified = hasEnoughDirectPush && cardConfig?.canTeamDividend

        // 全网分红资格：年卡 + 直推满5人
        const globalQualified = hasEnoughDirectPush && cardConfig?.canGlobalDividend

        return {
            teamQualified,
            globalQualified,
            directPushCount,
            needMore: Math.max(0, requirements.minDirectPush - directPushCount)
        }
    }

    /**
     * 获取用户的团队分红池金额
     * @param {string} userId - 用户ID
     * @returns {number} 池中金额
     */
    getTeamPoolAmount(userId) {
        return this.todayPool.teamPools[userId]?.pool || 0
    }

    /**
     * 获取全网分红池金额
     * @returns {number} 池中金额
     */
    getGlobalPoolAmount() {
        return this.todayPool.globalPool
    }

    /**
     * 计算团队分红（凌晨12点结算用）
     * @param {string} userId - 用户ID
     * @param {Array} teamQualifiedUsers - 该用户伞下6代达标人列表
     * @returns {Object} 分红结果
     */
    calculateTeamDividend(userId, teamQualifiedUsers) {
        const pool = this.getTeamPoolAmount(userId)

        if (pool <= 0 || teamQualifiedUsers.length === 0) {
            return { pool: 0, perPerson: 0, recipients: [] }
        }

        const perPerson = Math.floor(pool / teamQualifiedUsers.length * 100) / 100

        return {
            pool,
            perPerson,
            recipients: teamQualifiedUsers,
            count: teamQualifiedUsers.length
        }
    }

    /**
     * 计算全网分红（凌晨12点结算用）
     * @param {Array} globalQualifiedUsers - 全网达标年卡用户列表
     * @returns {Object} 分红结果
     */
    calculateGlobalDividend(globalQualifiedUsers) {
        const pool = this.getGlobalPoolAmount()

        if (pool <= 0 || globalQualifiedUsers.length === 0) {
            return { pool: 0, perPerson: 0, recipients: [] }
        }

        const perPerson = Math.floor(pool / globalQualifiedUsers.length * 100) / 100

        return {
            pool,
            perPerson,
            recipients: globalQualifiedUsers,
            count: globalQualifiedUsers.length
        }
    }

    // ==================== 结算处理 ====================

    /**
     * 执行每日结算（凌晨12点调用）
     * @param {Object} system - 太极系统实例
     * @returns {Object} 结算结果
     */
    async settleDailyDividend(system) {
        const results = {
            date: this.getTodayDate(),
            teamSettlements: [],
            globalSettlement: null,
            totalDistributed: 0
        }

        // 1. 获取所有达标用户
        const allUsers = Array.from(system.users.values())
        const globalQualifiedUsers = []

        allUsers.forEach(user => {
            const qualification = this.checkDividendQualification(user)
            if (qualification.globalQualified) {
                globalQualifiedUsers.push(user)
            }
        })

        // 2. 计算全网分红
        const globalResult = this.calculateGlobalDividend(globalQualifiedUsers)
        if (globalResult.perPerson > 0) {
            results.globalSettlement = globalResult

            // 发放全网分红
            globalQualifiedUsers.forEach(user => {
                user.globalDividendEarnings = (user.globalDividendEarnings || 0) + globalResult.perPerson
                user.totalEarnings = (user.totalEarnings || 0) + globalResult.perPerson
                results.totalDistributed += globalResult.perPerson
            })
        }

        // 3. 计算每个人的团队分红
        for (const userId of Object.keys(this.todayPool.teamPools)) {
            // 获取该用户伞下6代的达标人
            const teamQualified = this.getTeamQualifiedUsers(userId, system)
            const teamResult = this.calculateTeamDividend(userId, teamQualified)

            if (teamResult.perPerson > 0) {
                results.teamSettlements.push({
                    poolOwnerId: userId,
                    ...teamResult
                })

                // 发放团队分红
                teamQualified.forEach(user => {
                    user.teamDividendEarnings = (user.teamDividendEarnings || 0) + teamResult.perPerson
                    user.totalEarnings = (user.totalEarnings || 0) + teamResult.perPerson
                    results.totalDistributed += teamResult.perPerson
                })
            }
        }

        // 4. 保存结算记录
        this.saveDividendHistory(results)

        // 5. 重置分红池（明天重新累计）
        this.todayPool = this.createEmptyPool()
        this.saveTodayPool()

        return results
    }

    /**
     * 获取用户伞下6代的达标用户
     * @param {string} userId - 用户ID
     * @param {Object} system - 太极系统实例
     * @returns {Array} 达标用户列表
     */
    getTeamQualifiedUsers(userId, system) {
        const qualified = []
        const requirements = this.config.getConfig().dividendRequirements
        const maxDepth = requirements.teamDepth

        // 递归查找伞下用户
        const findDownline = (referrerId, depth) => {
            if (depth > maxDepth) return

            system.users.forEach(user => {
                if (user.referrerId === referrerId) {
                    const qualification = this.checkDividendQualification(user)
                    if (qualification.teamQualified) {
                        qualified.push(user)
                    }
                    // 继续往下找
                    findDownline(user.id, depth + 1)
                }
            })
        }

        findDownline(userId, 1)
        return qualified
    }

    /**
     * 保存分红历史
     */
    saveDividendHistory(record) {
        try {
            const history = JSON.parse(localStorage.getItem(this.historyKey) || '[]')
            history.unshift(record)
            // 只保留最近30天
            if (history.length > 30) {
                history.length = 30
            }
            localStorage.setItem(this.historyKey, JSON.stringify(history))
        } catch (e) {
            console.error('保存分红历史失败:', e)
        }
    }

    /**
     * 获取分红历史
     */
    getDividendHistory(limit = 10) {
        try {
            const history = JSON.parse(localStorage.getItem(this.historyKey) || '[]')
            return history.slice(0, limit)
        } catch (e) {
            return []
        }
    }

    // ==================== 统计查询 ====================

    /**
     * 获取今日分红池统计
     */
    getTodayStats() {
        return {
            date: this.todayPool.date,
            globalPool: this.todayPool.globalPool,
            teamPoolTotal: Object.values(this.todayPool.teamPools)
                .reduce((sum, p) => sum + p.pool, 0),
            totalOrders: this.todayPool.totalOrders,
            totalAmount: this.todayPool.totalAmount
        }
    }
}

// ==================== 单例导出 ====================
let dividendServiceInstance = null

export function getDividendService() {
    if (!dividendServiceInstance) {
        dividendServiceInstance = new DividendService()
    }
    return dividendServiceInstance
}

export default DividendService

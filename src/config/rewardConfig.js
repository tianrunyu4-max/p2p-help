/**
 * 奖励系统统一配置中心
 *
 * 订阅档位系统（三档）：
 *   V1(BASIC,50) → V2(PREMIUM,100) → V3(ELITE,200，顶档)
 *
 * 签到逻辑：
 *   V1(BASIC)：无签到收益
 *   V2(PREMIUM,100)=+5积分/天
 *   V3(ELITE,200)=+10积分/天
 *
 * 见点奖：统一 20%
 * 平级奖：统一 10%，6代；分配：70%到学分 / 20%锁定复投池 / 10%锁定日分润池
 * 自动升级链：V1→V2→V3（V3为顶档，满50循环复投）
 * 购物金：已暂停，不再累积
 */

// ==================== 卡类型常量 ====================
export const CARD_TYPES = {
    BASIC:   'BASIC',
    PREMIUM: 'PREMIUM',
    ELITE:   'ELITE',
}

// 档位顺序
export const TIER_ORDER = ['BASIC', 'PREMIUM', 'ELITE']

// 分润利率（无复利，全部为 null）
export const PROFIT_RATES = {}

// 升级池阈值
export const REINVEST_THRESHOLD = {
    BASIC:   100,  // V1满100→V2
    PREMIUM: 200,  // V2满200→V3
    ELITE:   null  // 顶档，满50循环复投
}

// 签到积分：V2(100)+5积分/天；V3(200)+10积分/天；100积分=1（内部计价单位）
export const DAILY_CHECKIN_POINTS = {
    PREMIUM: 5,   // V2（100档）
    ELITE:   10,  // V3（200档）
    DEFAULT: 0
}

// ==================== 默认配置 ====================
const DEFAULT_CONFIG = {
    cards: {
        BASIC: {
            name: 'V1(50)', price: 50,
            duration: Infinity, hasDividendRight: true,
            dailyCheckin: 0, reinvestThreshold: 100,
            profitRate: null
        },
        PREMIUM: {
            name: 'V2(100)', price: 100,
            duration: Infinity, hasDividendRight: true,
            dailyCheckin: 5, reinvestThreshold: 200,
            profitRate: null
        },
        ELITE: {
            name: 'V3(200)', price: 200,
            duration: Infinity, hasDividendRight: true,
            dailyCheckin: 10, reinvestThreshold: null,
            profitRate: null  // 顶档，满50循环复投
        },
    },

    bonusRates: {
        spotBonus: 0.20,
        levelBonus: 0.06,
        levelGenerations: 6,
        teamDividend: 0.10,
        globalDividend: 0.10
    },

    dividendRequirements: {
        minDirectPush: 3,
        minTeamSize: 3,  // 3个直推均为ELITE满档
        teamDepth: 6
    },

    // 平级奖分配：70%到学分 / 20%锁定复投池 / 10%锁定日分润池(直推分润来源)
    levelBonusDistribution: {
        withdrawable:   0.70,
        lockedReinvest: 0.20,
        shoppingGold:   0,      // 购物金已暂停
        subsidyPool:    0.10    // 锁定日分润池
    },

    spotBonusDistribution: {
        withdrawable: 1.0,
        locked: 0
    },

    checkin: {
        withSlippage: 3,
        noSlippage: 1
    }
}

// ==================== 配置管理器 ====================
class RewardConfigManager {
    constructor() {
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
    }

    loadConfig() { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) }

    mergeConfig(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {}
                this.mergeConfig(target[key], source[key])
            } else {
                target[key] = source[key]
            }
        }
    }

    saveConfig() {
        console.warn('[rewardConfig] 前端不允许覆盖奖励配置')
        return { success: false }
    }

    resetToDefault() {
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
        return { success: true }
    }

    getConfig()        { return this.config }
    getDefaultConfig() { return DEFAULT_CONFIG }

    // ==================== 卡类型 ====================
    getCardConfig(cardType) { return this.config.cards[cardType] || null }
    getCardPrice(cardType)  { return this.getCardConfig(cardType)?.price  || 0 }
    getCardName(cardType)   { return this.getCardConfig(cardType)?.name   || cardType }
    getCardDays(cardType)   { return this.getCardConfig(cardType)?.duration || 0 }
    getAllCardTypes()        { return Object.keys(this.config.cards) }

    /** 是否有分润（60档及以上） */
    hasProfitRate(cardType) {
        return !!(this.getCardConfig(cardType)?.profitRate)
    }

    /** 获取日利率 */
    getProfitRate(cardType) {
        return this.getCardConfig(cardType)?.profitRate || 0
    }

    // ==================== 奖励计算 ====================
    getSpotBonusAmount(cardType) {
        return Math.floor(this.getCardPrice(cardType) * this.config.bonusRates.spotBonus * 100) / 100
    }
    getLevelBonusAmount(cardType) {
        return Math.floor(this.getCardPrice(cardType) * this.config.bonusRates.levelBonus * 100) / 100
    }
    getLevelGenerations()       { return this.config.bonusRates.levelGenerations }
    getTotalLevelBonus(cardType){ return Math.floor(this.getLevelBonusAmount(cardType) * this.getLevelGenerations() * 100) / 100 }
    getBonusRates()             { return this.config.bonusRates }

    // ==================== 分红 ====================
    getTeamDividendRate()           { return this.config.bonusRates.teamDividend  || 0.10 }
    getGlobalDividendRate()         { return this.config.bonusRates.globalDividend || 0.10 }
    getTeamDividendAmount(ct)       { return Math.floor(this.getCardPrice(ct) * this.getTeamDividendRate()   * 100) / 100 }
    getGlobalDividendAmount(ct)     { return Math.floor(this.getCardPrice(ct) * this.getGlobalDividendRate() * 100) / 100 }
    getDividendRequirements()       { return this.config.dividendRequirements }
    canTeamDividend(ct)             { return !!this.getCardConfig(ct)?.canTeamDividend }
    canGlobalDividend(ct)           { return !!this.getCardConfig(ct)?.canGlobalDividend }

    // ==================== 分账 ====================
    getLevelBonusDistribution() {
        return this.config.levelBonusDistribution || { withdrawable: 0.60, lockedReinvest: 0.25, autoUpgrade: 0.05, subsidyPool: 0.10 }
    }
    getSpotBonusDistribution() {
        return this.config.spotBonusDistribution  || { withdrawable: 1.0, locked: 0 }
    }
    getDistribution(type = 'level') {
        return type === 'spot' ? this.getSpotBonusDistribution() : this.getLevelBonusDistribution()
    }
    getCheckinDays(hasSlippage) {
        return hasSlippage ? this.config.checkin.withSlippage : this.config.checkin.noSlippage
    }

    // ==================== 旧版兼容 ====================
    getActivationPrice(modelType) { return this.getCardPrice(modelType) }
}

// ==================== 单例导出 ====================
let _instance = null
export function getRewardConfig() {
    if (!_instance) _instance = new RewardConfigManager()
    return _instance
}
export const rewardConfig = getRewardConfig()
export { DEFAULT_CONFIG }
export default RewardConfigManager

import { computed } from 'vue'

/**
 * 计算今日收益
 * @param {Object} userInfo - 用户信息
 * @returns {Object} { todayEarnings, todayDetails }
 */
export function useTodayEarnings(userInfo) {
    const todayEarnings = computed(() => {
        if (!userInfo.value?.transactions) return 0

        const today = new Date().toDateString()

        // 筛选今日收益交易
        const todayTx = userInfo.value.transactions.filter(tx => {
            const txDate = new Date(tx.timestamp).toDateString()
            const isToday = txDate === today
            const isIncome = [
                'spot_bonus',      // 见点奖
                'level_bonus',     // 平级奖
                'daily_dividend',  // 每日分红
                'admin_transfer'   // 管理员充值
            ].includes(tx.type)

            return isToday && isIncome
        })

        // 累加金额
        return todayTx.reduce((sum, tx) => sum + tx.amount, 0)
    })

    const todayDetails = computed(() => {
        if (!userInfo.value?.transactions) return {}

        const today = new Date().toDateString()
        const todayTx = userInfo.value.transactions.filter(tx => {
            const txDate = new Date(tx.timestamp).toDateString()
            return txDate === today
        })

        // 按类型统计
        const stats = {
            spotBonus: 0,
            levelBonus: 0,
            dividend: 0,
            transfer: 0
        }

        todayTx.forEach(tx => {
            if (tx.type === 'spot_bonus') stats.spotBonus += tx.amount
            if (tx.type === 'level_bonus') stats.levelBonus += tx.amount
            if (tx.type === 'daily_dividend') stats.dividend += tx.amount
            if (tx.type === 'admin_transfer') stats.transfer += tx.amount
        })

        return stats
    })

    return {
        todayEarnings,
        todayDetails
    }
}

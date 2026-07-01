/**
 * 分红服务 - Dividend Service
 * 每日定时任务调用
 *
 * 出局分润规则（新版）：
 * - 出局 1–19 人：仅享受拼团流水 N 层各 1%（累加）
 * - 出局 20–29 人：全网激活额 6%，与同档均分
 * - 出局 30+  人：全网激活额 10%，与同档均分
 * 达到哪档拿哪档（互斥，取最高）
 *
 * 平级锁定池分润（subsidy_pool）：
 * - 每人平级奖的10%累积到本人的 subsidy_pool
 * - 凌晨结算：均分给自己的2个直推的互助余额
 */

const EXIT_PINTUAN_UNIT = 20  // 每次拼团 $20

// 全网加权分红档次（出局 5+ 人，基于当日激活总额 × 档位比例，互斥取最高）
// 16% 总池：6%+10%=16%，各档独立分配给本档用户
const EXIT_ACTIVATION_TIERS = [
    { min: 30, max: Infinity, rate: 0.10, label: 'V6-30人10%'  },
    { min: 20, max: 29,       rate: 0.06, label: 'V4V5-20人6%' },
]

/**
 * 执行每日出局分润（新规则）
 */
export async function executeDailyDividend(supabase) {
    console.log('[ExitDividend] 开始执行每日出局分润（新规则）...')
    try {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        const todayStr = new Date().toISOString().split('T')[0]

        // 1. 昨日全网拼团流水（用于 B 段级别流水分红）
        const { data: pintuanEntries } = await supabase.from('pintuan_entries')
            .select('user_id')
            .gte('joined_at', `${yesterdayStr}T00:00:00`)
            .lt('joined_at', `${yesterdayStr}T23:59:59`)

        const pintuanUserSet = new Set((pintuanEntries || []).map(e => e.user_id))

        // 2. 昨日全网激活总额（用于 A 段全网加权分红）
        // spot_bonus = 激活额 × 25%，反推 activationVolume = spotBonusTotal / 0.25
        const { data: spotLogs } = await supabase.from('reward_logs')
            .select('amount')
            .eq('reward_type', 'spot_bonus')
            .gte('created_at', `${yesterdayStr}T00:00:00.000Z`)
            .lt('created_at', `${todayStr}T00:00:00.000Z`)
        const spotTotal = (spotLogs || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0)
        const activationVolume = Math.round(spotTotal / 0.25 * 10000) / 10000

        if (activationVolume === 0 && pintuanUserSet.size === 0) {
            console.log('[ExitDividend] 昨日无激活流水且无拼团流水，跳过')
            return { success: true, message: '昨日无流水' }
        }

        // 2. 获取所有出局 >= 1 的用户
        const { data: exitUsers } = await supabase.from('users')
            .select('id, exit_count')
            .gte('exit_count', 1)
        if (!exitUsers || exitUsers.length === 0) {
            return { success: true, message: '暂无出局用户' }
        }

        let totalPaid = 0

        // ── A. 全网激活额加权分红（出局 5+ 人，每档互斥取最高，共分 26% 激活总额）──
        if (activationVolume > 0) {
            for (const tier of EXIT_ACTIVATION_TIERS) {
                const tierUsers = exitUsers.filter(u => u.exit_count >= tier.min && u.exit_count <= tier.max)
                if (tierUsers.length === 0) continue

                const pool = Math.round(activationVolume * tier.rate * 10000) / 10000
                const perUser = Math.round((pool / tierUsers.length) * 10000) / 10000
                if (perUser <= 0) continue

                for (const u of tierUsers) {
                    await supabase.rpc('add_coin_balance', { p_user_id: u.id, p_amount: perUser })
                    await supabase.from('partner_dividends').insert({
                        user_id: u.id, amount: perUser,
                        source_date: todayStr, source_amount: activationVolume,
                        partner_count: tierUsers.length,
                        note: `出局分润-${tier.label}激活额均分`
                    }).catch(() => {})
                    totalPaid += perUser
                }
                console.log(`[ExitDividend] ${tier.label}档: ${tierUsers.length}人，各$${perUser}`)
            }
        }

        // ── B. 级别流水分红（出局 1–9 人）──
        const levelUsers = exitUsers.filter(u => u.exit_count >= 1 && u.exit_count <= 9)

        for (const user of levelUsers) {
            const levels = user.exit_count
            let dividend = 0
            const visited = new Set([user.id])
            let currentLevel = [user.id]

            for (let lvl = 1; lvl <= levels; lvl++) {
                if (currentLevel.length === 0) break
                const { data: nextLevel } = await supabase.from('users')
                    .select('id').in('referrer_id', currentLevel)
                if (!nextLevel || nextLevel.length === 0) break

                const nextIds = nextLevel.map(u => u.id).filter(id => !visited.has(id))
                nextIds.forEach(id => visited.add(id))

                // 本级昨日参团量 × $20 × 1%
                const lvlVolume = nextIds.filter(id => pintuanUserSet.has(id)).length * EXIT_PINTUAN_UNIT
                dividend += lvlVolume * 0.01
                currentLevel = nextIds
            }

            if (dividend > 0.0001) {
                dividend = Math.round(dividend * 10000) / 10000
                await supabase.rpc('add_coin_balance', { p_user_id: user.id, p_amount: dividend })
                await supabase.from('partner_dividends').insert({
                    user_id: user.id, amount: dividend,
                    source_date: todayStr, source_amount: pintuanUserSet.size * EXIT_PINTUAN_UNIT,
                    partner_count: levels,
                    note: `出局分润-${levels}级流水1%`
                }).catch(() => {})
                totalPaid += dividend
            }
        }

        console.log(`[ExitDividend] 完成 - 激活额:$${activationVolume}, 共发放:$${totalPaid.toFixed(4)}`)
        return { success: true, activationVolume, totalPaid }
    } catch (error) {
        console.error('[ExitDividend] Error:', error)
        throw error
    }
}

/**
 * 平级锁定池每日结算
 * 将每个用户 subsidy_pool 中的锁定金额，均分给其 2 个直推伙伴的互助补贴余额（各50%）
 * - 直推不足2人：有几个分几个，各得对应份额
 * - 无直推：锁定池保留
 * @param {SupabaseClient} supabase
 */
export async function distributeLockedDividendPool(supabase) {
    console.log('[LockedPool] 开始执行平级锁定池分润（发给直推的互助补贴余额）...')
    try {
        const todayStr = new Date().toISOString().split('T')[0]

        // 1. 找出所有 subsidy_pool > 0 的用户
        const { data: users } = await supabase.from('users')
            .select('id, subsidy_pool')
            .eq('is_member', true)
            .gt('subsidy_pool', 0)

        if (!users || users.length === 0) {
            console.log('[LockedPool] 无待分配锁定池，跳过')
            return { success: true, message: '无待分配' }
        }

        let totalDistributed = 0
        let processedCount = 0

        for (const user of users) {
            const poolAmount = parseFloat(user.subsidy_pool) || 0
            if (poolAmount < 0.0001) continue

            // 2. 查该用户的直推伙伴（最多2人）
            const { data: directs } = await supabase.from('users')
                .select('id, mutual_aid_balance')
                .eq('referrer_id', user.id)
                .eq('is_member', true)
                .limit(2)

            if (!directs || directs.length === 0) continue  // 无直推，保留

            // 3. CAS 清零 subsidy_pool
            const rawSubsidyPool = user.subsidy_pool
            const { data: casRes } = await supabase.from('users')
                .update({ subsidy_pool: 0 })
                .eq('id', user.id)
                .eq('subsidy_pool', rawSubsidyPool)
                .select('id')

            if (!casRes?.length) {
                console.warn(`[LockedPool] 用户${user.id} CAS失败，跳过`)
                continue
            }

            // 4. 均分给直推，打入 mutual_aid_balance
            const perDirect = Math.round((poolAmount / directs.length) * 10000) / 10000

            for (const direct of directs) {
                const curMa = parseFloat(direct.mutual_aid_balance || 0)
                await supabase.from('users')
                    .update({ mutual_aid_balance: Math.round((curMa + perDirect) * 10000) / 10000 })
                    .eq('id', direct.id)
                await supabase.from('transactions').insert({
                    user_id: direct.id, type: 'mutual_aid_locked_pool',
                    amount: perDirect, from_user_id: user.id, status: 'completed',
                    note: `平级锁定池分润→互助补贴`
                }).catch(() => {})
            }

            totalDistributed += poolAmount
            processedCount++
        }

        console.log(`[LockedPool] 完成 - 处理${processedCount}人，共分配${totalDistributed.toFixed(4)}`)
        return { success: true, processedCount, totalDistributed }
    } catch (e) {
        console.error('[LockedPool] Error:', e)
        throw e
    }
}

/**
 * 合伙人每日补贴池分润
 * 条件：is_partner = true（激活全部6档自动晋升）
 * 每天从全局补贴池取 10%，均分给所有合伙人
 * 原 V5/V6 补贴池分润已暂停
 */
export async function distributeV5SubsidyPool(supabase) {
    console.log('[PartnerPool] 开始执行合伙人补贴池分润...')
    try {
        // 1. 获取全局补贴池余额
        const { data: poolData } = await supabase.from('admin_settings')
            .select('setting_value').eq('setting_key', 'global_subsidy_pool').single()
        const poolBalance = parseFloat(poolData?.setting_value || '0') || 0

        if (poolBalance <= 0) {
            console.log('[PartnerPool] 补贴池为空，跳过')
            return { success: true, message: '补贴池为空' }
        }

        // 2. 获取所有合伙人（is_partner = true）
        const { data: partners } = await supabase
            .from('users')
            .select('id')
            .eq('is_partner', true)
            .eq('is_member', true)

        const partnerCount = partners?.length || 0
        if (partnerCount === 0) {
            console.log('[PartnerPool] 暂无合伙人，跳过')
            return { success: true, message: '暂无合伙人' }
        }

        // 3. 取补贴池 10%，均分给所有合伙人
        const todayDate = new Date().toISOString().split('T')[0]
        const totalDistribute = Math.floor(poolBalance * 0.10 * 100) / 100
        const perPartner = Math.floor((totalDistribute / partnerCount) * 10000) / 10000
        const newPoolBalance = Math.round((poolBalance - totalDistribute) * 10000) / 10000

        if (perPartner <= 0) {
            console.log('[PartnerPool] 人均分润为0，跳过')
            return { success: true, message: '分润金额过小' }
        }

        // 4. CAS更新补贴池余额（防并发）
        const { data: poolUpdateRes } = await supabase.from('admin_settings')
            .update({ setting_value: String(newPoolBalance) })
            .eq('setting_key', 'global_subsidy_pool')
            .eq('setting_value', String(poolBalance))
            .select('setting_key')
        if (!poolUpdateRes?.length) {
            console.log('[PartnerPool] 补贴池CAS失败，跳过（已被其他进程处理）')
            return { success: true, message: '已被处理' }
        }

        // 5. 发放给每位合伙人
        for (const user of (partners || [])) {
            await supabase.rpc('add_coin_balance', { p_user_id: user.id, p_amount: perPartner })
            await supabase.from('partner_dividends').insert({
                user_id: user.id, amount: perPartner,
                source_date: todayDate, source_amount: totalDistribute, partner_count: partnerCount
            }).catch(() => {})
        }

        console.log(`[PartnerPool] 完成 - 池子:${poolBalance}→${newPoolBalance}, 合伙人(${partnerCount}人)各${perPartner}`)
        return { success: true, poolBalance, newPoolBalance, totalDistribute, partnerCount, perPartner }
    } catch (e) {
        console.error('[PartnerPool] Error:', e)
        throw e
    }
}

/**
 * 购物金每日复利 3%，满30天自动出局到余额
 * 条件：shopping_gold >= 300 且 shopping_gold_start_date 已设置
 */
export async function processShoppingGoldCompound(supabase) {
    console.log('[ShoppingGold] 开始执行购物金每日复利...')
    try {
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]

        // 获取所有已启动复利的用户
        const { data: users } = await supabase.from('users')
            .select('id, coin_balance, shopping_gold, shopping_gold_start_date')
            .eq('is_member', true)
            .gte('shopping_gold', 300)
            .not('shopping_gold_start_date', 'is', null)

        if (!users || users.length === 0) {
            console.log('[ShoppingGold] 暂无需处理的购物金用户')
            return { success: true, message: '暂无需处理用户' }
        }

        let autoExitCount = 0, compoundCount = 0

        for (const user of users) {
            const sg = parseFloat(user.shopping_gold) || 0
            const startDate = new Date(user.shopping_gold_start_date)
            const diffMs = today - startDate
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

            if (diffDays >= 30) {
                // ✅ 满30天：自动出局 → 转入余额，购物金清0，日期清空
                const claimAmount = Math.floor(sg * 100) / 100
                const coinBal = parseFloat(user.coin_balance) || 0
                await supabase.from('users').update({
                    coin_balance: coinBal + claimAmount,
                    shopping_gold: 0,
                    shopping_gold_start_date: null
                }).eq('id', user.id).eq('shopping_gold', sg)
                await supabase.from('transactions').insert({
                    id: `SG_EXIT_${Date.now()}_${user.id.slice(0, 6)}`,
                    user_id: user.id, type: 'shopping_gold_exit',
                    amount: claimAmount, from_user_id: user.id, status: 'completed',
                    note: `购物金30天出局 ${claimAmount}`
                }).catch(() => {})
                autoExitCount++
            } else {
                // 📈 每日+3%复利
                const newSg = Math.round(sg * 1.03 * 100) / 100
                await supabase.from('users').update({ shopping_gold: newSg })
                    .eq('id', user.id).eq('shopping_gold', sg)
                compoundCount++
            }
        }

        console.log(`[ShoppingGold] 完成 - 复利${compoundCount}人，出局${autoExitCount}人`)
        return { success: true, compoundCount, autoExitCount }
    } catch (e) {
        console.error('[ShoppingGold] Error:', e)
        throw e
    }
}

/**
 * 计算用户的6层团队人数
 * @param {SupabaseClient} supabase 
 * @param {string} userId 
 * @returns {number} 团队人数
 */
async function calculateTeamCount(supabase, userId, depth = 6) {
    let totalCount = 0
    const visited = new Set()
    const queue = [{ userId, level: 0 }]

    while (queue.length > 0) {
        const { userId: currentUserId, level } = queue.shift()

        if (visited.has(currentUserId) || level >= depth) continue
        visited.add(currentUserId)

        // 获取直推成员
        const { data: directPush } = await supabase
            .from('users')
            .select('id')
            .eq('referrer_id', currentUserId)

        if (directPush && directPush.length > 0) {
            totalCount += directPush.length

            // 添加到队列继续遍历
            directPush.forEach(member => {
                queue.push({ userId: member.id, level: level + 1 })
            })
        }
    }

    return totalCount
}

/**
 * 更新所有用户的团队人数（定时任务）
 * @param {SupabaseClient} supabase 
 */
export async function updateAllTeamCounts(supabase) {
    console.log('[Dividend] 开始更新团队人数...')

    const { data: allUsers } = await supabase
        .from('users')
        .select('id')
        .eq('is_member', true)

    for (const user of allUsers || []) {
        const teamCount = await calculateTeamCount(supabase, user.id, DIVIDEND_CONFIG.PARTNER_TEAM_DEPTH)

        await supabase
            .from('users')
            .update({ team_count_6_layers: teamCount })
            .eq('id', user.id)
    }

    console.log('[Dividend] 团队人数更新完成')
}

/**
 * 订阅路由 - 1+1 P2P 模型
 *
 * 四种身份：游客 / 店长 / 店主 / 服务商
 * 见点奖分配（每次新店长入模型触发）：
 *   25% → 店主，10% → 直推店主（2人各5%），13层×3% → 推荐链，26% → 平台池
 * 邀请码限制：每人最多直推 2 人（MAX_DIRECT_PUSH=2）
 * 服务商条件：直推≥2 + 模型出局店主≥20 + V6($1000)
 */

import { Router } from 'itty-router'

// 直推封顶：每人最多直推 3 个
const MAX_DIRECT_PUSH = 2

const router = Router({ base: '/api/subscription' })

// =====================================================================
//  套餐配置（四档）
// =====================================================================

const PLANS = {
    BASIC:     { name: 'V1(20)',    price: 20,   spotBonus: 5,   directOwnerBonus: 2,   levelBonus: 0.6, levelDepth: 15 },
    PREMIUM:   { name: 'V2(50)',    price: 50,   spotBonus: 12.5,directOwnerBonus: 5,   levelBonus: 1.5, levelDepth: 15 },
    ELITE:     { name: 'V3(100)',   price: 100,  spotBonus: 25,  directOwnerBonus: 10,  levelBonus: 3,   levelDepth: 15 },
    TIER_300:  { name: 'V4(200)',   price: 200,  spotBonus: 50,  directOwnerBonus: 20,  levelBonus: 6,   levelDepth: 15 },
    TIER_500:  { name: 'V5(500)',   price: 500,  spotBonus: 125, directOwnerBonus: 50,  levelBonus: 15,  levelDepth: 15 },
    TIER_1000: { name: 'V6(1000)', price: 1000, spotBonus: 250, directOwnerBonus: 100, levelBonus: 30,  levelDepth: 15 },
}

// 档位顺序
const TIER_ORDER = ['BASIC', 'PREMIUM', 'ELITE', 'TIER_300', 'TIER_500', 'TIER_1000']

// 服务商：激活V6($1000) 且 出局≥30 自动晋升
async function checkAndGrantPartner(supabase, userId, activatedTypes) {
    try {
        const types = Array.isArray(activatedTypes) ? activatedTypes : []
        if (!types.includes('TIER_1000')) return
        const { data: user } = await supabase.from('users')
            .select('is_service_provider, exit_count').eq('id', userId).single()
        if (!user || user.is_service_provider) return
        if ((user.exit_count || 0) >= 30) {
            await supabase.from('users').update({ is_service_provider: true }).eq('id', userId)
            console.log(`[ServiceProvider] 用户 ${userId} 激活V6+出局30，自动晋升服务商`)
        }
    } catch (e) {
        console.error('[ServiceProvider] 晋升失败:', e)
    }
}

// 服务商：直推≥2 + 模型出局店主≥20 + V6
async function checkAndGrantServiceProvider(supabase, userId) {
    try {
        const { data: u } = await supabase.from('users')
            .select('id, card_type, direct_push_count, exit_count, is_service_provider')
            .eq('id', userId).single()
        if (!u || u.is_service_provider) return
        if (u.card_type !== 'TIER_1000') return
        if ((u.direct_push_count || 0) < 2) return
        if ((u.exit_count || 0) < 20) return
        await supabase.from('users').update({ is_service_provider: true }).eq('id', userId).eq('is_service_provider', false)
        console.log(`[ServiceProvider] 用户 ${userId} 满足条件，自动晋升服务商`)
    } catch (e) {
        console.error('[ServiceProvider] 晋升失败:', e)
    }
}

// 自动升级链（TIER_1000 为顶档）
const UPGRADE_CHAIN = {
    BASIC:     { nextPlan: 'PREMIUM',   threshold: 50 },
    PREMIUM:   { nextPlan: 'ELITE',     threshold: 100 },
    ELITE:     { nextPlan: 'TIER_300',  threshold: 200 },
    TIER_300:  { nextPlan: 'TIER_500',  threshold: 500 },
    TIER_500:  { nextPlan: 'TIER_1000', threshold: 1000 },
    TIER_1000: null  // 顶档
}

// 分润日利率（无复利，全部移除）
const PROFIT_RATES = {}

// =====================================================================
//  GET /api/subscription/plans
// =====================================================================

router.get('/plans', async () => {
    return Response.json({ code: 200, data: PLANS })
})

// =====================================================================
//  POST /api/subscription/activate（单档，向后兼容）
// =====================================================================

router.post('/activate', async (request) => {
    const supabase = request.supabase
    try {
        const body = await request.json()
        const { userId, planType, inviteCode: inputInviteCode } = body
        const id = request.user?.id || userId

        if (!id || !planType) return Response.json({ code: 400, message: '参数不完整' })

        const plan = PLANS[planType]
        if (!plan) return Response.json({ code: 400, message: '无效的套餐类型' })

        await supabase.from('users').upsert({ id }, { onConflict: 'id', ignoreDuplicates: true })

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, is_active, card_type, coin_balance, referrer_id, invite_code, direct_push_count, activated_types, is_partner')
            .eq('id', id).single()

        if (userError || !user) return Response.json({ code: 404, message: '用户初始化失败' })

        if (user.is_active) {
            // 已激活用户：直接走升级逻辑（允许跨档升级，如V1→V4）
            const curIdx = TIER_ORDER.indexOf(user.card_type)
            const targetIdx = TIER_ORDER.indexOf(planType)
            if (targetIdx <= curIdx) return Response.json({ code: 400, message: `目标档位必须高于当前档位${PLANS[user.card_type]?.name}` })
            const bal2 = parseFloat(user.coin_balance) || 0
            if (bal2 < plan.price) return Response.json({ code: 400, message: `余额不足，需要${plan.price}，当前${bal2.toFixed(2)}` })
            const existingTypes = Array.isArray(user.activated_types) ? user.activated_types : []
            const newActivatedTypes = [...new Set([...existingTypes, planType])]
            const { data: upRes, error: upErr } = await supabase.from('users').update({
                coin_balance: bal2 - plan.price, card_type: planType,
                activated_types: newActivatedTypes,
                updated_at: new Date().toISOString()
            }).eq('id', id).eq('card_type', user.card_type).gte('coin_balance', plan.price).select('id')
            if (upErr) return Response.json({ code: 500, message: '升级失败，请重试' })
            if (!upRes?.length) return Response.json({ code: 400, message: '账户状态已变更，请刷新重试' })
            // 检查合伙人晋升
            if (!user.is_partner) await checkAndGrantPartner(supabase, id, newActivatedTypes)
            await activateAndRotate(supabase, id, user.referrer_id, plan, planType)
            return Response.json({ code: 200, message: '升级成功', data: { planType, planName: plan.name, price: plan.price } })
        }

        let referrerId = user.referrer_id
        if (!referrerId && inputInviteCode) {
            const { data: ref } = await supabase.from('users').select('id, direct_push_count').eq('invite_code', inputInviteCode).single()
            if (ref) {
                if (ref.id === id) return Response.json({ code: 400, message: '不能使用自己的邀请码' })
                // 直推封顶检查
                if ((ref.direct_push_count || 0) >= MAX_DIRECT_PUSH) {
                    return Response.json({ code: 400, message: `该推荐人直推已满${MAX_DIRECT_PUSH}人，无法继续推荐` })
                }
                referrerId = ref.id
            }
        }
        if (!referrerId) return Response.json({ code: 400, message: '激活需要邀请码' })

        const bal = parseFloat(user.coin_balance) || 0
        if (bal < plan.price) return Response.json({ code: 400, message: `余额不足，需要${plan.price}，当前${bal.toFixed(2)}` })

        const userInviteCode = user.invite_code || generateInviteCode()
        const existingTypes0 = Array.isArray(user.activated_types) ? user.activated_types : []
        const newActivatedTypes0 = [...new Set([...existingTypes0, planType])]
        const fields = {
            coin_balance: bal - plan.price, is_active: true, is_member: true,
            card_type: planType, invite_code: userInviteCode,
            activated_types: newActivatedTypes0
        }
        if (!user.referrer_id && referrerId) fields.referrer_id = referrerId

        const { data: res, error: err } = await supabase
            .from('users').update(fields).eq('id', id).eq('is_active', false).gte('coin_balance', plan.price).select('id')

        if (err) return Response.json({ code: 500, message: '激活失败，请重试' })
        if (!res?.length) {
            const { data: rechk } = await supabase.from('users').select('is_active').eq('id', id).single()
            if (rechk?.is_active) return Response.json({ code: 400, message: '已激活' })
            return Response.json({ code: 400, message: '余额不足或账户变更，请刷新重试' })
        }

        try {
            await supabase.from('transactions').insert({
                id: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                user_id: id, type: 'activation', amount: plan.price,
                from_user_id: id, card_type: planType, status: 'completed', note: `激活${plan.name}`
            })
        } catch (e) {}

        const bg = (async () => {
            if (referrerId) {
                const { data: ref } = await supabase.from('users').select('direct_push_count').eq('id', referrerId).single()
                if (ref) {
                    // CAS + 封顶检查：防并发超额自增
                    await supabase.from('users')
                        .update({ direct_push_count: (ref.direct_push_count || 0) + 1 })
                        .eq('id', referrerId)
                        .eq('direct_push_count', ref.direct_push_count || 0)
                        .lt('direct_push_count', MAX_DIRECT_PUSH)
                }
            }
            // 合伙人晋升检查
            if (!user.is_partner) await checkAndGrantPartner(supabase, id, newActivatedTypes0)
            try { await activateAndRotate(supabase, id, referrerId, plan, planType) } catch (e) {
                console.error('[Activate] 模型结算失败:', e)
            }
        })()
        if (request.ctx?.waitUntil) request.ctx.waitUntil(bg); else await bg

        return Response.json({ code: 200, message: '激活成功', data: { planType, planName: plan.name, price: plan.price, inviteCode: userInviteCode } })

    } catch (e) {
        return Response.json({ code: 500, message: '激活失败: ' + e.message }, { status: 500 })
    }
})

// =====================================================================
//  POST /api/subscription/activate-multi（多档批量激活）
// =====================================================================

router.post('/activate-multi', async (request) => {
    const supabase = request.supabase
    try {
        const body = await request.json()
        const { userId, planTypes, inviteCode: inputInviteCode, payMethod: rawPayMethod } = body
        const id = request.user?.id || userId
        const payMethod = rawPayMethod === 'help' ? 'help' : 'balance'

        if (!id || !Array.isArray(planTypes) || planTypes.length === 0)
            return Response.json({ code: 400, message: '参数不完整' })

        for (const pt of planTypes) {
            if (!PLANS[pt]) return Response.json({ code: 400, message: `无效档位: ${pt}` })
        }

        // 不允许重复
        if (new Set(planTypes).size !== planTypes.length)
            return Response.json({ code: 400, message: '不能重复选择相同档位' })

        await supabase.from('users').upsert({ id }, { onConflict: 'id', ignoreDuplicates: true })

        const { data: user, error: ue } = await supabase
            .from('users')
            .select('id, is_active, card_type, coin_balance, help_balance, referrer_id, invite_code, direct_push_count')
            .eq('id', id).single()
        if (ue || !user) return Response.json({ code: 404, message: '用户初始化失败' })

        // 已激活档位（从 users.activated_types 读取，最可靠）
        const activatedTierSet = new Set(Array.isArray(user.activated_types) ? user.activated_types : [])
        for (const pt of planTypes) {
            if (activatedTierSet.has(pt))
                return Response.json({ code: 400, message: `${PLANS[pt].name} 已激活，不可重复激活` })
        }

        const totalCost = planTypes.reduce((s, pt) => s + PLANS[pt].price, 0)
        const bal = payMethod === 'help'
            ? (parseFloat(user.help_balance) || 0)
            : (parseFloat(user.coin_balance) || 0)
        const balLabel = payMethod === 'help' ? '帮扶余额' : '余额'
        if (bal < totalCost)
            return Response.json({ code: 400, message: `${balLabel}不足，需要${totalCost}，当前${bal.toFixed(2)}，请充值` })

        let referrerId = user.referrer_id
        if (!referrerId && inputInviteCode) {
            const { data: ref } = await supabase.from('users').select('id, direct_push_count').eq('invite_code', inputInviteCode).single()
            if (ref) {
                if (ref.id === id) return Response.json({ code: 400, message: '不能使用自己的邀请码' })
                if ((ref.direct_push_count || 0) >= MAX_DIRECT_PUSH)
                    return Response.json({ code: 400, message: `该推荐人直推已满${MAX_DIRECT_PUSH}人，无法继续推荐` })
                referrerId = ref.id
            }
        }
        // 首次激活需要邀请码；已激活用户补选其他档位无需邀请码（推荐人已绑定）
        if (!referrerId && !user.is_active)
            return Response.json({ code: 400, message: '激活需要邀请码' })

        // card_type = 所有已激活档位（含本次）中的最高档
        const allTiers = [...new Set([...(user.card_type ? [user.card_type] : []), ...Array.from(activatedTierSet), ...planTypes])]
        const highestIdx = Math.max(...allTiers.map(t => TIER_ORDER.indexOf(t)).filter(i => i >= 0))
        const newCardType = TIER_ORDER[highestIdx] || planTypes[planTypes.length - 1]
        const highestTier = planTypes[planTypes.length - 1]  // 本次最高档（触发奖励用）

        const userInviteCode = user.invite_code || generateInviteCode()
        const firstActivation = !user.is_active
        const balField = payMethod === 'help' ? 'help_balance' : 'coin_balance'
        const fields = {
            [balField]: bal - totalCost, is_active: true, is_member: true,
            card_type: newCardType, invite_code: userInviteCode
        }
        if (!user.referrer_id && referrerId) fields.referrer_id = referrerId

        // 合并已激活档位数组（原有 + 本次新激活）
        const newActivatedTypes = [...new Set([...Array.from(activatedTierSet), ...planTypes])]
        fields.activated_types = newActivatedTypes

        let q = supabase.from('users').update(fields).eq('id', id)
        if (firstActivation) q = q.eq('is_active', false)
        q = q.gte(balField, totalCost)
        // CAS：确保本次每个档位都未被并发激活（防TOCTOU重复扣费）
        for (const pt of planTypes) {
            q = q.not('activated_types', 'cs', `{${pt}}`)
        }
        const { data: res, error: err } = await q.select('id')

        if (err) return Response.json({ code: 500, message: '激活失败，请重试' })
        if (!res?.length) {
            const { data: rechk } = await supabase.from('users').select(balField).eq('id', id).single()
            if ((parseFloat(rechk?.[balField]) || 0) < totalCost)
                return Response.json({ code: 400, message: `${balLabel}不足，请充值后重试` })
            return Response.json({ code: 400, message: '账户状态变更，请刷新重试' })
        }

        // 逐条插入交易记录（各自独立ID，避免并发冲突）
        for (const pt of planTypes) {
            const plan = PLANS[pt]
            await supabase.from('transactions').insert({
                id: `TXN_ACT_${pt}_${id}_${Date.now()}`,
                user_id: id, type: 'activation', amount: plan.price,
                from_user_id: id, card_type: pt, status: 'completed', note: `激活${plan.name}`
            }).catch(() => {})
        }

        const bg = (async () => {
            if (referrerId && firstActivation) {
                const { data: ref } = await supabase.from('users').select('direct_push_count').eq('id', referrerId).single()
                if (ref) {
                    // CAS + 封顶检查：防并发超额自增
                    await supabase.from('users')
                        .update({ direct_push_count: (ref.direct_push_count || 0) + 1 })
                        .eq('id', referrerId)
                        .eq('direct_push_count', ref.direct_push_count || 0)
                        .lt('direct_push_count', MAX_DIRECT_PUSH)
                }
            }
            // 激活赠送拼团券：V1/V2/V3 → 8张，V4/V5/V6 → 16张
            const HIGH_TIERS = ['TIER_300', 'TIER_500', 'TIER_1000']
            const LOW_TIERS  = ['BASIC', 'PREMIUM', 'ELITE']
            const voucherGrant = planTypes.some(t => HIGH_TIERS.includes(t)) ? 16
                : planTypes.some(t => LOW_TIERS.includes(t)) ? 8 : 0
            if (voucherGrant > 0) {
                // CAS：防并发丢失增量
                for (let i = 0; i < 3; i++) {
                    const { data: vu } = await supabase.from('users').select('coupon_count').eq('id', id).single()
                    const cur = vu?.coupon_count || 0
                    const { data: ok } = await supabase.from('users')
                        .update({ coupon_count: cur + voucherGrant })
                        .eq('id', id).eq('coupon_count', cur).select('id')
                    if (ok?.length) break
                }
            }
            // 合伙人晋升检查（全部6档激活）
            await checkAndGrantPartner(supabase, id, newActivatedTypes)
            // 只用最高档位触发一次模型旋转+平级奖，避免多档位重复发奖
            const topPlan = PLANS[highestTier]
            try { await activateAndRotate(supabase, id, referrerId, topPlan, highestTier) } catch (e) {
                console.error(`[MultiActivate] 结算失败:`, e)
            }
        })()
        if (request.ctx?.waitUntil) request.ctx.waitUntil(bg); else await bg

        return Response.json({
            code: 200, message: '激活成功',
            data: { activatedTiers: planTypes, totalCost, highestTier, highestTierName: PLANS[highestTier].name, inviteCode: userInviteCode }
        })

    } catch (e) {
        return Response.json({ code: 500, message: '激活失败: ' + e.message }, { status: 500 })
    }
})

// =====================================================================
//  POST /api/subscription/claim-profit
//  用户手动领取分润余额 → coin_balance，分润余额清零
// =====================================================================

router.post('/claim-profit', async (request) => {
    const supabase = request.supabase
    try {
        const { userId } = await request.json()
        const id = request.user?.id || userId
        if (!id) return Response.json({ code: 400, message: '缺少用户ID' })

        const { data: user, error } = await supabase
            .from('users')
            .select('id, card_type, coin_balance, profit_balance')
            .eq('id', id).single()

        if (error || !user) return Response.json({ code: 404, message: '用户不存在' })

        const profitBal = parseFloat(user.profit_balance) || 0
        if (profitBal <= 0) return Response.json({ code: 400, message: '暂无可领取的分润' })

        // 精确到2位小数
        const claimAmount = Math.floor(profitBal * 100) / 100
        if (claimAmount <= 0) return Response.json({ code: 400, message: '可领取分润不足0.01' })

        const coinBal = parseFloat(user.coin_balance) || 0

        // 单步原子操作：CAS profit_balance 同时加 coin_balance，彻底消除两步非原子风险
        const { data: merged, error: mergeErr } = await supabase.from('users')
            .update({ profit_balance: 0, coin_balance: Math.round((coinBal + claimAmount) * 10000) / 10000 })
            .eq('id', id)
            .eq('profit_balance', profitBal)
            .gte('coin_balance', 0)
            .select('id')

        if (mergeErr || !merged?.length) {
            return Response.json({ code: 400, message: '分润余额已变更，请稍后重试' })
        }

        // 记录日志
        try {
            await supabase.from('transactions').insert({
                id: `PROFIT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                user_id: id, type: 'profit_claim',
                amount: claimAmount, from_user_id: id,
                card_type: user.card_type, status: 'completed',
                note: `领取分润 ${user.card_type}`
            })
        } catch (e) {}

        return Response.json({
            code: 200, message: '领取成功',
            data: { claimed: claimAmount, newCoinBalance: coinBal + claimAmount }
        })

    } catch (e) {
        return Response.json({ code: 500, message: '领取失败: ' + e.message }, { status: 500 })
    }
})

// =====================================================================
//  POST /api/subscription/claim-shopping-gold
//  手动领取购物金 → coin_balance，购物金清0，计时重置
// =====================================================================

router.post('/claim-shopping-gold', async (request) => {
    const supabase = request.supabase
    try {
        const { userId } = await request.json()
        const id = request.user?.id || userId
        if (!id) return Response.json({ code: 400, message: '缺少用户ID' })

        const { data: user, error } = await supabase.from('users')
            .select('id, coin_balance, shopping_gold')
            .eq('id', id).single()
        if (error || !user) return Response.json({ code: 404, message: '用户不存在' })

        const sgBal = parseFloat(user.shopping_gold) || 0
        if (sgBal <= 0) return Response.json({ code: 400, message: '购物金余额为0' })

        const claimAmount = Math.floor(sgBal * 100) / 100
        const coinBal = parseFloat(user.coin_balance) || 0

        // CAS：以 shopping_gold 当前值为条件，防并发重复领取
        const { data: casRes } = await supabase.from('users').update({
            coin_balance: coinBal + claimAmount,
            shopping_gold: 0
        }).eq('id', id).eq('shopping_gold', sgBal).select('id')

        if (!casRes?.length) return Response.json({ code: 400, message: '购物金已变更，请稍后重试' })

        await supabase.from('transactions').insert({
            id: `SG_CLAIM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            user_id: id, type: 'shopping_gold_claim',
            amount: claimAmount, from_user_id: id, status: 'completed',
            note: `手动领取购物金 ${claimAmount}`
        }).catch(() => {})

        return Response.json({
            code: 200, message: '领取成功',
            data: { claimed: claimAmount, newCoinBalance: coinBal + claimAmount }
        })
    } catch (e) {
        return Response.json({ code: 500, message: '领取失败: ' + e.message }, { status: 500 })
    }
})

// =====================================================================
//  POST /api/subscription/admin/restart-profit
//  管理员重启分润：
//  1. 所有60/100/200档用户 profit_balance → coin_balance（自动到账）
//  2. 所有60/100/200档用户 card_type 降为 PREMIUM（30档）
//  3. 10/30档用户不受影响
//  需要 Header: X-Admin-Secret: <ADMIN_SECRET>
// =====================================================================

router.post('/admin/restart-profit', async (request) => {
    const supabase = request.supabase
    const env = request.env

    // 管理员鉴权
    const secret = request.headers.get('x-admin-secret') || request.headers.get('X-Admin-Secret')
    if (!secret || secret !== env?.ADMIN_SECRET) {
        return Response.json({ code: 403, message: '无权限' }, { status: 403 })
    }

    try {
        const PROFIT_TIERS = ['TIER_100']

        // 1. 查询所有分润档位用户
        const { data: profitUsers, error: fetchErr } = await supabase
            .from('users')
            .select('id, coin_balance, profit_balance, card_type')
            .in('card_type', PROFIT_TIERS)

        if (fetchErr) return Response.json({ code: 500, message: '查询用户失败' })

        const users = profitUsers || []
        let processedCount = 0
        let totalProfitPaid = 0

        // 2. 逐用户：profit_balance → coin_balance，card_type → PREMIUM
        for (const u of users) {
            const profitBal = parseFloat(u.profit_balance) || 0
            const coinBal   = parseFloat(u.coin_balance)   || 0
            const claimAmt  = Math.floor(profitBal * 100) / 100

            const updateData = {
                card_type: 'PREMIUM',   // 降为30档
                profit_balance: 0       // 分润清零
            }
            if (claimAmt > 0) {
                updateData.coin_balance = coinBal + claimAmt
                totalProfitPaid += claimAmt
            }

            const { error: upErr } = await supabase.from('users').update(updateData).eq('id', u.id)
            if (upErr) {
                console.error(`[RestartProfit] 处理用户 ${u.id} 失败:`, upErr)
                continue
            }

            // 记录日志（有分润才记）
            if (claimAmt > 0) {
                try {
                    await supabase.from('transactions').insert({
                        id: `RESTART_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        user_id: u.id, type: 'profit_restart',
                        amount: claimAmt, from_user_id: u.id,
                        card_type: u.card_type, status: 'completed',
                        note: `重启分润结算 ${u.card_type}→PREMIUM`
                    })
                } catch (e) {}
            }

            processedCount++
        }

        console.log(`[RestartProfit] 完成: 处理${processedCount}人，共结算分润${totalProfitPaid.toFixed(2)}`)

        return Response.json({
            code: 200,
            message: '重启分润完成',
            data: {
                processedUsers: processedCount,
                totalProfitPaid: Math.floor(totalProfitPaid * 100) / 100,
                resetToTier: 'PREMIUM（30档）'
            }
        })

    } catch (e) {
        console.error('[RestartProfit] Error:', e)
        return Response.json({ code: 500, message: '重启失败: ' + e.message }, { status: 500 })
    }
})

// =====================================================================
//  POST /api/subscription/admin/restart-profit/tier200
//  仅重启200+300档分润（TIER_200），100档(TIER_100)不受影响
//  profit_balance → coin_balance，profit_balance 清零，card_type 保持不变
//  需要 Header: X-Admin-Secret: <ADMIN_SECRET>
// =====================================================================

router.post('/admin/restart-profit/tier200', async (request) => {
    const supabase = request.supabase
    const env = request.env

    const secret = request.headers.get('x-admin-secret') || request.headers.get('X-Admin-Secret')
    if (!secret || secret !== env?.ADMIN_SECRET) {
        return Response.json({ code: 403, message: '无权限' }, { status: 403 })
    }

    try {
        const TARGET_TIERS = ['TIER_200']  // 仅200档，100档不受影响

        const { data: profitUsers, error: fetchErr } = await supabase
            .from('users')
            .select('id, coin_balance, profit_balance, card_type')
            .in('card_type', TARGET_TIERS)

        if (fetchErr) return Response.json({ code: 500, message: '查询用户失败' })

        const users = profitUsers || []
        let processedCount = 0
        let totalProfitPaid = 0

        for (const u of users) {
            const profitBal = parseFloat(u.profit_balance) || 0
            const coinBal   = parseFloat(u.coin_balance)   || 0
            const claimAmt  = Math.floor(profitBal * 100) / 100

            const updateData = {
                profit_balance: 0   // 清零，card_type 保持原档位
            }
            if (claimAmt > 0) {
                updateData.coin_balance = coinBal + claimAmt
                totalProfitPaid += claimAmt
            }

            const { error: upErr } = await supabase.from('users').update(updateData).eq('id', u.id)
            if (upErr) {
                console.error(`[RestartProfitTier200] 处理用户 ${u.id} 失败:`, upErr)
                continue
            }

            if (claimAmt > 0) {
                try {
                    await supabase.from('transactions').insert({
                        id: `RESTART200_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        user_id: u.id, type: 'profit_restart',
                        amount: claimAmt, from_user_id: u.id,
                        card_type: u.card_type, status: 'completed',
                        note: `仅重启200+300档分润结算`
                    })
                } catch (e) {}
            }

            processedCount++
        }

        console.log(`[RestartProfitTier200] 完成: 处理${processedCount}人，共结算${totalProfitPaid.toFixed(2)}，TIER_100 不受影响`)

        return Response.json({
            code: 200,
            message: '仅重启200+300档分润完成',
            data: {
                processedUsers: processedCount,
                totalProfitPaid: Math.floor(totalProfitPaid * 100) / 100,
                note: 'TIER_100(100档) 用户未受影响，继续正常累利'
            }
        })

    } catch (e) {
        console.error('[RestartProfitTier200] Error:', e)
        return Response.json({ code: 500, message: '重启失败: ' + e.message }, { status: 500 })
    }
})

// =====================================================================
//  GET /api/subscription/profit-stats
//  管理员查看分润用户统计（各档位人数 + 待领总额）
//  需要 Header: X-Admin-Secret: <ADMIN_SECRET>
// =====================================================================

router.get('/profit-stats', async (request) => {
    const supabase = request.supabase
    const env = request.env

    const secret = request.headers.get('x-admin-secret') || request.headers.get('X-Admin-Secret')
    if (!secret || secret !== env?.ADMIN_SECRET) {
        return Response.json({ code: 403, message: '无权限' }, { status: 403 })
    }

    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('card_type, profit_balance')
            .in('card_type', ['TIER_200'])

        if (error) return Response.json({ code: 500, message: '查询失败' })

        const list = users || []
        const stats = {
            count:       list.length,
            totalProfit: list.reduce((s, u) => s + (parseFloat(u.profit_balance) || 0), 0),
            tier200:     list.filter(u => u.card_type === 'TIER_200').length
        }

        return Response.json({ code: 200, data: stats })
    } catch (e) {
        return Response.json({ code: 500, message: '统计失败: ' + e.message }, { status: 500 })
    }
})

// =====================================================================
//  核心：activateAndRotate
// =====================================================================

async function activateAndRotate(supabase, newUserId, referrerId, plan, planType) {
    const result = { spotBonusReceiver: null, slotAExited: null, contribution: false, contributionTarget: null, newLeader: null, levelBonuses: [] }

    if (!referrerId) {
        await createShop(supabase, newUserId, planType)
        await supabase.from('users').update({ role: 'owner', is_independent: true }).eq('id', newUserId)
        return result
    }

    const referrer = await getUser(supabase, referrerId)
    if (!referrer) {
        await createShop(supabase, newUserId, planType)
        await supabase.from('users').update({ role: 'owner', is_independent: true }).eq('id', newUserId)
        return result
    }

    const shouldContribute = checkContribution(referrer)

    if (referrer.role === 'manager' && referrer.shop_owner_id) {
        await rotateModel(supabase, referrer.shop_owner_id, newUserId, planType, result, referrer.current_shop_id)
    } else if (shouldContribute && !referrer.has_contributed) {
        // CAS：原子抢锁贡献标记，防并发双重贡献
        const { data: contribLock } = await supabase.from('users')
            .update({ has_contributed: true })
            .eq('id', referrerId).eq('has_contributed', false).select('id')
        if (contribLock?.length) {
            result.contribution = true
            result.contributionTarget = referrer.referrer_id
            if (referrer.referrer_id) {
                await rotateModel(supabase, referrer.referrer_id, newUserId, planType, result)
            } else {
                await rotateModel(supabase, referrerId, newUserId, planType, result)
            }
        } else {
            // 并发请求已完成贡献，走普通进入路径
            await rotateModel(supabase, referrerId, newUserId, planType, result)
        }
    } else {
        await rotateModel(supabase, referrerId, newUserId, planType, result)
    }

    if (result.spotBonusReceiver) {
        // 25% 见点奖 → 店主（CAS 防并发）
        let spotCasOk = false
        for (let _i = 0; _i < 3; _i++) {
            const { data: recv } = await supabase.from('users').select('coin_balance').eq('id', result.spotBonusReceiver).single()
            const oldBal = parseFloat(recv?.coin_balance || 0)
            const { data: casRes } = await supabase.from('users')
                .update({ coin_balance: Math.round((oldBal + plan.spotBonus) * 10000) / 10000 })
                .eq('id', result.spotBonusReceiver)
                .eq('coin_balance', recv?.coin_balance ?? oldBal)
                .select('id')
            if (casRes?.length) { spotCasOk = true; break }
        }
        if (spotCasOk) {
            await logReward(supabase, result.spotBonusReceiver, newUserId, 'spot_bonus', plan.spotBonus, planType, `见点奖(25%)：${plan.name}激活`).catch(() => {})
        } else {
            console.error(`[SpotBonus] CAS失败3次，接收方${result.spotBonusReceiver}见点奖${plan.spotBonus}未到账`)
        }
        // 10% 直推店主奖（店主的直推中是店主的人平分）
        await triggerDirectOwnerBonus(supabase, result.spotBonusReceiver, newUserId, plan).catch(e => console.error('[DirectOwnerBonus]', e))
        // 出局帮扶：店主的出局直推每人5%，存入 help_balance（不可直提）
        await payExitHelpBonus(supabase, result.spotBonusReceiver, plan.price).catch(e => console.error('[ExitHelpBonus]', e))
        // 服务商检查（店主每出一次局exit_count+1，满20则晋升）
        await checkAndGrantServiceProvider(supabase, result.spotBonusReceiver).catch(() => {})
    }

    if (referrerId) {
        result.levelBonuses = await triggerLevelBonus(supabase, referrerId, newUserId, plan, planType)
    }

    if (result.slotAExited) {
        const exitedUser = await getUser(supabase, result.slotAExited)
        if (exitedUser && exitedUser.role !== 'owner') {
            result.newLeader = result.slotAExited
            const contributionSlot = exitedUser.has_slide_down ? null : 'first'
            await supabase.from('users').update({
                role: 'owner', is_independent: true,
                shop_owner_id: null, contribution_slot: contributionSlot
            }).eq('id', result.slotAExited)
            await createShop(supabase, result.slotAExited, planType)
        }
    }

    return result
}

// =====================================================================
//  rotateModel
// =====================================================================

async function rotateModel(supabase, leaderUserId, newUserId, planType, result, preferShopId = null) {
    let shop = null
    // 优先使用指定店铺（推荐人是 manager 时用其当前店铺，避免按新人档位找错店）
    if (preferShopId) {
        const { data } = await supabase.from('shops').select('*').eq('id', preferShopId).single()
        shop = data || null
    }
    if (!shop) {
        const { data } = await supabase.from('shops').select('*')
            .eq('slot1_owner_id', leaderUserId).eq('model_type', planType).single()
        shop = data || null
    }
    if (!shop) shop = await createShop(supabase, leaderUserId, planType)

    if (!shop.slota_tenant_id) {
        // 乐观锁：只在 slota 仍为空时写入，防并发双人同时占槽
        const { data: cas } = await supabase.from('shops').update({
            slota_tenant_id: newUserId, total_members: (shop.total_members || 0) + 1,
            updated_at: new Date().toISOString()
        }).eq('id', shop.id).is('slota_tenant_id', null).select('id')

        if (!cas?.length) {
            // 槽位已被并发占用，重读后再做一次CAS替换
            const { data: fresh } = await supabase.from('shops').select('*').eq('id', shop.id).single()
            if (!fresh) return
            if (fresh.slota_tenant_id && fresh.slota_tenant_id !== newUserId) {
                const oldTenantId = fresh.slota_tenant_id
                const newUser = await getUser(supabase, newUserId)
                const hasSlideDown = !!(newUser && newUser.referrer_id === leaderUserId)
                // CAS3：必须成功才能标记 slotAExited，防止并发竞争误标出局
                const { data: cas3 } = await supabase.from('shops').update({
                    slota_tenant_id: newUserId,
                    total_members: (fresh.total_members || 0) + 1,
                    rotation_count: (fresh.rotation_count || 0) + 1,
                    updated_at: new Date().toISOString()
                }).eq('id', fresh.id).eq('slota_tenant_id', oldTenantId).select('id')
                if (cas3?.length) {
                    result.slotAExited = oldTenantId
                    await supabase.from('users').update({ current_shop_id: null, has_slide_down: hasSlideDown }).eq('id', oldTenantId)
                    await supabase.from('users').update({ role: 'manager', shop_owner_id: leaderUserId, current_shop_id: fresh.id }).eq('id', newUserId)
                }
                // cas3 失败：另一并发请求已完成，本次忽略
            }
        } else {
            await supabase.from('users').update({ role: 'manager', shop_owner_id: leaderUserId, current_shop_id: shop.id }).eq('id', newUserId)
        }
    } else {
        const oldTenantId = shop.slota_tenant_id
        const newUser = await getUser(supabase, newUserId)
        const hasSlideDown = !!(newUser && newUser.referrer_id === leaderUserId)

        // CAS2：先原子替换槽位，成功后才标记出局，防并发双重弹出
        const { data: cas2 } = await supabase.from('shops').update({
            slota_tenant_id: newUserId,
            total_members: (shop.total_members || 0) + 1,
            rotation_count: (shop.rotation_count || 0) + 1,
            updated_at: new Date().toISOString()
        }).eq('id', shop.id).eq('slota_tenant_id', oldTenantId).select('id')

        if (cas2?.length) {
            result.slotAExited = oldTenantId
            await supabase.from('users').update({ current_shop_id: null, has_slide_down: hasSlideDown }).eq('id', oldTenantId)
            await supabase.from('users').update({ role: 'manager', shop_owner_id: leaderUserId, current_shop_id: shop.id }).eq('id', newUserId)
        } else {
            // CAS2 失败：并发请求已完成弹出，本次不入模型
            console.warn(`[RotateModel] CAS2失败，用户${newUserId}并发竞争槽位未入模型`)
        }
    }

    // 有人出局时，给店主累加 exit_count（CAS防并发多次计数错误）
    if (result.slotAExited) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const { data: ld } = await supabase.from('users').select('exit_count').eq('id', leaderUserId).single()
            const cur = parseInt(ld?.exit_count || 0)
            const { data: ec } = await supabase.from('users')
                .update({ exit_count: cur + 1 })
                .eq('id', leaderUserId)
                .eq('exit_count', ld?.exit_count ?? cur)
                .select('id')
            if (ec?.length) break
        }
    }

    result.spotBonusReceiver = leaderUserId
}

// =====================================================================
//  checkContribution
// =====================================================================

function checkContribution(user) {
    if (user.has_contributed) return false
    if (!user.contribution_slot) return false
    const pushCount = user.direct_push_count || 0
    if (user.contribution_slot === 'first' && pushCount === 1) return true
    return false
}

// =====================================================================
//  triggerLevelBonus（推荐链奖：向上追溯 13 层，每层 3% 直接到 coin_balance）
// =====================================================================

async function triggerLevelBonus(supabase, startUserId, newUserId, plan, planType) {
    const bonuses = []
    let currentUserId = startUserId
    const visited = new Set()

    for (let level = 1; level <= plan.levelDepth; level++) {
        if (!currentUserId || visited.has(currentUserId)) break
        visited.add(currentUserId)

        const current = await getUser(supabase, currentUserId)
        if (!current) break

        if (current.is_member) {
            let casOk = false
            for (let attempt = 0; attempt < 3 && !casOk; attempt++) {
                const { data: cd } = await supabase.from('users')
                    .select('coin_balance').eq('id', current.id).single()
                if (!cd) break
                const curBal = parseFloat(cd.coin_balance) || 0
                const { data: casRes } = await supabase.from('users')
                    .update({ coin_balance: Math.round((curBal + plan.levelBonus) * 10000) / 10000 })
                    .eq('id', current.id).eq('coin_balance', cd.coin_balance).select('id')
                if (casRes?.length) {
                    casOk = true
                    await logReward(supabase, current.id, newUserId, 'level_bonus', plan.levelBonus, planType, `推荐链第${level}层(3%)`).catch(() => {})
                }
            }
            if (!casOk) {
                console.error(`[LevelBonus] CAS失败3次，用户${current.id}第${level}层${plan.levelBonus}未到账`)
            }
            bonuses.push({ userId: current.id, level, amount: plan.levelBonus, credited: casOk })
        }

        currentUserId = current.referrer_id
    }

    return bonuses
}

// =====================================================================
//  triggerDirectOwnerBonus（帮扶补贴：店主的直推中 exit_count>0 的出局店主，每人10%，最多2位）
// =====================================================================

// 出局帮扶：有人激活入驻店铺时，店主的出局直推每人获得激活价5%存入 help_balance
async function payExitHelpBonus(supabase, shopOwnerId, activationPrice) {
    const EXIT_HELP_RATE = 0.025
    const { data: directs } = await supabase.from('users')
        .select('id, help_balance')
        .eq('referrer_id', shopOwnerId)
        .gt('exit_count', 0)
        .limit(2)
    if (!directs?.length) return
    const perPerson = parseFloat((activationPrice * EXIT_HELP_RATE).toFixed(4))
    for (const d of directs) {
        let ok = false
        for (let i = 0; i < 3 && !ok; i++) {
            const { data: cur } = await supabase.from('users').select('help_balance').eq('id', d.id).single()
            const oldBal = parseFloat(cur?.help_balance || 0)
            const { data: cas } = await supabase.from('users')
                .update({ help_balance: Math.round((oldBal + perPerson) * 10000) / 10000 })
                .eq('id', d.id).eq('help_balance', cur?.help_balance ?? oldBal).select('id')
            if (cas?.length) ok = true
        }
        if (!ok) console.error(`[ExitHelpBonus] CAS失败3次，用户${d.id}拼团帮扶${perPerson}未到账`)
    }
}

// =====================================================================

async function triggerDirectOwnerBonus(supabase, ownerUserId, newUserId, plan) {
    if (!plan.directOwnerBonus) return
    // 条件：直推伙伴是「出局的店主」（exit_count > 0），最多2位
    const { data: exitedDirects } = await supabase.from('users')
        .select('id, help_balance')
        .eq('referrer_id', ownerUserId)
        .gt('exit_count', 0)
        .limit(2)
    if (!exitedDirects || exitedDirects.length === 0) return

    // 帮扶补贴总额10%（directOwnerBonus），1人出局拿全额，2人出局各5%，存入 help_balance（不可提现，用于拼团）
    const bonusPerPerson = parseFloat((plan.directOwnerBonus / exitedDirects.length).toFixed(4))
    for (const u of exitedDirects) {
        let ok = false
        for (let i = 0; i < 3 && !ok; i++) {
            const { data: cur } = await supabase.from('users').select('help_balance').eq('id', u.id).single()
            const oldBal = parseFloat(cur?.help_balance || 0)
            const { data: cas } = await supabase.from('users')
                .update({ help_balance: Math.round((oldBal + bonusPerPerson) * 10000) / 10000 })
                .eq('id', u.id).eq('help_balance', cur?.help_balance ?? oldBal).select('id')
            if (cas?.length) {
                ok = true
                await logReward(supabase, u.id, newUserId, 'direct_owner_bonus', bonusPerPerson, plan.name, `模型帮扶补贴(出局直推10%→help_balance)`).catch(() => {})
            }
        }
        if (!ok) console.error(`[DirectOwnerBonus] CAS失败3次，用户${u.id}帮扶${bonusPerPerson}未到账`)
    }
}

// =====================================================================
//  triggerUpgrade（自动升级 10→30→60→100→200）
// =====================================================================

async function triggerUpgrade(supabase, userId, currentCardType, referrerId, currentRepurchase) {
    const chain = UPGRADE_CHAIN[currentCardType]
    if (!chain) {
        // ELITE顶档：复投池满50自动循环复投
        if (currentCardType === 'ELITE' && currentRepurchase >= 50) {
            await triggerEliteLoop(supabase, userId, referrerId, currentRepurchase)
        }
        return
    }

    const { nextPlan, threshold } = chain
    if (currentRepurchase < threshold) return

    const nextPlanConfig = PLANS[nextPlan]
    if (!nextPlanConfig) return

    // 读取当前 activated_types 以便更新
    const { data: userData } = await supabase.from('users').select('activated_types, is_partner').eq('id', userId).single()
    const existingActivated = Array.isArray(userData?.activated_types) ? userData.activated_types : []
    const newActivatedAfterUpgrade = [...new Set([...existingActivated, nextPlan])]

    // 扣减升级池 + 升档（原子锁：card_type 和 repurchase_balance 条件防并发重复升级）
    const { data: upRes } = await supabase.from('users').update({
        repurchase_balance: Math.max(0, currentRepurchase - threshold),
        card_type: nextPlan,
        activated_types: newActivatedAfterUpgrade
    }).eq('id', userId).eq('card_type', currentCardType).gte('repurchase_balance', threshold).select('id')
    if (!upRes?.length) return  // 已被并发抢先升级，直接退出

    // 合伙人晋升检查
    if (!userData?.is_partner) await checkAndGrantPartner(supabase, userId, newActivatedAfterUpgrade)

    await supabase.from('subscription_logs').insert({
        user_id: userId, plan_type: nextPlan, amount: 0,
        start_date: new Date().toISOString(),
        end_date: new Date('2099-12-31T23:59:59Z').toISOString(),
        status: 'auto_upgrade'
    })

    // 以新档位奖励重新进入模型
    try {
        await activateAndRotateWithFlag(supabase, userId, referrerId, nextPlanConfig, nextPlan)
    } catch (e) {
        console.error('[Upgrade] 模型旋转失败:', e)
    }

    console.log(`[Upgrade] ${userId}: ${currentCardType} → ${nextPlan}`)
}

// =====================================================================
//  triggerEliteLoop（ELITE顶档循环复投：满50扣50，以ELITE档位复投）
//  _depth 防止无限递归，最多循环3次
// =====================================================================

async function triggerEliteLoop(supabase, userId, referrerId, currentRepurchase, _depth = 0) {
    // 防止无限递归：每次触发最多执行3次循环
    if (_depth >= 3) {
        console.warn(`[EliteLoop] ${userId}: 已达最大深度(3)，停止循环复投`)
        return
    }

    const targetTier = 'ELITE'
    const cost = 50  // ELITE顶档：满50自动循环复投
    if (currentRepurchase < cost) return  // 复投池不足50，等待积累

    const targetPlan = PLANS[targetTier]
    if (!targetPlan) return

    // 扣减复投池（原子锁：gte 条件防并发重复触发）
    const remaining = Math.max(0, currentRepurchase - cost)
    const { data: lockRes } = await supabase.from('users').update({
        repurchase_balance: remaining
    }).eq('id', userId).gte('repurchase_balance', cost).select('id')
    if (!lockRes?.length) return  // 被并发抢先处理，退出

    await supabase.from('subscription_logs').insert({
        user_id: userId, plan_type: targetTier, amount: cost,
        start_date: new Date().toISOString(),
        end_date: new Date('2099-12-31T23:59:59Z').toISOString(),
        status: 'elite_loop_reinvest'
    }).catch(() => {})

    // 重新进入模型（继续触发平级奖，skipUpgradeCheck=true 防止再次触发EliteLoop）
    try {
        await activateAndRotateWithFlag(supabase, userId, referrerId, targetPlan, targetTier)
    } catch (e) {
        console.error('[EliteLoop] 模型旋转失败:', e)
    }

    console.log(`[EliteLoop] ${userId}: ELITE顶档循环复投（扣${cost}，剩余${remaining}，深度${_depth}）`)
}

async function activateAndRotateWithFlag(supabase, newUserId, referrerId, plan, planType) {
    const result = { spotBonusReceiver: null, slotAExited: null, contribution: false, contributionTarget: null, newLeader: null, levelBonuses: [] }
    if (!referrerId) { await createShop(supabase, newUserId, planType); return result }
    const referrer = await getUser(supabase, referrerId)
    if (!referrer) { await createShop(supabase, newUserId, planType); return result }
    const shouldContribute = checkContribution(referrer)
    if (referrer.role === 'manager' && referrer.shop_owner_id) {
        await rotateModel(supabase, referrer.shop_owner_id, newUserId, planType, result, referrer.current_shop_id)
    } else if (shouldContribute && !referrer.has_contributed) {
        // CAS：原子抢锁贡献标记，防并发双重贡献
        const { data: contribLock2 } = await supabase.from('users')
            .update({ has_contributed: true })
            .eq('id', referrerId).eq('has_contributed', false).select('id')
        if (contribLock2?.length) {
            result.contribution = true
            if (referrer.referrer_id) {
                await rotateModel(supabase, referrer.referrer_id, newUserId, planType, result)
            }
        } else {
            await rotateModel(supabase, referrerId, newUserId, planType, result)
        }
    } else {
        await rotateModel(supabase, referrerId, newUserId, planType, result)
    }
    if (result.spotBonusReceiver) {
        let spotOk = false
        for (let _i = 0; _i < 3; _i++) {
            const { data: recv } = await supabase.from('users').select('coin_balance').eq('id', result.spotBonusReceiver).single()
            const oldBal = parseFloat(recv?.coin_balance || 0)
            const { data: cr } = await supabase.from('users')
                .update({ coin_balance: Math.round((oldBal + plan.spotBonus) * 10000) / 10000 })
                .eq('id', result.spotBonusReceiver).eq('coin_balance', recv?.coin_balance ?? oldBal).select('id')
            if (cr?.length) { spotOk = true; break }
        }
        if (spotOk) {
            await logReward(supabase, result.spotBonusReceiver, newUserId, 'spot_bonus', plan.spotBonus, planType, `升级见点奖(25%)：${plan.name}`).catch(() => {})
        } else {
            console.error(`[SpotBonus] 升级CAS失败3次，接收方${result.spotBonusReceiver}见点奖${plan.spotBonus}未到账`)
        }
        await triggerDirectOwnerBonus(supabase, result.spotBonusReceiver, newUserId, plan).catch(e => console.error('[DirectOwnerBonus]', e))
        await checkAndGrantServiceProvider(supabase, result.spotBonusReceiver).catch(() => {})
    }
    if (referrerId) {
        result.levelBonuses = await triggerLevelBonus(supabase, referrerId, newUserId, plan, planType, true)
    }
    if (result.slotAExited) {
        const exitedUser = await getUser(supabase, result.slotAExited)
        if (exitedUser && exitedUser.role !== 'owner') {
            const contributionSlot = exitedUser.has_slide_down ? null : 'first'
            await supabase.from('users').update({
                role: 'owner', is_independent: true,
                shop_owner_id: null, contribution_slot: contributionSlot
            }).eq('id', result.slotAExited)
            await createShop(supabase, result.slotAExited, planType)
        }
    }
    return result
}

// =====================================================================
//  辅助
// =====================================================================

async function getUser(supabase, userId) {
    if (!userId) return null
    const { data } = await supabase.from('users')
        .select('id, role, referrer_id, shop_owner_id, direct_push_count, is_active, has_contributed, contribution_slot, has_slippage, current_shop_id, coin_balance')
        .eq('id', userId).single()
    if (data) { data.is_member = data.is_active; data.has_slide_down = data.has_slippage }
    return data
}

async function createShop(supabase, ownerId, modelType) {
    // 先查是否已存在（防并发重复创建）
    const { data: existing } = await supabase.from('shops').select('*')
        .eq('slot1_owner_id', ownerId).eq('model_type', modelType).single()
    if (existing) return existing

    const { data, error } = await supabase.from('shops').insert({
        slot1_owner_id: ownerId, model_type: modelType,
        slota_tenant_id: null, total_members: 0, rotation_count: 0
    }).select().single()

    if (error) {
        // insert 失败可能是并发已创建，fallback 再查一次
        const { data: fallback } = await supabase.from('shops').select('*')
            .eq('slot1_owner_id', ownerId).eq('model_type', modelType).single()
        if (fallback) return fallback
        console.error('[Shop] 创建失败:', error)
    }
    return data
}

async function logReward(supabase, userId, fromUserId, rewardType, amount, planType, description) {
    await supabase.from('reward_logs').insert({ user_id: userId, from_user_id: fromUserId, reward_type: rewardType, amount, plan_type: planType, description })
}

function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
    return code
}

// =====================================================================
//  状态查询
// =====================================================================

router.get('/status/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    try {
        const { data: user, error } = await supabase.from('users')
            .select('is_active, card_type, invite_code, balance, coin_balance, help_balance, repurchase_balance, subsidy_pool, shopping_gold, profit_balance, role, shop_owner_id, is_independent, direct_push_count, exit_count, contribution_slot, has_contributed, has_slippage, current_shop_id, activated_types, is_partner, is_service_provider, coupon_count')
            .eq('id', userId).single()

        if (error || !user) return Response.json({ code: 404, message: '用户不存在' })

        let shopInfo = null
        if (user.current_shop_id) {
            const { data: shop } = await supabase.from('shops').select('id, slot1_owner_id, slota_tenant_id, total_members, rotation_count').eq('id', user.current_shop_id).single()
            shopInfo = shop
        }
        if (user.role === 'owner') {
            const { data: myShop } = await supabase.from('shops').select('id, slot1_owner_id, slota_tenant_id, total_members, rotation_count').eq('slot1_owner_id', userId).order('created_at', { ascending: false }).limit(1).single()
            if (myShop) shopInfo = myShop
        }

        // ── 数据自愈：检查店长(slota_tenant_id)是否已独立，清除过期占位 ──
        // 场景：店长通过出局/晋升成为独立店主后，旧店铺的 slota_tenant_id 未及时清空
        if (shopInfo?.slota_tenant_id) {
            const { data: tenantUser } = await supabase.from('users')
                .select('role, is_independent').eq('id', shopInfo.slota_tenant_id).single()
            // 清除条件：店长已独立，或店长记录在用户表中根本不存在
            const shouldClear = !tenantUser || tenantUser.role === 'owner' || tenantUser.is_independent
            if (shouldClear) {
                await supabase.from('shops')
                    .update({ slota_tenant_id: null })
                    .eq('id', shopInfo.id)
                    .eq('slota_tenant_id', shopInfo.slota_tenant_id)
                    .catch(e => console.warn('[Shop] 清除过期店长失败:', e))
                console.log(`[Shop] 自愈：清除店铺${shopInfo.id}的过期店长${shopInfo.slota_tenant_id}（tenantUser存在:${!!tenantUser}）`)
                shopInfo = { ...shopInfo, slota_tenant_id: null }
            }
        }

        // 获取店内两个位置的邀请码
        let shopOwnerInviteCode = null
        let shopTenantInviteCode = null
        if (shopInfo) {
            const otherIds = [shopInfo.slot1_owner_id, shopInfo.slota_tenant_id].filter(id => id && id !== userId)
            if (otherIds.length > 0) {
                const { data: otherUsers } = await supabase.from('users').select('id, invite_code').in('id', otherIds)
                const ownerUser = (otherUsers || []).find(u => String(u.id) === String(shopInfo.slot1_owner_id))
                const tenantUser2 = (otherUsers || []).find(u => String(u.id) === String(shopInfo.slota_tenant_id))
                // 当前用户自己的邀请码直接用 user.invite_code
                shopOwnerInviteCode = String(shopInfo.slot1_owner_id) === String(userId) ? user.invite_code : (ownerUser?.invite_code || null)
                shopTenantInviteCode = String(shopInfo.slota_tenant_id) === String(userId) ? user.invite_code : (tenantUser2?.invite_code || null)
            } else {
                // 两个位置都是自己（独立店铺只有自己）
                shopOwnerInviteCode = String(shopInfo.slot1_owner_id) === String(userId) ? user.invite_code : null
                shopTenantInviteCode = String(shopInfo.slota_tenant_id) === String(userId) ? user.invite_code : null
            }
        }

        const chain = UPGRADE_CHAIN[user.card_type]
        const profitRate = PROFIT_RATES[user.card_type] || null

        // 已激活档位列表（优先读 activated_types 字段，最可靠）
        const activatedTiers = Array.isArray(user.activated_types) ? user.activated_types : []

        return Response.json({
            code: 200,
            data: {
                isMember: user.is_active, isActive: user.is_active,
                cardType: user.card_type, cardName: PLANS[user.card_type]?.name || '',
                inviteCode: user.invite_code,
                shopOwnerInviteCode,
                shopTenantInviteCode,
                balance: parseFloat(user.coin_balance) || parseFloat(user.balance) || 0,
                coinBalance: parseFloat(user.coin_balance) || parseFloat(user.balance) || 0,
                repurchaseBalance: parseFloat(user.repurchase_balance) || 0,
                subsidyPool: parseFloat(user.subsidy_pool) || 0,
                shoppingGold: parseFloat(user.shopping_gold) || 0,
                shoppingGoldStartDate: null,
                profitBalance: parseFloat(user.profit_balance) || 0,
                profitRate,
                upgradeThreshold: chain?.threshold || null,
                role: user.role, shopOwnerId: user.shop_owner_id,
                isIndependent: user.is_independent,
                directPushCount: user.direct_push_count,
                contributionSlot: user.contribution_slot,
                hasContributed: user.has_contributed,
                hasSlideDown: user.has_slippage,
                shop: shopInfo,
                activatedTiers,
                isPartner: !!user.is_partner,
                isServiceProvider: !!user.is_service_provider,
                exitCount: user.exit_count || 0,
                helpBalance: parseFloat(user.help_balance) || 0,
                couponCount: user.coupon_count || 0
            }
        })
    } catch (e) {
        return Response.json({ code: 500, message: '获取状态失败' }, { status: 500 })
    }
})

router.get('/team-stats/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    try {
        let allMembers = [], currentLevel = [userId], directCount = 0
        for (let depth = 0; depth < 6; depth++) {
            const { data: levelUsers } = await supabase.from('users').select('id, is_active').in('referrer_id', currentLevel)
            if (!levelUsers?.length) break
            if (depth === 0) directCount = levelUsers.length
            allMembers = allMembers.concat(levelUsers)
            currentLevel = levelUsers.map(u => u.id)
        }
        return Response.json({ code: 200, data: { totalCount: allMembers.length, activeCount: allMembers.filter(u => u.is_active).length, directCount } })
    } catch (e) {
        return Response.json({ code: 500, message: '获取团队统计失败' }, { status: 500 })
    }
})

router.get('/earnings/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    try {
        const [{ data: rewards, error }, { data: partnerDivs }, { data: userInfo }] = await Promise.all([
            supabase.from('reward_logs').select('reward_type, amount, created_at').eq('user_id', userId),
            supabase.from('partner_dividends').select('amount').eq('user_id', userId),
            supabase.from('users').select('activated_types, card_type, pintuan_cumulative, pintuan_pending').eq('id', userId).single()
        ])
        if (error) return Response.json({ code: 500, message: '查询收益失败' })
        // 按中国时区(UTC+8)计算今日开始时间
        const nowMs = Date.now()
        const chinaMidnightMs = Math.floor((nowMs + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000
        const todayStart = new Date(chinaMidnightMs).toISOString()
        let totalEarnings = 0, todayEarnings = 0, spotBonusTotal = 0, levelBonusTotal = 0, dailyDividendTotal = 0, pintuanProfitTotal = 0
        ;(rewards || []).forEach(r => {
            const amount = parseFloat(r.amount) || 0
            totalEarnings += amount
            if (r.created_at >= todayStart) todayEarnings += amount
            if (r.reward_type === 'spot_bonus') spotBonusTotal += amount
            if (r.reward_type === 'level_bonus') levelBonusTotal += amount
            if (r.reward_type === 'daily_dividend') dailyDividendTotal += amount
            if (r.reward_type === 'pintuan_profit') pintuanProfitTotal += amount
        })
        // 合伙人分红（存在 partner_dividends 表）
        const partnerDividendTotal = (partnerDivs || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        dailyDividendTotal += partnerDividendTotal
        totalEarnings += partnerDividendTotal
        // 累计激活消费（产品采购进度）
        const PLAN_PRICES = { BASIC: 20, PREMIUM: 50, ELITE: 100, TIER_300: 200, TIER_500: 500, TIER_1000: 1000 }
        const activatedTypes = Array.isArray(userInfo?.activated_types) ? userInfo.activated_types : []
        const activationSpend = activatedTypes.reduce((s, t) => s + (PLAN_PRICES[t] || 0), 0)
        // 升档复投池数据
        const pintuanCumulative = parseFloat(userInfo?.pintuan_cumulative) || 0
        const pintuanPending    = parseFloat(userInfo?.pintuan_pending) || 0
        const currentTier       = userInfo?.card_type || null
        const NEXT_TIER_PRICES  = { BASIC: 50, PREMIUM: 100, ELITE: 200, TIER_300: 500, TIER_500: 1000 }
        const nextTierPrice     = currentTier ? (NEXT_TIER_PRICES[currentTier] || null) : null
        return Response.json({ code: 200, data: { totalEarnings, todayEarnings, spotBonusTotal, levelBonusTotal, dailyDividendTotal, pintuanProfitTotal, activationSpend, rewardCount: (rewards || []).length, pintuanCumulative, pintuanPending, currentTier, nextTierPrice } })
    } catch (e) {
        return Response.json({ code: 500, message: '获取收益失败' }, { status: 500 })
    }
})

router.get('/transactions/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'all'
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
    try {
        const all = []
        {
            let q = supabase.from('transactions').select('id, user_id, type, amount, from_user_id, to_user_id, generation, status, note, created_at').or(`user_id.eq.${userId},to_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(200)
            if (type !== 'all') q = q.eq('type', type)
            const { data: rows } = await q
            ;(rows || []).forEach(r => all.push({ id: r.id, type: r.type, amount: parseFloat(r.amount) || 0, fromUserId: r.from_user_id, toUserId: r.to_user_id, generation: r.generation, note: r.note, status: r.status || 'completed', timestamp: new Date(r.created_at).getTime() }))
        }
        const rewardTypes = ['spot_bonus', 'level_bonus', 'daily_dividend', 'pintuan_profit', 'help_bonus']
        if (type === 'all' || rewardTypes.includes(type)) {
            let q = supabase.from('reward_logs').select('id, user_id, from_user_id, reward_type, amount, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200)
            if (type !== 'all') q = q.eq('reward_type', type)
            const { data: rows } = await q
            ;(rows || []).forEach(r => all.push({ id: `rl_${r.id}`, type: r.reward_type, amount: parseFloat(r.amount) || 0, fromUserId: r.from_user_id, toUserId: r.user_id, note: r.description, status: 'completed', timestamp: new Date(r.created_at).getTime() }))
        }
        all.sort((a, b) => b.timestamp - a.timestamp)
        const start = (page - 1) * pageSize
        const paged = all.slice(start, start + pageSize)
        const incomeTypes = ['spot_bonus', 'level_bonus', 'daily_dividend', 'pintuan_profit', 'help_bonus', 'admin_transfer']
        let totalIncome = 0, totalOutcome = 0
        all.forEach(t => {
            if (incomeTypes.includes(t.type) || (t.type === 'transfer' && t.toUserId === userId && t.fromUserId !== userId)) totalIncome += t.amount
            if (t.type === 'activation' || (t.type === 'transfer' && t.fromUserId === userId && t.toUserId !== userId)) totalOutcome += t.amount
        })
        return Response.json({ code: 200, data: { transactions: paged, total: all.length, hasMore: (start + pageSize) < all.length, stats: { totalIncome, totalOutcome } } })
    } catch (e) {
        return Response.json({ code: 500, message: '获取交易记录失败' }, { status: 500 })
    }
})

// subsidy-transfer 已停用：补贴池现为满30自动结算为分润，不支持手动互转
router.post('/subsidy-transfer', async () => {
    return Response.json({ code: 410, message: '补贴池已改为满30自动结算为分润，不支持互转' }, { status: 410 })
})

export const subscriptionRoutes = router
export { PLANS, TIER_ORDER, PROFIT_RATES, activateAndRotate, generateInviteCode, logReward }

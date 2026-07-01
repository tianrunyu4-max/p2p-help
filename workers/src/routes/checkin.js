/**
 * 签到路由 - Checkin Routes
 *
 * 10/30档：签到给积分（兑换产品，与 coin_balance 完全独立）
 * 60/100/200档：签到触发分润复利，不给积分
 *   分润余额 += (本金 + 分润余额) × 日利率
 *   本金 = 当前档位激活价（60/100/200）
 *   日利率：60档0.8% / 100档1.5% / 200档2.0%
 *   用户手动领取：POST /api/subscription/claim-profit
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/checkin' })

/**
 * GET /api/checkin/balance/:userId
 * 获取用户积分余额（从 checkin_logs - burn_logs 计算，与 coin_balance 完全独立）
 */
router.get('/balance/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    // 只有10/30档有积分，60+档不计入积分余额
    const TIER_REWARD = { BASIC: 10, PREMIUM: 30 }

    try {
        const [checkinRes, burnRes] = await Promise.all([
            supabase.from('checkin_logs').select('amount').eq('user_id', userId),
            supabase.from('burn_logs').select('amount').eq('user_id', userId)
        ])

        // 优先用 checkin_logs 精确计算（含燃烧扣分）
        if (!checkinRes.error && checkinRes.data?.length > 0) {
            const totalEarned = checkinRes.data.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
            const totalBurned = (!burnRes.error ? burnRes.data || [] : []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
            return Response.json({ code: 200, data: { balance: Math.max(0, totalEarned - totalBurned) } })
        }

        // 兜底：checkin_logs 为空或不可用时，用 users.checkin_total × 档位奖励
        if (checkinRes.error) console.error('[Balance] checkin_logs error:', JSON.stringify(checkinRes.error))
        const { data: user } = await supabase
            .from('users').select('checkin_total, card_type').eq('id', userId).single()
        const balance = (user?.checkin_total || 0) * (TIER_REWARD[user?.card_type] || 0)
        return Response.json({ code: 200, data: { balance } })

    } catch (error) {
        console.error('[Checkin Balance] Error:', error)
        return Response.json({ code: 500, message: '获取积分余额失败' }, { status: 500 })
    }
})

// 分润档位配置
const PROFIT_TIERS = {
    ELITE:    { price: 60,  rate: 0.008 },   // 60档  0.8%/天
    TIER_100: { price: 100, rate: 0.015 },   // 100档 1.5%/天
    TIER_200: { price: 200, rate: 0.020 }    // 200档 2.0%/天
}

// 积分签到档位（仅10/30档）
const POINT_TIERS = { BASIC: 10, PREMIUM: 30 }

/**
 * POST /api/checkin/claim
 * ⚠️ 已废弃（DEPRECATED）
 * 前端签到实际走 POST /api/engine/checkin
 * engine.js 已包含完整的积分/分润双轨逻辑（10/30档积分 + 60/100/200档复利）
 */
router.post('/claim', async () => {
    return Response.json({
        code: 410,
        message: '此接口已废弃，签到请使用 POST /api/engine/checkin'
    }, { status: 410 })
})

/**
 * POST /api/checkin/burn
 * 燃烧积分（断签时调用）
 * Body: { userId, amount, reason }
 */
router.post('/burn', async (request) => {
    const supabase = request.supabase
    
    try {
        const { userId, amount, reason } = await request.json()
        
        if (!userId) {
            return Response.json({
                code: 400,
                message: '缺少用户ID'
            })
        }
        
        // 计算当前积分（从日志，不依赖 coin_balance）
        const [checkinRes, burnRes] = await Promise.all([
            supabase.from('checkin_logs').select('amount').eq('user_id', userId),
            supabase.from('burn_logs').select('amount').eq('user_id', userId)
        ])
        const totalEarned = (checkinRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        const totalBurned = (burnRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        const currentPoints = Math.max(0, totalEarned - totalBurned)
        const burnAmount = Math.min(amount || currentPoints, currentPoints)

        // 积分系统与 coin_balance 完全独立，燃烧只记日志
        // 记录燃烧日志
        await supabase.from('burn_logs').insert({
            user_id: userId,
            amount: burnAmount,
            reason: reason || '断签燃烧',
            created_at: new Date().toISOString()
        })
        
        return Response.json({
            code: 200,
            message: '积分已燃烧',
            data: {
                burned: burnAmount,
                remaining: currentPoints - burnAmount
            }
        })
        
    } catch (error) {
        console.error('[Checkin Burn] Error:', error)
        return Response.json({ 
            code: 500, 
            message: '燃烧失败' 
        }, { status: 500 })
    }
})

/**
 * GET /api/checkin/stats/:userId
 * 获取用户签到统计
 */
router.get('/stats/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    const TIER_REWARD = { BASIC: 10, PREMIUM: 30 }

    try {
        const [checkinRes, burnRes] = await Promise.all([
            supabase.from('checkin_logs').select('amount').eq('user_id', userId),
            supabase.from('burn_logs').select('amount').eq('user_id', userId)
        ])

        // 优先用 checkin_logs 精确计算
        if (!checkinRes.error && checkinRes.data?.length > 0) {
            const totalEarned = checkinRes.data.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
            const totalBurned = (!burnRes.error ? burnRes.data || [] : []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
            return Response.json({
                code: 200,
                data: { totalCheckins: checkinRes.data.length, totalEarned, totalBurned }
            })
        }

        // 兜底：checkin_logs 为空或不可用时从 users 表估算
        if (checkinRes.error) console.error('[Stats] checkin_logs error:', JSON.stringify(checkinRes.error))
        const { data: user } = await supabase
            .from('users').select('checkin_total, card_type').eq('id', userId).single()
        const checkinTotal = user?.checkin_total || 0
        const tierReward = TIER_REWARD[user?.card_type] || 0
        return Response.json({
            code: 200,
            data: { totalCheckins: checkinTotal, totalEarned: checkinTotal * tierReward, totalBurned: 0 }
        })

    } catch (error) {
        console.error('[Checkin Stats] Error:', error)
        return Response.json({ code: 500, message: '获取统计失败' }, { status: 500 })
    }
})

/**
 * GET /api/checkin/history/:userId
 * 获取积分历史记录（签到 + 兑换 + 转账 + 燃烧），最近50条，统一格式
 * 返回：{ date, label, amount, direction: 'in'|'out' }
 */
router.get('/history/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase

    try {
        // 并行拉取：签到记录 + 燃烧记录（含兑换与断签燃烧）
        const [checkinRes, burnRes] = await Promise.all([
            supabase
                .from('checkin_logs')
                .select('amount, tier, checkin_date, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50),
            supabase
                .from('burn_logs')
                .select('amount, reason, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50)
        ])

        // 签到/兑换来源（checkin_logs）
        const checkinLogs = (checkinRes.data || []).map(log => {
            const date = log.checkin_date || log.created_at?.split('T')[0] || ''
            let label = '签到获得积分'
            if (log.tier === -1) label = '余额兑换积分'
            else if (log.tier === 0) label = '兑换获得积分'
            return { date, label, amount: Math.floor(log.amount), direction: 'in', _ts: log.created_at }
        })

        // 燃烧来源（burn_logs）- 区分断签/兑换/分润签到
        const burnLogs = (burnRes.data || []).map(log => {
            const date = log.created_at?.split('T')[0] || ''
            let label = '积分燃烧'
            const reason = log.reason || ''
            if (reason.includes('积分兑换余额')) label = '积分兑换余额'
            else if (reason.includes('断签清零')) label = '断签清零'
            else if (reason.includes('分润签到燃烧')) label = '分润签到燃烧'
            return { date, label, amount: Math.floor(log.amount), direction: 'out', _ts: log.created_at }
        })

        // 合并按时间倒序，取前50条
        const allLogs = [...checkinLogs, ...burnLogs]
            .sort((a, b) => new Date(b._ts) - new Date(a._ts))
            .slice(0, 50)
            .map(({ _ts, ...rest }) => rest) // 移除内部排序字段

        return Response.json({ code: 200, data: { logs: allLogs } })

    } catch (error) {
        console.error('[Checkin History] Error:', error)
        return Response.json({ code: 500, message: '获取历史失败' }, { status: 500 })
    }
})

/**
 * POST /api/checkin/transfer
 * 积分互转（点对点，完全独立于 coin_balance 余额系统）
 * Body: { fromUserId, toUserId, amount }
 * 条件：发送方连续签到 >= 5 天
 */
router.post('/transfer', async (request) => {
    const supabase = request.supabase

    try {
        const { fromUserId, toUserId, amount } = await request.json()

        // 基础参数校验
        if (!fromUserId || !toUserId || !amount) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        const idPattern = /^8\d{4}$/
        if (!idPattern.test(String(fromUserId)) || !idPattern.test(String(toUserId))) {
            return Response.json({ code: 400, message: '用户ID格式无效' })
        }

        const transferAmount = Math.floor(Number(amount))
        if (!transferAmount || transferAmount <= 0) {
            return Response.json({ code: 400, message: '积分数量无效（必须为正整数）' })
        }

        if (String(fromUserId) === String(toUserId)) {
            return Response.json({ code: 400, message: '不能互转给自己' })
        }

        // 验证发送方连续签到 >= 5 天
        const { data: fromUser, error: fromUserError } = await supabase
            .from('users')
            .select('id, checkin_consecutive_days')
            .eq('id', String(fromUserId))
            .single()

        if (fromUserError || !fromUser) {
            return Response.json({ code: 400, message: '发送方账户不存在' })
        }

        const consecutiveDays = fromUser.checkin_consecutive_days || 0
        if (consecutiveDays < 5) {
            return Response.json({
                code: 403,
                message: `需连续签到满5天才能互转积分（当前：${consecutiveDays}天）`
            })
        }

        // 计算发送方当前积分余额（checkin_logs - burn_logs，与 coin_balance 完全无关）
        const [checkinRes, burnRes] = await Promise.all([
            supabase.from('checkin_logs').select('amount').eq('user_id', String(fromUserId)),
            supabase.from('burn_logs').select('amount').eq('user_id', String(fromUserId))
        ])

        const totalEarned = (checkinRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        const totalBurned = (burnRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        const currentPoints = Math.max(0, totalEarned - totalBurned)

        if (currentPoints < transferAmount) {
            return Response.json({
                code: 400,
                message: `积分不足（当前：${Math.floor(currentPoints)}积分）`
            })
        }

        // 验证接收方存在
        const { data: toUser, error: toUserError } = await supabase
            .from('users')
            .select('id')
            .eq('id', String(toUserId))
            .single()

        if (toUserError || !toUser) {
            return Response.json({ code: 400, message: '接收方账户不存在，请确认ID是否正确' })
        }

        // 扣减发送方积分（写 burn_logs，与余额系统无关）
        const { error: burnError } = await supabase.from('burn_logs').insert({
            user_id: String(fromUserId),
            amount: transferAmount,
            reason: `积分互转给 ${toUserId}`,
            created_at: new Date().toISOString()
        })

        if (burnError) {
            console.error('[Checkin Transfer] burn failed:', burnError)
            return Response.json({ code: 500, message: '转出失败，请重试' })
        }

        // 增加接收方积分（写 checkin_logs）
        const { error: creditError } = await supabase.from('checkin_logs').insert({
            user_id: String(toUserId),
            amount: transferAmount,
            tier: 0,
            checkin_date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        })

        if (creditError) {
            console.error('[Checkin Transfer] CRITICAL: burned but credit failed, rolling back', creditError)
            // 回滚：写负数 burn_log 抵消扣减
            await supabase.from('burn_logs').insert({
                user_id: String(fromUserId),
                amount: -transferAmount,
                reason: '积分互转失败回滚',
                created_at: new Date().toISOString()
            })
            return Response.json({ code: 500, message: '到账失败，积分已退还，请重试' })
        }

        return Response.json({
            code: 200,
            message: '积分互转成功',
            data: { amount: transferAmount, toUserId: String(toUserId) }
        })

    } catch (error) {
        console.error('[Checkin Transfer] Error:', error)
        return Response.json({ code: 500, message: '积分互转失败: ' + error.message }, { status: 500 })
    }
})

export const checkinRoutes = router

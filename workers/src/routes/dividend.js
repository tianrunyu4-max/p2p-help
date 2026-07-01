/**
 * 分红路由 - Dividend Routes
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/dividend' })

/**
 * GET /api/dividend/status/:userId
 * 获取用户分红状态
 */
router.get('/status/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase

    try {
        // 获取用户信息
        const { data: user, error } = await supabase
            .from('users')
            .select('direct_push_count, card_type')
            .eq('id', userId)
            .single()

        if (error || !user) {
            return Response.json({ code: 404, message: '用户不存在' })
        }

        // 获取第一次订阅的卡类型
        const { data: firstSub } = await supabase
            .from('subscription_logs')
            .select('plan_type')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(1)
            .single()

        const firstCardType = firstSub?.plan_type || user.card_type

        // 获取累计分红
        const { data: tier5Logs } = await supabase
            .from('dividend_logs')
            .select('amount')
            .eq('user_id', userId)
            .eq('source_type', 'DAILY_5')

        const { data: tier10Logs } = await supabase
            .from('dividend_logs')
            .select('amount')
            .eq('user_id', userId)
            .eq('source_type', 'DAILY_10')

        const totalDividend5 = tier5Logs?.reduce((sum, l) => sum + parseFloat(l.amount), 0) || 0
        const totalDividend10 = tier10Logs?.reduce((sum, l) => sum + parseFloat(l.amount), 0) || 0

        // 封顶计算（新3档位系统）
        const tier5Cap = 600  // 分红上限
        const tier10Cap = 900 // 300档 × 3

        const result = {
            directPushCount: user.direct_push_count || 0,
            firstCardType
        }

        // 300档 → 5人池
        if (firstCardType === 'PREMIUM') {
            result.tier5 = {
                eligible: true,
                name: '5人分红池',
                totalReceived: totalDividend5,
                cap: tier10Cap,
                remaining: Math.max(0, tier10Cap - totalDividend5),
                isCapped: totalDividend5 >= tier10Cap
            }
        }

        // 300档 → 合伙人池
        if (firstCardType === 'PREMIUM') {
            result.tier10 = {
                eligible: true,
                name: '合伙人分红池',
                totalReceived: totalDividend10,
                cap: tier5Cap,
                remaining: Math.max(0, tier5Cap - totalDividend10),
                isCapped: totalDividend10 >= tier5Cap
            }
        }

        // 100档需要直推人数
        if (firstCardType === 'BASIC') {
            const count = user.direct_push_count || 0

            if (count >= 5 && count < 10) {
                result.tier5 = {
                    eligible: true,
                    name: '5人分红池',
                    totalReceived: totalDividend5,
                    cap: tier5Cap,
                    remaining: Math.max(0, tier5Cap - totalDividend5),
                    isCapped: totalDividend5 >= tier5Cap
                }
            }

            if (count >= 10) {
                result.tier10 = {
                    eligible: true,
                    name: '合伙人分红池',
                    totalReceived: totalDividend10,
                    cap: tier10Cap,
                    remaining: Math.max(0, tier10Cap - totalDividend10),
                    isCapped: totalDividend10 >= tier10Cap
                }
            }
        }

        return Response.json({ code: 200, data: result })

    } catch (error) {
        console.error('[Dividend Status] Error:', error)
        return Response.json({ code: 500, message: '获取状态失败' }, { status: 500 })
    }
})

/**
 * GET /api/dividend/logs/:userId
 * 获取分红记录
 */
router.get('/logs/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase

    try {
        const { data: logs, error } = await supabase
            .from('dividend_logs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            return Response.json({ code: 500, message: '获取记录失败' })
        }

        return Response.json({ code: 200, data: logs })

    } catch (error) {
        console.error('[Dividend Logs] Error:', error)
        return Response.json({ code: 500, message: '获取记录失败' }, { status: 500 })
    }
})

export const dividendRoutes = router

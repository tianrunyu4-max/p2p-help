/**
 * 转账路由 - Transfer Routes
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/transfer' })

// 转账配置
const TRANSFER_CONFIG = {
    FEE_RATE: 0.10,     // 10% 手续费
    BURN_RATE: 0.50,    // 手续费50%销毁
    MIN_AMOUNT: 1       // 最小转账金额
}

/**
 * GET /api/transfer/price
 * 获取今日价格
 */
router.get('/price', async (request) => {
    const env = request.env

    try {
        // 从缓存获取
        const cached = await env.CACHE?.get('transfer:price', { type: 'json' })
        if (cached) {
            return Response.json({ code: 200, data: cached })
        }

        // 计算今日价格（示例：基于供需的简单算法）
        const currentPrice = 0.00001
        const changePercent = (Math.random() * 10 - 5).toFixed(2)  // -5% ~ +5%

        const priceData = {
            currentPrice,
            changePercent: parseFloat(changePercent),
            updatedAt: new Date().toISOString()
        }

        // 缓存5分钟
        await env.CACHE?.put('transfer:price', JSON.stringify(priceData), {
            expirationTtl: 300
        })

        return Response.json({ code: 200, data: priceData })

    } catch (error) {
        console.error('[Price] Error:', error)
        return Response.json({
            code: 200,
            data: { currentPrice: 0.00001, changePercent: 0 }
        })
    }
})

/**
 * POST /api/transfer/send
 * 执行余额互转
 */
router.post('/send', async (request) => {
    const supabase = request.supabase

    try {
        const body = await request.json()
        const { fromUserId, toUserId, amount, transferToken } = body

        if (!fromUserId || !toUserId || !amount) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        // 验证一次性转账令牌（必须通过安全问题验证才能获得）
        const env = request.env
        if (!transferToken) {
            return Response.json({ code: 403, message: '请先完成安全验证' })
        }
        const tokenData = await env.CACHE?.get(`transfer_token:${fromUserId}`, { type: 'json' })
        if (!tokenData || tokenData.token !== transferToken) {
            return Response.json({ code: 403, message: '安全验证已过期，请重新验证' })
        }
        // 令牌一次性使用，立即删除
        await env.CACHE?.delete(`transfer_token:${fromUserId}`)

        // 校验 userId 格式（必须是 8 开头的5位数字）
        const idPattern = /^8\d{4}$/
        if (!idPattern.test(String(fromUserId)) || !idPattern.test(String(toUserId))) {
            return Response.json({ code: 400, message: '用户ID格式无效' })
        }

        const transferAmount = Number(amount)
        if (transferAmount <= 0 || transferAmount > 100000) {
            return Response.json({ code: 400, message: '转账金额无效' })
        }

        if (String(fromUserId) === String(toUserId)) {
            return Response.json({ code: 400, message: '不能转账给自己' })
        }

        // 自动确保两个用户都存在（不存在则创建，存在则不变）
        await supabase.from('users').upsert(
            [{ id: String(fromUserId) }, { id: String(toUserId) }],
            { onConflict: 'id', ignoreDuplicates: true }
        )

        // 查找付款人
        const { data: fromUser, error: fromError } = await supabase
            .from('users')
            .select('id, coin_balance, is_active, is_member')
            .eq('id', String(fromUserId))
            .single()

        if (fromError || !fromUser) {
            return Response.json({ code: 400, message: '账户初始化失败，请重试' })
        }

        // 未激活用户不能互转
        if (!fromUser.is_active && !fromUser.is_member) {
            return Response.json({ code: 403, message: '请先激活账号才能互转余额' })
        }

        if (parseFloat(fromUser.coin_balance) < transferAmount) {
            return Response.json({ code: 400, message: '余额不足' })
        }

        // 查找收款人
        const { data: toUser, error: toError } = await supabase
            .from('users')
            .select('id, coin_balance')
            .eq('id', String(toUserId))
            .single()

        if (toError || !toUser) {
            return Response.json({ code: 400, message: '收款账户异常，请重试' })
        }

        const fromBalance = parseFloat(fromUser.coin_balance)
        const toBalance = parseFloat(toUser.coin_balance)

        // ⚡ 乐观锁扣款：同时检查余额未被并发消耗
        const { data: deductResult, error: deductError } = await supabase
            .from('users')
            .update({ coin_balance: fromBalance - transferAmount })
            .eq('id', String(fromUserId))
            .eq('coin_balance', fromUser.coin_balance) // 乐观锁：余额未变才扣
            .gte('coin_balance', transferAmount)        // 双重保险：余额充足
            .select('id')

        if (deductError) {
            return Response.json({ code: 500, message: '转账失败，请重试' })
        }
        if (!deductResult || deductResult.length === 0) {
            return Response.json({ code: 400, message: '余额不足或账户状态已变更，请刷新后重试' })
        }

        // 到账（对方余额增加，即使此步失败也需补偿，记录日志）
        const { error: creditError } = await supabase
            .from('users')
            .update({ coin_balance: toBalance + transferAmount })
            .eq('id', String(toUserId))

        if (creditError) {
            // 严重错误：扣款已成功但到账失败，回滚扣款（用加回方式，不依赖旧快照）
            console.error('[Transfer] CRITICAL: deducted but credit failed, rolling back', creditError)
            const { data: cur } = await supabase.from('users').select('coin_balance').eq('id', String(fromUserId)).single()
            const restored = parseFloat((parseFloat(cur?.coin_balance || 0) + transferAmount).toFixed(4))
            const { error: rbErr } = await supabase.from('users')
                .update({ coin_balance: restored })
                .eq('id', String(fromUserId))
            if (rbErr) console.error('[Transfer] CRITICAL: rollback also failed:', rbErr)
            return Response.json({ code: 500, message: '转账失败，已退款，请重试' })
        }

        // 记录交易
        const txId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        await supabase.from('transactions').insert({
            id: txId,
            user_id: String(fromUserId),
            type: 'transfer',
            amount: transferAmount,
            from_user_id: String(fromUserId),
            to_user_id: String(toUserId),
            status: 'completed',
            note: '余额互转'
        })

        return Response.json({
            code: 200,
            message: '转账成功',
            data: { amount: transferAmount, toUserId }
        })

    } catch (error) {
        console.error('[Transfer] Error:', error)
        return Response.json({ code: 500, message: '转账失败: ' + error.message }, { status: 500 })
    }
})

/**
 * GET /api/transfer/history/:userId
 * 转账历史
 */
router.get('/history/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase

    try {
        const { data: transfers, error } = await supabase
            .from('transfers')
            .select(`
        id, amount, fee, burn_amount, status, created_at,
        from_user:from_user_id(phone, username),
        to_user:to_user_id(phone, username)
      `)
            .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            return Response.json({ code: 500, message: '获取记录失败' })
        }

        return Response.json({ code: 200, data: transfers })

    } catch (error) {
        console.error('[Transfer History] Error:', error)
        return Response.json({ code: 500, message: '获取记录失败' }, { status: 500 })
    }
})

export const transferRoutes = router

/**
 * 提现路由
 * POST /api/withdraw/submit  - 用户申请提现（立即扣余额，管理员批量打款）
 * GET  /api/withdraw/history - 用户提现记录
 * GET  /api/withdraw/pending - 管理员查看待处理
 * POST /api/withdraw/approve/:id - 管理员标记打款完成
 * POST /api/withdraw/reject/:id  - 管理员拒绝（退回余额）
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/withdraw' })

const MIN_AMOUNT = 10
const MAX_AMOUNT = 10000

/**
 * POST /api/withdraw/submit
 * Body: { userId, amount, walletAddress }
 * 立即扣余额 + 创建待处理记录
 */
router.post('/submit', async (request) => {
    const { supabase } = request

    try {
        const body = await request.json()
        const { userId, amount, walletAddress } = body

        if (!userId || !amount || !walletAddress) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        const amountNum = parseFloat(amount)
        if (isNaN(amountNum) || amountNum < MIN_AMOUNT) {
            return Response.json({ code: 400, message: `最低提现 $${MIN_AMOUNT}` })
        }
        if (amountNum > MAX_AMOUNT) {
            return Response.json({ code: 400, message: `单次最高提现 $${MAX_AMOUNT}` })
        }

        // 验证钱包地址格式（BSC BEP20 = 0x + 40 hex）
        if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
            return Response.json({ code: 400, message: '钱包地址格式无效，请填写 BSC BEP20 地址（0x开头42位）' })
        }

        // 查询用户余额
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, coin_balance, is_active')
            .eq('id', String(userId))
            .single()

        if (userErr || !user) {
            return Response.json({ code: 404, message: '用户不存在' })
        }

        if (!user.is_active) {
            return Response.json({ code: 403, message: '请先激活账号才能提现' })
        }

        const currentBalance = parseFloat(user.coin_balance) || 0
        if (currentBalance < amountNum) {
            return Response.json({ code: 400, message: `余额不足，当前余额 $${currentBalance.toFixed(2)}` })
        }

        // 10% 手续费：扣除全额，实际到账 90%
        const feeAmount = parseFloat((amountNum * 0.10).toFixed(4))
        const actualAmount = parseFloat((amountNum - feeAmount).toFixed(4))

        // 乐观锁扣余额（防并发超提）
        const newBalance = parseFloat((currentBalance - amountNum).toFixed(4))
        const { data: deductRes, error: deductErr } = await supabase
            .from('users')
            .update({ coin_balance: newBalance })
            .eq('id', String(userId))
            .eq('coin_balance', user.coin_balance)
            .gte('coin_balance', amountNum)
            .select('id')

        if (deductErr || !deductRes?.length) {
            return Response.json({ code: 400, message: '余额不足或账户状态已变更，请刷新重试' })
        }

        // 创建提现记录（记录实际到账金额，已扣10%手续费）
        const { data: record, error: recordErr } = await supabase
            .from('withdrawal_records')
            .insert({
                user_id: String(userId),
                amount: actualAmount,
                wallet_address: walletAddress,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (recordErr) {
            // 记录写入失败，回滚余额（用加回方式，不依赖旧快照，防止并发覆盖）
            console.error('[Withdraw] record insert failed, rolling back:', recordErr)
            const { data: cur } = await supabase.from('users').select('coin_balance').eq('id', String(userId)).single()
            const restored = parseFloat((parseFloat(cur?.coin_balance || 0) + amountNum).toFixed(4))
            const { error: rbErr } = await supabase.from('users')
                .update({ coin_balance: restored })
                .eq('id', String(userId))
            if (rbErr) console.error('[Withdraw] CRITICAL: rollback also failed:', rbErr)
            return Response.json({ code: 500, message: '提交失败，余额已退回，请重试' })
        }

        console.log(`[Withdraw] 用户${userId} 提现申请: 扣$${amountNum} 到账$${actualAmount} → ${walletAddress}`)

        return Response.json({
            code: 200,
            message: `✅ 申请成功！扣除 $${amountNum}（含10%手续费 $${feeAmount}），实际到账 $${actualAmount}`,
            data: {
                id: record.id,
                amount: actualAmount,
                fee: feeAmount,
                walletAddress,
                status: 'pending',
                newBalance: newBalance.toFixed(2)
            }
        })

    } catch (error) {
        console.error('[Withdraw] submit error:', error)
        return Response.json({ code: 500, message: '服务器错误' }, { status: 500 })
    }
})

/**
 * GET /api/withdraw/history?userId=xxx
 */
router.get('/history', async (request) => {
    const { supabase } = request
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) return Response.json({ code: 400, message: '请提供 userId' })

    try {
        const { data, error } = await supabase
            .from('withdrawal_records')
            .select('id, amount, wallet_address, status, created_at, processed_at')
            .eq('user_id', String(userId))
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) throw error
        return Response.json({ code: 200, data: data || [] })
    } catch (error) {
        return Response.json({ code: 500, message: '查询失败' }, { status: 500 })
    }
})

function checkAdminCode(request) {
    const envCode = (request.env?.ADMIN_CODE || '').trim()
    if (!envCode) return false
    const url = new URL(request.url)
    const provided = (url.searchParams.get('adminCode') || '').trim()
    return provided === envCode
}

/**
 * GET /api/withdraw/pending  - 管理员获取待处理列表
 */
router.get('/pending', async (request) => {
    if (!checkAdminCode(request)) {
        return Response.json({ code: 401, message: '无权限' }, { status: 401 })
    }
    const { supabase } = request
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'pending'

    try {
        const { data, error } = await supabase
            .from('withdrawal_records')
            .select('*')
            .eq('status', status)
            .order('created_at', { ascending: true })
            .limit(200)

        if (error) throw error
        return Response.json({ code: 200, data: data || [] })
    } catch (error) {
        return Response.json({ code: 500, message: '查询失败' }, { status: 500 })
    }
})

/**
 * POST /api/withdraw/approve/:id  - 管理员标记已打款
 * Body: { txid }  可选：链上交易哈希
 */
router.post('/approve/:id', async (request) => {
    if (!checkAdminCode(request)) {
        return Response.json({ code: 401, message: '无权限' }, { status: 401 })
    }
    const { supabase } = request
    const { id } = request.params

    try {
        const body = await request.json().catch(() => ({}))
        const { txid } = body

        const { data, error } = await supabase
            .from('withdrawal_records')
            .update({
                status: 'completed',
                txid: txid || null,
                processed_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('status', 'pending')
            .select()
            .single()

        if (error || !data) {
            return Response.json({ code: 400, message: '记录不存在或已处理' })
        }

        return Response.json({ code: 200, message: '已标记打款完成', data })
    } catch (error) {
        return Response.json({ code: 500, message: '操作失败' }, { status: 500 })
    }
})

/**
 * POST /api/withdraw/reject/:id  - 管理员拒绝，退回余额
 */
router.post('/reject/:id', async (request) => {
    if (!checkAdminCode(request)) {
        return Response.json({ code: 401, message: '无权限' }, { status: 401 })
    }
    const { supabase } = request
    const { id } = request.params

    try {
        const body = await request.json().catch(() => ({}))
        const { reason } = body

        // 获取提现记录
        const { data: record, error: fetchErr } = await supabase
            .from('withdrawal_records')
            .select('*')
            .eq('id', id)
            .eq('status', 'pending')
            .single()

        if (fetchErr || !record) {
            return Response.json({ code: 404, message: '记录不存在或已处理' })
        }

        // 标记拒绝
        const { error: updateErr } = await supabase
            .from('withdrawal_records')
            .update({
                status: 'rejected',
                reject_reason: reason || '',
                processed_at: new Date().toISOString()
            })
            .eq('id', id)

        if (updateErr) throw updateErr

        // 退回余额
        const { data: user } = await supabase
            .from('users').select('coin_balance').eq('id', record.user_id).single()
        if (user) {
            const refunded = parseFloat((parseFloat(user.coin_balance) + parseFloat(record.amount)).toFixed(4))
            await supabase.from('users')
                .update({ coin_balance: refunded })
                .eq('id', record.user_id)
        }

        return Response.json({ code: 200, message: '已拒绝，余额已退回' })
    } catch (error) {
        return Response.json({ code: 500, message: '操作失败' }, { status: 500 })
    }
})

export const withdrawRoutes = router

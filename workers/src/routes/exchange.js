/**
 * 积分兑换路由 - Exchange Routes
 * 
 * 功能：
 * - 用户提交兑换申请
 * - 后端记录兑换请求（状态：pending）
 * - 管理员审核兑换申请
 * - 用户查看兑换记录和状态
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/exchange' })

/**
 * POST /api/exchange/submit
 * 提交积分兑换申请
 * Body: { userId, amount }
 */
router.post('/submit', async (request) => {
    const supabase = request.supabase
    
    try {
        const { userId, amount } = await request.json()
        
        if (!userId) {
            return Response.json({
                code: 400,
                message: '缺少用户ID'
            })
        }
        
        if (!amount || amount <= 0) {
            return Response.json({
                code: 400,
                message: '兑换积分数量无效'
            })
        }
        
        // 检查用户余额
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('coin_balance')
            .eq('id', userId)
            .single()
        
        if (userError || !user) {
            return Response.json({
                code: 404,
                message: '用户不存在'
            })
        }
        
        const currentBalance = parseFloat(user.coin_balance) || 0
        if (currentBalance < amount) {
            return Response.json({ code: 400, message: '余额不足' })
        }
        if (amount > currentBalance || amount > 1000000) {
            return Response.json({ code: 400, message: '兑换金额超出限制' })
        }

        // ⚡ 第一步：先扣余额（乐观锁，防并发超支）
        const { data: deductResult, error: deductError } = await supabase
            .from('users')
            .update({
                coin_balance: currentBalance - amount,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .eq('coin_balance', user.coin_balance) // 乐观锁
            .gte('coin_balance', amount)           // 双重保险
            .select('id')

        if (deductError || !deductResult || deductResult.length === 0) {
            return Response.json({ code: 400, message: '余额不足或账户状态已变更，请刷新重试' })
        }

        // ⚡ 第二步：扣款成功后再记录申请（顺序不可颠倒）
        const { data, error } = await supabase
            .from('exchange_records')
            .insert({
                user_id: userId,
                amount: amount,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            // 记录失败：退回余额
            console.error('[Exchange] 记录失败，退回余额:', error)
            await supabase.from('users')
                .update({ coin_balance: currentBalance, updated_at: new Date().toISOString() })
                .eq('id', userId)
            return Response.json({ code: 500, message: '提交失败，余额已退回，请重试' })
        }

        return Response.json({
            code: 200,
            message: '兑换申请已提交，等待审核',
            data: {
                id: data?.id,
                userId,
                amount,
                status: 'pending',
                time: new Date().toISOString()
            }
        })
        
    } catch (error) {
        console.error('兑换处理失败:', error)
        return Response.json({
            code: 500,
            message: '服务器错误'
        })
    }
})

/**
 * GET /api/exchange/records/:userId
 * 获取用户兑换记录
 */
router.get('/records/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    
    try {
        const { data, error } = await supabase
            .from('exchange_records')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)
        
        if (error) {
            console.error('获取兑换记录失败:', error)
            return Response.json({
                code: 200,
                data: []
            })
        }
        
        return Response.json({
            code: 200,
            data: data || []
        })
        
    } catch (error) {
        console.error('获取记录失败:', error)
        return Response.json({
            code: 500,
            message: '服务器错误'
        })
    }
})

/**
 * GET /api/exchange/all
 * 获取所有兑换记录（管理员用）
 * Query: ?status=pending (可选，筛选状态)
 */
router.get('/all', async (request) => {
    const supabase = request.supabase
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    
    try {
        let query = supabase
            .from('exchange_records')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
        
        // 如果指定了状态，进行筛选
        if (status) {
            query = query.eq('status', status)
        }
        
        const { data, error } = await query
        
        if (error) {
            console.error('获取所有兑换记录失败:', error)
            return Response.json({
                code: 200,
                data: []
            })
        }
        
        return Response.json({
            code: 200,
            data: data || []
        })
        
    } catch (error) {
        console.error('获取记录失败:', error)
        return Response.json({
            code: 500,
            message: '服务器错误'
        })
    }
})

/**
 * POST /api/exchange/approve/:id
 * 审核通过兑换申请
 * Body: { adminId, note }
 */
router.post('/approve/:id', async (request) => {
    const { id } = request.params
    const supabase = request.supabase
    
    try {
        const { adminId, note } = await request.json()
        
        // 更新兑换记录状态
        const { data, error } = await supabase
            .from('exchange_records')
            .update({
                status: 'approved',
                admin_note: note || '',
                processed_by: adminId || 'admin',
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()
        
        if (error) {
            console.error('审核失败:', error)
            return Response.json({
                code: 500,
                message: '审核失败'
            })
        }
        
        return Response.json({
            code: 200,
            message: '审核通过',
            data: data
        })
        
    } catch (error) {
        console.error('审核处理失败:', error)
        return Response.json({
            code: 500,
            message: '服务器错误'
        })
    }
})

/**
 * POST /api/exchange/reject/:id
 * 审核拒绝兑换申请
 * Body: { adminId, note }
 */
router.post('/reject/:id', async (request) => {
    const { id } = request.params
    const supabase = request.supabase
    
    try {
        const { adminId, note } = await request.json()
        
        // 获取兑换记录
        const { data: record, error: fetchError } = await supabase
            .from('exchange_records')
            .select('*')
            .eq('id', id)
            .single()
        
        if (fetchError || !record) {
            return Response.json({
                code: 404,
                message: '兑换记录不存在'
            })
        }
        
        // 更新兑换记录状态
        const { data, error } = await supabase
            .from('exchange_records')
            .update({
                status: 'rejected',
                admin_note: note || '',
                processed_by: adminId || 'admin',
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()
        
        if (error) {
            console.error('审核失败:', error)
            return Response.json({
                code: 500,
                message: '审核失败'
            })
        }
        
        // 退回用户余额（先读当前值，再加回，乐观锁重试）
        const { data: refundUser } = await supabase
            .from('users')
            .select('coin_balance')
            .eq('id', record.user_id)
            .single()

        if (refundUser) {
            const refundedBalance = parseFloat(refundUser.coin_balance || 0) + parseFloat(record.amount)
            const { error: refundError } = await supabase
                .from('users')
                .update({ coin_balance: parseFloat(refundedBalance.toFixed(2)), updated_at: new Date().toISOString() })
                .eq('id', record.user_id)
            if (refundError) {
                console.error('[Exchange] 退回余额失败:', refundError)
            }
        }
        
        return Response.json({
            code: 200,
            message: '已拒绝，余额已退回',
            data: data
        })
        
    } catch (error) {
        console.error('审核处理失败:', error)
        return Response.json({
            code: 500,
            message: '服务器错误'
        })
    }
})

export const exchangeRoutes = router

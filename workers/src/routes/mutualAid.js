/**
 * 互助补贴路由
 *
 * 规则：
 * - 每次参与花 100（从 mutual_aid_balance 扣）
 * - 每天最多 10 次
 * - 队列总人数 >= 30 才开始匹配
 * - 匹配后：你给 2 个最早等待收款的人各转 50（共转出 100）
 * - 你进入等待收款状态，凑满 150 后自动到账 mutual_aid_balance
 * - mutual_aid_balance 满 100 可提至主余额，主余额也可划入互助余额
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/mutual-aid' })

const JOIN_COST = 100        // 每次参与花费
const RECEIVE_TARGET = 150   // 收满多少完成
const PAY_PER_PERSON = 50    // 每人转多少
const QUEUE_MIN = 30         // 队列最少人数才开始匹配
const DAILY_MAX = 10         // 每日最多参与次数

// ── 获取用户互助状态 ──────────────────────────────────────────
router.get('/status/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    try {
        const { data: user } = await supabase.from('users')
            .select('mutual_aid_balance').eq('id', userId).single()

        const todayStr = new Date().toISOString().split('T')[0]
        const { data: todayEntries } = await supabase.from('mutual_aid_queue')
            .select('id').eq('user_id', userId).eq('participate_date', todayStr)

        const { data: activeEntries } = await supabase.from('mutual_aid_queue')
            .select('id, status, received_amount, paid_to_1, paid_to_2, created_at, matched_at')
            .eq('user_id', userId)
            .in('status', ['pending', 'receiving'])
            .order('created_at', { ascending: true })

        const { count: totalQueue } = await supabase.from('mutual_aid_queue')
            .select('id', { count: 'exact', head: true })
            .in('status', ['pending', 'receiving'])

        return Response.json({
            code: 200,
            data: {
                mutualAidBalance: parseFloat(user?.mutual_aid_balance || 0),
                todayCount: todayEntries?.length || 0,
                dailyMax: DAILY_MAX,
                totalQueue: totalQueue || 0,
                queueMin: QUEUE_MIN,
                activeEntries: activeEntries || []
            }
        })
    } catch (e) {
        return Response.json({ code: 500, message: '获取失败: ' + e.message }, { status: 500 })
    }
})

// ── 参与排队 ──────────────────────────────────────────────────
router.post('/join', async (request) => {
    const supabase = request.supabase
    const { userId } = await request.json()
    if (!userId) return Response.json({ code: 400, message: '缺少userId' }, { status: 400 })

    try {
        // 1. 每日限次检查
        const todayStr = new Date().toISOString().split('T')[0]
        const { count: todayCount } = await supabase.from('mutual_aid_queue')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId).eq('participate_date', todayStr)

        if ((todayCount || 0) >= DAILY_MAX)
            return Response.json({ code: 400, message: `每日最多参与${DAILY_MAX}次` }, { status: 400 })

        // 2. CAS 扣除 mutual_aid_balance
        let casOk = false
        let userBalance = 0
        for (let i = 0; i < 3 && !casOk; i++) {
            const { data: u } = await supabase.from('users')
                .select('mutual_aid_balance').eq('id', userId).single()
            userBalance = parseFloat(u?.mutual_aid_balance || 0)
            if (userBalance < JOIN_COST)
                return Response.json({ code: 400, message: `互助余额不足${JOIN_COST}` }, { status: 400 })

            const newBal = Math.round((userBalance - JOIN_COST) * 10000) / 10000
            const { data: cas } = await supabase.from('users')
                .update({ mutual_aid_balance: newBal })
                .eq('id', userId).eq('mutual_aid_balance', u.mutual_aid_balance)
                .select('id')
            if (cas?.length) casOk = true
        }
        if (!casOk) return Response.json({ code: 500, message: '操作冲突，请重试' }, { status: 500 })

        // 3. 创建队列条目
        const { data: entry } = await supabase.from('mutual_aid_queue').insert({
            user_id: userId,
            status: 'pending',
            participate_date: todayStr
        }).select().single()

        // 4. 尝试立即匹配（异步不阻塞响应）
        processQueue(supabase, entry.id).catch(e => console.error('[MutualAid] 匹配失败:', e))

        return Response.json({ code: 200, message: '已加入排队', data: { entryId: entry.id } })
    } catch (e) {
        return Response.json({ code: 500, message: '参与失败: ' + e.message }, { status: 500 })
    }
})

// ── 互助余额 → 主余额（满100可提） ──────────────────────────
router.post('/to-balance', async (request) => {
    const supabase = request.supabase
    const { userId, amount } = await request.json()
    if (!userId || !amount) return Response.json({ code: 400, message: '参数缺失' }, { status: 400 })

    const withdrawAmount = parseFloat(amount)
    if (withdrawAmount < 100 || withdrawAmount <= 0)
        return Response.json({ code: 400, message: '最少提取100' }, { status: 400 })

    try {
        for (let i = 0; i < 3; i++) {
            const { data: u } = await supabase.from('users')
                .select('mutual_aid_balance, coin_balance').eq('id', userId).single()
            const maBal = parseFloat(u?.mutual_aid_balance || 0)
            if (maBal < withdrawAmount)
                return Response.json({ code: 400, message: '互助余额不足' }, { status: 400 })

            const newMa = Math.round((maBal - withdrawAmount) * 10000) / 10000
            const newCoin = Math.round(((parseFloat(u.coin_balance) || 0) + withdrawAmount) * 10000) / 10000

            const { data: cas } = await supabase.from('users')
                .update({ mutual_aid_balance: newMa, coin_balance: newCoin })
                .eq('id', userId).eq('mutual_aid_balance', u.mutual_aid_balance)
                .select('id')
            if (cas?.length) {
                await supabase.from('transactions').insert({
                    user_id: userId, type: 'mutual_aid_withdraw',
                    amount: withdrawAmount, status: 'completed',
                    note: `互助余额提至主余额`
                }).catch(() => {})
                return Response.json({ code: 200, message: '提取成功', data: { amount: withdrawAmount } })
            }
        }
        return Response.json({ code: 500, message: '操作冲突，请重试' }, { status: 500 })
    } catch (e) {
        return Response.json({ code: 500, message: '提取失败: ' + e.message }, { status: 500 })
    }
})

// ── 主余额 → 互助余额（划入） ─────────────────────────────────
router.post('/from-balance', async (request) => {
    const supabase = request.supabase
    const { userId, amount } = await request.json()
    if (!userId || !amount) return Response.json({ code: 400, message: '参数缺失' }, { status: 400 })

    const transferAmount = parseFloat(amount)
    if (transferAmount <= 0)
        return Response.json({ code: 400, message: '金额必须大于0' }, { status: 400 })

    try {
        for (let i = 0; i < 3; i++) {
            const { data: u } = await supabase.from('users')
                .select('mutual_aid_balance, coin_balance').eq('id', userId).single()
            const coinBal = parseFloat(u?.coin_balance || 0)
            if (coinBal < transferAmount)
                return Response.json({ code: 400, message: '余额不足' }, { status: 400 })

            const newCoin = Math.round((coinBal - transferAmount) * 10000) / 10000
            const newMa = Math.round(((parseFloat(u.mutual_aid_balance) || 0) + transferAmount) * 10000) / 10000

            const { data: cas } = await supabase.from('users')
                .update({ mutual_aid_balance: newMa, coin_balance: newCoin })
                .eq('id', userId).eq('coin_balance', u.coin_balance)
                .select('id')
            if (cas?.length) {
                await supabase.from('transactions').insert({
                    user_id: userId, type: 'mutual_aid_deposit',
                    amount: transferAmount, status: 'completed',
                    note: `主余额划入互助补贴`
                }).catch(() => {})
                return Response.json({ code: 200, message: '划转成功', data: { amount: transferAmount } })
            }
        }
        return Response.json({ code: 500, message: '操作冲突，请重试' }, { status: 500 })
    } catch (e) {
        return Response.json({ code: 500, message: '划转失败: ' + e.message }, { status: 500 })
    }
})

// ── 队列匹配核心逻辑 ──────────────────────────────────────────
async function processQueue(supabase, newEntryId) {
    // 1. 检查总队列人数是否够30
    const { count: totalActive } = await supabase.from('mutual_aid_queue')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'receiving'])

    if ((totalActive || 0) < QUEUE_MIN) return  // 不足30人，等待

    // 2. 找当前新条目（确认还是 pending）
    const { data: newEntry } = await supabase.from('mutual_aid_queue')
        .select('*').eq('id', newEntryId).single()
    if (!newEntry || newEntry.status !== 'pending') return

    // 3. 找最早的2个 receiving 且未满 150 的条目
    const { data: receivers } = await supabase.from('mutual_aid_queue')
        .select('*')
        .eq('status', 'receiving')
        .lt('received_amount', RECEIVE_TARGET)
        .order('created_at', { ascending: true })
        .limit(4)

    let target1 = receivers?.[0] || null
    let target2 = receivers?.[1] || null

    // 4. 如果 receiving 不足2个，从最早的 pending 中补充（bootstrap）
    if (!target1 || !target2) {
        const { data: earlyPending } = await supabase.from('mutual_aid_queue')
            .select('*').eq('status', 'pending')
            .neq('id', newEntryId)
            .order('created_at', { ascending: true })
            .limit(2)

        for (const ep of (earlyPending || [])) {
            if (!target1) {
                // 提升为 receiving
                await supabase.from('mutual_aid_queue')
                    .update({ status: 'receiving' }).eq('id', ep.id).eq('status', 'pending')
                target1 = { ...ep, status: 'receiving', received_amount: 0 }
            } else if (!target2) {
                await supabase.from('mutual_aid_queue')
                    .update({ status: 'receiving' }).eq('id', ep.id).eq('status', 'pending')
                target2 = { ...ep, status: 'receiving', received_amount: 0 }
            }
        }
    }

    if (!target1 || !target2) return  // 还是凑不到2个，等待

    // 5. 新条目转出 50 给 target1 和 target2，自己变 receiving
    const nowISO = new Date().toISOString()

    await supabase.from('mutual_aid_queue').update({
        status: 'receiving',
        paid_to_1: target1.user_id,
        paid_to_2: target2.user_id,
        matched_at: nowISO
    }).eq('id', newEntryId).eq('status', 'pending')

    // 6. 更新 target1 收款
    await creditReceiver(supabase, target1)

    // 7. 更新 target2 收款
    if (target2.id !== target1.id) {
        await creditReceiver(supabase, target2)
    }
}

async function creditReceiver(supabase, entry) {
    const newReceived = Math.round(((parseFloat(entry.received_amount) || 0) + PAY_PER_PERSON) * 10000) / 10000
    const isComplete = newReceived >= RECEIVE_TARGET
    const nowISO = new Date().toISOString()

    await supabase.from('mutual_aid_queue').update({
        received_amount: newReceived,
        status: isComplete ? 'completed' : 'receiving',
        completed_at: isComplete ? nowISO : null
    }).eq('id', entry.id)

    if (isComplete) {
        // CAS 到账 150 到 mutual_aid_balance
        for (let i = 0; i < 3; i++) {
            const { data: u } = await supabase.from('users')
                .select('mutual_aid_balance').eq('id', entry.user_id).single()
            const cur = parseFloat(u?.mutual_aid_balance || 0)
            const { data: cas } = await supabase.from('users')
                .update({ mutual_aid_balance: Math.round((cur + RECEIVE_TARGET) * 10000) / 10000 })
                .eq('id', entry.user_id).eq('mutual_aid_balance', u.mutual_aid_balance)
                .select('id')
            if (cas?.length) {
                await supabase.from('transactions').insert({
                    user_id: entry.user_id, type: 'mutual_aid_receive',
                    amount: RECEIVE_TARGET, status: 'completed',
                    note: `互助补贴到账${RECEIVE_TARGET}`
                }).catch(() => {})
                break
            }
        }
    }
}

export { router as mutualAidRoutes }

/**
 * 激活码路由 - Activation Code Routes
 *
 * POST /api/redeem/use    - 用户兑换激活码（直接激活，不经过余额）
 * POST /api/redeem/create - 管理员创建激活码（需要 ENGINE_API_KEY）
 */

import { Router } from 'itty-router'
import { PLANS, activateAndRotate, generateInviteCode } from './subscription.js'

const router = Router({ base: '/api/redeem' })

/**
 * POST /api/redeem/use
 * 用户兑换激活码 → 直接激活，不经过 coin_balance
 * Body: { userId, code, inviteCode }
 */
router.post('/use', async (request) => {
    const supabase = request.supabase

    try {
        const { userId, code, inviteCode: inputInviteCode } = await request.json()

        if (!userId || !code) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        // 校验 userId 格式（必须是 8 开头的5位数字）
        if (!/^8\d{4}$/.test(String(userId))) {
            return Response.json({ code: 400, message: '用户ID格式无效' })
        }

        const normalizedCode = String(code).trim().toUpperCase()

        // 1. 查找激活码
        const { data: redeemCode, error: findError } = await supabase
            .from('redeem_codes')
            .select('*')
            .eq('code', normalizedCode)
            .single()

        if (findError || !redeemCode) {
            return Response.json({ code: 400, message: '激活码无效' })
        }

        if (redeemCode.used) {
            return Response.json({ code: 400, message: '激活码已被使用' })
        }

        // 校验 plan_type
        const planType = redeemCode.plan_type
        if (!planType || !PLANS[planType]) {
            return Response.json({ code: 400, message: '激活码配置错误，请联系管理员' })
        }
        const plan = PLANS[planType]

        // 2. 标记激活码已使用（乐观锁防并发）
        const { error: useError } = await supabase
            .from('redeem_codes')
            .update({ used: true, used_by: userId, used_at: new Date().toISOString() })
            .eq('id', redeemCode.id)
            .eq('used', false)

        if (useError) {
            return Response.json({ code: 400, message: '激活码已被使用' })
        }

        // 3. 确保用户存在
        await supabase.from('users')
            .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

        // 4. 获取用户信息
        const { data: user } = await supabase
            .from('users')
            .select('id, is_active, invite_code, referrer_id')
            .eq('id', userId)
            .single()

        if (user?.is_active) {
            // 回滚激活码
            await supabase.from('redeem_codes')
                .update({ used: false, used_by: null, used_at: null })
                .eq('id', redeemCode.id)
            return Response.json({ code: 400, message: '账号已激活，无需重复使用' })
        }

        // 5. 查找推荐人（通过邀请码）
        let referrerId = user?.referrer_id
        if (!referrerId && inputInviteCode) {
            const normalizedInvite = String(inputInviteCode).trim().toUpperCase()
            const { data: referrer } = await supabase
                .from('users')
                .select('id')
                .eq('invite_code', normalizedInvite)
                .single()
            if (referrer) referrerId = referrer.id
        }

        // 6. 激活用户（直接写入，不扣 coin_balance）
        const userInviteCode = user?.invite_code || generateInviteCode()
        const updateFields = {
            is_active: true,
            is_member: true,
            card_type: planType,
            invite_code: userInviteCode
        }
        if (!user?.referrer_id && referrerId) updateFields.referrer_id = referrerId

        await supabase.from('users').update(updateFields).eq('id', userId)

        // 7. 记录激活交易
        try {
            const txId = `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            await supabase.from('transactions').insert({
                id: txId,
                user_id: userId,
                type: 'activation',
                amount: plan.price,
                from_user_id: userId,
                card_type: planType,
                status: 'completed',
                note: `激活码激活${plan.name}`
            })
        } catch (e) { /* 记录失败不影响激活 */ }

        // 8. 后台：推荐人计数 + 模型结算（不阻塞响应）
        const backgroundTask = (async () => {
            // 更新推荐人直推计数
            if (referrerId) {
                const { data: ref } = await supabase
                    .from('users').select('direct_push_count').eq('id', referrerId).single()
                if (ref) {
                    await supabase.from('users')
                        .update({ direct_push_count: (ref.direct_push_count || 0) + 1 })
                        .eq('id', referrerId)
                }
            }
            // 模型结算 + 奖励分发
            try {
                await activateAndRotate(supabase, userId, referrerId, plan, planType)
            } catch (e) {
                console.error('[Redeem] 模型结算失败（激活已成功）:', e)
            }
        })()

        if (request.ctx?.waitUntil) {
            request.ctx.waitUntil(backgroundTask)
        } else {
            await backgroundTask
        }

        return Response.json({
            code: 200,
            message: '激活成功',
            data: {
                planType,
                planName: plan.name,
                inviteCode: userInviteCode
            }
        })

    } catch (error) {
        console.error('[Redeem] Error:', error)
        return Response.json({ code: 500, message: '服务器错误' }, { status: 500 })
    }
})

/**
 * POST /api/redeem/create
 * 管理员创建激活码（需要 ENGINE_API_KEY）
 * Body: { planType: 'BASIC'|'PREMIUM'|'ELITE', count, note, createdBy }
 */
router.post('/create', async (request) => {
    const env = request.env
    const supabase = request.supabase

    // 验证 API Key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== env?.ENGINE_API_KEY) {
        return Response.json({ code: 401, message: '无权限' }, { status: 401 })
    }

    try {
        const { planType, count = 1, note, createdBy } = await request.json()

        if (!planType || !PLANS[planType]) {
            return Response.json({ code: 400, message: '请选择有效的套餐类型：BASIC / PREMIUM / ELITE' })
        }

        const plan = PLANS[planType]
        const n = Math.min(parseInt(count) || 1, 100)
        const codes = []

        for (let i = 0; i < n; i++) {
            codes.push({
                code: generateCode(),
                plan_type: planType,
                amount: plan.price,   // 保留金额字段方便参考
                note: note || `${plan.name}激活码`,
                created_by: createdBy || null
            })
        }

        const { data, error } = await supabase
            .from('redeem_codes')
            .insert(codes)
            .select('code, plan_type, amount')

        if (error) {
            console.error('[Redeem Create] Error:', error)
            return Response.json({ code: 500, message: '创建失败' })
        }

        return Response.json({ code: 200, message: '创建成功', data })

    } catch (error) {
        console.error('[Redeem Create] Error:', error)
        return Response.json({ code: 500, message: '服务器错误' }, { status: 500 })
    }
})

/**
 * GET /api/redeem/status/:userId
 * 获取用户激活状态（替代旧的 balance 接口）
 */
router.get('/status/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase

    try {
        const { data: user } = await supabase
            .from('users')
            .select('is_member, card_type, invite_code, coin_balance, is_admin, is_partner, role')
            .eq('id', userId)
            .single()

        return Response.json({
            code: 200,
            data: {
                isActivated: user?.is_member === true,
                cardType: user?.card_type || null,
                inviteCode: user?.invite_code || null,
                balance: parseFloat(user?.coin_balance || 0),
                isAdmin: user?.is_admin === true,
                isPartner: user?.is_partner === true,
                role: user?.role || null
            }
        })
    } catch (error) {
        return Response.json({ code: 200, data: { isActivated: false, cardType: null, balance: 0, isAdmin: false, isPartner: false, role: null } })
    }
})

// 保留旧 balance 接口兼容性
router.get('/balance/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase
    try {
        const { data: user } = await supabase
            .from('users').select('coin_balance').eq('id', userId).single()
        return Response.json({ code: 200, data: { balance: parseFloat(user?.coin_balance || 0) } })
    } catch (error) {
        return Response.json({ code: 200, data: { balance: 0 } })
    }
})

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 10; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

export const redeemCodeRoutes = router
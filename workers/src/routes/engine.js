/**
 * Engine Checkin Routes - 签到相关接口
 *
 * GET  /api/engine/checkin/:userId   - 获取签到状态
 * POST /api/engine/checkin           - 用户签到
 * POST /api/engine/checkin/use-coupon - 使用优惠券
 * GET  /api/engine/coin-price        - 获取今日积分兑换价格
 * POST /api/engine/coin-exchange     - 积分⇄余额双向兑换
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/engine' })

// ── 阿联酋迪拜时区工具函数 (UTC+4) ──────────────────
// 所有签到日期统一使用迪拜时间，防止跨时区在0-4点重复签到
function getDubaiDate() {
    const now = new Date()
    // Dubai = UTC+4
    const dubaiMs = now.getTime() + 4 * 60 * 60 * 1000
    return new Date(dubaiMs).toISOString().split('T')[0]
}

function getDubaiYesterday() {
    const now = new Date()
    const dubaiMs = now.getTime() + 4 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000
    return new Date(dubaiMs).toISOString().split('T')[0]
}

// ── 设备密钥验证（防止他人用已知 userId 冒操作）──────────────────────────────────────
async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 验证设备密钥：
 * - 首次调用 → 自动绑定设备（登记 hash），90天有效
 * - 已绑定   → 校验 hash 是否一致
 * @returns {{ valid: boolean, message?: string }}
 */
async function verifyDevice(userId, secret, env) {
    // 设备验证已关闭，任何设备均可操作
    return { valid: true }
}

// ── 积分固定兑换价格（100积分=1，即每积分=0.01）──
function getDailyPrice() {
    return 0.01  // 固定：100积分 = 1（内部计价单位）
}

// ==================== 签到相关 ====================

/**
 * GET /api/engine/checkin/:userId
 * 获取用户签到状态
 */
router.get('/checkin/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('last_checkin_date, checkin_consecutive_days, checkin_total, coupon_count, voucher_day7_granted')
            .eq('id', userId)
            .single()

        if (error && error.code !== 'PGRST116') {
            return Response.json({ success: false, message: '获取签到状态失败' })
        }

        // 使用阿联酋迪拜时区 (UTC+4) 作为签到日期基准
        const today = getDubaiDate()
        const record = user || {}

        return Response.json({
            success: true,
            lastCheckinDate: record.last_checkin_date || null,
            consecutiveDays: record.checkin_consecutive_days || 0,
            totalCheckins: record.checkin_total || 0,
            voucherCount: record.coupon_count || 0,
            day7VoucherGranted: record.voucher_day7_granted || false,
            canCheckinToday: record.last_checkin_date !== today
        })

    } catch (error) {
        console.error('[Engine] Get checkin error:', error)
        return Response.json({ success: false, message: '服务器错误' }, { status: 500 })
    }
})

/**
 * POST /api/engine/checkin
 * 用户签到（全逻辑在后端执行）
 * Body: { userId }
 */
router.post('/checkin', async (request) => {
    const supabase = request.supabase

    try {
        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return Response.json({ success: false, message: '用户ID不能为空' })
        }

        // 校验 userId 格式（必须是 8 开头的5位数字）
        if (!/^8\d{4}$/.test(String(userId))) {
            return Response.json({ success: false, message: '用户ID格式无效' })
        }

        // 设备绑定验证（防止他人冒签到）
        const deviceSecret = request.headers.get('X-Device-Secret')
        const dv = await verifyDevice(String(userId), deviceSecret, request.env)
        if (!dv.valid) {
            return Response.json({ success: false, message: dv.message }, { status: 403 })
        }

        // 确保用户存在（不存在则自动创建）
        await supabase.from('users')
            .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

        // 获取用户完整信息（签到状态 + 独立状态 + 会员档位 + 分润余额）
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('last_checkin_date, checkin_consecutive_days, checkin_total, coupon_count, is_active, is_independent, has_slippage, has_slide_down, card_type, voucher_day7_granted')
            .eq('id', userId)
            .single()

        if (userError && userError.code !== 'PGRST116') {
            return Response.json({ success: false, message: '获取用户信息失败' })
        }

        // 使用阿联酋迪拜时区 (UTC+4) 作为签到日期基准，防止跨时区重复签到
        const today = getDubaiDate()
        const yesterday = getDubaiYesterday()

        const record = {
            lastCheckinDate: user?.last_checkin_date || null,
            consecutiveDays: user?.checkin_consecutive_days || 0,
            totalCheckins: user?.checkin_total || 0,
            coupons: user?.coupon_count || 0
        }
        const isIndependent = user?.is_independent || false
        const hasSlippage = user?.has_slippage || user?.has_slide_down || false

        // 检查今天是否已签到
        if (record.lastCheckinDate === today) {
            return Response.json({ success: false, message: '今天已签到过了' })
        }

        // 防止0撸：未激活且拼团券已达4张，停止签到
        if (!user?.is_active && (user?.coupon_count || 0) >= 4) {
            return Response.json({ success: false, message: '请激活V1-V6任意档位后继续签到' })
        }

        // 计算连续天数（断签直接重置，不再燃烧积分）
        if (record.lastCheckinDate === yesterday) {
            record.consecutiveDays++
        } else if (record.lastCheckinDate === null) {
            record.consecutiveDays = 1
        } else {
            record.consecutiveDays = 1
        }

        record.lastCheckinDate = today
        record.totalCheckins++

        // 首次连续签到7天 → 送1张拼团券（无需其他条件）
        let earnedCoupon = false
        const day7Granted = user?.voucher_day7_granted || false
        if (record.consecutiveDays === 7 && !day7Granted) {
            record.coupons++
            earnedCoupon = true
        }

        // 激活用户签到记 2 积分/天（checkin_logs历史记录用），未激活签到记 0
        const POINT_TIERS = {
            BASIC: 2, PREMIUM: 2, ELITE: 2, TIER_300: 2, TIER_500: 2, TIER_1000: 2
        }
        const cardType    = user?.card_type || null
        const rewardAmount = POINT_TIERS[cardType] || 0

        // 写回 Supabase（只有激活用户才到这里）
        const updateData = {
            last_checkin_date: record.lastCheckinDate,
            checkin_consecutive_days: record.consecutiveDays,
            checkin_total: record.totalCheckins,
            coupon_count: record.coupons,
            updated_at: new Date().toISOString()
        }
        if (earnedCoupon) updateData.voucher_day7_granted = true
        await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)

        // 写入签到日志（激活用户记2积分/天，仅供历史查询用）
        await supabase.from('checkin_logs').insert({
            user_id: userId,
            amount: rewardAmount,
            tier: rewardAmount,
            checkin_date: today,
            created_at: new Date().toISOString()
        }).catch(e => console.error('[Engine] checkin_logs insert FAILED:', e))

        return Response.json({
            success: true,
            consecutiveDays: record.consecutiveDays,
            totalCheckins: record.totalCheckins,
            coupons: record.coupons,
            earnedCoupon,
            checkinType: 'points',
        })

    } catch (error) {
        console.error('[Engine] Checkin error:', error)
        return Response.json({ success: false, message: '服务器错误' }, { status: 500 })
    }
})

/**
 * POST /api/engine/checkin/use-coupon
 * 使用优惠券
 * Body: { userId, count }
 */
router.post('/checkin/use-coupon', async (request) => {
    const supabase = request.supabase

    try {
        const body = await request.json()
        const { userId, count = 1 } = body

        if (!userId) {
            return Response.json({ success: false, message: '用户ID不能为空' })
        }

        const deviceSecret = request.headers.get('X-Device-Secret')
        const dv = await verifyDevice(String(userId), deviceSecret, request.env)
        if (!dv.valid) {
            return Response.json({ success: false, message: dv.message }, { status: 403 })
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('coupon_count')
            .eq('id', userId)
            .single()

        if (error || !user) {
            return Response.json({ success: false, message: '用户不存在' })
        }

        const currentCoupons = user.coupon_count || 0
        if (currentCoupons < count) {
            return Response.json({ success: false, message: `优惠券不足，当前剩余 ${currentCoupons} 张` })
        }

        const newCount = currentCoupons - count
        await supabase
            .from('users')
            .update({ coupon_count: newCount, updated_at: new Date().toISOString() })
            .eq('id', userId)

        return Response.json({ success: true, remainingCoupons: newCount })

    } catch (error) {
        console.error('[Engine] Use coupon error:', error)
        return Response.json({ success: false, message: '服务器错误' }, { status: 500 })
    }
})

// ==================== 积分兑换 ====================

/**
 * GET /api/engine/coin-price
 * 获取今日积分浮动价格（$0.10~$0.50，每日变动，基于迪拜时区日期）
 */
router.get('/coin-price', async (request) => {
    const price = getDailyPrice()
    return Response.json({ success: true, price, date: getDubaiDate() })
})

/**
 * POST /api/engine/coin-exchange
 * 积分⇄余额双向兑换（最低10积分起）
 * Body: { userId, type: 'point_to_balance'|'balance_to_point', amount: Number（积分数量） }
 */
router.post('/coin-exchange', async (request) => {
    const supabase = request.supabase

    try {
        const body = await request.json()
        const { userId, type, amount } = body

        if (!userId || !type || !amount) {
            return Response.json({ success: false, message: '参数不完整' })
        }
        if (!/^8\d{4}$/.test(String(userId))) {
            return Response.json({ success: false, message: '用户ID格式无效' })
        }
        const pts = Math.floor(Number(amount))
        if (!pts || pts < 100) {
            return Response.json({ success: false, message: '最少100积分起兑换' })
        }

        const deviceSecret = request.headers.get('X-Device-Secret')
        const dv = await verifyDevice(String(userId), deviceSecret, request.env)
        if (!dv.valid) {
            return Response.json({ success: false, message: dv.message }, { status: 403 })
        }

        const price = getDailyPrice()
        const today = getDubaiDate()

        if (type === 'point_to_balance') {
            // 积分 → 余额：扣积分 + 加 repurchase_balance
            const [checkinPts, burnPts] = await Promise.all([
                supabase.from('checkin_logs').select('amount').eq('user_id', userId),
                supabase.from('burn_logs').select('amount').eq('user_id', userId)
            ])
            const totalEarned  = (checkinPts.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
            const totalBurned  = (burnPts.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
            const currentPoints = Math.max(0, totalEarned - totalBurned)

            if (currentPoints < pts) {
                return Response.json({ success: false, message: `积分不足，当前 ${Math.floor(currentPoints)} 积分` })
            }

            const moneyAmount = Math.round(pts * price * 10000) / 10000
            const now = new Date().toISOString()

            // 燃烧积分（burn_logs 记录，包含兑换详情）
            await supabase.from('burn_logs').insert({
                user_id: userId,
                amount: pts,
                reason: `积分兑换余额（${pts}积分 × $${price} = $${moneyAmount}）`,
                created_at: now
            })

            // 增加余额
            const { data: user } = await supabase.from('users').select('repurchase_balance').eq('id', userId).single()
            const newBalance = Math.round(((parseFloat(user?.repurchase_balance) || 0) + moneyAmount) * 10000) / 10000
            await supabase.from('users').update({
                repurchase_balance: newBalance,
                updated_at: now
            }).eq('id', userId)

            // 写入交易记录（transactions 表，type=coin_exchange，正数为收入）
            await supabase.from('transactions').insert({
                user_id: userId,
                type: 'coin_exchange',
                amount: moneyAmount,
                status: 'completed',
                note: `积分兑换余额：${pts}积分 × $${price}/积分`,
                created_at: now
            }).catch(() => {}) // 不阻断主流程

            return Response.json({
                success: true,
                message: `兑换成功！${pts} 积分 → $${moneyAmount}`,
                price,
                ptsUsed: pts,
                moneyAmount,
                newBalance
            })

        } else if (type === 'balance_to_point') {
            // 余额 → 积分：扣 repurchase_balance + 加积分
            const moneyCost = Math.round(pts * price * 10000) / 10000

            const { data: user, error } = await supabase.from('users').select('repurchase_balance').eq('id', userId).single()
            if (error || !user) {
                return Response.json({ success: false, message: '用户不存在' })
            }

            const currentBalance = parseFloat(user.repurchase_balance) || 0
            if (currentBalance < moneyCost) {
                return Response.json({ success: false, message: `余额不足，需要 $${moneyCost}，当前 $${currentBalance.toFixed(4)}` })
            }

            const now = new Date().toISOString()

            // 扣余额
            const newBalance = Math.round((currentBalance - moneyCost) * 10000) / 10000
            await supabase.from('users').update({
                repurchase_balance: newBalance,
                updated_at: now
            }).eq('id', userId)

            // 增加积分（写入 checkin_logs，tier=-1 表示余额兑换积分来源）
            await supabase.from('checkin_logs').insert({
                user_id: userId,
                amount: pts,
                tier: -1,
                checkin_date: today,
                created_at: now
            })

            // 写入交易记录（transactions 表，type=coin_exchange，负数为支出）
            await supabase.from('transactions').insert({
                user_id: userId,
                type: 'coin_exchange',
                amount: -moneyCost,
                status: 'completed',
                note: `余额兑换积分：$${price}/积分 × ${pts}积分`,
                created_at: now
            }).catch(() => {}) // 不阻断主流程

            return Response.json({
                success: true,
                message: `兑换成功！$${moneyCost} → ${pts} 积分`,
                price,
                moneyCost,
                ptsGained: pts,
                newBalance
            })

        } else {
            return Response.json({ success: false, message: '兑换类型无效（point_to_balance / balance_to_point）' })
        }

    } catch (e) {
        console.error('[Engine] coin-exchange error:', e)
        return Response.json({ success: false, message: '服务器错误' }, { status: 500 })
    }
})

// ==================== 导出 ====================

export const engineRoutes = router
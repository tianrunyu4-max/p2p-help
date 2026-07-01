/**
 * 积分兑换代币路由
 * POST /api/token-redeem/submit   - 用户提交兑换申请
 * GET  /api/token-redeem/list     - 管理员获取兑换列表
 * POST /api/token-redeem/complete - 管理员标记已打款
 * GET  /api/token-redeem/rate     - 获取当前兑换比例
 */

import { Router } from 'itty-router'
import { sendToken } from '../services/bscSender.js'

const router = Router({ base: '/api/token-redeem' })

const MIN_POINTS = 1000   // 最低兑换积分

/**
 * GET /api/token-redeem/rate
 * 获取当前兑换比例（公开）
 */
router.get('/rate', async (request) => {
    const supabase = request.supabase
    try {
        const { data } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'token_exchange_rate')
            .single()
        const rate = parseFloat(data?.setting_value) || 1
        return Response.json({ code: 200, data: { rate, minPoints: MIN_POINTS } })
    } catch {
        return Response.json({ code: 200, data: { rate: 1, minPoints: MIN_POINTS } })
    }
})

/**
 * POST /api/token-redeem/submit
 * 用户提交兑换申请
 * Body: { userId, walletAddress, points }
 */
router.post('/submit', async (request) => {
    const supabase = request.supabase
    const env = request.env

    try {
        const body = await request.json()
        const { userId, walletAddress, points } = body

        // 基础参数校验
        if (!userId || !walletAddress || !points) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        // 积分必须是1000的整数倍
        const pointsNum = parseInt(points)
        if (isNaN(pointsNum) || pointsNum < MIN_POINTS || pointsNum % MIN_POINTS !== 0) {
            return Response.json({ code: 400, message: `积分必须是${MIN_POINTS}的整数倍` })
        }

        // BSC 钱包地址格式校验（0x开头，42位十六进制）
        if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
            return Response.json({ code: 400, message: '钱包地址格式无效，请输入正确的BSC地址' })
        }

        // ── 防重复提交锁（KV，60秒内同一用户只能提交一次）──
        const lockKey = `token_redeem_lock:${userId}`
        const locked = await env.RATE_LIMIT?.get(lockKey)
        if (locked) {
            return Response.json({ code: 429, message: '请勿重复提交，60秒后可再次申请' })
        }
        await env.RATE_LIMIT?.put(lockKey, '1', { expirationTtl: 60 })

        // 查询用户信息（验证用户存在且已激活）
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, is_member, card_type')
            .eq('id', String(userId))
            .single()

        if (userErr || !user) {
            await env.RATE_LIMIT?.delete(lockKey)
            return Response.json({ code: 404, message: '用户不存在' })
        }

        if (!user.is_member) {
            await env.RATE_LIMIT?.delete(lockKey)
            return Response.json({ code: 403, message: '请先激活账号' })
        }

        // 从 checkin_logs - burn_logs 计算当前签到积分余额（与 coin_balance 完全独立）
        const [checkinRes, burnRes] = await Promise.all([
            supabase.from('checkin_logs').select('amount').eq('user_id', String(userId)),
            supabase.from('burn_logs').select('amount').eq('user_id', String(userId))
        ])
        const totalEarned = (checkinRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        const totalBurned = (burnRes.data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        const currentPoints = Math.max(0, totalEarned - totalBurned)

        if (currentPoints < pointsNum) {
            await env.RATE_LIMIT?.delete(lockKey)
            return Response.json({ code: 400, message: `签到积分不足，当前积分：${Math.floor(currentPoints)}` })
        }

        // 获取当前兑换比例
        const { data: rateSetting } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'token_exchange_rate')
            .single()
        const rate = parseFloat(rateSetting?.setting_value) || 1
        const tokenAmount = Math.floor(pointsNum * rate)

        // 写入燃烧日志（从签到积分系统扣除，与 coin_balance 无关）
        const { error: burnErr } = await supabase.from('burn_logs').insert({
            user_id: String(userId),
            amount: pointsNum,
            reason: `代币兑换：申请兑换${tokenAmount}个代币`,
            created_at: new Date().toISOString()
        })

        if (burnErr) {
            console.error('[TokenRedeem] burn_logs insert failed:', burnErr)
            await env.RATE_LIMIT?.delete(lockKey)
            return Response.json({ code: 500, message: '积分扣除失败，请重试' })
        }

        // 写入兑换记录
        const redemptionId = `RDM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        const { error: insertErr } = await supabase
            .from('token_redemptions')
            .insert({
                id: redemptionId,
                user_id: String(userId),
                points_deducted: pointsNum,
                token_amount: tokenAmount,
                wallet_address: walletAddress,
                status: 'pending'
            })

        if (insertErr) {
            // 回滚：插入负数燃烧记录补回积分
            console.error('[TokenRedeem] insert failed, rolling back', insertErr)
            await supabase.from('burn_logs').insert({
                user_id: String(userId),
                amount: -pointsNum,
                reason: '代币兑换失败-系统补回',
                created_at: new Date().toISOString()
            })
            await env.RATE_LIMIT?.delete(lockKey)
            return Response.json({ code: 500, message: '提交失败，积分已退还' })
        }

        console.log(`[TokenRedeem] 用户${userId} 兑换申请: 扣${pointsNum}积分 → ${tokenAmount}代币 → ${walletAddress}`)

        // ── 尝试自动打币（需配置 DISTRIBUTION_PRIVATE_KEY 秘钥）──
        const privateKey = env.DISTRIBUTION_PRIVATE_KEY
        if (privateKey) {
            try {
                const txHash = await sendToken(walletAddress, tokenAmount, privateKey)

                // 自动发送成功 → 更新状态为已完成，保存链上 txHash
                await supabase.from('token_redemptions')
                    .update({
                        status: 'completed',
                        tx_hash: txHash,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', redemptionId)

                console.log(`[TokenRedeem] ✅ 自动打币成功 txHash=${txHash}`)

                return Response.json({
                    code: 200,
                    message: '兑换成功！代币已自动发送到您的钱包',
                    data: {
                        redemptionId,
                        pointsDeducted: pointsNum,
                        tokenAmount,
                        txHash,
                        bscscanUrl: `https://bscscan.com/tx/${txHash}`
                    }
                })

            } catch (sendErr) {
                // 自动打币失败 → 保留 pending，等待管理员手动处理，积分已扣不回滚
                console.error(`[TokenRedeem] ⚠️ 自动打币失败（将由管理员手动处理）: ${sendErr.message}`)
            }
        }

        // 无私钥 或 自动发送失败 → 返回待处理状态
        return Response.json({
            code: 200,
            message: '兑换申请已提交，将在24小时内打款到账',
            data: { redemptionId, pointsDeducted: pointsNum, tokenAmount }
        })

    } catch (error) {
        console.error('[TokenRedeem] submit error:', error)
        return Response.json({ code: 500, message: '提交失败: ' + error.message }, { status: 500 })
    }
})

/**
 * GET /api/token-redeem/list
 * 管理员获取兑换列表
 * Query: ?status=pending|completed|all
 */
router.get('/list', async (request) => {
    const supabase = request.supabase
    try {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') || 'pending'

        let query = supabase
            .from('token_redemptions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200)

        if (status !== 'all') {
            query = query.eq('status', status)
        }

        const { data, error } = await query
        if (error) throw error

        return Response.json({ code: 200, data: data || [] })
    } catch (error) {
        console.error('[TokenRedeem] list error:', error)
        return Response.json({ code: 500, message: '获取列表失败' }, { status: 500 })
    }
})

/**
 * POST /api/token-redeem/complete
 * 管理员标记已打款
 * Body: { redemptionId }
 */
router.post('/complete', async (request) => {
    const supabase = request.supabase
    try {
        const { redemptionId, txHash } = await request.json()

        if (!redemptionId) {
            return Response.json({ code: 400, message: '缺少兑换记录ID' })
        }

        const updateData = {
            status: 'completed',
            completed_at: new Date().toISOString()
        }
        if (txHash) updateData.tx_hash = txHash  // 管理员手动打款时可填入链上哈希

        const { data, error } = await supabase
            .from('token_redemptions')
            .update(updateData)
            .eq('id', redemptionId)
            .eq('status', 'pending')   // 只能标记待处理的记录
            .select('id')

        if (error) throw error
        if (!data || data.length === 0) {
            return Response.json({ code: 404, message: '记录不存在或已处理' })
        }

        return Response.json({ code: 200, message: '已标记为打款完成' })
    } catch (error) {
        console.error('[TokenRedeem] complete error:', error)
        return Response.json({ code: 500, message: '操作失败' }, { status: 500 })
    }
})

/**
 * POST /api/token-redeem/update-rate
 * 管理员修改兑换比例
 * Body: { rate }  例：{ rate: 0.5 }
 */
router.post('/update-rate', async (request) => {
    const supabase = request.supabase
    try {
        const { rate } = await request.json()
        const rateNum = parseFloat(rate)
        if (isNaN(rateNum) || rateNum <= 0 || rateNum > 10) {
            return Response.json({ code: 400, message: '比例无效（0~10之间）' })
        }

        await supabase
            .from('admin_settings')
            .upsert({ setting_key: 'token_exchange_rate', setting_value: String(rateNum) }, { onConflict: 'setting_key' })

        return Response.json({ code: 200, message: `兑换比例已更新为 ${rateNum}` })
    } catch (error) {
        return Response.json({ code: 500, message: '更新失败' }, { status: 500 })
    }
})

export const tokenRedeemRoutes = router

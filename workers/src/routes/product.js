/**
 * 产品提货路由
 * POST /api/product/delivery  - 提交提货申请
 * GET  /api/product/delivery  - 查询我的提货记录
 *
 * Supabase 需建表：
 * CREATE TABLE product_orders (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id TEXT NOT NULL,
 *   category TEXT NOT NULL,
 *   address TEXT NOT NULL,
 *   address_expires_at TIMESTAMPTZ NOT NULL,
 *   status TEXT DEFAULT 'pending',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/product' })

const DELIVERY_THRESHOLD = 70  // 累计激活消费达 $70 可提货

const PLAN_PRICES = {
    BASIC: 20, PREMIUM: 50, ELITE: 100,
    TIER_300: 200, TIER_500: 500, TIER_1000: 1000
}

/**
 * POST /api/product/delivery
 * Body: { userId, category, address }
 */
router.post('/delivery', async (request) => {
    const supabase = request.supabase
    try {
        const body = await request.json()
        const { userId, category, address } = body

        if (!userId || !category || !address?.trim()) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        // 检查累计激活金额是否 >= $70
        const { data: user, error: ue } = await supabase.from('users')
            .select('activated_types').eq('id', String(userId)).single()
        if (ue || !user) return Response.json({ code: 404, message: '用户不存在' })

        const tiers = Array.isArray(user.activated_types) ? user.activated_types : []
        const spend = tiers.reduce((s, t) => s + (PLAN_PRICES[t] || 0), 0)
        if (spend < DELIVERY_THRESHOLD) {
            return Response.json({ code: 403, message: `累计激活金额不足 $${DELIVERY_THRESHOLD}，当前 $${spend}` })
        }

        // 地址48小时后过期（自动销毁保护隐私）
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

        const { data: order, error: oe } = await supabase.from('product_orders').insert({
            user_id: String(userId),
            category,
            address: address.trim(),
            address_expires_at: expiresAt,
            status: 'pending'
        }).select().single()

        if (oe) {
            console.error('[ProductDelivery] insert error:', oe)
            return Response.json({ code: 500, message: '提交失败，请重试' })
        }

        console.log(`[ProductDelivery] 用户${userId} 提货申请: ${category}，地址48h后销毁`)
        return Response.json({ code: 200, message: '提货申请已提交，服务商将48小时内联系发货', data: { id: order.id } })
    } catch (e) {
        console.error('[ProductDelivery] error:', e)
        return Response.json({ code: 500, message: '服务器错误' }, { status: 500 })
    }
})

/**
 * GET /api/product/delivery?userId=xxx
 */
router.get('/delivery', async (request) => {
    const supabase = request.supabase
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return Response.json({ code: 400, message: '缺少 userId' })

    try {
        const { data, error } = await supabase.from('product_orders')
            .select('id, category, status, created_at, address_expires_at')
            .eq('user_id', String(userId))
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) throw error

        // 地址已过期则脱敏（不返回地址内容）
        const now = new Date().toISOString()
        const orders = (data || []).map(o => ({
            ...o,
            addressExpired: o.address_expires_at < now
        }))
        return Response.json({ code: 200, data: orders })
    } catch (e) {
        return Response.json({ code: 500, message: '查询失败' }, { status: 500 })
    }
})

export const productRoutes = router

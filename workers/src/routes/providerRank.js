/**
 * 服务商每日竞价排名
 *
 * ⚠️ 首次使用前需在 Supabase SQL 编辑器执行：
 * CREATE TABLE IF NOT EXISTS provider_rank_bids (
 *   id BIGSERIAL PRIMARY KEY,
 *   user_id UUID REFERENCES users(id),
 *   nickname TEXT,
 *   avatar TEXT,
 *   total_bid_points INTEGER DEFAULT 0,
 *   bid_date DATE DEFAULT CURRENT_DATE,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * CREATE UNIQUE INDEX IF NOT EXISTS provider_rank_user_date
 *   ON provider_rank_bids(user_id, bid_date);
 * CREATE INDEX IF NOT EXISTS provider_rank_date_pts
 *   ON provider_rank_bids(bid_date, total_bid_points DESC);
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/provider-rank' })
const BID_MIN = 1      // 最少1张拼团券
const MAX_SLOTS = 50

// GET /api/provider-rank — 今日 TOP50
router.get('/', async (request) => {
    const { supabase } = request
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('provider_rank_bids')
        .select('user_id, nickname, avatar, total_bid_points')
        .eq('bid_date', today)
        .order('total_bid_points', { ascending: false })
        .limit(50)

    if (error) {
        return new Response(JSON.stringify({ code: 500, message: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        })
    }
    return new Response(JSON.stringify({ code: 0, data: data || [] }), {
        headers: { 'Content-Type': 'application/json' }
    })
})

// POST /api/provider-rank/bid — 消耗拼团券出价（最少1张）
router.post('/bid', async (request) => {
    const { supabase } = request
    let body = {}
    try { body = await request.json() } catch (_) {}

    const { userId, bidCount = 1 } = body
    if (!userId) {
        return new Response(JSON.stringify({ code: 401, message: '请先登录' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        })
    }

    const count = Math.max(BID_MIN, parseInt(bidCount) || 1)
    const today = new Date().toISOString().split('T')[0]

    // 读取用户拼团券数量 + 昵称
    const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('coupon_count, invite_code')
        .eq('id', userId)
        .single()

    if (userErr || !userData) {
        return new Response(JSON.stringify({ code: 404, message: '用户不存在' }), {
            status: 404, headers: { 'Content-Type': 'application/json' }
        })
    }

    const currentCoupons = userData.coupon_count || 0
    if (currentCoupons < count) {
        return new Response(JSON.stringify({ code: 400, message: `拼团券不足，需要${count}张，当前${currentCoupons}张` }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        })
    }

    // CAS 扣拼团券
    const { error: deductErr } = await supabase
        .from('users')
        .update({ coupon_count: currentCoupons - count })
        .eq('id', userId)
        .eq('coupon_count', currentCoupons)

    if (deductErr) {
        return new Response(JSON.stringify({ code: 409, message: '券数量更新冲突，请重试' }), {
            status: 409, headers: { 'Content-Type': 'application/json' }
        })
    }

    const displayName = userData.invite_code ? `服务商${userData.invite_code}` : '匿名服务商'

    // 查今日是否已有记录
    const { data: existing } = await supabase
        .from('provider_rank_bids')
        .select('id, total_bid_points')
        .eq('user_id', userId)
        .eq('bid_date', today)
        .maybeSingle()

    if (existing) {
        await supabase
            .from('provider_rank_bids')
            .update({ total_bid_points: existing.total_bid_points + count, nickname: displayName })
            .eq('id', existing.id)
    } else {
        const { count: slotCount } = await supabase
            .from('provider_rank_bids')
            .select('id', { count: 'exact', head: true })
            .eq('bid_date', today)

        if ((slotCount || 0) >= MAX_SLOTS) {
            // 退还拼团券
            await supabase
                .from('users')
                .update({ coupon_count: currentCoupons })
                .eq('id', userId)
            return new Response(JSON.stringify({ code: 400, message: '今日名额已满（50名），明日再来' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            })
        }

        await supabase
            .from('provider_rank_bids')
            .insert({
                user_id: userId,
                nickname: displayName,
                avatar: '',
                total_bid_points: count,
                bid_date: today,
            })
    }

    return new Response(JSON.stringify({ code: 0, message: `成功出价 ${count} 张拼团券！` }), {
        headers: { 'Content-Type': 'application/json' }
    })
})

export const providerRankRoutes = router

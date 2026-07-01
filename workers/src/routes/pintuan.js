/**
 * 拼团补贴 后端路由
 *
 * ⚠️ 首次使用前在 Supabase SQL 编辑器执行：
 *
 * CREATE TABLE IF NOT EXISTS pintuan_sessions (
 *   id BIGSERIAL PRIMARY KEY,
 *   group_size INTEGER NOT NULL,
 *   tier_type TEXT DEFAULT 'cash_20',
 *   session_date DATE DEFAULT CURRENT_DATE,
 *   status TEXT DEFAULT 'open',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS pintuan_entries (
 *   id BIGSERIAL PRIMARY KEY,
 *   session_id BIGINT REFERENCES pintuan_sessions(id),
 *   user_id TEXT NOT NULL,
 *   nickname TEXT,
 *   avatar TEXT,
 *   join_date DATE DEFAULT CURRENT_DATE,
 *   tier_type TEXT DEFAULT 'cash_20',
 *   is_winner BOOLEAN,
 *   joined_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 旧表新增列（已有表时执行这两行）：
 * ALTER TABLE pintuan_sessions ADD COLUMN IF NOT EXISTS tier_type TEXT DEFAULT 'cash_20';
 * ALTER TABLE pintuan_entries  ADD COLUMN IF NOT EXISTS tier_type TEXT DEFAULT 'cash_20';
 *
 * CREATE TABLE IF NOT EXISTS pintuan_user_prefs (
 *   user_id TEXT PRIMARY KEY,
 *   auto_rejoin BOOLEAN DEFAULT FALSE,
 *   group_size_pref INTEGER DEFAULT 6,
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS pintuan_entries_user_date ON pintuan_entries(user_id, join_date);
 * CREATE INDEX IF NOT EXISTS pintuan_entries_tier      ON pintuan_entries(user_id, join_date, tier_type);
 * CREATE INDEX IF NOT EXISTS pintuan_sessions_date_status ON pintuan_sessions(session_date, status, tier_type);
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/pintuan' })

// ─── 档位配置 ────────────────────────────────────────────────────
// 现金：6人团 4中2不中（中奖率 66.7%）
// 拼团券：6人团 3中3不中（中奖率 50%）
const TIERS = {
    cash_10: {
        entryCost: 10, groupSize: 6, winnerCount: 4,
        winnerReturn: 10, winnerCash: 1,
        payType: 'balance', label: '$10现金拼团',
    },
    cash_20: {
        entryCost: 20, groupSize: 6, winnerCount: 4,
        winnerReturn: 20, winnerCash: 1,
        payType: 'balance', label: '$20现金拼团',
    },
    voucher: {
        entryCost: 0, groupSize: 6, winnerCount: 3,
        winnerReturn: 20, winnerCash: 1,
        payType: 'voucher', label: '拼团券拼团', voucherCost: 4,
    },
}

const PRIZE_POOL           = 1     // 每位中奖者触发 $1 帮扶分配
const HELP_PER_PERSON_RATE = 0.50  // 每位合格直推 $0.50（最多2人共 $1）

// 升档复投池
const TIER_ORDER_ALL = ['BASIC', 'PREMIUM', 'ELITE', 'TIER_300', 'TIER_500', 'TIER_1000']
const TIER_PRICES    = { BASIC: 20, PREMIUM: 50, ELITE: 100, TIER_300: 200, TIER_500: 500, TIER_1000: 1000 }
const V6_REINVEST_THRESHOLD = 100

// 每日次数限制
const DAILY_MAX_UNLOCKED    = 10  // 解锁后：每种现金拼团各 10 次（共 20 次）
const DAILY_MAX_BASIC       = 10  // 未解锁：所有现金拼团合计 10 次，且只能选 1 种
const MIN_UNLOCK_REFERRALS  = 2   // 直推 ≥2 人激活 V1+ 才能解锁两种现金拼团
const VOUCHER_DAILY_MAX     = 10  // 拼团券每日上限（独立计数，不影响现金）

const REFERRAL_RATE   = 0.01
const REFERRAL_LEVELS = 10

function todayStr() { return new Date().toISOString().split('T')[0] }

function pickWinners(userIds, count) {
    const arr = [...userIds]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, count)
}

// ─── 开奖 ────────────────────────────────────────────────────────
async function drawSession(supabase, sessionId, tierType, date) {
    const tier = TIERS[tierType]

    // CAS 抢锁：防止并发双开
    const { data: locked } = await supabase.from('pintuan_sessions')
        .update({ status: 'drawing' })
        .eq('id', sessionId).eq('status', 'open')
        .select('id')
    if (!locked?.length) return []

    const { data: entries } = await supabase
        .from('pintuan_entries')
        .select('id, user_id')
        .eq('session_id', sessionId)
        .is('is_winner', null)
        .order('joined_at', { ascending: true })
        .limit(tier.groupSize)

    if (!entries || entries.length < tier.groupSize) {
        await supabase.from('pintuan_sessions').update({ status: 'open' }).eq('id', sessionId)
        return []
    }

    const allUserIds = entries.map(e => e.user_id)
    const winnerIds  = pickWinners(allUserIds, tier.winnerCount)
    const winnerSet  = new Set(winnerIds)

    for (const entry of entries) {
        await supabase.from('pintuan_entries')
            .update({ is_winner: winnerSet.has(entry.user_id) })
            .eq('id', entry.id)
    }

    // 发奖励
    for (const winnerId of winnerIds) {
        const { data: u } = await supabase.from('users')
            .select('coin_balance, card_type, pintuan_cumulative, is_active, exit_count')
            .eq('id', winnerId).single()
        if (!u) continue

        const profitCredit = u.is_active ? tier.winnerCash : 0
        const newBal = (parseFloat(u.coin_balance) || 0) + tier.winnerReturn + profitCredit

        await supabase.from('users').update({
            coin_balance: newBal,
            exit_count: (parseInt(u.exit_count) || 0) + 1,
        }).eq('id', winnerId)

        if (u.is_active && profitCredit > 0) {
            await supabase.from('reward_logs').insert({
                user_id: winnerId,
                reward_type: 'pintuan_profit',
                amount: profitCredit,
                description: `${tier.label}中奖利润`,
            }).catch(() => {})
        }

        await payHelpBonus(supabase, winnerId, PRIZE_POOL)
    }

    // 团队流水分红（拼团券按 $20 等值计算流水）
    const flowAmount = tier.payType === 'voucher' ? tier.winnerReturn : tier.entryCost
    for (const memberId of allUserIds) {
        let currentId = memberId
        for (let level = 1; level <= REFERRAL_LEVELS; level++) {
            const { data: m } = await supabase.from('users')
                .select('referrer_id').eq('id', currentId).single()
            if (!m?.referrer_id) break
            await payReferral(supabase, m.referrer_id, flowAmount, date, level)
            currentId = m.referrer_id
        }
    }

    await supabase.from('pintuan_sessions').update({ status: 'completed' }).eq('id', sessionId)
    return winnerIds
}

// ─── 帮扶奖 ──────────────────────────────────────────────────────
async function payHelpBonus(supabase, winnerId, prizePool) {
    const { data: directs } = await supabase.from('users')
        .select('id, help_balance')
        .eq('referrer_id', winnerId)
        .gt('exit_count', 0)
        .limit(2)
    if (!directs?.length) return

    const ids = directs.map(d => d.id)
    const { data: entryRecs } = await supabase.from('pintuan_entries')
        .select('user_id').in('user_id', ids).limit(ids.length)
    const hasJoined = new Set((entryRecs || []).map(r => r.user_id))
    const eligible  = directs.filter(d => hasJoined.has(d.id))
    if (!eligible.length) return

    const perPerson = parseFloat((prizePool * HELP_PER_PERSON_RATE).toFixed(4))
    for (const d of eligible) {
        const newBal = parseFloat(((parseFloat(d.help_balance) || 0) + perPerson).toFixed(4))
        await supabase.from('users').update({ help_balance: newBal }).eq('id', d.id)
    }
}

// ─── 升档/循环复投 ────────────────────────────────────────────────
async function triggerCumulativeUpgrade(supabase, userId, currentCum, cardType) {
    try {
        const currentIdx = TIER_ORDER_ALL.indexOf(cardType)
        if (currentIdx < 0) return

        if (cardType === 'TIER_1000') {
            if (currentCum < V6_REINVEST_THRESHOLD) return
            const newCum = parseFloat((currentCum - V6_REINVEST_THRESHOLD).toFixed(4))
            const { data: u } = await supabase.from('users').select('activated_types').eq('id', userId).single()
            if (!u) return
            const newTypes = [...new Set([...(Array.isArray(u.activated_types) ? u.activated_types : []), 'ELITE'])]
            await supabase.from('users').update({ pintuan_cumulative: newCum, activated_types: newTypes }).eq('id', userId)
            await supabase.from('transactions').insert({
                id: `TXN_REINV_ELITE_${userId}_${Date.now()}`,
                user_id: userId, type: 'pintuan_reinvest', amount: V6_REINVEST_THRESHOLD,
                card_type: 'ELITE', status: 'completed',
                note: `V6拼团累计$${V6_REINVEST_THRESHOLD}自动复投V3`,
            }).catch(() => {})
            return
        }

        const nextTier  = TIER_ORDER_ALL[currentIdx + 1]
        const nextPrice = TIER_PRICES[nextTier]
        if (!nextTier || currentCum < nextPrice) return

        const newCum = parseFloat((currentCum - nextPrice).toFixed(4))
        const { data: u } = await supabase.from('users').select('activated_types').eq('id', userId).single()
        const newTypes = [...new Set([...(Array.isArray(u?.activated_types) ? u.activated_types : []), nextTier])]

        await supabase.from('users').update({
            card_type: nextTier, pintuan_cumulative: newCum,
            is_active: true, is_member: true, activated_types: newTypes,
        }).eq('id', userId)
        await supabase.from('transactions').insert({
            id: `TXN_AUTO_${nextTier}_${userId}_${Date.now()}`,
            user_id: userId, type: 'pintuan_auto_upgrade', amount: nextPrice,
            card_type: nextTier, status: 'completed',
            note: `拼团累计$${nextPrice}自动升档${nextTier}`,
        }).catch(() => {})
    } catch (e) {
        console.error('[Pintuan] cumulative upgrade error:', e)
    }
}

// ─── 流水分红 ─────────────────────────────────────────────────────
async function payReferral(supabase, refId, flowAmount, date, level) {
    // 条件1：推荐人当日参团 ≥2 次
    const { count } = await supabase.from('pintuan_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', refId).eq('join_date', date)
    if ((count || 0) < 2) return

    // 条件2：出局次数 ≥ 层级，决定可拿几层
    const { data: ru } = await supabase.from('users')
        .select('exit_count, pintuan_pending').eq('id', refId).single()
    if (!ru) return
    if ((ru.exit_count || 0) < level) return

    const amt = parseFloat((flowAmount * REFERRAL_RATE).toFixed(4))
    // 原子 RPC 防并发丢失
    await supabase.rpc('add_pintuan_pending', { p_user_id: refId, p_amount: amt })
}

// ─── 每日0点结算（团队流水 70%→余额 / 30%→升档池）─────────────────
export async function settlePintuanPending(supabase) {
    const { data: users } = await supabase.from('users')
        .select('id, coin_balance, pintuan_cumulative, pintuan_pending, card_type')
        .gt('pintuan_pending', 0)
    if (!users?.length) { console.log('[PintuanSettle] 无待结算用户'); return }

    let settled = 0
    for (const u of users) {
        const pending = parseFloat(u.pintuan_pending) || 0
        if (pending <= 0) continue
        const toBalance    = parseFloat((pending * 0.70).toFixed(4))
        const toCumulative = parseFloat((pending * 0.30).toFixed(4))
        const newBal = parseFloat(((parseFloat(u.coin_balance) || 0) + toBalance).toFixed(4))
        const newCum = parseFloat(((parseFloat(u.pintuan_cumulative) || 0) + toCumulative).toFixed(4))

        // CAS：防 cron 重跑双倍发钱
        const { data: settleOk } = await supabase.from('users').update({
            coin_balance: newBal, pintuan_cumulative: newCum, pintuan_pending: 0,
        }).eq('id', u.id).eq('pintuan_pending', u.pintuan_pending).select('id')
        if (!settleOk?.length) continue

        await supabase.from('reward_logs').insert({
            user_id: u.id,
            reward_type: 'pintuan_profit',
            amount: toBalance,
            description: `拼团团队流水日结（70%=$${toBalance}，30%=$${toCumulative}入升档池）`,
        }).catch(() => {})

        await triggerCumulativeUpgrade(supabase, u.id, newCum, u.card_type)
        settled++
    }
    console.log(`[PintuanSettle] 完成，共 ${settled} 位用户结算`)
}

// ─── 核心参团逻辑 ─────────────────────────────────────────────────
async function doJoin(supabase, userId, tierType, date) {
    const tier = TIERS[tierType]
    if (!tier) return { ok: false, code: 400, message: '不支持的拼团类型，请选择 $10/$20 现金或拼团券' }

    // ── 1. 每日次数检查 ──────────────────────────────────────────
    if (tierType === 'voucher') {
        const { count: vCnt } = await supabase.from('pintuan_entries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId).eq('join_date', date).eq('tier_type', 'voucher')
        if ((vCnt || 0) >= VOUCHER_DAILY_MAX) {
            return { ok: false, code: 400, message: `今日拼团券拼团已达 ${VOUCHER_DAILY_MAX} 次上限` }
        }
    } else {
        // 查直推激活人数决定解锁状态
        const { count: refCount } = await supabase.from('users')
            .select('id', { count: 'exact', head: true })
            .eq('referrer_id', userId).eq('is_active', true)
        const isUnlocked = (refCount || 0) >= MIN_UNLOCK_REFERRALS

        const { count: tierCnt } = await supabase.from('pintuan_entries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId).eq('join_date', date).eq('tier_type', tierType)

        if (isUnlocked) {
            // 解锁模式：每种独立计 10 次
            if ((tierCnt || 0) >= DAILY_MAX_UNLOCKED) {
                return { ok: false, code: 400, message: `今日${tier.label}已达 ${DAILY_MAX_UNLOCKED} 次上限` }
            }
        } else {
            // 未解锁：$10 和 $20 可自由混搭，合计不超过 10 次
            const { count: totalCashCnt } = await supabase.from('pintuan_entries')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId).eq('join_date', date)
                .in('tier_type', ['cash_10', 'cash_20'])
            if ((totalCashCnt || 0) >= DAILY_MAX_BASIC) {
                return { ok: false, code: 400, message: `今日现金拼团已达 ${DAILY_MAX_BASIC} 次上限，直推 ${MIN_UNLOCK_REFERRALS} 人激活V1+可解锁每种各10次` }
            }
        }
    }

    // ── 2. 15分钟冷却 ────────────────────────────────────────────
    const { data: lastEntry } = await supabase.from('pintuan_entries')
        .select('joined_at').eq('user_id', userId)
        .order('joined_at', { ascending: false }).limit(1).maybeSingle()
    if (lastEntry) {
        const cooldownMs = 15 * 60 * 1000
        const elapsed = Date.now() - new Date(lastEntry.joined_at).getTime()
        if (elapsed < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - elapsed) / 60000)
            return { ok: false, code: 429, message: `参团冷却中，约 ${remaining} 分钟后可再次参团` }
        }
    }

    // ── 3. 用户信息与资格 ─────────────────────────────────────────
    const { data: u } = await supabase.from('users')
        .select('coin_balance, help_balance, coupon_count, is_active, nickname, avatar')
        .eq('id', userId).single()
    if (!u) return { ok: false, code: 404, message: '用户不存在' }
    if (!u.is_active) return { ok: false, code: 403, message: '请激活V1+任意档位后参团' }

    // ── 4. 扣费（CAS防双花）─────────────────────────────────────
    let rollbackFn
    if (tier.payType === 'voucher') {
        const vCost = tier.voucherCost
        if ((u.coupon_count || 0) < vCost) {
            return { ok: false, code: 400, message: `拼团券不足，需要 ${vCost} 张（当前 ${u.coupon_count || 0} 张）` }
        }
        const { data: updV, error: errV } = await supabase.from('users')
            .update({ coupon_count: (u.coupon_count || 0) - vCost })
            .eq('id', userId).eq('coupon_count', u.coupon_count)
            .select('id')
        if (errV || !updV?.length) return { ok: false, code: 409, message: '拼团券更新冲突，请重试' }
        rollbackFn = () => supabase.rpc('add_coupon_count', { p_user_id: userId, p_amount: vCost })
    } else {
        const cost = tier.entryCost
        const bal  = parseFloat(u.coin_balance) || 0
        if (bal < cost) return { ok: false, code: 400, message: `余额不足，需要 $${cost}，当前 $${bal.toFixed(2)}` }
        const { data: updB, error: errB } = await supabase.from('users')
            .update({ coin_balance: parseFloat((bal - cost).toFixed(4)) })
            .eq('id', userId).eq('coin_balance', u.coin_balance)
            .select('id')
        if (errB || !updB?.length) return { ok: false, code: 409, message: '余额更新冲突，请重试' }
        rollbackFn = () => supabase.rpc('add_user_balance', { p_user_id: userId, p_field: 'coin_balance', p_amount: cost })
    }

    // ── 5. 找或建场次（按 tier_type 区分） ──────────────────────
    const { data: openSess } = await supabase.from('pintuan_sessions')
        .select('id')
        .eq('tier_type', tierType).eq('session_date', date).eq('status', 'open')
        .order('created_at', { ascending: true }).limit(1)

    let sessionId
    if (openSess?.length) {
        sessionId = openSess[0].id
    } else {
        const { data: ns } = await supabase.from('pintuan_sessions')
            .insert({ group_size: tier.groupSize, tier_type: tierType, session_date: date, status: 'open' })
            .select('id').single()
        sessionId = ns.id
    }

    // ── 6. 写入参团记录 ──────────────────────────────────────────
    const { error: entryErr } = await supabase.from('pintuan_entries').insert({
        session_id: sessionId,
        user_id: userId,
        nickname: u.nickname || '匿名',
        avatar: u.avatar || '',
        join_date: date,
        tier_type: tierType,
    })
    if (entryErr) {
        await rollbackFn()
        return { ok: false, code: 500, message: '加入失败，请重试' }
    }

    // ── 7. 满员开奖 ──────────────────────────────────────────────
    const { count: memberCnt } = await supabase.from('pintuan_entries')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)

    let winnerIds = []
    if ((memberCnt || 0) >= tier.groupSize) {
        winnerIds = await drawSession(supabase, sessionId, tierType, date)

        // 自动拼团：未中奖者若开启则续参同档
        const { data: allEntries } = await supabase.from('pintuan_entries')
            .select('user_id, is_winner').eq('session_id', sessionId)
        for (const entry of (allEntries || [])) {
            if (!entry.is_winner) {
                const { data: pref } = await supabase.from('pintuan_user_prefs')
                    .select('auto_rejoin').eq('user_id', entry.user_id).maybeSingle()
                if (pref?.auto_rejoin) {
                    doJoin(supabase, entry.user_id, tierType, date).catch(() => {})
                }
            }
        }
    }

    const sessionFull = (memberCnt || 0) >= tier.groupSize
    const isWinner    = winnerIds.includes(userId)

    let message
    if (!sessionFull) {
        message = `已加入${tier.label}，当前 ${memberCnt}/${tier.groupSize} 人，等待满员开奖`
    } else if (isWinner) {
        message = `🎉 恭喜中奖！$${tier.winnerReturn} 本金已返，$${tier.winnerCash} 现金到账`
    } else {
        message = `本次未中奖，团队流水分红每日0点结算，继续加油！`
    }

    return { ok: true, isWinner, sessionFull, message, tierType }
}

// ─── GET /api/pintuan/status ─────────────────────────────────────
router.get('/status', async (request) => {
    const { supabase, user } = request
    const date = todayStr()

    let todayCounts = { cash_10: 0, cash_20: 0, voucher: 0 }
    let isUnlocked = false, autoRejoin = false, referralCount = 0

    if (user) {
        const [cnt10, cnt20, cntV, refRes, pref] = await Promise.all([
            supabase.from('pintuan_entries')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id).eq('join_date', date).eq('tier_type', 'cash_10'),
            supabase.from('pintuan_entries')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id).eq('join_date', date).eq('tier_type', 'cash_20'),
            supabase.from('pintuan_entries')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id).eq('join_date', date).eq('tier_type', 'voucher'),
            supabase.from('users')
                .select('id', { count: 'exact', head: true })
                .eq('referrer_id', user.id).eq('is_active', true),
            supabase.from('pintuan_user_prefs')
                .select('auto_rejoin').eq('user_id', user.id).maybeSingle(),
        ])
        todayCounts.cash_10 = cnt10.count || 0
        todayCounts.cash_20 = cnt20.count || 0
        todayCounts.voucher = cntV.count || 0
        referralCount = refRes.count || 0
        isUnlocked    = referralCount >= MIN_UNLOCK_REFERRALS
        autoRejoin    = pref.data?.auto_rejoin || false
    }

    // 各档位开放场次进度
    const sessions = {}
    for (const tierType of Object.keys(TIERS)) {
        const { data: openSessions } = await supabase.from('pintuan_sessions')
            .select('id, group_size')
            .eq('tier_type', tierType).eq('session_date', date).eq('status', 'open')
            .order('created_at', { ascending: true })

        const list = []
        for (const s of (openSessions || [])) {
            const { count: c } = await supabase.from('pintuan_entries')
                .select('id', { count: 'exact', head: true }).eq('session_id', s.id)
            list.push({ id: s.id, currentMembers: c || 0, groupSize: TIERS[tierType].groupSize })
        }
        list.sort((a, b) => b.currentMembers - a.currentMembers)
        sessions[tierType] = list
    }

    return Response.json({
        code: 0,
        data: {
            todayCounts,
            isUnlocked,
            referralCount,
            minReferrals: MIN_UNLOCK_REFERRALS,
            dailyLimits: {
                cash_unlocked: DAILY_MAX_UNLOCKED,
                cash_basic: DAILY_MAX_BASIC,
                voucher: VOUCHER_DAILY_MAX,
            },
            autoRejoin,
            sessions,
            tiers: Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, {
                label: v.label, entryCost: v.entryCost, groupSize: v.groupSize,
                winnerCount: v.winnerCount, winnerReturn: v.winnerReturn, winnerCash: v.winnerCash,
                voucherCost: v.voucherCost,
            }])),
        },
    })
})

// ─── POST /api/pintuan/join ──────────────────────────────────────
router.post('/join', async (request) => {
    const { supabase, user } = request
    if (!user) return Response.json({ code: 401, message: '请先登录' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const date = todayStr()

    // tierType: 'cash_10' | 'cash_20' | 'voucher'
    const tierType = body.tierType
    if (!TIERS[tierType]) {
        return Response.json({ code: 400, message: '请选择拼团类型：cash_10 / cash_20 / voucher' }, { status: 400 })
    }

    if (body.autoRejoin !== undefined) {
        await supabase.from('pintuan_user_prefs').upsert({
            user_id: user.id, auto_rejoin: !!body.autoRejoin,
            group_size_pref: TIERS[tierType].groupSize,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
    }

    const result = await doJoin(supabase, user.id, tierType, date)

    if (!result.ok) {
        return Response.json({ code: result.code, message: result.message }, { status: result.code })
    }

    return Response.json({
        code: 0, message: result.message,
        data: { isWinner: result.isWinner, sessionFull: result.sessionFull, tierType: result.tierType },
    })
})

// ─── POST /api/pintuan/auto-toggle ──────────────────────────────
router.post('/auto-toggle', async (request) => {
    const { supabase, user } = request
    if (!user) return Response.json({ code: 401, message: '请先登录' }, { status: 401 })

    const { autoRejoin } = await request.json().catch(() => ({}))
    await supabase.from('pintuan_user_prefs').upsert({
        user_id: user.id, auto_rejoin: !!autoRejoin,
        group_size_pref: 6, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return Response.json({ code: 0, message: autoRejoin ? '已开启自动拼团' : '已关闭自动拼团' })
})

// ─── POST /api/pintuan/voucher/buy ──────────────────────────────
const VOUCHER_BUY_PRICE = 5
router.post('/voucher/buy', async (request) => {
    const { supabase, user } = request
    if (!user) return Response.json({ code: 401, message: '请先登录' })
    const { count = 1 } = await request.json().catch(() => ({}))
    const cnt = Math.max(1, Math.min(10, parseInt(count) || 1))
    const totalCost = VOUCHER_BUY_PRICE * cnt

    const { data: u } = await supabase.from('users').select('coin_balance, coupon_count').eq('id', user.id).single()
    if (!u) return Response.json({ code: 404, message: '用户不存在' })

    const bal = parseFloat(u.coin_balance) || 0
    if (bal < totalCost) return Response.json({ code: 400, message: `余额不足，需要 $${totalCost}，当前 $${bal.toFixed(2)}` })

    const { data: updBuy, error: errBuy } = await supabase.from('users')
        .update({ coin_balance: parseFloat((bal - totalCost).toFixed(4)), coupon_count: (u.coupon_count || 0) + cnt })
        .eq('id', user.id).eq('coin_balance', u.coin_balance)
        .select('id')
    if (errBuy || !updBuy?.length) return Response.json({ code: 409, message: '余额更新冲突，请重试' })

    return Response.json({ code: 200, message: `成功购买 ${cnt} 张拼团券，共消费 $${totalCost}` })
})

// ─── POST /api/pintuan/voucher/transfer ─────────────────────────
router.post('/voucher/transfer', async (request) => {
    const { supabase, user } = request
    if (!user) return Response.json({ code: 401, message: '请先登录' })
    const { toInviteCode, count = 1 } = await request.json().catch(() => ({}))
    if (!toInviteCode) return Response.json({ code: 400, message: '请输入对方邀请码' })
    const cnt = Math.max(1, parseInt(count) || 1)

    const [{ data: sender }, { data: receiver }] = await Promise.all([
        supabase.from('users').select('coupon_count').eq('id', user.id).single(),
        supabase.from('users').select('id, coupon_count').ilike('invite_code', toInviteCode.trim()).single(),
    ])

    if (!sender) return Response.json({ code: 404, message: '用户不存在' })
    if (!receiver) return Response.json({ code: 404, message: '邀请码无效，找不到对方用户' })
    if (String(receiver.id) === String(user.id)) return Response.json({ code: 400, message: '不能转赠给自己' })
    if ((sender.coupon_count || 0) < cnt) return Response.json({ code: 400, message: `拼团券不足，当前只有 ${sender.coupon_count || 0} 张` })

    const { data: updXfer, error: errXfer } = await supabase.from('users')
        .update({ coupon_count: (sender.coupon_count || 0) - cnt })
        .eq('id', user.id).eq('coupon_count', sender.coupon_count)
        .select('id')
    if (errXfer || !updXfer?.length) return Response.json({ code: 409, message: '更新冲突，请重试' })

    await supabase.from('users')
        .update({ coupon_count: (receiver.coupon_count || 0) + cnt })
        .eq('id', receiver.id)

    return Response.json({ code: 200, message: `成功转赠 ${cnt} 张拼团券` })
})

export const pintuanRoutes = router

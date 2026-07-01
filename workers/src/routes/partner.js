/**
 * 服务商路由 - Service Provider Routes
 *
 * 服务商条件（自动升级）：激活 V6($1000) 且 出局 ≥ 30 个店主 → 自动设置 is_service_provider = true
 * 管理员也可手动设置（立即生效）
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/partner' })

const SP_REQUIREMENTS = { requiredTier: 'TIER_1000', minExitCount: 30 }

/**
 * 检查并自动晋升为服务商（激活V6 且 出局≥30 时写 is_service_provider=true）
 */
async function autoPromotePartner(supabase, userId) {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('is_service_provider, activated_types, exit_count')
            .eq('id', userId).single()
        if (!user || user.is_service_provider) return
        const tiers = Array.isArray(user.activated_types) ? user.activated_types : []
        const hasV6 = tiers.includes(SP_REQUIREMENTS.requiredTier)
        const exitOk = (user.exit_count || 0) >= SP_REQUIREMENTS.minExitCount
        if (hasV6 && exitOk) {
            await supabase.from('users').update({ is_service_provider: true }).eq('id', userId)
            console.log(`[ServiceProvider] 用户 ${userId} 自动晋升为服务商`)
        }
    } catch (e) {
        console.error('[autoPromotePartner]', e)
    }
}

/** 验证管理员码 */
async function verifyAdmin(supabase, env, adminCode) {
    const envCode = (env?.ADMIN_CODE || '').trim()
    let storedCode = envCode
    if (!storedCode) {
        const { data } = await supabase.from('admin_settings')
            .select('setting_value').eq('setting_key', 'admin_login_code').single()
        storedCode = data?.setting_value?.trim() || ''
    }
    return storedCode && adminCode?.trim() === storedCode
}

/**
 * GET /api/partner/eligibility?userId=xxx
 */
router.get('/eligibility', async (request) => {
    const supabase = request.supabase
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return Response.json({ code: 400, message: '缺少 userId' })
    try {
        const { data: user, error } = await supabase
            .from('users').select('id, is_member, direct_push_count, team_count_6_layers, is_partner').eq('id', userId).single()
        if (error || !user) return Response.json({ code: 404, message: '用户不存在' })
        const directPush = user.direct_push_count || 0
        const teamSize = user.team_count_6_layers || 0
        const directPushOk = directPush >= PARTNER_REQUIREMENTS.minDirectPush
        const teamSizeOk = teamSize >= PARTNER_REQUIREMENTS.minTeamSize
        const autoEligible = directPushOk && teamSizeOk
        return Response.json({
            code: 200,
            data: { eligible: autoEligible || !!user.is_partner, directPush, teamSize, directPushOk, teamSizeOk, isManual: !!user.is_partner, requirements: PARTNER_REQUIREMENTS }
        })
    } catch (err) {
        return Response.json({ code: 500, message: '检查资格失败' }, { status: 500 })
    }
})

/**
 * GET /api/partner/info?userId=xxx
 */
router.get('/info', async (request) => {
    const supabase = request.supabase
    const env = request.env
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return Response.json({ code: 400, message: '缺少 userId' })
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, is_member, card_type, direct_push_count, team_count_6_layers, role, is_independent, is_partner')
            .eq('id', userId).single()
        if (error || !user) return Response.json({ code: 404, message: '用户不存在' })

        const directPush = user.direct_push_count || 0
        const teamSize = user.team_count_6_layers || 0
        const directPushOk = directPush >= PARTNER_REQUIREMENTS.minDirectPush
        const teamSizeOk = teamSize >= PARTNER_REQUIREMENTS.minTeamSize
        const isManualPartner = !!user.is_partner
        // 合伙人：直推≥10 且 团队≥50，或管理员手动设置
        const isPartner = (directPushOk && teamSizeOk) || isManualPartner

        // 读取微信联系方式
        let wechatNumber = null
        if (env?.CACHE) wechatNumber = await env.CACHE.get(`partner_contact:${userId}`)

        return Response.json({
            code: 200,
            data: {
                isPartner,
                isManualPartner,
                isMember: user.is_member,
                role: user.role,
                directPush, teamSize, directPushOk, teamSizeOk,
                requirements: PARTNER_REQUIREMENTS,
                wechatNumber
            }
        })
    } catch (err) {
        console.error('[Partner Info] Error:', err)
        return Response.json({ code: 500, message: '获取信息失败' }, { status: 500 })
    }
})

/**
 * POST /api/partner/save-contact
 * 保存自己的微信联系方式
 * Body: { userId, wechatNumber }
 */
router.post('/save-contact', async (request) => {
    const env = request.env
    const supabase = request.supabase
    try {
        const { userId, wechatNumber } = await request.json()
        if (!userId || !wechatNumber?.trim()) return Response.json({ code: 400, message: '缺少参数' })
        // 验证是否为合伙人（直推≥10 且 团队≥50，或手动设置）
        const { data: user } = await supabase
            .from('users').select('direct_push_count, team_count_6_layers, is_partner').eq('id', userId).single()
        const directPush = user?.direct_push_count || 0
        const teamSize = user?.team_count_6_layers || 0
        const autoOk = directPush >= PARTNER_REQUIREMENTS.minDirectPush && teamSize >= PARTNER_REQUIREMENTS.minTeamSize
        if (!autoOk && !user?.is_partner) {
            return Response.json({ code: 403, message: '暂无合伙人资格（需直推≥10人且团队≥50人）' })
        }
        if (!env?.CACHE) return Response.json({ code: 500, message: '存储不可用' })
        await env.CACHE.put(`partner_contact:${userId}`, wechatNumber.trim())
        return Response.json({ code: 200, message: '联系方式已保存' })
    } catch (err) {
        console.error('[Partner SaveContact] Error:', err)
        return Response.json({ code: 500, message: '保存失败' }, { status: 500 })
    }
})

/**
 * GET /api/partner/dividends?userId=xxx
 */
router.get('/dividends', async (request) => {
    const supabase = request.supabase
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return Response.json({ code: 400, message: '缺少 userId' })
    try {
        const { data: records, error } = await supabase
            .from('partner_dividends')
            .select('amount, source_date, source_amount, partner_count, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100)
        if (error) return Response.json({ code: 500, message: '获取分红记录失败' })

        const todayStr = new Date().toISOString().split('T')[0]
        const thisMonthStart = new Date(); thisMonthStart.setDate(1)
        const thisMonthStr = thisMonthStart.toISOString().split('T')[0]

        let totalEarnings = 0, todayEarnings = 0, thisMonthEarnings = 0
        ;(records || []).forEach(r => {
            const amt = parseFloat(r.amount) || 0
            totalEarnings += amt
            if (r.source_date === todayStr) todayEarnings += amt
            if (r.source_date >= thisMonthStr) thisMonthEarnings += amt
        })
        return Response.json({ code: 200, data: { totalEarnings, todayEarnings, thisMonthEarnings, records: records || [] } })
    } catch (err) {
        console.error('[Partner Dividends] Error:', err)
        return Response.json({ code: 500, message: '获取分红统计失败' }, { status: 500 })
    }
})

/**
 * GET /api/partner/direct-push-status?userId=xxx
 * 返回出局分润状态：出局数、是否满足条件（>=10）、分红统计
 */
router.get('/direct-push-status', async (request) => {
    const supabase = request.supabase
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return Response.json({ code: 400, message: '缺少 userId' })

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, exit_count, role, is_member')
            .eq('id', userId).single()
        if (error || !user) return Response.json({ code: 404, message: '用户不存在' })

        const exitCount = parseInt(user.exit_count || 0)
        const hasShop = user.role === 'owner'
        const isQualified = hasShop && exitCount >= 20

        // 读管理员设置的出局分润比例
        const { data: rateSetting } = await supabase.from('admin_settings')
            .select('setting_value').eq('setting_key', 'exit_dividend_rate').single()
        const exitRate = parseFloat(rateSetting?.setting_value || 0.10)

        // 分红统计
        const { data: records } = await supabase
            .from('partner_dividends').select('amount, source_date')
            .eq('user_id', userId).order('source_date', { ascending: false }).limit(60)

        const todayStr = new Date().toISOString().split('T')[0]
        const monthStr = new Date(new Date().setDate(1)).toISOString().split('T')[0]
        let todayEarnings = 0, monthEarnings = 0, totalEarnings = 0
        ;(records || []).forEach(r => {
            const amt = parseFloat(r.amount) || 0
            totalEarnings += amt
            if (r.source_date === todayStr) todayEarnings += amt
            if (r.source_date >= monthStr) monthEarnings += amt
        })

        return Response.json({
            code: 200,
            data: {
                exitCount, hasShop, isQualified,
                exitMin: 20, exitRate,
                todayEarnings: Math.round(todayEarnings * 100) / 100,
                monthEarnings: Math.round(monthEarnings * 100) / 100,
                totalEarnings: Math.round(totalEarnings * 100) / 100,
            }
        })
    } catch (err) {
        console.error('[ExitDividendStatus] Error:', err)
        return Response.json({ code: 500, message: '获取状态失败' }, { status: 500 })
    }
})

/**
 * GET /api/partner/admin-list?adminCode=xxx
 * 管理员获取合伙人列表（直推≥10 或 is_partner=true）
 */
router.get('/admin-list', async (request) => {
    const supabase = request.supabase
    const env = request.env
    const url = new URL(request.url)
    const adminCode = url.searchParams.get('adminCode')
    if (!await verifyAdmin(supabase, env, adminCode)) {
        return Response.json({ code: 403, message: '管理员码错误' })
    }
    try {
        // 查询直推≥10 且 团队≥50（自动合伙人）或 手动设置合伙人
        const { data: autoUsers } = await supabase
            .from('users')
            .select('id, username, coin_balance, referrer_id, direct_push_count, team_count_6_layers, invite_code, is_partner')
            .gte('direct_push_count', PARTNER_REQUIREMENTS.minDirectPush)
            .gte('team_count_6_layers', PARTNER_REQUIREMENTS.minTeamSize)
            .order('direct_push_count', { ascending: false })
            .limit(200)

        const { data: manualUsers } = await supabase
            .from('users')
            .select('id, username, coin_balance, referrer_id, direct_push_count, team_count_6_layers, invite_code, is_partner')
            .eq('is_partner', true)
            .limit(200)

        // 合并去重
        const seen = new Set()
        const allUsers = []
        for (const u of [...(autoUsers || []), ...(manualUsers || [])]) {
            if (!seen.has(u.id)) { seen.add(u.id); allUsers.push(u) }
        }

        const list = await Promise.all(allUsers.map(async u => {
            let wechatNumber = ''
            if (env?.CACHE) wechatNumber = (await env.CACHE.get(`partner_contact:${u.id}`)) || ''
            return {
                id: u.id,
                username: u.username,
                balance: parseFloat(u.coin_balance || 0).toFixed(2),
                referrerId: u.referrer_id,
                directPushCount: u.direct_push_count || 0,
                inviteCode: u.invite_code,
                wechatNumber,
                isManual: !!u.is_partner && (u.direct_push_count || 0) < PARTNER_REQUIREMENTS.minDirectPush
            }
        }))

        return Response.json({ code: 200, data: list })
    } catch (err) {
        console.error('[Partner AdminList] Error:', err)
        return Response.json({ code: 500, message: '获取列表失败' }, { status: 500 })
    }
})

/**
 * POST /api/partner/admin-set
 * 管理员手动设置某用户为合伙人（立即生效）
 * Body: { adminCode, userId, wechatNumber? }
 */
router.post('/admin-set', async (request) => {
    const supabase = request.supabase
    const env = request.env
    try {
        const { adminCode, userId, wechatNumber } = await request.json()
        if (!adminCode || !userId) return Response.json({ code: 400, message: '缺少参数' })
        if (!await verifyAdmin(supabase, env, adminCode)) {
            return Response.json({ code: 403, message: '管理员码错误' })
        }
        // 设置 is_partner = true
        const { error } = await supabase.from('users').update({ is_partner: true }).eq('id', String(userId))
        if (error) return Response.json({ code: 500, message: '设置失败: ' + error.message })
        // 如果同时传了微信号，保存
        if (wechatNumber?.trim() && env?.CACHE) {
            await env.CACHE.put(`partner_contact:${userId}`, wechatNumber.trim())
        }
        return Response.json({ code: 200, message: `用户 ${userId} 已设为合伙人` })
    } catch (err) {
        console.error('[Partner AdminSet] Error:', err)
        return Response.json({ code: 500, message: '设置失败' }, { status: 500 })
    }
})

/**
 * POST /api/partner/admin-revoke
 * 管理员撤销合伙人资格
 * Body: { adminCode, userId }
 */
router.post('/admin-revoke', async (request) => {
    const supabase = request.supabase
    const env = request.env
    try {
        const { adminCode, userId } = await request.json()
        if (!adminCode || !userId) return Response.json({ code: 400, message: '缺少参数' })
        if (!await verifyAdmin(supabase, env, adminCode)) {
            return Response.json({ code: 403, message: '管理员码错误' })
        }
        // 仅撤销手动设置的（直推≥10的无需撤销，他们通过条件自动成为合伙人）
        const { error } = await supabase.from('users').update({ is_partner: false }).eq('id', String(userId))
        if (error) return Response.json({ code: 500, message: '撤销失败: ' + error.message })
        // 清除联系方式
        if (env?.CACHE) await env.CACHE.delete(`partner_contact:${userId}`)
        return Response.json({ code: 200, message: `用户 ${userId} 合伙人资格已撤销` })
    } catch (err) {
        console.error('[Partner AdminRevoke] Error:', err)
        return Response.json({ code: 500, message: '撤销失败' }, { status: 500 })
    }
})

/**
 * GET /api/partner/service-three
 * 轮流返回3个有微信号的服务合伙人（点对点激活服务）
 * 每次调用 counter+1，展示 [i%n, (i+1)%n, (i+2)%n] 三位合伙人
 */
router.get('/service-three', async (request) => {
    const supabase = request.supabase
    const env = request.env
    try {
        // 1. 获取所有合伙人（直推≥10 且 团队≥50，或手动设置）
        const { data: autoUsers } = await supabase
            .from('users')
            .select('id, username, direct_push_count, team_count_6_layers, is_partner')
            .gte('direct_push_count', PARTNER_REQUIREMENTS.minDirectPush)
            .gte('team_count_6_layers', PARTNER_REQUIREMENTS.minTeamSize)
        const { data: manualUsers } = await supabase
            .from('users')
            .select('id, username, direct_push_count, team_count_6_layers, is_partner')
            .eq('is_partner', true)

        // 合并去重
        const seen = new Set()
        const allPartners = []
        for (const u of [...(autoUsers || []), ...(manualUsers || [])]) {
            if (!seen.has(u.id)) { seen.add(u.id); allPartners.push(u) }
        }

        // 2. 过滤出有微信号的合伙人
        const withWechat = []
        for (const u of allPartners) {
            let wechat = ''
            if (env?.CACHE) wechat = (await env.CACHE.get(`partner_contact:${u.id}`)) || ''
            if (wechat) withWechat.push({ id: u.id, username: u.username, wechatNumber: wechat })
        }

        if (withWechat.length === 0) {
            return Response.json({ code: 200, data: [] })
        }

        // 3. 轮流计数器（KV 存储）
        let counter = 0
        if (env?.CACHE) {
            const stored = await env.CACHE.get('service_partner_counter')
            counter = parseInt(stored || '0', 10) || 0
            await env.CACHE.put('service_partner_counter', String(counter + 1))
        }

        // 4. 取3位，循环索引
        const n = withWechat.length
        const result = []
        for (let i = 0; i < Math.min(3, n); i++) {
            result.push(withWechat[(counter + i) % n])
        }

        return Response.json({ code: 200, data: result })
    } catch (err) {
        console.error('[Partner ServiceThree] Error:', err)
        return Response.json({ code: 500, message: '获取失败' }, { status: 500 })
    }
})

export const partnerRoutes = router

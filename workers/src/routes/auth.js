/**
 * 认证路由 - Auth Routes
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/auth' })

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', async (request) => {
    const supabase = request.supabase

    try {
        const { phone, password, referrerCode } = await request.json()

        if (!phone || !password) {
            return Response.json({ code: 400, message: '手机号和密码不能为空' })
        }

        // 检查手机号是否已注册
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('phone', phone)
            .single()

        if (existing) {
            return Response.json({ code: 400, message: '该手机号已注册' })
        }

        // 查找推荐人
        let referrerId = null
        if (referrerCode) {
            const { data: referrer } = await supabase
                .from('users')
                .select('id')
                .eq('invite_code', referrerCode)
                .single()

            if (referrer) {
                referrerId = referrer.id
            }
        }

        // 使用 Supabase Auth 创建用户
        const { data: authData, error: authError } = await supabase.auth.signUp({
            phone,
            password
        })

        if (authError) {
            return Response.json({ code: 400, message: authError.message })
        }

        // 创建用户记录
        const inviteCode = generateInviteCode()
        const { error: insertError } = await supabase.from('users').insert({
            id: authData.user.id,
            phone,
            invite_code: inviteCode,
            referrer_id: referrerId
        })

        if (insertError) {
            console.error('[Register] Insert error:', insertError)
        }

        // 更新推荐人的直推数
        if (referrerId) {
            await supabase.rpc('increment_direct_push', { p_user_id: referrerId })
        }

        return Response.json({
            code: 200,
            message: '注册成功',
            data: {
                userId: authData.user.id,
                inviteCode
            }
        })

    } catch (error) {
        console.error('[Register] Error:', error)
        return Response.json({ code: 500, message: '注册失败' }, { status: 500 })
    }
})

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (request) => {
    const supabase = request.supabase

    try {
        const { phone, password } = await request.json()

        if (!phone || !password) {
            return Response.json({ code: 400, message: '手机号和密码不能为空' })
        }

        // Supabase Auth 登录
        const { data, error } = await supabase.auth.signInWithPassword({
            phone,
            password
        })

        if (error) {
            return Response.json({ code: 401, message: '手机号或密码错误' })
        }

        // 获取用户信息
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single()

        // 更新最后登录
        await supabase
            .from('users')
            .update({
                last_login_at: new Date().toISOString(),
                last_login_ip: request.headers.get('CF-Connecting-IP')
            })
            .eq('id', data.user.id)

        return Response.json({
            code: 200,
            message: '登录成功',
            data: {
                token: data.session.access_token,
                refreshToken: data.session.refresh_token,
                user: {
                    id: user.id,
                    phone: user.phone,
                    username: user.username,
                    is_member: user.is_member,
                    invite_code: user.invite_code
                }
            }
        })

    } catch (error) {
        console.error('[Login] Error:', error)
        return Response.json({ code: 500, message: '登录失败' }, { status: 500 })
    }
})

/**
 * POST /api/auth/logout
 * 退出登录
 */
router.post('/logout', async (request) => {
    const supabase = request.supabase

    try {
        await supabase.auth.signOut()
        return Response.json({ code: 200, message: '已退出登录' })
    } catch (error) {
        return Response.json({ code: 200, message: '已退出登录' })
    }
})

/**
 * GET /api/auth/user/:userId
 * 获取用户信息
 */
router.get('/user/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select(`
        id, phone, username, is_member, card_type,
        subscription_end_date, coin_balance, invite_code,
        direct_push_count, created_at, transaction_password
      `)
            .eq('id', userId)
            .single()

        if (error || !user) {
            return Response.json({ code: 404, message: '用户不存在' })
        }

        // 返回是否设置了交易密码，但不返回密码本身
        const userData = {
            ...user,
            has_transaction_password: !!user.transaction_password
        }
        delete userData.transaction_password

        return Response.json({ code: 200, data: userData })

    } catch (error) {
        console.error('[Get User] Error:', error)
        return Response.json({ code: 500, message: '获取用户信息失败' }, { status: 500 })
    }
})

/**
 * PUT /api/auth/avatar
 * 更新用户头像
 */
router.put('/avatar', async (request) => {
    const supabase = request.supabase

    try {
        const { userId, avatarUrl } = await request.json()

        if (!userId || !avatarUrl) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        // 更新用户头像
        const { error } = await supabase
            .from('users')
            .update({ avatar_url: avatarUrl })
            .eq('id', userId)

        if (error) {
            console.error('[Update Avatar] Error:', error)
            return Response.json({ code: 500, message: '更新头像失败' }, { status: 500 })
        }

        return Response.json({
            code: 200,
            message: '头像更新成功',
            data: { avatarUrl }
        })

    } catch (error) {
        console.error('[Update Avatar] Error:', error)
        return Response.json({ code: 500, message: '更新头像失败' }, { status: 500 })
    }
})

/**
 * GET /api/auth/avatar/:userId
 * 获取用户头像
 */
router.get('/avatar/:userId', async (request) => {
    const { userId } = request.params
    const supabase = request.supabase

    try {
        const { data, error } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single()

        if (error || !data) {
            return Response.json({ code: 404, message: '用户不存在' })
        }

        return Response.json({
            code: 200,
            data: { avatarUrl: data.avatar_url }
        })

    } catch (error) {
        console.error('[Get Avatar] Error:', error)
        return Response.json({ code: 500, message: '获取头像失败' }, { status: 500 })
    }
})

/**
 * 生成邀请码
 */
function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

/**
 * SHA-256 哈希函数
 */
async function hashPassword(password) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * POST /api/auth/transaction-password
 * 设置交易密码
 */
router.post('/transaction-password', async (request) => {
    const supabase = request.supabase

    try {
        const { userId, password } = await request.json()

        if (!userId || !password) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        if (!/^\d{6}$/.test(password)) {
            return Response.json({ code: 400, message: '交易密码必须是6位数字' })
        }

        // 检查用户是否已设置交易密码
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('transaction_password')
            .eq('id', userId)
            .single()

        if (userError || !user) {
            return Response.json({ code: 404, message: '用户不存在' })
        }

        if (user.transaction_password) {
            return Response.json({ code: 400, message: '已设置交易密码，请使用修改功能' })
        }

        // 哈希密码后存储
        const hashedPassword = await hashPassword(password)

        const { error: updateError } = await supabase
            .from('users')
            .update({ transaction_password: hashedPassword })
            .eq('id', userId)

        if (updateError) {
            console.error('[Set Transaction Password] Error:', updateError)
            return Response.json({ code: 500, message: '设置失败' }, { status: 500 })
        }

        return Response.json({ code: 200, message: '交易密码设置成功' })

    } catch (error) {
        console.error('[Set Transaction Password] Error:', error)
        return Response.json({ code: 500, message: '设置失败' }, { status: 500 })
    }
})

/**
 * PUT /api/auth/transaction-password
 * 修改交易密码
 */
router.put('/transaction-password', async (request) => {
    const supabase = request.supabase

    try {
        const { userId, currentPassword, newPassword } = await request.json()

        if (!userId || !currentPassword || !newPassword) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        if (!/^\d{6}$/.test(newPassword)) {
            return Response.json({ code: 400, message: '新密码必须是6位数字' })
        }

        // 获取用户当前密码
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('transaction_password')
            .eq('id', userId)
            .single()

        if (userError || !user) {
            return Response.json({ code: 404, message: '用户不存在' })
        }

        if (!user.transaction_password) {
            return Response.json({ code: 400, message: '请先设置交易密码' })
        }

        // 验证当前密码
        const hashedCurrent = await hashPassword(currentPassword)
        if (user.transaction_password !== hashedCurrent) {
            return Response.json({ code: 400, message: '当前密码错误' })
        }

        // 更新为新密码
        const hashedNew = await hashPassword(newPassword)

        const { error: updateError } = await supabase
            .from('users')
            .update({ transaction_password: hashedNew })
            .eq('id', userId)

        if (updateError) {
            console.error('[Change Transaction Password] Error:', updateError)
            return Response.json({ code: 500, message: '修改失败' }, { status: 500 })
        }

        return Response.json({ code: 200, message: '交易密码修改成功' })

    } catch (error) {
        console.error('[Change Transaction Password] Error:', error)
        return Response.json({ code: 500, message: '修改失败' }, { status: 500 })
    }
})

/**
 * POST /api/auth/verify-password
 * 验证交易密码
 */
router.post('/verify-password', async (request) => {
    const supabase = request.supabase

    try {
        const { userId, password } = await request.json()

        if (!userId || !password) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        // 验证密码格式（必须是6位数字）
        if (!/^\d{6}$/.test(password)) {
            return Response.json({ code: 401, message: '交易密码必须是6位数字' })
        }

        // 获取用户交易密码
        const { data: user, error } = await supabase
            .from('users')
            .select('transaction_password')
            .eq('id', userId)
            .single()

        // 查询失败（DB 异常）
        if (error) {
            console.error('[Verify Password] DB Error:', error)
            return Response.json({ code: 500, message: '验证服务异常，请稍后重试' })
        }

        // 用户不存在
        if (!user) {
            return Response.json({ code: 404, message: '用户不存在' })
        }

        // 未设置交易密码：要求先设置，不允许绕过
        if (!user.transaction_password) {
            return Response.json({ code: 428, message: '请先设置交易密码后再操作' })
        }

        // SHA-256 哈希比较（兼容明文旧密码迁移）
        const hashedInput = await hashPassword(password)
        if (user.transaction_password === hashedInput || user.transaction_password === password) {
            return Response.json({ code: 200, message: '验证通过' })
        }

        return Response.json({ code: 401, message: '交易密码错误' })

    } catch (error) {
        console.error('[Verify Password] Error:', error)
        return Response.json({ code: 500, message: '验证服务异常，请稍后重试' })
    }
})

/**
 * POST /api/auth/verify-switch
 * 验证切换账号PIN码
 * PIN默认=userId后4位，可由管理员通过KV自定义
 */
router.post('/verify-switch', async (request) => {
    const env = request.env
    try {
        const { userId, pin } = await request.json()
        if (!userId || !pin) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        // 从KV读取自定义PIN（管理员可设置）
        let expectedPin = null
        if (env.CACHE) {
            expectedPin = await env.CACHE.get(`switch_pin:${userId}`)
        }
        // 默认PIN = userId后4位
        if (!expectedPin) {
            expectedPin = String(userId).slice(-4)
        }

        if (String(pin).trim() !== expectedPin) {
            return Response.json({ code: 403, message: '验证码错误，请输入正确的切换码' })
        }

        return Response.json({ code: 200, message: '验证通过' })
    } catch (error) {
        console.error('[VerifySwitch] Error:', error)
        return Response.json({ code: 500, message: '验证失败' }, { status: 500 })
    }
})

/**
 * POST /api/auth/set-switch-pin
 * 管理员设置指定用户的切换PIN
 */
router.post('/set-switch-pin', async (request) => {
    const env = request.env
    try {
        const { adminId, userId, pin } = await request.json()
        if (String(adminId) !== '82377') {
            return Response.json({ code: 403, message: '无管理员权限' })
        }
        if (!userId || !pin || String(pin).length < 4) {
            return Response.json({ code: 400, message: 'PIN至少4位' })
        }
        if (env.CACHE) {
            await env.CACHE.put(`switch_pin:${userId}`, String(pin))
        }
        return Response.json({ code: 200, message: `用户${userId}的切换PIN已设置为${pin}` })
    } catch (error) {
        console.error('[SetSwitchPin] Error:', error)
        return Response.json({ code: 500, message: '设置失败' }, { status: 500 })
    }
})

/**
 * 安全问题列表
 */
const SECURITY_QUESTIONS = [
    '身份证后6位数是什么？',
    '爸爸的名字叫什么？'
]

/**
 * POST /api/auth/save-security
 * 保存安全问题答案
 * Body: { userId, q1Answer, q2Answer }
 */
router.post('/save-security', async (request) => {
    const env = request.env
    try {
        const { userId, q1Answer } = await request.json()
        if (!userId || !q1Answer?.trim()) {
            return Response.json({ code: 400, message: '请填写安全问题答案' })
        }
        if (!env.CACHE) {
            return Response.json({ code: 500, message: '存储不可用' })
        }
        // 🔒 安全锁：已设置过的不允许覆盖，防止他人恶意重置
        const existing = await env.CACHE.get(`security:${userId}`)
        if (existing) {
            return Response.json({ code: 409, message: '安全问题已设置，如需修改请联系客服' })
        }
        await env.CACHE.put(`security:${userId}`, JSON.stringify({
            q1: q1Answer.trim().toLowerCase()
        }))
        return Response.json({ code: 200, message: '安全问题设置成功' })
    } catch (error) {
        console.error('[SaveSecurity] Error:', error)
        return Response.json({ code: 500, message: '设置失败' }, { status: 500 })
    }
})

/**
 * POST /api/auth/admin-reset-security
 * 管理员重置指定用户的安全问题（需要 adminCode 验证）
 * Body: { adminCode, targetUserId }
 */
router.post('/admin-reset-security', async (request) => {
    const env = request.env
    try {
        const { adminCode, targetUserId } = await request.json()
        if (!adminCode || !targetUserId) {
            return Response.json({ code: 400, message: '缺少参数' })
        }
        // 验证管理员码
        const envCode = (env?.ADMIN_CODE || '').trim()
        let storedCode = envCode
        if (!storedCode && request.supabase) {
            const { data } = await request.supabase
                .from('admin_settings')
                .select('setting_value')
                .eq('setting_key', 'admin_login_code')
                .single()
            storedCode = data?.setting_value?.trim() || ''
        }
        if (!storedCode || adminCode.trim() !== storedCode) {
            return Response.json({ code: 403, message: '管理员码错误' })
        }
        // 删除安全问题
        if (!env.CACHE) return Response.json({ code: 500, message: 'CACHE不可用' })
        const existing = await env.CACHE.get(`security:${targetUserId}`)
        if (!existing) {
            return Response.json({ code: 404, message: '该用户未设置安全问题' })
        }
        await env.CACHE.delete(`security:${targetUserId}`)
        return Response.json({ code: 200, message: `用户 ${targetUserId} 安全问题已重置，可重新设置` })
    } catch (e) {
        console.error('[ResetSecurity] Error:', e)
        return Response.json({ code: 500, message: '重置失败' })
    }
})

/**
 * GET /api/auth/security-status?userId=xxx
 * 查询当前用户是否已设置安全问题（不返回答案）
 */
router.get('/security-status', async (request) => {
    const env = request.env
    try {
        const url = new URL(request.url)
        const userId = url.searchParams.get('userId')
        if (!userId) return Response.json({ code: 400, message: '缺少userId' })
        const existing = await env.CACHE.get(`security:${userId}`)
        return Response.json({ code: 200, data: { isSet: !!existing } })
    } catch (e) {
        return Response.json({ code: 500, message: '查询失败' })
    }
})

/**
 * POST /api/auth/get-security-question
 * 获取指定用户的随机安全问题（不返回答案）
 * Body: { userId }
 */
router.post('/get-security-question', async (request) => {
    const env = request.env
    try {
        const { userId } = await request.json()
        if (!userId) {
            return Response.json({ code: 400, message: '缺少用户ID' })
        }
        if (!env.CACHE) {
            return Response.json({ code: 500, message: '存储不可用' })
        }
        const data = await env.CACHE.get(`security:${userId}`, { type: 'json' })
        if (!data) {
            return Response.json({ code: 404, message: '该账户尚未设置安全问题，请先设置' })
        }
        // 固定使用第1题（身份证后6位），避免随机题目导致前端显示与实际验证不一致
        const questionIndex = 1
        return Response.json({
            code: 200,
            data: {
                questionIndex,
                question: SECURITY_QUESTIONS[questionIndex - 1]
            }
        })
    } catch (error) {
        console.error('[GetSecurityQuestion] Error:', error)
        return Response.json({ code: 500, message: '获取失败' }, { status: 500 })
    }
})

/**
 * POST /api/auth/verify-security
 * 验证安全问题答案
 * Body: { userId, questionIndex, answer }
 */
router.post('/verify-security', async (request) => {
    const env = request.env
    try {
        const { userId, questionIndex, answer } = await request.json()
        if (!userId || !questionIndex || !answer?.trim()) {
            return Response.json({ code: 400, message: '参数不完整' })
        }
        if (!env.CACHE) {
            return Response.json({ code: 500, message: '存储不可用' })
        }
        const data = await env.CACHE.get(`security:${userId}`, { type: 'json' })
        if (!data) {
            return Response.json({ code: 404, message: '该账户尚未设置安全问题' })
        }
        const expected = data.q1  // 始终用q1，兼容旧版双题数据
        if (answer.trim().toLowerCase() !== expected) {
            return Response.json({ code: 403, message: '答案错误，请重新输入' })
        }
        const transferToken = crypto.randomUUID()
        await env.CACHE.put(
            `transfer_token:${userId}`,
            JSON.stringify({ token: transferToken, createdAt: Date.now() }),
            { expirationTtl: 60 }
        )
        return Response.json({ code: 200, message: '验证通过', transferToken })
    } catch (error) {
        console.error('[VerifySecurity] Error:', error)
        return Response.json({ code: 500, message: '验证失败' }, { status: 500 })
    }
})

export const authRoutes = router


/**
 * 管理员认证 API
 * 处理管理员密码验证和修改
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/admin/auth' })

// SHA-256 哈希（与交易密码一致）
async function hashPassword(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 验证密码并自动迁移明文→哈希（一次性，首次登录后完成）
async function verifyAndMigrate(supabase, settingKey, input) {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', settingKey)
    .single()
  if (error || !data) return { valid: false }

  const stored = data.setting_value
  const isHashed = /^[0-9a-f]{64}$/.test(stored)

  if (isHashed) {
    const hashed = await hashPassword(input)
    return { valid: hashed === stored }
  } else {
    // 老明文记录，比对后自动升级为哈希
    if (input !== stored) return { valid: false }
    const newHash = await hashPassword(input)
    await supabase.from('admin_settings')
      .update({ setting_value: newHash })
      .eq('setting_key', settingKey)
    return { valid: true }
  }
}

/**
 * 验证管理员登录码
 * POST /api/admin/auth/verify-login
 */
router.post('/verify-login', async (request) => {
  try {
    const { code } = await request.json()
    
    if (!code) {
      return new Response(JSON.stringify({
        success: false,
        message: '请输入登录码'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // 优先从环境变量获取登录码（Cloudflare Secrets，明文比对即可，不落库）
    const envCode = (request.env?.ADMIN_CODE || '').trim()

    let isValid = false
    if (envCode) {
      isValid = code === envCode
    } else {
      // 从数据库获取（哈希存储，自动迁移）
      const result = await verifyAndMigrate(request.supabase, 'admin_login_code', code)
      if (!result.valid && result.valid === undefined) {
        return new Response(JSON.stringify({
          success: false,
          message: '管理员码未配置'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      isValid = result.valid
    }
    
    return new Response(JSON.stringify({
      success: isValid,
      message: isValid ? '验证成功' : '登录码错误'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('验证登录码错误:', error)
    return new Response(JSON.stringify({
      success: false,
      message: '服务器错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * 验证管理员操作密码
 * POST /api/admin/auth/verify-password
 */
router.post('/verify-password', async (request) => {
  try {
    const { password } = await request.json()
    
    if (!password) {
      return new Response(JSON.stringify({
        success: false,
        message: '请输入密码'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // 优先用环境变量 ADMIN_CODE 直接比对
    const envCode = (request.env?.ADMIN_CODE || '').trim()
    if (envCode) {
      const isValid = password.trim() === envCode
      return new Response(JSON.stringify({
        success: isValid,
        message: isValid ? '验证成功' : '密码错误'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // 没有环境变量时从数据库验证
    let result = await verifyAndMigrate(request.supabase, 'admin_operation_password', password)
    if (!result.valid) {
      const fallback = await verifyAndMigrate(request.supabase, 'admin_login_code', password)
      if (fallback.valid) result = fallback
    }

    const isValid = result.valid
    
    return new Response(JSON.stringify({
      success: isValid,
      message: isValid ? '验证成功' : '密码错误'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('验证操作密码错误:', error)
    return new Response(JSON.stringify({
      success: false,
      message: '服务器错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * 修改管理员登录码
 * POST /api/admin/auth/change-login-code
 */
router.post('/change-login-code', async (request) => {
  try {
    const { currentCode, newCode } = await request.json()
    
    // 验证输入
    if (!currentCode || !newCode) {
      return new Response(JSON.stringify({
        success: false,
        message: '请填写完整信息'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (newCode.length < 6) {
      return new Response(JSON.stringify({
        success: false,
        message: '新登录码至少6位'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // 验证当前登录码（哈希比对，自动迁移）
    const verifyResult = await verifyAndMigrate(request.supabase, 'admin_login_code', currentCode)
    if (!verifyResult.valid) {
      return new Response(JSON.stringify({
        success: false,
        message: '当前登录码错误'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 新登录码存哈希
    const newCodeHash = await hashPassword(newCode)
    const { error: updateError } = await request.supabase
      .from('admin_settings')
      .update({ setting_value: newCodeHash })
      .eq('setting_key', 'admin_login_code')
    
    if (updateError) {
      console.error('更新登录码失败:', updateError)
      return new Response(JSON.stringify({
        success: false,
        message: '更新失败，请重试'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: '登录码修改成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('修改登录码错误:', error)
    return new Response(JSON.stringify({
      success: false,
      message: '服务器错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * 修改管理员操作密码
 * POST /api/admin/auth/change-password
 */
router.post('/change-password', async (request) => {
  try {
    const { currentPassword, newPassword } = await request.json()
    
    // 验证输入
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({
        success: false,
        message: '请填写完整信息'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (newPassword.length < 6) {
      return new Response(JSON.stringify({
        success: false,
        message: '新密码至少6位'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // 验证当前密码（哈希比对，自动迁移）
    const verifyResult = await verifyAndMigrate(request.supabase, 'admin_operation_password', currentPassword)
    if (!verifyResult.valid) {
      return new Response(JSON.stringify({
        success: false,
        message: '当前密码错误'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 新密码存哈希
    const newPasswordHash = await hashPassword(newPassword)
    const { error: updateError } = await request.supabase
      .from('admin_settings')
      .update({ setting_value: newPasswordHash })
      .eq('setting_key', 'admin_operation_password')
    
    if (updateError) {
      console.error('更新密码失败:', updateError)
      return new Response(JSON.stringify({
        success: false,
        message: '更新失败，请重试'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: '操作密码修改成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('修改操作密码错误:', error)
    return new Response(JSON.stringify({
      success: false,
      message: '服务器错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * 获取所有用户列表（管理员专用）
 * POST /api/admin/auth/users
 * Body: { code, page, limit, search, filter }
 */
router.post('/users', async (request) => {
  try {
    const body = await request.json()
    const code = (body.code || '').trim()
    const page = parseInt(body.page || '1')
    const limit = Math.min(parseInt(body.limit || '50'), 200)
    const search = (body.search || '').trim()
    const filter = body.filter || 'all'

    const supabase = request.supabase
    if (!supabase) {
      return new Response(JSON.stringify({ success: false, message: '数据库未配置' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    // 验证管理员码：env var 优先（明文），否则哈希比对 DB
    const envCode = (request.env?.ADMIN_CODE || '').trim()
    let isValid = false
    if (envCode) {
      isValid = code === envCode
    } else {
      const result = await verifyAndMigrate(supabase, 'admin_login_code', code)
      isValid = result.valid
    }
    if (!isValid) {
      return new Response(JSON.stringify({ success: false, message: '无权限' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      })
    }

    // 构建查询
    let query = supabase
      .from('users')
      .select('id, username, avatar_url, coin_balance, balance, repurchase_balance, withdrawable_balance, reinvest_pool, total_earnings, spot_bonus_earnings, level_bonus_earnings, is_active, card_type, activated_types, referrer_id, direct_push_count, is_independent, has_slippage, invite_code, is_partner, created_at', { count: 'exact' })
      .not('id', 'like', 'PLATFORM%')
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`id.ilike.%${search}%,username.ilike.%${search}%,invite_code.ilike.%${search}%`)
    }

    if (filter === 'activated') {
      query = query.eq('is_active', true)
    } else if (filter === 'inactive') {
      query = query.eq('is_active', false)
    }

    const from = (page - 1) * limit
    query = query.range(from, from + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return new Response(JSON.stringify({ success: false, message: '查询失败: ' + error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    // 全量统计（不受分页影响）
    const { data: statsData } = await supabase
      .from('users')
      .select('is_active, balance')
      .not('id', 'like', 'PLATFORM%')

    let totalCount = 0, activatedCount = 0, totalBalance = 0
    if (statsData) {
      totalCount = statsData.length
      activatedCount = statsData.filter(u => u.is_active).length
      totalBalance = statsData.reduce((s, u) => s + parseFloat(u.balance || 0), 0)
    }

    return new Response(JSON.stringify({
      success: true,
      users: data || [],
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
      stats: {
        total: totalCount,
        activated: activatedCount,
        inactive: totalCount - activatedCount,
        totalBalance: Math.round(totalBalance * 100) / 100
      }
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('获取用户列表错误:', err)
    return new Response(JSON.stringify({ success: false, message: '服务器错误' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * 管理员重置用户数据
 * POST /api/admin/auth/reset-user
 * Body: { code, userId }
 */
router.post('/reset-user', async (request) => {
  try {
    const { code, userId } = await request.json()

    if (!code || !userId) {
      return new Response(JSON.stringify({ success: false, message: '参数不完整' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = request.supabase
    const uid = String(userId).trim()

    // 验证管理员码：env var 优先（明文），否则哈希比对 DB
    const inputCode = (code || '').trim()
    const envCode2 = (request.env?.ADMIN_CODE || '').trim()
    let isValid2 = false
    if (envCode2) {
      isValid2 = inputCode === envCode2
    } else {
      const r2 = await verifyAndMigrate(supabase, 'admin_login_code', inputCode)
      isValid2 = r2.valid
    }
    if (!isValid2) {
      return new Response(JSON.stringify({ success: false, message: '无权限' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!/^8\d{4}$/.test(uid)) {
      return new Response(JSON.stringify({ success: false, message: '用户ID格式无效' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }

    // 并行删除所有关联表数据
    await Promise.allSettled([
      supabase.from('reward_logs').delete().eq('user_id', uid),
      supabase.from('transactions').delete().eq('user_id', uid),
      supabase.from('subscription_logs').delete().eq('user_id', uid),
      supabase.from('mining_logs').delete().eq('user_id', uid),
      supabase.from('dividend_logs').delete().eq('user_id', uid),
      supabase.from('partner_dividends').delete().eq('user_id', uid),
    ])

    // 重置 users 表所有业务字段
    const { error: updateError } = await supabase.from('users').update({
      is_member: false,
      is_active: false,
      coin_balance: 0,
      balance: 0,
      card_type: null,
      invite_code: null,
      referrer_id: null,
      direct_push_count: 0,
      direct_push_sequence: 0,
      total_earnings: 0,
      spot_bonus_earnings: 0,
      level_bonus_earnings: 0,
      transfer_earnings: 0,
      reinvest_pool: 0,
      repurchase_balance: 0,
      subsidy_pool: 0,
      withdrawable_balance: 0,
      checkin_consecutive_days: 0,
      checkin_total: 0,
      last_checkin_date: null,
      coupon_count: 0,
      has_slide_down: false,
      has_slippage: false,
      has_contributed: false,
      contribution_count: 0,
      first_push_earnings: 0,
      first_push_stopped: false,
      total_stopped: false,
    }).eq('id', uid)

    if (updateError) {
      return new Response(JSON.stringify({ success: false, message: '重置失败: ' + updateError.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, message: `用户 ${uid} 数据已完全重置` }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('重置用户错误:', err)
    return new Response(JSON.stringify({ success: false, message: '服务器错误' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})

// =====================================================================
//  POST /api/admin/auth/user-detail  用户详情（推荐人+直推列表）
// =====================================================================
router.post('/user-detail', async (request) => {
  const supabase = request.supabase
  try {
    const { code, userId } = await request.json()
    if (!userId) return Response.json({ success: false, message: '缺少userId' }, { status: 400 })

    const adminCode = request.env?.ADMIN_CODE || ''
    if (!code || code.trim() !== adminCode.trim())
      return Response.json({ success: false, message: '无权限' }, { status: 403 })

    // 用户完整信息
    const { data: user } = await supabase.from('users')
      .select('id, username, avatar_url, coin_balance, balance, repurchase_balance, shopping_gold, profit_balance, total_earnings, spot_bonus_earnings, level_bonus_earnings, is_active, card_type, activated_types, referrer_id, direct_push_count, is_partner, invite_code, is_independent, created_at')
      .eq('id', userId).single()
    if (!user) return Response.json({ success: false, message: '用户不存在' }, { status: 404 })

    // 推荐人信息
    let referrer = null
    if (user.referrer_id) {
      const { data: ref } = await supabase.from('users')
        .select('id, username, card_type, is_active').eq('id', user.referrer_id).single()
      referrer = ref || null
    }

    // 直推列表
    const { data: directPushes } = await supabase.from('users')
      .select('id, username, card_type, is_active, coin_balance, created_at')
      .eq('referrer_id', userId)
      .not('id', 'like', 'PLATFORM%')
      .order('created_at', { ascending: false })
      .limit(50)

    return Response.json({
      success: true,
      data: { user, referrer, directPushes: directPushes || [] }
    })
  } catch (e) {
    return Response.json({ success: false, message: e.message }, { status: 500 })
  }
})

// =====================================================================
//  GET /api/admin/auth/system-config  获取系统配置
// =====================================================================
router.get('/system-config', async (request) => {
  const supabase = request.supabase
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('key, value')
    if (error) throw error
    const config = {}
    for (const row of (data || [])) {
      config[row.key] = row.value
    }
    return Response.json({ success: true, data: config })
  } catch (e) {
    return Response.json({ success: false, message: e.message }, { status: 500 })
  }
})

// =====================================================================
//  POST /api/admin/auth/system-config  保存系统配置（需要ADMIN_CODE）
// =====================================================================
router.post('/system-config', async (request) => {
  const supabase = request.supabase
  try {
    const body = await request.json()
    const { adminCode, config } = body

    // 验证管理员码
    const envCode = (request.env?.ADMIN_CODE || '').trim()
    let isValid = false
    if (envCode) {
      isValid = adminCode?.trim() === envCode
    } else {
      const result = await verifyAndMigrate(supabase, 'admin_login_code', adminCode)
      isValid = result.valid
    }
    if (!isValid) return Response.json({ success: false, message: '无权限' }, { status: 403 })

    if (!config || typeof config !== 'object') {
      return Response.json({ success: false, message: '配置数据无效' }, { status: 400 })
    }

    // 逐key upsert
    for (const [key, value] of Object.entries(config)) {
      await supabase.from('system_config').upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    }
    return Response.json({ success: true, message: '配置已保存' })
  } catch (e) {
    return Response.json({ success: false, message: e.message }, { status: 500 })
  }
})

export const adminAuthRoutes = router

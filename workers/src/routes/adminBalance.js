/**
 * 管理员余额操作 API（需要 ADMIN_CODE 验证）
 */

import { createClient } from '@supabase/supabase-js'

function createSupabase(env) {
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

/** 验证管理员码（env var 优先，回退到 DB） */
async function verifyAdminCode(code, env, supabase) {
  const envCode = (env?.ADMIN_CODE || '').trim()
  const { data } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'admin_login_code')
    .single()
  const dbCode = (data?.setting_value || '').trim()
  const input = (code || '').trim()
  return (envCode && input === envCode) || (dbCode && input === dbCode)
}

/**
 * POST /api/admin/add-balance  { userId, amount, adminCode }
 * 增量充值（需管理员码）
 */
export async function addBalance(request, env) {
  try {
    const { userId, amount, adminCode } = await request.json()

    if (!userId) {
      return Response.json({ success: false, message: '缺少用户ID' }, { status: 400 })
    }
    const addAmount = parseFloat(amount)
    if (!addAmount || addAmount <= 0 || addAmount > 1000000) {
      return Response.json({ success: false, message: '充值金额无效（1~1000000）' }, { status: 400 })
    }

    const supabase = createSupabase(env)

    // ── 权限校验 ──
    if (!(await verifyAdminCode(adminCode, env, supabase))) {
      return Response.json({ success: false, message: '无管理员权限' }, { status: 403 })
    }

    // 确保用户存在（不存在则创建，已存在则不变）
    await supabase.from('users').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

    // 从 DB 读取当前余额
    const { data: user, error: readErr } = await supabase
      .from('users')
      .select('coin_balance')
      .eq('id', userId)
      .single()

    if (readErr) {
      return Response.json({ success: false, message: '读取用户失败: ' + readErr.message }, { status: 500 })
    }

    const currentBalance = parseFloat(user?.coin_balance || 0)
    const newBalance = parseFloat((currentBalance + addAmount).toFixed(2))

    // 乐观锁：eq('coin_balance', currentBalance) 防止并发覆盖
    const { data: updated, error } = await supabase
      .from('users')
      .update({
        coin_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .eq('coin_balance', currentBalance)
      .select('id')

    if (error) {
      return Response.json({ success: false, message: '更新余额失败，请重试' }, { status: 500 })
    }
    if (!updated?.length) {
      return Response.json({ success: false, message: '余额已被并发修改，请重试' }, { status: 409 })
    }

    console.log(`[addBalance] ${userId}: ${currentBalance} + ${addAmount} = ${newBalance}`)
    return Response.json({
      success: true,
      message: '充值成功',
      data: { userId, added: addAmount, newBalance, previousBalance: currentBalance }
    })

  } catch (err) {
    console.error('addBalance 异常:', err)
    return Response.json({ success: false, message: err.message || '服务器错误' }, { status: 500 })
  }
}

/**
 * POST /api/admin/sync-balance  { userId, balance, adminCode }
 * 同步余额（设绝对值，需管理员码，慎用）
 */
export async function syncBalance(request, env) {
  try {
    const { userId, balance, adminCode } = await request.json()

    if (!userId) {
      return Response.json({ success: false, message: '缺少用户ID' }, { status: 400 })
    }
    const newBalance = parseFloat(balance)
    if (isNaN(newBalance) || newBalance < 0) {
      return Response.json({ success: false, message: '余额值无效' }, { status: 400 })
    }

    const supabase = createSupabase(env)

    // ── 权限校验 ──
    if (!(await verifyAdminCode(adminCode, env, supabase))) {
      return Response.json({ success: false, message: '无管理员权限' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        coin_balance: newBalance,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()

    if (error) {
      return Response.json({ success: false, message: error.message }, { status: 500 })
    }

    return Response.json({ success: true, message: '余额同步成功', data })

  } catch (err) {
    console.error('同步余额异常:', err)
    return Response.json({ success: false, message: err.message || '服务器错误' }, { status: 500 })
  }
}

/**
 * POST /api/admin/set-invite-code  { userId, inviteCode, adminCode }
 * 为指定用户设置邀请码（需管理员码）
 */
export async function setInviteCode(request, env) {
  try {
    const { userId, inviteCode, adminCode } = await request.json()

    if (!userId || !inviteCode) {
      return Response.json({ success: false, message: '缺少用户ID或邀请码' }, { status: 400 })
    }
    const code = inviteCode.trim().toUpperCase()
    if (!/^[A-HJ-NP-Z2-9]{4,8}$/.test(code)) {
      return Response.json({ success: false, message: '邀请码格式不合法（4-8位大写字母/数字，排除易混淆字符）' }, { status: 400 })
    }

    const supabase = createSupabase(env)

    if (!(await verifyAdminCode(adminCode, env, supabase))) {
      return Response.json({ success: false, message: '无管理员权限' }, { status: 403 })
    }

    // 检查邀请码是否已被其他用户使用
    const { data: existing } = await supabase
      .from('users').select('id').eq('invite_code', code).neq('id', userId).single()
    if (existing) {
      return Response.json({ success: false, message: '该邀请码已被其他用户使用' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('users')
      .upsert({ id: userId, invite_code: code, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select()

    if (error) {
      return Response.json({ success: false, message: error.message }, { status: 500 })
    }

    return Response.json({ success: true, message: '邀请码设置成功', data: { userId, inviteCode: code } })

  } catch (err) {
    console.error('设置邀请码异常:', err)
    return Response.json({ success: false, message: err.message || '服务器错误' }, { status: 500 })
  }
}

/**
 * POST /api/admin/fix-model  { adminCode, userId, targetShopId, newShopOwnerId }
 * 手动修正用户的1+1模型状态（出局/入店）
 * userId: 需要出局变成独立店主的用户
 * targetShopId: 该用户原本应该进入的店铺ID（slot A 替换）
 * newShopOwnerId: 新进入该店铺的用户（替换userId的位置）
 */
export async function fixModel(request, env) {
  try {
    const { adminCode, userId, targetShopId, newUserId } = await request.json()
    if (!adminCode || !userId || !targetShopId || !newUserId) {
      return Response.json({ success: false, message: '缺少参数: adminCode, userId, targetShopId, newUserId' }, { status: 400 })
    }
    const supabase = createSupabase(env)
    if (!(await verifyAdminCode(adminCode, env, supabase))) {
      return Response.json({ success: false, message: '无管理员权限' }, { status: 403 })
    }

    // 1. 获取目标店铺信息
    const { data: shop, error: shopErr } = await supabase.from('shops').select('*').eq('id', targetShopId).single()
    if (shopErr || !shop) return Response.json({ success: false, message: '找不到指定店铺' }, { status: 404 })

    // 2. userId 出局：变为独立店主
    await supabase.from('users').update({
      role: 'owner', is_independent: true, shop_owner_id: null, current_shop_id: null
    }).eq('id', userId)

    // 3. 在目标店铺创建独立新店（为出局用户）
    await supabase.from('shops').insert({
      slot1_owner_id: userId, model_type: shop.model_type,
      total_members: 0, rotation_count: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })

    // 4. 把 newUserId 放入目标店铺 slotA
    await supabase.from('shops').update({
      slota_tenant_id: newUserId, total_members: (shop.total_members || 0) + 1,
      rotation_count: (shop.rotation_count || 0) + 1,
      updated_at: new Date().toISOString()
    }).eq('id', targetShopId)

    // 5. newUserId 更新为 manager
    await supabase.from('users').update({
      role: 'manager', shop_owner_id: shop.slot1_owner_id, current_shop_id: targetShopId
    }).eq('id', newUserId)

    // 6. 清除 newUserId 之前错误进入的旧店铺（如果有）
    const { data: oldShop } = await supabase.from('shops')
      .select('id').eq('slota_tenant_id', newUserId).neq('id', targetShopId).single()
    if (oldShop) {
      await supabase.from('shops').delete().eq('id', oldShop.id)
    }

    return Response.json({ success: true, message: `修复成功：${userId}已出局独立，${newUserId}已进入店铺${targetShopId}` })
  } catch (err) {
    console.error('fixModel异常:', err)
    return Response.json({ success: false, message: err.message || '服务器错误' }, { status: 500 })
  }
}

/**
 * POST /api/admin/fix-referrer
 * { adminCode, userId, newReferrerId }
 * 修改用户的推荐人，同时更新旧/新推荐人的 direct_push_count
 */
export async function fixReferrer(request, env) {
  try {
    const { adminCode, userId, newReferrerId } = await request.json()
    if (!adminCode || !userId || !newReferrerId) {
      return Response.json({ success: false, message: '缺少参数: adminCode, userId, newReferrerId' }, { status: 400 })
    }
    const supabase = createSupabase(env)
    if (!(await verifyAdminCode(adminCode, env, supabase))) {
      return Response.json({ success: false, message: '无管理员权限' }, { status: 403 })
    }

    // 获取目标用户当前推荐人
    const { data: user } = await supabase.from('users').select('referrer_id').eq('id', userId).single()
    if (!user) return Response.json({ success: false, message: '找不到用户' }, { status: 404 })

    const oldReferrerId = user.referrer_id

    // 更新用户推荐人
    await supabase.from('users').update({ referrer_id: newReferrerId }).eq('id', userId)

    // 旧推荐人 direct_push_count -1
    if (oldReferrerId && oldReferrerId !== newReferrerId) {
      const { data: oldRef } = await supabase.from('users').select('direct_push_count').eq('id', oldReferrerId).single()
      if (oldRef) {
        const newCount = Math.max(0, (oldRef.direct_push_count || 0) - 1)
        await supabase.from('users').update({ direct_push_count: newCount }).eq('id', oldReferrerId)
      }
    }

    // 新推荐人 direct_push_count +1
    const { data: newRef } = await supabase.from('users').select('direct_push_count').eq('id', newReferrerId).single()
    if (newRef) {
      await supabase.from('users').update({ direct_push_count: (newRef.direct_push_count || 0) + 1 }).eq('id', newReferrerId)
    }

    return Response.json({ success: true, message: `已将 ${userId} 的推荐人从 ${oldReferrerId} 改为 ${newReferrerId}` })
  } catch (err) {
    console.error('fixReferrer异常:', err)
    return Response.json({ success: false, message: err.message || '服务器错误' }, { status: 500 })
  }
}

/**
 * POST /api/admin/move-shop-member
 * { adminCode, userId, newShopId, newShopOwnerId }
 * 把用户从当前店铺移到指定店铺（manager角色）
 */
export async function moveShopMember(request, env) {
  try {
    const { adminCode, userId, newShopId, newShopOwnerId } = await request.json()
    if (!adminCode || !userId || !newShopId || !newShopOwnerId) {
      return Response.json({ success: false, message: '缺少参数' }, { status: 400 })
    }
    const supabase = createSupabase(env)
    if (!(await verifyAdminCode(adminCode, env, supabase))) {
      return Response.json({ success: false, message: '无管理员权限' }, { status: 403 })
    }

    // 找到用户当前店铺并清空 slota
    const { data: user } = await supabase.from('users').select('current_shop_id').eq('id', userId).single()
    if (user?.current_shop_id) {
      const { data: oldShop } = await supabase.from('shops').select('total_members').eq('id', user.current_shop_id).single()
      await supabase.from('shops').update({
        slota_tenant_id: null,
        total_members: Math.max(0, (oldShop?.total_members || 1) - 1),
        updated_at: new Date().toISOString()
      }).eq('id', user.current_shop_id)
    }

    // 更新用户到新店
    await supabase.from('users').update({
      role: 'manager', shop_owner_id: newShopOwnerId, current_shop_id: newShopId
    }).eq('id', userId)

    // 新店 slota = userId
    const { data: newShop } = await supabase.from('shops').select('total_members').eq('id', newShopId).single()
    await supabase.from('shops').update({
      slota_tenant_id: userId,
      total_members: (newShop?.total_members || 0) + 1,
      updated_at: new Date().toISOString()
    }).eq('id', newShopId)

    return Response.json({ success: true, message: `${userId} 已移入店铺 ${newShopId}（店主 ${newShopOwnerId}）` })
  } catch (err) {
    console.error('moveShopMember异常:', err)
    return Response.json({ success: false, message: err.message || '服务器错误' }, { status: 500 })
  }
}

/**
 * POST /api/admin/fix-referrer-model
 * { adminCode, userId, correctReferrerId }
 * 修正推荐关系 + 1+1模型：
 *   1. 若 correctReferrer 是 manager，将其从当前店出局 → 独立店主
 *   2. 若 userId 是 owner 且自己的店为空，清掉该空店
 *   3. 将 userId 放入 correctReferrer 的店（作为 manager）
 */
export async function fixReferrerModel(request, env) {
  try {
    const { adminCode, userId, correctReferrerId } = await request.json()
    if (!adminCode || !userId || !correctReferrerId) {
      return Response.json({ success: false, message: '缺少参数' }, { status: 400 })
    }
    const supabase = createSupabase(env)
    if (!(await verifyAdminCode(adminCode, env, supabase))) {
      return Response.json({ success: false, message: '无管理员权限' }, { status: 403 })
    }

    const { data: referrer } = await supabase
      .from('users').select('role, current_shop_id, shop_owner_id').eq('id', correctReferrerId).single()
    if (!referrer) return Response.json({ success: false, message: '找不到推荐人' }, { status: 404 })

    // Step 1: 若推荐人是 manager，先让他出局成独立店主
    if (referrer.role === 'manager' && referrer.current_shop_id) {
      const { data: oldShop } = await supabase.from('shops').select('total_members').eq('id', referrer.current_shop_id).single()
      await supabase.from('shops').update({
        slota_tenant_id: null,
        total_members: Math.max(0, (oldShop?.total_members || 1) - 1),
        updated_at: new Date().toISOString()
      }).eq('id', referrer.current_shop_id)
      await supabase.from('users').update({
        role: 'owner', is_independent: true, shop_owner_id: null, current_shop_id: null
      }).eq('id', correctReferrerId)
    }

    // Step 2: 为推荐人找或创建独立店
    let { data: refShop } = await supabase.from('shops').select('*')
      .eq('slot1_owner_id', correctReferrerId).is('slota_tenant_id', null).single()
    if (!refShop) {
      // 看看有没有已有的店（不管 slota 是否空）
      const { data: anyShop } = await supabase.from('shops').select('*')
        .eq('slot1_owner_id', correctReferrerId).single()
      if (anyShop) {
        refShop = anyShop
      } else {
        const { data: created } = await supabase.from('shops').insert({
          slot1_owner_id: correctReferrerId, model_type: 'BASIC',
          total_members: 0, rotation_count: 0,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        }).select().single()
        refShop = created
      }
    }
    if (!refShop) return Response.json({ success: false, message: '无法获取推荐人店铺' }, { status: 500 })

    // Step 3: userId 若是 owner 且自己的空店存在，删除空店
    const { data: targetUser } = await supabase
      .from('users').select('role, current_shop_id').eq('id', userId).single()
    if (targetUser?.role === 'owner' && !targetUser.current_shop_id) {
      const { data: emptyShop } = await supabase.from('shops')
        .select('id, slota_tenant_id').eq('slot1_owner_id', userId).single()
      if (emptyShop && !emptyShop.slota_tenant_id) {
        await supabase.from('shops').delete().eq('id', emptyShop.id)
      }
    } else if (targetUser?.current_shop_id) {
      // 从旧店里移出
      const { data: oldShop } = await supabase.from('shops').select('total_members').eq('id', targetUser.current_shop_id).single()
      await supabase.from('shops').update({
        slota_tenant_id: null,
        total_members: Math.max(0, (oldShop?.total_members || 1) - 1),
        updated_at: new Date().toISOString()
      }).eq('id', targetUser.current_shop_id)
    }

    // Step 4: userId 进入推荐人的店
    await supabase.from('users').update({
      role: 'manager', shop_owner_id: correctReferrerId,
      current_shop_id: refShop.id, is_independent: false
    }).eq('id', userId)
    await supabase.from('shops').update({
      slota_tenant_id: userId,
      total_members: (refShop.total_members || 0) + 1,
      updated_at: new Date().toISOString()
    }).eq('id', refShop.id)

    return Response.json({ success: true, message: `修复完成：${correctReferrerId}已独立，${userId}已进入其店铺${refShop.id}` })
  } catch (err) {
    console.error('fixReferrerModel异常:', err)
    return Response.json({ success: false, message: err.message || '服务器错误' }, { status: 500 })
  }
}

/**
 * POST /api/admin/force-independent  { adminCode, userId }
 * 强制将指定用户设为独立店主（role=owner, is_independent=true）
 * 同时清除该用户在任何店铺中的 slota_tenant_id 记录
 */
export async function forceIndependent(request, env) {
  try {
    const { adminCode, userId } = await request.json()
    if (!adminCode || !userId) {
      return Response.json({ success: false, message: '缺少参数: adminCode, userId' }, { status: 400 })
    }
    const supabase = createSupabase(env)
    if (!(await verifyAdminCode(adminCode, env, supabase))) {
      return Response.json({ success: false, message: '无管理员权限' }, { status: 403 })
    }

    // 1. 无论用户是否存在，先强制清除所有店铺中该用户的 slota_tenant_id
    const { data: affectedShops } = await supabase.from('shops')
      .update({ slota_tenant_id: null, updated_at: new Date().toISOString() })
      .eq('slota_tenant_id', userId)
      .select('id')
    const clearedShops = affectedShops?.length || 0

    // 2. 查询用户当前状态（可能不存在）
    const { data: user } = await supabase.from('users')
      .select('id, role, is_independent, shop_owner_id, current_shop_id')
      .eq('id', userId).single()

    let userUpdated = false
    if (user) {
      // 3. 设置用户为独立店主
      await supabase.from('users').update({
        role: 'owner',
        is_independent: true,
        shop_owner_id: null,
        current_shop_id: null
      }).eq('id', userId)
      userUpdated = true
    }

    return Response.json({
      success: true,
      message: `操作完成：清除了 ${clearedShops} 个店铺的占位记录${userUpdated ? '，用户已设为独立店主' : '（用户记录不存在，仅清除了店铺占位）'}`,
      clearedShops,
      userUpdated
    })
  } catch (err) {
    console.error('forceIndependent异常:', err)
    return Response.json({ success: false, message: err.message || '服务器错误' }, { status: 500 })
  }
}

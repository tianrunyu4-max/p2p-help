/**
 * admin.js — 管理后台 API
 *   强制完成订单、冻结用户、查看AI介入列表、预设节点用户
 */

import { getDB, getUser } from '../db.js'
import { ok, err } from '../utils/response.js'
import { rotateIntoShop, creditPingjiiChain } from './activate.js'

async function isAdmin(request, env) {
  const token = request.headers.get('X-Admin-Token') || ''
  return token === env.ADMIN_PASSWORD
}

export async function handleAdmin(request, env, pathname) {
  if (!pathname.startsWith('/api/admin')) return null
  if (!await isAdmin(request, env)) return err('无权访问', 403)

  const db = getDB(env)

  // GET /api/admin/orders — 所有订单（含AI介入）
  if (pathname === '/api/admin/orders' && request.method === 'GET') {
    const url    = new URL(request.url)
    const status = url.searchParams.get('status') || ''
    const page   = parseInt(url.searchParams.get('page') || '1')
    const size   = 50

    let query = db.from('payment_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .range((page - 1) * size, page * size - 1)

    if (status) query = query.eq('status', status)

    const { data: tasks } = await query

    // 批量附加 payer/receiver user_no
    const allIds = [...new Set([...tasks.map(t => t.payer_id), ...tasks.map(t => t.receiver_id)])]
    const { data: users } = await db.from('users').select('id, user_no').in('id', allIds)
    const um = {}; for (const u of users || []) um[u.id] = u.user_no

    const result = tasks.map(t => ({
      ...t,
      payer_no:    um[t.payer_id]    || '?',
      receiver_no: um[t.receiver_id] || '?',
    }))

    return ok(result)
  }

  // POST /api/admin/force-complete/:taskId — 强制完成任务
  const forceMatch = pathname.match(/^\/api\/admin\/force-complete\/(.+)$/)
  if (forceMatch && request.method === 'POST') {
    const taskId = forceMatch[1]
    const { data: task } = await db.from('payment_tasks').select('*').eq('id', taskId).single()
    if (!task) return err('任务不存在')

    await db.from('payment_tasks').update({
      status:       'confirmed',
      confirmed_at: new Date().toISOString(),
    }).eq('id', taskId)

    // 更新收款方累计收款
    const receiver = await getUser(db, task.receiver_id)
    if (receiver) {
      await db.from('users').update({
        total_received: (parseFloat(receiver.total_received) || 0) + parseFloat(task.amount),
      }).eq('id', task.receiver_id)
    }

    // Bug4修复：强制完成平级节点任务时，也要给链上用户记余额
    if (task.type === 'ping_ji_node_1') {
      creditPingjiiChain(db, task.payer_id, 1).catch(() => {})
      if (task.pq_id) {
        await db.from('pingjii_withdraw_queue').update({ status: 'completed' }).eq('id', task.pq_id)
      }
    }
    if (task.type === 'ping_ji_node_2') {
      creditPingjiiChain(db, task.payer_id, 2).catch(() => {})
      if (task.pq_id) {
        await db.from('pingjii_withdraw_queue').update({ status: 'completed' }).eq('id', task.pq_id)
      }
    }

    // 检查订单是否全部完成
    await checkOrderComplete(db, task.order_id)

    return ok({ forced: true })
  }

  // GET /api/admin/users — 已激活用户列表（含推荐人ID + 身份 + 出局人数）
  if (pathname === '/api/admin/users' && request.method === 'GET') {
    const url  = new URL(request.url)
    const q    = url.searchParams.get('q') || ''
    const page = parseInt(url.searchParams.get('page') || '1')

    let query = db.from('users')
      .select('id, user_no, referrer_id, invite_code, invite_used, is_active, is_frozen, is_exited, role, total_received, created_at')
      .eq('is_active', true)          // 只显示已激活用户
      .order('created_at', { ascending: false })
      .range((page - 1) * 50, page * 50 - 1)

    if (q) query = query.ilike('user_no', `%${q}%`)

    const { data: users } = await query
    if (!users?.length) return ok([])

    // 批量获取推荐人 user_no
    const referrerIds = [...new Set(users.filter(u => u.referrer_id).map(u => u.referrer_id))]
    let referrerMap = {}
    if (referrerIds.length) {
      const { data: referrers } = await db.from('users').select('id, user_no').in('id', referrerIds)
      for (const r of referrers || []) referrerMap[r.id] = r.user_no
    }

    // 统计每人的出局直推数量
    const userIds = users.map(u => u.id)
    const { data: exitedRefs } = await db.from('users')
      .select('referrer_id').in('referrer_id', userIds).eq('is_exited', true)
    const exitedCountMap = {}
    for (const r of exitedRefs || []) {
      exitedCountMap[r.referrer_id] = (exitedCountMap[r.referrer_id] || 0) + 1
    }

    return ok(users.map(u => ({
      id:           u.id,
      user_no:      u.user_no,
      referrer_no:  referrerMap[u.referrer_id] || null,
      role:         u.role,
      is_exited:    u.is_exited,
      invite_used:  u.invite_used,
      total_received: u.total_received,
      is_frozen:    u.is_frozen,
      exited_count: exitedCountMap[u.id] || 0,
    })))
  }

  // POST /api/admin/freeze-user — 冻结/解冻用户
  if (pathname === '/api/admin/freeze-user' && request.method === 'POST') {
    const { userId, frozen } = await request.json()
    if (!userId) return err('userId 必填')
    await db.from('users').update({ is_frozen: !!frozen }).eq('id', userId)
    return ok({ userId, is_frozen: !!frozen })
  }

  // GET /api/admin/ai-reviews — AI介入列表
  if (pathname === '/api/admin/ai-reviews' && request.method === 'GET') {
    const { data: tasks } = await db.from('payment_tasks')
      .select('*')
      .eq('status', 'ai_review')
      .order('created_at', { ascending: false })
      .limit(100)

    const allIds = [...new Set([...tasks.map(t=>t.payer_id), ...tasks.map(t=>t.receiver_id)])]
    const { data: users } = await db.from('users').select('id, user_no').in('id', allIds)
    const um = {}; for (const u of users||[]) um[u.id] = u.user_no

    return ok(tasks.map(t => ({
      ...t,
      payer_no:    um[t.payer_id]    || '?',
      receiver_no: um[t.receiver_id] || '?',
    })))
  }

  // GET /api/admin/nodes — 查看所有节点用户（内排链）
  if (pathname === '/api/admin/nodes' && request.method === 'GET') {
    const { data: nodes } = await db.from('users')
      .select('id, user_no, invite_code, wechat_qr, alipay_qr, is_active, is_node, node_order, total_received')
      .eq('is_node', true)
      .order('node_order', { ascending: true })
    return ok(nodes || [])
  }

  // POST /api/admin/set-node — 设置/取消节点用户
  if (pathname === '/api/admin/set-node' && request.method === 'POST') {
    const { userId, isNode, nodeOrder } = await request.json()
    await db.from('users').update({
      is_node:    !!isNode,
      node_order: isNode ? (nodeOrder || 0) : 0,
      is_active:  isNode ? true : undefined, // 节点必须激活才能收平级奖
    }).eq('id', userId)
    return ok({ done: true })
  }

  // POST /api/admin/create-node — 快速创建节点账户
  if (pathname === '/api/admin/create-node' && request.method === 'POST') {
    const { nodeOrder } = await request.json()
    if (!nodeOrder || nodeOrder < 1 || nodeOrder > 10) return err('节点序号必须1-10')

    // 检查该序号是否已被占用
    const { data: existing } = await db.from('users')
      .select('id, user_no').eq('is_node', true).eq('node_order', nodeOrder).maybeSingle()
    if (existing) return err(`节点${nodeOrder}号已存在（ID：${existing.user_no}）`)

    const { generateUserId, generateInviteCode } = await import('../db.js')
    const userNo   = await generateUserId(db)
    const invCode  = await generateInviteCode(db)

    const { data: newUser, error } = await db.from('users').insert({
      user_no:     userNo,
      invite_code: invCode,
      is_node:     true,
      node_order:  nodeOrder,
      is_active:   true,    // 节点自动激活
      is_frozen:   false,
      is_exited:   false,
      role:        'owner',
      invite_used: 0,
      total_received: 0,
    }).select().single()

    if (error) return err('创建失败：' + error.message)
    return ok({ user_no: newUser.user_no, invite_code: newUser.invite_code, node_order: nodeOrder })
  }

  // POST /api/admin/node-set-qr — 设置节点收款码
  if (pathname === '/api/admin/node-set-qr' && request.method === 'POST') {
    const { userId, wechatQr, alipayQr } = await request.json()
    if (!userId) return err('userId 必填')
    await db.from('users').update({
      wechat_qr: wechatQr || null,
      alipay_qr: alipayQr || null,
    }).eq('id', userId)
    return ok({ done: true })
  }

  // GET /api/admin/lookup/:userNo — 查询用户信息预览
  const lookupMatch = pathname.match(/^\/api\/admin\/lookup\/(.+)$/)
  if (lookupMatch && request.method === 'GET') {
    const { data: u } = await db.from('users')
      .select('id, user_no, is_active, is_exited, role, referrer_id, invite_code, invite_used, total_received')
      .eq('user_no', lookupMatch[1]).maybeSingle()
    if (!u) return err('用户不存在')
    let referrer_no = null
    if (u.referrer_id) {
      const { data: r } = await db.from('users').select('user_no').eq('id', u.referrer_id).single()
      referrer_no = r?.user_no || null
    }
    return ok({ ...u, referrer_no })
  }

  // POST /api/admin/manual-activate — 手动内排激活（跳过打款流程）
  if (pathname === '/api/admin/manual-activate' && request.method === 'POST') {
    const { userNo, referrerNo } = await request.json()
    if (!userNo) return err('用户ID必填')

    const { data: target } = await db.from('users')
      .select('*').eq('user_no', String(userNo)).maybeSingle()
    if (!target) return err(`用户 #${userNo} 不存在，请先让他打开APP注册`)
    if (target.is_active) return err(`用户 #${userNo} 已是激活状态`)

    let referrerId = null
    let referrerNo_out = null

    if (referrerNo && String(referrerNo).trim()) {
      const { data: referrer } = await db.from('users')
        .select('id, user_no, is_active, invite_used').eq('user_no', String(referrerNo).trim()).maybeSingle()
      if (!referrer) return err(`推荐人 #${referrerNo} 不存在`)
      if (!referrer.is_active) return err(`推荐人 #${referrerNo} 尚未激活`)
      referrerId = referrer.id
      referrerNo_out = referrer.user_no
      // 更新推荐人邀请计数
      await db.from('users').update({ invite_used: (referrer.invite_used || 0) + 1 }).eq('id', referrerId)
    }

    // 先写入 referrer_id，再激活（rotateIntoShop 需要读 referrer_id）
    const updateData = { is_active: true, is_exited: false }
    if (referrerId) updateData.referrer_id = referrerId

    // 根用户（无推荐人）→ 直接设为老板
    if (!referrerId) updateData.role = 'owner'

    await db.from('users').update(updateData).eq('id', target.id)

    // 有推荐人 → 执行店铺旋转（分配代理位，与正常激活流程一致）
    if (referrerId) {
      const freshUser = await getUser(db, target.id)
      await rotateIntoShop(db, freshUser)
    }

    return ok({
      user_no: target.user_no,
      referrer_no: referrerNo_out,
      message: referrerNo_out
        ? `✅ #${userNo} 已激活并进入 #${referrerNo_out} 的店铺模型`
        : `✅ #${userNo} 已激活为平台第一人（根用户，无推荐人）`
    })
  }

  // POST /api/admin/fix-rotation-count — 修复店铺rotation_count + owner的current_shop_id
  if (pathname === '/api/admin/fix-rotation-count' && request.method === 'POST') {
    const { shopId, rotationCount, ownerNo } = await request.json()
    if (!shopId) return err('shopId 必填')
    await db.from('shops').update({ rotation_count: rotationCount || 0 }).eq('id', shopId)
    // 同步修复店主的 current_shop_id
    if (ownerNo) {
      const { data: owner } = await db.from('users').select('id').eq('user_no', String(ownerNo)).maybeSingle()
      if (owner) await db.from('users').update({ current_shop_id: shopId }).eq('id', owner.id)
    }
    return ok({ shopId, rotation_count: rotationCount, message: '✅ rotation_count 和 current_shop_id 已修复' })
  }

  // POST /api/admin/fix-shop/:userNo — 补做店铺旋转（修复手动激活但未进店的用户）
  const fixShopMatch = pathname.match(/^\/api\/admin\/fix-shop\/(.+)$/)
  if (fixShopMatch && request.method === 'POST') {
    const { data: u } = await db.from('users')
      .select('*').eq('user_no', fixShopMatch[1]).maybeSingle()
    if (!u) return err('用户不存在')
    if (!u.is_active) return err('用户未激活')
    if (!u.referrer_id) return err('根用户无需旋转')
    if (u.current_shop_id) return err(`用户已在店铺中（shop: ${u.current_shop_id}），无需补做`)
    await rotateIntoShop(db, u)
    const fresh = await getUser(db, u.id)
    return ok({ user_no: u.user_no, role: fresh.role, current_shop_id: fresh.current_shop_id, message: '✅ 店铺旋转完成' })
  }

  // GET /api/admin/tree/:userId — 查看用户下的邀请树（3层）
  const treeMatch = pathname.match(/^\/api\/admin\/tree\/(.+)$/)
  if (treeMatch && request.method === 'GET') {
    return await getInviteTree(db, treeMatch[1])
  }

  return null
}

async function checkOrderComplete(db, orderId) {
  const { data: tasks } = await db.from('payment_tasks').select('status').eq('order_id', orderId)
  const total     = tasks.length
  const confirmed = tasks.filter(t => t.status === 'confirmed').length

  await db.from('activation_orders').update({
    confirmed_tasks: confirmed,
    status: confirmed === total ? 'completed' : 'partial',
  }).eq('id', orderId)

  if (confirmed === total) {
    const { onAllTasksConfirmed } = await import('./activate.js')
    await onAllTasksConfirmed(db, orderId)
  }
}

async function getInviteTree(db, userId) {
  const user = await getUser(db, userId)
  if (!user) return err('用户不存在')

  async function getChildren(parentId, depth) {
    if (depth === 0) return []
    const { data: children } = await db.from('users')
      .select('id, user_no, is_active, is_exited, role, invite_used')
      .eq('referrer_id', parentId)
    if (!children?.length) return []
    const result = []
    for (const c of children) {
      result.push({ ...c, children: await getChildren(c.id, depth - 1) })
    }
    return result
  }

  return ok({
    id: user.id, user_no: user.user_no, role: user.role,
    children: await getChildren(user.id, 3),
  })
}

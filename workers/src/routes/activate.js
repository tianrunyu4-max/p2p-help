/**
 * activate.js — 激活匹配核心算法
 *
 * 激活金 230元，全部 P2P 点对点：
 *   见点    70   → 老板（永久）
 *   帮扶    30×2 → 老板的直推中已出局者；未出局→给管理员节点
 *   平级    10×10→ 邀请链往上10层
 */

import { getDB, getUser, getShop } from '../db.js'
import { authMiddleware } from './auth.js'
import { ok, err } from '../utils/response.js'

// ── 常量 ─────────────────────────────────────────────────────
const ACTIVATE_AMOUNT  = 230
const JIAN_DIAN        = 70    // 见点
const BANG_FU          = 30    // 帮扶（每人）
const PING_JI          = 10    // 平级（每层）
const MAX_LEVEL        = 10    // 最大平级层数
const REPURCHASE_LIMIT = 1500  // 累计收款达到此金额需复投

// ── 路由入口 ─────────────────────────────────────────────────
export async function handleActivate(request, env, pathname) {
  if (!pathname.startsWith('/api/activate') && !pathname.startsWith('/api/repurchase')) return null
  const payload = await authMiddleware(request, env)
  if (!payload) return err('未登录', 401)

  const db = getDB(env)
  const me = await getUser(db, payload.userId)
  if (!me) return err('用户不存在', 404)
  if (me.is_frozen) return err('账户已被冻结')

  // POST /api/activate/create — 创建激活订单（生成18笔tasks）
  if (pathname === '/api/activate/create' && request.method === 'POST') {
    return await createActivationOrder(db, me)
  }

  // GET /api/activate/order — 查询当前激活订单
  if (pathname === '/api/activate/order' && request.method === 'GET') {
    return await getActiveOrder(db, me.id)
  }

  return null
}

// ── 创建激活订单 ──────────────────────────────────────────────
async function createActivationOrder(db, user) {
  // 检查是否需要复投
  const isRepurchase = (user.total_received || 0) >= REPURCHASE_LIMIT

  // 若已激活且未到复投条件，不允许重复激活
  if (user.is_active && !isRepurchase) {
    // 检查是否有进行中的订单
    const { data: existing } = await db.from('activation_orders')
      .select('*, payment_tasks(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) return ok(formatOrder(existing))
    return err('已激活，无需重复激活')
  }

  // 推荐人必须存在且已激活
  if (!user.referrer_id) return err('未绑定推荐人，无法激活')
  const referrer = await getUser(db, user.referrer_id)
  if (!referrer || !referrer.is_active) return err('推荐人尚未激活')

  // 构建支付任务列表
  const tasks = await buildPaymentTasks(db, user.id, referrer)
  if (!tasks.length) return err('无法匹配收款方，请联系客服')

  // 创建激活订单
  const { data: order, error: oe } = await db.from('activation_orders').insert({
    user_id:         user.id,
    status:          'pending',
    total_tasks:     tasks.length,
    confirmed_tasks: 0,
    is_repurchase:   isRepurchase,
  }).select().single()
  if (oe) return err('创建订单失败')

  // 批量插入支付任务
  const taskRows = tasks.map(t => ({
    order_id:    order.id,
    payer_id:    user.id,
    receiver_id: t.receiver_id,
    amount:      t.amount,
    type:        t.type,
    type_label:  t.type_label,
    level:       t.level || null,
    status:      'pending',
  }))
  const { data: inserted } = await db.from('payment_tasks').insert(taskRows).select()

  // 附上收款方信息（user_no + 收款码）
  const full = await enrichTasks(db, inserted)
  return ok(formatOrder({ ...order, payment_tasks: full }))
}

// ── 核心匹配算法 ──────────────────────────────────────────────
async function buildPaymentTasks(db, newUserId, referrer) {
  const tasks = []

  // ① 找到新用户将进入的店铺 → 确定店主
  const { shopOwnerId, shop } = await resolveShop(db, referrer)
  if (!shopOwnerId) return []
  const shopOwner = await getUser(db, shopOwnerId)
  if (!shopOwner) return []

  // ② 见点 100 → 店主（基础金额，帮扶未出局部分会累加进来）
  let shopOwnerExtra = 0

  // ③ 帮扶：找老板的最多2个直推
  const { data: directPushes } = await db.from('users')
    .select('id, user_no, is_exited')
    .eq('referrer_id', shopOwnerId)
    .order('created_at')
    .limit(2)

  const pushList = directPushes || []

  // 获取管理员节点（帮扶未出局时收款方）
  const { data: adminNode } = await db.from('users')
    .select('id, user_no')
    .eq('is_node', true)
    .order('node_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  for (let i = 0; i < 2; i++) {
    const push = pushList[i]
    if (push && push.is_exited) {
      // 已出局 → 帮扶30给该直推（老板）
      tasks.push({
        receiver_id: push.id,
        amount:      BANG_FU,
        type:        'bang_fu',
        type_label:  `帮扶奖（直推${i + 1}号老板）`,
      })
    } else {
      // 未出局或不存在 → 帮扶30给管理员节点暂存
      if (adminNode) {
        tasks.push({
          receiver_id: adminNode.id,
          amount:      BANG_FU,
          type:        'bang_fu_admin',
          type_label:  `帮扶预留（管理员代收，直推${i + 1}号未出局）`,
        })
      }
    }
  }

  // 见点 70 → 老板
  tasks.push({
    receiver_id: shopOwnerId,
    amount:      JIAN_DIAN,
    type:        'jian_dian',
    type_label:  '见点奖',
  })

  // ④ 平级奖：沿邀请链往上15层
  const levelTasks = await buildLevelBonuses(db, referrer.id)
  tasks.push(...levelTasks)

  return tasks
}

// ── 确定新用户将进入的店铺 ────────────────────────────────────
async function resolveShop(db, referrer) {
  // 情况A：推荐人是店主（role='owner'）→ 新用户填其店的slotA
  if (referrer.role === 'owner' && referrer.current_shop_id) {
    return { shopOwnerId: referrer.id, shop: await getShop(db, referrer.current_shop_id) }
  }

  // 情况B：推荐人是店长（role='manager'）→ 新用户填该店slotA，推荐人出局
  if (referrer.role === 'manager' && referrer.current_shop_id) {
    const shop = await getShop(db, referrer.current_shop_id)
    return { shopOwnerId: shop?.slot1_owner_id, shop }
  }

  // 情况C：推荐人尚未有店铺（第一次邀请）→ 先给推荐人建店
  if (!referrer.current_shop_id) {
    const { data: newShop } = await db.from('shops').insert({
      slot1_owner_id: referrer.id,
      slota_tenant_id: null,
    }).select().single()
    // 推荐人升级为店主
    await db.from('users').update({
      role: 'owner',
      current_shop_id: newShop.id,
    }).eq('id', referrer.id)
    return { shopOwnerId: referrer.id, shop: newShop }
  }

  return { shopOwnerId: null, shop: null }
}

// ── 平级奖构建（10层，无紧缩）────────────────────────────────
async function buildLevelBonuses(db, startUserId) {
  const tasks = []
  let currentId = startUserId
  const visited = new Set()
  const chainUsers = []

  // 收集链条上的用户（最多10层）
  while (chainUsers.length < MAX_LEVEL && currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const u = await getUser(db, currentId)
    if (!u) break
    chainUsers.push(u)
    currentId = u.referrer_id
  }

  // 链条不足10层 → 用节点用户补足
  if (chainUsers.length < MAX_LEVEL) {
    const { data: nodes } = await db.from('users')
      .select('*')
      .eq('is_node', true)
      .order('node_order', { ascending: true })
      .limit(MAX_LEVEL - chainUsers.length)
    if (nodes) {
      for (const n of nodes) {
        if (chainUsers.length >= MAX_LEVEL) break
        chainUsers.push(n)
      }
    }
  }

  // 每层固定10元，无紧缩逻辑
  for (let i = 0; i < chainUsers.length; i++) {
    const u = chainUsers[i]
    const level = i + 1
    const exist = tasks.find(t => t.receiver_id === u.id && t.type.startsWith('ping_ji'))
    if (exist) {
      exist.amount += PING_JI
      exist.type_label = `平级第${exist.level}-${level}层`
    } else {
      tasks.push({
        receiver_id: u.id,
        amount:      PING_JI,
        type:        `ping_ji_${level}`,
        type_label:  `平级第${level}层`,
        level,
      })
    }
  }

  return tasks
}

// ── 查询当前激活订单 ──────────────────────────────────────────
async function getActiveOrder(db, userId) {
  const { data: order } = await db.from('activation_orders')
    .select('*, payment_tasks(*)')
    .eq('user_id', userId)
    .in('status', ['pending', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) return err('暂无进行中的激活订单')
  const full = await enrichTasks(db, order.payment_tasks)
  return ok(formatOrder({ ...order, payment_tasks: full }))
}

// ── 丰富task数据（附加收款方信息）────────────────────────────
async function enrichTasks(db, tasks) {
  if (!tasks?.length) return []
  const ids = [...new Set(tasks.map(t => t.receiver_id))]
  const { data: users } = await db.from('users')
    .select('id, user_no, wechat_qr, alipay_qr')
    .in('id', ids)
  const userMap = {}
  for (const u of users || []) userMap[u.id] = u

  return tasks.map(t => ({
    ...t,
    receiver_no:        userMap[t.receiver_id]?.user_no || '?',
    receiver_wechat_qr: userMap[t.receiver_id]?.wechat_qr || null,
    receiver_alipay_qr: userMap[t.receiver_id]?.alipay_qr || null,
  }))
}

function formatOrder(o) {
  return {
    id:              o.id,
    status:          o.status,
    total_tasks:     o.total_tasks,
    confirmed_tasks: o.confirmed_tasks,
    is_repurchase:   o.is_repurchase,
    tasks:           o.payment_tasks || [],
  }
}

// ── 激活完成后的操作（被 orders.js 调用）──────────────────────
export async function onAllTasksConfirmed(db, orderId) {
  const { data: order } = await db.from('activation_orders').select('*').eq('id', orderId).single()
  if (!order) return

  const userId = order.user_id
  const user = await getUser(db, userId)
  if (!user) return

  // 标记订单完成
  await db.from('activation_orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', orderId)

  // 用户激活成功
  await db.from('users').update({ is_active: true }).eq('id', userId)

  // 处理店铺旋转（新用户进入模型）
  await rotateIntoShop(db, user)

  // 推荐人 invite_used + 1
  if (user.referrer_id) {
    await db.from('users').rpc ? null : null  // 用下方 CAS 方式
    const ref = await getUser(db, user.referrer_id)
    if (ref) {
      await db.from('users').update({ invite_used: (ref.invite_used || 0) + 1 }).eq('id', ref.id)
    }
  }
}

// ── 新用户进入店铺模型（旋转）────────────────────────────────
async function rotateIntoShop(db, newUser) {
  if (!newUser.referrer_id) return
  const referrer = await getUser(db, newUser.referrer_id)
  if (!referrer) return

  let shopId = referrer.current_shop_id

  // 推荐人还没有店铺 → 建一个
  if (!shopId) {
    const { data: shop } = await db.from('shops').insert({
      slot1_owner_id: referrer.id, slota_tenant_id: null,
    }).select().single()
    shopId = shop.id
    await db.from('users').update({ role: 'owner', current_shop_id: shopId }).eq('id', referrer.id)
  }

  const shop = await getShop(db, shopId)
  if (!shop) return

  if (!shop.slota_tenant_id) {
    // slotA空位 → 新用户直接填入，成为店长
    await db.from('shops').update({ slota_tenant_id: newUser.id }).eq('id', shopId)
    await db.from('users').update({ role: 'manager', current_shop_id: shopId }).eq('id', newUser.id)
  } else {
    // slotA被占 → 旧店长出局，新用户接替
    const oldTenantId = shop.slota_tenant_id

    // CAS：防并发
    const { data: cas } = await db.from('shops').update({ slota_tenant_id: newUser.id })
      .eq('id', shopId).eq('slota_tenant_id', oldTenantId).select('id')

    if (cas?.length) {
      // 旧店长出局 → 成为新店主，创建自己的店铺
      const { data: newShop } = await db.from('shops').insert({
        slot1_owner_id: oldTenantId, slota_tenant_id: null,
      }).select().single()

      await db.from('users').update({
        is_exited: true, role: 'owner', current_shop_id: newShop.id,
      }).eq('id', oldTenantId)

      // 新用户成为新店长
      await db.from('users').update({ role: 'manager', current_shop_id: shopId }).eq('id', newUser.id)
    }
  }
}

/**
 * activate.js — 激活匹配核心算法
 *
 * 激活金 260元，全部 P2P 点对点，同时触发：
 *   见点    80   → 老板（永久）
 *   帮扶    30×2 → 老板的2个直推中已出局者（同时触发）；未出局→管理员节点代收
 *   平级    10×12→ 邀请链往上12层
 *
 * 滑落+贡献逻辑（对标 task-wall）：
 *   没有滑落 → contribution_slot='first'  → 第1个邀请贡献到原模型
 *   有滑落   → contribution_slot='fifth'  → 第2个邀请贡献到原模型
 */

import { getDB, getUser, getShop } from '../db.js'
import { authMiddleware } from './auth.js'
import { ok, err } from '../utils/response.js'

const ACTIVATE_AMOUNT  = 260
const JIAN_DIAN        = 80   // 见点奖：260 - 30×2(帮扶) - 10×12(平级) = 80
const BANG_FU          = 30
const PING_JI          = 10
const MAX_LEVEL        = 12
const REPURCHASE_LIMIT = 900

export async function handleActivate(request, env, pathname) {
  if (!pathname.startsWith('/api/activate') && !pathname.startsWith('/api/repurchase')) return null
  const payload = await authMiddleware(request, env)
  if (!payload) return err('未登录', 401)

  const db = getDB(env)
  const me = await getUser(db, payload.userId)
  if (!me) return err('用户不存在', 404)
  if (me.is_frozen) return err('账户已被冻结')

  if (pathname === '/api/activate/create' && request.method === 'POST') {
    return await createActivationOrder(db, me)
  }

  if (pathname === '/api/activate/order' && request.method === 'GET') {
    return await getActiveOrder(db, me.id)
  }

  return null
}

// ── 创建激活订单 ──────────────────────────────────────────────
async function createActivationOrder(db, user) {
  const isRepurchase = (user.total_received || 0) >= REPURCHASE_LIMIT

  if (user.is_active && !isRepurchase) {
    const { data: existing } = await db.from('activation_orders')
      .select('*, payment_tasks(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    if (existing) return ok(formatOrder(existing))
    return err('已激活，无需重复激活')
  }

  if (!user.referrer_id) return err('未绑定推荐人，无法激活')
  const referrer = await getUser(db, user.referrer_id)
  if (!referrer || !referrer.is_active) return err('推荐人尚未激活')

  const tasks = await buildPaymentTasks(db, user.id, referrer)
  if (!tasks.length) return err('无法匹配收款方，请联系客服')

  const { data: order, error: oe } = await db.from('activation_orders').insert({
    user_id: user.id, status: 'pending',
    total_tasks: tasks.length, confirmed_tasks: 0,
    is_repurchase: isRepurchase,
  }).select().single()
  if (oe) return err('创建订单失败')

  const taskRows = tasks.map(t => ({
    order_id: order.id, payer_id: user.id,
    receiver_id: t.receiver_id, amount: t.amount,
    type: t.type, type_label: t.type_label,
    level: t.level || null, status: 'pending',
  }))
  const { data: inserted } = await db.from('payment_tasks').insert(taskRows).select()

  // 生活补贴玩家：被匹配后立即更新收款计数（锁定这笔收款）
  for (const t of tasks) {
    if (t.type === 'bang_fu_subsidy' && t.subsidy_queue_id) {
      await updateSubsidyReceived(db, t.subsidy_queue_id)
    }
  }

  const full = await enrichTasks(db, inserted)
  return ok(formatOrder({ ...order, payment_tasks: full }))
}

// ── 核心匹配算法 ──────────────────────────────────────────────
async function buildPaymentTasks(db, newUserId, referrer) {
  const tasks = []

  // 1. 确定进入哪个店铺（含滑落+贡献逻辑）
  const { shopOwnerId } = await resolveShopWithContribution(db, newUserId, referrer)
  if (!shopOwnerId) return []

  // 3. 见点 70 → 老板（同时触发）
  tasks.push({
    receiver_id: shopOwnerId,
    amount:      JIAN_DIAN,
    type:        'jian_dian',
    type_label:  '见点奖',
  })

  // 4. 帮扶 30×2 → 同时触发
  //    已出局直推 → 给该老板
  //    未出局 → 触发匹配给生活补贴等待收款的静态玩家
  const { data: directPushes } = await db.from('users')
    .select('id, user_no, is_exited')
    .eq('referrer_id', shopOwnerId)
    .order('created_at')
    .limit(2)

  // 获取生活补贴等待收款的玩家队列（按加入时间排序，优先匹配等待最久的）
  const subsidyReceivers = await getSubsidyReceivers(db, 2)
  let subsidyIdx = 0

  for (let i = 0; i < 2; i++) {
    const push = (directPushes || [])[i]
    if (push && push.is_exited) {
      // 直推已出局 → 帮扶30给该老板
      tasks.push({
        receiver_id: push.id,
        amount:      BANG_FU,
        type:        'bang_fu',
        type_label:  `帮扶奖（直推${i+1}号老板）`,
      })
    } else {
      // 直推未出局 → 匹配给生活补贴等待收款的静态玩家
      const subsidyPlayer = subsidyReceivers[subsidyIdx]
      if (subsidyPlayer) {
        tasks.push({
          receiver_id: subsidyPlayer.user_id,
          amount:      BANG_FU,
          type:        'bang_fu_subsidy',
          type_label:  `帮扶→生活补贴玩家（直推${i+1}号未出局）`,
          subsidy_queue_id: subsidyPlayer.id,
        })
        subsidyIdx++
      } else {
        // 无静态玩家等待 → 给管理员节点暂存
        const { data: adminNode } = await db.from('users')
          .select('id').eq('is_node', true)
          .order('node_order', { ascending: true })
          .limit(1).maybeSingle()
        if (adminNode) {
          tasks.push({
            receiver_id: adminNode.id,
            amount:      BANG_FU,
            type:        'bang_fu_admin',
            type_label:  `帮扶预留（直推${i+1}号未出局，暂存节点）`,
          })
        }
      }
    }
  }

  // 5. 平级 10×10 → 同时触发
  const levelTasks = await buildLevelBonuses(db, referrer.id)
  tasks.push(...levelTasks)

  return tasks
}

// ── 获取生活补贴等待收款的玩家 ───────────────────────────────
async function getSubsidyReceivers(db, count) {
  // status='waiting'：已付款完成，等待收3笔的玩家（按时间排序，先进先出）
  const { data } = await db.from('subsidy_queue')
    .select('id, user_id, received_count')
    .eq('status', 'waiting')
    .lt('received_count', 3)        // 未收满3笔
    .order('created_at', { ascending: true })
    .limit(count)
  return data || []
}

// ── 更新生活补贴收款计数 ──────────────────────────────────────
async function updateSubsidyReceived(db, subsidyQueueId) {
  const { data: q } = await db.from('subsidy_queue')
    .select('received_count').eq('id', subsidyQueueId).single()
  if (!q) return
  const newCount = (q.received_count || 0) + 1
  const newStatus = newCount >= 3 ? 'completed' : 'waiting'
  await db.from('subsidy_queue').update({
    received_count: newCount,
    status: newStatus,
  }).eq('id', subsidyQueueId)
}

// ── 滑落+贡献：决定新用户进入哪个店铺 ──────────────────────
async function resolveShopWithContribution(db, newUserId, referrer) {
  // 1. 检查推荐人是否需要贡献
  if (checkContribution(referrer)) {
    // 贡献：新用户进入推荐人的推荐人的店铺（原模型）
    await db.from('users').update({ has_contributed: true }).eq('id', referrer.id)
    if (referrer.referrer_id) {
      const grandReferrer = await getUser(db, referrer.referrer_id)
      if (grandReferrer) return { shopOwnerId: grandReferrer.id }
    }
    // 找不到上层 → 进推荐人自己的店
    return { shopOwnerId: referrer.id }
  }

  // 2. 推荐人是代理 → 新用户进入代理所在的店（代理会出局）
  if (referrer.role === 'manager' && referrer.current_shop_id) {
    const shop = await getShop(db, referrer.current_shop_id)
    if (shop) return { shopOwnerId: shop.slot1_owner_id }
  }

  // 3. 推荐人是老板 or 普通成员 → 进推荐人自己的店
  if (!referrer.current_shop_id) {
    // 还没开店 → 给推荐人建店
    const { data: newShop } = await db.from('shops').insert({
      slot1_owner_id: referrer.id, slota_tenant_id: null,
    }).select().single()
    await db.from('users').update({
      role: 'owner', current_shop_id: newShop.id,
    }).eq('id', referrer.id)
  }
  return { shopOwnerId: referrer.id }
}

// ── 检查是否需要贡献到原模型 ──────────────────────────────────
function checkContribution(user) {
  if (user.has_contributed) return false
  if (!user.contribution_slot) return false
  const pushCount = user.invite_used || 0
  if (user.contribution_slot === 'first' && pushCount === 1) return true
  if (user.contribution_slot === 'fifth' && pushCount === 2) return true
  return false
}

// ── 平级奖（10层，无紧缩）────────────────────────────────────
async function buildLevelBonuses(db, startUserId) {
  const tasks = []
  let currentId = startUserId
  const visited = new Set()
  const chainUsers = []

  while (chainUsers.length < MAX_LEVEL && currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const u = await getUser(db, currentId)
    if (!u) break
    chainUsers.push(u)
    currentId = u.referrer_id
  }

  // 链条不足10层 → 节点用户补足
  if (chainUsers.length < MAX_LEVEL) {
    const { data: nodes } = await db.from('users')
      .select('*').eq('is_node', true)
      .order('node_order', { ascending: true })
      .limit(MAX_LEVEL - chainUsers.length)
    if (nodes) chainUsers.push(...nodes.slice(0, MAX_LEVEL - chainUsers.length))
  }

  for (let i = 0; i < chainUsers.length; i++) {
    const u = chainUsers[i]
    const level = i + 1
    const exist = tasks.find(t => t.receiver_id === u.id && t.type.startsWith('ping_ji'))
    if (exist) {
      exist.amount += PING_JI
      exist.type_label = `平级第${exist.level}-${level}层`
    } else {
      tasks.push({ receiver_id: u.id, amount: PING_JI, type: `ping_ji_${level}`, type_label: `平级第${level}层`, level })
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
    .limit(1).maybeSingle()
  if (!order) return err('暂无进行中的激活订单')
  const full = await enrichTasks(db, order.payment_tasks)
  return ok(formatOrder({ ...order, payment_tasks: full }))
}

// ── 丰富task数据 ──────────────────────────────────────────────
async function enrichTasks(db, tasks) {
  if (!tasks?.length) return []
  const ids = [...new Set(tasks.map(t => t.receiver_id))]
  const { data: users } = await db.from('users')
    .select('id, user_no, wechat_qr, alipay_qr').in('id', ids)
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
    id: o.id, status: o.status,
    total_tasks: o.total_tasks, confirmed_tasks: o.confirmed_tasks,
    is_repurchase: o.is_repurchase, tasks: o.payment_tasks || [],
  }
}

// ── 激活完成后处理（被 orders.js 调用）──────────────────────
export async function onAllTasksConfirmed(db, orderId) {
  const { data: order } = await db.from('activation_orders').select('*').eq('id', orderId).single()
  if (!order) return
  const user = await getUser(db, order.user_id)
  if (!user) return

  await db.from('activation_orders').update({
    status: 'completed', completed_at: new Date().toISOString()
  }).eq('id', orderId)

  await db.from('users').update({ is_active: true }).eq('id', order.user_id)

  // 推荐人 invite_used + 1
  if (user.referrer_id) {
    const ref = await getUser(db, user.referrer_id)
    if (ref) {
      await db.from('users').update({ invite_used: (ref.invite_used || 0) + 1 }).eq('id', ref.id)
    }
  }

  // 店铺旋转（含滑落判断）
  await rotateIntoShop(db, user)
}

// ── 店铺旋转（含滑落+贡献位设置）────────────────────────────
async function rotateIntoShop(db, newUser) {
  if (!newUser.referrer_id) return
  const referrer = await getUser(db, newUser.referrer_id)
  if (!referrer) return

  // 推荐人如果已贡献（新用户去了原模型），推荐人自己的店不动
  if (referrer.has_contributed && referrer.role === 'owner') {
    // 新用户实际上进了别的店，推荐人这里不需要处理
  }

  let shopId = referrer.current_shop_id

  // 推荐人还没开店 → 建一个
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
    // 代理位空 → 新用户填入
    await db.from('shops').update({ slota_tenant_id: newUser.id }).eq('id', shopId)
    await db.from('users').update({ role: 'manager', current_shop_id: shopId }).eq('id', newUser.id)
  } else {
    // 代理位已有人 → 旧代理出局，新用户顶替
    const oldTenantId = shop.slota_tenant_id

    // 判断是否滑落：新用户的推荐人是否是店主（不是旧代理邀请的）
    const hasSlideDown = newUser.referrer_id === shop.slot1_owner_id

    const { data: cas } = await db.from('shops')
      .update({ slota_tenant_id: newUser.id })
      .eq('id', shopId).eq('slota_tenant_id', oldTenantId).select('id')

    if (cas?.length) {
      // 旧代理出局 → 成为新老板，建自己的店
      const contributionSlot = hasSlideDown ? 'fifth' : 'first'

      await db.from('users').update({
        is_exited: true, role: 'owner',
        has_slide_down: hasSlideDown,
        contribution_slot: contributionSlot,
        current_shop_id: null,
      }).eq('id', oldTenantId)

      const { data: newShop } = await db.from('shops').insert({
        slot1_owner_id: oldTenantId, slota_tenant_id: null,
      }).select().single()

      await db.from('users').update({ current_shop_id: newShop.id }).eq('id', oldTenantId)

      // 新用户成为新代理
      await db.from('users').update({ role: 'manager', current_shop_id: shopId }).eq('id', newUser.id)
    }
  }
}

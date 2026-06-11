/**
 * activate.js — 激活匹配核心算法（三档体系）
 *
 * V1: 30元  = 见点10 + 帮扶4×2  + 平级6×2  (每层+1)
 * V2: 90元  = 见点30 + 帮扶12×2 + 平级18×2 (每层+3)
 * V3: 260元 = 见点80 + 帮扶30×2 + 平级60×2 (每层+10)
 *
 * 滑落+贡献逻辑：
 *   没有滑落 → contribution_slot='first'  → 第1个邀请贡献到原模型（invite_used=0触发）
 *   有滑落   → contribution_slot='fifth'  → 第2个邀请贡献到原模型（invite_used=1触发）
 */

import { getDB, getUser, getShop } from '../db.js'
import { authMiddleware } from './auth.js'
import { ok, err } from '../utils/response.js'

// ── 三档配置 ──────────────────────────────────────────────────
const TIERS = {
  V1: { total: 30,  jianDian: 10, bangFu: 4,  pingJiiNode: 6,  perLayer: 1  },
  V2: { total: 90,  jianDian: 30, bangFu: 12, pingJiiNode: 18, perLayer: 3  },
  V3: { total: 260, jianDian: 80, bangFu: 30, pingJiiNode: 60, perLayer: 10 },
}

// ── 复投规则：收满阈值后必须复投指定档位才能解锁 ──────────────
const REINVEST_RULES = {
  V1: { threshold: 200,  requiredTier: 'V2' },
  V2: { threshold: 500,  requiredTier: 'V3' },
  V3: { threshold: 1000, requiredTier: 'V3' },
}

export async function handleActivate(request, env, pathname) {
  if (!pathname.startsWith('/api/activate') && !pathname.startsWith('/api/repurchase')) return null
  const payload = await authMiddleware(request, env)
  if (!payload) return err('未登录', 401)

  const db = getDB(env)
  const me = await getUser(db, payload.userId)
  if (!me) return err('用户不存在', 404)
  if (me.is_frozen) return err('账户已被冻结')

  if (pathname === '/api/activate/create' && request.method === 'POST') {
    let tier = 'V3'
    try { const body = await request.json(); tier = body.tier || 'V3' } catch {}
    if (!TIERS[tier]) return err('无效档位，请选择 V1/V2/V3')
    return await createActivationOrder(db, me, tier)
  }

  if (pathname === '/api/activate/order' && request.method === 'GET') {
    return await getActiveOrder(db, me.id)
  }

  // GET /api/activate/reinvest-status — 当前复投状态
  if (pathname === '/api/activate/reinvest-status' && request.method === 'GET') {
    const status = await getReinvestStatus(db, me)
    return ok(status)
  }

  return null
}

// ── 查用户当前档位（最近一笔完成的激活订单）────────────────────
async function getUserCurrentTier(db, userId) {
  const { data } = await db.from('activation_orders')
    .select('tier')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  return data?.tier || null
}

// ── 复投状态 ──────────────────────────────────────────────────
async function getReinvestStatus(db, user) {
  if (!user.is_active) return { currentTier: null, locked: false }
  const currentTier = await getUserCurrentTier(db, user.id)
  if (!currentTier) return { currentTier: null, locked: false }
  const rule = REINVEST_RULES[currentTier]
  if (!rule) return { currentTier, locked: false }
  const totalReceived = parseFloat(user.total_received || 0)
  const locked = totalReceived >= rule.threshold
  return {
    currentTier,
    locked,
    threshold:    rule.threshold,
    requiredTier: rule.requiredTier,
    requiredTotal: TIERS[rule.requiredTier].total,
    totalReceived,
  }
}

// ── 创建激活订单 ──────────────────────────────────────────────
async function createActivationOrder(db, user, tier = 'V3') {
  const tierCfg = TIERS[tier]

  if (user.is_active) {
    const reinvest = await getReinvestStatus(db, user)
    if (reinvest.locked) {
      // 已锁定：只允许用指定档位复投
      if (tier !== reinvest.requiredTier) {
        return err(`收款已达 ¥${reinvest.threshold}，须复投${reinvest.requiredTier}（¥${reinvest.requiredTotal}）才能解锁账号`)
      }
      // 档位正确 → 允许创建复投订单，继续往下走
    } else {
      // 未达锁定阈值 → 返回已有待付款订单或提示已激活
      const { data: existing } = await db.from('activation_orders')
        .select('*, payment_tasks(*)')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()
      if (existing) return ok(formatOrder(existing))
      return err('已激活，无需重复激活')
    }
  }

  // ── 防重复订单：已有进行中订单就返回它，不再新建 ──────────
  const { data: existingOrder } = await db.from('activation_orders')
    .select('*, payment_tasks(*)')
    .eq('user_id', user.id)
    .in('status', ['pending', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  if (existingOrder) {
    const hasPaid = (existingOrder.payment_tasks || []).some(t => t.status !== 'pending')
    if (existingOrder.tier === tier || hasPaid) {
      // 同档位 / 已有付款进度 → 直接返回旧订单
      const full = await enrichTasks(db, existingOrder.payment_tasks)
      return ok(formatOrder({ ...existingOrder, payment_tasks: full }))
    }
    // 换档位且一笔未付 → 作废旧订单，重新生成
    await db.from('activation_orders').update({ status: 'cancelled' }).eq('id', existingOrder.id)
    await db.from('payment_tasks').update({ status: 'cancelled' })
      .eq('order_id', existingOrder.id).eq('status', 'pending')
  }

  if (!user.referrer_id) return err('未绑定推荐人，无法激活')
  const referrer = await getUser(db, user.referrer_id)
  if (!referrer || !referrer.is_active) return err('推荐人尚未激活')

  const tasks = await buildPaymentTasks(db, user.id, referrer, tierCfg)
  if (!tasks.length) return err('无法匹配收款方，请联系客服')

  const { data: order, error: oe } = await db.from('activation_orders').insert({
    user_id: user.id, status: 'pending',
    total_tasks: tasks.length, confirmed_tasks: 0,
    is_repurchase: user.is_active, tier,
  }).select().single()
  if (oe) return err('创建订单失败')

  const taskRows = tasks.map(t => ({
    order_id: order.id, payer_id: user.id,
    receiver_id: t.receiver_id, amount: t.amount,
    type: t.type, type_label: t.type_label,
    level: t.level || null, status: 'pending',
    pq_id: t.pq_id || null,   // Bug1修复：平级提现队列ID
  }))
  const { data: inserted } = await db.from('payment_tasks').insert(taskRows).select()

  // 生活补贴玩家：被匹配后立即更新收款计数（锁定这笔收款）
  // Bug5修复：平级提现队列匹配后，记录 matched_task_id 供管理员手动完成时触发链上记账
  for (const t of tasks) {
    if (t.type === 'bang_fu_subsidy' && t.subsidy_queue_id) {
      await updateSubsidyReceived(db, t.subsidy_queue_id)
    }
    if (t.pq_id && inserted) {
      const matchedTask = inserted.find(ins => ins.type === t.type && ins.pq_id === t.pq_id)
      if (matchedTask) {
        await db.from('pingjii_withdraw_queue')
          .update({ matched_task_id: matchedTask.id }).eq('id', t.pq_id)
      }
    }
  }

  const full = await enrichTasks(db, inserted)
  return ok(formatOrder({ ...order, payment_tasks: full }))
}

// ── 核心匹配算法 ──────────────────────────────────────────────
async function buildPaymentTasks(db, newUserId, referrer, tierCfg = TIERS.V3) {
  const tasks = []

  // 1. 确定进入哪个店铺（含滑落+贡献逻辑）
  const { shopOwnerId } = await resolveShopWithContribution(db, newUserId, referrer)
  if (!shopOwnerId) return []

  // 3. 见点 → 老板（同时触发）
  tasks.push({
    receiver_id: shopOwnerId,
    amount:      tierCfg.jianDian,
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
      tasks.push({
        receiver_id: push.id,
        amount:      tierCfg.bangFu,
        type:        'bang_fu',
        type_label:  `帮扶奖（直推${i+1}号老板）`,
      })
    } else {
      const subsidyPlayer = subsidyReceivers[subsidyIdx]
      if (subsidyPlayer) {
        tasks.push({
          receiver_id: subsidyPlayer.user_id,
          amount:      tierCfg.bangFu,
          type:        'bang_fu_subsidy',
          type_label:  `帮扶→生活补贴玩家（直推${i+1}号未出局）`,
          subsidy_queue_id: subsidyPlayer.id,
        })
        subsidyIdx++
      } else {
        const pingjiiNode1 = await getPingjiiNode(db, 1)
        if (pingjiiNode1) {
          tasks.push({
            receiver_id: pingjiiNode1.id,
            amount:      tierCfg.bangFu,
            type:        'bang_fu_admin',
            type_label:  `帮扶预留（直推${i+1}号未出局，暂存节点）`,
          })
        }
      }
    }
  }

  // 5. 平级奖 → 打给2个平级节点（或提现队列用户）
  const pingjiiTasks = await buildPingjiiTasks(db, newUserId, referrer.id, tierCfg.pingJiiNode)
  tasks.push(...pingjiiTasks)

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
// 无滑落(first)：第1个直推贡献（invite_used=0时触发）
// 有滑落(fifth)：第2个直推贡献（invite_used=1时触发）
function checkContribution(user) {
  if (user.has_contributed) return false
  if (!user.contribution_slot) return false
  const pushCount = user.invite_used || 0
  if (user.contribution_slot === 'first' && pushCount === 0) return true
  if (user.contribution_slot === 'fifth' && pushCount === 1) return true
  return false
}

// ── 平级奖 → 打给平级节点（或提现队列用户）──────────────────
// 提现固定打30元（与申请时扣的余额一致）：
//   仅当 nodeAmt ≥ 30（V3档）才匹配提现队列，拆成 30给提现用户 + 差额给节点
//   V1/V2 的平级位金额不足30，不匹配提现，整额打节点
const WITHDRAW_PAYOUT = 30
async function buildPingjiiTasks(db, newUserId, referrerId, nodeAmt = 60) {
  const tasks = []
  for (let nodeOrder = 1; nodeOrder <= 2; nodeOrder++) {
    let waiting = null
    if (nodeAmt >= WITHDRAW_PAYOUT) {
      const { data } = await db.from('pingjii_withdraw_queue')
        .select('id, user_id').eq('status', 'waiting')
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
      waiting = data
    }

    if (waiting) {
      // 固定30打给提现用户
      tasks.push({
        receiver_id:  waiting.user_id,
        amount:       WITHDRAW_PAYOUT,
        type:         `ping_ji_node_${nodeOrder}`,
        type_label:   `平级提现（直达提现用户）`,
        pq_id:        waiting.id,
      })
      await db.from('pingjii_withdraw_queue').update({ status: 'matched' }).eq('id', waiting.id)

      // 差额打给节点，凑齐档位总额
      const remainder = nodeAmt - WITHDRAW_PAYOUT
      if (remainder > 0) {
        const node = await getPingjiiNode(db, nodeOrder)
        if (node) {
          tasks.push({
            receiver_id: node.id,
            amount:      remainder,
            type:        `ping_ji_node_${nodeOrder}_rest`,
            type_label:  `平级奖节点${nodeOrder}（差额）`,
          })
        }
      }
    } else {
      const node = await getPingjiiNode(db, nodeOrder)
      if (node) {
        tasks.push({
          receiver_id: node.id,
          amount:      nodeAmt,
          type:        `ping_ji_node_${nodeOrder}`,
          type_label:  `平级奖节点${nodeOrder}`,
        })
      }
    }
  }
  return tasks
}

// ── 获取平级节点账号 ──────────────────────────────────────────
async function getPingjiiNode(db, order) {
  const { data } = await db.from('users')
    .select('*').eq('is_pingjii_node', true).eq('pingjii_node_order', order)
    .maybeSingle()
  return data
}

// ── 确认平级节点收款后自动给链上用户记余额 ───────────────────
// Bug3修复：直接跳过不属于本节点的层，从startLayer开始遍历
// perLayer 可由调用方传入；若不传则从支付任务反推（nodeAmt/6）
export async function creditPingjiiChain(db, payerId, nodeOrder, perLayer = null) {
  const user = await getUser(db, payerId)
  if (!user?.referrer_id) return

  // 未传 perLayer → 按付款人最近订单的档位取每层金额
  // （不能用任务金额÷6推断：提现匹配的任务金额固定30，会算错）
  if (perLayer === null) {
    const { data: ord } = await db.from('activation_orders')
      .select('tier')
      .eq('user_id', payerId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    perLayer = (ord?.tier && TIERS[ord.tier]) ? TIERS[ord.tier].perLayer : 10
  }

  const skipLayers  = (nodeOrder - 1) * 6
  const creditLayers = 6
  let currentId = user.referrer_id
  const visited = new Set()

  for (let i = 0; i < skipLayers && currentId; i++) {
    if (visited.has(currentId)) return
    visited.add(currentId)
    const u = await getUser(db, currentId)
    if (!u) return
    currentId = u.referrer_id
  }

  const records = []
  for (let i = 0; i < creditLayers && currentId; i++) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const u = await getUser(db, currentId)
    if (!u) break
    const newBal = parseFloat(u.pingjii_balance || 0) + perLayer
    await db.from('users').update({ pingjii_balance: newBal }).eq('id', u.id)
    records.push({
      user_id:      u.id,
      amount:       perLayer,
      layer:        skipLayers + i + 1,
      from_user_no: user.user_no || '?',
    })
    currentId = u.referrer_id
  }

  // 写平级收益记录（结算明细展示用）；表不存在时 supabase 返回 error 不抛异常，安全
  if (records.length) {
    await db.from('pingjii_records').insert(records)
  }
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
export async function rotateIntoShop(db, newUser) {
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

      // ✅ 旋转计数 +1（修复 agentsJoined/bossesExited 统计）
      await db.from('shops').update({
        rotation_count: (shop.rotation_count || 0) + 1
      }).eq('id', shopId)
    }
  }
}

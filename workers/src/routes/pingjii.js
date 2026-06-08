/**
 * pingjii.js — 平级余额 & 提现队列
 *
 * GET  /api/pingjii/balance          — 我的平级余额
 * POST /api/pingjii/withdraw         — 申请提现（余额≥60入队）
 * GET  /api/pingjii/admin/queue      — 管理员查看提现队列
 * POST /api/pingjii/admin/complete/:id — 管理员标记提现完成
 * POST /api/admin/create-pingjii-node  — 创建平级节点账号
 */

import { getDB, getUser, generateUserId, generateInviteCode } from '../db.js'
import { authMiddleware } from './auth.js'
import { creditPingjiiChain } from './activate.js'
import { ok, err } from '../utils/response.js'

const WITHDRAW_MIN = 30  // 最低提现金额

export async function handlePingjii(request, env, pathname) {
  if (!pathname.startsWith('/api/pingjii') && !pathname.startsWith('/api/admin/create-pingjii-node')
    && !pathname.startsWith('/api/admin/pingjii')) return null

  const db = getDB(env)

  // ── 管理员接口 ──────────────────────────────────────────────
  const adminToken = request.headers.get('X-Admin-Token') || ''
  const isAdmin = adminToken === env.ADMIN_PASSWORD

  // POST /api/admin/create-pingjii-node — 创建平级节点
  if (pathname === '/api/admin/create-pingjii-node' && request.method === 'POST') {
    if (!isAdmin) return err('无权访问', 403)
    const { nodeOrder } = await request.json()
    if (!nodeOrder || nodeOrder < 1 || nodeOrder > 2) return err('节点序号必须1或2')

    const { data: existing } = await db.from('users')
      .select('id, user_no').eq('is_pingjii_node', true).eq('pingjii_node_order', nodeOrder).maybeSingle()
    if (existing) return err(`平级节点${nodeOrder}已存在（ID：${existing.user_no}）`)

    const userNo  = await generateUserId(db)
    const invCode = await generateInviteCode(db)

    const { data: newUser, error } = await db.from('users').insert({
      user_no:          userNo,
      invite_code:      invCode,
      is_pingjii_node:  true,
      pingjii_node_order: nodeOrder,
      is_active:        true,
      is_frozen:        false,
      is_exited:        false,
      role:             'owner',
      invite_used:      0,
      total_received:   0,
    }).select().single()

    if (error) return err('创建失败：' + error.message)
    return ok({ user_no: newUser.user_no, invite_code: newUser.invite_code, node_order: nodeOrder,
      message: `✅ 平级节点${nodeOrder}创建成功！记得在节点管理里设置收款码` })
  }

  // GET /api/pingjii/admin/queue — 提现队列
  if (pathname === '/api/pingjii/admin/queue' && request.method === 'GET') {
    if (!isAdmin) return err('无权访问', 403)
    const { data: queue } = await db.from('pingjii_withdraw_queue')
      .select('*').order('created_at', { ascending: true }).limit(100)

    if (!queue?.length) return ok({ waiting: [], matched: [], completed: [] })
    const userIds = [...new Set(queue.map(q => q.user_id))]
    const { data: users } = await db.from('users').select('id, user_no').in('id', userIds)
    const um = {}; for (const u of users || []) um[u.id] = u.user_no

    const result = queue.map(q => ({ ...q, user_no: um[q.user_id] || '?' }))
    return ok({
      waiting:   result.filter(q => q.status === 'waiting'),
      matched:   result.filter(q => q.status === 'matched'),
      completed: result.filter(q => q.status === 'completed').slice(0, 20),
    })
  }

  // POST /api/pingjii/admin/complete/:id — 手动标记完成
  const completeMatch = pathname.match(/^\/api\/pingjii\/admin\/complete\/(.+)$/)
  if (completeMatch && request.method === 'POST') {
    if (!isAdmin) return err('无权访问', 403)
    const qId = completeMatch[1]
    const { data: q } = await db.from('pingjii_withdraw_queue').select('*').eq('id', qId).single()
    if (!q) return err('记录不存在')
    await db.from('pingjii_withdraw_queue').update({ status: 'completed' }).eq('id', qId)
    // Bug2修复：余额已在申请时扣除，这里不再重复扣
    // Bug5修复：管理员手动完成时，也要给链上用户记余额
    // 从 matched_task_id 找到付款人，触发链上记账
    if (q.matched_task_id) {
      const { data: task } = await db.from('payment_tasks')
        .select('payer_id, type').eq('id', q.matched_task_id).maybeSingle()
      if (task?.payer_id) {
        const nodeOrder = task.type === 'ping_ji_node_1' ? 1 : 2
        creditPingjiiChain(db, task.payer_id, nodeOrder).catch(() => {})
      }
    }
    return ok({ done: true })
  }

  // GET /api/admin/pingjii-nodes — 查看平级节点
  if (pathname === '/api/admin/pingjii-nodes' && request.method === 'GET') {
    if (!isAdmin) return err('无权访问', 403)
    const { data: nodes } = await db.from('users')
      .select('id, user_no, invite_code, wechat_qr, alipay_qr, is_active, pingjii_node_order, total_received')
      .eq('is_pingjii_node', true).order('pingjii_node_order', { ascending: true })
    return ok(nodes || [])
  }

  // ── 用户接口（需登录）─────────────────────────────────────
  const payload = await authMiddleware(request, env)
  if (!payload) return err('未登录', 401)
  const me = await getUser(db, payload.userId)
  if (!me) return err('用户不存在')

  // GET /api/pingjii/balance
  if (pathname === '/api/pingjii/balance' && request.method === 'GET') {
    return ok({ balance: parseFloat(me.pingjii_balance || 0) })
  }

  // POST /api/pingjii/withdraw — 申请提现
  if (pathname === '/api/pingjii/withdraw' && request.method === 'POST') {
    const bal = parseFloat(me.pingjii_balance || 0)
    if (bal < WITHDRAW_MIN) return err(`平级余额不足${WITHDRAW_MIN}元，当前：${bal.toFixed(0)}元`)

    // 检查是否已在队列中
    const { data: existing } = await db.from('pingjii_withdraw_queue')
      .select('id').eq('user_id', me.id).in('status', ['waiting', 'matched']).maybeSingle()
    if (existing) return err('您已有待处理的提现申请，请等待处理后再次申请')

    // Bug2修复：申请时立即冻结余额（扣除），防止重复申请
    await db.from('users').update({
      pingjii_balance: Math.max(0, bal - WITHDRAW_MIN)
    }).eq('id', me.id)

    await db.from('pingjii_withdraw_queue').insert({
      user_id: me.id,
      amount:  WITHDRAW_MIN,
      status:  'waiting',
    })
    return ok({ message: `✅ 提现申请已提交，¥${WITHDRAW_MIN}将在下一笔激活时直接打入您的收款码` })
  }

  return null
}

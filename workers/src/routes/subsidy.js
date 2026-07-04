/**
 * subsidy.js — 生活补贴（静态板块）
 *
 * 规则：
 *   60元入场 → 付给2人各30元
 *   等待3人各给你30元 → 回收90元（净赚30）
 *   老板（is_exited）每天1次
 *   直推2个老板，每天3次
 *   队列100人触发自动匹配
 */

import { getDB, getUser } from '../db.js'
import { authMiddleware } from './auth.js'
import { ok, err } from '../utils/response.js'

const SUBSIDY_AMOUNT   = 30   // 每笔金额
const PAY_COUNT        = 2    // 每次付出笔数
const RECEIVE_COUNT    = 3    // 每次收入笔数
const QUEUE_THRESHOLD  = 10   // 触发匹配的最低队列人数（测试用10，生产改100）

export async function handleSubsidy(request, env, pathname) {
  if (!pathname.startsWith('/api/subsidy')) return null
  const payload = await authMiddleware(request, env)
  if (!payload) return err('未登录', 401)

  const db = getDB(env)
  const me = await getUser(db, payload.userId)
  if (!me) return err('用户不存在')
  if (me.is_frozen) return err('账户已被冻结')

  // POST /api/subsidy/join — 加入排队
  if (pathname === '/api/subsidy/join' && request.method === 'POST') {
    return await joinSubsidy(db, me)
  }

  // GET /api/subsidy/status — 我的状态
  if (pathname === '/api/subsidy/status' && request.method === 'GET') {
    return await getMyStatus(db, me.id)
  }

  // GET /api/subsidy/tasks — 我的待付/待确认任务
  if (pathname === '/api/subsidy/tasks' && request.method === 'GET') {
    return await getMyTasks(db, me.id)
  }

  // POST /api/subsidy/task/:id/screenshot — 上传截图
  const ssMatch = pathname.match(/^\/api\/subsidy\/task\/(.+)\/screenshot$/)
  if (ssMatch && request.method === 'POST') {
    const { screenshotUrl } = await request.json()
    return await uploadScreenshot(db, ssMatch[1], me.id, screenshotUrl)
  }

  // POST /api/subsidy/task/:id/confirm — 确认收款
  const cfMatch = pathname.match(/^\/api\/subsidy\/task\/(.+)\/confirm$/)
  if (cfMatch && request.method === 'POST') {
    return await confirmPayment(db, cfMatch[1], me.id)
  }

  // POST /api/subsidy/admin/match — 管理员手动触发匹配
  if (pathname === '/api/subsidy/admin/match' && request.method === 'POST') {
    const adminToken = request.headers.get('X-Admin-Token') || ''
    if (adminToken !== env.ADMIN_PASSWORD) return err('无权访问', 403)
    return await triggerMatch(db)
  }

  // GET /api/subsidy/admin/queue — 管理员查看队列
  if (pathname === '/api/subsidy/admin/queue' && request.method === 'GET') {
    const adminToken = request.headers.get('X-Admin-Token') || ''
    if (adminToken !== env.ADMIN_PASSWORD) return err('无权访问', 403)
    return await getAdminQueue(db)
  }

  return null
}

// ── 加入排队 ──────────────────────────────────────────────────
async function joinSubsidy(db, user) {
  // 权限校验
  const perm = await checkPermission(db, user)
  if (!perm.allowed) return err(perm.reason)

  // 今日已参与次数
  const today = new Date().toISOString().slice(0, 10)
  const { count: todayCount } = await db.from('subsidy_queue')
    .select('id', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('joined_date', today)

  if ((todayCount || 0) >= perm.dailyLimit) {
    return err(`今日已达上限（每天${perm.dailyLimit}次）`)
  }

  // 检查是否有未完成的
  const { data: active } = await db.from('subsidy_queue')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['paying', 'waiting'])
    .maybeSingle()
  if (active) return err('您有进行中的补贴订单，完成后再加入')

  // 创建排队记录
  const { data: queue, error } = await db.from('subsidy_queue').insert({
    user_id:     user.id,
    status:      'waiting',  // 先等待匹配
    paid_count:  0,
    received_count: 0,
    joined_date: today,
  }).select().single()
  if (error) return err('加入失败: ' + error.message)

  // 检查队列人数，达到阈值自动匹配
  const { count: waitingCount } = await db.from('subsidy_queue')
    .select('id', { count: 'exact' })
    .eq('status', 'waiting')

  if ((waitingCount || 0) >= QUEUE_THRESHOLD) {
    await triggerMatch(db)
  }

  return ok({
    queueId: queue.id,
    message: `已加入排队，当前队列人数${waitingCount || 0 + 1}人，满${QUEUE_THRESHOLD}人自动开始匹配`,
    dailyLimit: perm.dailyLimit,
    todayUsed: (todayCount || 0) + 1,
  })
}

// ── 权限校验（老板1次/天，直推2老板3次/天）──────────────────
async function checkPermission(db, user) {
  // 必须是老板（is_exited = true）才能参与
  if (!user.is_exited) {
    return { allowed: false, reason: '只有老板（已出局）才能参与生活补贴' }
  }

  // 查直推中有几个老板（is_exited=true）
  const { count: bossCount } = await db.from('users')
    .select('id', { count: 'exact' })
    .eq('referrer_id', user.id)
    .eq('is_exited', true)

  const bosses = bossCount || 0
  const dailyLimit = bosses >= 2 ? 3 : 1

  return { allowed: true, dailyLimit, bosses }
}

// ── 触发匹配 ──────────────────────────────────────────────────
async function triggerMatch(db) {
  // 取所有等待匹配的队列（按加入时间排序）
  const { data: waitingQueues } = await db.from('subsidy_queue')
    .select('id, user_id')
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(100)

  if (!waitingQueues || waitingQueues.length < 3) {
    return ok({ message: '队列人数不足，等待更多人加入', count: waitingQueues?.length || 0 })
  }

  // 每批次：每人付给前2个，等收3个
  // 简单轮转匹配：
  const tasks = []
  const processed = []

  for (let i = 0; i < waitingQueues.length; i++) {
    const payer = waitingQueues[i]
    // 找2个收款方（取队列中不是自己的其他人）
    const receivers = waitingQueues
      .filter(q => q.user_id !== payer.user_id && !processed.includes(q.id))
      .slice(0, PAY_COUNT)

    if (receivers.length < PAY_COUNT) continue

    for (const receiver of receivers) {
      tasks.push({
        payer_queue_id:    payer.id,
        receiver_queue_id: receiver.id,
        payer_id:          payer.user_id,
        receiver_id:       receiver.user_id,
        amount:            SUBSIDY_AMOUNT,
        status:            'pending',
      })
    }
    processed.push(payer.id)
  }

  if (!tasks.length) return ok({ message: '无法生成匹配任务' })

  // 插入任务
  const { error } = await db.from('subsidy_tasks').insert(tasks)
  if (error) return err('匹配失败: ' + error.message)

  // 更新队列状态为 paying
  const payerIds = [...new Set(tasks.map(t => t.payer_queue_id))]
  await db.from('subsidy_queue').update({ status: 'paying' }).in('id', payerIds)

  return ok({ message: `匹配完成，生成${tasks.length}笔支付任务`, matched: payerIds.length })
}

// ── 查询我的状态 ──────────────────────────────────────────────
async function getMyStatus(db, userId) {
  const today = new Date().toISOString().slice(0, 10)

  const { data: active } = await db.from('subsidy_queue')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['paying', 'waiting'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: todayCount } = await db.from('subsidy_queue')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('joined_date', today)

  const { data: history } = await db.from('subsidy_queue')
    .select('id, status, paid_count, received_count, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)

  const { count: queueCount } = await db.from('subsidy_queue')
    .select('id', { count: 'exact' })
    .eq('status', 'waiting')

  return ok({
    active,
    todayCount: todayCount || 0,
    queueWaiting: queueCount || 0,
    queueThreshold: QUEUE_THRESHOLD,
    history: history || [],
  })
}

// ── 查询我的任务 ──────────────────────────────────────────────
async function getMyTasks(db, userId) {
  // 我需要付款的任务
  const { data: payTasks } = await db.from('subsidy_tasks')
    .select('*, receiver:receiver_id(user_no, wechat_qr, alipay_qr)')
    .eq('payer_id', userId)
    .in('status', ['pending', 'screenshot_uploaded'])
    .order('created_at')

  // 待我确认收款的任务
  const { data: receiveTasks } = await db.from('subsidy_tasks')
    .select('*, payer:payer_id(user_no)')
    .eq('receiver_id', userId)
    .eq('status', 'screenshot_uploaded')
    .order('created_at')

  return ok({
    payTasks:     payTasks || [],
    receiveTasks: receiveTasks || [],
  })
}

// ── 上传截图 ──────────────────────────────────────────────────
async function uploadScreenshot(db, taskId, userId, screenshotUrl) {
  if (!screenshotUrl) return err('截图URL不能为空')

  const { data: task } = await db.from('subsidy_tasks')
    .select('*').eq('id', taskId).maybeSingle()
  if (!task) return err('任务不存在')
  if (task.payer_id !== userId) return err('无权操作')
  if (task.status !== 'pending') return err('任务状态异常')

  await db.from('subsidy_tasks').update({
    status:         'screenshot_uploaded',
    screenshot_url: screenshotUrl,
  }).eq('id', taskId)

  return ok({ message: '截图已上传，等待收款方确认' })
}

// ── 确认收款 ──────────────────────────────────────────────────
async function confirmPayment(db, taskId, userId) {
  const { data: task } = await db.from('subsidy_tasks')
    .select('*').eq('id', taskId).maybeSingle()
  if (!task) return err('任务不存在')
  if (task.receiver_id !== userId) return err('无权操作')
  if (task.status !== 'screenshot_uploaded') return err('对方尚未上传截图')

  // 确认任务
  await db.from('subsidy_tasks').update({
    status:       'confirmed',
    confirmed_at: new Date().toISOString(),
  }).eq('id', taskId)

  // 更新付款方：paid_count + 1
  const { data: payerQueue } = await db.from('subsidy_queue')
    .select('*').eq('id', task.payer_queue_id).single()
  if (payerQueue) {
    const newPaid = (payerQueue.paid_count || 0) + 1
    const payerStatus = newPaid >= PAY_COUNT ? 'waiting' : 'paying'
    await db.from('subsidy_queue').update({
      paid_count: newPaid, status: payerStatus
    }).eq('id', task.payer_queue_id)
  }

  // 更新收款方：received_count + 1
  const { data: receiverQueue } = await db.from('subsidy_queue')
    .select('*').eq('id', task.receiver_queue_id).single()
  if (receiverQueue) {
    const newReceived = (receiverQueue.received_count || 0) + 1
    const receiverStatus = newReceived >= RECEIVE_COUNT ? 'completed' : 'waiting'
    await db.from('subsidy_queue').update({
      received_count: newReceived, status: receiverStatus
    }).eq('id', task.receiver_queue_id)
  }

  return ok({ message: '已确认收款' })
}

// ── 管理员查看队列 ────────────────────────────────────────────
async function getAdminQueue(db) {
  const { data: queues } = await db.from('subsidy_queue')
    .select('*, user:user_id(user_no, email)')
    .order('created_at', { ascending: false })
    .limit(100)

  const { count: waiting } = await db.from('subsidy_queue')
    .select('id', { count: 'exact' }).eq('status', 'waiting')
  const { count: paying } = await db.from('subsidy_queue')
    .select('id', { count: 'exact' }).eq('status', 'paying')
  const { count: completed } = await db.from('subsidy_queue')
    .select('id', { count: 'exact' }).eq('status', 'completed')

  return ok({ queues: queues || [], stats: { waiting, paying, completed } })
}

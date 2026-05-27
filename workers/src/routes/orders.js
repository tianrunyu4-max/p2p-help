/**
 * orders.js — 订单/任务管理
 *   上传截图、确认收款、申诉、超时检测
 */

import { getDB, getUser } from '../db.js'
import { authMiddleware } from './auth.js'
import { onAllTasksConfirmed } from './activate.js'
import { ok, err } from '../utils/response.js'

const CONFIRM_TIMEOUT_MS = 30 * 60 * 1000  // 30分钟

export async function handleOrders(request, env, pathname) {
  const payload = await authMiddleware(request, env)
  if (!payload) return err('未登录', 401)

  const db = getDB(env)
  const me = await getUser(db, payload.userId)
  if (!me || me.is_frozen) return err(me?.is_frozen ? '账户已冻结' : '用户不存在', 403)

  // GET /api/orders/task/:id — 获取单笔任务详情
  const taskMatch = pathname.match(/^\/api\/orders\/task\/(.+)$/)
  if (taskMatch && request.method === 'GET') {
    return await getTask(db, taskMatch[1], me.id)
  }

  // POST /api/orders/upload-screenshot — 上传打款截图
  if (pathname === '/api/orders/upload-screenshot' && request.method === 'POST') {
    return await uploadScreenshot(request, db, env, me.id)
  }

  // POST /api/orders/confirm/:id — 收款方确认
  const confirmMatch = pathname.match(/^\/api\/orders\/confirm\/(.+)$/)
  if (confirmMatch && request.method === 'POST') {
    return await confirmTask(db, confirmMatch[1], me.id)
  }

  // POST /api/orders/dispute/:id — 收款方申诉（有问题）
  const disputeMatch = pathname.match(/^\/api\/orders\/dispute\/(.+)$/)
  if (disputeMatch && request.method === 'POST') {
    return await disputeTask(db, disputeMatch[1], me.id)
  }

  // GET /api/orders/pending-confirm — 我需要确认的任务列表
  if (pathname === '/api/orders/pending-confirm' && request.method === 'GET') {
    return await getPendingConfirm(db, me.id)
  }

  return null
}

// ── 获取单笔任务详情 ──────────────────────────────────────────
async function getTask(db, taskId, userId) {
  const { data: task } = await db.from('payment_tasks').select('*').eq('id', taskId).single()
  if (!task) return err('任务不存在', 404)
  if (task.payer_id !== userId) return err('无权查看', 403)

  // 附加收款方信息
  const { data: receiver } = await db.from('users')
    .select('user_no, wechat_qr, alipay_qr')
    .eq('id', task.receiver_id).single()

  return ok({
    ...task,
    receiver_no:        receiver?.user_no,
    receiver_wechat_qr: receiver?.wechat_qr,
    receiver_alipay_qr: receiver?.alipay_qr,
    type_label:         task.type_label,
  })
}

// ── 上传打款截图 ──────────────────────────────────────────────
async function uploadScreenshot(request, db, env, userId) {
  const formData = await request.formData()
  const file     = formData.get('screenshot')
  const taskId   = formData.get('taskId')

  if (!file || !taskId) return err('参数缺失')

  // 验证任务归属
  const { data: task } = await db.from('payment_tasks').select('*').eq('id', taskId).single()
  if (!task) return err('任务不存在')
  if (task.payer_id !== userId) return err('无权操作')
  if (task.status !== 'pending') return err('该任务状态不允许上传截图')

  // 上传图片到 Supabase Storage
  const ext = file.name?.split('.').pop() || 'jpg'
  const path = `screenshots/${taskId}-${Date.now()}.${ext}`
  const arrayBuf = await file.arrayBuffer()

  const { data: uploaded, error: upErr } = await db.storage
    .from('p2p-images')
    .upload(path, arrayBuf, { contentType: file.type || 'image/jpeg', upsert: true })

  if (upErr) return err('图片上传失败：' + upErr.message)

  const { data: { publicUrl } } = db.storage.from('p2p-images').getPublicUrl(path)

  // 更新任务状态，设置30分钟截止
  const deadline = new Date(Date.now() + CONFIRM_TIMEOUT_MS).toISOString()
  await db.from('payment_tasks').update({
    status:         'screenshot_uploaded',
    screenshot_url: publicUrl,
    deadline,
  }).eq('id', taskId)

  return ok({ url: publicUrl })
}

// ── 收款方确认收款 ────────────────────────────────────────────
async function confirmTask(db, taskId, userId) {
  const { data: task } = await db.from('payment_tasks').select('*').eq('id', taskId).single()
  if (!task) return err('任务不存在')
  if (task.receiver_id !== userId) return err('无权操作')
  if (!['screenshot_uploaded', 'ai_review'].includes(task.status)) {
    return err('该任务当前状态无法确认')
  }

  await db.from('payment_tasks').update({
    status:       'confirmed',
    confirmed_at: new Date().toISOString(),
  }).eq('id', taskId)

  // 更新收款方的累计收款
  const receiver = await getUser(db, userId)
  const newTotal = (parseFloat(receiver.total_received) || 0) + parseFloat(task.amount)
  await db.from('users').update({ total_received: newTotal }).eq('id', userId)

  // 更新订单进度
  await updateOrderProgress(db, task.order_id)

  return ok({ confirmed: true })
}

// ── 收款方申诉 ────────────────────────────────────────────────
async function disputeTask(db, taskId, userId) {
  const { data: task } = await db.from('payment_tasks').select('*').eq('id', taskId).single()
  if (!task) return err('任务不存在')
  if (task.receiver_id !== userId) return err('无权操作')

  await db.from('payment_tasks').update({ status: 'ai_review' }).eq('id', taskId)
  return ok({ status: 'ai_review' })
}

// ── 获取待我确认的任务列表 ────────────────────────────────────
async function getPendingConfirm(db, userId) {
  const { data: tasks } = await db.from('payment_tasks')
    .select('*')
    .eq('receiver_id', userId)
    .in('status', ['screenshot_uploaded', 'ai_review'])
    .order('created_at', { ascending: false })

  if (!tasks?.length) return ok([])

  // 附加付款方信息
  const payerIds = [...new Set(tasks.map(t => t.payer_id))]
  const { data: payers } = await db.from('users')
    .select('id, user_no').in('id', payerIds)
  const payerMap = {}
  for (const p of payers || []) payerMap[p.id] = p

  const result = tasks.map(t => ({
    ...t,
    payer_no: payerMap[t.payer_id]?.user_no || '?',
  }))

  return ok(result)
}

// ── 更新订单确认进度 → 若全部完成则触发激活 ──────────────────
async function updateOrderProgress(db, orderId) {
  const { data: tasks } = await db.from('payment_tasks')
    .select('status').eq('order_id', orderId)

  const total     = tasks.length
  const confirmed = tasks.filter(t => t.status === 'confirmed').length

  await db.from('activation_orders').update({
    confirmed_tasks: confirmed,
    status: confirmed === total ? 'completed' : 'partial',
  }).eq('id', orderId)

  if (confirmed === total) {
    await onAllTasksConfirmed(db, orderId)
  }
}

// ── Cron：检测30分钟超时任务，自动AI介入 ─────────────────────
export async function checkTimeouts(env) {
  const db = getDB(env)
  const now = new Date().toISOString()

  const { data: timedOut } = await db.from('payment_tasks')
    .select('id, order_id, receiver_id, amount')
    .eq('status', 'screenshot_uploaded')
    .lt('deadline', now)

  if (!timedOut?.length) return

  for (const task of timedOut) {
    await db.from('payment_tasks').update({ status: 'ai_review' }).eq('id', task.id)
    // TODO: 可接入微信/短信通知推送
  }
}

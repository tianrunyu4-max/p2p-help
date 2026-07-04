/**
 * zeroPosts.js — 0撸信息板
 *
 * GET  /api/zero-posts              — 获取帖子列表（20条/页）
 * POST /api/zero-posts              — 发布帖子（需登录，每日20条上限，最多2图+30字）
 * GET  /api/zero-posts/today-count  — 今日已发条数
 */

import { getDB, getUser } from '../db.js'
import { authMiddleware } from './auth.js'
import { ok, err } from '../utils/response.js'

const MAX_DAILY = 20   // 每人每天最多发帖数
const MAX_CHARS = 30   // 文字上限
const MAX_IMGS  = 2    // 图片上限

export async function handleZeroPosts(request, env, pathname) {
  if (!pathname.startsWith('/api/zero-posts')) return null

  const db = getDB(env)

  // ── GET /api/zero-posts — 列表 ────────────────────────────────
  if (pathname === '/api/zero-posts' && request.method === 'GET') {
    const url   = new URL(request.url)
    const page  = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = 20

    const { data, error } = await db.from('zero_posts')
      .select('id, user_no, content, images, created_at')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (error) return err('获取失败')
    return ok(data || [])
  }

  // ── GET /api/zero-posts/today-count — 今日发帖数 ──────────────
  if (pathname === '/api/zero-posts/today-count' && request.method === 'GET') {
    const payload = await authMiddleware(request, env)
    if (!payload) return ok({ count: 0 })
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { count } = await db.from('zero_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', payload.userId)
      .gte('created_at', todayStart.toISOString())
    return ok({ count: count || 0 })
  }

  // ── POST /api/zero-posts — 发帖 ────────────────────────────────
  if (pathname === '/api/zero-posts' && request.method === 'POST') {
    const payload = await authMiddleware(request, env)
    if (!payload) return err('未登录', 401)

    const user = await getUser(db, payload.userId)
    if (!user) return err('用户不存在')

    let body
    try { body = await request.json() } catch { return err('请求格式错误') }
    const { content = '', images = [] } = body

    // 校验
    if (!content.trim() && (!images || images.length === 0)) {
      return err('请填写内容或上传图片')
    }
    if (content.length > MAX_CHARS) return err(`文字最多 ${MAX_CHARS} 字`)
    if (!Array.isArray(images) || images.length > MAX_IMGS) return err(`最多 ${MAX_IMGS} 张图片`)

    // 每日限额
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { count } = await db.from('zero_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', payload.userId)
      .gte('created_at', todayStart.toISOString())
    if ((count || 0) >= MAX_DAILY) {
      return err(`今日已发 ${MAX_DAILY} 条，明天再来`)
    }

    const { data, error } = await db.from('zero_posts').insert({
      user_id:  payload.userId,
      user_no:  user.user_no,
      content:  content.trim(),
      images:   images,       // jsonb 数组
    }).select().single()

    if (error) return err('发布失败：' + error.message)
    return ok(data)
  }

  return null
}

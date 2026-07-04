import { getDB, getUser } from '../db.js'
import { authMiddleware } from './auth.js'
import { ok, err } from '../utils/response.js'

export async function handleUser(request, env, pathname) {
  if (!pathname.startsWith('/api/user/')) return null
  const payload = await authMiddleware(request, env)
  if (!payload) return err('未登录', 401)

  const db = getDB(env)

  // GET /api/user/profile
  if (pathname === '/api/user/profile' && request.method === 'GET') {
    const me = await getUser(db, payload.userId)
    if (!me) return err('用户不存在')
    return ok({
      user_no:         me.user_no,
      phone:           me.phone,
      invite_code:     me.invite_code,
      invite_used:     me.invite_used || 0,
      is_active:       me.is_active,
      is_exited:       me.is_exited,
      role:            me.role,
      wechat_qr:       me.wechat_qr,
      alipay_qr:       me.alipay_qr,
      total_received:  me.total_received || 0,
      repurchase_need: (me.total_received || 0) >= 1500,
    })
  }

  // POST /api/user/upload-qr — 上传收款码
  if (pathname === '/api/user/upload-qr' && request.method === 'POST') {
    return await uploadQR(request, db, env, payload.userId)
  }

  return null
}

async function uploadQR(request, db, env, userId) {
  const formData = await request.formData()
  const file     = formData.get('qr')
  const type     = formData.get('type')  // 'wechat' or 'alipay'

  if (!file) return err('请选择图片')
  if (!['wechat', 'alipay'].includes(type)) return err('类型参数错误')

  const ext  = file.name?.split('.').pop() || 'jpg'
  const path = `qrcodes/${userId}-${type}-${Date.now()}.${ext}`
  const buf  = await file.arrayBuffer()

  const { error: upErr } = await db.storage
    .from('p2p-images')
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true })

  if (upErr) return err('上传失败：' + upErr.message)

  const { data: { publicUrl } } = db.storage.from('p2p-images').getPublicUrl(path)

  const field = type === 'wechat' ? 'wechat_qr' : 'alipay_qr'
  await db.from('users').update({ [field]: publicUrl }).eq('id', userId)

  return ok({ url: publicUrl })
}

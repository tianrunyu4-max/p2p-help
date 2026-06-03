import { getDB, generateUserId, generateInviteCode } from '../db.js'
import { signJWT, verifyJWT, getTokenFromRequest } from '../utils/jwt.js'
import { ok, err } from '../utils/response.js'

export async function handleAuth(request, env, pathname) {

  // POST /api/auth/init — 首次进入自动建档（无需邮箱）
  // Body: { localId: '6位ID' }  → 若已存在直接返回token，否则建新用户
  if (pathname === '/api/auth/init' && request.method === 'POST') {
    const { localId } = await request.json()
    if (!localId) return err('缺少ID')
    const db = getDB(env)

    // 查是否已存在
    const { data: existing } = await db.from('users')
      .select('*').eq('user_no', localId).maybeSingle()

    if (existing) {
      if (existing.is_frozen) return err('账户已被冻结')
      const token = await signJWT({ userId: existing.id, userNo: existing.user_no }, env.JWT_SECRET)
      return ok({ token, user: sanitizeUser(existing), isNew: false })
    }

    // 新用户建档（未激活，无推荐人）
    const invCode = await generateInviteCode(db)
    const { data: newUser, error } = await db.from('users').insert({
      user_no:     localId,
      invite_code: invCode,
      invite_used: 0,
      is_active:   false,
      is_frozen:   false,
      is_exited:   false,
      is_node:     false,
      role:        'member',
      total_received: 0,
    }).select().single()

    if (error) return err('建档失败：' + error.message)
    const token = await signJWT({ userId: newUser.id, userNo: newUser.user_no }, env.JWT_SECRET)
    return ok({ token, user: sanitizeUser(newUser), isNew: true })
  }

  // POST /api/auth/participate — 填邀请码参与（绑定推荐人 + 设置安全问题）
  if (pathname === '/api/auth/participate' && request.method === 'POST') {
    const payload = await authMiddleware(request, env)
    if (!payload) return err('未登录', 401)

    const { inviteCode, securityAnswer } = await request.json()
    if (!inviteCode) return err('请输入邀请码')
    if (!securityAnswer || securityAnswer.trim().length < 2) return err('请设置安全问题答案（至少2位）')

    const db = getDB(env)
    const me = await db.from('users').select('*').eq('id', payload.userId).single().then(r => r.data)
    if (!me) return err('用户不存在')
    if (me.referrer_id) return err('您已绑定推荐人，无需重复操作')

    // 验证邀请码
    const { data: referrer } = await db.from('users')
      .select('id, user_no, invite_used, is_frozen, is_active')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle()

    if (!referrer) return err('邀请码无效')
    if (referrer.id === payload.userId) return err('不能使用自己的邀请码')
    if (referrer.is_frozen) return err('邀请人账户已被冻结')
    if ((referrer.invite_used || 0) >= 2) return err('该邀请码已使用2次')
    if (!referrer.is_active) return err('邀请人尚未激活')

    // 保存安全答案（取身份证后6位或自定义答案，存哈希）
    const answerHash = await hashAnswer(securityAnswer.trim().toLowerCase(), env.JWT_SECRET)

    await db.from('users').update({
      referrer_id:     referrer.id,
      security_answer: answerHash,
    }).eq('id', payload.userId)

    const updatedUser = await db.from('users').select('*').eq('id', payload.userId).single().then(r => r.data)
    return ok({ user: sanitizeUser(updatedUser), message: '绑定成功，请开始激活' })
  }

  // POST /api/auth/recover — 安全问题找回（换设备时恢复session）
  if (pathname === '/api/auth/recover' && request.method === 'POST') {
    const { userId, securityAnswer } = await request.json()
    if (!userId || !securityAnswer) return err('参数不完整')

    const db = getDB(env)
    const { data: user } = await db.from('users')
      .select('*').eq('user_no', userId).maybeSingle()

    if (!user) return err('ID不存在')
    if (user.is_frozen) return err('账户已被冻结')
    if (!user.security_answer) return err('该账户未设置安全问题，请联系管理员')

    const answerHash = await hashAnswer(securityAnswer.trim().toLowerCase(), env.JWT_SECRET)
    if (answerHash !== user.security_answer) return err('安全答案错误')

    const token = await signJWT({ userId: user.id, userNo: user.user_no }, env.JWT_SECRET)
    return ok({ token, user: sanitizeUser(user) })
  }

  // GET /api/auth/me
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const payload = await authMiddleware(request, env)
    if (!payload) return err('未登录', 401)
    const db = getDB(env)
    const { data: user } = await db.from('users').select('*').eq('id', payload.userId).single()
    if (!user) return err('用户不存在', 404)
    return ok(sanitizeUser(user))
  }

  // 兼容旧版 register/login（暂时保留）
  if (pathname === '/api/auth/register' && request.method === 'POST') {
    return err('请使用新版参与流程')
  }
  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const { email } = await request.json().catch(() => ({}))
    if (!email) return err('请输入账号')
    const db = getDB(env)
    const { data: user } = await db.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle()
    if (!user) return err('用户不存在')
    if (user.is_frozen) return err('账户已被冻结')
    const token = await signJWT({ userId: user.id, userNo: user.user_no }, env.JWT_SECRET)
    return ok({ token, user: sanitizeUser(user) })
  }

  return null
}

export async function authMiddleware(request, env) {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyJWT(token, env.JWT_SECRET)
}

async function hashAnswer(answer, secret) {
  const encoder = new TextEncoder()
  const data = encoder.encode(answer + (secret || 'p2p-salt'))
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sanitizeUser(u) {
  const { security_answer, ...safe } = u
  return safe
}

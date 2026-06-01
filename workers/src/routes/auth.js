import { getDB, generateUserId, generateInviteCode } from '../db.js'
import { signJWT, verifyJWT, getTokenFromRequest } from '../utils/jwt.js'
import { ok, err } from '../utils/response.js'

export async function handleAuth(request, env, pathname) {

  // POST /api/auth/register
  if (pathname === '/api/auth/register' && request.method === 'POST') {
    const { email, inviteCode } = await request.json()
    if (!email) return err('请输入邮箱')
    if (!inviteCode) return err('请输入邀请码')

    const db = getDB(env)

    // 验证邀请码
    const { data: referrer } = await db.from('users')
      .select('id, user_no, invite_used, is_frozen, is_active')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle()

    if (!referrer) return err('邀请码不存在')
    if (referrer.is_frozen) return err('邀请人账户已被冻结')
    if ((referrer.invite_used || 0) >= 2) return err('该邀请码已使用2次，无法继续邀请')
    if (!referrer.is_active) return err('邀请人尚未激活')

    // 检查邮箱是否已注册
    const { data: existing } = await db.from('users')
      .select('id').eq('email', email.toLowerCase()).maybeSingle()
    if (existing) return err('该邮箱已注册')

    // 生成ID和邀请码
    const userNo     = await generateUserId(db)
    const myInvCode  = await generateInviteCode(db)

    const { data: newUser, error } = await db.from('users').insert({
      user_no: userNo,
      email: email.toLowerCase(),
      invite_code: myInvCode,
      referrer_id: referrer.id,
      invite_used: 0,
      is_active: false,
      is_frozen: false,
      is_exited: false,
      is_node: false,
      role: 'member',
      total_received: 0,
    }).select().single()

    if (error) return err('注册失败：' + error.message)

    const token = await signJWT({ userId: newUser.id, userNo: newUser.user_no }, env.JWT_SECRET)
    return ok({ token, user: sanitizeUser(newUser) })
  }

  // POST /api/auth/login
  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const { email } = await request.json()
    if (!email) return err('请输入邮箱')

    const db = getDB(env)
    const { data: user } = await db.from('users')
      .select('*').eq('email', email.toLowerCase()).maybeSingle()

    if (!user) return err('用户不存在')
    if (user.is_frozen) return err('账户已被冻结，请联系客服')

    // 演示版：验证码随便填（生产环境接短信API）
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

  return null
}

export async function authMiddleware(request, env) {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyJWT(token, env.JWT_SECRET)
}

function sanitizeUser(u) {
  const { password_hash, ...safe } = u
  return safe
}

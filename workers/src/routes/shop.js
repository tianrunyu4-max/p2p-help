import { getDB, getUser, getShop } from '../db.js'
import { authMiddleware } from './auth.js'
import { ok, err } from '../utils/response.js'

export async function handleShop(request, env, pathname) {
  const payload = await authMiddleware(request, env)
  if (!payload) return err('未登录', 401)

  const db = getDB(env)

  // GET /api/shop/my — 我的店铺信息
  if (pathname === '/api/shop/my' && request.method === 'GET') {
    const me = await getUser(db, payload.userId)
    if (!me) return err('用户不存在')
    if (!me.current_shop_id) return err('暂无店铺')

    const shop = await getShop(db, me.current_shop_id)
    if (!shop) return err('店铺不存在')

    const owner  = await getUser(db, shop.slot1_owner_id)
    const tenant = shop.slota_tenant_id ? await getUser(db, shop.slota_tenant_id) : null

    return ok({
      shop_id:              shop.id,
      owner_no:             owner?.user_no,
      owner_invite_code:    owner?.invite_code,
      owner_invite_used:    owner?.invite_used || 0,
      tenant_no:            tenant?.user_no || null,
      tenant_invite_code:   tenant?.invite_code || null,
      my_role:              me.role,
    })
  }

  return null
}

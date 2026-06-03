import { getDB, getUser, getShop } from '../db.js'
import { authMiddleware } from './auth.js'
import { ok, err } from '../utils/response.js'

const REPURCHASE_LIMIT = 700

export async function handleShop(request, env, pathname) {
  if (!pathname.startsWith('/api/shop') && !pathname.startsWith('/api/qr')) return null
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
      shop_id:            shop.id,
      owner_no:           owner?.user_no,
      owner_invite_code:  owner?.invite_code,
      owner_invite_used:  owner?.invite_used || 0,
      tenant_no:          tenant?.user_no || null,
      tenant_invite_code: tenant?.invite_code || null,
      my_role:            me.role,
    })
  }

  // GET /api/shop/team-stats — 团队数据
  if (pathname === '/api/shop/team-stats' && request.method === 'GET') {
    const me = await getUser(db, payload.userId)
    if (!me) return err('用户不存在')

    // 直推人数
    const { count: directCount } = await db.from('users')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', payload.userId)

    // 团队总人数（6层）
    let totalCount = 0
    let currentLayer = [payload.userId]
    for (let i = 0; i < 6 && currentLayer.length > 0; i++) {
      const { data: nextLayer } = await db.from('users').select('id').in('referrer_id', currentLayer)
      if (!nextLayer?.length) break
      totalCount += nextLayer.length
      currentLayer = nextLayer.map(u => u.id)
    }

    // 累计收款
    const totalReceived = parseFloat(me.total_received) || 0

    // 我的模型统计：进入我店铺的代理数、从我店铺出局的老板数
    let agentsJoined = 0
    let bossesExited = 0
    if (me.current_shop_id) {
      const shop = await getShop(db, me.current_shop_id)
      if (shop) {
        // 进入总数 = rotation_count（每次旋转=一个代理进入）+ 当前代理（若存在）
        agentsJoined = (shop.rotation_count || 0) + (shop.slota_tenant_id ? 1 : 0)
        // 出局老板 = 直推中 is_exited = true 的人
        const { count: exitedCount } = await db.from('users')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_id', payload.userId)
          .eq('is_exited', true)
        bossesExited = exitedCount || 0
      }
    }

    // 近期收款记录
    const { data: recentTasks } = await db.from('payment_tasks')
      .select('amount, type_label, confirmed_at')
      .eq('receiver_id', payload.userId)
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false })
      .limit(20)

    const repurchaseNeed = me.is_active && totalReceived >= REPURCHASE_LIMIT

    return ok({
      directCount:   directCount || 0,
      totalCount,
      totalReceived,
      agentsJoined,
      bossesExited,
      recentTasks:   recentTasks || [],
      repurchaseNeed,
      repurchaseLimit: REPURCHASE_LIMIT,
    })
  }

  return null
}

import { handleAuth }     from './routes/auth.js'
import { handleActivate } from './routes/activate.js'
import { handleOrders, checkTimeouts }   from './routes/orders.js'
import { handleShop }     from './routes/shop.js'
import { handleUser }     from './routes/user.js'
import { handleAdmin }    from './routes/admin.js'
import { cors }           from './utils/response.js'

export default {

  // ── HTTP 请求处理 ──────────────────────────────────────────
  async fetch(request, env) {
    const url      = new URL(request.url)
    const pathname = url.pathname

    // CORS 预检
    if (request.method === 'OPTIONS') return cors()

    // 路由分发
    const handlers = [
      handleAuth,
      handleActivate,
      handleOrders,
      handleShop,
      handleUser,
      handleAdmin,
    ]

    for (const handler of handlers) {
      try {
        const res = await handler(request, env, pathname)
        if (res) return res
      } catch (e) {
        console.error(`[${pathname}] Error:`, e)
        return Response.json({ code: 500, message: '服务器错误：' + e.message }, {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        })
      }
    }

    return Response.json({ code: 404, message: '接口不存在' }, {
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  },

  // ── Cron 定时任务（每分钟）────────────────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkTimeouts(env))
  }
}

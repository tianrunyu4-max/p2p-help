import { handleAuth }                   from './routes/auth.js'
import { handleActivate }               from './routes/activate.js'
import { handleOrders, checkTimeouts }  from './routes/orders.js'
import { handleShop }                   from './routes/shop.js'
import { handleUser }                   from './routes/user.js'
import { handleAdmin }                  from './routes/admin.js'
import { cors }                         from './utils/response.js'

export default {

  // ── HTTP 请求处理 ──────────────────────────────────────────
  async fetch(request, env) {
    const url      = new URL(request.url)
    const pathname = url.pathname

    // CORS 预检
    if (request.method === 'OPTIONS') return cors()

    // API 路由
    if (pathname.startsWith('/api/')) {
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
    }

    // 非 API 请求 → 交给前端静态文件（Vue hash路由）
    // hash 路由下所有页面都走 index.html
    if (env.ASSETS) {
      // 有静态资源文件直接返回，没有的回退到 index.html
      try {
        return await env.ASSETS.fetch(request)
      } catch {
        const indexUrl = new URL('/', url.origin)
        return await env.ASSETS.fetch(new Request(indexUrl.toString(), request))
      }
    }

    return new Response('Not found', { status: 404 })
  },

  // ── Cron 定时任务（每分钟检查超时订单）────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkTimeouts(env))
  }
}

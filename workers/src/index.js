/**
 * Task Wall API - Cloudflare Workers 主入口
 * 
 * 架构：Cloudflare Workers + Supabase
 * 路由：itty-router
 * BUILD_TS: 1750040400
 */

import { Router } from 'itty-router'
import { createClient } from '@supabase/supabase-js'

// 路由模块
import { authRoutes } from './routes/auth.js'
import { checkinRoutes } from './routes/checkin.js'
import { transferRoutes } from './routes/transfer.js'
import { subscriptionRoutes } from './routes/subscription.js'
import { dividendRoutes } from './routes/dividend.js'
import { priceRoutes } from './routes/price.js'
import { registerUploadRoutes } from './routes/upload.js'
import { partnerRoutes } from './routes/partner.js'
import { handleAuditRequest } from './routes/audit.js'
import { exchangeRoutes } from './routes/exchange.js'
import { adminAuthRoutes } from './routes/adminAuth.js'
import { syncBalance, addBalance, setInviteCode, fixModel, fixReferrer, moveShopMember, fixReferrerModel, forceIndependent } from './routes/adminBalance.js'
import { engineRoutes } from './routes/engine.js'
import { redeemCodeRoutes } from './routes/redeemCode.js'
import { productRoutes } from './routes/products.js'
import { productRoutes as deliveryRoutes } from './routes/product.js'
import { tokenRedeemRoutes } from './routes/tokenRedeem.js'
import { aiBotRoutes } from './routes/aiBot.js'
import { chatRoutes } from './routes/chat.js'
import { rechargeRoutes } from './routes/recharge.js'
import { infoPostsRoutes } from './routes/infoPosts.js'
import { providerRankRoutes } from './routes/providerRank.js'
import { pintuanRoutes, settlePintuanPending } from './routes/pintuan.js'
import { groupRoutes } from './routes/groups.js'
import { withdrawRoutes } from './routes/withdraw.js'
import { mutualAidRoutes } from './routes/mutualAid.js'
import { lotteryRoutes } from './routes/lottery.js'

// 中间件
import { corsHeaders, handleCORS } from './middleware/cors.js'
import { rateLimitMiddleware, addRateLimitHeaders } from './middleware/rateLimit.js'
import { authMiddleware, optionalAuth } from './middleware/auth.js'

// 服务
import { executeDailyDividend, updateAllTeamCounts, distributeV5SubsidyPool, processShoppingGoldCompound, distributeLockedDividendPool } from './services/dividendService.js'

const router = Router()

// ==================== CORS 预检 ====================
router.options('*', handleCORS)

// ==================== sw.js 强制 no-store ====================
// CF ASSETS 会直接从边缘缓存返回 sw.js，绕过 Worker 代码。
// 加专用路由确保每次都走 Worker，手动覆盖缓存头。
router.get('/sw.js', async (request, env) => {
    if (!env.ASSETS) return new Response('Not found', { status: 404 })
    // 用不带查询参数的干净 URL 去拿 ASSETS，防止 KV 找不到带参数的路径
    const cleanUrl = new URL(request.url)
    cleanUrl.search = ''
    const assetRes = await env.ASSETS.fetch(new Request(cleanUrl.toString(), request))
    if (!assetRes.ok) return assetRes
    const text = await assetRes.text()
    const headers = new Headers(assetRes.headers)
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('CDN-Cache-Control', 'no-store')
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store')
    headers.set('Surrogate-Control', 'no-store')
    // 每次响应唯一，彻底阻止 CF 边缘缓存命中
    headers.set('X-SW-Nonce', Date.now().toString(36))
    headers.delete('ETag')
    headers.delete('Last-Modified')
    return new Response(text, { status: assetRes.status, headers })
})

// ==================== SW 强制清除（穿透所有缓存，注销旧SW） ====================
router.get('/clear-sw', () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>正在更新...</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#fff;}
h2{font-size:1.4rem;margin-bottom:1rem;}p{color:#aaa;font-size:.9rem;}</style></head>
<body><h2>🔄 正在更新应用...</h2><p id="msg">注销旧版本缓存中，请稍候...</p>
<script>
(async()=>{
  const msg=document.getElementById('msg');
  try{
    // 1. 注销所有 SW
    const regs=await navigator.serviceWorker.getRegistrations();
    for(const r of regs){ await r.unregister(); }
    msg.textContent='✅ 已清除 '+regs.length+' 个旧缓存，正在跳转...';
    // 2. 清除所有 Cache Storage
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    // 3. 跳转回主页（强制不走缓存）
    setTimeout(()=>{ location.replace('/?_='+Date.now()); },1200);
  }catch(e){
    msg.textContent='跳转中...';
    setTimeout(()=>{ location.replace('/'); },800);
  }
})();
</script></body></html>`
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html;charset=utf-8',
            'Cache-Control': 'no-store, no-cache',
            'CDN-Cache-Control': 'no-store',
        }
    })
})

// ==================== 健康检查 ====================
router.get('/api/health', () => {
    return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.2.0', // 更新版本：添加核心引擎数据迁移
        features: {
            checkin: true,
            exchange: true,
            adminPassword: true,
            engine: true
        }
    }), {
        headers: { 'Content-Type': 'application/json' }
    })
})

// ==================== API 路由 ====================

// 认证 - 无需登录
router.all('/api/auth/*', authRoutes.handle)

// 管理员认证 - 无需登录（内部验证）
router.all('/api/admin/auth/*', adminAuthRoutes.handle)

// 管理员余额同步 - 无需认证（生产环境使用）
router.post('/api/admin/sync-balance', (request) => syncBalance(request, request.env))

// 管理员增量充值 - 从DB读取真实余额后再加（不依赖本地缓存）
router.post('/api/admin/add-balance', (request) => addBalance(request, request.env))

// 管理员设置用户邀请码
router.post('/api/admin/set-invite-code', (request) => setInviteCode(request, request.env))

// 管理员修复1+1模型历史数据
router.post('/api/admin/fix-model', (request) => fixModel(request, request.env))

// 管理员修改推荐人
router.post('/api/admin/fix-referrer', (request) => fixReferrer(request, request.env))

// 管理员移动用户到指定店铺
router.post('/api/admin/move-shop-member', (request) => moveShopMember(request, request.env))

// 管理员修正推荐关系+1+1模型（一步到位）
router.post('/api/admin/fix-referrer-model', (request) => fixReferrerModel(request, request.env))

// 管理员强制设用户为独立店主
router.post('/api/admin/force-independent', (request) => forceIndependent(request, request.env))

// 签到 - 限流
router.all('/api/checkin/*', rateLimitMiddleware, checkinRoutes.handle)

// 价格 - 公开
router.all('/api/transfer/price', priceRoutes.handle)

// 转账 - 需要认证 + 限流
router.all('/api/transfer/*', optionalAuth, rateLimitMiddleware, transferRoutes.handle)

// 订阅 - 需要认证
router.all('/api/subscription/*', optionalAuth, subscriptionRoutes.handle)

// 分红 - 公开查询
router.all('/api/dividend/*', dividendRoutes.handle)

// 合伙人 - 需要认证
router.all('/api/partner/*', partnerRoutes.handle)

// 积分兑换 - 限流
router.all('/api/exchange/*', rateLimitMiddleware, exchangeRoutes.handle)

// 社区消息 - 公开获取，无需强认证
import { communityRoutes } from './routes/community.js'
router.all('/api/community/*', communityRoutes.handle)

// 文件上传 - 公开（限流保护）
registerUploadRoutes(router)

// 核心引擎 - 数据操作API（限流保护）
router.all('/api/engine/*', rateLimitMiddleware, engineRoutes.handle)

// 充值码 - 限流保护
router.all('/api/redeem/*', rateLimitMiddleware, redeemCodeRoutes.handle)

// 每周新品商城 - 公开访问
router.all('/api/products/*', productRoutes.handle)

// 产品提货
router.all('/api/product/*', deliveryRoutes.handle)

// 积分兑换代币 - 限流保护
router.all('/api/token-redeem/*', rateLimitMiddleware, tokenRedeemRoutes.handle)

// AI 聊天机器人 - DeepSeek 驱动
router.all('/api/ai/*', rateLimitMiddleware, aiBotRoutes.handle)

// 龙虾AI对话（积分消耗版）
router.all('/api/chat/*', optionalAuth, rateLimitMiddleware, chatRoutes.handle)

// USDT 充值 - 链上验证自动到账
router.all('/api/recharge/*', rateLimitMiddleware, rechargeRoutes.handle)

// 余额提现 - 限流保护
router.all('/api/withdraw/*', rateLimitMiddleware, withdrawRoutes.handle)

// 互助补贴
router.all('/api/mutual-aid/*', rateLimitMiddleware, mutualAidRoutes.handle)
router.all('/api/lottery/*', rateLimitMiddleware, lotteryRoutes.handle)

// 服务商每日竞价排名
router.get('/api/provider-rank', providerRankRoutes.handle)
router.all('/api/provider-rank/*', optionalAuth, rateLimitMiddleware, providerRankRoutes.handle)

// 拼团补贴
router.get('/api/pintuan/status', optionalAuth, pintuanRoutes.handle)
router.all('/api/pintuan/*', optionalAuth, rateLimitMiddleware, pintuanRoutes.handle)

// 海外信息发布 - 公开获取，限流保护写入
router.get('/api/info/*', infoPostsRoutes.handle)
router.all('/api/info/*', rateLimitMiddleware, infoPostsRoutes.handle)

// 群链接管理 - 公开获取，管理员写入
router.all('/api/groups/*', groupRoutes.handle)

// ==================== 404 / Assets Fallback ====================
// 如果没有匹配到 API 路由，返回 undefined 让 Cloudflare Assets 尝试处理
router.all('*', (request) => {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
            code: 404,
            message: 'API Not Found'
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        })
    }
    // 返回 undefined 会让 itty-router 的 handle 返回 undefined
    // 从而 fetch 方法可以决定如何处理（继续 fallthrough 到 assets）
    return undefined
})

// ==================== 主导出 ====================
export default {
    /**
     * HTTP 请求处理
     */
    async fetch(request, env, ctx) {
        // 初始化 Supabase 客户端（如果配置了环境变量）
        let supabase = null
        if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
            supabase = createClient(
                env.SUPABASE_URL,
                env.SUPABASE_SERVICE_KEY
            )
        }

        // 注入环境到请求
        request.env = env
        request.supabase = supabase
        request.ctx = ctx

        try {
            const response = await router.handle(request)

            // 如果路由器没有返回响应（返回 undefined），由 Assets 处理静态文件
            // index.html 必须 no-cache，确保每次部署后浏览器立即获取新版本
            if (!response) {
                if (env.ASSETS) {
                    const url = new URL(request.url)
                    const pathname = url.pathname
                    // 判断是否是 HTML 请求（SPA 导航 / 无扩展名 / .html 结尾）
                    const isHtml = !pathname.includes('.') || pathname.endsWith('.html') || pathname.endsWith('/')
                    const isSW = pathname === '/sw.js'
                    const assetResponse = await env.ASSETS.fetch(request)
                    if ((isHtml || isSW) && assetResponse.ok) {
                        const headers = new Headers(assetResponse.headers)
                        // 浏览器层面：不缓存（sw.js 必须 no-store，否则 ETag 条件请求会绕过 bfcache 更新）
                        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
                        headers.set('Pragma', 'no-cache')
                        // Cloudflare CDN 层面：强制不缓存
                        headers.set('CDN-Cache-Control', 'no-store')
                        headers.set('Cloudflare-CDN-Cache-Control', 'no-store')
                        return new Response(assetResponse.body, {
                            status: assetResponse.status,
                            statusText: assetResponse.statusText,
                            headers
                        })
                    }
                    return assetResponse
                }
                return null
            }

            // 添加 CORS 头
            const newHeaders = new Headers(response.headers)
            Object.entries(corsHeaders(env)).forEach(([key, value]) => {
                newHeaders.set(key, value)
            })

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            })

        } catch (error) {
            console.error('[Worker Error]', error.message, error.stack)

            return new Response(JSON.stringify({
                code: 500,
                message: '服务器内部错误',
                error: env.ENVIRONMENT === 'development' ? error.message : undefined
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders(env)
                }
            })
        }
    },

    /**
     * 定时任务 - 每日分红
     * Cron: 0 16 * * * (UTC 16:00 = 北京时间 00:00)
     */
    async scheduled(event, env, ctx) {
        console.log('[Cron] 开始执行每日分红任务')

        const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_KEY
        )

        try {
            // 先更新所有用户6层团队人数，再执行分红（分红依赖此字段判断合伙人资格）
            await updateAllTeamCounts(supabase)
            const result = await executeDailyDividend(supabase)
            console.log('[Cron] 每日分红完成:', result)
        } catch (error) {
            console.error('[Cron] 每日分红失败:', error)
        }

        // 平级锁定池分润（subsidy_pool → 满档直推伙伴学分）
        await distributeLockedDividendPool(supabase).catch(e => console.error('[LockedPool] cron error:', e))

        // 合伙人补贴池每日分润（保留兼容）
        await distributeV5SubsidyPool(supabase).catch(e => console.error('[PartnerPool] cron error:', e))

        // 购物金每日复利3%（购物金已暂停累积，出局逻辑保留）
        await processShoppingGoldCompound(supabase).catch(e => console.error('[ShoppingGold] cron error:', e))

        // 拼团团队流水日结（pintuan_pending → 70%余额 + 30%升档复投池）
        await settlePintuanPending(supabase).catch(e => console.error('[PintuanSettle] cron error:', e))
    }
}

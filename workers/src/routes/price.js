/**
 * 价格路由 - Price Routes
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/transfer' })

/**
 * GET /api/transfer/price
 * 获取今日价格
 */
router.get('/price', async (request) => {
    const env = request.env

    try {
        // 从缓存获取
        const cached = await env.CACHE?.get('transfer:price', { type: 'json' })
        if (cached) {
            return Response.json({ code: 200, data: cached })
        }

        // 基础价格算法（可接入实际行情API）
        const basePrice = 0.00001
        const randomChange = (Math.random() - 0.5) * 0.001  // ±0.0005
        const currentPrice = Math.max(0.001, basePrice + randomChange)
        const changePercent = ((randomChange / basePrice) * 100).toFixed(2)

        const priceData = {
            currentPrice: parseFloat(currentPrice.toFixed(6)),
            changePercent: parseFloat(changePercent),
            high24h: currentPrice * 1.05,
            low24h: currentPrice * 0.95,
            volume24h: Math.floor(Math.random() * 1000000) + 500000,
            updatedAt: new Date().toISOString()
        }

        // 缓存5分钟
        await env.CACHE?.put('transfer:price', JSON.stringify(priceData), {
            expirationTtl: 300
        })

        return Response.json({ code: 200, data: priceData })

    } catch (error) {
        console.error('[Price] Error:', error)
        return Response.json({
            code: 200,
            data: {
                currentPrice: 0.00001,
                changePercent: 0,
                updatedAt: new Date().toISOString()
            }
        })
    }
})

export const priceRoutes = router

/**
 * 每周新品商城路由 - Products Routes
 *
 * 商品分区：
 *   top      = 热销TOP（热卖新品）
 *   partner  = 合伙人优选（精选推荐）
 *   overseas = 海外仓（直发包税）
 *   tech     = 科技新品（智能好物）
 *
 * 购买奖励逻辑（直推网体平级奖）：
 *   level_bonus_enabled → 从推荐人向上6层各拿平级奖 (price × level_bonus_rate)
 *                         分账: 50%→余额, 35%→复投池, 5%→补贴池, 10%→购物金
 *
 * 公开接口:
 *   GET  /api/products/weekly          - 获取商品列表（按区域）
 *   POST /api/products/purchase        - 购买商品
 *   GET  /api/products/orders          - 用户订单
 *
 * 管理员接口（需要 ENGINE_API_KEY）:
 *   GET    /api/products/admin/list    - 全部商品
 *   POST   /api/products/admin/create  - 创建商品
 *   PUT    /api/products/admin/:id     - 更新商品
 *   DELETE /api/products/admin/:id     - 删除商品
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/products' })

// ==================== 工具函数 ====================

function json(data, status = 200) {
    return Response.json(data, { status })
}

async function getUser(supabase, userId) {
    const { data } = await supabase
        .from('users')
        .select('id, is_member, coin_balance, points_balance, referrer_id')
        .eq('id', userId)
        .single()
    return data
}

/**
 * 触发见点奖 - 买家的直接推荐人拿见点奖
 */
async function triggerSpotBonus(supabase, referrerId, product) {
    if (!referrerId) return null

    const referrer = await getUser(supabase, referrerId)
    if (!referrer || !referrer.is_member) return null

    const bonusAmount = Math.floor(product.price_balance * product.spot_bonus_rate * 100) / 100
    if (bonusAmount <= 0) return null

    await supabase.rpc('add_coin_balance', {
        p_user_id: referrerId,
        p_amount: bonusAmount
    })

    // 记录奖励流水
    await supabase.from('balance_logs').insert({
        user_id: referrerId,
        amount: bonusAmount,
        type: 'product_spot_bonus',
        description: `商品见点奖: ${product.title}`,
        balance_after: (parseFloat(referrer.coin_balance) || 0) + bonusAmount
    }).catch(() => {})

    return { userId: referrerId, amount: bonusAmount }
}

/**
 * 触发平级奖 - 从推荐人开始向上6层
 */
async function triggerLevelBonus(supabase, startUserId, product) {
    if (!startUserId) return []

    const bonuses = []
    let currentUserId = startUserId
    const depth = product.level_depth || 6
    const rate = product.level_bonus_rate || 0.10
    const price = product.price_balance || 0

    for (let level = 1; level <= depth; level++) {
        if (!currentUserId) break

        const current = await getUser(supabase, currentUserId)
        if (!current) break

        if (current.is_member) {
            const totalBonus = Math.floor(price * rate * 100) / 100
            if (totalBonus > 0) {
                // 平级奖分配：50%到账 / 30%复投池 / 10%补贴池 / 10%购物金
                const withdrawable  = Math.round(totalBonus * 0.50 * 100) / 100
                const reinvest      = Math.round(totalBonus * 0.30 * 100) / 100
                const subsidy       = Math.round(totalBonus * 0.10 * 100) / 100
                const shoppingGold  = Math.round((totalBonus - withdrawable - reinvest - subsidy) * 100) / 100

                // 50% → 余额
                if (withdrawable > 0) {
                    await supabase.rpc('add_coin_balance', {
                        p_user_id: current.id,
                        p_amount: withdrawable
                    })
                }

                // 30% → 复投池
                if (reinvest > 0) {
                    const { data: ud } = await supabase.from('users').select('repurchase_balance').eq('id', current.id).single()
                    const newRepurchase = (parseFloat(ud?.repurchase_balance) || 0) + reinvest
                    await supabase.from('users').update({ repurchase_balance: newRepurchase }).eq('id', current.id)
                }

                // 10% → 补贴池（满30自动清空，不转入其他余额）
                if (subsidy > 0) {
                    const { data: ud } = await supabase.from('users').select('subsidy_pool').eq('id', current.id).single()
                    const rawSubsidy = (parseFloat(ud?.subsidy_pool) || 0) + subsidy
                    const SUBSIDY_THRESHOLD = 30
                    const newSubsidy = rawSubsidy >= SUBSIDY_THRESHOLD ? 0 : rawSubsidy
                    if (rawSubsidy >= SUBSIDY_THRESHOLD) {
                        console.log(`[SubsidyAuto/product] 用户${current.id} 补贴池满30(${rawSubsidy.toFixed(2)})→自动清空`)
                    }
                    await supabase.from('users').update({ subsidy_pool: newSubsidy }).eq('id', current.id)
                }

                // 10% → 购物金
                if (shoppingGold > 0) {
                    const { data: ud } = await supabase.from('users').select('shopping_gold').eq('id', current.id).single()
                    await supabase.from('users').update({ shopping_gold: (parseFloat(ud?.shopping_gold) || 0) + shoppingGold }).eq('id', current.id)
                }

                // 记录奖励流水
                await supabase.from('balance_logs').insert({
                    user_id: current.id,
                    amount: totalBonus,
                    type: 'product_level_bonus',
                    description: `商品平级奖 L${level}: ${product.title}`,
                    balance_after: (parseFloat(current.coin_balance) || 0) + withdrawable
                }).catch(() => {})

                bonuses.push({ userId: current.id, level, amount: totalBonus })
            }
        }

        currentUserId = current.referrer_id
    }

    return bonuses
}

// ==================== 公开接口 ====================

/**
 * GET /api/products/weekly?zone=uae&userId=xxx
 * 获取商品列表（按区域，仅返回 active 状态）
 */
router.get('/weekly', async (request) => {
    const supabase = request.supabase
    const url = new URL(request.url)
    const zone = url.searchParams.get('zone') || 'uae'

    try {
        const { data, error } = await supabase
            .from('weekly_products')
            .select('*')
            .eq('status', 'active')
            .eq('zone', zone)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false })

        if (error) throw error

        return json({ code: 200, data: data || [] })
    } catch (err) {
        console.error('[Products] 获取商品列表失败:', err)
        return json({ code: 500, message: '获取商品列表失败' })
    }
})

/**
 * POST /api/products/purchase
 * 购买商品
 * Body: { userId, productId, paymentType: 'balance'|'points', password }
 */
router.post('/purchase', async (request) => {
    const supabase = request.supabase

    try {
        const { userId, productId, paymentType, password } = await request.json()

        if (!userId || !productId || !paymentType) {
            return json({ code: 400, message: '参数不完整' })
        }
        if (!['balance', 'points', 'shopping_coin'].includes(paymentType)) {
            return json({ code: 400, message: '支付方式无效' })
        }

        // 1. 验证交易密码
        if (password) {
            const { data: pwdResult } = await supabase.rpc('verify_transaction_password', {
                p_user_id: userId,
                p_password: password
            })
            if (!pwdResult) {
                return json({ code: 400, message: '交易密码错误' })
            }
        }

        // 2. 查询用户
        const user = await getUser(supabase, userId)
        if (!user) {
            return json({ code: 404, message: '用户不存在' })
        }

        // 3. 查询商品
        const { data: product, error: productError } = await supabase
            .from('weekly_products')
            .select('*')
            .eq('id', productId)
            .eq('status', 'active')
            .single()

        if (productError || !product) {
            return json({ code: 404, message: '商品不存在或已下架' })
        }

        // 4. 检查库存（初步检查，后续扣款时再原子验证）
        if (product.stock !== -1 && product.stock <= 0) {
            return json({ code: 400, message: '商品库存不足' })
        }

        // 5. 检查支付方式是否支持（不扣款，仅验证）
        let amountBalance = 0
        let amountPoints = 0
        let points = 0

        if (paymentType === 'balance') {
            if (!product.price_balance || product.price_balance <= 0) {
                return json({ code: 400, message: '该商品不支持余额购买' })
            }
            const balance = parseFloat(user.coin_balance) || 0
            if (balance < product.price_balance) {
                return json({ code: 400, message: `余额不足，需要 ${product.price_balance}，当前 ${balance.toFixed(2)}` })
            }
        } else if (paymentType === 'points') {
            if (!product.price_points || product.price_points <= 0) {
                return json({ code: 400, message: '该商品不支持积分购买' })
            }
            points = parseInt(user.points_balance) || 0
            if (points < product.price_points) {
                return json({ code: 400, message: `积分不足，需要 ${product.price_points}，当前 ${points}` })
            }
        } else if (paymentType === 'shopping_coin') {
            if (!product.price_shopping_coin || product.price_shopping_coin <= 0) {
                return json({ code: 400, message: '该商品不支持购物金购买' })
            }
            const shopGold = parseFloat(user.shopping_gold) || 0
            if (shopGold < product.price_shopping_coin) {
                return json({ code: 400, message: `购物金不足，需要 ${product.price_shopping_coin}，当前 ${shopGold.toFixed(2)}` })
            }
        }

        // 6. 先创建 PENDING 订单（保证扣款后订单必然存在，防止资金丢失）
        const { data: pendingOrder, error: pendingErr } = await supabase
            .from('product_orders')
            .insert({
                user_id: userId,
                product_id: productId,
                payment_type: paymentType,
                amount_balance: 0,
                amount_points: 0,
                status: 'pending'
            })
            .select('id')
            .single()

        if (pendingErr || !pendingOrder) {
            return json({ code: 500, message: '创建订单失败，请重试' })
        }
        const orderId = pendingOrder.id

        // 7. 原子化扣款（含并发保护）
        if (paymentType === 'balance') {
            // RPC 原子扣减余额
            const { error: deductError } = await supabase.rpc('add_coin_balance', {
                p_user_id: userId,
                p_amount: -product.price_balance
            })
            if (deductError) {
                await supabase.from('product_orders').update({ status: 'refunded' }).eq('id', orderId)
                throw deductError
            }
            amountBalance = product.price_balance

        } else if (paymentType === 'points') {
            // 乐观锁：.gte() 保证只在积分仍足够时才扣减，防并发超扣
            const { data: updatedRows, error: deductError } = await supabase
                .from('users')
                .update({ points_balance: points - product.price_points })
                .eq('id', userId)
                .gte('points_balance', product.price_points)
                .select('id')

            if (deductError || !updatedRows?.length) {
                await supabase.from('product_orders').update({ status: 'refunded' }).eq('id', orderId)
                return json({ code: 400, message: '积分不足（并发保护触发，请重试）' })
            }
            amountPoints = product.price_points

        } else if (paymentType === 'shopping_coin') {
            const shopGold = parseFloat(user.shopping_gold) || 0
            const { data: updatedRows, error: deductError } = await supabase
                .from('users')
                .update({ shopping_gold: shopGold - product.price_shopping_coin })
                .eq('id', userId)
                .gte('shopping_gold', product.price_shopping_coin)
                .select('id')
            if (deductError || !updatedRows?.length) {
                await supabase.from('product_orders').update({ status: 'refunded' }).eq('id', orderId)
                return json({ code: 400, message: '购物金不足（并发保护触发，请重试）' })
            }
        }

        // 8. 原子化扣库存（乐观锁防超卖）
        if (product.stock !== -1) {
            const { data: stockResult } = await supabase
                .from('weekly_products')
                .update({
                    stock: product.stock - 1,
                    sold_count: (product.sold_count || 0) + 1
                })
                .eq('id', productId)
                .gt('stock', 0)   // 只在库存 > 0 时才更新
                .select('id')

            if (!stockResult?.length) {
                // 库存并发售罄 → 退款并取消订单
                if (paymentType === 'balance') {
                    await supabase.rpc('add_coin_balance', { p_user_id: userId, p_amount: product.price_balance })
                } else {
                    await supabase.from('users').update({ points_balance: points }).eq('id', userId)
                }
                await supabase.from('product_orders').update({ status: 'refunded' }).eq('id', orderId)
                return json({ code: 400, message: '商品库存不足（刚刚售罄）' })
            }
        } else {
            await supabase.from('weekly_products').update({
                sold_count: (product.sold_count || 0) + 1
            }).eq('id', productId)
        }

        // 9. 奖励计算（只有余额购买才触发奖励）
        let spotBonusResult = null
        let levelBonuses = []

        if (paymentType === 'balance' && user.referrer_id) {
            if (product.spot_bonus_enabled) {
                spotBonusResult = await triggerSpotBonus(supabase, user.referrer_id, product)
            }
            if (product.level_bonus_enabled) {
                levelBonuses = await triggerLevelBonus(supabase, user.referrer_id, product)
            }
        }

        // 10. 将订单状态更新为 PAID（付款 + 奖励全部完成后）
        const { data: order, error: orderError } = await supabase
            .from('product_orders')
            .update({
                status: 'paid',
                amount_balance: amountBalance,
                amount_points: amountPoints,
                spot_bonus_receiver_id: spotBonusResult?.userId || null,
                level_bonuses: levelBonuses
            })
            .eq('id', orderId)
            .select()
            .single()

        if (orderError) {
            // 订单记录更新失败（数据已支付，只是记录问题），记录错误但不影响用户
            console.error('[Products] 更新订单状态失败，数据已支付:', orderError)
        }

        return json({
            code: 200,
            message: '购买成功',
            data: {
                orderId,
                product: product.title,
                paymentType,
                amountBalance,
                amountPoints,
                spotBonus: spotBonusResult,
                levelBonuses
            }
        })

    } catch (err) {
        console.error('[Products] 购买失败:', err)
        return json({ code: 500, message: '购买失败，请稍后重试' })
    }
})

/**
 * GET /api/products/orders?userId=xxx
 * 用户订单列表
 */
router.get('/orders', async (request) => {
    const supabase = request.supabase
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) return json({ code: 400, message: '缺少 userId' })

    try {
        const { data, error } = await supabase
            .from('product_orders')
            .select(`
                *,
                weekly_products(title, image_url, zone)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) throw error

        return json({ code: 200, data: data || [] })
    } catch (err) {
        console.error('[Products] 获取订单失败:', err)
        return json({ code: 500, message: '获取订单失败' })
    }
})

// ==================== 管理员接口 ====================

async function checkAdminKey(request) {
    const key = (request.headers.get('X-Engine-Key')
        || request.headers.get('x-api-key')
        || new URL(request.url).searchParams.get('key') || '').trim()
    if (!key) return false
    // 1. ENGINE_API_KEY 环境变量
    const engineKey = request.env?.ENGINE_API_KEY
    if (engineKey && key === engineKey) return true
    // 2. ADMIN_CODE 环境变量（明文）
    const adminCode = (request.env?.ADMIN_CODE || '').trim()
    if (adminCode && key === adminCode) return true
    // 3. 查数据库 admin_login_code（支持哈希自动迁移）
    const supabase = request.supabase
    if (supabase) {
        const { data } = await supabase.from('admin_settings')
            .select('setting_value').eq('setting_key', 'admin_login_code').single()
        if (data?.setting_value) {
            const stored = data.setting_value
            const isHashed = /^[0-9a-f]{64}$/.test(stored)
            if (isHashed) {
                const encoder = new TextEncoder()
                const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key))
                const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
                return hashHex === stored
            }
            return key === stored
        }
    }
    return false
}

/**
 * GET /api/products/admin/list
 * 获取全部商品（管理员）
 */
router.get('/admin/list', async (request) => {
    if (!await checkAdminKey(request)) {
        return json({ code: 403, message: '无权限' })
    }
    const supabase = request.supabase

    try {
        const { data, error } = await supabase
            .from('weekly_products')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false })

        if (error) throw error
        return json({ code: 200, data: data || [] })
    } catch (err) {
        return json({ code: 500, message: '获取失败' })
    }
})

/**
 * POST /api/products/admin/create
 * 创建商品（管理员）
 */
router.post('/admin/create', async (request) => {
    if (!await checkAdminKey(request)) {
        return json({ code: 403, message: '无权限' })
    }
    const supabase = request.supabase

    try {
        const body = await request.json()
        const {
            title, description, image_url, zone = 'uae',
            price_balance = 0, price_original = 0, price_points = 0, price_shopping_coin = 0,
            spot_bonus_enabled = false, spot_bonus_rate = 0.30,
            level_bonus_enabled = false, level_bonus_rate = 0.10, level_depth = 6,
            stock = -1, week_label, sort_order = 0
        } = body

        if (!title) return json({ code: 400, message: '商品名称必填' })

        const { data, error } = await supabase
            .from('weekly_products')
            .insert({
                title, description, image_url, zone,
                price_balance, price_original, price_points, price_shopping_coin,
                spot_bonus_enabled, spot_bonus_rate,
                level_bonus_enabled, level_bonus_rate, level_depth,
                stock, week_label, sort_order,
                status: 'active'
            })
            .select()
            .single()

        if (error) throw error
        return json({ code: 200, message: '创建成功', data })
    } catch (err) {
        console.error('[Products Admin] 创建失败:', err)
        return json({ code: 500, message: '创建失败: ' + err.message })
    }
})

/**
 * PUT /api/products/admin/:id
 * 更新商品（管理员）
 */
router.put('/admin/:id', async (request) => {
    if (!await checkAdminKey(request)) {
        return json({ code: 403, message: '无权限' })
    }
    const supabase = request.supabase
    const { id } = request.params

    try {
        const body = await request.json()
        const updates = {
            ...body,
            updated_at: new Date().toISOString()
        }
        delete updates.id
        delete updates.created_at
        delete updates.sold_count

        const { data, error } = await supabase
            .from('weekly_products')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return json({ code: 200, message: '更新成功', data })
    } catch (err) {
        console.error('[Products Admin] 更新失败:', err)
        return json({ code: 500, message: '更新失败: ' + err.message })
    }
})

/**
 * DELETE /api/products/admin/:id
 * 删除商品（管理员）
 */
router.delete('/admin/:id', async (request) => {
    if (!await checkAdminKey(request)) {
        return json({ code: 403, message: '无权限' })
    }
    const supabase = request.supabase
    const { id } = request.params

    try {
        const { error } = await supabase
            .from('weekly_products')
            .delete()
            .eq('id', id)

        if (error) throw error
        return json({ code: 200, message: '删除成功' })
    } catch (err) {
        return json({ code: 500, message: '删除失败: ' + err.message })
    }
})

export { router as productRoutes }
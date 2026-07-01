/**
 * USDT 充值路由
 * POST /api/recharge/usdt-verify  - 验证链上交易并自动到账
 * GET  /api/recharge/history      - 查询充值记录
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/recharge' })

// ==================== 常量 ====================
// USDT BEP20 合约地址（BSC 主网）
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'
// 平台收款地址（Bybit BSC BEP20 地址）
const PLATFORM_ADDRESS = '0x24db08aa8369d4405ada32a133862d63090847fb'
// 允许的充值档位（USD）
const VALID_AMOUNTS = [10, 30, 60]
// 允许的金额误差（处理精度问题）
const AMOUNT_TOLERANCE = 0.05

/**
 * 调用 BSCScan API 获取交易详情
 * 解析 USDT ERC20 transfer(address, uint256) 调用数据
 */
async function verifyUsdtTransaction(txhash, expectedAmount, apiKey) {
    const keyParam = apiKey ? `&apikey=${apiKey}` : ''

    // 获取交易数据
    const txUrl = `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${txhash}${keyParam}`
    const txRes = await fetch(txUrl, { signal: AbortSignal.timeout(15000) })
    if (!txRes.ok) throw new Error('BSCScan 请求失败')

    const txData = await txRes.json()
    const tx = txData.result

    if (!tx) {
        return { valid: false, error: '交易不存在，请检查哈希是否正确' }
    }

    // 未打包（还在 mempool）
    if (!tx.blockNumber) {
        return { valid: false, error: '交易正在确认中，请等待区块打包后再提交（通常1-2分钟）' }
    }

    // 验证目标合约是 USDT
    if (!tx.to || tx.to.toLowerCase() !== USDT_CONTRACT.toLowerCase()) {
        return { valid: false, error: '该交易不是 USDT (BEP20) 转账' }
    }

    // 解析 ERC20 transfer(address _to, uint256 _value) 调用数据
    // 方法选择器：0xa9059cbb
    const input = tx.input || ''
    if (!input.startsWith('0xa9059cbb')) {
        return { valid: false, error: '不是标准 USDT 转账操作' }
    }

    // 解码接收地址（第11-74字符，去掉前24位 padding）
    const recipientHex = input.slice(10, 74)
    const recipient = ('0x' + recipientHex.slice(24)).toLowerCase()

    // 解码金额（第75-138字符，18位小数）
    const amountHex = input.slice(74, 138)
    const rawAmount = BigInt('0x' + amountHex)
    const amount = Number(rawAmount) / 1e18 // USDT BEP20 = 18 decimals

    // 验证接收地址是平台地址
    if (recipient !== PLATFORM_ADDRESS.toLowerCase()) {
        return { valid: false, error: `收款地址不是平台地址，请转账到正确地址` }
    }

    // 验证金额匹配
    if (Math.abs(amount - expectedAmount) > AMOUNT_TOLERANCE) {
        return {
            valid: false,
            error: `金额不匹配：链上转入 ${amount.toFixed(2)} USDT，期望 ${expectedAmount} USDT`
        }
    }

    return {
        valid: true,
        amount: expectedAmount,
        actualAmount: amount,
        fromAddress: tx.from,
        blockNumber: parseInt(tx.blockNumber, 16)
    }
}

/**
 * POST /api/recharge/usdt-verify
 * 验证 USDT 链上交易并自动给用户加余额
 * Body: { userId, txid, amount }
 */
router.post('/usdt-verify', async (request) => {
    const { supabase, env } = request

    try {
        const body = await request.json()
        const { userId, txid, amount } = body

        // 参数校验
        if (!userId || !txid || !amount) {
            return Response.json({ code: 400, message: '参数不完整' })
        }

        // 验证充值档位
        const amountNum = parseFloat(amount)
        if (isNaN(amountNum) || amountNum < 10) {
            return Response.json({ code: 400, message: '充值金额不能低于 $10' })
        }

        // TXID 格式校验
        if (!/^0x[0-9a-fA-F]{64}$/.test(txid)) {
            return Response.json({ code: 400, message: '交易哈希格式无效（应为 0x 开头的64位十六进制）' })
        }

        // ── 防重复：检查 TXID 是否已使用 ──
        const { data: existing } = await supabase
            .from('recharge_logs')
            .select('id, amount')
            .eq('txid', txid)
            .single()

        if (existing) {
            return Response.json({ code: 400, message: '该交易已被使用，不能重复充值' })
        }

        // ── 验证用户存在 ──
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, coin_balance')
            .eq('id', String(userId))
            .single()

        if (userErr || !user) {
            return Response.json({ code: 404, message: '用户不存在' })
        }

        // ── 调用 BSCScan 验证链上交易 ──
        const verification = await verifyUsdtTransaction(
            txid,
            amountNum,
            env.BSCSCAN_API_KEY || null
        )

        if (!verification.valid) {
            return Response.json({ code: 400, message: verification.error })
        }

        // ── 写入充值记录（唯一索引防止并发重复） ──
        const { error: logErr } = await supabase
            .from('recharge_logs')
            .insert({
                user_id: String(userId),
                amount: verification.amount,
                method: 'usdt',
                txid: txid,
                from_address: verification.fromAddress,
                status: 'completed'
            })

        if (logErr) {
            // 如果是唯一约束冲突，说明并发重复请求
            if (logErr.code === '23505') {
                return Response.json({ code: 400, message: '该交易已处理，请勿重复提交' })
            }
            console.error('[Recharge] insert log error:', logErr)
            return Response.json({ code: 500, message: '记录写入失败，请联系客服' })
        }

        // ── 给用户加余额 ──
        const newBalance = parseFloat(user.coin_balance || 0) + verification.amount
        const { error: balErr } = await supabase
            .from('users')
            .update({ coin_balance: newBalance.toFixed(4) })
            .eq('id', String(userId))

        if (balErr) {
            console.error('[Recharge] update balance error:', balErr)
            // 余额更新失败时回滚充值记录
            await supabase.from('recharge_logs').delete().eq('txid', txid)
            return Response.json({ code: 500, message: '余额更新失败，已回滚，请联系客服' })
        }

        console.log(`[Recharge] 用户${userId} USDT充值成功: +$${verification.amount} txid=${txid}`)

        return Response.json({
            code: 200,
            message: `充值成功！$${verification.amount} 已到账 🎉`,
            data: {
                credited: verification.amount,
                newBalance: newBalance.toFixed(2)
            }
        })

    } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return Response.json({ code: 500, message: 'BSCScan 查询超时，请稍后重试' })
        }
        console.error('[Recharge] usdt-verify error:', error)
        return Response.json({ code: 500, message: '验证失败: ' + error.message }, { status: 500 })
    }
})

/**
 * GET /api/recharge/history
 * 查询用户充值记录
 * Query: ?userId=xxx
 */
router.get('/history', async (request) => {
    const { supabase } = request
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
        return Response.json({ code: 400, message: '请提供 userId' })
    }

    try {
        const { data, error } = await supabase
            .from('recharge_logs')
            .select('id, amount, method, txid, status, created_at')
            .eq('user_id', String(userId))
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) throw error

        return Response.json({ code: 200, data: data || [] })
    } catch (error) {
        return Response.json({ code: 500, message: '查询失败' }, { status: 500 })
    }
})

/**
 * GET /api/recharge/platform-info
 * 获取平台收款地址等公开信息
 */
router.get('/platform-info', async () => {
    return Response.json({
        code: 200,
        data: {
            usdtAddress: PLATFORM_ADDRESS,
            network: 'BSC (BEP20)',
            coin: 'USDT',
            minAmount: 10,
            validAmounts: VALID_AMOUNTS
        }
    })
})

export const rechargeRoutes = router

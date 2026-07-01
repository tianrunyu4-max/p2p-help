/**
 * 合伙人授权中间件
 * 验证用户是否为合格合伙人
 */

/**
 * 验证用户是否为合格合伙人的中间件
 * 注意：此中间件应在 authMiddleware 之后使用
 * @param {Request} request
 * @returns {Response|void} 如果不是合伙人返回403错误，否则继续
 */
export async function requirePartner(request) {
    // 确保用户已认证
    if (!request.user || !request.user.id) {
        return new Response(JSON.stringify({
            code: 401,
            message: '未登录或登录已过期'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    try {
        const supabase = request.supabase
        const userId = request.user.id

        // 查询用户的合伙人状态
        const { data: user, error } = await supabase
            .from('users')
            .select('is_partner')
            .eq('id', userId)
            .single()

        if (error) {
            console.error('[PartnerAuth] Database error:', error)
            return new Response(JSON.stringify({
                code: 500,
                message: '服务器错误'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        if (!user) {
            return new Response(JSON.stringify({
                code: 404,
                message: '用户不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // 检查是否为合伙人
        if (!user.is_partner) {
            return new Response(JSON.stringify({
                code: 403,
                message: '您还不是合伙人，无法访问此功能'
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // 验证通过，继续执行
        // 可以在 request 上添加合伙人标记
        request.isPartner = true

    } catch (error) {
        console.error('[PartnerAuth] Error:', error)
        return new Response(JSON.stringify({
            code: 500,
            message: '认证失败'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

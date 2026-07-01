/**
 * 认证中间件 - JWT 验证
 */

/**
 * 验证 JWT Token（严格模式）
 */
export async function authMiddleware(request) {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
            code: 401,
            message: '未登录或登录已过期'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    const token = authHeader.substring(7)

    try {
        // 使用 Supabase 验证 token
        const supabase = request.supabase
        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            return new Response(JSON.stringify({
                code: 401,
                message: '登录已过期，请重新登录'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // 注入用户信息
        request.user = {
            id: user.id,
            email: user.email,
            phone: user.phone
        }

    } catch (error) {
        console.error('[Auth] Error:', error)
        return new Response(JSON.stringify({
            code: 401,
            message: '认证失败'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

/**
 * 可选认证（不强制，支持 userId 参数）
 */
export async function optionalAuth(request) {
    const authHeader = request.headers.get('Authorization')

    // 如果有 token，尝试验证
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)

        try {
            const supabase = request.supabase
            const { data: { user }, error } = await supabase.auth.getUser(token)

            if (!error && user) {
                request.user = {
                    id: user.id,
                    email: user.email,
                    phone: user.phone
                }
            }
        } catch (error) {
            // 忽略错误，继续执行
        }
    }

    // 不阻止请求
}

/**
 * SHA-256 哈希函数 (使用 Web Crypto API)
 * @param {string} password - 原始密码
 * @returns {Promise<string>} - 哈希后的十六进制字符串
 */
export async function hashPassword(password) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 验证认证并返回用户信息（用于API路由）
 */
export async function verifyAuth(request, env) {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { success: false, error: '未登录或登录已过期' }
    }

    const token = authHeader.substring(7)

    try {
        const supabase = request.supabase
        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            return { success: false, error: '登录已过期，请重新登录' }
        }

        // 查询用户详细信息（包括 is_admin）
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, username, is_admin, balance')
            .eq('id', user.id)
            .single()

        if (userError || !userData) {
            return { success: false, error: '用户不存在' }
        }

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                ...userData
            }
        }
    } catch (error) {
        console.error('[Auth] verifyAuth error:', error)
        return { success: false, error: '认证失败' }
    }
}

/**
 * 验证交易密码 (使用哈希比较)
 */
export async function verifyTransactionPassword(supabase, userId, password) {
    const { data: user, error } = await supabase
        .from('users')
        .select('transaction_password')
        .eq('id', userId)
        .single()

    if (error || !user) {
        return { valid: false, message: '用户不存在' }
    }

    if (!user.transaction_password) {
        return { valid: false, message: '请先设置交易密码' }
    }

    // 使用 SHA-256 哈希比较
    const hashedInput = await hashPassword(password)
    if (user.transaction_password !== hashedInput) {
        return { valid: false, message: '交易密码错误' }
    }

    return { valid: true }
}

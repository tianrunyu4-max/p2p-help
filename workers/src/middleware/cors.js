/**
 * CORS 中间件
 */

/**
 * 获取 CORS 响应头
 */
export function corsHeaders(env) {
    const origin = env?.CORS_ORIGIN || 'https://ai-airdrop.uk'

    // 注意：当 origin 为 '*' 时不能同时设置 Allow-Credentials: true（浏览器会拒绝）
    const isWildcard = origin === '*'

    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key',
        'Access-Control-Max-Age': '86400',
        ...(isWildcard ? {} : { 'Access-Control-Allow-Credentials': 'true' })
    }
}

/**
 * 处理 OPTIONS 预检请求
 */
export function handleCORS(request) {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(request.env)
    })
}

/**
 * 群链接管理路由
 *
 * GET  /api/groups        - 获取所有群链接（公开）
 * POST /api/groups/admin  - 更新群配置（管理员）
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/groups' })

function json(data, status = 200) {
    return Response.json(data, { status, headers: { 'Content-Type': 'application/json' } })
}

const GROUP_TYPES = ['whatsapp', 'wechat']
const SETTING_KEYS = ['qr_url', 'name', 'price', 'enabled']

/**
 * GET /api/groups - 获取所有群链接（公开）
 */
router.get('/', async (request) => {
    const { supabase } = request
    if (!supabase) return json({ code: 200, data: [] })

    const keys = GROUP_TYPES.flatMap(t => SETTING_KEYS.map(k => `group_${t}_${k}`))

    const { data } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', keys)

    const settings = {}
    if (data) {
        data.forEach(row => { settings[row.setting_key] = row.setting_value })
    }

    const groups = GROUP_TYPES
        .filter(type => settings[`group_${type}_enabled`] !== 'false')
        .map(type => ({
            type,
            name: settings[`group_${type}_name`] || (type === 'whatsapp' ? 'WhatsApp 群' : 'WeChat 群'),
            price: settings[`group_${type}_price`] || '免费',
            qr_url: settings[`group_${type}_qr_url`] || null
        }))

    return json({ code: 200, data: groups })
})

/**
 * POST /api/groups/admin - 更新群配置（需要 ENGINE_API_KEY）
 */
router.post('/admin', async (request) => {
    const { supabase, env } = request
    if (!supabase) return json({ code: 503, message: '服务不可用' }, 503)

    const apiKey = request.headers.get('X-API-Key')
    if (!apiKey || apiKey !== (env?.ENGINE_API_KEY || '').trim()) {
        return json({ code: 403, message: '无权限' }, 403)
    }

    const body = await request.json()
    const { type, name, price, qr_url, enabled } = body

    if (!type || !GROUP_TYPES.includes(type)) {
        return json({ code: 400, message: '无效的群类型' }, 400)
    }

    const updates = [
        { setting_key: `group_${type}_name`, setting_value: name || '' },
        { setting_key: `group_${type}_price`, setting_value: String(price ?? '免费') },
        { setting_key: `group_${type}_qr_url`, setting_value: qr_url || '' },
        { setting_key: `group_${type}_enabled`, setting_value: enabled !== false ? 'true' : 'false' }
    ]

    for (const row of updates) {
        await supabase
            .from('admin_settings')
            .upsert(row, { onConflict: 'setting_key' })
    }

    return json({ code: 200, message: '更新成功' })
})

export { router as groupRoutes }

/**
 * 社区消息路由 - 处理所有聊天消息
 */

import { Router } from 'itty-router'

const router = Router()

/**
 * 获取最近的消息列表（全局大厅或特定社群）
 * GET /api/community/messages
 */
router.get('/api/community/messages', async (request) => {
    const { supabase } = request
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const communityId = url.searchParams.get('communityId')

    // 只保留6分钟内的消息（阅后即焚）
    const sixMinutesAgo = Date.now() - 6 * 60 * 1000

    try {
        let query = supabase
            .from('messages')
            .select('*')
            .gte('timestamp', sixMinutesAgo)
            .order('timestamp', { ascending: false })
            .limit(limit)

        // 如果提供了 communityId，则过滤特定社群的消息
        // 否则获取全局大厅消息 (community_id IS NULL)
        if (communityId) {
            query = query.eq('community_id', communityId)
        } else {
            query = query.is('community_id', null)
        }

        const { data, error } = await query

        // 顺便执行定期清理超过6分钟的消息（非阻塞）
        if (request.ctx && request.ctx.waitUntil) {
            request.ctx.waitUntil(
                supabase.from('messages')
                    .delete()
                    .lt('timestamp', sixMinutesAgo)
                    .then(({ error }) => {
                        if (error) console.error('Cleanup error:', error)
                    })
            )
        }

        if (error) throw error

        const messages = (data || []).reverse().map(msg => ({
            id: msg.id,
            type: msg.type,
            content: msg.content,
            userId: msg.user_id,
            userName: msg.user_name || '用户',
            avatarUrl: msg.avatar_url || null,
            mediaType: msg.media_type,
            mediaUrl: msg.media_url,
            communityId: msg.community_id,
            timestamp: msg.timestamp,
            time: formatTime(msg.timestamp)
        }))

        return new Response(JSON.stringify({
            code: 200,
            data: messages
        }), {
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        return new Response(JSON.stringify({
            code: 500,
            message: '获取消息失败',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})

/**
 * 发送新消息
 * POST /api/community/messages
 */
router.post('/api/community/messages', async (request) => {
    const { supabase } = request
    const body = await request.json()

    if (!body.content) {
        return new Response(JSON.stringify({ code: 400, message: '消息内容不能为空' }), { status: 400 })
    }

    try {
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                type: body.type || 'user',
                content: body.content,
                user_id: body.userId || null,
                user_name: body.userName || '用户',
                avatar_url: body.avatarUrl || null,
                media_type: body.mediaType || null,
                media_url: body.mediaUrl || null,
                community_id: body.communityId || null, // 支持指定社群
                timestamp: Date.now()
            }])
            .select()
            .single()

        if (error) throw error

        return new Response(JSON.stringify({
            code: 200,
            data: {
                id: data.id,
                type: data.type,
                content: data.content,
                userId: data.user_id,
                userName: data.user_name || '用户',
                avatarUrl: data.avatar_url || null,
                mediaType: data.media_type,
                mediaUrl: data.media_url,
                communityId: data.community_id,
                timestamp: data.timestamp,
                time: formatTime(data.timestamp)
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        return new Response(JSON.stringify({
            code: 500,
            message: '发送消息失败',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})

/**
 * 创建新社群 (私聊或群聊)
 * POST /api/community/create
 */
router.post('/api/community/create', async (request) => {
    const { supabase } = request
    const body = await request.json()
    const { name, creatorId, targetUserId, type = 'private' } = body

    if (!creatorId || !targetUserId) {
        return new Response(JSON.stringify({ code: 400, message: '必须提供创建者ID和对方ID' }), { status: 400 })
    }

    try {
        // 1. 创建社群记录
        const { data: community, error: cError } = await supabase
            .from('communities')
            .insert([{
                name: name || `私聊-${targetUserId}`,
                creator_id: creatorId,
                type: type
            }])
            .select()
            .single()

        if (cError) throw cError

        // 2. 添加成员
        const members = [
            { community_id: community.id, user_id: creatorId },
            { community_id: community.id, user_id: targetUserId }
        ]

        const { error: mError } = await supabase
            .from('community_members')
            .insert(members)

        if (mError) throw mError

        return new Response(JSON.stringify({
            code: 200,
            data: community
        }), {
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        return new Response(JSON.stringify({
            code: 500,
            message: '创建社群失败',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})

/**
 * 获取当前用户的社群列表
 * GET /api/community/list
 */
router.get('/api/community/list', async (request) => {
    const { supabase } = request
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
        return new Response(JSON.stringify({ code: 400, message: '请提供用户ID' }), { status: 400 })
    }

    try {
        // 获取用户加入的所有社群
        const { data, error } = await supabase
            .from('community_members')
            .select(`
                community_id,
                communities (
                    id,
                    name,
                    type,
                    created_at
                )
            `)
            .eq('user_id', userId)

        if (error) throw error

        const communities = (data || []).map(item => item.communities)

        return new Response(JSON.stringify({
            code: 200,
            data: communities
        }), {
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        return new Response(JSON.stringify({
            code: 500,
            message: '获取社群列表失败',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})

/**
 * 删除消息（管理员功能）
 * DELETE /api/community/messages/:id
 */
router.delete('/api/community/messages/:id', async (request) => {
    const { supabase } = request
    const { id } = request.params

    // 简单的管理员验证（可以通过请求头传递管理员密钥）
    const adminKey = request.headers.get('X-Admin-Key')
    if (adminKey !== 'uae-admin-2024') {
        return new Response(JSON.stringify({ code: 403, message: '无权限' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', id)

        if (error) throw error

        return new Response(JSON.stringify({
            code: 200,
            message: '消息已删除'
        }), {
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        return new Response(JSON.stringify({
            code: 500,
            message: '删除失败',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})

/**
 * 格式化时间
 */
function formatTime(timestamp) {
    const date = new Date(timestamp)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
}

export const communityRoutes = router


/**
 * Supabase 消息服务
 * 管理与 Supabase messages 表的交互
 */

import { supabase, useRealSupabase, TABLES } from '../config/supabase'

/**
 * 获取消息列表（按时间倒序）
 * @param {number} limit - 消息数量限制
 * @param {string} communityId - 社群ID，为空表示全局大厅
 */
export async function fetchMessages(limit = 100, communityId = null) {
  // 生产环境或开发模式回退：使用 Worker API (推荐，因为 Worker 包含清理逻辑)
  try {
    // 获取 API 基础地址
    const apiBase = import.meta.env.VITE_API_URL || ''
    const url = communityId
      ? `${apiBase}/api/community/messages?limit=${limit}&communityId=${communityId}`
      : `${apiBase}/api/community/messages?limit=${limit}`
    const res = await fetch(url)
    const data = await res.json()
    if (data?.code === 200) {
      return data.data
    }
  } catch (error) {
    console.error('❌ 通过 API 获取消息失败:', error)
  }

  // 开发者备份：非生产环境且配置了 Supabase 时尝试直连
  if (useRealSupabase()) {
    try {
      let query = supabase
        .from(TABLES.MESSAGES)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (communityId) {
        query = query.eq('community_id', communityId)
      } else {
        query = query.is('community_id', null)
      }

      const { data, error } = await query
      if (error) throw error

      return data.map(msg => ({
        id: msg.id,
        type: msg.type,
        content: msg.content,
        userId: msg.user_id,
        userName: msg.user_name || '用户',
        avatarUrl: msg.avatar_url || null,
        mediaType: msg.media_type,
        mediaUrl: msg.media_url,
        communityId: msg.community_id,
        time: formatTime(msg.timestamp),
        timestamp: msg.timestamp
      }))
    } catch (error) {
      console.error('❌ 直连获取消息失败:', error)
    }
  }

  return []
}

/**
 * 添加新消息
 */
export async function addMessage(message) {
  const payload = {
    type: message.type || 'user',
    content: message.content,
    userId: message.userId || null,
    userName: message.userName || '用户',
    avatarUrl: message.avatarUrl || null,
    mediaType: message.mediaType || null,
    mediaUrl: message.mediaUrl || null,
    communityId: message.communityId || null // 新增支持 communityId
  }

  // 尝试使用 Worker API 发送消息
  try {
    const apiBase = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${apiBase}/api/community/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (data?.code === 200) {
      return data.data
    }
  } catch (error) {
    console.error('❌ 通过 API 添加消息失败:', error)
  }

  // 开发者备份
  if (useRealSupabase()) {
    try {
      const { data, error } = await supabase
        .from(TABLES.MESSAGES)
        .insert([{
          type: payload.type,
          content: payload.content,
          user_id: payload.userId,
          user_name: payload.userName,
          avatar_url: payload.avatarUrl,
          media_type: payload.mediaType,
          media_url: payload.mediaUrl,
          community_id: payload.communityId,
          timestamp: Date.now()
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('❌ 直连添加消息失败:', error)
    }
  }

  return null
}

/**
 * 创建新社群
 */
export async function createCommunity(name, creatorId, targetUserId, type = 'private') {
  try {
    const apiBase = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${apiBase}/api/community/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, creatorId, targetUserId, type })
    })
    const data = await res.json()
    return data?.code === 200 ? data.data : null
  } catch (error) {
    console.error('❌ 创建社群失败:', error)
    return null
  }
}

/**
 * 获取我的社群列表
 */
export async function fetchCommunities(userId) {
  try {
    const apiBase = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${apiBase}/api/community/list?userId=${userId}`)
    const data = await res.json()
    return data?.code === 200 ? data.data : []
  } catch (error) {
    console.error('❌ 获取社群列表失败:', error)
    return []
  }
}

/**
 * 删除消息（管理员功能）
 */
export async function deleteMessage(messageId, adminKey = 'uae-admin-2024') {
  try {
    const apiBase = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${apiBase}/api/community/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey
      }
    })
    const data = await res.json()
    return data?.code === 200
  } catch (error) {
    console.error('❌ 删除消息失败:', error)
    return false
  }
}

/**
 * 订阅消息实时更新
 */
export function subscribeToMessages(callback) {
  if (!useRealSupabase()) {
    console.log('📦 Mock 模式：跳过实时订阅')
    return () => { }
  }

  const subscription = supabase
    .channel('messages')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLES.MESSAGES },
      (payload) => {
        const newMessage = {
          id: payload.new.id,
          type: payload.new.type,
          content: payload.new.content,
          userId: payload.new.user_id,
          time: formatTime(payload.new.timestamp),
          timestamp: payload.new.timestamp
        }
        callback(newMessage)
      }
    )
    .subscribe()

  // 返回取消订阅函数
  return () => {
    subscription.unsubscribe()
  }
}

/**
 * 批量添加系统消息
 */
export async function addSystemMessages(messages) {
  if (!useRealSupabase()) {
    return []
  }

  try {
    const insertData = messages.map(msg => ({
      type: 'system',
      content: msg.content,
      user_id: null,
      timestamp: Date.now()
    }))

    const { data, error } = await supabase
      .from(TABLES.MESSAGES)
      .insert(insertData)
      .select()

    if (error) throw error

    return data
  } catch (error) {
    console.error('❌ 批量添加消息失败:', error)
    return []
  }
}

/**
 * 清理旧消息（保留最近N条）
 */
export async function cleanOldMessages(keepCount = 1000) {
  if (!useRealSupabase()) {
    return
  }

  try {
    // 获取要保留的最早消息的时间戳
    const { data, error } = await supabase
      .from(TABLES.MESSAGES)
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(keepCount)

    if (error) throw error

    if (data && data.length === keepCount) {
      const cutoffTimestamp = data[keepCount - 1].timestamp

      // 删除更早的消息
      const { error: deleteError } = await supabase
        .from(TABLES.MESSAGES)
        .delete()
        .lt('timestamp', cutoffTimestamp)

      if (deleteError) throw deleteError

      console.log(`✅ 已清理旧消息，保留最近 ${keepCount} 条`)
    }
  } catch (error) {
    console.error('❌ 清理旧消息失败:', error)
  }
}

/**
 * 格式化时间显示
 */
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export default {
  fetchMessages,
  addMessage,
  subscribeToMessages,
  addSystemMessages,
  cleanOldMessages
}


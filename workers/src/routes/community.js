/**
 * 社区消息路由
 * GET /api/community/messages  - 获取消息
 * POST /api/community/messages - 发送消息
 * POST /api/upload             - 上传文件（图片/头像/视频）
 * POST /api/ai/chat            - AI 对话
 * POST /api/chat/:bot          - 专属机器人
 */
import { getDB } from '../db.js'
import { ok, err } from '../utils/response.js'

// ── 上传文件 ──────────────────────────────────────────────────
export async function handleUpload(request, env, pathname) {
  if (pathname !== '/api/upload' || request.method !== 'POST') return null

  const db = getDB(env)
  const url = new URL(request.url)
  const fileType = url.searchParams.get('type') || 'image'

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return err('未找到文件')

    const allowed = {
      avatar: ['image/jpeg','image/png','image/webp','image/gif'],
      image:  ['image/jpeg','image/png','image/webp','image/gif'],
      video:  ['video/mp4','video/webm','video/quicktime']
    }
    if (!allowed[fileType]?.includes(file.type)) return err('不支持的文件类型: ' + file.type)

    const maxSize = { avatar: 2*1024*1024, image: 15*1024*1024, video: 50*1024*1024 }
    if (file.size > maxSize[fileType]) return err(`文件过大，最大 ${maxSize[fileType]/1024/1024}MB`)

    // 截图最小 30KB — 防止上传空白图、极小假图作弊
    if (fileType === 'image' && file.size < 30 * 1024) {
      return err('截图文件过小（至少30KB），请上传真实付款截图')
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const ts = Date.now()
    const rnd = Math.random().toString(36).substr(2, 6)
    const fileName = `${fileType}/${ts}_${rnd}.${ext}`

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const fileBuffer = await file.arrayBuffer()

    const { data, error } = await supabase.storage
      .from('p2p-media')
      .upload(fileName, fileBuffer, { contentType: file.type, upsert: false })

    if (error) return err('上传失败: ' + error.message)

    const { data: urlData } = supabase.storage.from('p2p-media').getPublicUrl(fileName)

    return ok({ path: data.path, url: urlData.publicUrl, type: fileType, name: file.name, size: file.size })
  } catch (e) {
    return err('上传错误: ' + e.message)
  }
}

// ── 社区消息 ──────────────────────────────────────────────────
export async function handleCommunity(request, env, pathname) {
  // GET 获取消息
  if (pathname === '/api/community/messages' && request.method === 'GET') {
    const db = getDB(env)
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '80')
    const sixMinAgo = Date.now() - 6 * 60 * 1000

    const { data, error } = await db.from('messages')
      .select('*')
      .gte('timestamp', sixMinAgo)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) return err('获取消息失败')

    const messages = (data || []).reverse().map(m => ({
      id: m.id, type: m.type, content: m.content,
      userId: m.user_id, userName: m.user_name || '用户',
      avatarUrl: m.avatar_url || null,
      mediaType: m.media_type, mediaUrl: m.media_url,
      timestamp: m.timestamp,
      time: formatTime(m.timestamp)
    }))

    // 异步清理旧消息
    db.from('messages').delete().lt('timestamp', sixMinAgo).then(() => {})

    return ok(messages)
  }

  // POST 发送消息
  if (pathname === '/api/community/messages' && request.method === 'POST') {
    const db = getDB(env)
    const body = await request.json()
    const { type = 'user', content, userId, userName, avatarUrl, mediaType, mediaUrl } = body

    if (!content && !mediaUrl) return err('消息内容不能为空')

    const { data, error } = await db.from('messages').insert({
      type, content, user_id: userId,
      user_name: userName || '用户',
      avatar_url: avatarUrl || null,
      media_type: mediaType || null,
      media_url: mediaUrl || null,
      timestamp: Date.now()
    }).select().single()

    if (error) return err('发送失败: ' + error.message)

    return ok({ id: data.id, time: formatTime(data.timestamp) })
  }

  return null
}

// ── AI 对话 ──────────────────────────────────────────────────
const AI_SYSTEM_PROMPT = `你是"1+1互助小助手"，1+1互助平台（p2p.ai-airdrop.uk）的专属智能客服。

【平台介绍】
平台名：1+1 互助
网址：p2p.ai-airdrop.uk
模式：P2P点对点互助，直接打款，全程透明

【如何激活（350元全部P2P点对点支付）】
- 见点奖100元：支付给店主
- 帮扶奖50×2元：支付给店主的2个直推
- 平级奖10×15层：沿推荐链向上15层每层10元
- 合计350元，最多匹配18人

【店铺模型】
- 店主（永久位）：永久收取见点奖100元，不出局
- 店长（流动位）：推满1人后出局，自动成为新店主
- 每人邀请码最多使用2次

【支付流程】
1. 注册填邀请码 → 2. 点激活 → 3. 系统匹配16-18人 → 4. 逐笔扫码付款 → 5. 截图确认 → 6. 全部完成激活成功

回答要简洁、友好，中文回复。`

export async function handleAI(request, env, pathname) {
  // POST /api/ai/chat
  if (pathname === '/api/ai/chat' && request.method === 'POST') {
    const { message, userId } = await request.json()
    if (!message) return err('消息不能为空')

    const reply = await callDeepSeek(message, AI_SYSTEM_PROMPT, env)
    return ok({ reply })
  }

  // POST /api/chat/:bot
  const botMatch = pathname.match(/^\/api\/chat\/(deepsook|ppx|healthx|lottery)$/)
  if (botMatch && request.method === 'POST') {
    const bot = botMatch[1]
    const { message } = await request.json()
    if (!message) return err('消息不能为空')

    const botPrompts = {
      deepsook: '你是"大龙虾 DeepSook"，1+1互助社区的采购顾问。专注于帮助用户了解互助模型、激活流程、收益规则。用幽默友好的方式回答，结尾加🦞。',
      ppx:      '你是"皮皮虾 PPX"，1+1互助社区的理财小专家。帮助用户分析P2P互助的投入产出、风险提示。结尾加🦐。',
      healthx:  '你是"养生虾 HealthX"，1+1互助社区的健康顾问。分享健康生活建议。结尾加🦀。',
      lottery:  '你是"彩球博士"，数字分析专家。帮助用户分析数字规律，娱乐为主，强调理性参与。结尾加🎱。'
    }

    const reply = await callDeepSeek(message, botPrompts[bot], env)
    return ok({ reply })
  }

  return null
}

// ── 工具函数 ──────────────────────────────────────────────────
async function callDeepSeek(message, systemPrompt, env) {
  try {
    const apiKey = env.DEEPSEEK_API_KEY
    if (!apiKey) return '（AI服务未配置）'

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(25000)
    })

    const data = await res.json()
    return data.choices?.[0]?.message?.content || '暂时无法回答，请稍后再试～'
  } catch (e) {
    return '⏱️ AI响应超时，请稍后再问～'
  }
}

function formatTime(ts) {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

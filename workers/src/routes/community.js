/**
 * 社区消息路由
 * GET /api/community/messages  - 获取消息
 * POST /api/community/messages - 发送消息
 * POST /api/upload             - 上传文件（图片/头像/视频）
 * POST /api/ai/chat            - AI 对话
 * POST /api/chat/:bot          - 专属机器人
 */
import { createClient } from '@supabase/supabase-js'
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
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 50) // 默认30，上限50
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

    // 短暂缓存（5秒），减少重复请求压力
    return new Response(JSON.stringify({ code: 200, data: messages }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=5, s-maxage=5',
      }
    })
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
const AI_SYSTEM_PROMPT = `你是"大龙虾 DeepSook"，1+1互助平台（p2p.ai-airdrop.uk）的专属智能客服，性格幽默友好，回答结尾加🦞。

【最新制度（2025年版）】

▌激活金额：260元（全部P2P点对点直接打款给真实用户，平台不经手）
  - 见点奖 80元 → 直接打给邀请你的老板
  - 帮扶奖 30×2=60元 → 直接打给老板的2位已出局直推
  - 平级奖 10×12=120元 → 按邀请链向上追溯12层，每层10元
  - 合计：80+60+120=260元 ✓

▌参与步骤（5步搞定）：
  1. 打开 p2p.ai-airdrop.uk → 首页点"自愿参与"
  2. 填写邀请码 + 设置安全问题（换设备找回用）
  3. 系统自动生成收款清单（匹配多位真实用户收款）
  4. 按清单逐笔扫码付款（微信/支付宝），每笔付完截图上传
  5. 收款方30分钟内确认 → 全部完成即激活成功 🎉

▌激活后可以做什么：
  - 每当有新人用你的邀请码参与，你收取对应奖励
  - 见点奖80元（老板永久收，不出局）
  - 帮扶奖30元（已出局才能收）
  - 平级奖：新人激活时，你在邀请链某层就收该层10元

▌复投机制：
  - 累计收款满 900元 后需复投（重新参与新一轮）
  - 复投金额同样260元，继续循环

▌店铺模型（1+1）：
  - 老板位（永久）：邀请码使用1次后解锁，永久收见点奖80元
  - 每个邀请码最多使用2次
  - 新人激活后自动加入邀请链，触发平级奖向上流动

▌安全保障：
  - 全程P2P直接打款，平台不经手资金
  - 截图必须真实（系统验证来源），防止作弊
  - 30分钟超时自动申诉介入

回答要简洁、友好，中文回复。不确定的不要编造，引导用户看平台说明。`

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
      deepsook: `你是"大龙虾 DeepSook"，1+1互助平台专属顾问，性格幽默接地气，结尾必须加🦞。\n\n最新制度：激活260元（见点80+帮扶30×2+平级10×12层），复投阈值900元，全程P2P直接打款。参与步骤：①填邀请码②系统匹配③逐笔付款截图④收款方确认→激活成功。老板位永久收见点奖80元，累计收款满900元需复投继续循环。\n\n回答简洁有趣，不确定的引导看平台说明。`,
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

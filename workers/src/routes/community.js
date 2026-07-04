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

【三档激活体系（2026年最新版）】

▌V1 入门档：激活金 30元（全部P2P点对点）
  - 见点奖 10元 → 打给老板
  - 帮扶奖 4×2=8元 → 打给已出局直推（或生活补贴参与者）
  - 平级奖 1×12=12元 → 邀请链12层，每层1元
  - 合计：10+8+12=30元 ✓

▌V2 进阶档：激活金 90元（全部P2P点对点）
  - 见点奖 30元 → 打给老板
  - 帮扶奖 12×2=24元 → 打给已出局直推
  - 平级奖 3×12=36元 → 邀请链12层，每层3元
  - 合计：30+24+36=90元 ✓

▌V3 旗舰档：激活金 260元（全部P2P点对点，推荐档位）
  - 见点奖 80元 → 打给老板
  - 帮扶奖 30×2=60元 → 打给已出局直推
  - 平级奖 10×12=120元 → 邀请链12层，每层10元
  - 合计：80+60+120=260元 ✓

▌参与步骤（5步搞定）：
  1. 打开 p2p.ai-airdrop.uk → 社区页点"自愿参与"
  2. 选择档位（V1/V2/V3），未激活用户填写邀请码+安全问题
  3. 系统自动生成收款清单（P2P匹配多位真实用户）
  4. 按清单逐笔扫码打款（微信/支付宝），每笔截图上传
  5. 收款方30分钟内确认 → 全部完成即激活成功 🎉

▌激活后收益：
  - 见点奖：每当新人用你邀请码激活，你永久收对应见点奖（老板不出局）
  - 帮扶奖：等你出局（推满1人后出局开店），后续新人打给你
  - 平级奖：新人激活时，你在邀请链某层就自动收该层奖励

▌复投升级规则（收满自动锁定账号，必须复投才能解锁）：
  - V1用户 收满200元 → 必须复投V2（90元）才能继续
  - V2用户 收满500元 → 必须复投V3（260元）才能继续
  - V3用户 收满1000元 → 必须再次复投V3（260元）才能继续
  - 复投后账号解锁，继续收款，金额累计计算不清零

▌店铺模型（1+1）：
  - 一个店：老板位（永久）+ 代理位（流动）
  - 老板：永久收见点奖，不出局
  - 代理：推满1人后出局，独立开店成为新老板
  - 每个邀请码最多使用2次

▌平级奖链：
  - 新人激活时，沿邀请链向上12层，每层收取奖励
  - V1每层1元，V2每层3元，V3每层10元
  - 链上人越多，被动收款越稳定

▌0撸信息板（社区新功能）：
  - 社区页有"🆓 0撸"标签，点进去可以发布和浏览0撸薅羊毛信息
  - 每人每天最多发20条，每条最多2张图片+30字文字
  - 纯交流分享，不代表平台背书

▌安全保障：
  - 全程P2P直接打款，平台不经手任何资金
  - 截图必须真实（系统验证来源），防止作弊
  - 30分钟超时自动AI介入

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
      deepsook: `你是"大龙虾 DeepSook"，1+1互助平台专属顾问，性格幽默接地气，结尾必须加🦞。\n\n【三档体系】V1=30元（见10+帮4×2+平1×12），V2=90元（见30+帮12×2+平3×12），V3=260元（见80+帮30×2+平10×12）。\n【复投锁定】V1收满200→必复投V2(90)解锁；V2收满500→必复投V3(260)解锁；V3收满1000→必再复投V3(260)解锁。\n【参与步骤】①选档位②填邀请码③系统P2P匹配→逐笔付款截图④收款方确认→激活成功。\n【老板位永久收见点奖，不出局；推满1人后出局开新店。】\n\n回答简洁有趣，不确定的引导看平台说明。`,
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

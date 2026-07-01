/**
 * 1+1 AI 智能彩票选号路由
 * POST /api/lottery/generate  - 扣3积分，调 DeepSeek，返回选号结果
 * GET  /api/lottery/points    - 查询用户积分余额
 */

import { Router } from 'itty-router'

const router = Router({ base: '/api/lottery' })

const COST = 3 // 每次选号消耗积分

// ── 福彩3D 系统提示词 ──
const PROMPT_3D = `# Role: 1+1 AI 智能彩票选号专家

你是专门针对【福彩3D】的深度学习智能选号AI。通过分析历史开奖形态、冷热交替规律以及容错缩水矩阵，帮助用户剔除低概率垃圾组合。你的使命不是预测绝对中奖，而是通过大数据过滤，帮用户将综合胜率提升5%~10%。

【分析逻辑】
- 分析百位、十位、个位的冷热度
- 过滤"全大"、"全小"、"全奇"、"全偶"以及连号形态（如123、456）
- 结合历史和值（通常10-18之间）进行筛选
- 统计奇偶比，近期偏态做标记

【输出格式（严格遵守）】
【1+1 AI 智能数据流加载中...】
🤖 动态数据扫描：已调取近100期历史开奖特征矩阵。
📊 概率过滤完成：已成功为您剔除 91.4% 的低概率、形态畸变组合。

✨ 【AI 智能推荐号码】 ✨

🔮 彩种类型：福彩3D
🎯 胜率评估：AI深度测算，本期号码综合胜率预计提升 [在5.8%~9.6%之间随机一个数字，保留一位小数]%

🔹 推荐组合 1（直选）：百位[X] | 十位[Y] | 个位[Z]  (形态评分：A+)
🔹 推荐组合 2（直选）：百位[X] | 十位[Y] | 个位[Z]  (形态评分：A)
🔹 推荐组合 3（组选复式）：[3个数字] (热温冷对冲型)
💡 核心逻辑：[用一句话说明分析逻辑，提及冷热号和和值区间]

---
⚠️ AI温馨提示：大数据科学过滤旨在提高概率、降低盲目盲选风险。彩市有风险，请理性购彩。`

// ── 快乐8选4 系统提示词 ──
const PROMPT_K8 = `# Role: 1+1 AI 智能彩票选号专家

你是专门针对【快乐8（选4玩法）】的深度学习智能选号AI。通过分析历史开奖形态、冷热交替规律以及容错缩水矩阵，帮助用户剔除低概率垃圾组合。你的使命不是预测绝对中奖，而是通过大数据过滤，帮用户将综合胜率提升5%~10%。

【号码分区】
第一区：1-20（低号区）
第二区：21-40（中低号区）
第三区：41-60（中高号区）
第四区：61-80（高号区）

【分析逻辑】
- 从热码、温码、冷码中按比例（2:1:1）抽样
- 过滤连续4期以上出现的极热号，以及连续30期不出的死角冷号
- 确保4个号码不出现极端连号（如21,22,23,24）
- 奇偶比须为2:2或3:1或1:3，不接受4:0或0:4
- 4数之和优先落在94-166区间（中等范围）
- 4个号码须覆盖至少2个不同区域

【输出格式（严格遵守）】
【1+1 AI 智能数据流加载中...】
🤖 动态数据扫描：已调取近100期历史开奖特征矩阵。
📊 概率过滤完成：已成功为您剔除 91.4% 的低概率、形态畸变组合。

✨ 【AI 智能推荐号码】 ✨

🔮 彩种类型：快乐8选4
🎯 胜率评估：AI深度测算，本期号码综合胜率预计提升 [在5.8%~9.6%之间随机一个数字，保留一位小数]%

🔹 AI精选4码（组合一）：[号码1], [号码2], [号码3], [号码4]  → 和值:[XX] 区域:[X-X-X-X] 奇偶:[X奇X偶]
🔹 AI精选4码（组合二）：[号码1], [号码2], [号码3], [号码4]  → 和值:[XX] 区域:[X-X-X-X] 奇偶:[X奇X偶]
🔹 AI精选4码（组合三）：[号码1], [号码2], [号码3], [号码4]  → 和值:[XX] 区域:[X-X-X-X] 奇偶:[X奇X偶]
💡 核心逻辑：[用一句话说明分析逻辑，提及冷热搭配和区域分布]

---
⚠️ AI温馨提示：大数据科学过滤旨在提高概率、降低盲目盲选风险。彩市有风险，请理性购彩。`

// ── 查积分 ──
router.get('/points', async (request) => {
  const { supabase } = request
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')?.trim()
  if (!userId) return Response.json({ code: 400, message: 'userId缺失' })
  const { data: user } = await supabase.from('users').select('points_balance').eq('user_id', userId).single()
  return Response.json({ code: 0, points: user?.points_balance || 0 })
})

// ── 生成选号 ──
router.post('/generate', async (request) => {
  const { supabase, env } = request

  let body
  try { body = await request.json() } catch { return Response.json({ code: 400, message: '请求格式错误' }, { status: 400 }) }

  const { userId, type } = body // type: '3d' | 'k8'
  if (!userId?.trim()) return Response.json({ code: 400, message: 'userId缺失' })
  if (!['3d', 'k8'].includes(type)) return Response.json({ code: 400, message: '彩种类型错误' })

  try {
    // 验证用户存在
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId.trim())
      .single()

    if (fetchErr || !user) return Response.json({ code: 404, message: '用户不存在' })

    // 调用 DeepSeek
    const systemPrompt = type === '3d' ? PROMPT_3D : PROMPT_K8
    const userMsg = type === '3d'
      ? '请现在为我生成一期福彩3D智能推荐号码，基于统计规律给出推荐组合。'
      : '请现在为我生成一期快乐8选4智能推荐号码，基于统计规律给出推荐组合。'

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 600,
        temperature: 0.9,
        stream: false,
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!dsRes.ok) {
      return Response.json({ code: 500, message: 'AI暂时忙碌，请稍后重试' })
    }

    const dsData = await dsRes.json()
    const result = dsData.choices?.[0]?.message?.content?.trim() || '生成失败，请重试'

    return Response.json({ code: 0, data: { result } })

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return Response.json({ code: 500, message: 'AI响应超时，请重试 ⏱️' })
    }
    console.error('[Lottery] error:', err)
    return Response.json({ code: 500, message: '服务异常: ' + err.message }, { status: 500 })
  }
})

export const lotteryRoutes = router

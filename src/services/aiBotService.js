/**
 * AI 机器人服务
 * 基于 DeepSeek API 的智能对话，替代原有关键词匹配
 */

/**
 * 判断是否应该触发AI回复
 * 过滤掉纯粹的社交噪音（连续数字、单个表情等）
 * 注意：DeepSeek会自己判断如何回应，这里只做最基础的过滤
 * @param {string} message
 * @returns {boolean}
 */
export function isAIQuestion(message) {
  if (!message || typeof message !== 'string') return false
  const msg = message.trim()
  // 过滤太短的消息（1个字）
  if (msg.length < 2) return false
  // 过滤纯数字（如666、888、999）
  if (/^\d+$/.test(msg)) return false
  // 过滤纯表情（如👍👍👍）
  if (/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}]+$/u.test(msg)) return false
  return true
}

/**
 * 调用后端 DeepSeek API 获取AI回复（异步）
 * @param {string} message - 用户消息
 * @param {string|null} userId - 用户ID（用于保存对话上下文）
 * @returns {Promise<string|null>} - AI回复内容
 */
export async function getAIResponse(message, userId = null) {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userId }),
      signal: AbortSignal.timeout(28000)
    })

    const data = await response.json()

    if (data.code === 200 && data.data?.reply) {
      return data.data.reply
    }

    console.warn('[AI] 后端返回异常:', data)
    return null
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return '⏱️ AI响应超时，请稍后再问～'
    }
    console.error('[AI] 请求失败:', error)
    return null
  }
}

/**
 * 获取AI欢迎消息（首次进入时显示）
 * @returns {string}
 */
export function getAIWelcome() {
  return `<b>👋 欢迎来到爱AI平台！</b><br/><br/>
我是 AI 顾问，有任何问题随时问我～<br/><br/>
您可以问：<b>参与、1+1模式、合伙人、AI公益</b> 等关键词快速了解 🚀`
}

export default {
  isAIQuestion,
  getAIResponse,
  getAIWelcome
}

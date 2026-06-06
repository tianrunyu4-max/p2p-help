export function isAIQuestion(message) {
  if (!message || typeof message !== 'string') return false
  const msg = message.trim()
  if (msg.length < 2) return false
  if (/^\d+$/.test(msg)) return false
  return true
}

import { apiUrl } from '../utils/apiBase.js'

export async function getAIResponse(message, userId = null) {
  try {
    const res = await fetch(apiUrl('/api/ai/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userId }),
      signal: AbortSignal.timeout(28000)
    })
    const data = await res.json()
    return data.code === 200 ? data.data.reply : null
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') return '⏱️ AI响应超时，请稍后再问～'
    return null
  }
}

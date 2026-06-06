/**
 * 获取API基础URL
 * - 浏览器/APK（server.url模式）：页面已从 p2p.ai-airdrop.uk 加载，用相对路径
 * - 本地开发（localhost）：用绝对路径
 */
const BASE = (
  window.location.hostname === 'localhost' ||
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'file:'
) ? 'https://p2p.ai-airdrop.uk' : ''

export function apiUrl(path) {
  return BASE + path
}

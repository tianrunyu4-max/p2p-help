/**
 * 获取API基础URL
 * - 浏览器/Web：相对路径（''）
 * - Capacitor Android：https://p2p.ai-airdrop.uk
 */
const BASE = (
  window.location.hostname === 'localhost' ||
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'file:' ||
  (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.())
) ? 'https://p2p.ai-airdrop.uk' : ''

export function apiUrl(path) {
  return BASE + path
}

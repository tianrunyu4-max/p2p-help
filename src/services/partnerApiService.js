/**
 * 合伙人API服务
 * 使用 apiRequest (ENGINE_API_KEY) + ?userId=xxx 查询参数
 */

import { apiRequest } from '../config/api.js'

function getUserId() {
  return localStorage.getItem('chatUserId') || localStorage.getItem('communityId') || localStorage.getItem('userId') || ''
}

/**
 * 检查合伙人资格
 */
export async function checkPartnerEligibility() {
  const userId = getUserId()
  const data = await apiRequest(`/partner/eligibility?userId=${userId}`)
  if (data.code !== 200) throw new Error(data.message || '检查资格失败')
  return data.data
}

/**
 * 获取合伙人信息 - 映射后端字段到 Team.vue 期望的格式
 */
export async function getPartnerInfo() {
  const userId = getUserId()
  const data = await apiRequest(`/partner/info?userId=${userId}`)
  if (data.code !== 200) throw new Error(data.message || '获取信息失败')
  const d = data.data
  return {
    isPartner: d.isPartner,
    directPushCount: d.directPush,
    teamCount: d.teamSize || 0,
    wechatNumber: d.wechatNumber || null,
    qualifiedAt: null,
    progress: {
      directPushProgress: d.directPush,
      teamProgress: d.teamSize || 0
    }
  }
}

/**
 * 获取分红统计 - 映射后端字段到 Team.vue 期望的格式
 */
export async function getPartnerDividends() {
  const userId = getUserId()
  const data = await apiRequest(`/partner/dividends?userId=${userId}`)
  if (data.code !== 200) throw new Error(data.message || '获取分红失败')
  const d = data.data
  return {
    today: d.todayEarnings || 0,
    thisMonth: d.thisMonthEarnings || 0,
    total: d.totalEarnings || 0,
    estimatedTomorrow: 0,
    calculation: {
      yesterdayTotal: 0,
      partnerCount: 0,
      dividendPool: 0
    }
  }
}

/**
 * 保存微信联系方式
 */
export async function savePartnerContact(wechatNumber) {
  const userId = getUserId()
  const res = await fetch('/api/partner/save-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, wechatNumber })
  })
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.message || '保存失败')
  return data
}

/**
 * 合伙人API服务对象
 */
export const partnerApiService = {
  checkEligibility: checkPartnerEligibility,
  getInfo: getPartnerInfo,
  getDividends: getPartnerDividends,
  saveContact: savePartnerContact
}

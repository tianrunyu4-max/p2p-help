/**
 * 签到服务（Supabase 版）
 * 所有签到状态持久化到后端，不再依赖 localStorage
 */

import { apiRequest } from '../config/api.js'
import { getDeviceSecret } from '../utils/auth.js'

class CheckinService {
  /**
   * 用户签到
   * @param {String} userId - 用户ID
   * @param {Object} userInfo - 用户信息（向后兼容，后端自行从 DB 读取）
   */
  async checkin(userId, userInfo) {
    try {
      const data = await apiRequest('/engine/checkin', {
        method: 'POST',
        body: { userId },
        headers: { 'X-Device-Secret': getDeviceSecret() }
      })
      return data
    } catch (error) {
      console.error('签到失败:', error)
      return { success: false, message: error.message || '签到失败' }
    }
  }

  /**
   * 使用优惠券
   * @param {String} userId - 用户ID
   * @param {Number} count - 使用数量
   */
  async useCoupon(userId, count = 1) {
    try {
      const data = await apiRequest('/engine/checkin/use-coupon', {
        method: 'POST',
        body: { userId, count },
        headers: { 'X-Device-Secret': getDeviceSecret() }
      })
      if (!data.success) throw new Error(data.message || '使用优惠券失败')
      return data
    } catch (error) {
      console.error('使用优惠券失败:', error)
      throw error
    }
  }

  /**
   * 获取用户签到信息
   * @param {String} userId - 用户ID
   */
  async getUserCheckinInfo(userId) {
    try {
      const data = await apiRequest(`/engine/checkin/${userId}`)
      if (data.success) return data
      return this.getDefaultInfo()
    } catch (error) {
      console.error('获取签到信息失败:', error)
      return this.getDefaultInfo()
    }
  }

  /**
   * 清空用户所有优惠券并重置签到（被帮扶后调用）
   * @param {String} userId - 用户ID
   */
  async clearCouponsAfterHelp(userId) {
    try {
      // 使用所有优惠券（先查询数量再全部使用）
      const info = await this.getUserCheckinInfo(userId)
      if (info.coupons > 0) {
        await this.useCoupon(userId, info.coupons)
      }
      return { success: true, clearedCoupons: info.coupons || 0, message: '优惠券已清空，请重新签到获取' }
    } catch (error) {
      console.error('清空优惠券失败:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 默认签到信息（请求失败时使用）
   */
  getDefaultInfo() {
    return {
      lastCheckinDate: null,
      consecutiveDays: 0,
      totalCheckins: 0,
      coupons: 0,
      canCheckinToday: true
    }
  }

  // ==================== 向后兼容（同步方法包装） ====================

  /**
   * @deprecated 使用 getUserCheckinInfo(userId) 替代
   */
  getCheckinInfo(userId) {
    console.warn('[CheckinService] getCheckinInfo 已废弃，请使用 async getUserCheckinInfo')
    return this.getDefaultInfo()
  }
}

// ==================== 单例模式 ====================

let checkinServiceInstance = null

export function getCheckinService() {
  if (!checkinServiceInstance) {
    checkinServiceInstance = new CheckinService()
  }
  return checkinServiceInstance
}

export function resetCheckinService() {
  checkinServiceInstance = null
}

export default CheckinService

/**
 * 全局用户状态 Store
 * 单一数据源：所有页面共享，App 启动时加载一次
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiRequest } from '../config/api.js'
import { getOrCreateUserId } from '../utils/auth.js'

export const useUserStore = defineStore('user', () => {
    // ── 状态 ──────────────────────────────────────────
    const userId = ref(getOrCreateUserId())
    // 从 localStorage 缓存恢复（确保弹窗打开时数据就绪，避免时序竞争）
    const isActivated = ref(localStorage.getItem('cachedIsActive') === 'true')
    const cardType = ref(localStorage.getItem('cachedCardType') || null)  // 'BASIC'|'PREMIUM'|'ELITE'|'TIER_300'|'TIER_500'|'TIER_1000'|null
    const inviteCode = ref(null)
    const balance = ref(0)
    const helpBalance = ref(0)            // 帮扶收益（只可用于参团/激活，不可直提）
    const couponCount = ref(0)            // 拼团券张数
    const profitBalance = ref(0)          // 分润余额（V4/V5/V6）
    const repurchaseBalance = ref(0)      // 复购余额（可用于兑换积分）
    const isAdmin = ref(false)
    const isPartner = ref(false)
    const userRole = ref(null)
    const isLoading = ref(false)
    const isInitialized = ref(false) // 是否已从后端拉过一次

    // ── 计算属性 ──────────────────────────────────────
    const cardLabel = computed(() => {
        const map = { BASIC: 'V1', PREMIUM: 'V2', ELITE: 'V3', TIER_300: 'V4', TIER_500: 'V5', TIER_1000: 'V6' }
        return cardType.value ? map[cardType.value] || cardType.value : null
    })

    const identityBadge = computed(() => {
        if (isAdmin.value) return { label: '系统', color: '#e53935', bg: '#ffebee' }
        if (userRole.value === 'owner') return { label: '老板', color: '#f57c00', bg: '#fff3e0' }
        if (isPartner.value) return { label: '代理', color: '#1976d2', bg: '#e3f2fd' }
        if (!isActivated.value) return { label: '游客', color: '#757575', bg: '#f5f5f5' }
        return null
    })

    // ── 内部：写缓存 ──────────────────────────────────
    function _saveCache(data) {
        localStorage.setItem('cachedIsActive', data.isActivated ? 'true' : 'false')
        // 缓存 cardType，下次启动时立即恢复（解决弹窗打开时 cardType 为 null 的时序问题）
        if (data.cardType) {
            localStorage.setItem('cachedCardType', data.cardType)
        } else if (!data.isActivated) {
            localStorage.removeItem('cachedCardType')
        }
        if (data.inviteCode) {
            localStorage.setItem('cachedInviteCode', data.inviteCode)
        } else if (!data.isActivated) {
            localStorage.removeItem('cachedInviteCode')
        }
    }

    // ── 检测到 DB 被清除后的重置标志 ──────────────────
    const wasReset = ref(false)  // true = DB 被清除，账号需要重新激活

    // ── 从后端拉取用户完整状态 ─────────────────────────
    async function fetchUserStatus() {
        const id = userId.value
        if (!id) return
        isLoading.value = true
        const prevActivated = isActivated.value
        const prevBalance = balance.value
        try {
            const res = await apiRequest(`/redeem/status/${id}`)
            if (res.code === 200) {
                const d = res.data
                const newActivated = d.isActivated === true
                const newBalance = parseFloat(d.balance || 0)

                // 检测 DB 被清除：之前是激活状态，现在变为未激活且余额归零
                if (isInitialized.value && prevActivated && !newActivated && newBalance === 0) {
                    wasReset.value = true
                    // 彻底清除本地缓存
                    localStorage.removeItem('cachedIsActive')
                    localStorage.removeItem('cachedCardType')
                    localStorage.removeItem('cachedInviteCode')
                    console.warn('[userStore] 检测到账号数据已重置（DB清除）')
                }

                isActivated.value = newActivated
                cardType.value = d.cardType || null
                inviteCode.value = d.inviteCode || null
                balance.value = newBalance
                isAdmin.value = d.isAdmin === true
                isPartner.value = d.isPartner === true
                userRole.value = d.role || null
                isInitialized.value = true
                _saveCache(d)
            }
            // 同步拉取分润余额 + 复购余额（所有激活用户）
            if (isActivated.value) {
                try {
                    const sub = await apiRequest(`/subscription/status/${userId.value}`)
                    if (sub.code === 200 && sub.data) {
                        profitBalance.value = parseFloat(sub.data.profitBalance) || 0
                        repurchaseBalance.value = parseFloat(sub.data.repurchaseBalance) || 0
                        helpBalance.value = parseFloat(sub.data.helpBalance) || 0
                        couponCount.value = sub.data.couponCount || 0
                    }
                } catch (e) { /* 余额加载失败不阻断主流程 */ }
            } else {
                profitBalance.value = 0
                repurchaseBalance.value = 0
                helpBalance.value = 0
                couponCount.value = 0
            }
        } catch (e) {
            // 网络异常：保持初始 false，不从 localStorage 恢复
            console.warn('[userStore] fetchUserStatus 失败，保持未激活状态:', e?.message)
        } finally {
            isLoading.value = false
        }
    }

    function clearResetFlag() {
        wasReset.value = false
    }

    // ── 激活成功后直接更新（不需要再请求后端）─────────────
    function setActivated(data) {
        isActivated.value = true
        cardType.value = data.planType || null
        if (data.inviteCode) inviteCode.value = data.inviteCode
        _saveCache({ isActivated: true, cardType: cardType.value, inviteCode: inviteCode.value })
    }

    // ── 余额变动（签到 / 转账后）──────────────────────────
    function addBalance(amount) {
        balance.value = parseFloat((balance.value + amount).toFixed(2))
    }

    function setBalance(amount) {
        balance.value = parseFloat(amount)
    }

    // ── 分润余额更新 ──────────────────────────────────
    function setProfit(amount) {
        profitBalance.value = parseFloat(amount) || 0
    }

    // ── 退出时重置 ────────────────────────────────────
    function reset() {
        isActivated.value = false
        cardType.value = null
        inviteCode.value = null
        balance.value = 0
        helpBalance.value = 0
        couponCount.value = 0
        profitBalance.value = 0
        repurchaseBalance.value = 0
        isInitialized.value = false
        localStorage.removeItem('cachedIsActive')
        localStorage.removeItem('cachedCardType')
        localStorage.removeItem('cachedInviteCode')
    }

    return {
        // state
        userId, isActivated, cardType, inviteCode, balance, helpBalance, couponCount, profitBalance, repurchaseBalance,
        isAdmin, isPartner, userRole,
        isLoading, isInitialized, wasReset,
        // computed
        cardLabel, identityBadge,
        // actions
        fetchUserStatus, setActivated, addBalance, setBalance, setProfit, reset, clearResetFlag
    }
})

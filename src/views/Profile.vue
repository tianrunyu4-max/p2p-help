<template>
  <div class="profile-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">{{ t('profile.title') }}</h1>
      <button class="refresh-btn" @click="refreshAll" :class="{ spinning: isRefreshing }" title="刷新">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/>
        </svg>
      </button>
    </div>
    
    <!-- 登录状态区域已移除 -->
    
    <!-- 用户信息卡片 -->
    <div class="user-info-card">
      <div class="user-avatar" @click="refreshAvatar">
        <img v-if="userAvatar" :src="userAvatar" class="avatar-img" alt="头像" />
        <span v-else class="avatar-placeholder">{{ userNameInitial }}</span>
      </div>
      <div class="user-details">
        <div class="user-name-row">
          <span class="user-name">{{ displayUserName }}</span>
          <button class="edit-name-btn" @click="showEditNameModal = true">✏️</button>
          <button class="switch-id-btn" @click="showSwitchModal = true">切换ID</button>
          <button class="switch-id-btn sec-btn" @click="!securityIsSet && (showSecuritySetupModal = true)" :style="securityIsSet ? 'background:#f0fff4;color:#16a34a;cursor:default' : ''">{{ securityIsSet ? '🔒已设置' : '🔐安全' }}</button>
        </div>
        <!-- 激活状态：加载中时显示骨架，避免闪烁"未激活" -->
        <div v-if="isLoadingUserStatus" class="user-status loading">
          <span class="status-skeleton"></span>
        </div>
        <div v-else class="user-status" :class="isUserActivated ? 'activated' : 'not-activated'">
          {{ isUserActivated ? t('sidebar.activated') : ('⚠️ ' + t('profile.notActivated')) }}
        </div>
        <!-- 邀请码显示 -->
        <div class="invite-code-row" :class="{ inactive: !isLoadingUserStatus && !isUserActivated }">
          <span class="invite-code-label">邀请码：</span>
          <span v-if="isLoadingUserStatus" class="invite-code-value">
            <span class="status-skeleton" style="width:80px"></span>
          </span>
          <span v-else class="invite-code-value">{{ isUserActivated ? invitationCode : t('profile.inviteCodeVisible') }}</span>
          <button v-show="!isLoadingUserStatus && isUserActivated" class="copy-code-btn" @click="handleCopyInviteCode">📋</button>
        </div>
        <div class="invite-usage-hint" v-if="isUserActivated && !isLoadingUserStatus">
          已使用 {{ directPushCount }}/2 次（每人最多邀请2位）
        </div>
      </div>
    </div>
    
    <!-- 切换账号弹窗 -->
    <div v-if="showSwitchModal" class="modal-overlay" @click.self="closeSwitchModal">
      <div class="edit-name-modal">
        <div class="modal-header">
          <span>切换账号</span>
          <button class="close-btn" @click="closeSwitchModal">×</button>
        </div>

        <!-- Step 1: 输入ID -->
        <template v-if="switchStep === 1">
          <p style="font-size:13px;color:#666;margin:0 0 12px;line-height:1.5">
            输入目标账号 ID，确认后立即切换
          </p>
          <input
            v-model="switchId"
            type="text"
            inputmode="numeric"
            class="name-input"
            placeholder="输入对方账号ID"
          />
          <button class="save-name-btn" :disabled="isSwitchChecking" @click="handleSwitchAccount">
            {{ isSwitchChecking ? '验证中...' : '下一步' }}
          </button>
        </template>

        <!-- Step 2: 目标账号设了安全问题，需要验证 -->
        <template v-else>
          <p style="font-size:13px;color:#333;font-weight:600;margin:0 0 8px;line-height:1.5">
            🔐 {{ switchSecQuestion }}
          </p>
          <p style="font-size:12px;color:#999;margin:0 0 12px">该账号已开启安全保护，请回答安全问题</p>
          <input
            v-model="switchSecAnswer"
            type="text"
            class="name-input"
            placeholder="请输入答案"
            style="margin-bottom:12px"
          />
          <button class="save-name-btn" :disabled="isSwitchChecking" @click="handleSwitchVerify">
            {{ isSwitchChecking ? '验证中...' : '确认切换' }}
          </button>
          <button style="margin-top:8px;background:none;border:none;color:#999;font-size:12px;cursor:pointer;width:100%;text-align:center" @click="switchStep = 1">← 返回</button>
          <p style="margin-top:4px;font-size:11px;color:#bbb;text-align:center">忘记答案请联系客服处理</p>
        </template>
      </div>
    </div>

    <!-- 修改昵称弹窗 -->
    <div v-if="showEditNameModal" class="modal-overlay" @click.self="showEditNameModal = false">
      <div class="edit-name-modal">
        <div class="modal-header">
          <span>修改昵称</span>
          <button class="close-btn" @click="showEditNameModal = false">×</button>
        </div>
        <input 
          v-model="newUserName" 
          type="text" 
          class="name-input" 
          placeholder="输入新昵称（2-20字符）"
          maxlength="20"
        />
        <button class="save-name-btn" @click="saveUserName">保存</button>
      </div>
    </div>
    
    <!-- 转账弹窗 -->
    <div v-if="showTransferModal" class="modal-overlay" @click.self="closeTransferModal">
      <div class="transfer-modal">
        <div class="modal-header">
          <span>余额互转</span>
          <button class="close-btn" @click="closeTransferModal">×</button>
        </div>

        <!-- Step 1: 填写转账信息 -->
        <template v-if="transferStep === 1">
          <div class="transfer-balance">
            <span>可用余额</span>
            <span class="balance-value">{{ userBalance }}</span>
          </div>

          <div class="transfer-form">
            <div class="form-group">
              <label>对方用户ID</label>
              <input
                v-model="transferToId"
                type="text"
                placeholder="输入对方ID"
              />
            </div>

            <div class="form-group">
              <label>转账金额</label>
              <input
                v-model.number="transferAmount"
                type="number"
                placeholder="最低10"
                min="10"
              />
            </div>
          </div>

          <button
            class="transfer-submit-btn"
            :disabled="isTransferring"
            @click="handleTransferStepOne">
            {{ isTransferring ? '验证中...' : '下一步' }}
          </button>
        </template>

        <!-- Step 2: 安全验证 -->
        <template v-else>
          <p style="font-size:13px;color:#333;font-weight:600;margin:0 0 8px;line-height:1.5">
            🔐 {{ transferSecQuestion }}
          </p>
          <input
            v-model="transferSecAnswer"
            type="text"
            class="name-input"
            placeholder="请输入答案"
            style="margin-bottom:12px"
          />
          <button
            class="transfer-submit-btn"
            :disabled="isTransferring"
            @click="handleTransfer">
            {{ isTransferring ? '验证中...' : '确认转账' }}
          </button>
          <button style="margin-top:8px;background:none;border:none;color:#999;font-size:12px;cursor:pointer;width:100%;text-align:center" @click="transferStep = 1">← 返回</button>
          <p style="margin-top:4px;font-size:11px;color:#bbb;text-align:center">忘记答案请联系客服处理</p>
        </template>
      </div>
    </div>
    

    <!-- 安全问题设置弹窗 -->
    <div v-if="showSecuritySetupModal" class="modal-overlay" @click.self="showSecuritySetupModal = false">
      <div class="edit-name-modal">
        <div class="modal-header">
          <span>🔐 设置安全问题</span>
          <button class="close-btn" @click="showSecuritySetupModal = false">×</button>
        </div>
        <p style="font-size:12px;color:#999;margin:0 0 14px;line-height:1.6">
          安全问题用于保护账号安全，他人切换你的ID和余额互转时均需验证。请如实填写并牢记答案。
        </p>
        <label style="font-size:13px;color:#333;display:block;margin-bottom:4px">身份证后6位是什么？</label>
        <input
          v-model="secQ1Answer"
          type="text"
          class="name-input"
          placeholder="请输入答案"
          style="margin-bottom:4px"
        />
        <button class="save-name-btn" :disabled="isSavingSecurity" @click="handleSaveSecurity">
          {{ isSavingSecurity ? '保存中...' : '保存安全问题' }}
        </button>
      </div>
    </div>

    <!-- 收益概览 -->
    <div class="earnings-overview">
      <div class="overview-label">{{ t('profile.productIncome') }}</div>
      <div class="overview-amount">{{ latestEarnings }}</div>
      <div class="overview-divider">|</div>
      <div class="overview-label">{{ t('profile.productBalance') }}</div>
      <div class="overview-amount highlight">{{ totalEarnings }}</div>
    </div>

    <!-- 余额卡片（紧凑版） -->
    <div class="balance-card">
      <div class="balance-header">
        <span class="balance-title">{{ t('profile.myBalance') }}</span>
        <button class="transfer-btn" @click="showTransferModal = true">{{ t('profile.transfer') }}</button>
      </div>
      <div class="balance-row">
        <span class="balance-amount">{{ userBalance }}</span>
        <span class="balance-hint">{{ t('profile.balanceHint') }}</span>
      </div>
    </div>

    <!-- 升档复投池（始终显示） -->
    <!-- V6：循环复投池 -->
    <div class="upgrade-pool-card v6-pool" v-if="currentTier === 'TIER_1000'">
      <div class="up-header">
        <span class="up-title">{{ t('profile.v3ReinvestPool') }}</span>
        <span class="up-amount">${{ pintuanCumulative.toFixed(2) }}</span>
      </div>
      <div class="up-tier-row">
        <span class="up-tier-cur">V6</span>
        <div class="up-bar-wrap">
          <div class="up-bar-fill" :style="{ width: v6ReinvestPercent + '%' }"></div>
        </div>
        <span class="up-tier-next">复投V3</span>
      </div>
      <div class="up-footer">
        <span class="up-pct">{{ v6ReinvestPercent.toFixed(0) }}%</span>
        <span class="up-gap">{{ t('profile.reinvestGap').replace('${gap}', Math.max(0, 100 - pintuanCumulative).toFixed(2)) }}</span>
      </div>
      <div class="up-pending" v-if="pintuanPending > 0">
        {{ t('profile.pendingLabel') }} ${{ pintuanPending.toFixed(2) }}{{ t('profile.pendingHint2') }}
      </div>
    </div>
    <!-- 非V6：升档进度池 -->
    <div class="upgrade-pool-card" v-else-if="currentTier && currentTier !== 'TIER_1000'">
      <div class="up-header">
        <span class="up-title">{{ t('profile.upgradePool') }}</span>
        <span class="up-amount">${{ pintuanCumulative.toFixed(2) }}</span>
      </div>
      <div class="up-tier-row">
        <span class="up-tier-cur">{{ TIER_LABEL[currentTier] }}</span>
        <div class="up-bar-wrap">
          <div class="up-bar-fill" :style="{ width: upgradePercent + '%' }"></div>
        </div>
        <span class="up-tier-next">{{ NEXT_TIER_LABEL[currentTier] }}</span>
      </div>
      <div class="up-footer">
        <span class="up-pct">{{ upgradePercent.toFixed(0) }}%</span>
        <span class="up-gap">{{ t('profile.upgradeGap').replace('${gap}', upgradeGap).replace('{tier}', NEXT_TIER_LABEL[currentTier]) }}</span>
      </div>
      <div class="up-pending" v-if="pintuanPending > 0">
        {{ t('profile.pendingLabel') }} ${{ pintuanPending.toFixed(2) }}{{ t('profile.pendingHint') }}
      </div>
    </div>
    <!-- 未激活：引导激活 -->
    <div class="upgrade-pool-card unactivated-pool" v-else>
      <div class="up-header">
        <span class="up-title">{{ t('profile.upgradePool') }}</span>
        <span class="up-amount">$0.00</span>
      </div>
      <div class="up-inactive-hint">{{ t('profile.upgradePoolHint') }}</div>
    </div>

    <!-- 产品提货进度 -->
    <div class="delivery-progress-card">
      <div class="dp-header">
        <span class="dp-title">{{ t('profile.delivery') }}</span>
        <span class="dp-amount">${{ productPurchaseStr }} / $70</span>
      </div>
      <div class="dp-bar-wrap">
        <div class="dp-bar-fill" :style="{ width: productPurchasePct + '%' }"></div>
      </div>
      <div class="dp-footer">
        <span class="dp-hint">{{ productPurchaseReady ? t('profile.deliveryReady') : t('profile.deliveryGap').replace('${gap}', productPurchaseGap) }}</span>
        <button v-if="productPurchaseReady" class="btn-delivery" @click="showDeliveryDialog = true">{{ t('profile.deliveryBtn') }}</button>
      </div>
    </div>

    <!-- 收益卡片矩阵 -->
    <div class="earnings-grid">
      <div class="earnings-card card-green">
        <div class="card-icon">💰</div>
        <div class="card-content">
          <div class="card-label">今日收益</div>
          <div class="card-value">{{ todayEarningsValue }}</div>
        </div>
      </div>

      <div class="earnings-card card-blue">
        <div class="card-icon">🏅</div>
        <div class="card-content">
          <div class="card-label">拼团收益</div>
          <div class="card-value">{{ repeatBonus }}</div>
        </div>
      </div>

      <div class="earnings-card card-orange">
        <div class="card-icon">📊</div>
        <div class="card-content">
          <div class="card-label">累计收益</div>
          <div class="card-value">{{ totalEarnings }}</div>
        </div>
      </div>

      <div class="earnings-card card-red">
        <div class="card-icon">🏪</div>
        <div class="card-content">
          <div class="card-label">店长分润</div>
          <div class="card-value">{{ manageEarnings }}</div>
        </div>
      </div>
    </div>

    <!-- 提货弹窗 -->
    <div v-if="showDeliveryDialog" class="modal-overlay" @click.self="showDeliveryDialog = false">
      <div class="delivery-modal">
        <div class="dlv-header">
          <span class="dlv-title">📦 申请提货</span>
          <button class="dlv-close" @click="showDeliveryDialog = false">✕</button>
        </div>

        <template v-if="!deliverySubmitted">
          <!-- 选择品类 -->
          <div class="dlv-section">
            <div class="dlv-label">选择产品品类</div>
            <div class="dlv-categories">
              <div v-for="cat in deliveryCategories" :key="cat.id"
                   class="dlv-cat-item" :class="{ selected: deliveryForm.category === cat.id }"
                   @click="deliveryForm.category = cat.id">
                <span class="dlv-cat-icon">{{ cat.icon }}</span>
                <span class="dlv-cat-name">{{ cat.name }}</span>
              </div>
            </div>
          </div>

          <!-- 收货地址 -->
          <div class="dlv-section">
            <div class="dlv-label">收货地址 <span style="color:#E53E3E;font-size:11px">（48小时后自动销毁保护隐私）</span></div>
            <input v-model="deliveryForm.address" class="dlv-input" placeholder="姓名 / 手机号 / 详细地址" />
          </div>

          <div class="dlv-tip">📌 提交后 AI 自动联系服务商发货，请保持手机畅通</div>

          <button class="dlv-submit-btn"
            :disabled="!deliveryForm.category || !deliveryForm.address.trim() || isSubmittingDelivery"
            @click="submitDelivery">
            {{ isSubmittingDelivery ? '提交中...' : '确认提货' }}
          </button>
        </template>

        <template v-else>
          <div class="dlv-success">
            <div style="font-size:48px;margin-bottom:12px">🎉</div>
            <div class="dlv-success-title">提货申请已提交！</div>
            <div class="dlv-success-sub">服务商将在48小时内联系您安排发货<br>地址将于48小时后自动销毁</div>
            <button class="dlv-submit-btn" @click="showDeliveryDialog = false; deliverySubmitted = false">关闭</button>
          </div>
        </template>
      </div>
    </div>
    
    <!-- 我的服务 -->
    <div class="section-title">{{ t('profile.myServices') }}</div>
    <div class="service-grid">
      <div class="service-item" @click="handleService('records')">
        <div class="service-icon">📊</div>
        <div class="service-label">交易明细</div>
      </div>

      <div class="service-item" @click="handleService('transfer')">
        <div class="service-icon" style="background: #F59E0B;">💸</div>
        <div class="service-label">余额互转</div>
      </div>

      <div class="service-item" @click="router.push('/recharge')">
        <div class="service-icon" style="background: linear-gradient(135deg, #10B981, #059669);">💎</div>
        <div class="service-label">充值</div>
      </div>

      <div class="service-item" @click="router.push('/withdraw')">
        <div class="service-icon" style="background: linear-gradient(135deg, #3B82F6, #1D4ED8);">🏦</div>
        <div class="service-label">提现</div>
      </div>

      <div class="service-item" @click="handleTool('address')">
        <div class="service-icon" style="background: linear-gradient(135deg, #EC4899, #BE185D);">📦</div>
        <div class="service-label">收货地址</div>
      </div>

      <div v-if="displayId === '82377'" class="service-item" @click="handleService('admin')">
        <div class="service-icon" style="background: #FF6B6B;">👑</div>
        <div class="service-label">{{ t('profile.admin') }}</div>
      </div>
      <!-- 设置入口：仅对管理员82377可见 -->
      <div v-if="displayId === '82377'" class="service-item" @click="handleService('admin')">
        <div class="service-icon" style="background: #95A5A6;">⚙️</div>
        <div class="service-label">设置</div>
      </div>
      <div class="service-item" @click="showLanguageModal = true">
        <div class="service-icon" style="background: #3498DB;">🌐</div>
        <div class="service-label">多国语言</div>
      </div>
    </div>

    <!-- 退出按钮 -->
    <div class="logout-btn" @click="handleLogout">
      <span class="logout-icon">🚪</span>
      <span class="logout-text">退出并刷新</span>
    </div>

    <!-- 退出确认弹窗：提醒保存 ID -->
    <div v-if="showLogoutConfirm" class="modal-overlay" @click.self="showLogoutConfirm = false">
      <div class="edit-name-modal">
        <div class="modal-header">
          <span>退出前请记住您的ID</span>
          <button class="close-btn" @click="showLogoutConfirm = false">×</button>
        </div>
        <p style="font-size:13px;color:#666;margin:0 0 8px;line-height:1.5">退出后凭此ID可恢复账号</p>
        <div class="logout-id-box" @click="copyCurrentId">
          <span class="logout-id-num">{{ displayId }}</span>
          <span class="logout-id-copy">{{ idCopied ? '✅ 已复制' : '点击复制' }}</span>
        </div>
        <button class="save-name-btn" style="margin-top:16px;background:#E53935;border-color:#E53935" @click="confirmLogout">
          记住了，确认退出
        </button>
        <button class="close-btn" style="margin-top:8px;width:100%;padding:10px;font-size:14px" @click="showLogoutConfirm = false">
          取消
        </button>
      </div>
    </div>

    <!-- 语言选择弹窗 -->
    <div v-if="showLanguageModal" class="modal-overlay" @click="showLanguageModal = false">
      <div class="language-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ t('settings.languageOptions') }}</h3>
          <span class="modal-close" @click="showLanguageModal = false">×</span>
        </div>
        <div class="language-list">
          <div 
            v-for="lang in supportedLocales" 
            :key="lang.code"
            class="language-item"
            :class="{ active: locale === lang.code }"
            @click="changeLanguage(lang.code)"
          >
            <span class="lang-flag">{{ lang.flag }}</span>
            <span class="lang-name">{{ lang.nativeName }}</span>
            <span v-if="locale === lang.code" class="lang-check">✓</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 编辑用户名弹窗已移除 -->
    
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { eventBus, EVENTS } from '../utils/eventBus.js'  // ✅ 新增
import { getOrCreateUserId, getCurrentUser } from '../utils/auth.js'
// engine.js 已废弃，改用后端 API
import { useI18n } from '../composables/useI18n.js'
import { useTodayEarnings } from '../composables/useEarnings.js' // ✅ 新增
import { useToast } from '../composables/useToast.js'
import { verifyAdminLoginCode, setAdminAuthenticated, isAdminAuthenticated } from '../config/adminConfig.js'
import { supabase } from '../config/supabase.js'
import { apiRequest } from '../config/api.js'
import { useUserStore } from '../stores/userStore.js'

const router = useRouter()
const { success, error, warning } = useToast()
const isDataLoaded = ref(false)
const currentUser = ref(getCurrentUser())

// ── 全局用户 Store（单一数据源）────────────────────────
const userStore = useUserStore()
const isUserActivated = computed(() => userStore.isActivated)
const isLoadingUserStatus = computed(() => userStore.isLoading && !userStore.isInitialized)

// 用户ID（来自 localStorage）- 统一使用 chatUserId
const displayId = ref(localStorage.getItem('chatUserId') || '未登录')
const communityId = ref(localStorage.getItem('chatUserId') || currentUser.value?.communityId || 0)

// 退出登录 - 弹出确认框（提醒记住 ID）
const showLogoutConfirm = ref(false)
const idCopied = ref(false)

const handleLogout = () => {
  idCopied.value = false
  showLogoutConfirm.value = true
}

const copyCurrentId = () => {
  navigator.clipboard.writeText(String(displayId.value)).catch(() => {})
  idCopied.value = true
}

const confirmLogout = () => {
  const keys = ['chatUserId', 'chatUserName', 'cachedIsActive', 'cachedInviteCode', 'id_cleanup_done']
  keys.forEach(k => localStorage.removeItem(k))
  window.location.reload()
}

// 切换账号（直接输入ID切换）
const showSwitchModal = ref(false)
const switchId = ref('')
const switchStep = ref(1)        // 1=输入ID, 2=安全验证
const switchTargetId = ref('')
const switchSecQuestion = ref('')
const switchSecAnswer = ref('')
const isSwitchChecking = ref(false)

const closeSwitchModal = () => {
  showSwitchModal.value = false
  switchId.value = ''
  switchStep.value = 1
  switchTargetId.value = ''
  switchSecQuestion.value = ''
  switchSecAnswer.value = ''
}

const doSwitchAccount = (newId) => {
  localStorage.setItem('chatUserId', newId)
  localStorage.removeItem('chatUserName')
  localStorage.removeItem('cachedIsActive')
  localStorage.removeItem('cachedCardType')
  localStorage.removeItem('cachedInviteCode')
  localStorage.removeItem('userAvatarUrl')
  localStorage.removeItem('shop_cart_v1')
  localStorage.removeItem('shop_fav_v1')
  const url = new URL(window.location.href)
  url.searchParams.set('_', Date.now())
  window.location.replace(url.toString())
}

const handleSwitchAccount = async () => {
  const newId = switchId.value?.toString().trim()
  if (!newId) { error('请输入账号ID'); return }
  const myId = communityId.value?.toString()
  if (newId === myId) { error('不能切换到自己的账号'); return }

  isSwitchChecking.value = true
  try {
    const res = await fetch(`/api/auth/security-status?userId=${newId}`)
    const data = await res.json()
    if (data.code === 200 && data.data.isSet) {
      // 目标账号设了安全问题，需验证
      const qRes = await fetch('/api/auth/get-security-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newId })
      })
      const qData = await qRes.json()
      if (qData.code === 200) {
        switchTargetId.value = newId
        switchSecQuestion.value = qData.data.question
        switchStep.value = 2
        return
      }
    }
    // 未设安全问题，直接切换
    doSwitchAccount(newId)
  } catch {
    // 网络异常时直接切换（不阻断）
    doSwitchAccount(newId)
  } finally {
    isSwitchChecking.value = false
  }
}

const handleSwitchVerify = async () => {
  if (!switchSecAnswer.value.trim()) { error('请输入安全问题答案'); return }
  isSwitchChecking.value = true
  try {
    const res = await fetch('/api/auth/verify-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: switchTargetId.value, questionIndex: 1, answer: switchSecAnswer.value })
    })
    const data = await res.json()
    if (data.code === 200) {
      doSwitchAccount(switchTargetId.value)
    } else {
      error(data.message || '答案错误，请重新输入')
    }
  } catch {
    error('验证失败，请检查网络')
  } finally {
    isSwitchChecking.value = false
  }
}

// 安全问题设置
const showSecuritySetupModal = ref(false)
const secQ1Answer = ref('')
const isSavingSecurity = ref(false)
const securityIsSet = ref(false) // 是否已设置过安全问题

// 查询安全问题是否已设置
const checkSecurityStatus = async () => {
  const myId = communityId.value?.toString()
  if (!myId) return
  try {
    const res = await fetch(`/api/auth/security-status?userId=${myId}`)
    const data = await res.json()
    if (data.code === 200) securityIsSet.value = data.data.isSet
  } catch {}
}

const handleSaveSecurity = async () => {
  if (!secQ1Answer.value.trim()) {
    error('请填写安全问题答案')
    return
  }
  const myId = communityId.value?.toString()
  if (!myId) {
    error('请先登录')
    return
  }
  isSavingSecurity.value = true
  try {
    const res = await fetch('/api/auth/save-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: myId, q1Answer: secQ1Answer.value })
    })
    const data = await res.json()
    if (data.code === 200) {
      success('安全问题设置成功！')
      showSecuritySetupModal.value = false
      secQ1Answer.value = ''
      securityIsSet.value = true
    } else {
      error(data.message || '设置失败')
    }
  } catch (err) {
    error('设置失败，请检查网络')
  } finally {
    isSavingSecurity.value = false
  }
}

// 多语言支持
const { t, locale, setLocale, supportedLocales } = useI18n()
const showLanguageModal = ref(false)

// 用户信息显示（只读）
const displayUserName = ref(localStorage.getItem('chatUserName') || currentUser.value?.nickname || '用户')
const userAvatar = ref(localStorage.getItem('userAvatarUrl') || null)

// 邀请码（来自全局 store）
const invitationCode = computed(() => {
  if (!isUserActivated.value) return '🔒'
  return userStore.inviteCode || '🔒'
})

// 修改昵称相关
const showEditNameModal = ref(false)
const newUserName = ref('')

// 保存新昵称
const saveUserName = () => {
  const name = newUserName.value.trim()
  if (name.length < 2) {
    error('昵称至少2个字符')
    return
  }
  if (name.length > 20) {
    error('昵称最多20个字符')
    return
  }

  // 保存到localStorage
  localStorage.setItem('chatUserName', name)
  displayUserName.value = name
  showEditNameModal.value = false
  newUserName.value = ''
  success('昵称修改成功！')
}

// 用户名首字母
const userNameInitial = computed(() => {
  return displayUserName.value.charAt(0).toUpperCase()
})

// 手动刷新头像（改为静默刷新，不弹窗）
const refreshAvatar = () => {
  const latestAvatar = localStorage.getItem('userAvatarUrl')
  if (latestAvatar) {
    userAvatar.value = latestAvatar
  }
  
  const latestName = localStorage.getItem('chatUserName')
  if (latestName) {
    displayUserName.value = latestName
  }
}

// 管理员权限
const isAdmin = ref(isAdminAuthenticated())

// 提示输入管理员代码（直接走后端验证，无需手动设置 localStorage）
const promptAdminCode = async () => {
  const code = prompt('请输入管理员登录码：')
  if (!code) return

  try {
    const res = await apiRequest('/admin/auth/verify-login', {
      method: 'POST',
      body: { code: code.trim() }
    })
    if (res.success) {
      // 验证成功后缓存到 localStorage，下次无需重新输入
      localStorage.setItem('admin_code', code.trim())
      isAdmin.value = true
      setAdminAuthenticated(true)
      success('管理员权限已激活！')
      router.push('/admin')
    } else {
      error('登录码错误！')
    }
  } catch (e) {
    error('验证失败，请检查网络')
  }
}

// 普通服务处理
const handleNormalService = () => {
  // 可以根据需要添加逻辑
}

// 切换语言
const changeLanguage = (langCode) => {
  setLocale(langCode)
  showLanguageModal.value = false
}

// 收益数据（从 API 读取）
const latestEarnings = ref(0)
const totalEarnings = ref(0)
const todayEarningsValue = ref(0)
const repeatBonus = ref(0)    // 拼团收益
const manageEarnings = ref(0) // 店长分润

// 产品提货
const productPurchaseTotal = ref(0)  // 累计激活金额
const productPurchaseStr = computed(() => Number(productPurchaseTotal.value || 0).toFixed(2))
const productPurchasePct = computed(() => Math.min(Number(productPurchaseTotal.value || 0) / 70 * 100, 100))
const productPurchaseGap = computed(() => Number(Math.max(0, 70 - (productPurchaseTotal.value || 0))).toFixed(2))
const productPurchaseReady = computed(() => Number(productPurchaseTotal.value || 0) >= 70)
const showDeliveryDialog = ref(false)
const deliverySubmitted = ref(false)
const isSubmittingDelivery = ref(false)
const deliveryForm = ref({ category: '', address: '' })
const deliveryCategories = [
  { id: 'food', icon: '🍱', name: '食品/生鲜' },
  { id: 'beauty', icon: '💄', name: '美妆/护肤' },
  { id: 'health', icon: '💊', name: '保健/营养' },
  { id: 'daily', icon: '🧴', name: '日用百货' },
  { id: 'digital', icon: '📱', name: '数码/配件' },
  { id: 'clothing', icon: '👗', name: '服装/鞋包' },
]

async function submitDelivery() {
  if (!deliveryForm.value.category || !deliveryForm.value.address.trim()) return
  isSubmittingDelivery.value = true
  try {
    const res = await apiRequest('/product/delivery', {
      method: 'POST',
      body: JSON.stringify({
        userId: communityId.value,
        category: deliveryForm.value.category,
        address: deliveryForm.value.address.trim(),
      })
    })
    if (res.code === 200) {
      deliverySubmitted.value = true
      deliveryForm.value = { category: '', address: '' }
    } else {
      alert(res.message || '提交失败，请重试')
    }
  } catch (e) {
    alert('网络错误，请重试')
  } finally {
    isSubmittingDelivery.value = false
  }
}

// 升档复投池
const pintuanCumulative = ref(0)
const pintuanPending    = ref(0)
const currentTier       = ref(null)
const nextTierPrice     = ref(null)
const TIER_LABEL = { BASIC: 'V1', PREMIUM: 'V2', ELITE: 'V3', TIER_300: 'V4', TIER_500: 'V5', TIER_1000: 'V6' }
const NEXT_TIER_LABEL = { BASIC: 'V2', PREMIUM: 'V3', ELITE: 'V4', TIER_300: 'V5', TIER_500: 'V6' }
const upgradePercent = computed(() => {
  if (!nextTierPrice.value || !pintuanCumulative.value) return 0
  return Math.min(pintuanCumulative.value / nextTierPrice.value * 100, 100)
})
const upgradeGap = computed(() => {
  if (!nextTierPrice.value) return 0
  return Math.max(0, nextTierPrice.value - pintuanCumulative.value).toFixed(2)
})
const v6ReinvestPercent = computed(() => Math.min(pintuanCumulative.value / 100 * 100, 100))

// 团队数据（从 API 读取）
const teamTotalCount = ref(0)
const teamOrders = ref(0)
const directPushCount = ref(0)

// 从后端 API 加载收益数据
const loadEarningsFromApi = async () => {
  if (!communityId.value) return
  try {
    const res = await fetch(`/api/subscription/earnings/${communityId.value}`)
    const data = await res.json()
    if (data.code === 200 && data.data) {
      const d = data.data
      const fmt = v => { const n = Number(v) || 0; return Number.isInteger(n) ? n : parseFloat(n.toFixed(2)) }
      totalEarnings.value = fmt(d.totalEarnings)
      todayEarningsValue.value = fmt(d.todayEarnings)
      latestEarnings.value = fmt(d.spotBonusTotal)
      repeatBonus.value = fmt(d.pintuanProfitTotal ?? d.levelBonusTotal)
      manageEarnings.value = fmt(d.dailyDividendTotal)
      productPurchaseTotal.value = fmt(d.activationSpend ?? 0)
      // 升档复投池
      pintuanCumulative.value = parseFloat(d.pintuanCumulative) || 0
      pintuanPending.value    = parseFloat(d.pintuanPending) || 0
      currentTier.value       = d.currentTier || null
      nextTierPrice.value     = d.nextTierPrice || null
    }
  } catch (err) {
    console.warn('⚠️ 加载收益失败:', err)
  }
}

// 余额（从Supabase读取，如果失败则从localStorage读取）
// 余额来自全局 store
const userBalance = computed(() => userStore.balance)

// 刷新用户数据（调用 store）
const loadBalanceFromSupabase = () => userStore.fetchUserStatus()

// 手动刷新全部数据
const isRefreshing = ref(false)
const refreshAll = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await Promise.all([
      userStore.fetchUserStatus(),
      loadTeamInfo(),
      loadEarningsFromApi()
    ])
    success('已刷新', '')
  } finally {
    isRefreshing.value = false
  }
}

// 转账弹窗相关
const showTransferModal = ref(false)
const transferStep = ref(1)           // 1=填表, 2=安全问题验证
const transferToId = ref('')
const transferAmount = ref(null)
const isTransferring = ref(false)
const transferSecQuestion = ref('')
const transferSecQuestionIndex = ref(1)
const transferSecAnswer = ref('')
const transferToken = ref('')

const closeTransferModal = () => {
  showTransferModal.value = false
  transferStep.value = 1
  transferSecQuestion.value = ''
  transferSecAnswer.value = ''
  transferToken.value = ''
}

// Step 1: 校验表单 → 获取当前用户安全问题
const handleTransferStepOne = async () => {
  if (!transferToId.value.trim()) {
    error('请输入对方ID')
    return
  }
  if (!transferAmount.value || transferAmount.value < 10) {
    error('转账金额最低10')
    return
  }
  if (transferAmount.value > userBalance.value) {
    error('余额不足')
    return
  }
  const myId = communityId.value?.toString()
  isTransferring.value = true
  try {
    const res = await fetch('/api/auth/get-security-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: myId })
    })
    const data = await res.json()
    if (data.code !== 200) {
      error('请先设置安全问题才能使用互转功能')
      return
    }
    transferSecQuestion.value = data.data.question
    transferSecQuestionIndex.value = data.data.questionIndex
    transferStep.value = 2
  } catch (err) {
    error('验证失败，请检查网络')
  } finally {
    isTransferring.value = false
  }
}

// Step 2: 验证安全问题 → 执行转账
const handleTransfer = async () => {
  if (!transferSecAnswer.value.trim()) {
    error('请输入安全问题答案')
    return
  }
  const myId = communityId.value?.toString()

  // 先验证安全问题
  isTransferring.value = true
  try {
    const verifyRes = await fetch('/api/auth/verify-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: myId, questionIndex: transferSecQuestionIndex.value, answer: transferSecAnswer.value })
    })
    const verifyData = await verifyRes.json()
    if (verifyData.code !== 200) {
      error(verifyData.message || '答案错误')
      isTransferring.value = false
      return
    }
    transferToken.value = verifyData.transferToken || ''
  } catch (err) {
    error('验证失败，请检查网络')
    isTransferring.value = false
    return
  }

  // 🚀 乐观更新：先扣除本地余额
  const prevBalance = userStore.balance
  userStore.setBalance(Math.max(0, prevBalance - transferAmount.value))

  try {
    const result = await apiRequest('/transfer/send', {
      method: 'POST',
      body: {
        fromUserId: communityId.value,
        toUserId: transferToId.value.trim(),
        amount: transferAmount.value,
        transferToken: transferToken.value
      }
    })

    if (result.code === 200) {
      success('转账成功', `已转${transferAmount.value}给用户${transferToId.value}`)
      closeTransferModal()
      transferToId.value = ''
      transferAmount.value = null
      userStore.fetchUserStatus()
    } else {
      userStore.setBalance(prevBalance)
      error('转账失败', result.message || '请稍后重试')
    }
  } catch (err) {
    userStore.setBalance(prevBalance)
    error('转账失败', err.message)
  } finally {
    isTransferring.value = false
  }
}

// 余额更新事件 → 刷新 store
const handleBalanceUpdate = (data) => {
  const myId = String(communityId.value)
  const eventId = String(data.userId)
  if (eventId === myId) {
    userStore.fetchUserStatus()
    loadTeamInfo()
  }
}

// 复制邀请码
const handleCopyInviteCode = () => {
  // 未激活不能复制
  if (!isUserActivated.value) {
    warning('请先激活', '激活后才能获得邀请码')
    return
  }
  
  const code = invitationCode.value
  const fallbackCopy = () => {
    const textarea = document.createElement('textarea')
    textarea.value = code
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0.01;font-size:16px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.setSelectionRange(0, textarea.value.length)
    try {
      document.execCommand('copy')
      success('邀请码已复制', code)
    } catch (e) {
      error('复制失败', '请手动复制：' + code)
    }
    document.body.removeChild(textarea)
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(code).then(() => {
      success('邀请码已复制', code)
    }).catch(fallbackCopy)
  } else {
    fallbackCopy()
  }
}

// 服务点击
const handleService = (type) => {
  switch (type) {
    case 'checkin':
      router.push('/checkin')
      break
    case 'transfer':
      showTransferModal.value = true
      break
    case 'records':
      router.push('/transaction-history')
      break
    case 'admin':
      if (isAdminAuthenticated()) {
        router.push('/admin')
      } else {
        promptAdminCode()
      }
      break
  }
}

// 工具点击
const handleTool = (type) => {
  switch (type) {
    case 'payment':
      error('功能开发中，敬请期待')
      break
    case 'password':
      error('功能开发中，敬请期待')
      break
    case 'address':
      error('功能开发中，敬请期待')
      break
    case 'contact':
      error('功能开发中，敬请期待')
      break
    case 'logout':
      localStorage.removeItem('user_id')
      location.reload()
      break
  }
}

// 加载团队信息（从 API 读取）
const loadTeamInfo = async () => {
  if (!communityId.value) return
  try {
    // 全部从 team-stats 获取（6级深度真实数据）
    const statsRes = await fetch(`/api/subscription/team-stats/${communityId.value}`)
    const statsData = await statsRes.json()
    if (statsData.code === 200 && statsData.data) {
      teamTotalCount.value = statsData.data.totalCount || 0    // 团队总人数（6级）
      teamOrders.value = statsData.data.activeCount || 0       // 团队报单数（已激活）
      directPushCount.value = statsData.data.directCount || 0  // 直推人数
    }
  } catch (err) {
    console.warn('⚠️ 加载团队信息失败:', err)
  }
}

// 监听 localStorage 变化（用于同步头像更新 + 余额同步）
const handleStorageChange = (e) => {
  if (e.key === 'userAvatarUrl') {
    userAvatar.value = e.newValue
  } else if (e.key === 'chatUserName') {
    displayUserName.value = e.newValue || '用户'
  } else if (e.key === 'taskchain_users' && e.newValue) {
    // ✅ 监听余额数据变化（跨标签页同步）
    console.log('检测到数据变化，同步余额')
    loadTeamInfo()
  }
}

// 页面激活时自动刷新（类似 APP 的 onResume）
onActivated(() => {
  console.log('Profile页面激活，刷新数据')
  refreshAvatar()
  loadTeamInfo()
  loadBalanceFromSupabase() // ✅ 刷新余额和邀请码
  loadEarningsFromApi()     // ✅ 刷新收益
})

onMounted(async () => {
  // 立即显示页面  
  isDataLoaded.value = true
  
  // 首次加载数据
  refreshAvatar()

  // ✅ 监听余额更新事件
  eventBus.on(EVENTS.BALANCE_UPDATED, handleBalanceUpdate)
  
  // 监听 storage 事件（跨标签页同步）
  window.addEventListener('storage', handleStorageChange)
  
  // 异步加载数据
  loadTeamInfo()
  loadBalanceFromSupabase() // ✅ 从Supabase加载余额
  loadEarningsFromApi()     // ✅ 从API加载收益
  checkSecurityStatus()     // 🔒 检查安全问题是否已设置
  
  // ✅ 订阅Supabase实时更新
  if (supabase && communityId.value) {
    const subscription = supabase
      .channel(`user-balance-${communityId.value}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${communityId.value}`
        },
        (payload) => {
          // Supabase 实时推送 → 直接写入 store（无需额外请求）
          if (payload.new?.coin_balance !== undefined) {
            userStore.setBalance(payload.new.coin_balance)
          }
          if (payload.new?.is_member !== undefined) {
            userStore.isActivated = payload.new.is_member === true
            localStorage.setItem('cachedIsActive', userStore.isActivated ? 'true' : 'false')
          }
          if (payload.new?.invite_code) {
            userStore.inviteCode = payload.new.invite_code
            localStorage.setItem('cachedInviteCode', payload.new.invite_code)
          }
        }
      )
      .subscribe()
    
    // 保存订阅引用以便清理
    window._supabaseSubscription = subscription
  }
})

// 组件卸载时清理
onUnmounted(() => {
  eventBus.off(EVENTS.BALANCE_UPDATED, handleBalanceUpdate)
  window.removeEventListener('storage', handleStorageChange)
  
  // ✅ 清理Supabase订阅
  if (window._supabaseSubscription) {
    window._supabaseSubscription.unsubscribe()
    delete window._supabaseSubscription
  }
})
</script>

<style scoped>
.profile-container {
  min-height: 100vh;
  background: #FAF9F7;
  padding: 20px 16px;
  padding-bottom: 80px;
}

/* 页面头部 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #2C3E50;
}

.refresh-btn {
  position: absolute;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid #E0E0E0;
  border-radius: 50%;
  background: #fff;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}
.refresh-btn:hover { background: #F5F5F5; color: #333; }
.refresh-btn.spinning svg { animation: spin-profile 1s linear infinite; }
@keyframes spin-profile { 100% { transform: rotate(360deg); } }

/* 登录提示卡片 */
.login-prompt-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #FFC933 0%, #FFB300 100%);
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.login-icon {
  font-size: 40px;
  flex-shrink: 0;
}

.login-content {
  flex: 1;
}

.login-title {
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
  margin-bottom: 4px;
}

.login-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.login-actions {
  display: flex;
  gap: 8px;
}

.btn-login,
.btn-register {
  padding: 8px 16px;
  border-radius: 20px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-login {
  background: rgba(255, 255, 255, 0.25);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.btn-login:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.15);
}

.btn-register {
  background: #FFFFFF;
  color: #667EEA;
}

.btn-register:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.9);
}

/* 用户信息卡片 */
.user-info-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #FFFBE6 0%, #FFF3C0 100%);
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(200, 160, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #FFE57F;
}

.user-info-card:active {
  transform: scale(0.98);
}

.user-status {
  font-size: 11px;
  margin-top: 4px;
}

.user-status.activated {
  color: #2E7D32;
}

.user-status.not-activated {
  color: #E65100;
}

.status-skeleton {
  display: inline-block;
  height: 12px;
  width: 56px;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(200,160,0,0.1) 25%, rgba(200,160,0,0.2) 50%, rgba(200,160,0,0.1) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s infinite;
  vertical-align: middle;
}

@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.user-avatar {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: rgba(200, 150, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid rgba(200, 150, 0, 0.25);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.user-avatar:hover::after {
  content: '🔄';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  background: rgba(0, 0, 0, 0.6);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.user-avatar:active {
  transform: scale(0.95);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 24px;
  font-weight: 600;
  color: #7A5800;
}

.user-details {
  flex: 1;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 18px;
  font-weight: 600;
  color: #3D2800;
}

.invite-code-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.invite-code-row.inactive {
  opacity: 0.5;
}

.invite-code-row.inactive .invite-code-value {
  color: rgba(100, 70, 0, 0.4);
  font-style: italic;
}

.invite-code-label {
  font-size: 12px;
  color: rgba(100, 70, 0, 0.65);
}

.invite-code-value {
  font-size: 14px;
  font-weight: 700;
  color: #3D2800;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}

.invite-usage-hint {
  font-size: 11px;
  color: rgba(100, 70, 0, 0.55);
  margin-top: 3px;
}

.copy-code-btn {
  background: rgba(180, 130, 0, 0.12);
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-code-btn:hover {
  background: rgba(180, 130, 0, 0.22);
}

.copy-code-btn:active {
  transform: scale(0.95);
}

.edit-name-btn {
  background: rgba(180, 130, 0, 0.12);
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-name-btn:hover {
  background: rgba(180, 130, 0, 0.22);
}

.switch-id-btn {
  background: #F7B500;
  border: none;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  margin-left: 4px;
  transition: all 0.2s;
}

.switch-id-btn:hover {
  background: #e5a800;
}

.switch-id-btn.sec-btn {
  background: #f0f4ff;
  color: #4a7fd4;
}

.switch-id-btn.sec-btn:hover {
  background: #e0eaff;
}

/* 修改昵称弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.edit-name-modal {
  background: white;
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 300px;
}

.edit-name-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}

.edit-name-modal .close-btn {
  background: #f5f5f5;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  font-size: 18px;
  cursor: pointer;
}

.name-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e5e5;
  border-radius: 10px;
  font-size: 15px;
  margin-bottom: 16px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}

.name-input:focus {
  border-color: #667EEA;
}

.save-name-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #FFC933, #FFB300);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.save-name-btn:hover {
  opacity: 0.9;
}

/* 转账弹窗 */
.transfer-modal {
  background: white;
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 320px;
}

.transfer-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}

.transfer-modal .close-btn {
  background: #f5f5f5;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  font-size: 18px;
  cursor: pointer;
}

.transfer-balance {
  background: linear-gradient(135deg, #FFC933 0%, #FFB300 100%);
  border-radius: 12px;
  padding: 16px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.transfer-balance .balance-value {
  font-size: 24px;
  font-weight: 700;
}

.transfer-form {
  margin-bottom: 16px;
}

.transfer-form .form-group {
  margin-bottom: 12px;
}

.transfer-form label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}

.transfer-form input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e5e5;
  border-radius: 10px;
  font-size: 15px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}

.transfer-form input:focus {
  border-color: #667EEA;
}

.transfer-submit-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #F7B500, #FF9800);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.transfer-submit-btn:hover {
  opacity: 0.9;
}

.transfer-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.user-id {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.edit-icon {
  font-size: 20px;
  opacity: 0.8;
}

/* 收益概览 */
.earnings-overview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: #FFFFFF;
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.overview-label {
  font-size: 13px;
  color: #8E8E93;
}

.overview-amount {
  font-size: 20px;
  font-weight: 600;
  color: #2C3E50;
}

.overview-amount.highlight {
  color: #FF3B30;
}

.overview-divider {
  font-size: 16px;
  color: #D1D1D6;
}

/* 余额卡片（紧凑版） */
.balance-card {
  background: linear-gradient(135deg, #FFFBE6 0%, #FFF3C0 100%);
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 10px;
  box-shadow: 0 2px 8px rgba(200, 160, 0, 0.12);
  border: 1px solid #FFE57F;
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.balance-title {
  font-size: 14px;
  font-weight: 600;
  color: #5C3D00;
}

.transfer-btn {
  padding: 4px 12px;
  border-radius: 14px;
  border: 1px solid rgba(150, 100, 0, 0.25);
  background: rgba(200, 150, 0, 0.1);
  color: #5C3D00;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.transfer-btn:active {
  transform: scale(0.95);
  background: rgba(200, 150, 0, 0.18);
}

.balance-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.balance-amount {
  font-size: 28px;
  font-weight: 700;
  color: #3D2800;
}

.balance-hint {
  font-size: 11px;
  color: rgba(100, 70, 0, 0.55);
}

/* 升档复投池卡片 */
.upgrade-pool-card {
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  border: 1.5px solid #93C5FD;
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.upgrade-pool-card.v6-pool {
  background: linear-gradient(135deg, #F5F3FF, #EDE9FE);
  border-color: #C4B5FD;
}
.up-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.up-title { font-size: 14px; font-weight: 700; color: #1D4ED8; }
.v6-pool .up-title { color: #7C3AED; }
.up-amount { font-size: 20px; font-weight: 700; color: #1E40AF; }
.v6-pool .up-amount { color: #6D28D9; }
.up-tier-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.up-tier-cur, .up-tier-next { font-size: 12px; font-weight: 700; color: #1D4ED8; white-space: nowrap; min-width: 20px; }
.v6-pool .up-tier-cur, .v6-pool .up-tier-next { color: #7C3AED; }
.up-bar-wrap { flex: 1; height: 8px; background: #BFDBFE; border-radius: 4px; overflow: hidden; }
.v6-pool .up-bar-wrap { background: #DDD6FE; }
.up-bar-fill { height: 100%; background: linear-gradient(90deg, #3B82F6, #1D4ED8); border-radius: 4px; transition: width 0.6s ease; }
.v6-pool .up-bar-fill { background: linear-gradient(90deg, #8B5CF6, #7C3AED); }
.up-footer { display: flex; justify-content: space-between; align-items: center; }
.up-pct { font-size: 13px; font-weight: 700; color: #1D4ED8; }
.v6-pool .up-pct { color: #7C3AED; }
.up-gap { font-size: 12px; color: #3B82F6; }
.v6-pool .up-gap { color: #8B5CF6; }
.up-pending { margin-top: 8px; font-size: 11px; color: #6B7280; background: rgba(255,255,255,0.6); border-radius: 8px; padding: 6px 10px; }
.unactivated-pool { background: linear-gradient(135deg, #F3F4F6, #E5E7EB); border-color: #D1D5DB; }
.unactivated-pool .up-title { color: #6B7280; }
.unactivated-pool .up-amount { color: #9CA3AF; }
.up-inactive-hint { font-size: 12px; color: #9CA3AF; margin-top: 4px; line-height: 1.6; }

/* 产品提货进度卡片 */
.delivery-progress-card {
  background: linear-gradient(135deg, #FFF7ED, #FEF3C7);
  border: 1.5px solid #FBD38D;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}
.dp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.dp-title { font-size: 14px; font-weight: 700; color: #92400E; }
.dp-amount { font-size: 15px; font-weight: 800; color: #C05621; }
.dp-bar-wrap { height: 8px; background: #FEE2A0; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.dp-bar-fill { height: 100%; background: linear-gradient(90deg, #FFAB30, #FF7000); border-radius: 4px; transition: width 0.5s; }
.dp-footer { display: flex; justify-content: space-between; align-items: center; }
.dp-hint { font-size: 12px; color: #92400E; }
.btn-delivery {
  background: linear-gradient(135deg, #FF7000, #FFAB30);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  border: none;
  border-radius: 20px;
  padding: 6px 20px;
  cursor: pointer;
}

/* 提货弹窗 */
.delivery-modal {
  background: #fff;
  border-radius: 20px;
  padding: 24px 20px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}
.dlv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.dlv-title { font-size: 17px; font-weight: 700; color: #1A202C; }
.dlv-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #888; }
.dlv-section { margin-bottom: 18px; }
.dlv-label { font-size: 13px; font-weight: 600; color: #4A5568; margin-bottom: 10px; }
.dlv-categories {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.dlv-cat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 6px;
  border: 1.5px solid #E8EEF4;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 11px;
  color: #555;
  gap: 4px;
}
.dlv-cat-item.selected { border-color: #FF7000; background: #FFF7F0; color: #FF7000; font-weight: 700; }
.dlv-cat-icon { font-size: 22px; }
.dlv-input {
  width: 100%;
  border: 1.5px solid #E8EEF4;
  border-radius: 10px;
  padding: 12px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.dlv-input:focus { border-color: #FF7000; }
.dlv-tip { font-size: 12px; color: #888; background: #F7FAFC; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; }
.dlv-submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #FF7000, #FFAB30);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
}
.dlv-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dlv-success { text-align: center; padding: 20px 0; }
.dlv-success-title { font-size: 18px; font-weight: 700; color: #1A202C; margin-bottom: 8px; }
.dlv-success-sub { font-size: 13px; color: #718096; margin-bottom: 24px; line-height: 1.7; }

/* 收益卡片矩阵 */
.earnings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.earnings-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.card-green {
  background: linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%);
}

.card-blue {
  background: linear-gradient(135deg, #A8E6CF 0%, #56CCF2 100%);
}

.card-orange {
  background: linear-gradient(135deg, #FFD93D 0%, #FF9A00 100%);
}

.card-red {
  background: linear-gradient(135deg, #FF6B9D 0%, #C44569 100%);
}

.card-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
}

.card-value {
  font-size: 20px;
  font-weight: 600;
  color: #FFFFFF;
}

/* 区块标题 */
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
  margin-bottom: 12px;
  padding-left: 12px;
  border-left: 4px solid #5F27CD;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-hint {
  font-size: 11px;
  color: #999;
  font-weight: 400;
}

/* 团队卡片 */
.team-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.team-card {
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.card-teal {
  background: linear-gradient(135deg, #1DD1A1 0%, #10AC84 100%);
}

.card-pink {
  background: linear-gradient(135deg, #FF6B9D 0%, #FEE140 100%);
}

.card-yellow {
  background: linear-gradient(135deg, #FDCB6E 0%, #FD79A8 100%);
}

.team-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 8px;
}

.team-value {
  font-size: 24px;
  font-weight: 600;
  color: #FFFFFF;
}

/* 服务网格 */
.service-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.service-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.service-item:active .service-icon {
  transform: scale(0.9);
  opacity: 0.8;
}

.service-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.service-label {
  font-size: 12px;
  color: #2C3E50;
  text-align: center;
}

/* 退出按钮 */
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 20px 16px 8px;
  padding: 14px;
  background: #fff;
  border: 1.5px solid #FFD6D6;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.logout-btn:active {
  background: #FFF5F5;
}

.logout-icon {
  font-size: 18px;
}

.logout-text {
  font-size: 15px;
  font-weight: 600;
  color: #E53935;
}

.logout-id-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F5F5F5;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  margin: 8px 0;
}

.logout-id-num {
  font-size: 26px;
  font-weight: 900;
  color: #333;
  letter-spacing: 2px;
}

.logout-id-copy {
  font-size: 12px;
  color: #667EEA;
}

/* 工具网格 */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  background: #FFFFFF;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-item:active {
  transform: scale(0.95);
}

.tool-icon {
  font-size: 32px;
}

.tool-label {
  font-size: 12px;
  color: #2C3E50;
  text-align: center;
}

/* ==================== 5代平级收益卡片 ==================== */

.level-bonus-card {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 2px solid rgba(247, 181, 0, 0.15);
}

.level-total {
  text-align: center;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #F0F0F0;
}

.total-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 4px;
}

.total-value {
  font-size: 28px;
  font-weight: 700;
  color: #F7B500;
  background: linear-gradient(135deg, #F7B500, #FFC700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.level-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.level-item {
  background: #FAFAFA;
  border-radius: 10px;
  padding: 12px;
}

.level-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.level-num {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.level-count {
  font-size: 11px;
  color: #999;
  background: #F0F0F0;
  padding: 2px 8px;
  border-radius: 10px;
}

.level-amount {
  font-size: 18px;
  font-weight: 600;
  color: #F7B500;
  margin-bottom: 8px;
}

.level-bar {
  height: 6px;
  background: #E8E8E8;
  border-radius: 3px;
  overflow: hidden;
}

.level-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.level-item:nth-child(1) .level-fill {
  background: linear-gradient(90deg, #FF6B6B, #FF8E8E);
}

.level-item:nth-child(2) .level-fill {
  background: linear-gradient(90deg, #F7B500, #FFC700);
}

.level-item:nth-child(3) .level-fill {
  background: linear-gradient(90deg, #07C160, #10D97E);
}

.level-item:nth-child(4) .level-fill {
  background: linear-gradient(90deg, #10AEFF, #5BC0FF);
}

.level-item:nth-child(5) .level-fill {
  background: linear-gradient(90deg, #5F27CD, #8E44AD);
}

.level-tips {
  background: rgba(247, 181, 0, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
}

.tip-line {
  font-size: 11px;
  color: #666;
  padding: 2px 0;
  line-height: 1.5;
}

/* 语言选择弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.language-modal {
  background: #FFFFFF;
  border-radius: 16px;
  width: 85%;
  max-width: 320px;
  overflow: hidden;
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #F0F0F0;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
  margin: 0;
}

.modal-close {
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}

.language-list {
  padding: 8px 0;
}

.language-item {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.language-item:hover {
  background: #FAF9F7;
}

.language-item.active {
  background: rgba(95, 39, 205, 0.08);
}

.lang-flag {
  font-size: 24px;
  margin-right: 12px;
}

.lang-name {
  flex: 1;
  font-size: 15px;
  color: #2C3E50;
}

.lang-check {
  color: #5F27CD;
  font-size: 18px;
  font-weight: 600;
}

/* 编辑用户名弹窗 */
.edit-name-modal {
  background: #FFFFFF;
  border-radius: 16px;
  width: 85%;
  max-width: 320px;
  overflow: hidden;
  animation: modalIn 0.3s ease;
}

.modal-body {
  padding: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 14px;
  font-weight: 600;
  color: #2C3E50;
}

.name-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #E8E8E8;
  border-radius: 8px;
  font-size: 15px;
  color: #2C3E50;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.name-input:focus {
  border-color: #667EEA;
  background: #F8F9FF;
}

.input-hint {
  font-size: 12px;
  color: #999;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #F0F0F0;
}

.btn-cancel,
.btn-save {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #F0F0F0;
  color: #666;
}

.btn-cancel:active {
  background: #E0E0E0;
}

.btn-save {
  background: linear-gradient(135deg, #FFC933 0%, #FFB300 100%);
  color: #FFFFFF;
}

.btn-save:active {
  opacity: 0.8;
}
</style>

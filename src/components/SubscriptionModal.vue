<template>
  <Teleport to="body">
    <div v-if="visible" class="sub-overlay" @click.self="close">
      <div class="sub-modal">
        <!-- 头部 -->
        <div class="sub-header">
          <span class="sub-title">👛 管理订阅</span>
          <button class="sub-close" @click="close">×</button>
        </div>

        <!-- 余额栏 + 幸运参团 -->
        <div class="sub-bal-bar">
          <div class="bal-info">
            <span class="bal-lbl">💰 当前余额</span>
            <span class="bal-val">${{ currentBalance.toFixed(2) }}</span>
          </div>
          <button class="btn-lucky-top" @click="openLuckyAuto">幸运参团</button>
        </div>

        <!-- 6档钱包列表 -->
        <div class="tier-list">
          <div v-for="(tier, idx) in TIERS" :key="tier.id" class="tier-row" :class="{ 'tier-row-act': isTierActivated(idx) }">
            <!-- 彩色档位圆圈 -->
            <div class="tier-v-circle" :style="{ background: isTierActivated(idx) ? tier.color : '#E8EEF4' }">
              <span class="tier-v-text" :style="{ color: isTierActivated(idx) ? '#fff' : '#94A3B8' }">{{ tier.name }}</span>
            </div>
            <div class="tier-info">
              <div class="tier-name-row">
                <span class="tier-label">{{ tier.name }}</span>
                <span class="tier-status" :class="isTierActivated(idx) ? 'badge-act' : 'badge-no'">
                  {{ isTierActivated(idx) ? '✓ 已激活' : '未激活' }}
                </span>
              </div>
              <div class="tier-price-display">${{ tier.price }}</div>
            </div>
            <div class="tier-actions">
              <button v-if="isTierActivated(idx)" class="btn-done-pill">✓</button>
              <button v-else class="btn-act-pill" @click="openActivate(tier, idx)">激活</button>
              <button class="btn-log-pill" @click="openLog(tier)">日志</button>
            </div>
          </div>
        </div>

        <!-- 底部提示 -->
        <div class="sub-footer">
          <span>🏆 1+1公排共富</span>
          <span>🎰 拼团持续静态</span>
          <span>🛍️ 产品精品不断</span>
        </div>
      </div>

      <!-- ===== 激活确认弹窗 ===== -->
      <div v-if="confirmTier" class="inner-overlay" @click.self="confirmTier = null">
        <div class="inner-box">
          <div class="inner-hd">
            <span>激活 {{ confirmTier.label }}（{{ confirmTier.name }}）</span>
            <button class="sub-close" @click="confirmTier = null">×</button>
          </div>

          <div class="price-row">
            <span class="price-lbl">需支付金额</span>
            <span class="price-val">${{ confirmTier.price }}</span>
          </div>

          <div class="bal-check" :class="currentBalance >= confirmTier.price ? 'ok' : 'low'">
            当前余额：${{ currentBalance.toFixed(2) }}
            <span>{{ currentBalance >= confirmTier.price ? '✓ 余额充足' : '✗ 余额不足' }}</span>
          </div>

          <!-- 邀请码（仅首次激活时显示）-->
          <div v-if="!isActivated" class="invite-sec">
            <div class="invite-lbl">邀请码 <span class="req">*必填</span></div>
            <input
              v-model="inviteCode"
              class="invite-inp"
              :class="{ 'inp-err': inviteCodeError }"
              placeholder="请输入邀请码"
              maxlength="20"
              @blur="touchInviteCode"
            />
            <div class="inp-err-msg" v-if="inviteCodeError">⚠️ {{ inviteCodeError }}</div>
            <div class="inp-hint" v-else-if="!inviteCode">💡 激活需要邀请码，请联系推荐人获取</div>
          </div>

          <!-- 确认激活按钮 -->
          <button
            class="btn-confirm"
            :disabled="!canActivate"
            @click="handleActivate"
          >{{ activateButtonText }}</button>
        </div>
      </div>

      <!-- ===== 幸运参团确认弹窗 ===== -->
      <div v-if="luckyTier" class="inner-overlay" @click.self="luckyTier = null">
        <div class="inner-box">
          <div class="inner-hd">
            <span>🎰 幸运参团</span>
            <button class="sub-close" @click="luckyTier = null">×</button>
          </div>

          <div class="lucky-desc">
            <div class="lucky-row">💰 参团费用：<b>${{ luckyTotalCost }}</b>（{{ luckyCount }}次 × $20/次）</div>
            <div class="lucky-row">👥 10人满员即开奖，7人中奖（中奖率70%）</div>
            <div class="lucky-row">📅 连续签到7天（首次）→ 送1张拼团券</div>
            <div class="lucky-row">🎟️ 激活档位赠券：V1-V3送<b>8张</b>，V4-V6送<b>16张</b></div>
            <div class="lucky-row">⚠️ 用券参团需 <b>4张</b>（$5×4=$20），须激活档位</div>
          </div>

          <!-- 支付方式选择 -->
          <div class="lucky-pay-title">选择付款方式</div>
          <div class="lucky-pay-opts">
            <label class="lucky-pay-opt" :class="{ selected: luckyPayMethod === 'balance' }">
              <input type="radio" v-model="luckyPayMethod" value="balance" />
              <span class="lpo-name">💰 余额</span>
              <span class="lpo-val">${{ props.currentBalance.toFixed(2) }}</span>
            </label>
            <label class="lucky-pay-opt" :class="{ selected: luckyPayMethod === 'help' }">
              <input type="radio" v-model="luckyPayMethod" value="help" />
              <span class="lpo-name">🤲 帮扶收益</span>
              <span class="lpo-val">${{ props.helpBalance.toFixed(2) }}</span>
            </label>
            <label class="lucky-pay-opt" :class="{ selected: luckyPayMethod === 'voucher' }">
              <input type="radio" v-model="luckyPayMethod" value="voucher" />
              <span class="lpo-name">🎟️ 拼团券</span>
              <span class="lpo-val">{{ props.couponCount }} 张</span>
            </label>
          </div>

          <div class="bal-check" :class="canLuckyJoin ? 'ok' : 'low'">
            <span v-if="luckyPayMethod === 'voucher'">持有拼团券：{{ props.couponCount }} 张</span>
            <span v-else-if="luckyPayMethod === 'help'">帮扶收益：${{ props.helpBalance.toFixed(2) }}</span>
            <span v-else>当前余额：${{ props.currentBalance.toFixed(2) }}</span>
            <span>{{ canLuckyJoin ? '✓ 充足' : '✗ 不足' }}</span>
          </div>

          <button
            class="btn-confirm btn-lucky-confirm"
            :disabled="!canLuckyJoin"
            @click="handleLuckyJoin"
          >{{ luckyJoining ? '参团中…' : `立即参团（${luckyCount}次）` }}</button>
        </div>
      </div>

      <!-- ===== 日志弹窗 ===== -->
      <div v-if="logTier" class="inner-overlay" @click.self="logTier = null">
        <div class="inner-box">
          <div class="inner-hd">
            <span>{{ logTier.name }} {{ logTier.desc }} 明细</span>
            <button class="sub-close" @click="logTier = null">×</button>
          </div>
          <div class="log-status-bar" :class="isTierActivated(TIERS.findIndex(t => t.id === logTier.id)) ? 'log-ok' : 'log-no'">
            <span v-if="isTierActivated(TIERS.findIndex(t => t.id === logTier.id))">✅ 已激活</span>
            <span v-else>⚪ 未激活 · 激活价 ${{ logTier.price }}</span>
          </div>
          <div class="log-section-title">奖励明细</div>
          <div class="log-detail-list">
            <div class="log-detail-row">
              <span class="log-detail-lbl">💛 见点（推荐奖励）</span>
              <span class="log-detail-val" style="color:#D46B08">${{ logTier.spotBonus }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-lbl">💙 平级（平级奖励）</span>
              <span class="log-detail-val" style="color:#0050B3">${{ logTier.levelBonus }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-lbl">💚 帮扶（帮扶补贴）</span>
              <span class="log-detail-val" style="color:#389E0D">${{ logTier.helpBonus }}</span>
            </div>
            <div class="log-divider"></div>
            <div class="log-detail-row log-total-row">
              <span class="log-detail-lbl"><b>📊 合计（平级+帮扶）</b></span>
              <span class="log-detail-val" style="color:#CF1322;font-size:15px;font-weight:700">${{ logTier.levelBonus + logTier.helpBonus }}</span>
            </div>
          </div>
          <div class="log-pintuan-bar">
            🎰 幸运参团：{{ PINTUAN_COUNTS[logTier.id] }}次 × $20 = ${{ PINTUAN_COUNTS[logTier.id] * PINTUAN_UNIT }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useToast } from '../composables/useToast'
import { useFieldValidation } from '../composables/useValidation'
import { Validator } from '../utils/validation/Validator'
import { Sanitizer } from '../utils/validation/Sanitizer'
import { apiRequest } from '../config/api'
import { getOrCreateUserId } from '../utils/auth'

const props = defineProps({
  visible:         { type: Boolean, default: false },
  currentBalance:  { type: Number,  default: 0 },
  helpBalance:     { type: Number,  default: 0 },
  couponCount:     { type: Number,  default: 0 },
  isFirstUser:     { type: Boolean, default: false },
  isActivated:     { type: Boolean, default: false },
  currentCardType: { type: String,  default: null }
})

const emit = defineEmits(['close', 'activate', 'success'])
const { success, error } = useToast()
const userId = getOrCreateUserId()

// 六档定义（与后端 TIER_ORDER 对齐）
// spotBonus=25%, levelBonus=3%/层, helpBonus=10%/位出局直推(最多2位)
const TIERS = [
  { id: 'BASIC',     name: 'V1', desc: '入门',  price: 20,   spotBonus: 5,   levelBonus: 0.6, helpBonus: 2,   color: 'linear-gradient(135deg,#52C41A,#389E0D)' },
  { id: 'PREMIUM',   name: 'V2', desc: '进阶',  price: 50,   spotBonus: 12.5,levelBonus: 1.5, helpBonus: 5,   color: 'linear-gradient(135deg,#13C2C2,#0E8B8B)' },
  { id: 'ELITE',     name: 'V3', desc: '精英',  price: 100,  spotBonus: 25,  levelBonus: 3,   helpBonus: 10,  color: 'linear-gradient(135deg,#1677FF,#0050B3)' },
  { id: 'TIER_300',  name: 'V4', desc: '专业',  price: 200,  spotBonus: 50,  levelBonus: 6,   helpBonus: 20,  color: 'linear-gradient(135deg,#722ED1,#531DAB)' },
  { id: 'TIER_500',  name: 'V5', desc: '高级',  price: 500,  spotBonus: 125, levelBonus: 15,  helpBonus: 50,  color: 'linear-gradient(135deg,#FA8C16,#D46B08)' },
  { id: 'TIER_1000', name: 'V6', desc: '顶级',  price: 1000, spotBonus: 250, levelBonus: 30,  helpBonus: 100, color: 'linear-gradient(135deg,#F5222D,#A8071A)' },
]

const TIER_ORDER = ['BASIC', 'PREMIUM', 'ELITE', 'TIER_300', 'TIER_500', 'TIER_1000']

// 每档幸运参团次数（+2次/档），每次固定 $20
const PINTUAN_COUNTS = { BASIC: 1, PREMIUM: 3, ELITE: 5, TIER_300: 7, TIER_500: 9, TIER_1000: 11 }
const PINTUAN_UNIT = 20

// 已激活的最高档索引（-1 表示未激活）
const currentCardIdx = computed(() => {
  if (!props.isActivated || !props.currentCardType) return -1
  return TIER_ORDER.indexOf(props.currentCardType)
})

function isTierActivated(idx) {
  return idx <= currentCardIdx.value
}

// 激活/日志/幸运参团子弹窗状态
const confirmTier    = ref(null)
const logTier        = ref(null)
const luckyTier      = ref(null)
const luckyJoining   = ref(false)
const luckyPayMethod = ref('balance')

function openActivate(tier, idx) {
  if (isTierActivated(idx)) return
  confirmTier.value = tier
  inviteCode.value  = ''
  isActivating.value = false
}

function openLuckyAuto() {
  const idx = TIERS.findIndex((_, i) => !isTierActivated(i))
  if (idx === -1) return
  openLucky(TIERS[idx], idx)
}

function openLucky(tier, idx) {
  if (isTierActivated(idx)) return
  luckyTier.value = tier
  inviteCode.value = ''
}

function openLog(tier) {
  logTier.value = tier
}

// ===== 邀请码 =====
const inviteCode = ref('')
const isActivating = ref(false)

const inviteCodeRules = [
  Validator.required('请输入邀请码'),
  Validator.minLength(3, '邀请码至少3个字符'),
  Validator.maxLength(20, '邀请码最多20个字符'),
  Validator.custom(v => /^[a-zA-Z0-9_-]+$/.test(v), '邀请码只能包含字母、数字、下划线和连字符')
]

const {
  error: inviteCodeError,
  isValid: isInviteCodeValid,
  touch: touchInviteCode
} = useFieldValidation(inviteCode, inviteCodeRules, { validateOnChange: true })

const canActivate = computed(() => {
  if (isActivating.value || !confirmTier.value) return false
  if (props.isActivated) return true  // 升级不需要邀请码
  return inviteCode.value.trim().length > 0 && isInviteCodeValid.value
})

const luckyCount = computed(() => luckyTier.value ? (PINTUAN_COUNTS[luckyTier.value.id] || 1) : 1)
const luckyTotalCost = computed(() => luckyCount.value * PINTUAN_UNIT)

const canLuckyJoin = computed(() => {
  if (luckyJoining.value || !luckyTier.value) return false
  if (luckyPayMethod.value === 'help') return props.helpBalance >= luckyTotalCost.value
  if (luckyPayMethod.value === 'voucher') return props.couponCount >= luckyCount.value
  return props.currentBalance >= luckyTotalCost.value
})

const activateButtonText = computed(() => {
  if (isActivating.value) return props.isActivated ? '升级中...' : '激活中...'
  if (!props.isActivated && !inviteCode.value.trim()) return '请输入邀请码'
  if (!props.isActivated && !isInviteCodeValid.value) return '邀请码格式不正确'
  return props.isActivated ? '确认升级' : '确认激活'
})

function close() { emit('close') }

async function handleActivate() {
  if (!confirmTier.value) return

  if (!props.isActivated) {
    touchInviteCode()
    if (!isInviteCodeValid.value) {
      error('邀请码错误', inviteCodeError.value || '请输入有效的邀请码')
      return
    }
  }

  const sanitizedCode = props.isActivated
    ? ''
    : Sanitizer.removeSpecialChars(inviteCode.value.trim(), ['_', '-'])
  isActivating.value = true

  try {
    const planType = confirmTier.value.id
    let activateData

    if (!props.isActivated) {
      activateData = await apiRequest('/subscription/activate', {
        method: 'POST',
        body: { userId, planType, inviteCode: sanitizedCode }
      })
    } else {
      activateData = await apiRequest('/subscription/activate-multi', {
        method: 'POST',
        body: { userId, planTypes: [planType], inviteCode: sanitizedCode }
      })
    }

    if (activateData.code !== 200) {
      error('激活失败', activateData.message || '请稍后重试')
      return
    }

    success('🎉 激活成功', `恭喜！已成功激活 ${confirmTier.value.name}（$${confirmTier.value.price}）`)
    setTimeout(() => {
      emit('success', { cardType: planType, amount: confirmTier.value.price })
      emit('close')
    }, 1200)

  } catch (err) {
    error('激活失败', err.message || '网络错误，请稍后重试')
  } finally {
    isActivating.value = false
  }
}

async function handleLuckyJoin() {
  if (!luckyTier.value || luckyJoining.value) return
  luckyJoining.value = true
  try {
    const token = localStorage.getItem('token')
    const count = PINTUAN_COUNTS[luckyTier.value.id] || 1
    let winCount = 0
    let lastMsg = ''
    for (let i = 0; i < count; i++) {
      const res = await fetch('/api/pintuan/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ groupSize: 10, autoRejoin: false, payMethod: luckyPayMethod.value })
      })
      const data = await res.json()
      if (data.code !== 0) {
        error('参团失败', data.message)
        return
      }
      if (data.data?.isWinner) winCount++
      lastMsg = data.message
    }
    const summary = count > 1
      ? `共参团${count}次，中奖${winCount}次`
      : (winCount > 0 ? `🎉 ${lastMsg}` : `💪 ${lastMsg}`)
    success('参团结果', summary)
    emit('success', { type: 'lucky', winCount })
    luckyTier.value = null
  } catch {
    error('参团失败', '网络错误，请稍后重试')
  } finally {
    luckyJoining.value = false
  }
}

watch(() => props.visible, (v) => {
  if (!v) {
    confirmTier.value = null
    logTier.value = null
    luckyTier.value = null
    luckyPayMethod.value = 'balance'
    inviteCode.value = ''
    isActivating.value = false
    luckyJoining.value = false
  }
})
</script>

<style scoped>
/* ===== 外层遮罩 ===== */
.sub-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.25s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

/* ===== 主弹窗（蓝渐变背景） ===== */
.sub-modal {
  background: linear-gradient(180deg, #D6EDF8 0%, #A8D4ED 100%);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  padding: 0 0 env(safe-area-inset-bottom, 0);
  max-height: 85vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}
@keyframes slideUp {
  from { transform: translateY(100%) }
  to   { transform: translateY(0) }
}

.sub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.4);
  position: sticky;
  top: 0;
  background: rgba(214,237,248,0.97);
  backdrop-filter: blur(8px);
  z-index: 1;
}
.sub-title { font-size: 17px; font-weight: 700; color: #1A3A50; }
.sub-close {
  width: 30px; height: 30px;
  border: none; background: rgba(255,255,255,0.7); border-radius: 50%;
  font-size: 20px; color: #666; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* 余额栏 — 白色浮卡 */
.sub-bal-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 14px 4px;
  padding: 11px 14px 11px 16px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.09);
  font-size: 14px;
}
.bal-info { display: flex; align-items: center; gap: 8px; }
.bal-lbl { color: #888; font-size: 13px; }
.bal-val { font-weight: 700; font-size: 17px; color: #E65100; }
.btn-lucky-top {
  padding: 9px 18px;
  border: none;
  border-radius: 22px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  color: #fff;
  box-shadow: 0 3px 10px rgba(124,58,237,0.35);
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-lucky-top:active { transform: scale(0.96); }

/* ===== 档位列表 ===== */
.tier-list {
  padding: 8px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 每档白色浮卡，无边框 */
.tier-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  background: #fff;
  border-radius: 16px;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.tier-row-act {
  box-shadow: 0 2px 12px rgba(0,0,0,0.11);
}

/* 档位圆圈图标 */
.tier-v-circle {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.3s;
}
.tier-v-text {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.5px;
  transition: color 0.3s;
}

.tier-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.tier-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.tier-label {
  font-size: 16px;
  font-weight: 700;
  color: #1A1A1A;
}
.tier-status {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  padding: 0;
  background: transparent;
}
.badge-act { color: #16A34A; }
.badge-no  { color: #AABBC8; }

/* 价格 — 青绿色，醒目 */
.tier-price-display {
  font-size: 16px;
  font-weight: 700;
  color: #0BBAC8;
}

.tier-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  gap: 7px;
  align-items: center;
}
/* 橙色激活按钮，与参考图一致 */
.btn-act-pill {
  padding: 10px 20px;
  border: none;
  border-radius: 22px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  background: linear-gradient(135deg, #FFAB30, #FF7000);
  color: #fff;
  box-shadow: 0 3px 8px rgba(255,112,0,0.35);
  white-space: nowrap;
}
.btn-act-pill:active { transform: scale(0.96); }
/* 日志按钮，白底浅边 */
.btn-log-pill {
  padding: 9px 16px;
  border: 1.5px solid #DDE5EC;
  border-radius: 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #fff;
  color: #7A8FA0;
  white-space: nowrap;
}
.btn-log-pill:active { opacity: 0.7; }
.btn-done-pill {
  padding: 10px 14px;
  border: none;
  border-radius: 22px;
  font-size: 13px;
  font-weight: 700;
  background: #E8FFF3;
  color: #16A34A;
  cursor: default;
  white-space: nowrap;
}

/* ===== 底部提示 ===== */
.sub-footer {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 12px 20px 16px;
  font-size: 11px;
  color: rgba(20,60,90,0.6);
  border-top: 1px solid rgba(255,255,255,0.4);
}

/* ===== 内层子弹窗（激活/日志）===== */
.inner-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

.inner-box {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 340px;
  padding: 20px;
  max-height: 80vh;
  overflow-y: auto;
  animation: scaleIn 0.2s ease;
}
@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0 }
  to   { transform: scale(1); opacity: 1 }
}

.inner-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 15px;
  font-weight: 700;
  color: #1A1A1A;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #FFF8E1;
  border-radius: 10px;
  margin-bottom: 10px;
}
.price-lbl { font-size: 13px; color: #666; }
.price-val { font-size: 20px; font-weight: 700; color: #E65100; }

.bal-check {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
}
.bal-check.ok  { background: #E8F5E9; color: #2E7D32; }
.bal-check.low { background: #FFEBEE; color: #C62828; }

/* ===== 邀请码 ===== */
.invite-sec { margin-bottom: 12px; }
.invite-lbl {
  font-size: 13px; color: #555; margin-bottom: 6px;
  display: flex; align-items: center; gap: 4px;
}
.req { font-size: 11px; color: #FF5252; font-weight: 600; }
.invite-inp {
  width: 100%; padding: 10px 12px;
  border: 2px solid #E5E5E5; border-radius: 10px;
  font-size: 14px; color: #1A1A1A; outline: none;
  box-sizing: border-box; transition: border-color 0.2s;
}
.invite-inp.inp-err { border-color: #FF5252; background: #FFEBEE; }
.invite-inp:focus   { border-color: #FF8A00; background: #FFF8E1; }
.invite-inp::placeholder { color: #BDBDBD; }
.inp-err-msg {
  margin-top: 6px; font-size: 12px; color: #FF5252;
  padding: 5px 10px; background: #FFEBEE; border-radius: 6px;
}
.inp-hint {
  margin-top: 6px; font-size: 12px; color: #E65100;
  padding: 5px 10px; background: #FFF8E1; border-radius: 6px;
}

/* ===== 确认按钮 ===== */
.btn-confirm {
  width: 100%; padding: 13px;
  border: none; border-radius: 10px;
  background: linear-gradient(135deg, #FF8A00, #FF5E00);
  color: #fff; font-size: 15px; font-weight: 700;
  cursor: pointer; transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(255,94,0,0.3);
  margin-top: 4px;
}
.btn-confirm:disabled {
  background: #E0E0E0;
  color: #999;
  cursor: not-allowed;
  box-shadow: none;
}
.btn-confirm:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255,94,0,0.4);
}

/* ===== 合伙人服务 ===== */
.partner-sec { margin-bottom: 12px; }
.btn-partner {
  width: 100%; padding: 12px;
  border: none; border-radius: 10px;
  background: linear-gradient(135deg, #1565C0, #1976D2);
  color: #fff; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: opacity 0.2s; margin-bottom: 10px;
}
.btn-partner:disabled { opacity: 0.6; cursor: not-allowed; }

.partner-list {
  background: #F0F7FF;
  border: 1px solid #BBDEFB;
  border-radius: 10px;
  padding: 12px;
}
.partner-list-ttl {
  font-size: 13px; font-weight: 700; color: #1565C0; margin-bottom: 8px;
}
.partner-item {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border-radius: 8px; padding: 10px 12px;
  margin-bottom: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.p-info { display: flex; flex-direction: column; gap: 2px; }
.p-name  { font-size: 13px; font-weight: 600; color: #1A1A1A; }
.p-wx    { font-size: 12px; color: #555; }
.btn-copy {
  padding: 6px 12px; border: none; border-radius: 6px;
  background: #1565C0; color: #fff; font-size: 12px;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
}
.btn-copy:active { opacity: 0.8; }
.partner-tip {
  font-size: 11px; color: #555; margin-top: 6px;
  padding: 8px; background: #E3F2FD; border-radius: 6px; line-height: 1.5;
}
.partner-empty {
  text-align: center; font-size: 13px; color: #999;
  padding: 12px; background: #F5F5F5; border-radius: 8px;
}

/* ===== 幸运参团 ===== */
.lucky-desc {
  background: linear-gradient(135deg, #F5F3FF, #EDE9FE);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.lucky-row {
  font-size: 13px;
  color: #4C1D95;
  padding: 3px 0;
  line-height: 1.5;
}
.btn-lucky-confirm {
  background: linear-gradient(135deg, #7C3AED, #5B21B6) !important;
  box-shadow: 0 3px 10px rgba(124,58,237,0.3);
}
.btn-lucky-confirm:hover:not(:disabled) { opacity: 0.9; }
.lucky-pay-title { font-size: 13px; color: #666; margin: 10px 0 6px; font-weight: 600; }
.lucky-pay-opts { display: flex; flex-direction: column; gap: 7px; margin-bottom: 10px; }
.lucky-pay-opt {
  display: flex; align-items: center; gap: 8px;
  border: 1.5px solid #E9ECEF; border-radius: 8px; padding: 9px 12px; cursor: pointer;
}
.lucky-pay-opt.selected { border-color: #7C3AED; background: #F5F3FF; }
.lucky-pay-opt input { accent-color: #7C3AED; }
.lpo-name { flex: 1; font-size: 13px; font-weight: 600; color: #1a1a2e; }
.lpo-val { font-size: 13px; font-weight: 700; color: #7C3AED; }

/* ===== 日志弹窗 ===== */
.log-status-bar {
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 14px;
}
.log-ok { background: #E8F5E9; color: #2E7D32; }
.log-no { background: #F5F5F5; color: #666; }

.log-section-title {
  font-size: 12px;
  font-weight: 700;
  color: #999;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.log-detail-list {
  background: #F8FAFC;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
}
.log-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 13px;
}
.log-detail-lbl { color: #555; }
.log-detail-val { font-weight: 700; }
.log-divider {
  height: 1px;
  background: #E5E5E5;
  margin: 6px 0;
}
.log-total-row { padding-top: 6px; }
.log-pintuan-bar {
  background: linear-gradient(135deg, #F5F3FF, #EDE9FE);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #5B21B6;
  font-weight: 600;
}
</style>

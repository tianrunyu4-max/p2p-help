<template>
  <div class="page">

    <!-- 顶部 -->
    <div class="top-bar">
      <button class="back-btn" @click="goBack">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <img src="/golden-globe.png" class="top-logo" alt="UAE Sourcing" />
      <div style="width:32px"></div>
    </div>

    <!-- 标签切换 -->
    <div class="tabs">
      <button :class="['tab', { active: tab === 'lang' }]" @click="tab = 'lang'">🌐 语言选项</button>
      <button :class="['tab', { active: tab === 'rank' }]" @click="tab = 'rank'; loadRank()">🏆 全球服务商排名</button>
    </div>

    <!-- ══ 语言选项（全屏） ══ -->
    <div class="panel" v-show="tab === 'lang'">
      <div class="lang-list">
        <button
          v-for="lang in languages"
          :key="lang.code"
          :class="['lang-card', { active: currentLang === lang.code }]"
          @click="currentLang = lang.code">
          <img :src="lang.flagImg" class="flag" :alt="lang.code" />
          <div class="lang-info">
            <span class="lang-name">{{ lang.name }}</span>
            <span class="lang-native">{{ lang.native }}</span>
          </div>
          <div class="check-circle" v-if="currentLang === lang.code">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </button>
      </div>
      <div class="lang-footer">
        <button class="confirm-btn" @click="confirmLang">{{ confirmText }}</button>
      </div>
    </div>

    <!-- ══ 全球服务商排名（全屏） ══ -->
    <div class="panel" v-show="tab === 'rank'">

      <!-- 头部统计 -->
      <div class="rank-hero">
        <div class="rank-hero-title">🏆 全球服务商每日竞价排名</div>
        <div class="rank-hero-sub">出券越多，排名越靠前 · 每日凌晨重置</div>
        <div class="rank-stats">
          <div class="stat-item">
            <span class="stat-num">1</span>
            <span class="stat-label">🎟️张起/次</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num">50</span>
            <span class="stat-label">每日名额</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num">{{ rankList.length }}</span>
            <span class="stat-label">已上榜</span>
          </div>
        </div>
      </div>

      <!-- 我的排名条 -->
      <div class="my-bar" v-if="myEntry">
        <span class="my-bar-label">我的排名</span>
        <span class="my-bar-rank">#{{ myRank }}</span>
        <span class="my-bar-pts">已出 {{ myEntry.total_bid_points }} 张🎟️</span>
        <button class="add-bid-btn" @click="doBid(1)" :disabled="bidLoading">{{ bidLoading ? '…' : '+1张' }}</button>
      </div>

      <!-- Loading -->
      <div class="rank-loading" v-if="rankLoading">
        <div class="spin"></div>
        <span>加载中…</span>
      </div>

      <!-- TOP3 颁奖台 -->
      <div class="podium" v-if="!rankLoading && rankList.length >= 1">
        <!-- No.2 -->
        <div class="podium-item p2" v-if="rankList[1]">
          <img :src="rankList[1].avatar || '/golden-globe.png'" class="podium-avatar" />
          <div class="podium-medal">🥈</div>
          <div class="podium-name">{{ rankList[1].nickname || '匿名' }}</div>
          <div class="podium-pts">{{ rankList[1].total_bid_points }}🎟️</div>
          <div class="podium-block p2-block">NO.2</div>
        </div>
        <!-- No.1 -->
        <div class="podium-item p1" v-if="rankList[0]">
          <img :src="rankList[0].avatar || '/golden-globe.png'" class="podium-avatar p1-avatar" />
          <div class="podium-medal">🥇</div>
          <div class="podium-name">{{ rankList[0].nickname || '匿名' }}</div>
          <div class="podium-pts">{{ rankList[0].total_bid_points }}🎟️</div>
          <div class="podium-block p1-block">NO.1</div>
        </div>
        <!-- No.3 -->
        <div class="podium-item p3" v-if="rankList[2]">
          <img :src="rankList[2].avatar || '/golden-globe.png'" class="podium-avatar" />
          <div class="podium-medal">🥉</div>
          <div class="podium-name">{{ rankList[2].nickname || '匿名' }}</div>
          <div class="podium-pts">{{ rankList[2].total_bid_points }}🎟️</div>
          <div class="podium-block p3-block">NO.3</div>
        </div>
      </div>

      <!-- 4名以后 -->
      <div class="rank-list" v-if="!rankLoading && rankList.length > 3">
        <div
          v-for="(item, idx) in rankList.slice(3)"
          :key="item.user_id"
          :class="['rank-row', { 'is-mine': myEntry && item.user_id === myEntry.user_id }]">
          <span class="row-no">{{ idx + 4 }}</span>
          <img :src="item.avatar || '/golden-globe.png'" class="row-avatar" />
          <span class="row-name">{{ item.nickname || '匿名' }}</span>
          <span class="row-pts">{{ item.total_bid_points }} 🎟️</span>
        </div>
      </div>

      <!-- 空榜 -->
      <div class="rank-empty" v-if="!rankLoading && rankList.length === 0">
        <div class="empty-icon">🏅</div>
        <div class="empty-title">今日还没有服务商上榜</div>
        <div class="empty-sub">第一个出价，直接锁定 No.1 宝座！</div>
      </div>

      <!-- 出价数量选择 + 上榜按钮 -->
      <div class="rank-footer">
        <!-- 数量选择 -->
        <div class="bid-qty-row">
          <span class="bid-qty-label">出价张数</span>
          <button class="qty-btn" @click="bidCount > 1 && bidCount--">−</button>
          <span class="bid-qty-num">{{ bidCount }}</span>
          <button class="qty-btn" @click="bidCount < 20 && bidCount++">+</button>
          <span class="bid-qty-hint">张拼团券（持有 {{ myCouponCount }} 张）</span>
        </div>
        <button class="bid-btn" @click="doBid(bidCount)" :disabled="bidLoading || myCouponCount < bidCount">
          <span v-if="bidLoading">出价中…</span>
          <span v-else-if="myCouponCount < bidCount">拼团券不足（持有 {{ myCouponCount }} 张）</span>
          <span v-else-if="myEntry">再次出价，巩固排名 · {{ bidCount }} 张🎟️</span>
          <span v-else>我要上榜 · 出价 {{ bidCount }} 张🎟️</span>
        </button>
        <div class="bid-rule">出券越多排名越高 · 每日凌晨自动重置 · 最多50名</div>
      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { switchLanguage } from '../i18n/index.js'

const router = useRouter()
const tab = ref('lang')

// ── 语言 ──────────────────────────
const languages = [
  { code: 'zh',  flagImg: 'https://flagcdn.com/w40/cn.png', name: '中文',     native: 'Chinese'    },
  { code: 'en',  flagImg: 'https://flagcdn.com/w40/us.png', name: 'English',  native: '英语'        },
  { code: 'ar',  flagImg: 'https://flagcdn.com/w40/ae.png', name: 'العربية', native: '阿拉伯语'    },
  { code: 'ru',  flagImg: 'https://flagcdn.com/w40/ru.png', name: 'Русский',  native: '俄语'        },
  { code: 'hi',  flagImg: 'https://flagcdn.com/w40/in.png', name: 'हिन्दी',  native: '印地语'      },
  { code: 'ur',  flagImg: 'https://flagcdn.com/w40/pk.png', name: 'اردو',     native: '乌尔都语'    },
  { code: 'fil', flagImg: 'https://flagcdn.com/w40/ph.png', name: 'Filipino', native: '菲律宾语'    },
]

const currentLang = ref(localStorage.getItem('appLanguage') || 'zh')
const confirmTextMap = {
  zh: '确认', en: 'Confirm', ar: 'تأكيد',
  ru: 'Подтвердить', hi: 'पुष्टि करें', ur: 'تصدیق', fil: 'Kumpirmahin',
}
const confirmText = computed(() => confirmTextMap[currentLang.value] || '确认')

function confirmLang() {
  switchLanguage(currentLang.value)
  router.replace('/')
}
function goBack() { router.back() }

// ── 排名 ──────────────────────────
const rankList    = ref([])
const rankLoading = ref(false)
const bidLoading  = ref(false)
const rankLoaded  = ref(false)
const bidCount    = ref(1)

const userId = localStorage.getItem('chatUserId') || ''
const myCouponCount = ref(0)

const myEntry = computed(() =>
  userId ? rankList.value.find(r => r.user_id === userId) || null : null
)
const myRank = computed(() => {
  if (!myEntry.value) return 0
  return rankList.value.findIndex(r => r.user_id === userId) + 1
})

// 加载用户持有的拼团券数量
async function loadMyCoupons() {
  if (!userId) return
  try {
    const res = await fetch(`/api/subscription/status/${userId}`)
    const json = await res.json()
    if (json.code === 200 && json.data) {
      myCouponCount.value = json.data.couponCount || 0
    }
  } catch (_) {}
}

async function loadRank() {
  if (rankLoaded.value) return
  rankLoading.value = true
  try {
    const res  = await fetch('/api/provider-rank')
    const json = await res.json()
    if (json.code === 0) { rankList.value = json.data || []; rankLoaded.value = true }
  } catch (e) { /* silent */ }
  finally { rankLoading.value = false }
}

async function doBid(count = 1) {
  if (!userId) { alert('请先登录后再出价'); return }
  if (bidLoading.value) return
  bidLoading.value = true
  try {
    const res  = await fetch('/api/provider-rank/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, bidCount: count }),
    })
    const json = await res.json()
    if (json.code === 0) {
      myCouponCount.value = Math.max(0, myCouponCount.value - count)
      rankLoaded.value = false
      await loadRank()
    } else {
      alert(json.message || '出价失败')
    }
  } catch (e) {
    alert('网络错误，请重试')
  } finally {
    bidLoading.value = false
  }
}

onMounted(() => {
  loadRank()
  loadMyCoupons()
})
</script>

<style scoped>
* { box-sizing: border-box; }

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f8fa;
  overflow: hidden;
}

/* 顶部栏 */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}
.back-btn {
  background: none; border: none; padding: 6px;
  cursor: pointer; color: #555; border-radius: 8px;
  display: flex; align-items: center;
}
.back-btn:hover { background: #f5f5f5; }
.top-logo {
  width: 36px; height: 36px; object-fit: contain;
  filter: drop-shadow(0 2px 6px rgba(200,140,0,0.3));
}

/* 标签 */
.tabs {
  display: flex;
  background: #fff;
  border-bottom: 2px solid #f0f0f0;
  flex-shrink: 0;
}
.tab {
  flex: 1;
  padding: 12px 6px;
  background: none; border: none;
  font-size: 13px; font-weight: 600; color: #999;
  cursor: pointer; transition: all 0.2s;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.tab.active {
  color: #c89000;
  border-bottom-color: #c89000;
}

/* 全屏面板 */
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── 语言面板 ── */
.lang-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lang-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  background: #fff;
  border: 2px solid #f0f0f0;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.lang-card:hover  { border-color: #d4a017; transform: translateY(-1px); }
.lang-card.active { border-color: #c89000; background: linear-gradient(135deg,#fffdf0,#fff8d6); box-shadow: 0 4px 16px rgba(200,144,0,0.15); }

.flag { width: 38px; height: 26px; object-fit: cover; border-radius: 4px; flex-shrink: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }

.lang-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.lang-name { font-size: 16px; font-weight: 700; color: #1a1a1a; }
.lang-native { font-size: 12px; color: #999; }

.check-circle {
  width: 26px; height: 26px; border-radius: 50%;
  background: #c89000; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.lang-footer { padding: 12px 16px 20px; background: #fff; border-top: 1px solid #f0f0f0; flex-shrink: 0; }
.confirm-btn {
  width: 100%; padding: 15px;
  background: linear-gradient(135deg, #c89000, #f0b800);
  color: #fff; font-size: 16px; font-weight: 700;
  border: none; border-radius: 16px; cursor: pointer;
  box-shadow: 0 4px 16px rgba(200,144,0,0.35);
  transition: all 0.15s;
}
.confirm-btn:active { transform: scale(0.98); }

/* ── 排名面板 ── */
.rank-hero {
  background: linear-gradient(135deg, #1a1a2e, #2d1b00);
  padding: 16px 20px 14px;
  flex-shrink: 0;
  text-align: center;
}
.rank-hero-title { font-size: 15px; font-weight: 800; color: #f0b800; margin-bottom: 4px; }
.rank-hero-sub   { font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 12px; }

.rank-stats {
  display: flex; align-items: center; justify-content: center; gap: 0;
  background: rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 0;
}
.stat-item  { flex: 1; text-align: center; }
.stat-num   { display: block; font-size: 20px; font-weight: 800; color: #f0b800; line-height: 1; }
.stat-label { display: block; font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.stat-divider { width: 1px; height: 30px; background: rgba(255,255,255,0.15); }

/* 我的排名条 */
.my-bar {
  display: flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, #fff8d0, #fffbe0);
  border-bottom: 1px solid #f0d860;
  padding: 8px 16px; flex-shrink: 0;
}
.my-bar-label { font-size: 12px; color: #8B6914; }
.my-bar-rank  { font-size: 16px; font-weight: 900; color: #c89000; }
.my-bar-pts   { font-size: 11px; color: #999; flex: 1; }
.add-bid-btn  {
  padding: 4px 10px; background: #c89000; color: #fff;
  border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;
}
.add-bid-btn:disabled { opacity: 0.6; }

/* Loading */
.rank-loading {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 40px; color: #bbb; font-size: 14px; flex: 1;
}
.spin {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid #f0e0a0; border-top-color: #c89000;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 颁奖台 */
.podium {
  display: flex; align-items: flex-end; justify-content: center;
  gap: 6px; padding: 16px 12px 0; flex-shrink: 0;
  background: linear-gradient(180deg, #fefce8 0%, #f7f8fa 100%);
}

.podium-item {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  flex: 1;
}
.podium-medal  { font-size: 18px; line-height: 1; }
.podium-avatar {
  width: 50px; height: 50px; border-radius: 50%; object-fit: cover;
  border: 3px solid #ddd;
}
.p1-avatar {
  width: 64px; height: 64px;
  border-color: #f0b800;
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px rgba(200,140,0,0.35);
}
.podium-item.p2 .podium-avatar { border-color: #b0b8c8; }
.podium-item.p3 .podium-avatar { border-color: #c87040; }

.podium-name {
  font-size: 11px; font-weight: 700; color: #333;
  max-width: 80px; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.podium-pts { font-size: 10px; color: #c89000; font-weight: 700; }

.podium-block {
  width: 100%; text-align: center; padding: 6px 0;
  font-size: 11px; font-weight: 800; color: #fff;
  border-radius: 6px 6px 0 0; margin-top: 4px;
}
.p1-block { background: linear-gradient(135deg, #d4a017, #f0c030); height: 52px; display:flex; align-items:flex-start; justify-content:center; padding-top:6px; }
.p2-block { background: linear-gradient(135deg, #8a9bb0, #b0c0d8); height: 38px; display:flex; align-items:flex-start; justify-content:center; padding-top:6px; }
.p3-block { background: linear-gradient(135deg, #b06030, #d07848); height: 28px; display:flex; align-items:flex-start; justify-content:center; padding-top:4px; }

/* 4名以后 */
.rank-list {
  flex: 1; overflow-y: auto;
  padding: 8px 14px;
  display: flex; flex-direction: column; gap: 6px;
}

.rank-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
  background: #fff; border-radius: 12px;
  border: 1.5px solid #f0f0f0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.rank-row.is-mine { border-color: #f0d060; background: #fffdf0; }

.row-no     { width: 24px; font-size: 13px; font-weight: 700; color: #bbb; text-align: center; flex-shrink: 0; }
.row-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.row-name   { flex: 1; font-size: 14px; font-weight: 600; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-pts    { font-size: 13px; font-weight: 700; color: #c89000; flex-shrink: 0; }

/* 空榜 */
.rank-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px; padding: 40px 20px; text-align: center;
}
.empty-icon  { font-size: 52px; }
.empty-title { font-size: 15px; font-weight: 700; color: #555; }
.empty-sub   { font-size: 12px; color: #bbb; }

/* 底部按钮 */
.rank-footer {
  padding: 12px 16px 20px;
  background: #fff; border-top: 1px solid #f0f0f0; flex-shrink: 0;
}
.bid-btn {
  width: 100%; padding: 15px;
  background: linear-gradient(135deg, #ff6b1a, #ff3d00);
  color: #fff; font-size: 15px; font-weight: 800;
  border: none; border-radius: 16px; cursor: pointer;
  box-shadow: 0 4px 16px rgba(255,80,30,0.35);
  transition: all 0.15s;
}
.bid-btn:active   { transform: scale(0.98); }
.bid-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.bid-rule { text-align: center; font-size: 11px; color: #bbb; margin-top: 8px; }

/* 出价数量选择 */
.bid-qty-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px;
  background: #f7f8fa; border-radius: 12px; padding: 10px 14px;
}
.bid-qty-label { font-size: 13px; color: #666; flex-shrink: 0; }
.qty-btn {
  width: 30px; height: 30px; border-radius: 8px;
  background: #fff; border: 1.5px solid #e0e0e0;
  font-size: 16px; font-weight: 700; color: #555;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.qty-btn:active { background: #f0f0f0; }
.bid-qty-num {
  width: 32px; text-align: center;
  font-size: 18px; font-weight: 800; color: #1a1a1a;
}
.bid-qty-hint { font-size: 11px; color: #999; flex: 1; }
</style>

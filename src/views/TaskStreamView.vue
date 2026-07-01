<template>
  <div class="shop-wrap">

    <!-- ===== 顶部（分类 + 全部频道，返回键悬浮左上角） ===== -->
    <button class="hd-back" @click="goBack">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <div class="category-bar">
      <div class="category-scroll">
        <button
          v-for="tab in TABS"
          :key="tab.zone"
          :class="['cat-tab', { active: activeZone === tab.zone }]"
          @click="switchZone(tab.zone)"
        >
          <span class="cat-main">
            <span v-if="tab.zone === 'cart'" class="cart-tab-icon">🛒</span>
            {{ tab.main }}
            <span v-if="tab.zone === 'cart' && cartTotal > 0" class="cart-tab-badge">{{ cartTotal }}</span>
          </span>
        </button>
      </div>
      <button class="hd-channel" @click="showChannels = !showChannels">
        <span class="channel-label">全部频道</span>
        <svg :class="['channel-arrow', { open: showChannels }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
    </div>

    <!-- ===== 全部频道分类面板 ===== -->
    <transition name="channel-drop">
      <div v-if="showChannels" class="channel-panel">
        <div class="channel-grid">
          <button
            v-for="cat in CHANNELS"
            :key="cat.zone"
            :class="['channel-item', { active: activeZone === cat.zone }]"
            @click="switchChannel(cat)"
          >{{ cat.label }}</button>
        </div>
      </div>
    </transition>

    <!-- ===== 购物车内嵌区（购物车tab激活时显示） ===== -->
    <div v-if="activeZone === 'cart'" class="cart-inline-area">
      <div v-if="cartItems.length === 0" class="cart-inline-empty">
        <div style="font-size:48px">🛒</div>
        <p>购物车空空如也</p>
      </div>
      <div v-else>
        <div class="cart-list">
          <div v-for="ci in cartItems" :key="ci.id" class="cart-item">
            <img v-if="ci.image_url" :src="ci.image_url" class="ci-img" />
            <div v-else class="ci-img ci-img-ph">📦</div>
            <div class="ci-info">
              <div class="ci-name">{{ ci.title }}</div>
              <div class="ci-price">$ {{ ci.price_balance }}</div>
            </div>
            <div class="ci-qty-row">
              <button class="qty-btn" @click="changeQty(ci, -1)">—</button>
              <span class="qty-num">{{ ci.qty }}</span>
              <button class="qty-btn qty-add" @click="changeQty(ci, 1)">+</button>
            </div>
          </div>
        </div>
        <div class="cart-inline-footer">
          <div class="cart-total-row">
            <span>合计</span>
            <span class="cart-total-price">$ {{ cartSubtotal }}</span>
          </div>
          <button class="cart-checkout-btn" @click="checkout">去结算 ({{ cartTotal }}件)</button>
        </div>
      </div>
    </div>

    <!-- ===== 商品列表 ===== -->
    <div v-else class="product-area">
      <!-- 骨架屏（加载中） -->
      <div v-if="loading" class="product-grid">
        <div v-for="n in 6" :key="n" class="pcard pcard-skel">
          <div class="skel skel-img-area"></div>
          <div class="pcard-body">
            <div class="skel skel-tag"></div>
            <div class="skel skel-line skel-lg"></div>
            <div class="skel skel-line skel-md"></div>
            <div class="pcard-bottom" style="gap:0;justify-content:space-between">
              <div class="skel skel-price-block"></div>
              <div class="skel skel-btn-skel"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="products.length === 0" class="empty-wrap">
        <div class="empty-icon">📦</div>
        <p>本区暂无商品上架</p>
      </div>

      <!-- 商品网格 -->
      <div v-else class="product-grid">
        <div
          v-for="(item, idx) in products"
          :key="item.id"
          class="pcard"
          :style="{ '--delay': (idx * 0.04) + 's' }"
          @click="openDetail(item)"
        >
          <!-- 每日特惠标签 -->
          <div class="pcard-badge">每日特惠 不限购</div>
          <!-- 商品图 -->
          <div class="pcard-img-wrap">
            <img
              v-if="getImages(item)[0]"
              :src="getImages(item)[0]"
              :alt="item.title"
              class="pcard-img"
              loading="lazy"
              decoding="async"
              @load="e => e.target.classList.add('img-loaded')"
            />
            <div v-else class="pcard-img-placeholder">📦</div>
            <div v-if="getImages(item).length > 1" class="pcard-img-count">{{ getImages(item).length }}图</div>
          </div>
          <!-- 商品信息 -->
          <div class="pcard-body">
            <div class="pcard-tags-row">
              <span class="pcard-tag-nolimit">不限购</span>
            </div>
            <div class="pcard-name">{{ item.title }}</div>
            <!-- 三种价格 -->
            <div class="pcard-prices">
              <span v-if="item.price_balance > 0" class="pprice pprice-balance">💰 $ {{ item.price_balance }}</span>
              <span v-if="item.price_shopping_coin > 0" class="pprice pprice-coin">🛒 {{ item.price_shopping_coin }}购物金</span>
              <span v-if="item.price_points > 0" class="pprice pprice-points">⭐ {{ item.price_points }}积分</span>
            </div>
            <div class="pcard-bottom">
              <span v-if="discountLabel(item)" class="pcard-discount">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#FF6B00"><path d="M13 2L4.09 12.26a1 1 0 00.91 1.74H11v8l8.91-10.26A1 1 0 0019 10H13V2z"/></svg>
                {{ discountLabel(item) }}
              </span>
              <div class="pcard-qty" @click.stop>
                <button class="qty-btn" @click.stop="changeQty(item, -1)">—</button>
                <span class="qty-num">{{ cartQty(item.id) }}</span>
                <button class="qty-btn qty-add" @click.stop="changeQty(item, 1)">+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 商品详情页（全屏滑入） ===== -->
    <Teleport to="body">
      <transition name="slide-up">
        <div v-if="detailItem" class="detail-page">

          <!-- 详情页头部 -->
          <div class="detail-header">
            <button class="detail-back" @click="detailItem = null">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div class="detail-tabs">
              <button :class="['dtab', { active: detailTab === 'product' }]" @click="detailTab = 'product'">商品</button>
              <button :class="['dtab', { active: detailTab === 'detail' }]" @click="detailTab = 'detail'">详情</button>
            </div>
            <button class="detail-refresh" @click="loadProducts">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>

          <!-- 商品tab内容 -->
          <div v-if="detailTab === 'product'" class="detail-body">
            <!-- 图片轮播区（最多3张，横向滑动） -->
            <div class="detail-img-scroll">
              <template v-if="getImages(detailItem).length > 0">
                <img
                  v-for="(img, idx) in getImages(detailItem)"
                  :key="idx"
                  :src="img"
                  :alt="detailItem.title"
                  class="detail-img"
                  loading="lazy"
                  decoding="async"
                  @load="e => e.target.classList.add('img-loaded')"
                />
              </template>
              <div v-else class="detail-img-placeholder">📦</div>
            </div>
            <div v-if="getImages(detailItem).length > 1" class="detail-img-dots">
              <span v-for="n in getImages(detailItem).length" :key="n" class="detail-dot"></span>
            </div>

            <!-- 价格区：三种支付方式可选按钮 -->
            <div class="detail-price-section">
              <div class="dpm-label-top">选择支付方式</div>
              <div class="detail-price-multi">
                <div v-if="detailItem.price_balance > 0"
                  class="dpm-item dpm-balance"
                  :class="{ 'dpm-selected': selectedPayment === 'balance' }"
                  @click="selectedPayment = 'balance'">
                  <span class="dpm-icon">💰</span>
                  <div class="dpm-info">
                    <div class="dpm-label">学分支付</div>
                    <div class="dpm-val">$ {{ detailItem.price_balance }}</div>
                  </div>
                  <span v-if="selectedPayment === 'balance'" class="dpm-check">✓</span>
                </div>
                <div v-if="detailItem.price_shopping_coin > 0"
                  class="dpm-item dpm-coin"
                  :class="{ 'dpm-selected': selectedPayment === 'shopping_coin' }"
                  @click="selectedPayment = 'shopping_coin'">
                  <span class="dpm-icon">🛒</span>
                  <div class="dpm-info">
                    <div class="dpm-label">购物金（平级锁定）</div>
                    <div class="dpm-val">{{ detailItem.price_shopping_coin }} 购物金</div>
                  </div>
                  <span v-if="selectedPayment === 'shopping_coin'" class="dpm-check">✓</span>
                </div>
                <div v-if="detailItem.price_points > 0"
                  class="dpm-item dpm-points"
                  :class="{ 'dpm-selected': selectedPayment === 'points' }"
                  @click="selectedPayment = 'points'">
                  <span class="dpm-icon">⭐</span>
                  <div class="dpm-info">
                    <div class="dpm-label">积分兑换</div>
                    <div class="dpm-val">{{ detailItem.price_points }} 积分</div>
                  </div>
                  <span v-if="selectedPayment === 'points'" class="dpm-check">✓</span>
                </div>
              </div>
              <div class="detail-stock-row">
                <span v-if="detailItem.stock === -1" class="stock-tag">无限库存</span>
                <span v-else-if="detailItem.stock > 0" class="stock-tag">库存 {{ detailItem.stock }}</span>
                <span v-else class="stock-tag sold-out">已售罄</span>
              </div>
            </div>

            <!-- 商品名 -->
            <div class="detail-title-section">
              <h2 class="detail-name">{{ detailItem.title }}</h2>
              <div v-if="detailItem.tags" class="detail-tag-scroll">
                <span v-for="(tag, i) in parseTags(detailItem.tags)" :key="i" class="detail-tag-item">{{ tag }}</span>
              </div>
            </div>

            <!-- 服务图标 -->
            <div class="detail-service-row">
              <div class="svc-item">
                <div class="svc-icon">👍</div>
                <div class="svc-name">优选好物</div>
                <div class="svc-desc">全球寻源<br>用心选好货</div>
              </div>
              <div class="svc-item">
                <div class="svc-icon">🚚</div>
                <div class="svc-name">即时配送</div>
                <div class="svc-desc">最快30分钟<br>平台自营骑手</div>
              </div>
              <div class="svc-item">
                <div class="svc-icon">🎧</div>
                <div class="svc-name">售后无忧</div>
                <div class="svc-desc">配套售后客服<br>商品问题优先解决</div>
              </div>
            </div>

            <!-- 平级奖说明 -->
            <div v-if="detailItem.level_bonus_enabled" class="detail-bonus-banner">
              <span class="bonus-banner-icon">💰</span>
              <div>
                <div class="bonus-banner-title">直推网体平级奖励</div>
                <div class="bonus-banner-desc">购买触发6层平级奖，每层 {{ pct(detailItem.level_bonus_rate) }} · 50%到账/30%复投/10%补贴(满30→分润)/10%购物金</div>
              </div>
            </div>

            <!-- 商品详情 -->
            <div class="detail-specs-section">
              <div class="specs-title">商品详情</div>
              <div v-if="detailItem.description" class="specs-desc">{{ detailItem.description }}</div>
              <table v-if="detailItem.specs" class="specs-table">
                <tr v-for="(row, i) in parseSpecs(detailItem.specs)" :key="i">
                  <td class="specs-key">{{ row.key }}</td>
                  <td class="specs-val">{{ row.val }}</td>
                </tr>
              </table>
            </div>

            <!-- 底部空白 -->
            <div style="height:80px"></div>
          </div>

          <!-- 详情tab内容 -->
          <div v-else class="detail-body detail-info-tab">
            <div v-if="detailItem.description" class="detail-info-text">{{ detailItem.description }}</div>
            <div v-else class="detail-info-empty">暂无详细信息</div>
          </div>

          <!-- 底部操作栏 -->
          <div class="detail-footer">
            <button class="footer-fav" @click="toggleFav(detailItem)">
              <span>{{ isFav(detailItem.id) ? '❤️' : '🤍' }}</span>
              <span class="footer-label">收藏</span>
            </button>
            <button class="footer-cart-btn" @click="showCart = true">
              <span>🛒</span>
              <span class="footer-label">购物车</span>
              <span v-if="cartTotal > 0" class="footer-cart-badge">{{ cartTotal }}</span>
            </button>
            <div class="footer-qty-row">
              <button class="footer-qty-btn" @click="changeQty(detailItem, -1)">—</button>
              <span class="footer-qty-num">{{ cartQty(detailItem.id) }}</span>
              <button class="footer-qty-btn footer-qty-add" @click="changeQty(detailItem, 1)">+</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- ===== 购物车抽屉 ===== -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="showCart" class="cart-overlay" @click.self="showCart = false">
          <div class="cart-drawer">
            <div class="cart-header">
              <span class="cart-title">购物车</span>
              <button class="cart-close" @click="showCart = false">✕</button>
            </div>
            <div v-if="cartItems.length === 0" class="cart-empty">
              <div>🛒</div>
              <p>购物车空空如也</p>
            </div>
            <div v-else class="cart-list">
              <div v-for="ci in cartItems" :key="ci.id" class="cart-item">
                <img v-if="ci.image_url" :src="ci.image_url" class="ci-img" />
                <div v-else class="ci-img ci-img-ph">📦</div>
                <div class="ci-info">
                  <div class="ci-name">{{ ci.title }}</div>
                  <div class="ci-price">$ {{ ci.price_balance }}</div>
                </div>
                <div class="ci-qty-row">
                  <button class="qty-btn" @click="changeQty(ci, -1)">—</button>
                  <span class="qty-num">{{ ci.qty }}</span>
                  <button class="qty-btn qty-add" @click="changeQty(ci, 1)">+</button>
                </div>
              </div>
            </div>
            <div v-if="cartItems.length > 0" class="cart-footer">
              <div class="cart-total-row">
                <span>合计</span>
                <span class="cart-total-price">$ {{ cartSubtotal }}</span>
              </div>
              <button class="cart-checkout-btn" @click="checkout">去结算 ({{ cartTotal }}件)</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- ===== 结算弹窗 ===== -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="checkoutModal.visible" class="checkout-overlay" @click.self="checkoutModal.visible = false">
          <div class="checkout-modal">
            <h3>确认结算</h3>
            <div class="checkout-summary">
              <div v-for="ci in cartItems" :key="ci.id" class="checkout-item">
                <span class="co-name">{{ ci.title }}</span>
                <span class="co-qty">× {{ ci.qty }}</span>
                <span class="co-price">$ {{ (ci.price_balance * ci.qty).toFixed(2) }}</span>
              </div>
              <div class="checkout-total">
                <span>合计：</span>
                <span class="co-total-price">$ {{ cartSubtotal }}</span>
              </div>
            </div>
            <div class="checkout-pwd">
              <label>交易密码</label>
              <input type="password" v-model="checkoutModal.password" placeholder="请输入6位交易密码" maxlength="6" class="pwd-input" />
            </div>
            <div class="checkout-btns">
              <button class="co-cancel" @click="checkoutModal.visible = false">取消</button>
              <button class="co-confirm" :disabled="checkoutModal.loading" @click="confirmCheckout">
                {{ checkoutModal.loading ? '结算中...' : '确认付款' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getOrCreateUserId } from '../utils/auth.js'
import { useToast } from '../composables/useToast.js'

const router = useRouter()
const { success, error } = useToast()
const userId = getOrCreateUserId()

// ===== 分类标签 =====
const TABS = [
  { zone: 'uae',     main: '采购'      },
  { zone: 'partner', main: '服务商优选' },
  { zone: 'tech',    main: 'AI科技'    },
  { zone: 'cart',    main: '购物车'    },
]

// ===== 全部频道（分类网格） =====
const CHANNELS = [
  { zone: 'uae',      label: '🛒 采购' },
  { zone: 'partner',  label: '🤝 服务商优选' },
  { zone: 'tech',     label: '🤖 AI科技' },
  { zone: 'wine',     label: '🍵 茶叶精品' },
  { zone: 'food',     label: '🥗 健康食品' },
  { zone: 'home',     label: '🏠 家居百货' },
  { zone: 'fashion',  label: '👗 时尚服饰' },
  { zone: 'jewelry',  label: '💎 珠宝首饰' },
  { zone: 'beauty',   label: '💄 护肤美妆' },
  { zone: 'perfume',  label: '🌹 香料香水' },
  { zone: 'baby',     label: '🍼 母婴用品' },
  { zone: 'sport',    label: '⚽ 运动户外' },
  { zone: 'snack',    label: '🍫 特色零食' },
  { zone: 'clean',    label: '🧴 清洁用品' },
  { zone: 'bag',      label: '👜 女士包袋' },
  { zone: 'gift',     label: '🎁 工艺礼品' },
]

const showChannels = ref(false)

const activeZone = ref('uae')
const loading = ref(false)
const products = ref([])

// ===== 购物车（localStorage） =====
const CART_KEY = 'shop_cart_v1'
const cart = ref(loadCart())

function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '{}') } catch { return {} }
}
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart.value))
}

const cartItems = computed(() => {
  return Object.values(cart.value).filter(i => i.qty > 0)
})
const cartTotal = computed(() => cartItems.value.reduce((s, i) => s + i.qty, 0))
const cartSubtotal = computed(() => {
  const sum = cartItems.value.reduce((s, i) => s + i.price_balance * i.qty, 0)
  return sum.toFixed(2)
})

function cartQty(id) {
  return cart.value[id]?.qty || 0
}
function changeQty(item, delta) {
  const current = cart.value[item.id] || { ...item, qty: 0 }
  const newQty = Math.max(0, (current.qty || 0) + delta)
  if (newQty === 0) {
    delete cart.value[item.id]
  } else {
    cart.value[item.id] = { ...item, qty: newQty }
  }
  cart.value = { ...cart.value }
  saveCart()
}

// ===== 收藏 =====
const FAV_KEY = 'shop_fav_v1'
const favIds = ref(loadFav())
function loadFav() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
}
function isFav(id) { return favIds.value.includes(id) }
function toggleFav(item) {
  const idx = favIds.value.indexOf(item.id)
  if (idx >= 0) { favIds.value.splice(idx, 1) } else { favIds.value.push(item.id) }
  localStorage.setItem(FAV_KEY, JSON.stringify(favIds.value))
}

// ===== 详情页 =====
const detailItem = ref(null)
const detailTab = ref('product')
const selectedPayment = ref('balance')

function openDetail(item) {
  detailItem.value = item
  detailTab.value = 'product'
  // 默认选中第一个可用支付方式
  if (item.price_balance > 0) selectedPayment.value = 'balance'
  else if (item.price_shopping_coin > 0) selectedPayment.value = 'shopping_coin'
  else if (item.price_points > 0) selectedPayment.value = 'points'
  else selectedPayment.value = 'balance'
}

// ===== 工具函数 =====
// 解析商品图片数组（兼容JSON数组和旧版单URL）
function getImages(item) {
  if (!item?.image_url) return []
  try {
    const parsed = JSON.parse(item.image_url)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {}
  return [item.image_url].filter(Boolean)
}
function discountLabel(item) {
  if (!item.price_original || item.price_original <= item.price_balance) return ''
  const ratio = item.price_balance / item.price_original
  const zhe = Math.round(ratio * 10)
  if (zhe <= 0 || zhe >= 10) return ''
  return zhe + '折'
}
function parseTags(str) {
  if (!str) return []
  return str.split(/[|，,]/).map(s => s.trim()).filter(Boolean)
}
function parseSpecs(str) {
  if (!str) return []
  return str.split('\n').map(line => {
    const [key, ...rest] = line.split(':')
    return { key: key?.trim(), val: rest.join(':').trim() }
  }).filter(r => r.key && r.val)
}
function pct(rate) {
  return rate ? (rate * 100).toFixed(0) + '%' : '10%'
}

// ===== 购物车 / 结算 =====
const showCart = ref(false)
const checkoutModal = ref({ visible: false, password: '', loading: false })

function checkout() {
  if (cartItems.value.length === 0) return
  showCart.value = false
  checkoutModal.value = { visible: true, password: '', loading: false }
}

async function confirmCheckout() {
  if (!checkoutModal.value.password) { error('请输入交易密码'); return }
  checkoutModal.value.loading = true
  try {
    // 逐一购买购物车商品
    const results = []
    for (const item of cartItems.value) {
      for (let i = 0; i < item.qty; i++) {
        const res = await fetch('/api/products/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            productId: item.id,
            paymentType: selectedPayment.value,
            password: checkoutModal.value.password
          })
        })
        const data = await res.json()
        if (data.code !== 200) throw new Error(data.message || '购买失败')
        results.push(data)
      }
    }
    // 清空购物车
    cart.value = {}
    saveCart()
    checkoutModal.value.visible = false
    success('🎉 购买成功！平级奖励已发放至推荐链')
  } catch (e) {
    error(e.message || '结算失败，请重试')
  } finally {
    checkoutModal.value.loading = false
  }
}

// ===== 加载商品 =====
async function loadProducts() {
  loading.value = true
  products.value = []
  try {
    const res = await fetch(`/api/products/weekly?zone=${activeZone.value}&userId=${userId}`)
    const data = await res.json()
    if (data.code === 200) {
      products.value = data.data || []
    }
  } catch (e) {
    console.error('[Shop] 加载商品失败:', e)
  } finally {
    loading.value = false
  }
}

function switchZone(zone) {
  activeZone.value = zone
  if (zone !== 'cart') loadProducts()
}

function switchChannel(cat) {
  showChannels.value = false
  activeZone.value = cat.zone
  if (cat.zone !== 'cart') loadProducts()
}

function goBack() {
  router.back()
}

onMounted(loadProducts)
</script>

<style scoped>
* { box-sizing: border-box; }
.shop-wrap {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 60px;
}

/* ===== 返回键（悬浮左上角） ===== */
.hd-back {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 200;
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.12);
}
/* ===== 全部频道按钮 ===== */
.hd-channel {
  background: none;
  border: none;
  color: #555;
  padding: 6px 8px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.channel-label { color: #555; }
.channel-arrow {
  transition: transform 0.2s;
}
.channel-arrow.open {
  transform: rotate(180deg);
}

/* ===== 全部频道下拉面板 ===== */
.channel-panel {
  background: #fff;
  border-bottom: 1px solid #eee;
  padding: 12px 10px 8px;
  position: sticky;
  top: 48px;
  z-index: 99;
}
.channel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.channel-item {
  background: #f5f5f5;
  border: 1.5px solid transparent;
  border-radius: 8px;
  padding: 8px 4px;
  font-size: 12px;
  color: #444;
  cursor: pointer;
  text-align: center;
  line-height: 1.3;
  transition: all 0.15s;
}
.channel-item.active {
  background: #fff2f0;
  border-color: #FF4D4F;
  color: #FF4D4F;
  font-weight: 600;
}
.channel-drop-enter-active,
.channel-drop-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.channel-drop-enter-from,
.channel-drop-leave-to {
  opacity: 0;
  max-height: 0;
}
.channel-drop-enter-to,
.channel-drop-leave-from {
  opacity: 1;
  max-height: 300px;
}

/* ===== 购物车tab徽章 ===== */
.cart-tab-icon { font-size: 13px; }
.cart-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #FF4D4F;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  padding: 0 3px;
  margin-left: 2px;
  vertical-align: middle;
}

/* ===== 购物车内嵌区 ===== */
.cart-inline-area {
  padding: 12px 12px 80px;
  min-height: 60vh;
}
.cart-inline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
  font-size: 14px;
}
.cart-inline-footer {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-top: 12px;
}

/* ===== Category Bar ===== */
.category-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  padding: 0 4px 0 0;
}
.category-scroll {
  flex: 1;
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
}
.category-scroll::-webkit-scrollbar { display: none; }
.cat-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 18px;
  background: none;
  border: none;
  cursor: pointer;
  position: relative;
  flex: 1;
  white-space: nowrap;
}
.cat-main {
  font-size: 14px;
  font-weight: 600;
  color: #555;
}
.cat-tab.active .cat-main { color: #FF4D4F; }
.cat-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background: #FF4D4F;
  border-radius: 1px;
}

/* ===== Product Grid ===== */
.product-area {
  padding: 10px 8px;
}
.product-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.pcard {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
  cursor: pointer;
  position: relative;
  animation: cardSlideIn 0.38s ease both;
  animation-delay: var(--delay, 0s);
}
@keyframes cardSlideIn {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* 骨架卡片无动画 */
.pcard-skel {
  animation: none !important;
  cursor: default;
  pointer-events: none;
}

/* ===== 骨架屏 shimmer ===== */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skel {
  background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
  background-size: 400% 100%;
  animation: shimmer 1.3s ease infinite;
  border-radius: 4px;
}
.skel-img-area { width: 100%; aspect-ratio: 1; border-radius: 0; }
.skel-tag      { height: 13px; width: 38%; margin-bottom: 7px; }
.skel-line     { height: 11px; margin-bottom: 5px; }
.skel-lg       { width: 92%; }
.skel-md       { width: 68%; }
.skel-price-block { height: 20px; width: 42%; border-radius: 4px; }
.skel-btn-skel { height: 22px; width: 22px; border-radius: 50%; }
.pcard-badge {
  position: absolute;
  top: 0;
  left: 0;
  background: linear-gradient(90deg, #FF4D4F, #FF7A45);
  color: #fff;
  font-size: 9.5px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 0 0 8px 0;
  z-index: 1;
}
.pcard-img-wrap {
  width: 100%;
  aspect-ratio: 1;
  background: #f8f8f8;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}
.pcard-img-count {
  position: absolute;
  bottom: 4px; right: 4px;
  background: rgba(0,0,0,0.45);
  color: #fff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
}
.pcard-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.45s ease;
}
.pcard-img.img-loaded { opacity: 1; }
.pcard-img-placeholder {
  font-size: 40px;
}
.pcard-body {
  padding: 8px 8px 6px;
}
.pcard-tags-row { margin-bottom: 3px; }
.pcard-tag-nolimit {
  background: #FFF0F0;
  color: #FF4D4F;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid #FFCCC7;
}
.pcard-name {
  font-size: 12px;
  color: #222;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}
.pcard-price-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px; }
/* 三种价格标签 */
.pcard-prices { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 6px; }
.pprice { font-size: 11px; padding: 2px 5px; border-radius: 4px; white-space: nowrap; }
.pprice-balance { background: #FFF3E0; color: #E65100; font-weight: 600; }
.pprice-coin { background: #E8F5E9; color: #2E7D32; }
.pprice-points { background: #FFF8E1; color: #F57F17; }
.pcard-price {
  font-size: 16px;
  font-weight: 800;
  color: #FF4D4F;
}
.pcard-origin {
  font-size: 11px;
  color: #bbb;
  text-decoration: line-through;
}
.pcard-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pcard-discount {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #FFF3E0;
  color: #FF6B00;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 4px;
}
.pcard-qty {
  display: flex;
  align-items: center;
  gap: 4px;
}
.qty-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid #ddd;
  background: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #555;
  font-weight: 700;
  padding: 0;
  line-height: 1;
}
.qty-btn.qty-add {
  background: #FF4D4F;
  border-color: #FF4D4F;
  color: #fff;
}
.qty-num {
  min-width: 20px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #222;
}

/* ===== Empty ===== */
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }

/* ===== Detail Page ===== */
.detail-page {
  position: fixed;
  inset: 0;
  background: #f5f5f5;
  z-index: 500;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.detail-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  gap: 12px;
}
.detail-back, .detail-refresh {
  background: none;
  border: none;
  color: #333;
  padding: 4px;
  cursor: pointer;
}
.detail-tabs {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 24px;
}
.dtab {
  background: none;
  border: none;
  font-size: 15px;
  font-weight: 600;
  color: #aaa;
  cursor: pointer;
  padding-bottom: 4px;
  border-bottom: 2px solid transparent;
}
.dtab.active {
  color: #FF4D4F;
  border-bottom-color: #FF4D4F;
}
.detail-body {
  flex: 1;
  overflow-y: auto;
  background: #f5f5f5;
}
/* 3张图横向滑动轮播 */
.detail-img-scroll {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: #fff;
}
.detail-img-scroll::-webkit-scrollbar { display: none; }
.detail-img-scroll .detail-img {
  flex: 0 0 100%;
  scroll-snap-align: start;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.detail-img-scroll .detail-img.img-loaded { opacity: 1; }
.detail-img-dots {
  display: flex;
  justify-content: center;
  gap: 5px;
  padding: 6px 0;
  background: #fff;
}
.detail-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #ddd;
}
.detail-img-wrap { background: #fff; position: relative; }
.detail-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}
/* 三种价格卡片 */
.dpm-label-top { font-size: 12px; color: #999; margin-bottom: 8px; }
.detail-price-multi { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.dpm-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s; }
.dpm-balance { background: #FFF3E0; }
.dpm-coin { background: #E8F5E9; }
.dpm-points { background: #FFF8E1; }
.dpm-item.dpm-selected { border-color: #FF4D4F; }
.dpm-icon { font-size: 20px; }
.dpm-info { flex: 1; }
.dpm-label { font-size: 11px; color: #888; margin-bottom: 2px; }
.dpm-val { font-size: 15px; font-weight: 700; color: #333; }
.dpm-check { font-size: 16px; font-weight: 700; color: #FF4D4F; }
.detail-img-placeholder {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64px;
  background: #f8f8f8;
}
.detail-img-counter {
  position: absolute;
  bottom: 10px;
  right: 12px;
  background: rgba(0,0,0,.45);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}
.detail-price-section {
  background: #fff;
  padding: 14px 16px 10px;
  margin-bottom: 8px;
}
.detail-price-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-price {
  font-size: 26px;
  font-weight: 800;
  color: #FF4D4F;
}
.detail-discount-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  background: #FF6B00;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.detail-origin-price {
  font-size: 13px;
  color: #bbb;
  text-decoration: line-through;
}
.detail-stock-row { margin-top: 6px; }
.stock-tag {
  font-size: 11px;
  color: #07c160;
  background: #f0fff5;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #b7eb8f;
}
.stock-tag.sold-out { color: #999; background: #f5f5f5; border-color: #ddd; }
.detail-title-section {
  background: #fff;
  padding: 12px 16px;
  margin-bottom: 8px;
}
.detail-name {
  font-size: 17px;
  font-weight: 700;
  color: #222;
  margin: 0 0 8px;
  line-height: 1.4;
}
.detail-tag-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.detail-tag-scroll::-webkit-scrollbar { display: none; }
.detail-tag-item {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  padding: 2px 8px;
  background: #f5f5f5;
  border-radius: 10px;
}
.detail-service-row {
  background: #fff;
  display: flex;
  padding: 16px;
  gap: 0;
  margin-bottom: 8px;
}
.svc-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-right: 1px solid #f0f0f0;
}
.svc-item:last-child { border-right: none; }
.svc-icon { font-size: 24px; }
.svc-name { font-size: 12px; font-weight: 600; color: #07c160; }
.svc-desc { font-size: 10px; color: #999; text-align: center; line-height: 1.4; }

.detail-bonus-banner {
  background: linear-gradient(135deg, #FFF7E6, #FFF3CD);
  border: 1px solid #FFD591;
  border-radius: 8px;
  margin: 0 12px 8px;
  padding: 10px 12px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.bonus-banner-icon { font-size: 18px; }
.bonus-banner-title { font-size: 13px; font-weight: 700; color: #D48806; }
.bonus-banner-desc { font-size: 11px; color: #AD6800; margin-top: 2px; line-height: 1.5; }

.detail-specs-section {
  background: #fff;
  padding: 14px 16px;
  margin-bottom: 8px;
}
.specs-title {
  font-size: 15px;
  font-weight: 700;
  color: #222;
  margin-bottom: 10px;
}
.specs-desc {
  font-size: 13px;
  color: #555;
  line-height: 1.7;
  margin-bottom: 10px;
}
.specs-table { width: 100%; border-collapse: collapse; }
.specs-table tr { border-bottom: 1px solid #f5f5f5; }
.specs-table tr:last-child { border-bottom: none; }
.specs-key { padding: 8px 0; font-size: 13px; color: #999; width: 80px; }
.specs-val { padding: 8px 0; font-size: 13px; color: #333; }

.detail-info-tab {
  padding: 16px;
}
.detail-info-text {
  font-size: 14px;
  color: #444;
  line-height: 1.8;
  background: #fff;
  padding: 16px;
  border-radius: 8px;
}
.detail-info-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

/* ===== Detail Footer ===== */
.detail-footer {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
  gap: 10px;
}
.footer-fav, .footer-cart-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  color: #666;
  position: relative;
  min-width: 40px;
}
.footer-fav span:first-child, .footer-cart-btn span:first-child { font-size: 22px; }
.footer-cart-badge {
  position: absolute;
  top: -2px;
  right: -4px;
  background: #FF4D4F;
  color: #fff;
  font-size: 9px;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
}
.footer-qty-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.footer-qty-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid #ddd;
  background: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 700;
}
.footer-qty-btn.footer-qty-add {
  background: #FF4D4F;
  border-color: #FF4D4F;
  color: #fff;
}
.footer-qty-num {
  min-width: 28px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
}

/* ===== Cart Drawer ===== */
.cart-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);
  z-index: 600;
  display: flex;
  align-items: flex-end;
}
.cart-drawer {
  width: 100%;
  max-height: 70vh;
  background: #fff;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}
.cart-title { font-size: 16px; font-weight: 700; }
.cart-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; }
.cart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #999;
  font-size: 32px;
  gap: 8px;
}
.cart-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.cart-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 10px;
  border-bottom: 1px solid #f5f5f5;
}
.ci-img {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  object-fit: cover;
}
.ci-img-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: #f5f5f5;
}
.ci-info { flex: 1; }
.ci-name { font-size: 13px; color: #333; line-height: 1.4; }
.ci-price { font-size: 14px; font-weight: 700; color: #FF4D4F; margin-top: 4px; }
.ci-qty-row { display: flex; align-items: center; gap: 6px; }
.cart-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}
.cart-total-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 10px;
}
.cart-total-price { font-size: 18px; font-weight: 800; color: #FF4D4F; }
.cart-checkout-btn {
  width: 100%;
  height: 44px;
  background: #FF4D4F;
  color: #fff;
  border: none;
  border-radius: 22px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

/* ===== Checkout Modal ===== */
.checkout-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);
  z-index: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.checkout-modal {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  width: 100%;
  max-width: 340px;
}
.checkout-modal h3 { margin: 0 0 14px; font-size: 17px; }
.checkout-summary { margin-bottom: 14px; }
.checkout-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
  color: #555;
}
.co-name { flex: 1; }
.co-qty { color: #999; margin: 0 8px; }
.co-price { font-weight: 600; color: #333; }
.checkout-total {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #f0f0f0;
  padding-top: 8px;
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
}
.co-total-price { color: #FF4D4F; font-size: 16px; font-weight: 800; }
.checkout-pwd label { display: block; font-size: 13px; color: #999; margin-bottom: 6px; }
.pwd-input {
  width: 100%;
  height: 40px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  letter-spacing: 4px;
}
.checkout-btns { display: flex; gap: 10px; margin-top: 14px; }
.co-cancel {
  flex: 1;
  height: 42px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 21px;
  font-size: 14px;
  cursor: pointer;
  color: #666;
}
.co-confirm {
  flex: 2;
  height: 42px;
  background: #FF4D4F;
  color: #fff;
  border: none;
  border-radius: 21px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.co-confirm:disabled { opacity: .6; }

/* ===== Transitions ===== */
.slide-up-enter-active { animation: slideUpIn .3s ease; }
.slide-up-leave-active { animation: slideUpIn .25s ease reverse; }
@keyframes slideUpIn {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

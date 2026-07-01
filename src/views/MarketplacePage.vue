<template>
  <div class="mp-wrap">

    <!-- 顶部搜索区 -->
    <div class="mp-header">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input v-model="searchQuery" class="search-input" placeholder="搜索商品、品类..." />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">✕</button>
      </div>
    </div>

    <!-- 区域筛选 Tab -->
    <div class="region-bar">
      <button
        v-for="r in regions" :key="r.key"
        :class="['region-tab', { active: activeRegion === r.key }]"
        @click="activeRegion = r.key"
      >{{ r.flag }} {{ r.label }}</button>
    </div>

    <!-- 功能宫格 -->
    <div class="func-grid-wrap">
      <div class="func-grid">
        <button class="func-item" v-for="f in funcItems" :key="f.label" @click="f.action()">
          <div class="func-icon-box" :style="{ background: f.bg }">
            <span class="func-icon">{{ f.icon }}</span>
          </div>
          <span class="func-label">{{ f.label }}</span>
        </button>
      </div>
    </div>

    <!-- 热门商品标题 -->
    <div class="section-title-row">
      <div class="section-title">
        <span class="title-bar"></span>
        <span>热门商品</span>
      </div>
      <span class="section-more">查看更多 ›</span>
    </div>

    <!-- 品类筛选 -->
    <div class="cat-scroll-bar">
      <button
        v-for="c in categories" :key="c"
        :class="['cat-tab', { active: activeCategory === c }]"
        @click="activeCategory = c"
      >{{ c }}</button>
    </div>

    <!-- 商品网格 -->
    <div class="product-grid" v-if="!loading">
      <div
        v-for="p in filteredProducts" :key="p.id"
        class="product-card"
        @click="openDetail(p)"
      >
        <div class="product-img-wrap">
          <img :src="p.image || '/community-banner.jpg'" class="product-img" loading="lazy" />
          <div v-if="p.sold" class="sold-badge">已售{{ p.sold }}件</div>
          <div v-if="p.tag" :class="['product-tag', `tag-${p.tagType}`]">{{ p.tag }}</div>
        </div>
        <div class="product-info">
          <div class="product-name">{{ p.name }}</div>
          <div class="product-price-row">
            <span class="price-now">¥{{ p.price }}</span>
            <span v-if="p.priceOrigin" class="price-origin">¥{{ p.priceOrigin }}</span>
          </div>
          <div v-if="p.commissionRate" class="reward-tag">
            赚 {{ Math.round(p.commissionRate * p.price) }} 元佣金
          </div>
        </div>
      </div>

      <div v-if="filteredProducts.length === 0" class="empty-tip">
        <div style="font-size:40px">🛍️</div>
        <p>暂无商品，点下方"我要上架"添加</p>
        <button class="btn-upload" @click="showToast('商家入驻功能即将开放')">+ 我要上架</button>
      </div>
    </div>

    <!-- 骨架屏 -->
    <div class="product-grid" v-else>
      <div v-for="i in 6" :key="i" class="skeleton-card"></div>
    </div>

    <!-- 商品详情弹窗 -->
    <transition name="slide-up">
      <div v-if="selectedProduct" class="detail-overlay" @click.self="selectedProduct = null">
        <div class="detail-sheet">
          <div class="sheet-handle"></div>
          <img :src="selectedProduct.image || '/community-banner.jpg'" class="detail-img" />
          <div class="detail-body">
            <div class="detail-name">{{ selectedProduct.name }}</div>
            <div class="detail-price-row">
              <span class="detail-price">¥{{ selectedProduct.price }}</span>
              <span v-if="selectedProduct.priceOrigin" class="detail-origin">¥{{ selectedProduct.priceOrigin }}</span>
            </div>
            <div v-if="selectedProduct.description" class="detail-desc">{{ selectedProduct.description }}</div>
            <div v-if="selectedProduct.aiTags?.length" class="detail-ai-tags">
              <span class="ai-tags-label">✨ AI分析</span>
              <div class="ai-tags-row">
                <span v-for="t in selectedProduct.aiTags" :key="t" class="ai-tag-chip">{{ t }}</span>
              </div>
            </div>
            <div class="detail-btns">
              <button class="btn-affiliate" @click="copyLink(selectedProduct)">🔗 推广赚佣金</button>
              <button class="btn-ai-copy" @click="openAIContent(selectedProduct)">🤖 AI文案</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- AI选品弹窗 -->
    <transition name="slide-up">
      <div v-if="showAIPicker" class="detail-overlay" @click.self="showAIPicker = false">
        <div class="detail-sheet">
          <div class="sheet-handle"></div>
          <div class="picker-header">
            <span class="picker-title">✨ AI 智能选品</span>
            <button class="sheet-close" @click="showAIPicker = false">✕</button>
          </div>
          <div class="picker-body">
            <div class="picker-section-label">选择目标市场</div>
            <div class="picker-region-grid">
              <button v-for="r in regions.filter(x=>x.key!=='global')" :key="r.key"
                :class="['picker-region', { active: pickerRegion === r.key }]"
                @click="pickerRegion = r.key">
                <span style="font-size:24px">{{ r.flag }}</span>
                <span>{{ r.label }}</span>
              </button>
            </div>
            <div class="picker-section-label" style="margin-top:14px">选择品类</div>
            <div class="cat-scroll-bar" style="margin:0 0 16px">
              <button v-for="c in categories.slice(1)" :key="c"
                :class="['cat-tab', { active: pickerCat === c }]"
                @click="pickerCat = c">{{ c }}</button>
            </div>
            <button class="btn-ai-run" :disabled="aiLoading" @click="runAI">
              {{ aiLoading ? '⏳ 分析中...' : '🚀 开始AI分析' }}
            </button>
            <div v-if="aiResult" class="ai-result-box">
              <div class="ai-result-title">📊 AI 选品报告</div>
              <div class="ai-result-text" v-html="aiResult"></div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- AI文案弹窗 -->
    <transition name="slide-up">
      <div v-if="showAIContent" class="detail-overlay" @click.self="showAIContent = false">
        <div class="detail-sheet">
          <div class="sheet-handle"></div>
          <div class="picker-header">
            <span class="picker-title">🤖 AI 营销文案</span>
            <button class="sheet-close" @click="showAIContent = false">✕</button>
          </div>
          <div class="picker-body">
            <div class="content-tabs">
              <button v-for="t in contentTypes" :key="t.key"
                :class="['content-tab', { active: contentType === t.key }]"
                @click="contentType = t.key; makeContent()">{{ t.label }}</button>
            </div>
            <div v-if="contentLoading" class="content-loading">✨ AI 生成中...</div>
            <div v-else class="content-text-box">{{ generatedContent }}</div>
            <button class="btn-ai-run" style="margin-top:10px" @click="copyText(generatedContent)">📋 复制文案</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast-fade">
      <div v-if="toast" class="toast-bar">{{ toast }}</div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const searchQuery = ref('')
const activeRegion = ref('middle-east')
const activeCategory = ref('全部')
const loading = ref(false)
const products = ref([])
const selectedProduct = ref(null)
const showAIPicker = ref(false)
const pickerRegion = ref('middle-east')
const pickerCat = ref('')
const aiLoading = ref(false)
const aiResult = ref('')
const showAIContent = ref(false)
const contentType = ref('tiktok')
const contentLoading = ref(false)
const generatedContent = ref('')
const currentProduct = ref(null)
const toast = ref('')

const regions = [
  { key: 'global', flag: '🌐', label: '全部' },
  { key: 'middle-east', flag: '🇦🇪', label: '中东' },
  { key: 'sea', flag: '🌏', label: '东南亚' },
  { key: 'africa', flag: '🌍', label: '非洲' },
  { key: 'europe', flag: '🇪🇺', label: '欧洲' },
]

const categories = ['全部', '美妆护肤', '数码电子', '服饰配件', '家居生活', '健康食品', '母婴玩具']

const contentTypes = [
  { key: 'tiktok', label: '🎵 TikTok' },
  { key: 'facebook', label: '📘 Facebook' },
  { key: 'instagram', label: '📸 Instagram' },
  { key: 'ar', label: '🇦🇪 阿拉伯语' },
]

const funcItems = [
  { icon: '✨', label: 'AI选品', bg: '#FFF3CD', action: () => { showAIPicker.value = true } },
  { icon: '🌐', label: 'AI翻译', bg: '#D1ECF1', action: () => showToast('跳转AI工具中心') },
  { icon: '📢', label: 'AI文案', bg: '#F8D7DA', action: () => showToast('请先选择商品') },
  { icon: '🏭', label: '商家入驻', bg: '#D4EDDA', action: () => showToast('商家入驻即将开放') },
  { icon: '🔗', label: '推广链接', bg: '#E2D9F3', action: () => showToast('选择商品后可生成') },
  { icon: '💬', label: 'AI客服', bg: '#FFF3CD', action: () => showToast('AI客服即将上线') },
]

const filteredProducts = computed(() => {
  let list = products.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q))
  }
  if (activeCategory.value !== '全部') {
    list = list.filter(p => p.category === activeCategory.value)
  }
  return list
})

function mockProducts() {
  const region = activeRegion.value
  return [
    { id: 1, name: '智能美容仪器 Pro V3', price: 299, priceOrigin: 399, region, sold: 1688, tag: '爆款', tagType: 'hot', commissionRate: 0.15, category: '美妆护肤', aiTags: ['中东热销', '女性高转化', '高复购'], description: '专业美容仪，适合高温气候皮肤护理需求。' },
    { id: 2, name: '无线蓝牙耳机 AirMax', price: 189, priceOrigin: 259, region, sold: 1320, tag: '新品', tagType: 'new', commissionRate: 0.12, category: '数码电子', aiTags: ['年轻人首选', 'TikTok爆款'], description: '主动降噪，50小时续航。' },
    { id: 3, name: '阿拉伯风格香水礼盒', price: 399, priceOrigin: 520, region, sold: 860, tag: '精选', tagType: 'elite', commissionRate: 0.20, category: '美妆护肤', aiTags: ['中东文化契合', '礼品市场'], description: '融合东西方香型的高端礼盒。' },
    { id: 4, name: '折叠健身器材套装', price: 599, priceOrigin: 780, region, sold: 490, tag: '热销', tagType: 'hot', commissionRate: 0.18, category: '家居生活', aiTags: ['居家健身趋势', '高客单'], description: '家用健身全套，适合公寓使用。' },
    { id: 5, name: '儿童教育机器人 EduBot', price: 499, priceOrigin: 699, region, sold: 730, tag: '爆款', tagType: 'hot', commissionRate: 0.14, category: '母婴玩具', aiTags: ['家长高付费', '多语言支持'], description: '支持阿拉伯语/英语/中文，AI教学互动。' },
    { id: 6, name: '有机枸杞滋补礼盒', price: 158, priceOrigin: 198, region, sold: 320, tag: '新品', tagType: 'new', commissionRate: 0.22, category: '健康食品', aiTags: ['健康趋势', '清真认证'], description: '宁夏有机枸杞，符合清真认证。' },
  ]
}

async function loadProducts() {
  loading.value = true
  try {
    const res = await fetch(`/api/marketplace/products?region=${activeRegion.value}`)
    if (res.ok) {
      const data = await res.json()
      products.value = data.products || mockProducts()
    } else { products.value = mockProducts() }
  } catch { products.value = mockProducts() }
  finally { loading.value = false }
}

function openDetail(p) { selectedProduct.value = p }

async function copyLink(p) {
  const uid = localStorage.getItem('user_id') || 'guest'
  const link = `${location.origin}/#/marketplace?product=${p.id}&ref=${uid}`
  try { await navigator.clipboard.writeText(link); showToast('推广链接已复制 💰') }
  catch { showToast('复制失败') }
}

function openAIContent(p) {
  currentProduct.value = p
  selectedProduct.value = null
  showAIContent.value = true
  generatedContent.value = ''
  makeContent()
}

function makeContent() {
  contentLoading.value = true
  setTimeout(() => {
    const p = currentProduct.value
    const t = contentType.value
    if (t === 'tiktok') generatedContent.value = `🎵 TikTok 脚本 —— ${p?.name}\n\n前3秒钩子：\n"这款产品在迪拜卖断货了！"\n\n展示段：\n✅ 功能演示 + 使用场景\n✅ 真实用户评价\n✅ 与竞品对比\n\nCTA：\n"点购物车，今天限量特惠！"\n\n标签：#${p?.name} #迪拜好物 #海外购物`
    else if (t === 'facebook') generatedContent.value = `📘 Facebook 广告 —— ${p?.name}\n\n标题：限时特惠！阿联酋包邮！\n\n正文：\n🌟 品质保证，7天退换\n🚚 迪拜3-5天到货\n💰 首单优惠码 UAE10 立减10%\n\n立即抢购 👉 [链接]`
    else if (t === 'instagram') generatedContent.value = `📸 Instagram —— ${p?.name}\n\n✨ 今日种草好物安利！\n这款在阿联酋朋友圈疯狂刷屏 🔥\n品质超预期，服务超专业！\n\n👇 bio链接下单，专属9折码！\n\n#迪拜生活 #好物推荐 #中东华人`
    else generatedContent.value = `🇦🇪 阿拉伯语版 —— ${p?.name}\n\nمنتج ${p?.name}\nجودة عالية - شحن مجاني إلى الإمارات!\n\n✅ ضمان الجودة\n✅ توصيل خلال 3-5 أيام\n✅ خدمة على مدار الساعة\n\nاطلب الآن واحصل على خصم 10%!`
    contentLoading.value = false
  }, 1000)
}

async function runAI() {
  if (!pickerRegion.value) return
  aiLoading.value = true
  aiResult.value = ''
  await new Promise(r => setTimeout(r, 1500))
  const rLabel = regions.find(r => r.key === pickerRegion.value)?.label || ''
  aiResult.value = `<b>📊 ${rLabel} 市场热卖趋势</b><br/><br/>
  🔥 <b>TOP推荐品类</b><br/>
  1. 美容仪器 — 女性用户占68%，客单200-800元<br/>
  2. 智能数码配件 — TikTok传播快，利润率40%+<br/>
  3. 清真认证健康食品 — 竞争少，溢价空间大<br/><br/>
  💡 <b>选品要点</b><br/>
  • 体积小重量轻，物流成本低<br/>
  • 无酒精/猪皮成分，符合清真要求<br/>
  • 差异化卖点，避开速卖通红海`
  aiLoading.value = false
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); showToast('已复制！') }
  catch { showToast('复制失败') }
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

onMounted(loadProducts)
</script>

<style scoped>
* { box-sizing: border-box; }

.mp-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F7F7F7;
  overflow-y: auto;
  padding-bottom: 20px;
}

/* ===== 顶部搜索 ===== */
.mp-header {
  background: #FFC933;
  padding: 10px 12px 14px;
}
.search-box {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 22px;
  padding: 8px 14px;
  gap: 8px;
}
.search-icon { font-size: 15px; opacity: 0.5; }
.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: #333;
  background: transparent;
}
.search-input::placeholder { color: #bbb; }
.search-clear { background: none; border: none; color: #bbb; font-size: 14px; cursor: pointer; padding: 0; }

/* ===== 区域Tab ===== */
.region-bar {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #F0F0F0;
  scrollbar-width: none;
}
.region-bar::-webkit-scrollbar { display: none; }
.region-tab {
  padding: 5px 14px;
  border-radius: 16px;
  border: 1px solid #E8E8E8;
  background: #fff;
  color: #666;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}
.region-tab.active {
  background: #FFC933;
  border-color: #FFC933;
  color: #fff;
  font-weight: 700;
}

/* ===== 功能宫格 ===== */
.func-grid-wrap {
  background: #fff;
  padding: 12px;
  margin-bottom: 8px;
}
.func-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.func-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 4px;
}
.func-item:active { opacity: 0.7; }
.func-icon-box {
  width: 52px; height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.func-label {
  font-size: 12px;
  color: #333;
}

/* ===== 标题行 ===== */
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 6px;
  background: #fff;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 700;
  color: #222;
}
.title-bar {
  width: 4px; height: 16px;
  background: #FFC933;
  border-radius: 2px;
  display: inline-block;
}
.section-more { font-size: 13px; color: #FFC933; }

/* ===== 品类Tab ===== */
.cat-scroll-bar {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 8px 12px;
  background: #fff;
  scrollbar-width: none;
  margin-bottom: 8px;
}
.cat-scroll-bar::-webkit-scrollbar { display: none; }
.cat-tab {
  padding: 4px 14px;
  border-radius: 14px;
  border: 1px solid #E8E8E8;
  background: #F7F7F7;
  color: #666;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}
.cat-tab.active {
  background: #FFC933;
  border-color: #FFC933;
  color: #fff;
  font-weight: 700;
}

/* ===== 商品网格 ===== */
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 0 8px 12px;
}
.product-card {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  cursor: pointer;
  transition: transform 0.15s;
}
.product-card:active { transform: scale(0.97); }

.product-img-wrap {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: #F5F5F5;
}
.product-img { width: 100%; height: 100%; object-fit: cover; }
.sold-badge {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.35);
  color: #fff;
  font-size: 10px;
  padding: 3px 8px;
  text-align: right;
}
.product-tag {
  position: absolute;
  top: 6px; left: 6px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 8px;
}
.tag-hot { background: #FF4D4F; color: #fff; }
.tag-new { background: #52C41A; color: #fff; }
.tag-elite { background: #FAAD14; color: #fff; }

.product-info { padding: 8px 9px 10px; }
.product-name {
  font-size: 12px;
  color: #222;
  font-weight: 500;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}
.product-price-row { display: flex; align-items: baseline; gap: 5px; margin-bottom: 5px; }
.price-now { color: #FF4D4F; font-size: 16px; font-weight: 700; }
.price-origin { color: #bbb; font-size: 11px; text-decoration: line-through; }
.reward-tag {
  display: inline-block;
  background: #FFF7E6;
  color: #FA8C16;
  border: 1px solid #FFD591;
  border-radius: 8px;
  font-size: 10px;
  padding: 2px 7px;
}

/* 骨架屏 */
.skeleton-card {
  height: 200px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  border-radius: 10px;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 空状态 */
.empty-tip {
  grid-column: 1/-1;
  text-align: center;
  padding: 50px 20px;
  color: #aaa;
  font-size: 14px;
}
.btn-upload {
  margin-top: 12px;
  background: #FFC933;
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 9px 24px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

/* ===== 弹窗通用 ===== */
.detail-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.detail-sheet {
  background: #fff;
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  overflow-y: auto;
}
.sheet-handle {
  width: 36px; height: 4px;
  background: #E0E0E0;
  border-radius: 2px;
  margin: 10px auto 4px;
}

/* 详情弹窗 */
.detail-img { width: 100%; aspect-ratio: 1; object-fit: cover; }
.detail-body { padding: 14px; }
.detail-name { font-size: 16px; font-weight: 700; color: #222; margin-bottom: 10px; }
.detail-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
.detail-price { color: #FF4D4F; font-size: 22px; font-weight: 800; }
.detail-origin { color: #bbb; font-size: 13px; text-decoration: line-through; }
.detail-desc { color: #666; font-size: 13px; line-height: 1.6; margin-bottom: 12px; }
.detail-ai-tags { margin-bottom: 14px; }
.ai-tags-label { font-size: 12px; color: #FAAD14; font-weight: 700; }
.ai-tags-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ai-tag-chip {
  background: #FFF7E6;
  border: 1px solid #FFD591;
  color: #FA8C16;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 10px;
}
.detail-btns { display: flex; gap: 8px; }
.btn-affiliate {
  flex: 1;
  background: #52C41A;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.btn-ai-copy {
  flex: 1;
  background: #FFC933;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

/* 选品弹窗 */
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid #F0F0F0;
}
.picker-title { font-size: 16px; font-weight: 700; color: #222; }
.sheet-close { background: none; border: none; color: #999; font-size: 18px; cursor: pointer; }
.picker-body { padding: 14px 16px; }
.picker-section-label { font-size: 13px; color: #999; margin-bottom: 10px; }
.picker-region-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 4px;
}
.picker-region {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: #F7F7F7;
  border: 1.5px solid #E8E8E8;
  border-radius: 12px;
  padding: 12px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  transition: all 0.15s;
}
.picker-region.active {
  background: #FFF7E6;
  border-color: #FFC933;
  color: #FA8C16;
  font-weight: 700;
}
.btn-ai-run {
  width: 100%;
  background: #FFC933;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 13px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-ai-run:disabled { opacity: 0.5; cursor: not-allowed; }
.ai-result-box {
  margin-top: 14px;
  background: #FFF7E6;
  border: 1px solid #FFD591;
  border-radius: 12px;
  padding: 14px;
}
.ai-result-title { color: #FA8C16; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
.ai-result-text { color: #555; font-size: 13px; line-height: 1.8; }

/* AI文案弹窗 */
.content-tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
.content-tab {
  padding: 5px 13px;
  border-radius: 14px;
  border: 1px solid #E8E8E8;
  background: #F7F7F7;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.content-tab.active { background: #FFC933; border-color: #FFC933; color: #fff; font-weight: 700; }
.content-loading { text-align: center; padding: 30px; color: #FAAD14; font-size: 14px; }
.content-text-box {
  background: #F7F7F7;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.7;
  color: #333;
  white-space: pre-wrap;
  min-height: 120px;
}

/* Toast */
.toast-bar {
  position: fixed;
  bottom: 80px; left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.72);
  color: #fff;
  padding: 9px 20px;
  border-radius: 20px;
  font-size: 13px;
  z-index: 200;
  white-space: nowrap;
}

/* 动画 */
.slide-up-enter-active, .slide-up-leave-active { transition: opacity 0.22s, transform 0.22s; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(30px); }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
</style>

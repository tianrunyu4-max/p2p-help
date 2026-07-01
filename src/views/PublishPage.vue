<template>
  <div class="pub-wrap">

    <!-- ===== 顶部标题栏 ===== -->
    <div class="pub-topbar">
      <span class="pub-topbar-title">信息广场</span>
      <button class="pub-post-btn" @click="openDrawer">✏️ 发布</button>
    </div>

    <!-- ===== 主类型 Tab ===== -->
    <div class="filter-tabs">
      <div
        v-for="t in typeList"
        :key="t.id"
        :class="['ftab', { active: filterType === t.id }]"
        @click="selectType(t.id)"
      >{{ t.icon }} {{ t.label }}</div>
    </div>

    <!-- ===== 子分类 Tab（与发布表单分类一致） ===== -->
    <div class="filter-cats">
      <div
        :class="['fcat', { active: filterCategory === '全部' }]"
        @click="filterCategory = '全部'; currentPage = 1"
      >全部</div>
      <div
        v-for="c in subCategories"
        :key="c"
        :class="['fcat', { active: filterCategory === c }]"
        @click="filterCategory = c; currentPage = 1"
      >{{ c }}</div>
    </div>

    <!-- ===== 列表 ===== -->
    <div class="list-wrap">

      <!-- 统计信息 -->
      <div class="list-stat">
        共 <b>{{ filteredList.length }}</b> 条
        <span v-if="filterCategory !== '全部'">「{{ filterCategory }}」</span>
        信息
      </div>

      <div v-if="pagedList.length === 0" class="list-empty">
        📭 暂无信息，点击右上角「发布」发布第一条吧！
      </div>

      <div
        v-for="item in pagedList"
        :key="item.id"
        class="list-item"
        @click="openDetail(item)"
      >
        <div class="item-left">
          <div
            class="item-img"
            :class="{ placeholder: !item.images?.[0] }"
            :style="item.images?.[0] ? { backgroundImage: `url(${item.images[0]})` } : {}"
          >
            <span v-if="!item.images?.[0]">{{ typeIcon(item.type) }}</span>
          </div>
        </div>
        <div class="item-main">
          <div class="item-title">
            <span v-if="item.pinned" class="pin-badge">📌 置顶</span>{{ item.title }}
          </div>
          <div class="item-meta">
            <span class="item-tag">{{ item.category }}</span>
            <span class="item-city">📍 {{ item.city }}</span>
            <span v-if="item.salary" class="item-price">{{ item.salary }}</span>
            <span v-else-if="item.price" class="item-price">{{ item.price }} AED</span>
          </div>
          <div class="item-desc">{{ item.desc }}</div>
        </div>
        <div class="item-right">
          <span class="item-time">{{ formatTime(item.timestamp) }}</span>
        </div>
      </div>

      <!-- ===== 分页 ===== -->
      <div class="pagination">
        <button class="page-btn" @click="currentPage--" :disabled="currentPage <= 1">
          ‹ 上一页
        </button>
        <div class="page-info">
          <span class="page-cur">{{ currentPage }}</span>
          <span class="page-sep">/</span>
          <span class="page-total">{{ Math.max(totalPages, 1) }}</span>
        </div>
        <button class="page-btn" @click="currentPage++" :disabled="currentPage >= totalPages">
          下一页 ›
        </button>
      </div>

    </div>

    <!-- ===== 详情弹窗 ===== -->
    <transition name="slide-up">
      <div v-if="showDetail" class="detail-overlay" @click.self="showDetail = false">
        <div class="detail-sheet">
          <div class="detail-drag-bar"></div>
          <div class="detail-header">
            <div class="detail-type-badge">
              {{ typeIcon(selectedItem?.type) }} {{ typeLabel(selectedItem?.type) }}
              <span v-if="selectedItem?.pinned" class="pin-badge-sm">📌 置顶</span>
            </div>
            <button class="detail-close" @click="showDetail = false">✕</button>
          </div>
          <div class="detail-body">
            <h2 class="detail-title">{{ selectedItem?.title }}</h2>
            <div class="detail-tags">
              <span class="dtag">{{ selectedItem?.category }}</span>
              <span class="dtag">📍 {{ selectedItem?.city }}</span>
              <span v-if="selectedItem?.salary"   class="dtag price">{{ selectedItem?.salary }}</span>
              <span v-else-if="selectedItem?.price" class="dtag price">{{ selectedItem?.price }} AED</span>
              <span v-if="selectedItem?.quantity" class="dtag">📦 {{ selectedItem?.quantity }}</span>
            </div>
            <p class="detail-desc">{{ selectedItem?.desc }}</p>
            <div class="detail-imgs" v-if="selectedItem?.images?.length">
              <img v-for="(img, i) in selectedItem.images" :key="i" :src="img" class="detail-img" />
            </div>
            <div class="detail-contact-box">
              <div class="contact-row">
                <span class="contact-label">联系人</span>
                <span class="contact-val">{{ selectedItem?.contact }}</span>
              </div>
              <div class="contact-row">
                <span class="contact-label">联系方式</span>
                <span class="contact-val contact-phone">{{ selectedItem?.phone }}</span>
              </div>
            </div>
          </div>
          <div class="detail-footer">
            <button class="contact-btn" @click="copyPhone">📋 复制联系方式</button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onActivated } from 'vue'
import { useToast } from '../composables/useToast.js'

const { success, error } = useToast()

// ===== 类型列表（与 InfoPublishDrawer 完全一致）=====
const typeList = [
  { id: 'purchase',   icon: '📦', label: '采购需求' },
  { id: 'supply',     icon: '🏭', label: '供应信息' },
  { id: 'job',        icon: '💼', label: '招聘求职' },
  { id: 'house',      icon: '🏠', label: '房屋租售' },
  { id: 'secondhand', icon: '♻️', label: '二手交易' },
  { id: 'logistics',  icon: '🚢', label: '物流服务' },
  { id: 'service',    icon: '🔧', label: '商家服务' },
  { id: 'visa',       icon: '✈️', label: '旅游签证' },
  { id: 'social',     icon: '🎉', label: '交友聚会' },
  { id: 'promo',      icon: '📢', label: '社群广告' },
]

// ===== 子分类映射（与 InfoPublishDrawer 完全一致）=====
const categoryMap = {
  purchase:   ['电子数码','建材','食品饮料','服装纺织','酒店用品','工业品','汽配','化妆品','日用品','农产品','其他'],
  supply:     ['电子数码','建材','食品饮料','服装纺织','酒店用品','工业品','汽配','化妆品','日用品','农产品','其他'],
  job:        ['销售/客服','采购/贸易','仓储/物流','财务/会计','翻译/导游','厨师/餐饮','司机/运输','技术/IT','行政/文员','其他'],
  house:      ['单间出租','一室一卫','两室一卫','三室以上','别墅/联排','商铺出租','仓库出租','写字楼','床位出租','其他'],
  secondhand: ['手机/数码','家具/家电','汽车/摩托','服装/箱包','运动/户外','工具/设备','奢侈品','儿童用品','其他'],
  logistics:  ['海运整柜','海运拼柜','空运','国际快递','本地配送','报关/清关','仓储服务','搬家服务','其他'],
  service:    ['公司注册','签证代办','翻译/公证','会计/税务','网站/小程序','广告/设计','装修/施工','餐饮外卖','其他'],
  visa:       ['旅游签证','商务签证','居留签证','学生签证','工作签证','家属签','其他'],
  social:     ['饭局/聚餐','商务交流','同城活动','华人互助','运动健身','亲子活动','文化娱乐','其他'],
  promo:      ['微信群推广','电报群推广','品牌宣传','产品推广','活动招募','门店引流','其他'],
}

// ===== 筛选状态 =====
const filterType     = ref('purchase')
const filterCategory = ref('全部')
const currentPage    = ref(1)
const PAGE_SIZE      = 10

// ===== 当前类型的子分类 =====
const subCategories = computed(() => categoryMap[filterType.value] || [])

// 切换主类型时重置子分类和分页
const selectType = (id) => {
  filterType.value     = id
  filterCategory.value = '全部'
  currentPage.value    = 1
}

// 切换子分类时重置分页
watch(filterCategory, () => { currentPage.value = 1 })

// ===== 列表数据 =====
const loadItems = () => {
  try { return JSON.parse(localStorage.getItem('uae_publish_v1') || '[]') }
  catch { return [] }
}
const allItems = ref(loadItems())

const filteredList = computed(() =>
  allItems.value
    .filter(i =>
      i.type === filterType.value &&
      (filterCategory.value === '全部' || i.category === filterCategory.value)
    )
    .sort((a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.timestamp - a.timestamp
    )
)

const totalPages = computed(() => Math.ceil(filteredList.value.length / PAGE_SIZE))

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredList.value.slice(start, start + PAGE_SIZE)
})

// ===== 刷新列表 =====
const refreshList = () => { allItems.value = loadItems() }

onMounted(()   => { window.addEventListener('uaeInfoPublished', refreshList) })
onUnmounted(() => { window.removeEventListener('uaeInfoPublished', refreshList) })
onActivated(() => refreshList())

// ===== 打开发布 Drawer =====
const openDrawer = () => {
  window.dispatchEvent(new CustomEvent('openInfoDrawer'))
}

// ===== 工具函数 =====
const typeLabel = (id) => typeList.find(t => t.id === id)?.label || ''
const typeIcon  = (id) => typeList.find(t => t.id === id)?.icon  || '📋'

const formatTime = (ts) => {
  if (!ts) return ''
  const d     = new Date(ts)
  const diffH = Math.floor((Date.now() - d) / 3600000)
  if (diffH < 1)  return '刚刚'
  if (diffH < 24) return `${diffH}小时前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ===== 详情 =====
const showDetail   = ref(false)
const selectedItem = ref(null)

const openDetail = (item) => {
  selectedItem.value = item
  showDetail.value   = true
}

const copyPhone = () => {
  if (!selectedItem.value?.phone) return
  navigator.clipboard.writeText(selectedItem.value.phone)
    .then(() => success('联系方式已复制'))
    .catch(() => error('复制失败，请手动复制'))
}
</script>

<style scoped>
* { box-sizing: border-box; }

.pub-wrap {
  background: #f5f5f5;
  min-height: 100%;
  padding-bottom: 32px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

/* ===== 顶部标题栏 ===== */
.pub-topbar {
  background: #fff;
  padding: 13px 16px 11px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pub-topbar-title { font-size: 17px; font-weight: 700; color: #1a1a1a; }
.pub-post-btn {
  background: #07c160;
  border: none; border-radius: 16px;
  padding: 6px 14px;
  font-size: 13px; font-weight: 600; color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(7,193,96,.3);
}

/* ===== 主类型 Tab ===== */
.filter-tabs {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 6px;
  padding: 10px 16px 8px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  -webkit-overflow-scrolling: touch;
}
.filter-tabs::-webkit-scrollbar { display: none; }

.ftab {
  padding: 5px 12px;
  border-radius: 14px;
  border: 1px solid #e0e0e0;
  background: #fff;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  color: #666;
  flex-shrink: 0;
  transition: .15s;
}
.ftab.active {
  background: #07c160;
  color: #fff;
  border-color: #07c160;
  font-weight: 600;
}

/* ===== 子分类 Tab ===== */
.filter-cats {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 6px;
  padding: 8px 16px;
  background: #f8f8f8;
  border-bottom: 1px solid #eeeeee;
  -webkit-overflow-scrolling: touch;
}
.filter-cats::-webkit-scrollbar { display: none; }

.fcat {
  padding: 3px 10px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  background: #fff;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  color: #888;
  flex-shrink: 0;
  transition: .15s;
}
.fcat.active {
  background: #e8f5e9;
  color: #07c160;
  border-color: #07c160;
  font-weight: 600;
}

/* ===== 列表 ===== */
.list-wrap { background: #fff; }

.list-stat {
  padding: 8px 16px 6px;
  font-size: 12px;
  color: #aaa;
  border-bottom: 1px solid #f5f5f5;
}
.list-stat b { color: #07c160; }

.list-empty {
  text-align: center;
  padding: 50px 20px;
  color: #c0c0c0;
  font-size: 14px;
  line-height: 1.8;
}

.list-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.list-item:active { background: #fafaf8; }

.item-left { flex-shrink: 0; }
.item-img {
  width: 72px; height: 60px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  background-color: #f0f4ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
}

.item-main { flex: 1; min-width: 0; }
.item-title {
  font-size: 14px; font-weight: 600; color: #1a1a1a;
  margin-bottom: 5px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pin-badge { font-size: 10px; color: #c8a84b; margin-right: 4px; vertical-align: middle; }

.item-meta {
  display: flex; flex-wrap: wrap; gap: 5px;
  margin-bottom: 4px; align-items: center;
}
.item-tag {
  font-size: 10px; background: #f0fff5; color: #07c160;
  padding: 1px 6px; border-radius: 10px;
}
.item-city  { font-size: 11px; color: #999; }
.item-price { font-size: 13px; color: #e67e22; font-weight: 600; }

.item-desc {
  font-size: 12px; color: #bbb;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.item-right { flex-shrink: 0; padding-top: 2px; }
.item-time  { font-size: 11px; color: #c8c8c8; }

/* ===== 分页 ===== */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #f5f5f5;
}
.page-btn {
  padding: 7px 18px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  background: #fff;
  color: #555;
  font-size: 13px;
  cursor: pointer;
  transition: .15s;
}
.page-btn:not(:disabled):hover { border-color: #07c160; color: #07c160; }
.page-btn:disabled { opacity: .35; cursor: not-allowed; }

.page-info {
  display: flex;
  align-items: baseline;
  gap: 3px;
  min-width: 60px;
  justify-content: center;
}
.page-cur   { font-size: 18px; font-weight: 700; color: #07c160; }
.page-sep   { font-size: 14px; color: #ccc; }
.page-total { font-size: 14px; color: #aaa; }

/* ===== 详情弹窗 ===== */
.detail-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.52);
  z-index: 200;
  display: flex; align-items: flex-end;
}
.detail-sheet {
  background: #fff; width: 100%;
  border-radius: 16px 16px 0 0;
  max-height: 88vh;
  display: flex; flex-direction: column;
}
.detail-drag-bar {
  width: 36px; height: 4px;
  background: #e0e0e0; border-radius: 2px;
  margin: 10px auto 0; flex-shrink: 0;
}
.detail-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px 10px;
  border-bottom: 1px solid #f0f0f0; flex-shrink: 0;
}
.detail-type-badge { font-size: 13px; color: #07c160; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.pin-badge-sm { font-size: 11px; color: #c8a84b; }
.detail-close { background: none; border: none; font-size: 18px; color: #bbb; cursor: pointer; padding: 0 4px; }

.detail-body {
  flex: 1; overflow-y: auto; padding: 16px;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.detail-body::-webkit-scrollbar { display: none; }

.detail-title { font-size: 17px; font-weight: 700; color: #1a1a1a; margin: 0 0 10px; line-height: 1.4; }
.detail-tags  { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.dtag {
  font-size: 12px; background: #f5f5f5; color: #666;
  padding: 3px 8px; border-radius: 10px;
}
.dtag.price { background: #fff5e8; color: #e67e22; font-weight: 600; }
.detail-desc { font-size: 14px; color: #444; line-height: 1.7; margin-bottom: 14px; white-space: pre-wrap; }
.detail-imgs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 14px; }
.detail-img  { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }

.detail-contact-box { background: #f9f9f9; border-radius: 10px; padding: 12px 14px; }
.contact-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px solid #f0f0f0;
}
.contact-row:last-child { border-bottom: none; }
.contact-label { font-size: 13px; color: #999; }
.contact-val   { font-size: 14px; color: #1a1a1a; font-weight: 500; }
.contact-phone { color: #07c160; }

.detail-footer { padding: 12px 16px; border-top: 1px solid #f0f0f0; flex-shrink: 0; }
.contact-btn {
  width: 100%; padding: 13px;
  background: #07c160; color: #fff; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 700;
  cursor: pointer;
}

/* ===== 动画 ===== */
.slide-up-enter-active, .slide-up-leave-active { transition: all .28s ease; }
.slide-up-enter-from, .slide-up-leave-to       { opacity: 0; }
.slide-up-enter-from .detail-sheet,
.slide-up-leave-to   .detail-sheet { transform: translateY(100%); }
</style>

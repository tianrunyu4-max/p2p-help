<template>
  <!-- Fixed overlay covers full viewport -->
  <div class="ipd-overlay" @click.self="$emit('close')">
    <div class="ipd-sheet">
      <div class="ipd-drag-bar"></div>

      <!-- ===== Tab Header ===== -->
      <div class="ipd-header">
        <div class="ipd-tabs">
          <button
            :class="['ipd-tab', { active: activeTab === 'publish' }]"
            @click="activeTab = 'publish'"
          >📝 发布信息</button>
          <button
            :class="['ipd-tab', { active: activeTab === 'top' }]"
            @click="activeTab = 'top'"
          >🔝 置顶信息</button>
        </div>
        <button class="ipd-close" @click="$emit('close')">✕</button>
      </div>

      <!-- ===== Scrollable Body ===== -->
      <div class="ipd-body">

        <!-- 置顶说明 -->
        <div v-if="activeTab === 'top'" class="top-notice">
          📌 置顶后您的信息将排在同类列表最前，提升曝光率（已付费用户专区）
        </div>

        <!-- 类型选择 - 国内 + 阿联酋 两行 -->
        <div class="type-section">
          <div class="type-group-label">🇨🇳 国内</div>
          <div class="type-row-wrap">
            <div
              v-for="t in domesticTypes"
              :key="t.id"
              :class="['type-btn', { active: form.type === t.id }]"
              @click="form.type = t.id"
            >
              <span class="type-icon">{{ t.icon }}</span>
              <span class="type-name">{{ t.label }}</span>
            </div>
          </div>
          <div class="type-divider">
            <span class="type-divider-line"></span>
            <span class="type-divider-label">🇦🇪 阿联酋</span>
            <span class="type-divider-line"></span>
          </div>
          <div class="type-row-wrap">
            <div
              v-for="t in uaeTypes"
              :key="t.id"
              :class="['type-btn', { active: form.type === t.id }]"
              @click="form.type = t.id"
            >
              <span class="type-icon">{{ t.icon }}</span>
              <span class="type-name">{{ t.label }}</span>
            </div>
          </div>
        </div>

        <!-- 标题 -->
        <div class="field-row">
          <div class="field-label">标题 <em>*</em></div>
          <input v-model="form.title" class="field-input" :placeholder="titlePlaceholder" maxlength="40" />
          <span class="char-tip">{{ form.title.length }}/40</span>
        </div>

        <!-- 分类（+ 城市，国内分类不显示城市） -->
        <div class="field-row-2">
          <div :class="isDomestic ? 'field-full' : 'field-half'">
            <div class="field-label">分类 <em>*</em></div>
            <select v-model="form.category" class="field-select">
              <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="field-half" v-if="!isDomestic">
            <div class="field-label">
              城市 <em>*</em>
              <button class="locate-btn" @click.stop="locateCity" :disabled="locating">
                {{ locating ? '定位中...' : '📍 定位' }}
              </button>
            </div>
            <select v-model="form.city" class="field-select">
              <option v-for="c in cityOptions" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <!-- 数量/规格（采购/供应） -->
        <div class="field-row" v-if="['purchase','supply'].includes(form.type)">
          <div class="field-label">数量/规格</div>
          <input v-model="form.quantity" class="field-input" placeholder="例：10000套 / 5吨 / 长期" />
        </div>

        <!-- 薪资（招聘） -->
        <div class="field-row" v-if="form.type === 'job'">
          <div class="field-label">薪资</div>
          <input v-model="form.salary" class="field-input" placeholder="例：6000AED/月 / 面议" />
        </div>

        <!-- 价格（房屋/二手） -->
        <div class="field-row" v-if="['house','secondhand'].includes(form.type)">
          <div class="field-label">{{ form.type === 'house' ? '租金/价格' : '出售价格' }}</div>
          <div class="price-input-wrap">
            <input v-model="form.price" class="field-input price-inp" type="number" placeholder="0" />
            <span class="price-unit">AED</span>
          </div>
        </div>

        <!-- 描述 -->
        <div class="field-row">
          <div class="field-label">描述 <em>*</em></div>
          <textarea
            v-model="form.desc"
            class="field-textarea"
            :placeholder="descPlaceholder"
            rows="3"
            maxlength="300"
          ></textarea>
          <span class="char-tip">{{ form.desc.length }}/300</span>
        </div>

        <!-- 图片（发布信息时显示） -->
        <div class="field-row" v-if="activeTab === 'publish'">
          <div class="field-label">图片（选填）</div>
          <div class="img-upload-row">
            <div
              v-for="(img, i) in form.images"
              :key="i"
              class="img-thumb"
              :style="{ backgroundImage: `url(${img})` }"
            >
              <button class="img-del" @click="form.images.splice(i, 1)">×</button>
            </div>
            <label v-if="form.images.length < 6" class="img-add">
              <input type="file" accept="image/*" hidden @change="handleImgUpload" />
              <span class="img-add-icon">📷</span>
              <span class="img-add-txt">添加</span>
            </label>
          </div>
          <div class="field-hint">最多6张，支持 jpg/png</div>
        </div>

        <!-- 联系人 + 电话 -->
        <div class="field-row-2">
          <div class="field-half">
            <div class="field-label">联系人 <em>*</em></div>
            <input v-model="form.contact" class="field-input" placeholder="姓名" />
          </div>
          <div class="field-half">
            <div class="field-label">电话/微信 <em>*</em></div>
            <input v-model="form.phone" class="field-input" placeholder="+971 / 微信号" />
          </div>
        </div>

        <div style="height:16px"></div>
      </div>

      <!-- ===== 提交按钮 ===== -->
      <div class="ipd-footer">
        <button class="submit-btn" @click="handleSubmit" :disabled="isSubmitting">
          {{ isSubmitting ? '提交中...' : (activeTab === 'publish' ? '立即发布' : '申请置顶') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useToast } from '../composables/useToast.js'
import { useUserStore } from '../stores/userStore.js'

const props = defineProps({
  defaultType: { type: String, default: 'latest' }
})

const emit = defineEmits(['close', 'success', 'subscribe-required'])
const { success, error } = useToast()
const userStore = useUserStore()

// 国内分类（不需要城市定位）
const DOMESTIC_TYPES = new Set(['latest', 'network', 'ai', 'free', 'antiscam'])
const isDomestic = computed(() => DOMESTIC_TYPES.has(form.value?.type))

const activeTab = ref('publish')
const isSubmitting = ref(false)
const locating = ref(false)

// ===== 类型列表 =====
// 国内频道（第一行）
const domesticTypes = [
  { id: 'latest',   icon: '🔥', label: '最新项目' },
  { id: 'network',  icon: '👥', label: '人脉团队' },
  { id: 'ai',       icon: '🤖', label: 'AI科技' },
  { id: 'free',     icon: '🎁', label: '免费资源' },
  { id: 'antiscam', icon: '🛡️', label: '防骗宣传' },
]
// 阿联酋频道（第二行）
const uaeTypes = [
  { id: 'supply',    icon: '🏭', label: '供应信息' },
  { id: 'house',     icon: '🏠', label: '房屋租售' },
  { id: 'logistics', icon: '🚢', label: '物流服务' },
  { id: 'visa',      icon: '✈️', label: '旅游签证' },
  { id: 'job',       icon: '💼', label: '招聘求职' },
]
const typeList = [...domesticTypes, ...uaeTypes]

const categoryMap = {
  // 国内频道
  latest:   ['创业项目','副业兼职','投资机会','合伙招募','加盟项目','其他'],
  network:  ['商务合作','寻找合伙人','团队扩张','资源对接','行业交流','其他'],
  ai:       ['AI工具推荐','AI应用开发','大模型资讯','自动化办公','AI创业','其他'],
  free:     ['免费课程','免费工具','免费素材','免费资讯','公益资源','其他'],
  antiscam: ['诈骗案例','防骗技巧','黑名单预警','维权经验','风险提示','其他'],
  // 阿联酋频道
  supply:    ['电子数码','建材','食品饮料','服装纺织','酒店用品','工业品','汽配','化妆品','日用品','农产品','其他'],
  house:     ['单间出租','一室一卫','两室一卫','三室以上','别墅/联排','商铺出租','仓库出租','写字楼','床位出租','其他'],
  logistics: ['海运整柜','海运拼柜','空运','国际快递','本地配送','报关/清关','仓储服务','搬家服务','其他'],
  visa:      ['旅游签证','商务签证','居留签证','学生签证','工作签证','家属签','其他'],
  job:       ['销售/客服','采购/贸易','仓储/物流','财务/会计','翻译/导游','厨师/餐饮','司机/运输','技术/IT','行政/文员','其他'],
}

const cityOptions = [
  '迪拜·国际城','迪拜·龙城','迪拜·迪拜码头','迪拜·JBR','迪拜·Downtown',
  '迪拜·Business Bay','迪拜·Dubai Hills','迪拜·Deira','迪拜·Bur Dubai',
  '迪拜·Al Quoz工业区','迪拜·杰贝阿里','迪拜（其他）',
  '阿布扎比·市中心','阿布扎比·Al Reem岛','阿布扎比·Yas岛','阿布扎比（其他）',
  '沙迦·市中心','沙迦·工业区','沙迦（其他）',
  '阿吉曼','乌姆盖万','富查伊拉','哈伊马角',
  '阿联酋全境',
]

const form = ref({
  type: props.defaultType,
  title: '',
  category: (categoryMap[props.defaultType] || ['其他'])[0],
  city: '迪拜·国际城',
  quantity: '',
  salary: '',
  price: '',
  desc: '',
  images: [],
  contact: '',
  phone: '',
})

const categoryOptions = computed(() => categoryMap[form.value.type] || ['其他'])

watch(() => form.value.type, (t) => {
  form.value.category = (categoryMap[t] || ['其他'])[0]
})

const titlePlaceholder = computed(() => {
  const m = {
    latest:   '例：国内某项目招募合伙人，月入可达XX',
    network:  '例：寻找跨境电商合伙人，有资源有渠道',
    ai:       '例：推荐一款效率神器，免费使用中',
    free:     '例：分享免费XX工具/课程/资源',
    antiscam: '例：警惕！这类骗局正在蔓延，附真实案例',
    supply:   '例：手机配件批发，迪拜仓现货',
    house:    '例：国际城单间出租，独立卫生间',
    logistics:'例：中国-迪拜海运整柜/拼柜',
    visa:     '例：阿联酋旅游签证快速办理',
    job:      '例：招销售经理，迪拜XX贸易',
  }
  return m[form.value.type] || '请输入标题'
})

const descPlaceholder = computed(() => {
  const m = {
    latest:   '请描述项目背景、盈利模式、加入条件...',
    network:  '请描述您的资源优势、合作需求、期望对接方向...',
    ai:       '请描述工具功能、使用场景、获取方式...',
    free:     '请描述资源内容、获取方式、适用人群...',
    antiscam: '请描述骗局手法、受害情况、提醒注意事项...',
    supply:   '请描述产品特点、库存状况、价格政策...',
    house:    '请描述房型、装修状况、配套设施、入住时间...',
    logistics:'请描述服务路线、时效、价格、优势...',
    visa:     '请描述签证类型、办理时间、所需材料...',
    job:      '请描述岗位职责、要求、福利待遇...',
  }
  return m[form.value.type] || '请详细描述...'
})

const locateCity = () => {
  if (!navigator.geolocation) return
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    ({ coords: { latitude: lat, longitude: lng } }) => {
      let city = '阿联酋全境'
      if      (lat >= 25.0 && lat <= 25.4  && lng >= 55.1 && lng <= 55.5) city = '迪拜·国际城'
      else if (lat >= 25.0 && lat <= 25.35 && lng >= 55.05 && lng <= 55.25) city = '迪拜·Bur Dubai'
      else if (lat >= 25.05 && lat <= 25.25 && lng >= 55.2 && lng <= 55.45) city = '迪拜·Deira'
      else if (lat >= 25.1 && lat <= 25.23 && lng >= 55.13 && lng <= 55.22) city = '迪拜·Downtown'
      else if (lat >= 25.05 && lat <= 25.12 && lng >= 55.12 && lng <= 55.18) city = '迪拜·杰贝阿里'
      else if (lat >= 24.3 && lat <= 24.6  && lng >= 54.2 && lng <= 54.8) city = '阿布扎比·市中心'
      else if (lat >= 25.3 && lat <= 25.5  && lng >= 55.3 && lng <= 55.6) city = '沙迦·市中心'
      else if (lat >= 25.4 && lat <= 25.6  && lng >= 55.4 && lng <= 55.6) city = '阿吉曼'
      else if (lat >= 25.55 && lat <= 25.75 && lng >= 55.6 && lng <= 55.9) city = '乌姆盖万'
      else if (lat >= 25.1 && lat <= 25.35 && lng >= 56.2 && lng <= 56.5) city = '富查伊拉'
      else if (lat >= 25.6 && lat <= 26.0  && lng >= 55.7 && lng <= 56.2) city = '哈伊马角'
      else if (lat >= 24.7 && lat <= 25.4  && lng >= 54.8 && lng <= 55.6) city = '迪拜（其他）'
      form.value.city = city
      locating.value = false
    },
    () => { locating.value = false }
  )
}

const handleImgUpload = (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { error('图片不能超过5MB'); return }
  const reader = new FileReader()
  reader.onload = ev => { form.value.images.push(ev.target.result) }
  reader.readAsDataURL(file)
}

const handleSubmit = () => {
  // 未激活用户：跳转订阅弹窗
  if (!userStore.isActivated) {
    emit('subscribe-required')
    return
  }

  const { title, desc, contact, phone, city } = form.value
  if (!title.trim())   { error('请填写标题'); return }
  if (!desc.trim())    { error('请填写描述'); return }
  if (!isDomestic.value && !city) { error('请选择城市'); return }
  if (!contact.trim()) { error('请填写联系人'); return }
  if (!phone.trim())   { error('请填写联系方式'); return }

  isSubmitting.value = true
  setTimeout(() => {
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem('uae_publish_v1') || '[]') } catch { return [] }
    })()

    const item = {
      id: Date.now(),
      timestamp: Date.now(),
      pinned: activeTab.value === 'top',
      ...JSON.parse(JSON.stringify(form.value)),
    }
    existing.unshift(item)
    localStorage.setItem('uae_publish_v1', JSON.stringify(existing))

    // 通知 PublishPage.vue 刷新列表
    window.dispatchEvent(new CustomEvent('uaeInfoPublished', { detail: item }))

    isSubmitting.value = false
    success(activeTab.value === 'publish' ? '发布成功！审核后即可显示' : '置顶信息已提交！将优先展示')

    // 保留类型/城市/分类，清空其他字段
    const { type, category, city } = form.value
    form.value = { type, category, city, title: '', quantity: '', salary: '', price: '', desc: '', images: [], contact: '', phone: '' }

    emit('success')
  }, 500)
}
</script>

<style scoped>
* { box-sizing: border-box; }

/* ===== 遮罩 + Sheet ===== */
.ipd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.52);
  z-index: 500;
  display: flex;
  align-items: flex-end;
}

.ipd-sheet {
  background: #fff;
  width: 100%;
  max-width: 430px;   /* match phone-container */
  margin: 0 auto;
  border-radius: 18px 18px 0 0;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  animation: sheetUp .28s cubic-bezier(.32,.72,0,1) both;
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

.ipd-drag-bar {
  width: 36px; height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin: 10px auto 0;
  flex-shrink: 0;
}

/* ===== Tab Header ===== */
.ipd-header {
  display: flex;
  align-items: center;
  padding: 10px 16px 0;
  flex-shrink: 0;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 0;
}

.ipd-tabs {
  display: flex;
  flex: 1;
  gap: 4px;
}

.ipd-tab {
  padding: 10px 16px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: #999;
  cursor: pointer;
  border-bottom: 2.5px solid transparent;
  transition: color .15s, border-color .15s;
  white-space: nowrap;
}
.ipd-tab.active {
  color: #07c160;
  border-bottom-color: #07c160;
}

.ipd-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #bbb;
  cursor: pointer;
  padding: 0 4px 10px;
}

/* ===== Body ===== */
.ipd-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.ipd-body::-webkit-scrollbar { display: none; }

/* 置顶提示 */
.top-notice {
  margin: 10px 16px 0;
  padding: 8px 12px;
  background: #fffbf0;
  border: 1px solid #f0e0a0;
  border-radius: 8px;
  font-size: 12px;
  color: #c8a84b;
  line-height: 1.5;
}

/* ===== 类型选择 - 国内+阿联酋两行 ===== */
.type-section {
  padding: 8px 12px 10px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}
.type-group-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}
.type-row-wrap {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-bottom: 4px;
}
.type-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 6px;
}
.type-divider-line {
  flex: 1;
  height: 1px;
  background: #e8e8e8;
}
.type-divider-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  white-space: nowrap;
  letter-spacing: 0.5px;
}
.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 64px;
  border: 1.5px solid #ebebeb;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: .15s;
  -webkit-tap-highlight-color: transparent;
}
.type-btn.active {
  border-color: #07c160;
  background: #f0fff5;
}
.type-icon { font-size: 20px; line-height: 1; }
.type-name { font-size: 10px; color: #555; }
.type-btn.active .type-name { color: #07c160; font-weight: 600; }

/* ===== 表单字段 ===== */
.field-row {
  padding: 11px 16px;
  border-bottom: 1px solid #f5f5f5;
  position: relative;
  background: #fff;
}
.field-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid #f5f5f5;
  background: #fff;
}
.field-half {
  padding: 11px 12px 11px 16px;
}
.field-half:first-child { border-right: 1px solid #f5f5f5; }
.field-full {
  grid-column: 1 / -1;
  padding: 11px 12px 11px 16px;
}

.field-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.field-label em { color: #ff4d4f; font-style: normal; margin-left: 2px; }

.locate-btn {
  float: right;
  background: none;
  border: none;
  font-size: 11px;
  color: #07c160;
  cursor: pointer;
  padding: 0;
}
.locate-btn:disabled { color: #bbb; cursor: not-allowed; }

.field-input {
  width: 100%;
  border: none;
  outline: none;
  font-size: 14px;
  color: #1a1a1a;
  background: transparent;
  padding: 0;
}
.field-input::placeholder { color: #c0c0c0; }

.field-select {
  width: 100%;
  border: none;
  outline: none;
  font-size: 14px;
  color: #1a1a1a;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  padding: 0;
  cursor: pointer;
}

.field-textarea {
  width: 100%;
  border: none;
  outline: none;
  font-size: 14px;
  color: #1a1a1a;
  background: transparent;
  resize: none;
  padding: 0;
  line-height: 1.6;
  font-family: inherit;
}
.field-textarea::placeholder { color: #c0c0c0; }

.char-tip {
  position: absolute;
  right: 16px;
  bottom: 11px;
  font-size: 11px;
  color: #ccc;
}

.price-input-wrap { display: flex; align-items: center; gap: 6px; }
.price-inp { flex: 1; }
.price-unit { font-size: 13px; color: #999; white-space: nowrap; }
.field-hint { font-size: 11px; color: #c0c0c0; margin-top: 4px; }

/* 图片上传 */
.img-upload-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.img-thumb {
  width: 64px; height: 64px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  position: relative;
  flex-shrink: 0;
}
.img-del {
  position: absolute;
  top: -6px; right: -6px;
  width: 18px; height: 18px;
  background: rgba(0,0,0,.55);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 13px;
  line-height: 17px;
  text-align: center;
  cursor: pointer;
  padding: 0;
}
.img-add {
  width: 64px; height: 64px;
  border-radius: 8px;
  border: 1.5px dashed #d0d0d0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  background: #fafafa;
}
.img-add-icon { font-size: 20px; }
.img-add-txt { font-size: 10px; color: #bbb; margin-top: 2px; }

/* ===== 底部提交按钮 ===== */
.ipd-footer {
  padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
  background: #fff;
}
.submit-btn {
  width: 100%;
  padding: 13px;
  background: #07c160;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 1px;
}
.submit-btn:active { opacity: .9; }
.submit-btn:disabled { background: #b2dfc4; cursor: not-allowed; }
</style>

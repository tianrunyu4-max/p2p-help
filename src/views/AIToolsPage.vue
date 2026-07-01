<template>
  <div class="at-wrap">

    <!-- 顶部 Banner -->
    <div class="at-banner">
      <div class="at-banner-left">
        <div class="at-banner-title">🧠 AI 工具中心</div>
        <div class="at-banner-sub">选品 · 翻译 · 营销 · 客服</div>
      </div>
      <div class="at-banner-icon">🚀</div>
    </div>

    <!-- 统计栏 -->
    <div class="stats-bar">
      <div class="stat-cell" v-for="s in stats" :key="s.label">
        <div class="stat-num">{{ s.num }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- 工具宫格入口 -->
    <div class="tool-grid-section">
      <div class="tool-grid">
        <button
          v-for="t in toolItems" :key="t.key"
          :class="['tool-grid-item', { active: activeKey === t.key }]"
          @click="toggleTool(t.key)"
        >
          <div class="tool-grid-icon" :style="{ background: t.bg }">{{ t.icon }}</div>
          <div class="tool-grid-name">{{ t.name }}</div>
          <div class="tool-grid-desc">{{ t.desc }}</div>
        </button>
      </div>
    </div>

    <!-- 工具内容区 -->
    <transition name="panel-fade" mode="out-in">

      <!-- AI 选品 -->
      <div v-if="activeKey === 'selection'" key="selection" class="tool-panel">
        <div class="panel-title">🔍 AI 智能选品</div>
        <div class="form-item">
          <div class="form-label">目标市场</div>
          <div class="chip-row">
            <button v-for="r in regions" :key="r.key"
              :class="['chip', { active: selForm.region === r.key }]"
              @click="selForm.region = r.key">{{ r.flag }} {{ r.label }}</button>
          </div>
        </div>
        <div class="form-item">
          <div class="form-label">品类偏好</div>
          <div class="chip-row">
            <button v-for="c in cats" :key="c"
              :class="['chip', { active: selForm.cat === c }]"
              @click="selForm.cat = c">{{ c }}</button>
          </div>
        </div>
        <div class="form-item">
          <div class="form-label">预算区间</div>
          <div class="chip-row">
            <button v-for="b in budgets" :key="b"
              :class="['chip', { active: selForm.budget === b }]"
              @click="selForm.budget = b">{{ b }}</button>
          </div>
        </div>
        <button class="btn-yellow" :disabled="loading === 'selection'" @click="runTool('selection')">
          {{ loading === 'selection' ? '⏳ 分析中...' : '🚀 开始AI分析' }}
        </button>
        <div v-if="results.selection" class="result-card">
          <div class="result-card-title">📊 AI 选品报告</div>
          <div class="result-card-body" v-html="results.selection"></div>
        </div>
      </div>

      <!-- AI 翻译 -->
      <div v-else-if="activeKey === 'translate'" key="translate" class="tool-panel">
        <div class="panel-title">🌐 AI 多语言翻译</div>
        <div class="form-item">
          <div class="form-label">输入中文内容</div>
          <textarea v-model="transForm.text" class="form-textarea" rows="4" placeholder="输入商品名称、描述或营销文案..."></textarea>
        </div>
        <div class="form-item">
          <div class="form-label">目标语言（可多选）</div>
          <div class="lang-grid">
            <label v-for="l in langs" :key="l.key" class="lang-check">
              <input type="checkbox" v-model="transForm.targets" :value="l.key" />
              <span>{{ l.flag }} {{ l.label }}</span>
            </label>
          </div>
        </div>
        <button class="btn-yellow" :disabled="loading === 'translate' || !transForm.text" @click="runTool('translate')">
          {{ loading === 'translate' ? '⏳ 翻译中...' : '🌐 立即翻译' }}
        </button>
        <div v-if="results.translate" class="result-card">
          <div v-for="(txt, lang) in results.translate" :key="lang" class="trans-item">
            <div class="trans-lang">{{ getLang(lang) }}</div>
            <div class="trans-text" :dir="lang === 'ar' ? 'rtl' : 'ltr'">{{ txt }}</div>
            <button class="btn-copy-sm" @click="copy(txt)">📋 复制</button>
          </div>
        </div>
      </div>

      <!-- AI 营销 -->
      <div v-else-if="activeKey === 'marketing'" key="marketing" class="tool-panel">
        <div class="panel-title">📢 AI 营销文案</div>
        <div class="form-item">
          <div class="form-label">商品名称</div>
          <input v-model="mktForm.name" class="form-input" placeholder="如：智能美容仪 Pro V3" />
        </div>
        <div class="form-item">
          <div class="form-label">发布平台</div>
          <div class="chip-row">
            <button v-for="p in platforms" :key="p.key"
              :class="['chip', { active: mktForm.platform === p.key }]"
              @click="mktForm.platform = p.key">{{ p.icon }} {{ p.label }}</button>
          </div>
        </div>
        <div class="form-item">
          <div class="form-label">目标受众</div>
          <input v-model="mktForm.audience" class="form-input" placeholder="如：中东女性 25-40岁" />
        </div>
        <div class="form-item">
          <div class="form-label">核心卖点</div>
          <textarea v-model="mktForm.points" class="form-textarea" rows="2" placeholder="如：主动降噪、50小时续航..."></textarea>
        </div>
        <button class="btn-yellow" :disabled="loading === 'marketing' || !mktForm.name" @click="runTool('marketing')">
          {{ loading === 'marketing' ? '⏳ 写作中...' : '✍️ 生成文案' }}
        </button>
        <div v-if="results.marketing" class="result-card">
          <div class="result-card-title">📝 AI 文案</div>
          <div class="result-card-pre">{{ results.marketing }}</div>
          <button class="btn-copy-sm" style="margin-top:10px" @click="copy(results.marketing)">📋 复制全部</button>
        </div>
      </div>

      <!-- AI 客服 -->
      <div v-else-if="activeKey === 'service'" key="service" class="tool-panel">
        <div class="panel-title">💬 AI 客服体验</div>
        <div class="chat-box" ref="chatBox">
          <div v-for="m in chat" :key="m.id" :class="['chat-row', m.role]">
            <div v-if="m.role === 'assistant'" class="chat-avatar">🤖</div>
            <div class="chat-bubble">{{ m.content }}</div>
            <div v-if="m.role === 'user'" class="chat-avatar-r">👤</div>
          </div>
          <div v-if="chatLoading" class="chat-row assistant">
            <div class="chat-avatar">🤖</div>
            <div class="chat-bubble typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
        <div class="preset-row">
          <button v-for="q in presets" :key="q" class="preset-btn" @click="sendChat(q)">{{ q }}</button>
        </div>
        <div class="chat-input-row">
          <input v-model="chatInput" class="form-input" placeholder="输入问题..." @keyup.enter="sendChat()" />
          <button class="btn-send" @click="sendChat()">发送</button>
        </div>
        <div class="setup-hint">
          <div class="hint-title">🛠️ 为你的店铺接入AI客服</div>
          <div class="hint-text">上传商品FAQ → 设置回复风格 → 获取嵌入代码</div>
          <button class="btn-yellow" style="margin-top:10px" @click="showToast('功能即将开放！')">立即接入（即将开放）</button>
        </div>
      </div>

      <!-- 默认引导 -->
      <div v-else key="guide" class="guide-panel">
        <div class="guide-title">选择上方工具开始使用</div>
        <div class="guide-list">
          <div class="guide-item" v-for="g in guides" :key="g.icon">
            <span class="guide-icon">{{ g.icon }}</span>
            <div>
              <div class="guide-name">{{ g.name }}</div>
              <div class="guide-desc">{{ g.desc }}</div>
            </div>
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
import { ref, nextTick } from 'vue'

const activeKey = ref('')
const loading = ref('')
const results = ref({ selection: '', translate: null, marketing: '' })
const toast = ref('')

const stats = [
  { num: '12,847', label: '今日调用' },
  { num: '328', label: '服务商家' },
  { num: '8', label: '支持语言' },
  { num: '42', label: '覆盖国家' },
]

const toolItems = [
  { key: 'selection', icon: '🔍', name: 'AI选品',   desc: '热卖趋势分析', bg: '#FFF3CD' },
  { key: 'translate', icon: '🌐', name: 'AI翻译',   desc: '8种语言互译',  bg: '#D1F2EB' },
  { key: 'marketing', icon: '📢', name: 'AI文案',   desc: '多平台营销',   bg: '#FADBD8' },
  { key: 'service',   icon: '💬', name: 'AI客服',   desc: '24小时在线',   bg: '#D6EAF8' },
]

const guides = [
  { icon: '🔍', name: 'AI智能选品', desc: '分析中东/东南亚/非洲热卖趋势' },
  { icon: '🌐', name: 'AI多语言翻译', desc: '一键翻译阿拉伯语、英语等8种语言' },
  { icon: '📢', name: 'AI营销文案', desc: '自动生成TikTok脚本、Facebook广告' },
  { icon: '💬', name: 'AI客服机器人', desc: '24小时自动回复，支持多语言' },
]

const regions = [
  { key: 'middle-east', flag: '🇦🇪', label: '中东' },
  { key: 'sea',         flag: '🌏', label: '东南亚' },
  { key: 'africa',      flag: '🌍', label: '非洲' },
  { key: 'europe',      flag: '🇪🇺', label: '欧洲' },
]
const cats = ['不限', '美妆护肤', '数码电子', '服饰', '家居', '健康食品', '母婴']
const budgets = ['50元内', '50-200元', '200-500元', '500元以上']
const langs = [
  { key: 'ar', flag: '🇦🇪', label: '阿拉伯语' },
  { key: 'en', flag: '🇺🇸', label: '英语' },
  { key: 'th', flag: '🇹🇭', label: '泰语' },
  { key: 'id', flag: '🇮🇩', label: '印尼语' },
  { key: 'hi', flag: '🇮🇳', label: '印地语' },
  { key: 'fr', flag: '🇫🇷', label: '法语' },
]
const platforms = [
  { key: 'tiktok',    icon: '🎵', label: 'TikTok' },
  { key: 'facebook',  icon: '📘', label: 'Facebook' },
  { key: 'instagram', icon: '📸', label: 'Instagram' },
  { key: 'whatsapp',  icon: '💬', label: 'WhatsApp' },
]

const selForm  = ref({ region: 'middle-east', cat: '不限', budget: '50-200元' })
const transForm = ref({ text: '', targets: ['ar', 'en'] })
const mktForm  = ref({ name: '', platform: 'tiktok', audience: '', points: '' })

// 客服
const chat = ref([{ id: 1, role: 'assistant', content: '您好！我是AI客服，支持中文、English 和 العربية，请问需要了解什么？' }])
const chatLoading = ref(false)
const chatInput = ref('')
const chatBox = ref(null)
const presets = ['能发迪拜吗？', '多久能到货？', '支持退换货吗？', 'كم سعر الشحن؟']

function getLang(key) { return langs.find(l => l.key === key)?.label || key }

function toggleTool(key) { activeKey.value = activeKey.value === key ? '' : key }

async function runTool(key) {
  loading.value = key
  results.value[key] = null
  await new Promise(r => setTimeout(r, 1200))
  if (key === 'selection') {
    const r = regions.find(x => x.key === selForm.value.region)?.label || ''
    results.value[key] = `<b>📊 ${r} 市场 AI 选品报告</b><br/><br/>
    🔥 <b>TOP推荐品类</b><br/>
    1. 美容仪器 — 女性用户68%，客单200-800元，复购率高<br/>
    2. 智能数码配件 — TikTok传播快，利润率40%+<br/>
    3. 清真认证健康食品 — 竞争少，溢价空间大<br/><br/>
    💡 <b>选品要点</b><br/>
    • 体积小重量轻，物流成本低（每件低于15元）<br/>
    • 无酒精/猪皮成分，符合清真要求<br/>
    • 差异化卖点，避开速卖通红海品<br/><br/>
    ⚡ <b>本周爆款预警</b>：无线美容蒸脸仪、婴儿防蚊贴、USB-C快充头`
  } else if (key === 'translate') {
    const txt = transForm.value.text
    const res = {}
    if (transForm.value.targets.includes('ar')) res['ar'] = `(阿拉伯语译文) ${txt} — جودة عالية، شحن مجاني!`
    if (transForm.value.targets.includes('en')) res['en'] = `(English) ${txt} — High quality, free shipping!`
    if (transForm.value.targets.includes('th')) res['th'] = `(ภาษาไทย) ${txt} — คุณภาพสูง จัดส่งฟรี!`
    if (transForm.value.targets.includes('id')) res['id'] = `(Bahasa Indonesia) ${txt} — Kualitas tinggi, gratis ongkir!`
    if (transForm.value.targets.includes('hi')) res['hi'] = `(हिंदी) ${txt} — उच्च गुणवत्ता, मुफ्त शिपिंग!`
    if (transForm.value.targets.includes('fr')) res['fr'] = `(Français) ${txt} — Haute qualité, livraison gratuite!`
    results.value[key] = res
  } else if (key === 'marketing') {
    const name = mktForm.value.name
    const p = mktForm.value.platform
    if (p === 'tiktok') {
      results.value[key] = `🎵 TikTok 爆款脚本 — ${name}\n\n⏰ 0-3秒（钩子）：\n"这个东西在迪拜卖断货了！"\n\n⏰ 3-15秒（展示）：\n✅ 功能演示 + 使用前后对比\n✅ 真实用户评价截图\n\n⏰ 15-30秒（CTA）：\n"点购物车，今天下单明天发货！"\n"仅限100件！"\n\n标签：#${name} #海外好物 #迪拜购物`
    } else {
      results.value[key] = `📘 ${p} 广告文案 — ${name}\n\n标题：限时特惠！迪拜包邮！\n\n正文：\n✅ 品质保证，7天退换\n✅ 阿联酋3-5天到货\n💰 首单优惠码 UAE10 立减10%\n\n立即下单 → [链接]`
    }
  }
  loading.value = ''
}

async function sendChat(text) {
  const msg = text || chatInput.value.trim()
  if (!msg) return
  chatInput.value = ''
  chat.value.push({ id: Date.now(), role: 'user', content: msg })
  chatLoading.value = true
  await nextTick(); if (chatBox.value) chatBox.value.scrollTop = 9999
  await new Promise(r => setTimeout(r, 1100))
  chatLoading.value = false
  const lower = msg.toLowerCase()
  let reply = `感谢咨询！关于"${msg}"，顾问将在24小时内回复您。`
  if (lower.includes('迪拜') || lower.includes('发')) reply = '✅ 支持发货到阿联酋全境（迪拜/阿布扎比/沙迦），标准5-7天，快递3-4天，50元以上免运费。'
  else if (lower.includes('到货') || lower.includes('多久')) reply = '📦 标准运输5-7天；快递3-4天；本地仓（有库存）1-2天。'
  else if (lower.includes('退') || lower.includes('换')) reply = '🔄 支持7天无理由退换！收货7天内联系客服，上门取件，退款3-5个工作日到账。'
  else if (lower.includes('كم') || lower.includes('شحن')) reply = 'الشحن مجاني للطلبات فوق 50 درهم! التوصيل خلال 3-5 أيام. 🚚'
  chat.value.push({ id: Date.now() + 1, role: 'assistant', content: reply })
  await nextTick(); if (chatBox.value) chatBox.value.scrollTop = 9999
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); showToast('已复制！') }
  catch { showToast('复制失败') }
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}
</script>

<style scoped>
* { box-sizing: border-box; }

.at-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F7F7F7;
  overflow-y: auto;
  padding-bottom: 24px;
}

/* Banner */
.at-banner {
  background: linear-gradient(135deg, #FFC933, #FFB300);
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.at-banner-title { color: #fff; font-size: 18px; font-weight: 800; }
.at-banner-sub { color: rgba(255,255,255,0.85); font-size: 12px; margin-top: 3px; }
.at-banner-icon { font-size: 40px; }

/* 统计栏 */
.stats-bar {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #F0F0F0;
}
.stat-cell {
  flex: 1;
  text-align: center;
  padding: 12px 6px;
  border-right: 1px solid #F0F0F0;
}
.stat-cell:last-child { border-right: none; }
.stat-num { color: #FFC933; font-size: 16px; font-weight: 800; }
.stat-label { color: #999; font-size: 10px; margin-top: 2px; }

/* 工具宫格 */
.tool-grid-section { background: #fff; padding: 12px; margin-bottom: 8px; }
.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.tool-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  background: #F7F7F7;
  border: 1.5px solid #F0F0F0;
  border-radius: 12px;
  padding: 10px 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.tool-grid-item.active {
  background: #FFF7E6;
  border-color: #FFC933;
}
.tool-grid-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.tool-grid-name { font-size: 12px; font-weight: 700; color: #333; }
.tool-grid-desc { font-size: 10px; color: #999; text-align: center; }

/* 工具面板 */
.tool-panel {
  background: #fff;
  margin: 0 0 8px;
  padding: 16px;
}
.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #222;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #F5F5F5;
}
.form-item { margin-bottom: 14px; }
.form-label { font-size: 12px; color: #999; margin-bottom: 8px; }
.form-input {
  width: 100%;
  border: 1px solid #E8E8E8;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #333;
  outline: none;
  background: #FAFAFA;
}
.form-textarea {
  width: 100%;
  border: 1px solid #E8E8E8;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #333;
  outline: none;
  background: #FAFAFA;
  resize: vertical;
  font-family: inherit;
}

.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  padding: 5px 13px;
  border-radius: 14px;
  border: 1px solid #E8E8E8;
  background: #F7F7F7;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.chip.active { background: #FFC933; border-color: #FFC933; color: #fff; font-weight: 700; }

.lang-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.lang-check {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #555; cursor: pointer;
}
.lang-check input { accent-color: #FFC933; }

.btn-yellow {
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
.btn-yellow:disabled { opacity: 0.5; cursor: not-allowed; }

/* 结果卡 */
.result-card {
  margin-top: 14px;
  background: #FFFBF0;
  border: 1px solid #FFE58F;
  border-radius: 12px;
  padding: 14px;
}
.result-card-title { color: #FA8C16; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
.result-card-body { color: #555; font-size: 13px; line-height: 1.8; }
.result-card-pre { color: #333; font-size: 13px; line-height: 1.7; white-space: pre-wrap; font-family: inherit; }

/* 翻译结果 */
.trans-item { padding: 10px 0; border-bottom: 1px solid #F5F5F5; }
.trans-item:last-child { border-bottom: none; }
.trans-lang { color: #FFC933; font-size: 11px; font-weight: 700; margin-bottom: 4px; }
.trans-text { color: #333; font-size: 13px; line-height: 1.6; margin-bottom: 6px; }
.btn-copy-sm {
  background: #F7F7F7;
  border: 1px solid #E8E8E8;
  border-radius: 8px;
  font-size: 11px;
  color: #666;
  padding: 3px 10px;
  cursor: pointer;
}

/* 客服 */
.chat-box {
  background: #F7F7F7;
  border-radius: 12px;
  padding: 12px;
  height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}
.chat-row { display: flex; align-items: flex-end; gap: 6px; }
.chat-row.user { flex-direction: row-reverse; }
.chat-avatar { font-size: 20px; flex-shrink: 0; }
.chat-avatar-r { font-size: 20px; flex-shrink: 0; }
.chat-bubble {
  max-width: 75%;
  padding: 9px 13px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
}
.chat-row.assistant .chat-bubble { background: #fff; color: #333; border: 1px solid #E8E8E8; }
.chat-row.user .chat-bubble { background: #FFC933; color: #fff; }
.typing { display: flex; gap: 4px; align-items: center; min-width: 40px; }
.typing span {
  width: 6px; height: 6px;
  background: #ccc; border-radius: 50%;
  animation: bounce 1s infinite;
}
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }

.preset-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.preset-btn {
  background: #FFF7E6;
  border: 1px solid #FFD591;
  border-radius: 14px;
  padding: 5px 11px;
  font-size: 11px;
  color: #FA8C16;
  cursor: pointer;
}
.chat-input-row { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }
.chat-input-row .form-input { flex: 1; }
.btn-send {
  background: #FFC933; color: #fff;
  border: none; border-radius: 10px;
  padding: 10px 14px; font-size: 13px;
  font-weight: 700; cursor: pointer; white-space: nowrap;
}
.setup-hint {
  background: #FFF7E6;
  border: 1px solid #FFD591;
  border-radius: 12px;
  padding: 14px;
}
.hint-title { color: #FA8C16; font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.hint-text { color: #888; font-size: 12px; }

/* 引导面板 */
.guide-panel { background: #fff; padding: 20px 16px; }
.guide-title { color: #999; font-size: 13px; text-align: center; margin-bottom: 16px; }
.guide-list { display: flex; flex-direction: column; gap: 14px; }
.guide-item { display: flex; align-items: center; gap: 14px; }
.guide-icon { font-size: 28px; flex-shrink: 0; }
.guide-name { font-size: 14px; font-weight: 700; color: #222; }
.guide-desc { font-size: 12px; color: #999; margin-top: 2px; }

/* Toast */
.toast-bar {
  position: fixed; bottom: 80px; left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.72); color: #fff;
  padding: 9px 20px; border-radius: 20px;
  font-size: 13px; z-index: 200; white-space: nowrap;
}

/* 动画 */
.panel-fade-enter-active, .panel-fade-leave-active { transition: opacity 0.2s; }
.panel-fade-enter-from, .panel-fade-leave-to { opacity: 0; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
</style>

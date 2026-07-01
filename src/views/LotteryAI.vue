<template>
  <div class="lottery-wrap">
    <!-- 顶栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="handleBack">‹</button>
      <h1 class="title-bar">1+1 AI智能选号器 <span class="ver">V2.0</span></h1>
    </div>

    <!-- 首页：双赛道选择 -->
    <div v-if="page === 'home'" class="home-page">
      <div class="stars-bg"></div>
      <div class="subtitle">DeepSeek 算力驱动 · 缩水矩阵过滤</div>

      <div class="track-cards">
        <div class="track-card card-3d" @click="enterLottery('3d')">
          <div class="card-glow"></div>
          <div class="card-icon">🎱</div>
          <div class="card-title">福彩3D</div>
          <div class="card-sub">智能围剿</div>
          <div class="card-desc">百位·十位·个位<br>冷热矩阵过滤</div>
        </div>

        <div class="track-card card-k8" @click="enterLottery('k8')">
          <div class="card-glow"></div>
          <div class="card-icon">🎰</div>
          <div class="card-title">快乐8选4</div>
          <div class="card-sub">容错矩阵</div>
          <div class="card-desc">80号缩水 · 4区域<br>冷热2:1:1抽样</div>
        </div>
      </div>

      <div class="home-tip">⚠️ 彩票开奖完全随机，AI推荐仅供娱乐参考，请理性购彩</div>
    </div>

    <!-- 选号页 -->
    <div v-else-if="page === 'lottery'" class="lottery-page">
      <div class="lottery-type-badge">
        {{ currentType === '3d' ? '🎱 福彩3D · 智能围剿' : '🎰 快乐8选4 · 容错矩阵' }}
      </div>

      <!-- 待启动状态 -->
      <div v-if="status === 'idle'" class="idle-panel">
        <div class="algo-preview">
          <div class="algo-line">📡 历史100期开奖特征矩阵 · 就绪</div>
          <div class="algo-line">🔬 {{ currentType === '3d' ? '百位/十位/个位冷热度分析' : '80号缩水矩阵 · 4区域覆盖率' }}</div>
          <div class="algo-line">🧮 {{ currentType === '3d' ? '和值中心区间 10-18 · 过滤畸变形态' : '奇偶比 2:2/3:1 · 和值 94-166 区间' }}</div>
        </div>
        <button class="start-btn" @click="generate">
          <span class="btn-icon">🚀</span>
          启动 DeepSeek 深度算力
          <br><span class="btn-sub">一键启动AI选号</span>
        </button>
      </div>

      <!-- 加载动画 -->
      <div v-else-if="status === 'loading'" class="loading-panel">
        <div class="pulse-ring"></div>
        <div class="loading-icon">🤖</div>
        <div class="loading-steps">
          <div
            v-for="(step, i) in loadingSteps"
            :key="i"
            class="loading-step"
            :class="{ active: loadingIdx >= i, done: loadingIdx > i }"
          >
            <span class="step-dot">{{ loadingIdx > i ? '✓' : loadingIdx === i ? '▶' : '○' }}</span>
            {{ step }}
          </div>
        </div>
        <div class="loading-bar">
          <div class="loading-fill" :style="{ width: loadingPct + '%' }"></div>
        </div>
        <div class="loading-pct">{{ loadingPct }}%</div>
      </div>

      <!-- 结果 -->
      <div v-else-if="status === 'done'" class="result-panel">
        <div class="result-header">✨ 选号完成</div>
        <div class="result-box" v-html="formattedResult"></div>
        <div class="result-actions">
          <button class="retry-btn" @click="resetToIdle">再次选号</button>
          <button class="home-btn" @click="page = 'home'">返回首页</button>
        </div>
      </div>

      <!-- 错误 -->
      <div v-else-if="status === 'error'" class="error-panel">
        <div class="error-icon">⚠️</div>
        <div class="error-msg">{{ errorMsg }}</div>
        <button class="retry-btn" @click="resetToIdle">重试</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore'

const router = useRouter()
const userStore = useUserStore()

const page = ref('home')
const currentType = ref('3d')
const status = ref('idle') // idle | loading | done | error
const rawResult = ref('')
const errorMsg = ref('')
const loadingIdx = ref(0)
const loadingPct = ref(0)

const loadingSteps = [
  '正在调用 DeepSeek-V3 算力集群...',
  '正在导入历史100期开奖走势...',
  '正在执行 1+1 缩水矩阵过滤...',
  '正在输出智能推荐结果...',
]

const formattedResult = computed(() => {
  return rawResult.value
    .replace(/\n/g, '<br>')
    .replace(/【(.+?)】/g, '<span class="hl-bracket">【$1】</span>')
    .replace(/(🔹[^\n<]+)/g, '<span class="hl-combo">$1</span>')
    .replace(/(💡[^\n<]+)/g, '<span class="hl-logic">$1</span>')
    .replace(/(⚠️[^\n<]+)/g, '<span class="hl-warn">$1</span>')
})

function enterLottery(type) {
  currentType.value = type
  page.value = 'lottery'
  status.value = 'idle'
  rawResult.value = ''
}

function resetToIdle() {
  status.value = 'idle'
  rawResult.value = ''
  errorMsg.value = ''
  loadingIdx.value = 0
  loadingPct.value = 0
}

async function generate() {
  status.value = 'loading'
  loadingIdx.value = 0
  loadingPct.value = 0

  // 3秒分步动画
  const stepDuration = 750
  const timer = setInterval(() => {
    loadingIdx.value = Math.min(loadingIdx.value + 1, loadingSteps.length - 1)
  }, stepDuration)

  // 进度条动画
  const pctTimer = setInterval(() => {
    if (loadingPct.value < 90) loadingPct.value += 3
  }, 100)

  try {
    const res = await fetch('/api/lottery/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userStore.userId, type: currentType.value }),
    })
    const data = await res.json()

    clearInterval(timer)
    clearInterval(pctTimer)
    loadingPct.value = 100
    loadingIdx.value = loadingSteps.length - 1

    await new Promise(r => setTimeout(r, 400))

    if (data.code === 0) {
      rawResult.value = data.data.result
      status.value = 'done'
    } else {
      errorMsg.value = data.message || '生成失败，请重试'
      status.value = 'error'
    }
  } catch (err) {
    clearInterval(timer)
    clearInterval(pctTimer)
    errorMsg.value = '网络错误，请重试'
    status.value = 'error'
  }
}

function handleBack() {
  if (page.value === 'lottery') {
    page.value = 'home'
  } else {
    router.back()
  }
}

</script>

<style scoped>
.lottery-wrap {
  min-height: 100vh;
  background: #050d1a;
  color: #e0eaff;
  font-family: 'Arial', sans-serif;
  overflow-x: hidden;
}

/* 顶栏 */
.top-bar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(90deg, #0a1628 0%, #0d1f3c 100%);
  border-bottom: 1px solid #1a3a6b;
  position: sticky;
  top: 0;
  z-index: 10;
}
.back-btn {
  background: none;
  border: none;
  color: #7eb8ff;
  font-size: 24px;
  cursor: pointer;
  padding: 0 10px 0 0;
  line-height: 1;
}
.title-bar {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, #4fc3f7, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ver {
  font-size: 11px;
  opacity: 0.7;
}
.points-chip {
  background: linear-gradient(135deg, #1a3a6b, #0d2a52);
  border: 1px solid #2a5a9b;
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 12px;
  color: #7eb8ff;
  white-space: nowrap;
}

/* 首页 */
.home-page {
  padding: 20px 16px 40px;
  position: relative;
  min-height: calc(100vh - 50px);
}
.stars-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(74, 144, 226, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(167, 139, 250, 0.08) 0%, transparent 50%);
  pointer-events: none;
}
.subtitle {
  text-align: center;
  color: #4fc3f7;
  font-size: 12px;
  letter-spacing: 1px;
  margin-bottom: 24px;
}

.track-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 400px;
  margin: 0 auto;
}
.track-card {
  position: relative;
  border-radius: 16px;
  padding: 24px 20px;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid transparent;
}
.track-card:active { transform: scale(0.98); }

.card-3d {
  background: linear-gradient(135deg, #0d1f3c 0%, #1a2f50 100%);
  border-color: #2a6abc;
  box-shadow: 0 0 20px rgba(42, 106, 188, 0.3);
}
.card-k8 {
  background: linear-gradient(135deg, #1a0d2e 0%, #2d1a4a 100%);
  border-color: #7c3aed;
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.3);
}
.card-glow {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  opacity: 0.1;
}
.card-3d .card-glow { background: radial-gradient(circle, #4fc3f7, transparent); }
.card-k8 .card-glow { background: radial-gradient(circle, #a78bfa, transparent); }

.card-icon { font-size: 36px; margin-bottom: 8px; }
.card-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 2px;
}
.card-3d .card-title { color: #4fc3f7; }
.card-k8 .card-title { color: #a78bfa; }

.card-sub {
  font-size: 11px;
  letter-spacing: 2px;
  opacity: 0.6;
  margin-bottom: 10px;
}
.card-desc {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.6;
  margin-bottom: 12px;
}
.card-cost {
  display: inline-block;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 3px 12px;
  font-size: 11px;
  color: #fbbf24;
}

.home-tip {
  text-align: center;
  font-size: 11px;
  color: #475569;
  margin-top: 30px;
  padding: 0 20px;
  line-height: 1.6;
}

/* 选号页 */
.lottery-page {
  padding: 20px 16px 40px;
  max-width: 480px;
  margin: 0 auto;
}
.lottery-type-badge {
  text-align: center;
  background: linear-gradient(90deg, rgba(79,195,247,0.1), rgba(167,139,250,0.1));
  border: 1px solid rgba(79,195,247,0.2);
  border-radius: 20px;
  padding: 8px 20px;
  font-size: 14px;
  color: #7eb8ff;
  margin-bottom: 24px;
}

/* 待启动 */
.idle-panel { text-align: center; }
.algo-preview {
  background: rgba(0,0,0,0.3);
  border: 1px solid #1a3a6b;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 28px;
  text-align: left;
}
.algo-line {
  font-size: 12px;
  color: #64748b;
  padding: 4px 0;
  border-bottom: 1px solid #0f1f38;
  line-height: 1.6;
}
.algo-line:last-child { border-bottom: none; }

.start-btn {
  width: 100%;
  max-width: 320px;
  padding: 20px;
  background: linear-gradient(135deg, #1a3a6b 0%, #2d5a9e 50%, #1a3a6b 100%);
  border: 1px solid #4fc3f7;
  border-radius: 16px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 0 30px rgba(79,195,247,0.3);
  transition: all 0.2s;
  line-height: 1.4;
  position: relative;
  overflow: hidden;
}
.start-btn::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(45deg, transparent, rgba(255,255,255,0.05), transparent);
  animation: shimmer 3s infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%) rotate(45deg); }
  100% { transform: translateX(100%) rotate(45deg); }
}
.start-btn:active { transform: scale(0.97); box-shadow: 0 0 15px rgba(79,195,247,0.2); }
.btn-icon { font-size: 28px; display: block; margin-bottom: 6px; }
.btn-sub { font-size: 12px; opacity: 0.7; font-weight: normal; }
.remain-points { margin-top: 14px; font-size: 12px; color: #475569; }

/* 加载动画 */
.loading-panel {
  text-align: center;
  padding: 20px 0;
}
.pulse-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid #4fc3f7;
  margin: 0 auto 16px;
  animation: pulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(79,195,247,0.4);
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.6; }
}
.loading-icon { font-size: 36px; margin-top: -58px; margin-bottom: 24px; }

.loading-steps {
  background: rgba(0,0,0,0.3);
  border: 1px solid #1a3a6b;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 20px;
  text-align: left;
}
.loading-step {
  font-size: 12px;
  color: #334155;
  padding: 5px 0;
  transition: color 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
}
.loading-step.active { color: #4fc3f7; }
.loading-step.done { color: #22c55e; }
.step-dot { font-size: 10px; min-width: 12px; }

.loading-bar {
  height: 4px;
  background: #0f1f38;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}
.loading-fill {
  height: 100%;
  background: linear-gradient(90deg, #4fc3f7, #a78bfa);
  border-radius: 2px;
  transition: width 0.15s;
}
.loading-pct { font-size: 11px; color: #4fc3f7; }

/* 结果 */
.result-panel { text-align: left; }
.result-header {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #fbbf24;
  margin-bottom: 16px;
}
.result-box {
  background: rgba(0,0,0,0.4);
  border: 1px solid #1a3a6b;
  border-radius: 12px;
  padding: 16px;
  font-size: 13px;
  line-height: 1.8;
  color: #cbd5e1;
  overflow-x: auto;
}
:deep(.hl-bracket) { color: #4fc3f7; font-weight: 600; }
:deep(.hl-combo) { color: #a78bfa; display: block; padding: 2px 0; }
:deep(.hl-logic) { color: #34d399; display: block; padding: 2px 0; }
:deep(.hl-warn) { color: #fb923c; font-size: 11px; display: block; margin-top: 8px; }

.result-remain {
  text-align: center;
  font-size: 12px;
  color: #fbbf24;
  margin: 12px 0;
}
.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
}
.retry-btn, .home-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  font-weight: 600;
}
.retry-btn {
  background: linear-gradient(135deg, #1a3a6b, #2d5a9e);
  color: #fff;
  border: 1px solid #4fc3f7;
}
.home-btn {
  background: rgba(255,255,255,0.05);
  color: #94a3b8;
  border: 1px solid #1e293b;
}

/* 错误 */
.error-panel { text-align: center; padding: 30px 0; }
.error-icon { font-size: 40px; margin-bottom: 12px; }
.error-msg {
  color: #fb923c;
  font-size: 14px;
  margin-bottom: 20px;
  line-height: 1.6;
  padding: 0 16px;
}
</style>

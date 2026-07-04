<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const tasks      = ref([])
const recentDone = ref([])
const loading    = ref(true)
const confirming = ref({})   // { [taskId]: true } 防重复确认
const disputing  = ref({})   // { [taskId]: true } 防重复申诉

onMounted(async () => {
  try {
    const res = await axios.get('/api/orders/pending-confirm')
    const d = res.data.data
    // 新格式 { pending, recentDone }；兼容旧格式（纯数组）
    if (Array.isArray(d)) {
      tasks.value = d
    } else {
      tasks.value      = d?.pending || []
      recentDone.value = d?.recentDone || []
    }
  } catch (e) { /* ignore */ } finally { loading.value = false }
})

async function confirm(taskId) {
  if (confirming.value[taskId]) return  // 已在处理中，直接拦截
  confirming.value[taskId] = true
  try {
    await axios.post(`/api/orders/confirm/${taskId}`)
    const t = tasks.value.find(t => t.id === taskId)
    if (t) t.status = 'confirmed'
  } catch (e) {
    alert(e.response?.data?.message || '确认失败')
  } finally {
    confirming.value[taskId] = false
  }
}

async function dispute(taskId) {
  if (disputing.value[taskId]) return  // 已在处理中，直接拦截
  disputing.value[taskId] = true
  try {
    await axios.post(`/api/orders/dispute/${taskId}`)
    const t = tasks.value.find(t => t.id === taskId)
    if (t) t.status = 'ai_review'
  } catch (e) {
    alert('操作失败')
  } finally {
    disputing.value[taskId] = false
  }
}

function timeLeft(deadline) {
  const diff = new Date(deadline) - Date.now()
  if (diff <= 0) return '已超时'
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${m}:${s.toString().padStart(2,'0')}`
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth()+1}-${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<template>
  <div class="page">
    <h2 class="page-title">✅ 待确认收款</h2>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else>
      <!-- 待确认列表 -->
      <div v-if="!tasks.length" class="empty">暂无待确认收款</div>

      <div v-else class="task-list">
        <div v-for="task in tasks" :key="task.id" class="task-card">
          <div class="task-top">
            <div>
              <span class="payer-id">付款方 #{{ task.payer_no }}</span>
              <span class="task-type">{{ task.type_label }}</span>
            </div>
            <span class="amount">¥{{ task.amount }}</span>
          </div>

          <!-- 截图 -->
          <div class="screenshot-wrap">
            <img :src="task.screenshot_url" class="screenshot" @click="window.open(task.screenshot_url)" />
          </div>

          <div class="task-footer">
            <span class="timer">⏱ {{ timeLeft(task.deadline) }}</span>
            <div class="actions">
              <button
                class="btn-dispute"
                :disabled="disputing[task.id] || confirming[task.id]"
                @click="dispute(task.id)"
              >{{ disputing[task.id] ? '处理中...' : '有问题' }}</button>
              <button
                class="btn-confirm"
                :disabled="confirming[task.id] || disputing[task.id]"
                @click="confirm(task.id)"
              >{{ confirming[task.id] ? '确认中...' : '确认收款' }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 最近收款记录（近7天） -->
      <template v-if="recentDone.length">
        <h3 class="section-title">📋 最近收款记录（近7天）</h3>
        <div class="done-list">
          <div v-for="t in recentDone" :key="t.id" class="done-card">
            <div class="done-left">
              <div class="done-row1">
                <span class="done-payer">付款方 #{{ t.payer_no }}</span>
                <span class="done-label">{{ t.type_label }}</span>
              </div>
              <div class="done-row2">
                <span class="done-time">{{ fmtTime(t.confirmed_at) }}</span>
                <span v-if="t.auto_confirmed" class="done-badge auto">⏱ 超时30分钟·系统自动确认</span>
                <span v-else class="done-badge manual">✅ 已确认</span>
              </div>
            </div>
            <span class="done-amount">+¥{{ t.amount }}</span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; }
.loading, .empty { text-align: center; padding: 40px; color: #999; }
.task-list { display: flex; flex-direction: column; gap: 12px; }
.task-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 16px; }
.task-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.payer-id { display: block; font-size: 14px; font-weight: 600; }
.task-type { font-size: 12px; color: #999; }
.amount { font-size: 24px; font-weight: 700; color: #f0a500; }
.screenshot-wrap { text-align: center; margin: 12px 0; }
.screenshot { max-width: 100%; max-height: 200px; border-radius: 8px; cursor: pointer; }
.task-footer { display: flex; justify-content: space-between; align-items: center; }
.timer { font-size: 13px; color: #e53e3e; }
.actions { display: flex; gap: 8px; }
.btn-dispute { padding: 8px 14px; border: 1px solid #e53e3e; border-radius: 8px; background: #fff; color: #e53e3e; font-size: 13px; cursor: pointer; }
.btn-confirm { padding: 8px 14px; background: #48bb78; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-dispute:disabled, .btn-confirm:disabled { opacity: .5; cursor: not-allowed; }

/* 最近收款记录 */
.section-title { font-size: 16px; font-weight: 700; margin: 24px 0 12px; color: #333; }
.done-list { display: flex; flex-direction: column; gap: 8px; }
.done-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; }
.done-left { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.done-row1 { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.done-payer { font-size: 13px; font-weight: 600; color: #333; }
.done-label { font-size: 12px; color: #999; }
.done-row2 { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.done-time { font-size: 11px; color: #bbb; }
.done-badge { font-size: 11px; padding: 2px 8px; border-radius: 8px; font-weight: 600; }
.done-badge.auto { background: #fff7ed; color: #ea580c; }
.done-badge.manual { background: #f0fdf4; color: #16a34a; }
.done-amount { font-size: 17px; font-weight: 700; color: #16a34a; flex-shrink: 0; }
</style>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const tasks      = ref([])
const loading    = ref(true)
const confirming = ref({})   // { [taskId]: true } 防重复确认
const disputing  = ref({})   // { [taskId]: true } 防重复申诉

onMounted(async () => {
  try {
    const res = await axios.get('/api/orders/pending-confirm')
    tasks.value = res.data.data
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
</script>

<template>
  <div class="page">
    <h2 class="page-title">✅ 待确认收款</h2>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!tasks.length" class="empty">暂无待确认收款</div>

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
</style>

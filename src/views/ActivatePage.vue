<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const order  = ref(null)  // 激活订单（含18个task）
const loading = ref(true)
const error   = ref('')

onMounted(async () => {
  try {
    // 获取或创建激活订单
    const res = await axios.post('/api/activate/create')
    order.value = res.data.data
  } catch (e) {
    error.value = e.response?.data?.message || '获取激活信息失败'
  } finally {
    loading.value = false
  }
})

function getTypeLabel(type) {
  if (type === 'jian_dian')       return { label: '见点奖',   color: '#f0a500' }
  if (type === 'bang_fu')         return { label: '帮扶奖',   color: '#48bb78' }
  if (type === 'bang_fu_subsidy') return { label: '帮扶奖',   color: '#48bb78' }
  if (type === 'bang_fu_admin')   return { label: '帮扶预留', color: '#a0aec0' }
  return { label: `平级第${type.replace('ping_ji_node_','')}层`, color: '#4299e1' }
}

function statusText(status) {
  const map = {
    pending: '待打款', screenshot_uploaded: '待确认',
    confirmed: '已完成', timeout: '已超时', ai_review: 'AI介入', frozen: '已冻结'
  }
  return map[status] || status
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <button class="back-btn" @click="router.back()">←</button>
      <h2>激活 · 200元</h2>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error-msg">{{ error }}</div>

    <template v-else-if="order">
      <!-- 进度 -->
      <div class="progress-bar">
        <div class="progress-text">
          {{ order.confirmed_tasks }} / {{ order.total_tasks }} 笔已确认
        </div>
        <div class="bar-bg">
          <div class="bar-fill" :style="`width:${(order.confirmed_tasks/order.total_tasks)*100}%`"></div>
        </div>
      </div>

      <!-- 支付清单 -->
      <div class="task-list">
        <div
          v-for="task in order.tasks"
          :key="task.id"
          class="task-card"
          :class="task.status"
          @click="task.status === 'pending' && router.push(`/payment/${task.id}`)"
        >
          <div class="task-left">
            <span class="type-badge" :style="`background:${getTypeLabel(task.type).color}20;color:${getTypeLabel(task.type).color}`">
              {{ getTypeLabel(task.type).label }}
            </span>
            <span class="receiver-id">收款方 #{{ task.receiver_no }}</span>
          </div>
          <div class="task-right">
            <span class="amount">¥{{ task.amount }}</span>
            <span class="task-status" :class="task.status">{{ statusText(task.status) }}</span>
          </div>
        </div>
      </div>

      <div v-if="order.confirmed_tasks === order.total_tasks" class="success-tip">
        🎉 所有款项已确认！请上传您的收款码
        <button class="btn-upload" @click="router.push('/profile')">去上传</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 16px; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.back-btn { background: none; border: none; font-size: 20px; cursor: pointer; }
h2 { font-size: 18px; font-weight: 700; }
.loading, .error-msg { text-align: center; padding: 40px; color: #999; }
.error-msg { color: #e53e3e; }
.progress-bar { background: #f9f9f9; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.progress-text { font-size: 14px; color: #666; margin-bottom: 8px; }
.bar-bg { height: 8px; background: #eee; border-radius: 4px; }
.bar-fill { height: 100%; background: #f0a500; border-radius: 4px; transition: width .3s; }
.task-list { display: flex; flex-direction: column; gap: 10px; }
.task-card { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 14px 16px; cursor: pointer; }
.task-card.confirmed { opacity: .6; cursor: default; }
.task-left { display: flex; flex-direction: column; gap: 4px; }
.type-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
.receiver-id { font-size: 13px; color: #999; }
.task-right { text-align: right; }
.amount { display: block; font-size: 20px; font-weight: 700; color: #333; }
.task-status { font-size: 12px; }
.task-status.pending { color: #f0a500; }
.task-status.confirmed { color: #48bb78; }
.task-status.screenshot_uploaded { color: #4299e1; }
.task-status.ai_review { color: #e53e3e; }
.success-tip { text-align: center; padding: 24px; color: #48bb78; font-size: 16px; }
.btn-upload { display: block; margin: 12px auto 0; background: #48bb78; color: #fff; border: none; border-radius: 8px; padding: 10px 24px; cursor: pointer; }
</style>

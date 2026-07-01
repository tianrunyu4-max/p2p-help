<template>
  <Teleport to="body">
    <div class="jp-overlay" @click.self="$emit('close')">
      <div class="jp-modal">
        <div class="jp-header">
          <span class="jp-title">📝 发布内容</span>
          <button class="jp-close" @click="$emit('close')">✕</button>
        </div>

        <!-- 类型选择 -->
        <div class="jp-tabs">
          <button
            :class="['jp-tab', { active: form.category === 'studio' }]"
            @click="form.category = 'studio'">
            🏢 工作室项目
          </button>
          <button
            :class="['jp-tab', { active: form.category === 'parttime' }]"
            @click="form.category = 'parttime'">
            💼 兼职任务
          </button>
        </div>

        <!-- 拼团券提示 -->
        <div class="jp-points-tip">
          <span class="jp-points-icon">🎟️</span>
          <span>发布消耗 <b>1张拼团券</b>，持有：<b>{{ currentPoints }}</b> 张</span>
          <span v-if="currentPoints < 1" class="jp-points-warn">（拼团券不足）</span>
        </div>

        <!-- 表单 -->
        <div class="jp-form">
          <div class="jp-field">
            <label class="jp-label">标题 <span class="req">*</span></label>
            <input v-model="form.title" class="jp-input" placeholder="简洁描述项目/任务（最多40字）" maxlength="40" />
            <span class="jp-count">{{ form.title.length }}/40</span>
          </div>

          <div class="jp-field">
            <label class="jp-label">详细描述 <span class="req">*</span></label>
            <textarea v-model="form.desc" class="jp-textarea" placeholder="工作内容、要求、待遇等（最多300字）" maxlength="300" rows="4"></textarea>
            <span class="jp-count">{{ form.desc.length }}/300</span>
          </div>

          <div class="jp-field">
            <label class="jp-label">薪资/报酬</label>
            <input v-model="form.salary" class="jp-input" placeholder="如：面议 / 1500 AED/月 / 计件" />
          </div>

          <div class="jp-field">
            <label class="jp-label">联系方式 <span class="req">*</span></label>
            <input v-model="form.phone" class="jp-input" placeholder="微信号 / 手机号" />
          </div>

          <div class="jp-field">
            <label class="jp-label">联系人</label>
            <input v-model="form.contact" class="jp-input" placeholder="姓名或昵称" />
          </div>
        </div>

        <button
          class="jp-submit-btn"
          :disabled="!canSubmit || submitting"
          @click="handleSubmit">
          {{ submitting ? '发布中...' : '✅ 确认发布（消耗1张拼团券）' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '../config/api'
import { getOrCreateUserId } from '../utils/auth'

const emit = defineEmits(['close', 'success'])

const userId = getOrCreateUserId()
const currentPoints = ref(0)
const submitting = ref(false)

const form = ref({
  category: 'studio',
  title: '',
  desc: '',
  salary: '',
  phone: '',
  contact: '',
})

const canSubmit = computed(() =>
  form.value.title.trim() &&
  form.value.desc.trim() &&
  form.value.phone.trim() &&
  currentPoints.value >= 1
)

// 获取当前拼团券数量
async function loadPoints() {
  try {
    const res = await fetch(`/api/subscription/status/${userId}`)
    if (res.ok) {
      const data = await res.json()
      currentPoints.value = data.data?.couponCount || 0
    }
  } catch (e) {
    currentPoints.value = 0
  }
}

async function handleSubmit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const res = await fetch('/api/job/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        category: form.value.category,
        title: form.value.title.trim(),
        desc: form.value.desc.trim(),
        salary: form.value.salary.trim() || null,
        phone: form.value.phone.trim(),
        contact: form.value.contact.trim() || '匿名',
      })
    })
    const data = await res.json()
    if (data.code === 0 || data.code === 200) {
      emit('success')
    } else {
      alert(data.message || '发布失败，请重试')
    }
  } catch (e) {
    alert('网络错误，请重试')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadPoints()
})
</script>

<style scoped>
.jp-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1100; padding: 16px;
}
.jp-modal {
  background: white; border-radius: 16px;
  width: 100%; max-width: 400px;
  max-height: 90vh; overflow-y: auto;
  padding: 16px;
  animation: slideUp 0.25s ease;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.jp-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.jp-title { font-size: 16px; font-weight: 700; color: #1A1A2E; }
.jp-close {
  width: 28px; height: 28px; border: none;
  background: #F5F5F5; border-radius: 50%;
  font-size: 16px; color: #999; cursor: pointer;
}

/* 类型选项 */
.jp-tabs {
  display: flex; gap: 8px; margin-bottom: 12px;
}
.jp-tab {
  flex: 1; padding: 10px 0;
  border: 2px solid #E5E5E5; border-radius: 10px;
  background: white; font-size: 13px; font-weight: 600;
  color: #666; cursor: pointer; transition: all 0.2s;
}
.jp-tab.active {
  border-color: #1565C0; background: #E3F2FD;
  color: #1565C0;
}

/* 积分提示 */
.jp-points-tip {
  display: flex; align-items: center; gap: 6px;
  background: #FFF8E1; border-radius: 8px;
  padding: 8px 12px; margin-bottom: 14px;
  font-size: 13px; color: #555;
}
.jp-points-icon { font-size: 16px; }
.jp-points-warn { color: #F44336; font-weight: 600; }

/* 表单 */
.jp-form { display: flex; flex-direction: column; gap: 12px; }
.jp-field { position: relative; }
.jp-label {
  display: block; font-size: 12px; font-weight: 600;
  color: #555; margin-bottom: 5px;
}
.req { color: #F44336; }
.jp-input {
  width: 100%; padding: 10px 12px; box-sizing: border-box;
  border: 2px solid #E5E5E5; border-radius: 8px;
  font-size: 14px; color: #2C3E50; outline: none;
  transition: border-color 0.2s;
}
.jp-input:focus { border-color: #1565C0; }
.jp-textarea {
  width: 100%; padding: 10px 12px; box-sizing: border-box;
  border: 2px solid #E5E5E5; border-radius: 8px;
  font-size: 14px; color: #2C3E50; outline: none;
  resize: vertical; min-height: 90px;
  transition: border-color 0.2s;
}
.jp-textarea:focus { border-color: #1565C0; }
.jp-count {
  position: absolute; right: 8px; bottom: 8px;
  font-size: 11px; color: #BDBDBD;
}

/* 提交按钮 */
.jp-submit-btn {
  width: 100%; margin-top: 16px; padding: 13px;
  border: none; border-radius: 10px;
  background: linear-gradient(135deg, #1565C0, #1976D2);
  color: white; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all 0.2s;
}
.jp-submit-btn:disabled {
  background: #CCC; cursor: not-allowed;
}
.jp-submit-btn:not(:disabled):hover { opacity: 0.92; }
</style>

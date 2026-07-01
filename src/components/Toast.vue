<template>
  <transition name="toast-fade">
    <div v-if="visible" :class="['toast-container', `toast-${type}`]">
      <div class="toast-icon">{{ icon }}</div>
      <div class="toast-content">
        <div class="toast-title">{{ title }}</div>
        <div v-if="message" class="toast-message">{{ message }}</div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'info', // info, success, warning, error
    validator: (value) => ['info', 'success', 'warning', 'error'].includes(value)
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  duration: {
    type: Number,
    default: 3000
  }
})

const emit = defineEmits(['update:visible'])

const icon = computed(() => {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  }
  return icons[props.type]
})

let timer = null

watch(() => props.visible, (newVal) => {
  if (newVal && props.duration > 0) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      emit('update:visible', false)
    }, props.duration)
  }
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  max-width: 90%;
  min-width: 280px;
}

.toast-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.toast-content {
  flex: 1;
}

.toast-title {
  font-size: 15px;
  font-weight: 500;
  color: #000000;
  margin-bottom: 4px;
}

.toast-message {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
  line-height: 1.5;
}

/* 类型样式 */
.toast-success {
  border-left: 4px solid #07C160;
}

.toast-error {
  border-left: 4px solid #FA5151;
}

.toast-warning {
  border-left: 4px solid #FFC300;
}

.toast-info {
  border-left: 4px solid #10AEFF;
}

/* 动画 */
.toast-fade-enter-active {
  animation: toast-in 0.3s ease;
}

.toast-fade-leave-active {
  animation: toast-out 0.3s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
}
</style>


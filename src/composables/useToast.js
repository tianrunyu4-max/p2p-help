/**
 * Toast 通知组合式函数
 */

import { ref } from 'vue'

const toastState = ref({
  visible: false,
  type: 'info',
  title: '',
  message: '',
  duration: 3000
})

let hideTimer = null

export function useToast() {
  const showToast = (options) => {
    // 清除之前的定时器
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    
    toastState.value = {
      visible: true,
      type: options.type || 'info',
      title: options.title || '',
      message: options.message || '',
      duration: options.duration !== undefined ? options.duration : 3000
    }
    
    // 自动隐藏
    const duration = options.duration !== undefined ? options.duration : 3000
    if (duration > 0) {
      hideTimer = setTimeout(() => {
        toastState.value.visible = false
      }, duration)
    }
  }

  const success = (title, message = '') => {
    showToast({ type: 'success', title, message })
  }

  const error = (title, message = '') => {
    showToast({ type: 'error', title, message })
  }

  const warning = (title, message = '') => {
    showToast({ type: 'warning', title, message })
  }

  const info = (title, message = '') => {
    showToast({ type: 'info', title, message })
  }

  const hide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    toastState.value.visible = false
  }

  return {
    toastState,
    showToast,
    success,
    error,
    warning,
    info,
    hide
  }
}


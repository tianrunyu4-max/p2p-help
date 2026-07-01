/**
 * 防抖组合式函数
 * 用于防止按钮重复点击
 */

import { ref } from 'vue'

/**
 * 创建防抖函数(增强版)
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）,默认300ms
 * @param {Object} options - 配置选项
 * @param {boolean} options.leading - 是否在延迟开始前调用,默认false
 * @param {boolean} options.trailing - 是否在延迟结束后调用,默认true
 * @param {number} options.maxWait - 最大等待时间,超过后强制执行
 * @returns {Function} 防抖后的函数
 */
export function debounce(fn, delay = 300, options = {}) {
  const {
    leading = false,
    trailing = true,
    maxWait = null
  } = options

  let timer = null
  let lastCallTime = 0
  let lastInvokeTime = 0
  let result

  function invokeFunc(time) {
    lastInvokeTime = time
    result = fn.apply(this, arguments)
    return result
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime

    // 首次调用或超过延迟时间或超过最大等待时间
    return (lastCallTime === 0 || 
            timeSinceLastCall >= delay ||
            (maxWait && timeSinceLastInvoke >= maxWait))
  }

  function timerExpired() {
    const time = Date.now()
    
    if (shouldInvoke(time)) {
      return trailingEdge(time)
    }
    
    // 重新设置定时器
    const timeSinceLastCall = time - lastCallTime
    const timeWaiting = delay - timeSinceLastCall
    timer = setTimeout(timerExpired, timeWaiting)
  }

  function trailingEdge(time) {
    timer = null
    
    if (trailing && lastCallTime) {
      return invokeFunc(time)
    }
    
    lastCallTime = 0
    return result
  }

  function leadingEdge(time) {
    lastInvokeTime = time
    timer = setTimeout(timerExpired, delay)
    return leading ? invokeFunc(time) : result
  }

  function debounced(...args) {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastCallTime = time

    if (isInvoking) {
      if (timer === null) {
        return leadingEdge(time)
      }
      if (maxWait) {
        // 处理maxWait的情况
        timer = setTimeout(timerExpired, delay)
        return invokeFunc(time)
      }
    }
    
    if (timer === null) {
      timer = setTimeout(timerExpired, delay)
    }
    
    return result
  }

  // 取消防抖
  debounced.cancel = function() {
    if (timer !== null) {
      clearTimeout(timer)
    }
    lastCallTime = 0
    lastInvokeTime = 0
    timer = null
  }

  // 立即执行
  debounced.flush = function() {
    return timer === null ? result : trailingEdge(Date.now())
  }

  return debounced
}

/**
 * 创建带loading状态的防重复点击函数
 * @param {Function} asyncFn - 异步函数
 * @returns {Object} { execute: Function, isLoading: Ref<boolean> }
 */
export function useAsyncLock(asyncFn) {
  const isLoading = ref(false)
  
  const execute = async (...args) => {
    // 如果正在加载，直接返回
    if (isLoading.value) {
      console.warn('⚠️ 操作正在处理中，请稍候')
      return null
    }
    
    isLoading.value = true
    
    try {
      const result = await asyncFn(...args)
      return result
    } catch (error) {
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  return {
    execute,
    isLoading
  }
}

/**
 * 创建防抖按钮Hook
 * @param {Function} handler - 点击处理函数
 * @param {Object} options - 配置选项
 * @returns {Object} { onClick: Function, isDisabled: Ref<boolean>, countdown: Ref<number> }
 */
export function useDebounceButton(handler, options = {}) {
  const {
    delay = 1000,           // 防抖延迟
    cooldown = 0,           // 冷却时间（毫秒）
    showCountdown = false   // 是否显示倒计时
  } = options
  
  const isDisabled = ref(false)
  const countdown = ref(0)
  let timer = null
  let countdownTimer = null
  
  const onClick = async (...args) => {
    // 如果按钮禁用，直接返回
    if (isDisabled.value) {
      console.warn('⚠️ 请等待操作完成')
      return
    }
    
    // 禁用按钮
    isDisabled.value = true
    
    try {
      // 执行处理函数
      await handler(...args)
      
      // 如果有冷却时间
      if (cooldown > 0) {
        countdown.value = Math.ceil(cooldown / 1000)
        
        if (showCountdown) {
          countdownTimer = setInterval(() => {
            countdown.value--
            if (countdown.value <= 0) {
              clearInterval(countdownTimer)
              isDisabled.value = false
            }
          }, 1000)
        } else {
          timer = setTimeout(() => {
            isDisabled.value = false
          }, cooldown)
        }
      } else {
        // 默认延迟后恢复
        timer = setTimeout(() => {
          isDisabled.value = false
        }, delay)
      }
    } catch (error) {
      // 出错时立即恢复按钮
      isDisabled.value = false
      throw error
    }
  }
  
  // 清理函数
  const cleanup = () => {
    if (timer) clearTimeout(timer)
    if (countdownTimer) clearInterval(countdownTimer)
  }
  
  return {
    onClick,
    isDisabled,
    countdown,
    cleanup
  }
}

/**
 * 简单的按钮防重复点击
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 禁用时间（毫秒）
 * @returns {Function} 包装后的函数
 */
export function preventDoubleClick(fn, delay = 1000) {
  let lastClickTime = 0
  
  return function(...args) {
    const now = Date.now()
    
    if (now - lastClickTime < delay) {
      console.warn('⚠️ 点击太快了，请稍候')
      return
    }
    
    lastClickTime = now
    return fn.apply(this, args)
  }
}

export default {
  debounce,
  useAsyncLock,
  useDebounceButton,
  preventDoubleClick
}





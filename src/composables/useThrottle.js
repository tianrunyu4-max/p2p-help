/**
 * 节流 Composable
 * 用于限制函数执行频率
 */

/**
 * 创建节流函数
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 节流间隔（毫秒）,默认200ms
 * @param {Object} options - 配置选项
 * @param {boolean} options.leading - 是否在间隔开始时调用,默认true
 * @param {boolean} options.trailing - 是否在间隔结束后调用,默认true
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, interval = 200, options = {}) {
  const {
    leading = true,
    trailing = true
  } = options

  let timer = null
  let lastCallTime = 0
  let lastInvokeTime = 0
  let lastArgs = null
  let lastThis = null
  let result

  function invokeFunc(time) {
    const args = lastArgs
    const thisArg = lastThis

    lastArgs = null
    lastThis = null
    lastInvokeTime = time
    result = fn.apply(thisArg, args)
    return result
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime

    // 首次调用或超过间隔时间
    return (lastCallTime === 0 || timeSinceLastCall >= interval)
  }

  function timerExpired() {
    const time = Date.now()
    
    if (shouldInvoke(time)) {
      return trailingEdge(time)
    }
    
    // 重新设置定时器
    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime
    const timeWaiting = interval - timeSinceLastInvoke
    
    timer = setTimeout(timerExpired, timeWaiting)
  }

  function trailingEdge(time) {
    timer = null
    
    // 只有在trailing为true且有待处理的调用时才执行
    if (trailing && lastArgs) {
      return invokeFunc(time)
    }
    
    lastArgs = null
    lastThis = null
    return result
  }

  function leadingEdge(time) {
    lastInvokeTime = time
    timer = setTimeout(timerExpired, interval)
    return leading ? invokeFunc(time) : result
  }

  function throttled(...args) {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastArgs = args
    lastThis = this
    lastCallTime = time

    if (isInvoking) {
      if (timer === null) {
        return leadingEdge(time)
      }
    }
    
    if (timer === null) {
      timer = setTimeout(timerExpired, interval)
    }
    
    return result
  }

  // 取消节流
  throttled.cancel = function() {
    if (timer !== null) {
      clearTimeout(timer)
    }
    lastCallTime = 0
    lastInvokeTime = 0
    lastArgs = null
    lastThis = null
    timer = null
  }

  // 立即执行
  throttled.flush = function() {
    return timer === null ? result : trailingEdge(Date.now())
  }

  return throttled
}

/**
 * 创建节流Hook(用于Vue组件)
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 节流间隔（毫秒）
 * @param {Object} options - 配置选项
 * @returns {Function} 节流后的函数
 */
export function useThrottle(fn, interval = 200, options = {}) {
  return throttle(fn, interval, options)
}

export default {
  throttle,
  useThrottle
}

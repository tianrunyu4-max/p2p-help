/**
 * 系统配置 - 新旧系统切换
 * 
 * 使用说明：
 * - USE_NEW_SYSTEM = true：使用新系统（二位竖排抽屉模型）
 * - USE_NEW_SYSTEM = false：使用旧系统（原有1+1模型）
 */

export const USE_NEW_SYSTEM = false // 默认使用旧系统，改为 true 启用新系统

/**
 * 获取当前使用的引擎
 */
export function getCurrentEngine() {
  if (USE_NEW_SYSTEM) {
    return import('../logic/newEngine.js').then(m => m.getNewEngine())
  } else {
    return import('../logic/engine.js').then(m => m.getEngine())
  }
}

/**
 * 获取当前使用的消息服务
 */
export function getCurrentMessageService() {
  if (USE_NEW_SYSTEM) {
    return import('../logic/newMessageService.js').then(m => m.getNewMessageService())
  } else {
    return import('../logic/messageService.js').then(m => m.default)
  }
}

export default {
  USE_NEW_SYSTEM,
  getCurrentEngine,
  getCurrentMessageService
}


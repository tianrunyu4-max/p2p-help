/**
 * 全局事件总线 - 用于组件间通信
 * 实现余额实时更新和跨标签页同步
 */
class EventBus {
    constructor() {
        this.listeners = {}
    }

    /**
     * 监听事件
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     * @returns {Function} 清理函数
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = []
        }
        this.listeners[event].push(callback)

        // 返回清理函数
        return () => this.off(event, callback)
    }

    /**
     * 移除监听器
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (!this.listeners[event]) return
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }

    /**
     * 触发事件
     * @param {string} event - 事件名
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        console.log(`[EventBus] 发送事件: ${event}`, data)

        if (!this.listeners[event]) return

        this.listeners[event].forEach(callback => {
            try {
                callback(data)
            } catch (err) {
                console.error(`[EventBus] 事件回调错误: ${event}`, err)
            }
        })
    }

    /**
     * 单次监听
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     */
    once(event, callback) {
        const wrapper = (data) => {
            callback(data)
            this.off(event, wrapper)
        }
        this.on(event, wrapper)
    }

    /**
     * 清空所有监听器
     */
    clear() {
        this.listeners = {}
    }
}

// 创建单例
export const eventBus = new EventBus()

/**
 * 事件名称常量
 */
export const EVENTS = {
    // 余额相关
    BALANCE_UPDATED: 'balance:updated',
    TRANSACTION_CREATED: 'transaction:created',

    // 用户相关
    USER_ACTIVATED: 'user:activated',
    USER_INFO_UPDATED: 'user:updated',

    // 系统相关
    STORAGE_CHANGED: 'storage:changed'
}

export default eventBus

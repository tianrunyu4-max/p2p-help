/**
 * Vue 组合式函数 - 多语言支持
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getI18n, t } from '../config/i18n.js'

export function useI18n() {
    const i18n = getI18n()
    const locale = ref(i18n.getLocale())

    // 监听语言变化
    let unsubscribe = null

    onMounted(() => {
        unsubscribe = i18n.onLocaleChange((newLocale) => {
            locale.value = newLocale
        })
    })

    onUnmounted(() => {
        if (unsubscribe) {
            unsubscribe()
        }
    })

    /**
     * 翻译函数
     */
    const translate = (path, params = {}) => {
        return t(path, params)
    }

    /**
     * 设置语言
     */
    const setLocale = (newLocale) => {
        if (i18n.setLocale(newLocale)) {
            locale.value = newLocale
            return true
        }
        return false
    }

    /**
     * 获取支持的语言列表
     */
    const supportedLocales = computed(() => i18n.getSupportedLocales())

    /**
     * 是否是 RTL 语言
     */
    const isRTL = computed(() => locale.value === 'ar')

    /**
     * 当前语言信息
     */
    const currentLocaleInfo = computed(() => {
        return supportedLocales.value.find(l => l.code === locale.value)
    })

    return {
        locale,
        t: translate,
        setLocale,
        supportedLocales,
        isRTL,
        currentLocaleInfo
    }
}

export default useI18n

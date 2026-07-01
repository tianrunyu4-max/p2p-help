import zh from '../i18n/locales/zh.js'
import en from '../i18n/locales/en.js'
import ar from '../i18n/locales/ar.js'
import ru from '../i18n/locales/ru.js'
import hi from '../i18n/locales/hi.js'
import ur from '../i18n/locales/ur.js'
import fil from '../i18n/locales/fil.js'

const messages = {
    'zh':    zh,
    'zh-CN': zh,   // 兼容旧存储值
    'en':    en,
    'ar':    ar,
    'ru':    ru,
    'hi':    hi,
    'ur':    ur,
    'fil':   fil,
}

class I18nManager {
    constructor() {
        this.storageKey = 'app_language'
        this.currentLocale = this.loadLocale()
        this.listeners = []
    }

    loadLocale() {
        try {
            const saved = localStorage.getItem(this.storageKey)
            if (saved && messages[saved]) {
                // 统一旧的 zh-CN 存储值为 zh
                return saved === 'zh-CN' ? 'zh' : saved
            }
            const browserLang = navigator.language || navigator.userLanguage || ''
            const lang = browserLang.toLowerCase()
            if (lang.startsWith('ar')) return 'ar'
            if (lang.startsWith('ru')) return 'ru'
            if (lang.startsWith('hi')) return 'hi'
            if (lang.startsWith('ur')) return 'ur'
            if (lang.startsWith('fil') || lang.startsWith('tl')) return 'fil'
            if (lang.startsWith('en')) return 'en'
            if (lang.startsWith('zh')) return 'zh'
        } catch (e) {
            console.error('加载语言设置失败:', e)
        }
        return 'zh'
    }

    setLocale(locale) {
        if (!messages[locale]) {
            console.error(`语言 "${locale}" 不支持`)
            return false
        }
        this.currentLocale = locale
        localStorage.setItem(this.storageKey, locale)
        document.documentElement.dir = (locale === 'ar' || locale === 'ur') ? 'rtl' : 'ltr'
        document.documentElement.lang = locale
        this.listeners.forEach(cb => cb(locale))
        return true
    }

    getLocale() {
        return this.currentLocale
    }

    t(path, params = {}) {
        const keys = path.split('.')
        // 先查当前语言
        let result = messages[this.currentLocale]
        for (const key of keys) {
            if (result && result[key] !== undefined) {
                result = result[key]
            } else {
                result = null
                break
            }
        }
        // 回退中文
        if (result === null || result === undefined) {
            result = messages['zh']
            for (const key of keys) {
                if (result && result[key] !== undefined) {
                    result = result[key]
                } else {
                    return path
                }
            }
        }
        if (typeof result === 'string' && Object.keys(params).length > 0) {
            Object.entries(params).forEach(([k, v]) => {
                result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
            })
        }
        return typeof result === 'string' ? result : path
    }

    getSupportedLocales() {
        return [
            { code: 'zh',  name: '中文',     nativeName: '中文简体', flag: '🇨🇳' },
            { code: 'en',  name: 'English',  nativeName: 'English',  flag: '🇺🇸' },
            { code: 'ar',  name: 'العربية',  nativeName: 'العربية',  flag: '🇸🇦' },
            { code: 'ru',  name: 'Русский',  nativeName: 'Русский',  flag: '🇷🇺' },
            { code: 'hi',  name: 'हिन्दी',   nativeName: 'हिन्दी',   flag: '🇮🇳' },
            { code: 'ur',  name: 'اردو',     nativeName: 'اردو',     flag: '🇵🇰' },
            { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
        ]
    }

    onLocaleChange(callback) {
        this.listeners.push(callback)
        return () => {
            const idx = this.listeners.indexOf(callback)
            if (idx > -1) this.listeners.splice(idx, 1)
        }
    }

    isRTL() {
        return this.currentLocale === 'ar' || this.currentLocale === 'ur'
    }
}

let i18nInstance = null

export function getI18n() {
    if (!i18nInstance) {
        i18nInstance = new I18nManager()
        const locale = i18nInstance.getLocale()
        document.documentElement.dir = (locale === 'ar' || locale === 'ur') ? 'rtl' : 'ltr'
        document.documentElement.lang = locale
    }
    return i18nInstance
}

export function t(path, params = {}) {
    return getI18n().t(path, params)
}

export default I18nManager

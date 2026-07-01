import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'
import ar from './locales/ar'
import ru from './locales/ru'
import hi from './locales/hi'
import ur from './locales/ur'
import fil from './locales/fil'

// RTL languages
export const RTL_LANGS = ['ar', 'ur']

const savedLang = localStorage.getItem('appLanguage') || 'zh'

// Set document direction for RTL on startup
if (RTL_LANGS.includes(savedLang)) {
  document.documentElement.setAttribute('dir', 'rtl')
  document.documentElement.setAttribute('lang', savedLang)
} else {
  document.documentElement.setAttribute('dir', 'ltr')
  document.documentElement.setAttribute('lang', savedLang)
}

export const i18n = createI18n({
  legacy: false,          // use Composition API style
  locale: savedLang,
  fallbackLocale: 'zh',
  messages: {
    zh,
    en,
    ar,
    ru,
    hi,
    ur,
    fil,
  },
})

/**
 * Switch app language and persist to localStorage
 * @param {string} lang - language code
 */
export function switchLanguage(lang) {
  i18n.global.locale.value = lang
  localStorage.setItem('appLanguage', lang)

  // Update document direction for RTL languages
  if (RTL_LANGS.includes(lang)) {
    document.documentElement.setAttribute('dir', 'rtl')
  } else {
    document.documentElement.setAttribute('dir', 'ltr')
  }
  document.documentElement.setAttribute('lang', lang)
}

export default i18n

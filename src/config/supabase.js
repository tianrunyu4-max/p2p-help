/**
 * Supabase 配置模块 - 安全版本
 * 
 * ⚠️ 重要安全说明：
 * 1. 生产环境不应直接从前端连接 Supabase
 * 2. 所有数据库操作应通过 Cloudflare Workers API 进行
 * 3. 此文件仅用于开发环境的实时订阅功能
 * 
 * 生产环境架构：
 * 前端 ---> Cloudflare Workers ---> Supabase
 *       (API with service_role key)
 */

import { createClient } from '@supabase/supabase-js'

// 环境判断
const isProduction = import.meta.env.VITE_APP_ENV === 'production'
const useMock = import.meta.env.VITE_USE_MOCK === 'true'

// 初始化 Supabase 客户端（开发环境 + 生产环境降级）
let supabase = null
let supabaseConfigured = false

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  })
  supabaseConfigured = true
  
  if (isProduction) {
    console.log('📊 [PROD] Supabase 客户端已初始化（降级备用）')
  } else {
    console.log('📊 [DEV] Supabase 客户端已初始化（实时订阅）')
  }
} else {
  if (isProduction) {
    console.warn('⚠️ [PROD] Supabase 未配置，仅使用 Worker API')
  }
}

/**
 * 检查是否应该使用真实 Supabase（仅开发环境）
 */
export const useRealSupabase = () => {
  return !isProduction && supabase !== null && !useMock
}

/**
 * 数据库表名常量（用于实时订阅）
 */
export const TABLES = {
  MESSAGES: 'messages',
  USERS: 'users',
  CONTENT_POSTS: 'content_posts',
  TRANSACTIONS: 'transactions',
  MODELS: 'models'
}

/**
 * Supabase 配置信息
 */
export const supabaseConfig = {
  isConfigured: supabaseConfigured,
  isProduction,
  useMock: !isProduction && useMock,
  // ⚠️ 不暴露 URL 和 Key 到生产环境
  url: isProduction ? '[HIDDEN]' : import.meta.env.VITE_SUPABASE_URL
}

// 开发环境日志
if (import.meta.env.DEV) {
  console.log('📊 Supabase 配置状态:', {
    已配置: supabaseConfig.isConfigured,
    生产环境: isProduction,
    使用Mock: supabaseConfig.useMock
  })
}

export { supabase }
export default supabase

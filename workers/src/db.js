import { createClient } from '@supabase/supabase-js'

// ── 复用 Supabase 客户端（Worker 全局缓存，同一实例内只创建一次）──
let _dbCache = null
let _dbUrl   = null

export function getDB(env) {
  if (!_dbCache || _dbUrl !== env.SUPABASE_URL) {
    _dbCache = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    })
    _dbUrl = env.SUPABASE_URL
  }
  return _dbCache
}

// ── 通用查询帮助 ──────────────────────────────────────────────
export async function getUser(db, userId) {
  const { data } = await db.from('users').select('*').eq('id', userId).single()
  return data
}

export async function getShop(db, shopId) {
  const { data } = await db.from('shops').select('*').eq('id', shopId).single()
  return data
}

// 生成6位纯数字ID（确保唯一）
export async function generateUserId(db) {
  for (let i = 0; i < 10; i++) {
    const no = '8' + String(Math.floor(10000 + Math.random() * 90000))
    const { data } = await db.from('users').select('id').eq('user_no', no).maybeSingle()
    if (!data) return no
  }
  throw new Error('无法生成唯一ID')
}

// 生成6位邀请码（字母+数字）
export async function generateInviteCode(db) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let i = 0; i < 10; i++) {
    let code = ''
    for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)]
    const { data } = await db.from('users').select('id').eq('invite_code', code).maybeSingle()
    if (!data) return code
  }
  throw new Error('无法生成唯一邀请码')
}

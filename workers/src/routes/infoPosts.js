/**
 * 海外信息发布路由
 *
 * 数据模型 (Supabase 表: info_posts)
 * ─────────────────────────────────────────────────────────────
 * id          UUID      主键 gen_random_uuid()
 * type        TEXT      类型: purchase/supply/job/house/secondhand/
 *                             logistics/service/visa/social/promo
 * category    TEXT      子分类（随 type 变化的二级分类）
 * city        TEXT      城市/区域（迪拜·国际城 等）
 * title       TEXT      标题，最长40字
 * desc        TEXT      详细描述，最长300字
 * images      JSONB     图片URL数组，最多6张，默认 []
 * contact     TEXT      联系人姓名
 * phone       TEXT      电话/微信号
 * price       NUMERIC   价格，单位AED（仅 house/secondhand）
 * salary      TEXT      薪资说明（仅 job）
 * quantity    TEXT      数量/规格（仅 purchase/supply）
 * user_id     TEXT      发布者ID（可选，支持匿名）
 * user_name   TEXT      发布者昵称
 * status      TEXT      active/hidden/deleted，默认 active
 * expires_at  TIMESTAMPTZ 过期时间，默认发布后30天
 * created_at  TIMESTAMPTZ 创建时间
 * updated_at  TIMESTAMPTZ 最后更新时间
 * ─────────────────────────────────────────────────────────────
 *
 * Supabase SQL (首次部署时执行):
 *
 * CREATE TABLE IF NOT EXISTS info_posts (
 *   id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   type        TEXT NOT NULL CHECK (type IN (
 *                 'purchase','supply','job','house','secondhand',
 *                 'logistics','service','visa','social','promo')),
 *   category    TEXT NOT NULL DEFAULT '其他',
 *   city        TEXT NOT NULL DEFAULT '迪拜·国际城',
 *   title       TEXT NOT NULL,
 *   "desc"      TEXT NOT NULL,
 *   images      JSONB NOT NULL DEFAULT '[]'::jsonb,
 *   contact     TEXT NOT NULL,
 *   phone       TEXT NOT NULL,
 *   price       NUMERIC,
 *   salary      TEXT,
 *   quantity    TEXT,
 *   user_id     TEXT,
 *   user_name   TEXT,
 *   status      TEXT NOT NULL DEFAULT 'active'
 *               CHECK (status IN ('active','hidden','deleted')),
 *   expires_at  TIMESTAMPTZ NOT NULL
 *               DEFAULT (now() + interval '30 days'),
 *   created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * -- 自动更新 updated_at
 * CREATE OR REPLACE FUNCTION set_updated_at()
 * RETURNS TRIGGER AS $$
 * BEGIN NEW.updated_at = now(); RETURN NEW; END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER info_posts_updated_at
 *   BEFORE UPDATE ON info_posts
 *   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
 *
 * -- 索引
 * CREATE INDEX idx_info_posts_type    ON info_posts(type);
 * CREATE INDEX idx_info_posts_city    ON info_posts(city);
 * CREATE INDEX idx_info_posts_status  ON info_posts(status);
 * CREATE INDEX idx_info_posts_created ON info_posts(created_at DESC);
 * CREATE INDEX idx_info_posts_expires ON info_posts(expires_at);
 *
 * -- RLS (如需前端直连 Supabase 时开启)
 * ALTER TABLE info_posts ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "public read active posts" ON info_posts
 *   FOR SELECT USING (status = 'active' AND expires_at > now());
 */

import { Router } from 'itty-router'

const router = Router()

// 允许的类型白名单
const VALID_TYPES = [
  'purchase','supply','job','house','secondhand',
  'logistics','service','visa','social','promo',
]

// 每页条数
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

/**
 * GET /api/info/posts
 * 获取信息列表（分页 + 筛选）
 *
 * 查询参数:
 *   type      TEXT    按类型筛选（可多个，逗号分隔）
 *   city      TEXT    按城市筛选（模糊匹配前缀，如"迪拜"匹配所有迪拜子区）
 *   keyword   TEXT    标题/描述关键词搜索
 *   page      INT     页码，从1开始，默认1
 *   pageSize  INT     每页条数，默认20，最大50
 *   sort      TEXT    排序: newest(默认)/price_asc/price_desc
 */
router.get('/api/info/posts', async (request) => {
  const { supabase } = request
  const url = new URL(request.url)

  const types    = url.searchParams.get('type')?.split(',').filter(t => VALID_TYPES.includes(t))
  const city     = url.searchParams.get('city')?.trim()
  const keyword  = url.searchParams.get('keyword')?.trim()
  const page     = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE))))
  const sort     = url.searchParams.get('sort') || 'newest'

  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  try {
    let query = supabase
      .from('info_posts')
      .select('id,type,category,city,title,desc,images,contact,phone,price,salary,quantity,user_name,created_at,expires_at', { count: 'exact' })
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())

    if (types?.length) query = query.in('type', types)
    if (city)          query = query.ilike('city', `${city}%`)
    if (keyword)       query = query.or(`title.ilike.%${keyword}%,desc.ilike.%${keyword}%`)

    if (sort === 'price_asc')  query = query.order('price', { ascending: true,  nullsFirst: false })
    else if (sort === 'price_desc') query = query.order('price', { ascending: false, nullsFirst: false })
    else                       query = query.order('created_at', { ascending: false })

    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) throw error

    return new Response(JSON.stringify({
      code: 0,
      data: data || [],
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) }
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[infoPosts GET list]', err)
    return new Response(JSON.stringify({ code: 500, message: '获取失败', error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * GET /api/info/posts/:id
 * 获取单条详情
 */
router.get('/api/info/posts/:id', async (request) => {
  const { supabase, params } = request
  try {
    const { data, error } = await supabase
      .from('info_posts')
      .select('*')
      .eq('id', params.id)
      .eq('status', 'active')
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ code: 404, message: '信息不存在或已下架' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ code: 0, data }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, message: '获取失败' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * POST /api/info/posts
 * 发布新信息
 *
 * 请求体 (JSON):
 *   type      TEXT  必填
 *   category  TEXT  必填
 *   city      TEXT  必填
 *   title     TEXT  必填，最长40字
 *   desc      TEXT  必填，最长300字
 *   images    TEXT[]  选填，图片URL数组，最多6张
 *   contact   TEXT  必填
 *   phone     TEXT  必填
 *   price     NUM   选填（house/secondhand）
 *   salary    TEXT  选填（job）
 *   quantity  TEXT  选填（purchase/supply）
 *   user_id   TEXT  选填
 *   user_name TEXT  选填
 *   expires_days INT  过期天数，默认30，最大90
 */
router.post('/api/info/posts', async (request) => {
  const { supabase } = request

  let body
  try { body = await request.json() }
  catch { return new Response(JSON.stringify({ code: 400, message: '请求格式错误' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }

  // 必填校验
  const required = ['type','category','city','title','desc','contact','phone']
  for (const f of required) {
    if (!body[f]?.toString().trim()) {
      return new Response(JSON.stringify({ code: 400, message: `${f} 不能为空` }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  if (!VALID_TYPES.includes(body.type)) {
    return new Response(JSON.stringify({ code: 400, message: '无效的发布类型' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (body.title.length > 40)  return new Response(JSON.stringify({ code: 400, message: '标题不能超过40字' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  if (body.desc.length > 300)  return new Response(JSON.stringify({ code: 400, message: '描述不能超过300字' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  const images = Array.isArray(body.images) ? body.images.slice(0, 6) : []
  const expireDays = Math.min(90, Math.max(1, parseInt(body.expires_days || '30')))
  const expiresAt = new Date(Date.now() + expireDays * 86400000).toISOString()

  const row = {
    type:       body.type,
    category:   body.category.trim(),
    city:       body.city.trim(),
    title:      body.title.trim(),
    desc:       body.desc.trim(),
    images,
    contact:    body.contact.trim(),
    phone:      body.phone.trim(),
    price:      body.price != null ? parseFloat(body.price) || null : null,
    salary:     body.salary?.trim() || null,
    quantity:   body.quantity?.trim() || null,
    user_id:    body.user_id?.trim() || null,
    user_name:  body.user_name?.trim() || '匿名用户',
    status:     'active',
    expires_at: expiresAt,
  }

  try {
    const { data, error } = await supabase.from('info_posts').insert(row).select().single()
    if (error) throw error

    return new Response(JSON.stringify({ code: 0, message: '发布成功', data }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[infoPosts POST]', err)
    return new Response(JSON.stringify({ code: 500, message: '发布失败', error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * DELETE /api/info/posts/:id
 * 删除（软删除，status = deleted）
 * 需要 user_id 匹配
 */
router.delete('/api/info/posts/:id', async (request) => {
  const { supabase, params } = request

  let body = {}
  try { body = await request.json() } catch {}

  const userId = body.user_id || request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ code: 401, message: '需要用户身份' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const { data: post, error: fetchErr } = await supabase
      .from('info_posts').select('id,user_id').eq('id', params.id).single()

    if (fetchErr || !post) {
      return new Response(JSON.stringify({ code: 404, message: '信息不存在' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      })
    }

    if (post.user_id !== userId) {
      return new Response(JSON.stringify({ code: 403, message: '无权删除他人发布的信息' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      })
    }

    const { error } = await supabase
      .from('info_posts').update({ status: 'deleted' }).eq('id', params.id)
    if (error) throw error

    return new Response(JSON.stringify({ code: 0, message: '已删除' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, message: '删除失败' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * GET /api/job/points?userId=X
 * 获取用户当前拼团券数量（用于发布前校验）- 前端已改从 subscription/status 读取，此接口保留兼容
 */
router.get('/api/job/points', async (request) => {
  const { supabase } = request
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')?.trim()

  if (!userId) {
    return new Response(JSON.stringify({ code: 400, message: 'userId 不能为空' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('coupon_count')
      .eq('id', userId)
      .single()

    return new Response(JSON.stringify({ code: 0, points: user?.coupon_count || 0 }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, message: '查询失败' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})

/**
 * POST /api/job/publish
 * 消耗1张拼团券发布工作室项目或兼职任务
 *
 * 请求体:
 *   userId    TEXT  必填
 *   category  TEXT  必填: studio | parttime
 *   title     TEXT  必填，最长40字
 *   desc      TEXT  必填，最长300字
 *   salary    TEXT  选填
 *   phone     TEXT  必填
 *   contact   TEXT  选填
 */
router.post('/api/job/publish', async (request) => {
  const { supabase } = request

  let body
  try { body = await request.json() }
  catch { return new Response(JSON.stringify({ code: 400, message: '请求格式错误' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }

  const { userId, category, title, desc, salary, phone, contact } = body

  if (!userId?.trim()) return new Response(JSON.stringify({ code: 400, message: 'userId 不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  if (!['studio', 'parttime'].includes(category)) return new Response(JSON.stringify({ code: 400, message: 'category 无效' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  if (!title?.trim()) return new Response(JSON.stringify({ code: 400, message: '标题不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  if (!desc?.trim()) return new Response(JSON.stringify({ code: 400, message: '描述不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  if (!phone?.trim()) return new Response(JSON.stringify({ code: 400, message: '联系方式不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  const COST = 1 // 消耗1张拼团券

  try {
    // 1. 读取用户拼团券数量（CAS）
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('id, coupon_count')
      .eq('id', userId.trim())
      .single()

    if (fetchErr || !user) {
      return new Response(JSON.stringify({ code: 404, message: '用户不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const currentCoupons = user.coupon_count || 0
    if (currentCoupons < COST) {
      return new Response(JSON.stringify({ code: 400, message: `拼团券不足，需要${COST}张，当前${currentCoupons}张` }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // 2. CAS 扣减拼团券
    const { error: updateErr } = await supabase
      .from('users')
      .update({ coupon_count: currentCoupons - COST })
      .eq('id', userId.trim())
      .eq('coupon_count', currentCoupons)

    if (updateErr) {
      return new Response(JSON.stringify({ code: 409, message: '拼团券更新冲突，请重试' }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }

    // 3. 发布信息
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
    const { data: post, error: insertErr } = await supabase.from('info_posts').insert({
      type: 'job',
      category: category.trim(),
      city: '迪拜·国际城',
      title: title.trim(),
      desc: desc.trim(),
      images: [],
      contact: contact?.trim() || '匿名',
      phone: phone.trim(),
      salary: salary?.trim() || null,
      user_id: userId.trim(),
      user_name: contact?.trim() || '匿名',
      status: 'active',
      expires_at: expiresAt,
    }).select().single()

    if (insertErr) throw insertErr

    return new Response(JSON.stringify({ code: 0, message: '发布成功', data: post, remainingPoints: newPoints }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[job/publish]', err)
    return new Response(JSON.stringify({ code: 500, message: '发布失败', error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})

export const infoPostsRoutes = router

-- ================================================================
-- p2p-help 数据库建表 SQL
-- 在 Supabase 新项目的 SQL Editor 中执行
-- ================================================================

-- 用户表
CREATE TABLE users (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_no         VARCHAR(6) UNIQUE NOT NULL,        -- 6位数字ID
  phone           VARCHAR(20) UNIQUE NOT NULL,
  invite_code     VARCHAR(6)  UNIQUE NOT NULL,        -- 我的邀请码
  referrer_id     UUID REFERENCES users(id),          -- 我的推荐人
  invite_used     INT DEFAULT 0,                      -- 邀请码使用次数（最多2次）
  is_active       BOOLEAN DEFAULT FALSE,              -- 是否已激活
  is_frozen       BOOLEAN DEFAULT FALSE,              -- 是否被冻结
  is_exited       BOOLEAN DEFAULT FALSE,              -- 是否已出局（店长→店主）
  is_node         BOOLEAN DEFAULT FALSE,              -- 是否是管理员预设节点
  node_order      INT DEFAULT 0,                      -- 节点排序
  role            VARCHAR(20) DEFAULT 'member',       -- member/manager/owner
  current_shop_id UUID,                               -- 当前所在店铺
  wechat_qr       TEXT,                               -- 微信收款码URL
  alipay_qr       TEXT,                               -- 支付宝收款码URL
  total_received  DECIMAL(12,2) DEFAULT 0,            -- 累计收款
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 店铺表（1+1模型）
CREATE TABLE shops (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot1_owner_id  UUID REFERENCES users(id) NOT NULL, -- 店主（永久）
  slota_tenant_id UUID REFERENCES users(id),          -- 店长（可为null）
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 激活订单（汇总18笔支付任务）
CREATE TABLE activation_orders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES users(id) NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending',      -- pending/partial/completed
  total_tasks     INT DEFAULT 0,
  confirmed_tasks INT DEFAULT 0,
  is_repurchase   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- 支付任务（P2P单笔）
CREATE TABLE payment_tasks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID REFERENCES activation_orders(id) NOT NULL,
  payer_id        UUID REFERENCES users(id) NOT NULL,   -- 付款方（新用户）
  receiver_id     UUID REFERENCES users(id) NOT NULL,   -- 收款方
  amount          DECIMAL(10,2) NOT NULL,               -- 金额
  type            VARCHAR(30) NOT NULL,                 -- jian_dian/bang_fu/ping_ji_1...ping_ji_15
  type_label      VARCHAR(50),
  level           INT,                                  -- 平级层数（1-15）
  status          VARCHAR(30) DEFAULT 'pending',
  -- pending → screenshot_uploaded → confirmed
  --                               → timeout → ai_review → confirmed/frozen
  screenshot_url  TEXT,
  deadline        TIMESTAMPTZ,                          -- 截图上传后30分钟截止
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 索引 ──────────────────────────────────────────────────────
CREATE INDEX idx_users_referrer      ON users(referrer_id);
CREATE INDEX idx_users_invite_code   ON users(invite_code);
CREATE INDEX idx_users_is_node       ON users(is_node);
CREATE INDEX idx_shops_owner         ON shops(slot1_owner_id);
CREATE INDEX idx_orders_user         ON activation_orders(user_id);
CREATE INDEX idx_orders_status       ON activation_orders(status);
CREATE INDEX idx_tasks_order         ON payment_tasks(order_id);
CREATE INDEX idx_tasks_payer         ON payment_tasks(payer_id);
CREATE INDEX idx_tasks_receiver      ON payment_tasks(receiver_id);
CREATE INDEX idx_tasks_status        ON payment_tasks(status);
CREATE INDEX idx_tasks_deadline      ON payment_tasks(deadline) WHERE status = 'screenshot_uploaded';

-- ── RLS（Row Level Security）────────────────────────────────
-- 关闭RLS，用 service_role key 在 Worker 里控制权限
ALTER TABLE users             DISABLE ROW LEVEL SECURITY;
ALTER TABLE shops             DISABLE ROW LEVEL SECURITY;
ALTER TABLE activation_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_tasks     DISABLE ROW LEVEL SECURITY;

-- ── Supabase Storage bucket ────────────────────────────────
-- 在 Supabase 控制台手动创建：
--   Bucket 名称：p2p-images
--   Public：true（公开访问）

-- ── 初始管理员节点用户（激活后手动执行）──────────────────────
-- 先注册15个节点账号，再执行：
-- UPDATE users SET is_node = true, node_order = 1 WHERE user_no = 'XXXXXX';
-- UPDATE users SET is_node = true, node_order = 2 WHERE user_no = 'XXXXXX';
-- ... 依次设置15个节点

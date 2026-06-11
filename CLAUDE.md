# p2p-help 项目说明（Claude 每次新对话自动读取）

## ⚠️ 每次新对话必须做的事
1. `git log --oneline -5` 看最新版本，**基于最新 main 修改**
2. **绝对不要修改 task-wall 项目**，两个项目完全独立
3. **修改前先读文件**，不要凭记忆改代码
4. **只用中文回复**，用户是中国人

## ⚠️ APK 打包完整流程
```bash
# 1. 触发 GitHub Actions 打包
gh workflow run build-apk.yml --repo tianrunyu4-max/p2p-help

# 2. 等待约 3 分钟，查看运行ID
gh run list --repo tianrunyu4-max/p2p-help --limit 3

# 3. 下载 APK（替换 <runId>）
gh run download <runId> --repo tianrunyu4-max/p2p-help --dir "C:/Users/Administrator/Desktop/p2p-apk"

# 4. APK 路径：C:/Users/Administrator/Desktop/p2p-apk/p2p-help-debug/app-debug.apk
# 注意：capacitor.config.json 无 server.url，APK 本地打包，资产内嵌
```

---

## 项目基本信息
- **路径**：C:\Users\Administrator\Desktop\p2p-help
- **性质**：全新独立项目，与 task-wall 无关
- **前端**：Vue 3 + Vite，hash 路由，base: './'（Capacitor 需要）
- **后端**：Cloudflare Workers，数据库 Supabase（独立项目）
- **域名**：p2p.ai-airdrop.uk（子域名）
- **管理员密码**：`152527aB,152527aa`

---

## 当前业务制度（最新版，2026-06-11）

### 三档激活体系
| 档位 | 激活金 | 打款方式 | 见点奖 | 帮扶奖 | 平级每层 |
|------|--------|---------|--------|--------|---------|
| V1 入门 | **30元** | **1笔30整付** | 10元入余额 | 4×2入余额 | 1元入余额 |
| V2 进阶 | **90元** | **3笔30整付** | 30元入余额 | 12×2入余额 | 3元入余额 |
| V3 旗舰 | **260元** | 逐笔直打（5笔） | 80元直达老板 | 30×2直打 | 10元入余额 |

### ⚠️ 两种资金模式（2026-06-11 重构）
- **V3 = 逐笔直打**：见点80直接扫老板的码，帮扶直打，平级60×2给节点+链上记余额
- **V1/V2 = 30元整付+记账分配**：
  - 每笔30优先匹配提现队列用户（提现额正好30），队列空打平台账户（节点1）
  - 订单全部确认后，按 `allocations` 清单记余额（见点/帮扶）+ creditPingjiiChain 12层
  - 任务type：`flat_withdraw`（直达提现用户）/ `flat_admin`（平台账户）
- **平级提现**：申请扣余额30 → 入队列 → 被30整付或V3平级位匹配（V3拆30提现+30差额给节点）
- **两种钱的区分**：`source: 'paid'`实收（到微信）/ `'balance'`余额记账（满30提现）
- **复投阈值口径 = totalEarned**（实收total_received + pingjii_records总和）

- 帮扶奖：给老板直推中已出局者；未出局→匹配生活补贴玩家
- 前端不显示"12层"，统一用"平级链"

### 复投规则（2026-06-11 最终版：三档统一）
- **三档统一**：总收益（实收+余额）满 ¥1000 → 账号锁定 → 须复投 V3（¥260）解锁 → 循环

- 触达阈值 → 账号锁定，不能新发出订单（已有进行中订单不受影响）
- 复投选错档位 → 后端报错"须复投Vx解锁账号"
- `total_received` 不重置，累计计算

### 参与流程（自愿参与页 ParticipatePage.vue）
1. 进页面 → **永远先停在 Step 1 选档位**（不自动跳过）
2. 已有进行中订单 → 直接跳 Step 4（通过 GET /api/activate/order 检测）
3. 账号锁定 → Step 1 显示红色锁定横幅，档位预选且不可更改
4. 用户选好后点"下一步"：
   - 无邀请码新用户 → Step 2 填邀请码
   - 已绑定/已激活/复投 → Step 3 loading → Step 4 支付列表
5. Step 4 打款完成后，显示"继续打下一笔"按钮，自动导航

### 贡献机制（出局后邀请链贡献）
- **无滑落** (`contribution_slot='first'`)：第1个直推贡献回原模型（`invite_used=0`时触发）
- **有滑落** (`contribution_slot='fifth'`)：第2个直推贡献回原模型（`invite_used=1`时触发）
- 贡献触发后 `has_contributed=true`，后续不再触发

### 帮扶奖匹配逻辑
- 新人激活时：老板的2位直推中 → 已出局者直接收
- 未出局 → 匹配 `subsidy_queue` 中等待的生活补贴玩家（status='waiting'）
- 仍无人 → 打给平级节点账号（bang_fu_admin）

### 身份勋章（社区顶部）
| 勋章 | 条件 |
|------|------|
| 🌱 游客 | 未激活 |
| 👑 老板 | role='owner' 或 is_exited=true |
| 👔 代理 | 已激活且非老板 |

---

## 重要文件
- `src/main.js` - Capacitor检测（localhost/capacitor协议→API指向线上）
- `src/views/ParticipatePage.vue` - 参与页（三档选择、复投锁定流程）
- `src/views/PaymentDetail.vue` - 单笔打款页（上传截图、继续下一笔）
- `src/views/CommunityPage.vue` - 社区聊天页（keep-alive，30s轮询）
- `src/views/MyShop.vue` - 我的店铺（收款面板显示档位/进度/锁定状态）
- `src/views/PendingConfirm.vue` - 待确认收款（按钮加锁防重复）
- `src/views/ProfilePage.vue` - 我的页面（换设备找回账号）
- `src/views/AdminPanel.vue` - 管理后台
- `src/stores/userStore.js` - 用户状态
- `src/App.vue` - 全局入口（keep-alive包裹主要页面）
- `capacitor.config.json` - **无 server.url，APK 本地打包**，API检测用main.js
- `workers/src/routes/activate.js` - 激活核心（TIERS三档、REINVEST_RULES、creditPingjiiChain）
- `workers/src/routes/orders.js` - 截图上传+确认收款（安全校验、CAS原子确认）
- `workers/src/routes/shop.js` - 店铺逻辑（team-stats含复投状态）
- `workers/src/routes/pingjii.js` - 平级提现（WITHDRAW_MIN=30）
- `workers/src/routes/admin.js` - 管理接口（手动激活、fix-shop）
- `workers/src/routes/community.js` - 社区消息+大虾AI
- `workers/src/routes/subsidy.js` - 生活补贴队列
- `workers/src/db.js` - Supabase客户端（全局缓存）

---

## ✅ 已完成改动记录（不要重复做）

### 2026-06-11 V1/V2整付模式 + 明细体系
- `activate.js`：buildFlatTasks（30整付匹配）、creditFlatAllocations（确认后记余额）、getTotalEarned（复投口径）、防重复订单（pending复用/换档作废+队列回退）
- `orders.js`：checkTimeouts 30分钟超时自动确认（auto_confirmed标记）、pending-confirm返回{pending,recentDone}
- `admin.js`：force-complete加CAS守卫防重复加钱
- `shop.js`：team-stats返回totalEarned/pingjiiBalance/source标记，pingjii_records按reward_type映射标签
- `MyShop.vue`：明细✅实收/💰记入余额标签、平级余额行、收益进度用totalEarned
- `PendingConfirm.vue`：近7天收款记录+超时自动确认橙色标签
- 新表 `pingjii_records`（user_id/amount/layer/from_user_no/reward_type）
- 新列：activation_orders.allocations(JSONB)、payment_tasks.auto_confirmed、pingjii_records.reward_type

### 2026-06-10 OTA热更新 + 0撸 + 社区AI
- `@capgo/capacitor-updater`：APK后台静默更新，deploy.yml打包bundle.zip，/api/app-update版本接口
- `zeroPosts.js` + CommunityPage 0撸tab：每天20条/2图/30字，表zero_posts
- community.js AI提示词更新为三档制度

### 2026-06-10 三档复投锁定体系
- `activate.js`：REINVEST_RULES，getUserCurrentTier，getReinvestStatus，/api/activate/reinvest-status
- `shop.js`：team-stats 新增 currentTier/reinvestLocked/reinvestThreshold/reinvestRequiredTier
- `MyShop.vue`：收款面板显示档位徽章、动态进度条、锁定告警+复投按钮
- `ParticipatePage.vue`：永远先停Step1、锁定预选档位、handleStep1Next分流

### 2026-06-10 三档激活体系 V1/V2/V3
- `activate.js`：TIERS={V1:30, V2:90, V3:260}，tier参数贯穿所有函数
- `ParticipatePage.vue`：Step1档位选择卡片（三档），传tier给API
- `CommunityPage.vue`：去掉"我的店铺"v-else，始终显示"自愿参与"

### 2026-06-10 支付流程改善
- `PaymentDetail.vue`：上传截图后显示"继续打下一笔"，自动导航不返回列表
- Supabase Storage：p2p-media bucket（公开，允许SELECT/INSERT/UPDATE/DELETE）

### 历史改动（已稳定）
- `checkContribution`：pushCount===0(无滑落) / pushCount===1(有滑落)
- `rotateIntoShop`：出局时 rotation_count+1
- 截图安全：最小30KB、URL来源校验、防复用、CAS原子确认
- keep-alive保活：Community/MyShop/SubsidyPage/PendingConfirm
- 消息localStorage缓存（5分钟TTL）
- ProfilePage：换设备找回账号功能

---

## Supabase 数据库
- **项目ID**：`nygskhqxjddkqlckafjw`
- **SQL Editor**：https://supabase.com/dashboard/project/nygskhqxjddkqlckafjw/sql/new
- **表**：users / shops / activation_orders / payment_tasks / messages / subsidy_queue / pingjii_withdraw_queue

### users 表关键字段
```
user_no, email, invite_code, invite_used
referrer_id, is_active, is_exited, role
total_received, pingjii_balance, is_frozen
is_pingjii_node, pingjii_node_order
has_contributed, contribution_slot
current_shop_id, has_slide_down
wechat_qr, alipay_qr, security_answer
```

### activation_orders 表关键字段
```
user_id, status(pending/partial/completed)
total_tasks, confirmed_tasks
tier(V1/V2/V3), is_repurchase
```

---

## Cloudflare Workers 环境变量
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `JWT_SECRET`
- `ADMIN_PASSWORD` = `152527aB,152527aa`
- `DEEPSEEK_API_KEY` = 大虾AI接口密钥

---

## 部署命令
```bash
cd "C:\Users\Administrator\Desktop\p2p-help"
git add 文件名 && git commit -m "fix/feat: 描述" && git push origin main
```

# p2p-help 项目说明（Claude 每次新对话自动读取）

## ⚠️ 每次新对话必须做的事
1. `git log --oneline -5` 看最新版本，**基于最新 main 修改**
2. **绝对不要修改 task-wall 项目**，两个项目完全独立
3. **修改前先读文件**，不要凭记忆改代码
4. **只用中文回复**，用户是中国人

## ⚠️ APK 改动必须做的完整流程
1. 改代码 → `git push` → GitHub Actions 自动打包（约2分钟）
2. `gh run download <runId> --repo tianrunyu4-max/p2p-help --dir "C:/Users/Administrator/Desktop/p2p-apk"`
3. `cp "C:/Users/Administrator/Desktop/p2p-apk/p2p-help-debug/app-debug.apk" "C:/Users/Administrator/Desktop/p2p-help/public/app.apk"`
4. `git add public/app.apk && git commit -m "chore: 更新APK" && git push origin main`
5. 下载地址：**https://p2p.ai-airdrop.uk/app.apk**

---

## 项目基本信息
- **路径**：C:\Users\Administrator\Desktop\p2p-help
- **性质**：全新独立项目，与 task-wall 无关
- **前端**：Vue 3 + Vite，hash 路由
- **后端**：Cloudflare Workers，数据库 Supabase（新建独立项目）
- **域名**：p2p.ai-airdrop.uk（子域名）
- **APK下载**：https://p2p.ai-airdrop.uk/app.apk（每次改动后更新）
- **管理员密码**：`152527aB,152527aa`（含逗号，整体是一个密码）

---

## 当前业务制度（最新版，2026年6月）

### 激活金分配（260元全部P2P点对点）
| 类型 | 金额 | 收款人 |
|------|------|--------|
| 见点奖 | **80元** | 老板（永久） |
| 帮扶奖 | **30×2=60元** | 老板直推中已出局者；未出局→匹配生活补贴玩家 |
| 平级奖 | **10×12=120元** | 沿邀请链向上，代码12层，前端显示"平级链" |
| **合计** | **260元** ✓ | |

> ⚠️ 前端不显示"12层"字样，统一用"平级链"

### 复投规则
- 累计收款 ≥ **900元** → 必须复投（重走激活流程）

### 贡献机制（出局后邀请链贡献）
- **无滑落** (`contribution_slot='first'`)：第1个直推贡献回原模型（`invite_used=0`时触发）
- **有滑落** (`contribution_slot='fifth'`)：第2个直推贡献回原模型（`invite_used=1`时触发）
- 贡献触发后 `has_contributed=true`，后续不再触发
- ⚠️ `checkContribution` 函数在 `activate.js`，条件已修正为 `pushCount===0` / `pushCount===1`

### 身份勋章（社区顶部ID旁显示）
| 勋章 | 条件 |
|------|------|
| 🌱 游客 | 未激活 |
| 👑 老板 | role='owner' 或 is_exited=true |
| 👔 代理 | 已激活且非老板 |

---

## 重要文件
- `src/main.js` - Capacitor检测（localhost→API指向线上）
- `src/views/CommunityPage.vue` - 社区聊天页（keep-alive保活，30s轮询刷新用户状态）
- `src/views/MyShop.vue` - 我的店铺（团队数据4格：直推代理/出局老板/累计收款/距复投）
- `src/views/PendingConfirm.vue` - 待确认收款（按钮加锁防重复）
- `src/views/ProfilePage.vue` - 我的页面（含换设备找回账号功能）
- `src/views/AdminPanel.vue` - 管理后台（手动内排激活、用户管理）
- `src/stores/userStore.js` - 用户状态（暴露refreshUser，后台静默刷新）
- `src/services/messageService.js` - 消息服务（localStorage缓存5分钟）
- `src/App.vue` - 全局入口（keep-alive包裹4个主要页面）
- `capacitor.config.json` - Capacitor配置（appName="1+1"，无server.url，本地打包）
- `workers/src/routes/activate.js` - 激活核心（ACTIVATE_AMOUNT=260, JIAN_DIAN=80, MAX_LEVEL=12）
- `workers/src/routes/admin.js` - 管理接口（手动激活、fix-shop、fix-rotation-count）
- `workers/src/routes/orders.js` - 截图上传+确认收款（安全校验）
- `workers/src/routes/shop.js` - 店铺逻辑（REPURCHASE_LIMIT=900，rotation_count统计）
- `workers/src/routes/community.js` - 社区消息+大虾AI提示词
- `workers/src/db.js` - Supabase客户端（全局缓存）

---

## ✅ 已完成改动记录（不要重复做）

### 数据
- 激活金 230→260，见点奖 70→80，平级 10层→12层，复投阈值 700→900
- shops表加 `rotation_count` 列（Supabase已执行ALTER TABLE）
- 830274店铺 rotation_count 手动修正为 2

### 逻辑修复
- `checkContribution`：`pushCount===0`(无滑落) / `pushCount===1`(有滑落)，已修正
- `rotateIntoShop`：出局时 `rotation_count+1`，已补充
- `team-stats`：`bossesExited` 改用 `shop.rotation_count`，`agentsJoined` = rotation_count + 当前代理
- `manual-activate`：激活后调用 `rotateIntoShop`，新人正确进入店铺模型
- `fix-shop/:userNo`：管理接口，补做店铺旋转（修复手动激活未进店问题）

### 安全加固
- 截图：最小30KB、URL来源校验(p2p-media)、防复用、CAS原子确认
- 前端：confirming/disputing加锁防双击

### 性能优化
- keep-alive保活：Community/MyShop/SubsidyPage/PendingConfirm
- 消息localStorage缓存（5分钟TTL），切标签秒显示
- DB客户端全局缓存，消息30条，老用户后台静默刷新
- Capacitor本地打包（去掉server.url），API检测用 `hostname==='localhost'`

### 管理后台新功能
- 手动内排激活（跳过付款流程，自动执行店铺旋转）
- 用户管理：只显示激活用户，展示推荐人ID/身份/出局人数
- fix-rotation-count：修复历史rotation_count数据

### 前端改动
- 社区输入框：只保留 `@大虾`
- 团队数据：4格显示（去掉直推/团队总人数，去掉单位字）
- 邀请码：仅激活用户可见（游客显示"🔒激活后才能获得邀请码"）
- ProfilePage：加"换设备找回账号"功能（输入ID+安全答案）
- 平级奖页：去掉不存在的解锁逻辑，统一用"平级链"

---

## Supabase 数据库
- **项目ID**：`nygskhqxjddkqlckafjw`
- **SQL Editor**：https://supabase.com/dashboard/project/nygskhqxjddkqlckafjw/sql/new
- **表**：users / shops / activation_orders / payment_tasks / messages / subsidy_queue

### shops 表关键字段
```
slot1_owner_id  -- 老板（永久位）
slota_tenant_id -- 代理（流动位）
rotation_count  -- 累计旋转次数（代理出局+1）
```

### users 表关键字段
```
user_no, is_active, is_exited, role
referrer_id, invite_code, invite_used
total_received, is_frozen
is_node, node_order        -- 平级补位节点
has_contributed            -- 是否已触发贡献
contribution_slot          -- 'first'无滑落 / 'fifth'有滑落
current_shop_id            -- 当前所在店铺
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

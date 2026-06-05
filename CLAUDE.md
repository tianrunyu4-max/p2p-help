# p2p-help 项目说明（Claude 每次新对话自动读取）

## ⚠️ 每次新对话必须做的事
1. `git log --oneline -5` 看最新版本，**基于最新 main 修改**
2. **绝对不要修改 task-wall 项目**，两个项目完全独立
3. **修改前先读文件**，不要凭记忆改代码
4. **只用中文回复**，用户是中国人

## 项目基本信息
- **路径**：C:\Users\Administrator\Desktop\p2p-help
- **性质**：全新独立项目，与 task-wall 无关
- **前端**：Vue 3 + Vite，hash 路由
- **后端**：Cloudflare Workers，数据库 Supabase（新建独立项目）
- **域名**：p2p.ai-airdrop.uk（子域名）
- **Android**：Capacitor 打包 APK（在 p2p-apk 文件夹）
- **iOS**：H5 链接直接访问

---

## 当前业务制度（最新版，2025年6月）

### 激活金分配（260元全部P2P点对点）
| 类型 | 金额 | 收款人 |
|------|------|--------|
| 见点奖 | **80元** | 老板（永久） |
| 帮扶奖 | **30×2=60元** | 老板直推中已出局者；未出局→匹配生活补贴玩家 |
| 平级奖 | **10×12=120元** | 沿邀请链向上，代码12层，前端显示"平级链" |
| **合计** | **260元** ✓ | |

> ⚠️ 前端不显示"12层"字样，统一用"平级链"，避免多层次传销嫌疑

### 复投规则
- 累计收款 ≥ **900元** → 必须复投（重走激活流程）
- 复投完成后继续享受收款资格

### 平级奖节点补位
- 推荐链不足12层时，由 `is_node=true` 的账号按 `node_order` 顺序补足
- **前期必须在数据库设置节点账号**（建议设12个），否则平级奖凑不满
- SQL：`UPDATE users SET is_node=true, node_order=1 WHERE user_no='账号ID'`

### 身份勋章（社区顶部ID旁显示）
| 勋章 | 条件 | 颜色 |
|------|------|------|
| 🌱 游客 | 未激活 | 灰色 |
| 👑 老板 | role='owner' 或 is_exited=true | 金色 |
| 👔 代理 | 已激活且非老板 | 蓝色 |

---

## 重要文件
- `src/views/CommunityPage.vue` - 社区聊天页（顶部ID+勋章、输入框）
- `src/views/HomePage.vue` - 首页（ID展示+激活入口）
- `src/views/ActivatePage.vue` - 激活页
- `src/views/ParticipatePage.vue` - 参与说明+分配明细
- `src/views/PaymentDetail.vue` - 单笔支付详情（扫码+截图上传）
- `src/views/MyShop.vue` - 我的店铺（平级奖/帮扶奖/收益统计）
- `src/views/PendingConfirm.vue` - 待确认收款列表
- `src/views/AdminPanel.vue` - 管理后台
- `src/views/SubsidyPage.vue` - 生活补贴页
- `src/stores/userStore.js` - 用户状态（localStorage缓存token+userInfo）
- `src/services/messageService.js` - 社区消息服务
- `src/App.vue` - 全局入口（底部导航、复投锁定900元）
- `workers/src/routes/activate.js` - 激活匹配核心（ACTIVATE_AMOUNT/JIAN_DIAN/MAX_LEVEL）
- `workers/src/routes/orders.js` - 截图上传+确认收款
- `workers/src/routes/community.js` - 社区消息+AI提示词（大虾）
- `workers/src/routes/shop.js` - 店铺逻辑（REPURCHASE_LIMIT）
- `workers/src/db.js` - Supabase客户端（已全局缓存，不重复创建）

---

## ✅ 已完成的重要修复（不要重复做）

### 数据改动记录
- 激活金：230 → **260元**
- 见点奖：70 → **80元**
- 平级层数：10层 → **12层**（前端显示"平级链"）
- 复投阈值：700 → **900元**（activate.js / shop.js / App.vue / MyShop.vue 全部同步）

### 安全加固（orders.js + community.js）
- 截图上传：最小30KB限制，防空白假图
- 截图URL来源校验：必须是自己的 Supabase Storage（p2p-media bucket）
- 截图防复用：同一截图不能用于多个任务
- 确认收款：CAS原子更新（`.eq('status', task.status)`），防并发重复确认
- 前端按钮加锁：confirming/disputing 状态，防双击

### 性能优化
- `workers/src/db.js`：Supabase客户端全局缓存（`_dbCache`），同一Worker实例只创建一次
- `workers/src/routes/community.js`：去掉 `await import('@supabase/supabase-js')` 动态导入，改为顶部静态导入
- 消息加载：80条 → 30条，上限50
- 消息接口：加 `Cache-Control: public, max-age=5` 短缓存
- `src/stores/userStore.js`：老用户直接用localStorage缓存，`autoInit()` 不阻塞，后台静默刷新
- `src/views/CommunityPage.vue`：加骨架屏（shimmer动画），首次加载不显示白屏

### AI大虾提示词（community.js）
- `AI_SYSTEM_PROMPT` 和 `deepsook` bot prompt 已更新最新制度
- 内容：260元、见点80、帮扶30×2、平级链10元/节点、复投900、5步参与流程

### UI合规处理（MyShop.vue）
- 平级奖页面：删掉"邀请1人解锁12层"/"未达标"/"紧缩继承"等不存在的逻辑提示
- 所有"12层"改为"平级链"/"链上节点"
- 分配明细：`¥10×12` → `¥120`（不显示层数）

---

## ⚠️ 激活弹窗有两个（社区页身份识别）
- 身份勋章在 `CommunityPage.vue` 的 badge computed 里
- 逻辑基于 `store.userInfo`（`is_active`, `is_exited`, `role`）

---

## Supabase 数据库
- **独立项目**：p2p帮助 组织，项目ID `nygskhqxjddkqlckafjw`
- **与 task-wall 完全隔离**（task-wall 用 `gjyttvqdxuwhzheriivo`）
- **表**：users / activation_orders / payment_tasks / messages / subsidy_queue

### users 表关键字段
```
user_no        -- 6位数字ID（8开头）
is_active      -- 是否激活
is_exited      -- 是否出局
is_node        -- 是否为平级补位节点账号
node_order     -- 节点排序（补位优先级）
role           -- 'member' | 'owner' | 'manager'
referrer_id    -- 推荐人ID
invite_code    -- 邀请码
invite_used    -- 邀请码使用次数（最多2次）
total_received -- 累计收款（≥900触发复投锁定）
is_frozen      -- 是否冻结
```

---

## Cloudflare Workers 环境变量
- `SUPABASE_URL` = p2p-help 独立项目地址
- `SUPABASE_ANON_KEY` = p2p-help anon key
- `JWT_SECRET` = 已设置
- `ADMIN_PASSWORD` = 管理员后台密码
- `DEEPSEEK_API_KEY` = 大虾AI接口密钥

---

## 部署命令
```bash
cd "C:\Users\Administrator\Desktop\p2p-help"
git add 文件名 && git commit -m "fix/feat: 描述" && git push origin main
# GitHub Actions 自动部署到 CF Workers
# 验证：curl https://p2p.ai-airdrop.uk/api/auth/init -X POST
```

## API规范
- 前缀：`/api/`
- 返回格式：`{ code: 200, data: {} }` 或 `{ code: 400, message: '错误信息' }`
- 认证：JWT Token（存 localStorage，key='token'）
- 图片：Supabase Storage（bucket: p2p-media）

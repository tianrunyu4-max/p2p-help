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
- **Android**：Capacitor 打包 APK 直接下载
- **iOS**：H5 链接直接访问

## 业务模型：1+1 店铺 P2P 互助

### 激活金分配（350元全部P2P点对点）
| 类型 | 金额 | 收款人 | 条件 |
|------|------|--------|------|
| 见点 | 100元 | 店主（永久不出局） | 无条件 |
| 帮扶 | 50×2元 | 店主直推的2人 | 已出局才收，否则归店主 |
| 平级 | 10×15层 | 邀请链往上15层 | 有直推解锁15层，无直推只收10层 |
| **合计** | **350元** | **最多18人** | |

### 动态匹配人数
- 店主2人都未出局 → 16人（店主收200 + 15平级）
- 店主1人出局 → 17人
- 店主2人都出局 → 18人（标准）

### 平级解锁规则
- 有直推（≥1人）→ 解锁15层，收10×15=150元
- 无直推 → 只收10层，第11-15层"紧缩"给上层最近有直推的人
- 不足15层 → 管理员预设15个节点用户补底

### 店铺模型
- **店主**（slot1）：永久不出局，永久收见点100
- **店长**（slotA）：推满1人 → 出局 → 自己成为新店主
- **邀请码**：每人最多用2次（最多2个直推）

### P2P 打款流程
```
新人进网站 → 自动生成6位ID
    ↓
填邀请码 → 点激活
    ↓
系统匹配16-18人，显示付款清单
    ↓
逐一扫码打款 + 上传截图
    ↓
每笔30分钟内对方确认
    ↓
全部确认 → 激活成功 → 上传自己的收款码（微信/支付宝）
    ↓
进入等待队列，等下线来帮自己
```

### 复投规则
- 累计收款 ≥ 1500元 → 必须复投350元
- 复投 = 重走新人路径（同样的16-18笔支付流程）
- 复投完成后继续享受收款资格

### 超时与AI客服
- 打款截图上传后，对方30分钟内未确认
- AI客服自动介入：可通过 或 冻结订单

## 重要文件
- `src/views/HomePage.vue` - 首页（ID展示+激活入口）
- `src/views/ActivatePage.vue` - 激活页（18笔支付卡片）
- `src/views/PaymentDetail.vue` - 单笔支付详情（扫码+截图）
- `src/views/MyShop.vue` - 我的店铺（店主/店长位置）
- `src/views/PendingConfirm.vue` - 待确认收款列表
- `src/views/AdminPanel.vue` - 管理后台
- `src/stores/userStore.js` - 用户状态
- `src/router/index.js` - 路由配置
- `workers/src/index.js` - Worker 主入口
- `workers/src/routes/auth.js` - 注册登录
- `workers/src/routes/activate.js` - 激活匹配逻辑
- `workers/src/routes/orders.js` - 订单管理
- `workers/src/routes/admin.js` - 管理后台接口

## ✅ 已完成的重要配置（不要重复做）

### Supabase 数据库
- **独立项目**：p2p帮助 组织，项目ID `nygskhqxjddkqlckafjw`
- **与 task-wall 完全隔离**（task-wall 用 `gjyttvqdxuwhzheriivo`）
- **表已建好**：users / shops / activation_orders / payment_tasks
- **users 表用 email 字段**（不是 phone），已有初始管理员节点数据

### 注册/登录（已改）
- 手机号 → **邮箱（email）**，前后端都已修改
- 后端：`workers/src/routes/auth.js` 用 email 字段
- 前端：`src/views/HomePage.vue` 输入框改为 email

### 管理后台（已改）
- `src/views/AdminPanel.vue`：加了密码验证弹窗
- 普通会员访问 `/#/admin` 只看到"🔐 管理后台·仅限管理员访问"
- 输入 Cloudflare 环境变量 `ADMIN_PASSWORD` 才能进入
- 密码存 sessionStorage，关闭标签页后需重新验证

### Cloudflare Workers 环境变量（已配置）
- `SUPABASE_URL` = p2p-help 独立项目地址
- `SUPABASE_ANON_KEY` = p2p-help anon key
- `JWT_SECRET` = 已设置
- `ADMIN_PASSWORD` = 管理员后台密码

### 线上验证（已通过）
- `curl https://p2p.ai-airdrop.uk/api/auth/login` 返回正常（Supabase 已连接）

## 数据库表结构
```sql
users           -- 用户、邀请关系（email字段，非phone）
shops           -- 店铺（slot1店主 + slotA店长）
payment_tasks   -- P2P支付任务
activation_orders -- 激活订单
```

## 订单状态机
```
pending_match → pending_payment → screenshot_uploaded
                                        ↓
                              confirmed(✅) / timeout → ai_review → frozen/completed
```

## 管理后台权限
- 查看所有订单状态
- 强制完成任意订单
- 冻结/解冻任意用户账户
- 查看AI介入纠纷列表
- 预设节点用户（补充平级链）
- 查看整个邀请关系树

## 开发规范
- API前缀：`/api/`
- 所有接口返回：`{ code: 200, data: {} }` 或 `{ code: 400, message: '错误信息' }`
- 用户认证：JWT Token（存 localStorage）
- 图片上传：Supabase Storage

## 部署命令
```bash
cd "C:\Users\Administrator\Desktop\p2p-help"
git add . && git commit -m "feat: 描述" && git push origin main
# GitHub Actions 自动部署到 CF Workers
```

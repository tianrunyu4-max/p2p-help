/**
 * AI 行动卡片 - 关键词检测与行动按钮映射
 * 用户发送消息时，根据关键词匹配显示可点击的行动卡片
 */

// 关键词 → 行动按钮映射表
const KEYWORD_ACTIONS = [
  {
    // 如何参与 - 完整4步导引卡
    keywords: ['如何参与', '如何加入', '怎么参与', '怎么加入', '如何参加', '想参加', '想加入', '想参与', '怎么开始', '新手', '刚来', '第一次'],
    showBalance: true,
    balanceHint: true,
    buttons: [
      { label: '💎 充值余额', path: '/recharge', primary: true },
      { label: '👑 激活档位', path: '/team?nav=balance', primary: true },
      { label: '🎯 参加拼团', path: '/pintuan', primary: false },
      { label: '🛒 产品选品', path: '/task', primary: false }
    ]
  },
  {
    // 拼团相关
    keywords: ['拼团', '参团', '参加拼团', '怎么拼', '出局', '拼', '开团', '拼团收益'],
    showBalance: true,
    buttons: [
      { label: '🎯 立即参团 $20', path: '/pintuan', primary: true },
      { label: '💰 查看收益', path: '/profile', primary: false }
    ]
  },
  {
    // 选品提货相关
    keywords: ['选品', '提货', '产品', '买产品', '怎么买', '商品', '采购', '购物', '下单', '阿联酋货'],
    showBalance: false,
    buttons: [
      { label: '🛒 去选品', path: '/task', primary: true },
      { label: '📦 提货申请', path: '/profile', primary: false }
    ]
  },
  {
    // 充值
    keywords: ['充值', '我要充值', '打钱', '充钱', '充usdt', '充u', '存钱'],
    type: 'recharge',
    showBalance: true,
    buttons: []
  },
  {
    // 提现
    keywords: ['提现', '我要提现', '取钱', '取现', '出金', '提钱', '提款'],
    type: 'withdraw',
    showBalance: true,
    buttons: []
  },
  {
    // 激活相关
    keywords: ['激活', '参与', '加入', '注册', '开始', '怎么加', '如何加', '没激活', '未激活'],
    showBalance: true,
    balanceHint: true,
    buttons: [
      { label: '👑 立即激活', path: '/team?nav=balance', primary: true },
      { label: '💎 去充值', path: '/recharge', primary: false }
    ]
  },
  {
    // 签到积分相关
    keywords: ['签到', '积分', '打卡', '每日', '签'],
    showBalance: false,
    buttons: [
      { label: '✨ 去签到', path: '/checkin', primary: true }
    ]
  },
  {
    // 余额收益相关
    keywords: ['余额', '提现', '收益', '赚钱', '赚了', '到账', '钱包', '多少钱', '看余额'],
    showBalance: true,
    buttons: [
      { label: '💰 查看余额', path: '/profile', primary: true }
    ]
  },
  {
    // 采购商品相关
    keywords: ['采购', '商品', '购物', '买', '产品', '阿联酋', '逛', '下单'],
    showBalance: false,
    buttons: [
      { label: '🛒 去采购', path: '/task', primary: true }
    ]
  },
  {
    // 团队推荐相关
    keywords: ['团队', '直推', '推荐', '邀请', '邀请码', '下级', '合伙人', '我的码', '我的团'],
    showBalance: false,
    buttons: [
      { label: '👥 查看团队', path: '/team', primary: true }
    ]
  },
  {
    // 代币兑换相关
    keywords: ['兑换', '代币', 'bsc', 'BSC', '钱包地址', '空投', '代币兑'],
    showBalance: false,
    buttons: [
      { label: '💱 积分兑换', path: '/checkin', primary: true }
    ]
  },
  {
    // 个人中心相关
    keywords: ['个人', '我的', '资料', '头像', '改名', '昵称'],
    showBalance: true,
    buttons: [
      { label: '👤 个人中心', path: '/profile', primary: true }
    ]
  },

  // ===== 信息广场 - 智能发布引导 =====
  {
    keywords: ['交友', '聚餐', '聚会', '饭局', '认识朋友', '组局', '一起玩', '找朋友', '同城活动'],
    showBalance: false,
    buttons: [
      { label: '🎉 发布交友聚会', publishType: 'social', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['招人', '招聘', '找工作', '求职', '兼职', '工作机会', '招员工', '找活干', '要上班'],
    showBalance: false,
    buttons: [
      { label: '💼 发布招聘求职', publishType: 'job', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['租房', '找房', '单间出租', '合租', '房子出租', '找住处', '房源', '出租房', '卖房'],
    showBalance: false,
    buttons: [
      { label: '🏠 发布房屋信息', publishType: 'house', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['求购', '采购需求', '找货源', '需要货', '批发进货', '急需', '求采购'],
    showBalance: false,
    buttons: [
      { label: '📦 发布采购需求', publishType: 'purchase', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['供货', '供应商', '出货', '库存出售', '厂家直供', '批发价出', '现货供应'],
    showBalance: false,
    buttons: [
      { label: '🏭 发布供应信息', publishType: 'supply', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['二手', '出闲置', '转让', '低价出', '九成新', '闲置物品', '便宜卖'],
    showBalance: false,
    buttons: [
      { label: '♻️ 发布二手交易', publishType: 'secondhand', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['海运', '空运', '货运', '物流服务', '清关', '发货到', '运输报价'],
    showBalance: false,
    buttons: [
      { label: '🚢 发布物流服务', publishType: 'logistics', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['签证办理', '旅游签', '商务签', '需要签证', '办签', '阿联酋签证'],
    showBalance: false,
    buttons: [
      { label: '✈️ 发布签证服务', publishType: 'visa', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['推广群', '社群广告', '引流', '买量', '广告位', '精准推广', '投放广告'],
    showBalance: false,
    buttons: [
      { label: '📢 发布社群广告', publishType: 'promo', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['公司注册', '商家服务', '代办', '开户', '营业执照', '装修报价', '外包服务'],
    showBalance: false,
    buttons: [
      { label: '🔧 发布商家服务', publishType: 'service', primary: true },
      { label: '📋 浏览信息广场', path: '/publish', primary: false }
    ]
  },
  {
    keywords: ['发布信息', '信息广场', '发帖', '发布广告', '发布需求', '怎么发布'],
    showBalance: false,
    buttons: [
      { label: '✏️ 发布信息', publishType: 'purchase', primary: true },
      { label: '📋 浏览广场', path: '/publish', primary: false }
    ]
  }
]

// 激活所需最低余额（各档位，与 subscription.js PLANS 保持一致）
const ACTIVATE_TIERS = {
  BASIC: 20,
  PREMIUM: 50,
  ELITE: 100,
  TIER_300: 200,
  TIER_500: 500,
  TIER_1000: 1000
}

/**
 * 根据用户消息检测需要显示的行动卡片
 * @param {string} message - 用户消息
 * @returns {object|null} - 行动卡片数据，null 表示不显示
 */
export function detectActionCard(message) {
  if (!message || typeof message !== 'string') return null
  const msg = message.trim().toLowerCase()
  if (msg.length < 1) return null

  for (const rule of KEYWORD_ACTIONS) {
    for (const kw of rule.keywords) {
      if (msg.includes(kw.toLowerCase())) {
        return {
          type: rule.type || null,
          showBalance: rule.showBalance,
          balanceHint: rule.balanceHint || false,
          buttons: rule.buttons,
          prefillAmount: extractAmount(message)
        }
      }
    }
  }
  return null
}

/**
 * 从消息中提取金额数字（如"提现50"→50）
 */
function extractAmount(message) {
  const m = message.match(/(\d+(\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

/**
 * 根据余额判断激活提示文字
 * @param {number} balance - 当前余额
 * @param {boolean} isActivated - 是否已激活
 * @returns {string}
 */
export function getBalanceHint(balance, isActivated) {
  if (isActivated) return '✅ 已激活会员'
  if (balance >= ACTIVATE_TIERS.TIER_1000) return `💡 余额充足，可激活V6顶级`
  if (balance >= ACTIVATE_TIERS.TIER_500)  return `💡 余额充足，可激活V5($500)`
  if (balance >= ACTIVATE_TIERS.TIER_300)  return `💡 余额充足，可激活V4($200)`
  if (balance >= ACTIVATE_TIERS.ELITE)     return `💡 余额充足，可激活V3($100)`
  if (balance >= ACTIVATE_TIERS.PREMIUM)   return `💡 余额充足，可激活V2($50)`
  if (balance >= ACTIVATE_TIERS.BASIC)     return `💡 余额充足，可激活V1($20)`
  const need = ACTIVATE_TIERS.BASIC - balance
  if (need > 0) return `还差 $${need.toFixed(2)} 可激活V1`
  return ''
}

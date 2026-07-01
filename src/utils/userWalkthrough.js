/**
 * 端到端用户流程走查测试
 * ========================
 * 站在真实用户角度，自动模拟完整操作流程：
 * 注册 → 登录 → 激活 → 签到 → 转账 → 分享 → 团队 → 社区聊天
 *
 * 使用方法（浏览器控制台）：
 *   await runUserWalkthrough()
 *
 * 注意：会清除 localStorage 中的测试数据，请勿在生产环境运行
 */

// ============ 工具函数 ============

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const log = (icon, msg, detail = '') => {
  const style = {
    '✅': 'color:#00C853;font-weight:bold',
    '❌': 'color:#FF1744;font-weight:bold',
    '⏳': 'color:#FF9800;font-weight:bold',
    '📋': 'color:#2979FF;font-weight:bold',
    '🔍': 'color:#9C27B0;font-weight:bold',
    '⚠️': 'color:#FF6D00;font-weight:bold',
  }
  console.log(`%c${icon} ${msg}`, style[icon] || '', detail)
}

const results = { pass: 0, fail: 0, warn: 0, errors: [] }

function assert(condition, testName, detail = '') {
  if (condition) {
    results.pass++
    log('✅', `PASS: ${testName}`, detail)
  } else {
    results.fail++
    results.errors.push(testName)
    log('❌', `FAIL: ${testName}`, detail)
  }
}

function warn(testName, detail = '') {
  results.warn++
  log('⚠️', `WARN: ${testName}`, detail)
}

/** 获取 Vue Router 实例 */
function getRouter() {
  const app = document.querySelector('#app')
  if (!app && !app.__vue_app__) throw new Error('Vue app not found')
  // Vue 3 内部获取 router
  return app.__vue_app__.config.globalProperties.$router
}

/** 导航到指定路由并等待渲染 */
async function navigateTo(path, waitMs = 800) {
  const router = getRouter()
  await router.push(path)
  await sleep(waitMs)
}

/** 获取当前路由路径 */
function currentPath() {
  return getRouter().currentRoute.value.path
}

/** 查找元素 - 支持 CSS 选择器 */
function $(selector) {
  return document.querySelector(selector)
}

/** 查找所有元素 */
function $$(selector) {
  return document.querySelectorAll(selector)
}

/** 按文本内容查找按钮/元素 */
function findByText(text, tag = 'button') {
  const els = document.querySelectorAll(tag)
  for (const el of els) {
    if (el.textContent.trim().includes(text)) return el
  }
  return null
}

/** 模拟输入（触发 Vue 3 v-model 响应式更新） */
function setInput(el, value) {
  if (!el) return false
  // 聚焦输入框
  el.focus()
  // 使用原生 setter 设置值
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set
  nativeInputValueSetter.call(el, value)
  // Vue 3 v-model 监听 input 事件，需要用 InputEvent
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('compositionend', { bubbles: true }))
  return true
}

/** 模拟点击 */
function click(el) {
  if (!el) return false
  el.click()
  return true
}

/** 清除测试用户数据 */
function cleanupTestData() {
  // 清除认证相关
  localStorage.removeItem('task_wall_current_user')
  // 清除引擎数据
  const keysToRemove = [
    'taskchain_users', 'taskchain_models', 'taskchain_transactions',
    'checkins', 'dividend_pool', 'dividend_history', 'reward_config_override',
    'chatUserId', 'chatUserName', 'chatUserAvatar'
  ]
  keysToRemove.forEach(k => localStorage.removeItem(k))

  // 清除用户DB中的测试用户
  try {
    const db = JSON.parse(localStorage.getItem('task_wall_users_db') || '{}')
    if (db.users) {
      const testUsers = Object.keys(db.users).filter(k =>
        k.startsWith('walktest_') || k.startsWith('测试用户_')
      )
      testUsers.forEach(k => delete db.users[k])
      localStorage.setItem('task_wall_users_db', JSON.stringify(db))
    }
  } catch (e) { /* ignore */ }
}

/** 截取当前页面快照信息 */
function pageSnapshot() {
  return {
    path: currentPath(),
    title: document.title,
    bodyText: document.body.innerText.substring(0, 500),
    visibleInputs: $$('input:not([type=hidden])').length,
    visibleButtons: $$('button').length,
  }
}

// ============ 测试步骤 ============

const timestamp = Date.now().toString(36).slice(-4)
const TEST_USER = `walktest_${timestamp}`
const TEST_PASS = 'test123456'
const TEST_USER_B = `walktest_b_${timestamp}`

async function step01_register() {
  log('📋', '=== 步骤1: 注册新用户 ===')
  await navigateTo('/register', 1000)

  assert(currentPath() === '/register', '导航到注册页')

  // 查找输入框
  const inputs = $$('.input-field')
  assert(inputs.length >= 3, '注册页有3个输入框（昵称、密码、确认密码）',
    `找到 ${inputs.length} 个`)

  // 填写表单
  const [nicknameInput, passwordInput, confirmInput] = inputs
  setInput(nicknameInput, TEST_USER)
  await sleep(100)
  setInput(passwordInput, TEST_PASS)
  await sleep(100)
  setInput(confirmInput, TEST_PASS)
  await sleep(200)

  // 点击注册
  const registerBtn = $('.register-btn')
  assert(registerBtn !== null, '找到注册按钮')
  click(registerBtn)
  await sleep(2000) // 等待注册完成和跳转

  // 验证注册成功 - 应该跳转到首页
  const path = currentPath()
  assert(path === '/' || path === '/login', '注册后跳转成功', `当前路径: ${path}`)

  // 验证用户DB
  const db = JSON.parse(localStorage.getItem('task_wall_users_db') || '{}')
  const userKey = TEST_USER.toLowerCase()
  const userRecord = db.users && db.users[userKey]
  assert(userRecord !== undefined, '用户已写入本地DB',
    userRecord ? `communityId: ${userRecord.communityId}` : `key "${userKey}" 不存在于 db.users`)
  if (userRecord) {
    assert(userRecord.communityId !== undefined, '用户分配了社区ID',
      `ID: ${userRecord.communityId}`)
  }
}

async function step02_logout_and_login() {
  log('📋', '=== 步骤2: 退出并重新登录 ===')

  // 先退出
  localStorage.removeItem('task_wall_current_user')
  await navigateTo('/login', 1000)
  assert(currentPath() === '/login', '导航到登录页')

  // 查找输入框
  const inputs = $$('.input-field')
  assert(inputs.length >= 2, '登录页有2个输入框（昵称、密码）',
    `找到 ${inputs.length} 个`)

  // 填写登录表单
  setInput(inputs[0], TEST_USER)
  await sleep(100)
  setInput(inputs[1], TEST_PASS)
  await sleep(200)

  // 点击登录
  const loginBtn = $('.login-btn')
  assert(loginBtn !== null, '找到登录按钮')
  click(loginBtn)
  await sleep(1500)

  // 验证登录成功
  const currentUser = localStorage.getItem('task_wall_current_user')
  assert(currentUser !== null, '登录成功，currentUser 已设置')

  const path = currentPath()
  assert(path === '/', '登录后跳转到首页', `当前路径: ${path}`)
}

async function step03_profile_page() {
  log('📋', '=== 步骤3: 查看个人主页 ===')
  await navigateTo('/profile', 1000)

  assert(currentPath() === '/profile', '导航到个人主页')

  // 检查关键元素
  const balanceAmount = $('.balance-amount')
  assert(balanceAmount !== null, '显示余额区域')
  if (balanceAmount) {
    log('🔍', `当前余额: ${balanceAmount.textContent.trim()}`)
  }

  // 检查服务网格
  const shareItem = findByText('邀请分享', 'div')
  assert(shareItem !== null, '显示"邀请分享"入口')

  const checkinItem = findByText('签到打卡', 'div')
  assert(checkinItem !== null, '显示"签到打卡"入口')

  // 检查收益卡片
  const earningsCards = $$('.earnings-card')
  log('🔍', `收益卡片数量: ${earningsCards.length}`)

  // 检查团队数据
  const teamCards = $$('.team-card')
  log('🔍', `团队卡片数量: ${teamCards.length}`)
}

async function step04_activate_account() {
  log('📋', '=== 步骤4: 激活账户（购买会员卡） ===')

  // 先通过引擎API创建推荐人链（平台→推荐人）
  let referrerInviteCode = null
  try {
    const { getEngine } = await import('/src/logic/engine.js')
    const engine = getEngine()

    // 创建平台根用户（如果不存在）
    // 注意：getUserInfo 会自动创建用户，所以只需检查 system.users
    if (!engine.system.users.has('platform')) {
      engine.system.createUser('platform', null, 'BASIC')
      // 标记为已独立（平台是顶层，不在任何人模型中）
      const platformUser = engine.system.users.get('platform')
      platformUser.isIndependent = true
      platformUser.hasContributed = true
      engine.saveData()
    }

    // 创建一个推荐人
    const referrerId = `referrer_${timestamp}`
    engine.activateUser(referrerId, 'platform', 'BASIC')
    await sleep(300)

    // 获取推荐人的邀请码
    const code = engine.generateActivationCode(referrerId)
    referrerInviteCode = code
    log('🔍', `创建推荐人: ${referrerId}, 邀请码: ${code}`)
  } catch (e) {
    warn('无法通过引擎创建推荐人', e.message)
  }

  // 导航到激活页
  await navigateTo('/activate', 1000)
  assert(currentPath() === '/activate', '导航到激活页')

  // 找到订阅卡片
  const subscribeCard = $('.subscribe-card')
  if (subscribeCard) {
    click(subscribeCard)
    await sleep(800)
  }

  // 检查 SubscriptionModal 是否打开
  const modal = $('.subscription-overlay')
  assert(modal !== null, '订阅弹窗已打开')

  if (modal) {
    // 选择档位 - 默认应该是200
    const tierCards = $$('.tier-card')
    assert(tierCards.length === 3, '显示3个档位卡片', `找到 ${tierCards.length} 个`)

    // 选择100档（基础版）
    if (tierCards.length > 0) {
      click(tierCards[0]) // 第一个是100档
      await sleep(300)
      assert(tierCards[0].classList.contains('selected'), '100档已选中')
    }

    // 输入邀请码
    const inviteInput = $('.invite-input')
    assert(inviteInput !== null, '找到邀请码输入框')
    if (inviteInput && referrerInviteCode) {
      setInput(inviteInput, referrerInviteCode)
      await sleep(300)
    }

    // 点击激活
    const activateBtn = $('.activate-btn')
    assert(activateBtn !== null, '找到激活按钮')
    if (activateBtn) {
      // 检查按钮文本
      log('🔍', `激活按钮文本: ${activateBtn.textContent.trim()}`)

      // 劫持 confirm 对话框，自动确认
      const origConfirm = window.confirm
      window.confirm = () => true
      click(activateBtn)
      await sleep(2000)
      window.confirm = origConfirm
    }
  }

  // 验证激活结果 - 检查引擎中的用户状态
  try {
    const { getEngine } = await import('/src/logic/engine.js')
    const engine = getEngine()
    // currentUser 可能是 JSON 或纯字符串
    const raw = localStorage.getItem('task_wall_current_user') || ''
    let userId = TEST_USER
    try {
      const parsed = JSON.parse(raw)
      userId = parsed.communityId || parsed.username || TEST_USER
    } catch {
      userId = raw || TEST_USER
    }
    const userInfo = engine.getUserInfo(userId)
    if (userInfo) {
      log('🔍', `引擎中用户状态: isActive=${userInfo.isActive}, model=${userInfo.modelType}`)
      assert(userInfo.isActive === true, '用户已激活')
    } else {
      log('🔍', `引擎中未找到用户 ${userId}，尝试查找所有用户...`)
      // 列出引擎中的用户以便调试
      const allUsers = Array.from(engine.system.users.keys()).slice(0, 10)
      log('🔍', `引擎用户列表(前10): ${allUsers.join(', ')}`)
    }
  } catch (e) {
    warn('获取引擎用户信息失败', e.message)
  }
}

async function step05_share_page() {
  log('📋', '=== 步骤5: 分享/邀请页面 ===')
  await navigateTo('/share', 1200)

  const path = currentPath()
  // 如果未激活会被重定向到 /activate
  if (path === '/activate') {
    warn('未激活，被重定向到激活页，跳过分享测试')
    return
  }

  assert(path === '/share', '导航到分享页')

  // 检查邀请码
  const codeText = $('.code-text')
  if (codeText) {
    const code = codeText.textContent.trim()
    assert(code.length > 0, '显示邀请码', `邀请码: ${code}`)
  } else {
    const capsule = $('.invite-code-capsule')
    if (capsule) {
      log('🔍', `邀请区域文本: ${capsule.textContent.trim()}`)
    }
    warn('未找到 .code-text 元素')
  }

  // 检查QR码
  const qrCanvas = $('canvas')
  assert(qrCanvas !== null, 'QR码已生成')

  // 检查功能按钮
  const copyBtn = findByText('复制邀请码', 'button') || findByText('复制', 'button')
  assert(copyBtn !== null, '找到复制邀请码按钮')

  const shareBtn = findByText('分享给好友', 'button') || findByText('分享', 'button')
  assert(shareBtn !== null, '找到分享按钮')
}

async function step06_checkin() {
  log('📋', '=== 步骤6: 每日签到 ===')
  await navigateTo('/checkin', 1000)

  assert(currentPath() === '/checkin', '导航到签到页')

  // 检查签到按钮
  const checkinBtn = $('.checkin-btn-main')
  assert(checkinBtn !== null, '找到签到按钮')

  if (checkinBtn) {
    const btnText = checkinBtn.textContent.trim()
    log('🔍', `签到按钮文本: ${btnText}`)

    const isDisabled = checkinBtn.disabled || checkinBtn.classList.contains('checked')
    if (!isDisabled) {
      click(checkinBtn)
      await sleep(1500)

      // 验证签到后按钮状态
      const btnAfter = $('.checkin-btn-main')
      if (btnAfter) {
        const afterText = btnAfter.textContent.trim()
        assert(
          afterText.includes('已签到') || btnAfter.disabled || btnAfter.classList.contains('checked'),
          '签到后按钮状态更新',
          `按钮文本: ${afterText}`
        )
      }
    } else {
      log('🔍', '今日已签到，跳过签到操作')
    }
  }

  // 检查签到进度
  const progressText = findByText('/5', 'div') || findByText('/5', 'span')
  if (progressText) {
    log('🔍', `连续签到进度: ${progressText.textContent.trim()}`)
  }

  // 检查提现按钮
  const withdrawBtn = $('.withdraw-btn')
  if (withdrawBtn) {
    log('🔍', `提现按钮文本: ${withdrawBtn.textContent.trim()}, disabled: ${withdrawBtn.disabled}`)
  }
}

async function step07_team_page() {
  log('📋', '=== 步骤7: 团队页面 ===')
  await navigateTo('/team', 1000)

  assert(currentPath() === '/team', '导航到团队页')

  // 检查侧边导航
  const navItems = $$('.nav-item')
  assert(navItems.length >= 5, '侧边导航项数量正确', `找到 ${navItems.length} 个`)

  // 列出所有导航项
  navItems.forEach((item, i) => {
    log('🔍', `  导航项${i + 1}: ${item.textContent.trim()}`)
  })

  // 切换到"余额互转"页面
  const balanceNav = findByText('余额互转', 'div') || findByText('余额', 'div')
  if (balanceNav) {
    click(balanceNav)
    await sleep(500)
    log('✅', '切换到余额互转面板')

    // 检查余额显示
    const balanceEl = findByText('可提现', 'div') || findByText('余额', 'div')
    if (balanceEl) {
      log('🔍', `余额区域: ${balanceEl.parentElement?.textContent?.trim()?.substring(0, 100)}`)
    }
  }

  // 切换到"1+1太极模型"
  const modelNav = findByText('1+1', 'div') || findByText('太极', 'div')
  if (modelNav) {
    click(modelNav)
    await sleep(500)
    log('✅', '切换到1+1太极模型面板')
  }

  // 切换到"团队数据"
  const teamNav = findByText('团队数据', 'div')
  if (teamNav) {
    click(teamNav)
    await sleep(500)
    log('✅', '切换到团队数据面板')
  }

  // 切换到"合伙人中心"
  const partnerNav = findByText('合伙人', 'div')
  if (partnerNav) {
    click(partnerNav)
    await sleep(500)
    log('✅', '切换到合伙人中心')
  }
}

async function step08_balance_transfer() {
  log('📋', '=== 步骤8: 余额互转 ===')
  await navigateTo('/team?nav=balance', 1000)

  // 找到互转按钮
  const transferBtn = findByText('互转余额', 'button') ||
    findByText('互转', 'button') ||
    $('.action-btn.transfer')
  if (!transferBtn) {
    warn('未找到互转按钮，可能未激活')
    return
  }

  click(transferBtn)
  await sleep(800)

  // 检查转账弹窗
  const dialog = $('.transfer-dialog') || $('.dialog-overlay')
  if (!dialog) {
    warn('转账弹窗未打开')
    return
  }

  assert(dialog !== null, '转账弹窗已打开')

  // 查找输入框
  const formInputs = dialog.querySelectorAll('.form-input')
  assert(formInputs.length >= 2, '转账弹窗有2个输入框（对方ID、金额）',
    `找到 ${formInputs.length} 个`)

  // 填写测试数据（不提交，因为可能余额不足）
  if (formInputs.length >= 2) {
    setInput(formInputs[0], '99999')
    await sleep(100)
    setInput(formInputs[1], '10')
    await sleep(200)
    log('🔍', '已填写转账表单（ID: 99999, 金额: 10）')
  }

  // 关闭弹窗（点击取消）
  const cancelBtn = findByText('取消', 'button')
  if (cancelBtn) {
    click(cancelBtn)
    await sleep(500)
  }
}

async function step09_community_chat() {
  log('📋', '=== 步骤9: 社区聊天 ===')
  await navigateTo('/', 1500)

  assert(currentPath() === '/', '导航到社区首页')

  // 检查聊天界面
  const chatMessages = $('.chat-messages')
  assert(chatMessages !== null, '聊天消息区域存在')

  // 检查输入框
  const msgInput = $('.message-input')
  assert(msgInput !== null, '找到消息输入框')

  if (msgInput) {
    setInput(msgInput, '这是自动化走查测试消息')
    await sleep(300)

    // 检查发送按钮出现
    const sendBtn = $('.send-btn') || findByText('发送', 'button')
    assert(sendBtn !== null, '输入文字后显示发送按钮')

    // 不实际发送，清空输入
    setInput(msgInput, '')
    await sleep(200)
  }

  // 检查底部工具栏
  const emojiBtn = $('.emoji-btn')
  assert(emojiBtn !== null, '找到表情按钮')

  const plusBtn = $('.plus-btn')
  assert(plusBtn !== null, '找到"+"附件按钮')

  // 检查 chatUserId 是否已生成
  const chatUserId = localStorage.getItem('chatUserId')
  log('🔍', `社区用户ID: ${chatUserId || '未生成'}`)
}

async function step10_transaction_history() {
  log('📋', '=== 步骤10: 交易/转账记录 ===')

  // 先查看交易记录
  await navigateTo('/transaction-history', 1000)
  assert(currentPath() === '/transaction-history', '导航到交易记录页')

  const txSnapshot = pageSnapshot()
  log('🔍', `交易记录页 - 按钮数: ${txSnapshot.visibleButtons}`)

  // 再查看转账记录
  await navigateTo('/transfer-history', 1000)
  assert(currentPath() === '/transfer-history', '导航到转账记录页')

  const tfSnapshot = pageSnapshot()
  log('🔍', `转账记录页 - 按钮数: ${tfSnapshot.visibleButtons}`)
}

async function step11_bottom_tabbar() {
  log('📋', '=== 步骤11: 底部导航栏切换 ===')
  await navigateTo('/', 500)

  const tabbar = $('.tabbar')
  assert(tabbar !== null, '底部导航栏存在')

  if (!tabbar) return

  const tabItems = tabbar.querySelectorAll('.tab-item, .tab-center-btn')
  log('🔍', `Tab数量: ${tabItems.length}`)

  // 依次点击各Tab（社区→采购→团队→我的）
  // Tab结构: <button class="tab-item"><span class="tab-label">文字</span></button>
  const tabs = [
    { text: '社区', expectedPath: '/' },
    { text: '采购', expectedPath: '/task' },
    { text: '团队', expectedPath: '/team' },
    { text: '我的', expectedPath: '/profile' },
  ]

  for (const tab of tabs) {
    // 查找 .tab-label span 包含目标文字，然后点击其父 button
    const labels = tabbar.querySelectorAll('.tab-label')
    let targetBtn = null
    for (const label of labels) {
      if (label.textContent.trim() === tab.text) {
        targetBtn = label.closest('.tab-item') || label.parentElement
        break
      }
    }
    if (targetBtn) {
      click(targetBtn)
      await sleep(800)
      const path = currentPath()
      assert(path === tab.expectedPath,
        `点击"${tab.text}"Tab → 导航到 ${tab.expectedPath}`,
        `实际路径: ${path}`)
    } else {
      warn(`未找到"${tab.text}"Tab`)
    }
  }
}

async function step12_header_actions() {
  log('📋', '=== 步骤12: 顶部操作栏 ===')
  await navigateTo('/', 800)

  // 检查顶部标题
  const appTitle = $('.app-title')
  if (appTitle) {
    log('🔍', `应用标题: ${appTitle.textContent.trim()}`)
  }

  // 检查用户ID显示
  const userId = $('.user-id')
  if (userId) {
    log('🔍', `用户ID显示: ${userId.textContent.trim()}`)
  }

  // 检查订阅按钮
  const subscribeBtn = findByText('订阅', 'button') || $('.subscribe-btn')
  assert(subscribeBtn !== null, '找到订阅按钮')

  // 检查+菜单
  const plusMenuBtn = $('.plus-menu-btn')
  assert(plusMenuBtn !== null, '找到"+"菜单按钮')
  if (plusMenuBtn) {
    click(plusMenuBtn)
    await sleep(500)

    // 检查下拉菜单
    const dropdownItems = $$('.dropdown-item')
    log('🔍', `下拉菜单项数: ${dropdownItems.length}`)
    dropdownItems.forEach((item, i) => {
      log('🔍', `  菜单项${i + 1}: ${item.textContent.trim()}`)
    })

    // 关闭菜单
    click(plusMenuBtn)
    await sleep(300)
  }
}

async function step13_publish_flow() {
  log('📋', '=== 步骤13: 发布功能 ===')
  await navigateTo('/', 500)

  // 找到中间的发布按钮
  const publishBtn = $('.tab-center-btn') || findByText('发布', 'div')
  assert(publishBtn !== null, '找到发布按钮')

  if (publishBtn) {
    // 劫持 router.push 来检测跳转目标
    const origConfirm = window.confirm
    window.confirm = () => true
    click(publishBtn)
    await sleep(1000)
    window.confirm = origConfirm

    const path = currentPath()
    log('🔍', `点击发布后跳转到: ${path}`)
    // 如果未激活 → /activate, 如果已激活 → /publish 或显示菜单
  }
}

async function step14_admin_access() {
  log('📋', '=== 步骤14: 管理后台访问 ===')
  await navigateTo('/admin', 800)

  const path = currentPath()
  log('🔍', `直接访问 /admin 结果: ${path}`)

  // 检查管理面板是否加载
  const adminContent = findByText('管理', 'div') || findByText('用户管理', 'div')
  log('🔍', `管理面板内容: ${adminContent ? '已加载' : '未找到'}`)
}

async function step15_edge_cases() {
  log('📋', '=== 步骤15: 边界情况 ===')

  // 15.1 访问不存在的路由
  await navigateTo('/nonexistent-page', 800)
  log('🔍', `访问不存在路由后: ${currentPath()}`)

  // 15.2 未登录状态访问受保护页面
  const currentUser = localStorage.getItem('task_wall_current_user')
  localStorage.removeItem('task_wall_current_user')
  await navigateTo('/profile', 1000)
  assert(currentPath() === '/login', '未登录访问/profile被重定向到/login',
    `实际路径: ${currentPath()}`)

  // 恢复登录状态
  if (currentUser) {
    localStorage.setItem('task_wall_current_user', currentUser)
    await navigateTo('/', 500)
  }

  // 15.3 重复注册同名用户
  await navigateTo('/register', 800)
  const inputs = $$('.input-field')
  if (inputs.length >= 3) {
    setInput(inputs[0], TEST_USER) // 已存在的用户名
    setInput(inputs[1], TEST_PASS)
    setInput(inputs[2], TEST_PASS)
    await sleep(200)
    const registerBtn = $('.register-btn')
    if (registerBtn) {
      click(registerBtn)
      await sleep(1500)
      // 应该失败或提示用户已存在
      const path = currentPath()
      log('🔍', `重复注册后路径: ${path}（如果仍在/register说明正确拒绝了）`)
    }
  }

  // 恢复登录状态
  if (currentUser) {
    localStorage.setItem('task_wall_current_user', currentUser)
  }
}

async function step16_responsive_check() {
  log('📋', '=== 步骤16: 页面渲染完整性检查 ===')

  const routes = ['/', '/profile', '/team', '/checkin', '/share', '/activate',
    '/task', '/transaction-history', '/transfer-history']

  for (const route of routes) {
    await navigateTo(route, 600)
    const snap = pageSnapshot()

    // 检查是否有JS错误导致白屏
    const hasContent = snap.bodyText.length > 50
    assert(hasContent, `${route} 页面有内容（非白屏）`,
      `内容长度: ${snap.bodyText.length}`)

    // 检查是否有可见的JS运行时错误信息
    // 仅检查可能显示错误的容器（排除聊天消息、用户内容等）
    const errorPatterns = ['Cannot read', 'is not defined', 'TypeError:', 'ReferenceError:']
    const errorContainers = document.querySelectorAll('.error, .error-message, [class*="error"], .alert-danger')
    let foundError = null
    for (const container of errorContainers) {
      const text = container.textContent
      if (errorPatterns.some(p => text.includes(p))) {
        foundError = container
        break
      }
    }
    if (foundError) {
      warn(`${route} 页面可能有JS错误`, foundError.textContent.substring(0, 100))
    }
  }
}

// ============ 主入口 ============

async function runUserWalkthrough() {
  console.clear()
  log('📋', '╔════════════════════════════════════════╗')
  log('📋', '║   端到端用户流程走查测试               ║')
  log('📋', '║   模拟真实用户的完整操作旅程           ║')
  log('📋', '╚════════════════════════════════════════╝')
  log('📋', `测试用户: ${TEST_USER}`)
  log('📋', '')

  // 重置
  results.pass = 0
  results.fail = 0
  results.warn = 0
  results.errors = []

  const startTime = Date.now()

  // 清理测试数据
  log('⏳', '清理历史测试数据...')
  cleanupTestData()
  await sleep(500)

  try {
    // 按顺序执行所有步骤
    await step01_register()
    await step02_logout_and_login()
    await step03_profile_page()
    await step04_activate_account()
    await step05_share_page()
    await step06_checkin()
    await step07_team_page()
    await step08_balance_transfer()
    await step09_community_chat()
    await step10_transaction_history()
    await step11_bottom_tabbar()
    await step12_header_actions()
    await step13_publish_flow()
    await step14_admin_access()
    await step15_edge_cases()
    await step16_responsive_check()
  } catch (err) {
    log('❌', `走查中断: ${err.message}`)
    console.error(err)
    results.fail++
    results.errors.push(`致命错误: ${err.message}`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // 输出汇总
  log('📋', '')
  log('📋', '╔════════════════════════════════════════╗')
  log('📋', '║            走查结果汇总                ║')
  log('📋', '╚════════════════════════════════════════╝')
  log('✅', `通过: ${results.pass}`)
  log('❌', `失败: ${results.fail}`)
  log('⚠️', `警告: ${results.warn}`)
  log('📋', `耗时: ${elapsed}s`)

  if (results.errors.length > 0) {
    log('📋', '')
    log('❌', '失败项目:')
    results.errors.forEach((e, i) => log('❌', `  ${i + 1}. ${e}`))
  }

  log('📋', '')
  if (results.fail === 0) {
    log('✅', '所有检查点全部通过!')
  } else {
    log('❌', `有 ${results.fail} 个检查点失败，请检查上方详情`)
  }

  return results
}

// 导出
export { runUserWalkthrough }
export default { runUserWalkthrough }

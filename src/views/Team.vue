<template>
  <div class="team-container">
    <!-- 左侧彩色导航栏 -->
    <div class="side-nav">
      <div 
        v-for="nav in navItems" 
        :key="nav.id"
        :class="['nav-item', { 'active': activeNav === nav.id }]"
        @click="activeNav = nav.id">
        <div class="nav-icon" :style="{ background: nav.color }">
          <span>{{ nav.icon }}</span>
        </div>
        <div class="nav-label">{{ nav.label }}</div>
      </div>
    </div>
    
    <!-- 右侧内容区域 -->
    <div class="content-area">
      <!-- 余额显示（简化版） -->
    <div class="balance-card" v-if="activeNav === 'balance'">
      <div class="balance-header">
        <span class="balance-title">
          <img src="/coin-icon.jpg" alt="AI币" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 6px;" />
          我的学分
        </span>
        <button class="refresh-icon-btn" @click="refreshAll" :class="{ spinning: isRefreshing }" title="刷新">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/>
          </svg>
        </button>
      </div>
      
      <div class="balance-main">
        <span class="balance-amount-large">{{ currentBalance }}</span>
      </div>

      <!-- ✅ 今日/累计收益 -->
      <div class="today-earnings-banner">
        <span class="earnings-icon">📈</span>
        <span class="earnings-label">{{ earningsLabel }}</span>
        <span class="earnings-amount gold">{{ todayEarnings }}</span>
      </div>

      <!-- 激活引导 -->
      <div class="activate-guide-tip">
        💡 点击右上角头像 → 订阅管理 进行激活
      </div>

      <!-- 分润复利卡片（60/100/200档显示） -->
      <div class="profit-card" v-if="PROFIT_RATE_MAP[userCardType]">
        <div class="profit-header">
          <span class="profit-title">📈 每日分润</span>
          <span class="profit-rate-badge">{{ (PROFIT_RATE_MAP[userCardType] * 100).toFixed(1) }}%/天</span>
        </div>
        <div class="profit-body">
          <div class="profit-balance-row">
            <span class="profit-balance-label">分润余额</span>
            <span class="profit-balance-val">{{ profitBalance.toFixed(4) }}</span>
          </div>
          <div class="profit-calc-hint">
            本金 {{ PROFIT_TIER_PRICE[userCardType] }} + 余额，每次签到自动复利
          </div>
        </div>
        <button
          class="profit-claim-btn"
          :disabled="profitBalance <= 0 || isClaimingProfit"
          @click="handleClaimProfit">
          {{ isClaimingProfit ? '领取中...' : profitBalance > 0 ? `领取 ${profitBalance.toFixed(2)}` : '签到后累计分润' }}
        </button>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button
          class="action-btn activate full-width"
          :class="{ 'upgrade-btn': isActivated && userCardType !== 'TIER_500' }"
          @click="handleActivate"
          :disabled="isActivated && userCardType === 'TIER_500'">
          <span class="btn-icon">{{ isActivated && userCardType !== 'TIER_500' ? '📈' : '⚡' }}</span>
          {{ isActivated ? (userCardType === 'TIER_500' ? '已达顶级' : '升级档位') : `激活 (${activatePrice})` }}
        </button>
      </div>
    </div>
    
    <!-- 1+1模型：身份状态 + 模型可视化 -->
    <template v-if="activeNav === 'model'">
    <!-- 刷新按钮 -->
    <div class="section-refresh-row">
      <button class="refresh-icon-btn" @click="refreshAll" :class="{ spinning: isRefreshing }" title="刷新数据">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/>
        </svg>
        <span>{{ isRefreshing ? '刷新中...' : '刷新' }}</span>
      </button>
    </div>
    <!-- 身份状态卡片 -->
    <div class="identity-card" :class="identityStatus.cardClass">
      <div class="identity-header">
        <span class="identity-icon">{{ identityStatus.icon }}</span>
        <div class="identity-info">
          <div class="identity-title">{{ identityStatus.title }}</div>
          <div class="identity-subtitle">{{ identityStatus.subtitle }}</div>
        </div>
        <span class="identity-badge" :class="identityStatus.badgeClass">
          {{ identityStatus.badge }}
        </span>
      </div>
      
      <!-- 出局进度 -->
      <div class="contribution-section" v-if="!identityStatus.hasContributed">
        <div class="contribution-header">
          <span class="contribution-label">📋 出局进度</span>
          <span class="contribution-value">{{ identityStatus.contributionProgress }}</span>
        </div>
        <div class="contribution-bar">
          <div class="contribution-fill" :style="{ width: identityStatus.contributionPercent + '%' }"></div>
        </div>
        <div class="contribution-hint" :class="{ 'warning': identityStatus.nextIsContribution }">
          {{ identityStatus.contributionHint }}
        </div>
      </div>
      
      <!-- 已完成出局 -->
      <div class="contribution-done" v-else>
        <span class="done-icon">✅</span>
        <span class="done-text">已出局开店，成为店主，永久拿见点奖</span>
      </div>
      
      <!-- 出局方式说明 -->
      <div class="exit-info" v-if="identityStatus.isLandlord">
        <div class="exit-label">出局方式</div>
        <div class="exit-type" :class="identityStatus.hasSlippage ? 'slippage' : 'self'">
          {{ identityStatus.hasSlippage ? '🔄 有滑落（被上级直推替换）' : '🚀 自主出局（自己直推替换）' }}
        </div>
      </div>
    </div>
    
    <!-- 1+1 模型可视化 -->
    <div class="model-card">
      <div class="model-header">
        <span class="model-title">🏪 1+1 店铺模型</span>
        <span class="model-badge" :class="userStatus.isLandlord ? 'landlord' : 'pending'">
          {{ userStatus.isLandlord ? '我的店铺' : '在职店长' }}
        </span>
      </div>
      
      <div class="model-diagram">
        <!-- 店主位（永久拿见点奖） -->
        <div class="position-box position-a">
          <div class="position-glow"></div>
          <div class="position-content">
            <div class="position-label">👑 店主</div>
            <div class="position-avatar">
              <span class="avatar-icon">👑</span>
            </div>
            <div class="position-user">{{ modelData.positionA || '等待开店' }}</div>
            <div class="position-invite" v-if="modelData.inviteCodeA">
              <span class="invite-code-text">邀请码：{{ modelData.inviteCodeA }}</span>
              <button class="invite-copy-btn" @click="copyInviteCode(modelData.inviteCodeA)">{{ copiedCode === modelData.inviteCodeA ? '✅' : '复制' }}</button>
            </div>
            <div class="position-desc">永久拿见点奖 · 不出局</div>
          </div>
        </div>
        
        <!-- 连接线动画 -->
        <div class="connection-line">
          <div class="line-flow"></div>
          <div class="line-arrow">↓</div>
        </div>
        
        <!-- 店长位（推满1人出局） -->
        <div class="position-box position-b" :class="{ 'has-user': modelData.positionB }">
          <div class="position-content">
            <div class="position-label">👔 店长</div>
            <div class="position-avatar">
              <span class="avatar-icon">{{ modelData.positionB ? '👔' : '⏳' }}</span>
            </div>
            <div class="position-user">{{ modelData.positionB || '空缺中...' }}</div>
            <div class="position-invite" v-if="modelData.inviteCodeB">
              <span class="invite-code-text">邀请码：{{ modelData.inviteCodeB }}</span>
              <button class="invite-copy-btn" @click="copyInviteCode(modelData.inviteCodeB)">{{ copiedCode === modelData.inviteCodeB ? '✅' : '复制' }}</button>
            </div>
            <div class="position-desc">{{ modelData.positionB ? '推满1人出局开店' : '等待店长加入' }}</div>
          </div>
        </div>
        
        <!-- 等待队列 -->
        <div class="waiting-queue" v-if="modelData.waitingCount > 0">
          <div class="queue-label">等待队列</div>
          <div class="queue-dots">
            <span v-for="i in Math.min(modelData.waitingCount, 5)" :key="i" class="queue-dot"></span>
            <span v-if="modelData.waitingCount > 5" class="queue-more">+{{ modelData.waitingCount - 5 }}</span>
          </div>
        </div>
      </div>
      
      <!-- 模型说明 -->
      <div class="model-tips">
        <div class="tip-item">💡 一个店 = 店主 + 店长（2人）</div>
        <div class="tip-item">👑 店主永久拿见点奖（激活金额×20%）</div>
        <div class="tip-item">👔 店长推满1人后出局开店，成为新店主</div>
      </div>
    </div>
    </template>
    
    <!-- 团队数据 -->
    <div class="team-card" v-if="activeNav === 'team'">
      <div class="card-title">📊 团队数据</div>
      <div class="team-stats">
        <div class="stat-item">
          <span class="stat-icon">👔</span>
          <span class="stat-value">{{ teamStats.activeManagerCount }}</span>
          <span class="stat-label">未出局店长</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">👑</span>
          <span class="stat-value">{{ teamStats.exitCount }}</span>
          <span class="stat-label">已出局店主</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">👥</span>
          <span class="stat-value">{{ teamStats.directCount }}</span>
          <span class="stat-label">直推人数</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">🌐</span>
          <span class="stat-value">{{ teamStats.totalCount }}</span>
          <span class="stat-label">公排人数</span>
        </div>
      </div>

      <!-- 邀请码 -->
      <div class="team-invite-section" v-if="apiData.inviteCode">
        <div class="team-invite-label">我的邀请码</div>
        <div class="team-invite-row">
          <span class="team-invite-code">{{ apiData.inviteCode }}</span>
          <button class="team-invite-copy" @click="copyInviteCode(apiData.inviteCode)">
            {{ copiedCode === apiData.inviteCode ? '✅ 已复制' : '📋 复制' }}
          </button>
        </div>
        <div class="team-invite-usage">
          已使用 {{ apiData.directPushCount }}/2 次（每人最多邀请2位）
        </div>
      </div>
    </div>
    
    
    <!-- 帮扶补贴 -->
    <div class="subsidy-card" v-if="activeNav === 'subsidy'">

      <!-- 帮扶收益汇总卡 -->
      <div class="help-balance-card">
        <div class="help-balance-left">
          <span class="help-balance-icon">🤲</span>
          <div>
            <div class="help-balance-title">帮扶收益</div>
            <div class="help-balance-hint">只可参团或激活档位使用 · 不可直接提现</div>
          </div>
        </div>
        <div class="help-balance-right">
          <span class="help-balance-label">可用余额</span>
          <span class="help-balance-val">${{ (apiData.helpBalance || 0).toFixed(2) }}</span>
        </div>
      </div>

      <!-- 两类帮扶 -->
      <div class="help-types-grid">
        <!-- 出局帮扶 -->
        <div class="help-type-card">
          <div class="help-type-header">
            <span class="help-type-icon">🏪</span>
            <span class="help-type-name">出局帮扶</span>
            <span class="help-type-chip">5%/人</span>
          </div>
          <div class="help-type-body">
            <div class="help-type-trigger">触发：有人激活入驻你店铺</div>
            <div class="help-type-rule">出局直推 × 5%，最多2位</div>
            <div class="help-type-max">最高 = 激活额 × <b>10%</b></div>
          </div>
        </div>
        <!-- 拼团帮扶 -->
        <div class="help-type-card help-type-card--pintuan">
          <div class="help-type-header">
            <span class="help-type-icon">🛍️</span>
            <span class="help-type-name">拼团帮扶</span>
            <span class="help-type-chip">10%/人</span>
          </div>
          <div class="help-type-body">
            <div class="help-type-trigger">触发：直推参团中奖</div>
            <div class="help-type-rule">参团直推 × 10%，最多2位</div>
            <div class="help-type-max">最高 = 奖池 × <b>20%</b></div>
          </div>
        </div>
      </div>

      <!-- 使用规则 -->
      <div class="subsidy-rules">
        <div class="rule-item">💡 帮扶收益不可直接提现，须先参团或激活档位</div>
        <div class="rule-item">✅ 用帮扶收益参团中奖后 → 奖金进入余额可提现</div>
        <div class="rule-item">✅ 用帮扶收益直接激活 V1-V6 任意档位</div>
        <div class="rule-item">✅ 最多计算2位直推，自动触发无需手动领取</div>
      </div>
    </div>
    
    <!-- 全球贡献奖励 -->
    <div class="contribution-card" v-if="activeNav === 'global'">
      <div class="contribution-header">
        <span class="contribution-title">🌍 全球贡献奖励</span>
        <span class="contribution-badge">平级奖10%补贴池</span>
      </div>
      
      <!-- 贡献池余额（三个池子） -->
      <div class="contribution-balance">
        <div class="balance-box">
          <div class="balance-label">复购月卡池</div>
          <div class="balance-amount">{{ contributionBalance.renewPool || 0 }}</div>
          <div class="balance-percent">10%</div>
          <div class="balance-hint">满10自动复购</div>
        </div>
        <div class="balance-box">
          <div class="balance-label">购物池</div>
          <div class="balance-amount">{{ contributionBalance.shoppingPool || 0 }}</div>
          <div class="balance-percent">5%</div>
        </div>
        <div class="balance-box">
          <div class="balance-label">互转销毁池</div>
          <div class="balance-amount">{{ contributionBalance.burnPool || 0 }}</div>
          <div class="balance-percent">10%</div>
        </div>
      </div>
      
      <!-- 功能说明 -->
      <div class="contribution-features">
        <div class="feature-title">📌 贡献池用途</div>
        
        <div class="feature-item">
          <span class="feature-icon">🔄</span>
          <div class="feature-content">
            <div class="feature-name">自动复购月卡 (10%)</div>
            <div class="feature-desc">复购池满10元自动续费30天，触发奖励计算</div>
          </div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">🛒</span>
          <div class="feature-content">
            <div class="feature-name">购物池 (5%)</div>
            <div class="feature-desc">用于自动购物，触发6层平级奖</div>
          </div>
        </div>
        
        <div class="feature-item">
          <span class="feature-icon">🔥</span>
          <div class="feature-content">
            <div class="feature-name">互转销毁池 (10%)</div>
            <div class="feature-desc">给直推和团队销毁他们挖的金币</div>
          </div>
        </div>
      </div>
      
      <!-- 规则说明 -->
      <div class="contribution-rules">
        <div class="rule-item">✅ 平级奖收益的25%自动锁入贡献池</div>
        <div class="rule-item">✅ 10%复购月卡池（满10自动复购）</div>
        <div class="rule-item">✅ 5%购物池</div>
        <div class="rule-item">✅ 10%互转销毁池</div>
      </div>
    </div>
    
    <!-- 结算明细 -->
    <div class="quick-links" v-if="activeNav === 'history'">
      <div class="link-item" @click="goTo('/transfer-history')">
        <span class="link-icon">📋</span>
        <span class="link-text">结算明细</span>
      </div>
      <div class="link-item" @click="goTo('/transaction-history')">
        <span class="link-icon">📈</span>
        <span class="link-text">收益记录</span>
      </div>
    </div>
    
    <!-- 收益记录 -->
    <div class="quick-links" v-if="activeNav === 'earnings'">
      <div class="link-item" @click="goTo('/transaction-history')">
        <span class="link-icon">📈</span>
        <span class="link-text">查看收益记录</span>
      </div>
    </div>

    <!-- 拼团补贴 -->
    <div class="pt-card" v-if="activeNav === 'pintuan'">

      <!-- 解锁状态横幅 -->
      <div class="pt-unlock-banner" :class="pintuanData.isUnlocked ? 'pt-unlocked' : 'pt-locked'">
        <span v-if="pintuanData.isUnlocked">
          已解锁 · 直推 {{ pintuanData.referralCount }} 人激活 · 两种各10次/天，合计20次
        </span>
        <span v-else>
          直推 {{ pintuanData.referralCount || 0 }}/{{ pintuanData.minReferrals || 2 }} 人激活V1+ 解锁两种各10次 · 当前$10/$20混搭合计10次
        </span>
      </div>

      <!-- 3档参团卡 -->
      <div class="pt-tiers">

        <!-- $10 现金拼团 -->
        <div class="pt-tier-item">
          <div class="pt-tier-header">
            <span class="pt-tier-name">$10 现金</span>
            <span class="pt-tier-stat">今日 {{ pintuanData.todayCounts?.cash_10 || 0 }}/10 次</span>
          </div>
          <div class="pt-tier-meta">6人团 · 4中2不中 · 中奖率 66.7%</div>
          <div class="pt-tier-prize">中奖 → 退 $10 + $1 现金</div>
          <button class="pt-tier-btn cash-btn"
                  @click="joinPintuan('cash_10')"
                  :disabled="pintuanJoining || isTierDisabled('cash_10')">
            <span v-if="activeTier === 'cash_10' && pintuanJoining">处理中…</span>
            <span v-else-if="isTierDisabled('cash_10')">{{ getTierMsg('cash_10') }}</span>
            <span v-else>参团 · $10</span>
          </button>
        </div>

        <!-- $20 现金拼团 -->
        <div class="pt-tier-item">
          <div class="pt-tier-header">
            <span class="pt-tier-name">$20 现金</span>
            <span class="pt-tier-stat">今日 {{ pintuanData.todayCounts?.cash_20 || 0 }}/10 次</span>
          </div>
          <div class="pt-tier-meta">6人团 · 4中2不中 · 中奖率 66.7%</div>
          <div class="pt-tier-prize">中奖 → 退 $20 + $1 现金</div>
          <button class="pt-tier-btn cash-btn"
                  @click="joinPintuan('cash_20')"
                  :disabled="pintuanJoining || isTierDisabled('cash_20')">
            <span v-if="activeTier === 'cash_20' && pintuanJoining">处理中…</span>
            <span v-else-if="isTierDisabled('cash_20')">{{ getTierMsg('cash_20') }}</span>
            <span v-else>参团 · $20</span>
          </button>
        </div>

        <!-- 拼团券 -->
        <div class="pt-tier-item pt-voucher-item">
          <div class="pt-tier-header">
            <span class="pt-tier-name">拼团券</span>
            <span class="pt-tier-stat">今日 {{ pintuanData.todayCounts?.voucher || 0 }}/10 次</span>
          </div>
          <div class="pt-tier-meta">6人团 · 3中3不中 · 中奖率 50%</div>
          <div class="pt-tier-prize">中奖 → 退 $20 + $1 现金（消耗4张券）</div>
          <div class="pt-tier-voucher-row">持有 <b>{{ apiData.couponCount || 0 }}</b> 张券</div>
          <button class="pt-tier-btn voucher-btn"
                  @click="joinPintuan('voucher')"
                  :disabled="pintuanJoining || isTierDisabled('voucher')">
            <span v-if="activeTier === 'voucher' && pintuanJoining">处理中…</span>
            <span v-else-if="isTierDisabled('voucher')">{{ getTierMsg('voucher') }}</span>
            <span v-else>用券参团（4张）</span>
          </button>
        </div>

      </div>

      <!-- 结果提示 -->
      <div v-if="pintuanResult" :class="['pt-result', pintuanResult.isWinner ? 'winner' : 'loser']">
        <div class="pt-result-icon">{{ pintuanResult.isWinner ? '🎉' : '💪' }}</div>
        <div class="pt-result-msg">{{ pintuanResult.message }}</div>
        <button class="pt-result-close" @click="pintuanResult = null">✕</button>
      </div>

      <!-- 奖励规则 -->
      <div class="pt-prize-box">
        <div class="pt-prize-title">💰 奖励规则</div>
        <div class="pt-prize-row">
          <span class="pt-prize-icon">①</span>
          <span>中奖：<b>全额退回</b>本金 + <b>$1</b> 现金到余额</span>
        </div>
        <div class="pt-prize-row">
          <span class="pt-prize-icon">②</span>
          <span>帮扶直推：中奖触发 <b>$0.50/人</b>，最多2位出局直推各得 $0.50</span>
        </div>
        <div class="pt-prize-row">
          <span class="pt-prize-icon">③</span>
          <span>团队流水每日结算：<b>70%→余额</b>，<b>30%→升档复投池</b></span>
        </div>
      </div>

      <!-- 拼团券管理 -->
      <div class="voucher-info-card">
        <div class="voucher-info-left">
          <span class="voucher-info-icon">🎟️</span>
          <span class="voucher-info-text">拼团券 <b>{{ apiData.couponCount || 0 }}</b> 张</span>
        </div>
        <div class="voucher-info-actions">
          <button class="voucher-btn-buy" @click="showBuyVoucherModal = true">余额购买</button>
          <button class="voucher-btn-transfer" @click="showTransferVoucherModal = true">转赠</button>
        </div>
      </div>

      <!-- 购买拼团券弹窗 -->
      <div v-if="showBuyVoucherModal" class="pay-modal-overlay" @click.self="showBuyVoucherModal = false">
        <div class="pay-modal">
          <div class="pay-modal-title">💰 余额购买拼团券</div>
          <div class="pay-modal-subtitle">$5/张 · 4张参团1次，券不可提现</div>
          <div class="voucher-buy-row">
            <button class="voucher-qty-btn" @click="voucherBuyCount = Math.max(1, voucherBuyCount - 1)">－</button>
            <span class="voucher-qty-num">{{ voucherBuyCount }} 张</span>
            <button class="voucher-qty-btn" @click="voucherBuyCount = Math.min(10, voucherBuyCount + 1)">＋</button>
          </div>
          <div class="voucher-buy-total">合计 ${{ voucherBuyCount * 5 }}（当前余额 ${{ (currentBalance || 0).toFixed(2) }}）</div>
          <div class="pay-modal-btns" style="margin-top:14px">
            <button class="pay-cancel-btn" @click="showBuyVoucherModal = false">取消</button>
            <button class="pay-confirm-btn" @click="confirmBuyVoucher">确认购买</button>
          </div>
        </div>
      </div>

      <!-- 转赠拼团券弹窗 -->
      <div v-if="showTransferVoucherModal" class="pay-modal-overlay" @click.self="showTransferVoucherModal = false">
        <div class="pay-modal">
          <div class="pay-modal-title">🎁 转赠拼团券</div>
          <div class="pay-modal-subtitle">当前持有 {{ apiData.couponCount || 0 }} 张</div>
          <input v-model="transferInviteCode" class="form-input" placeholder="输入对方邀请码" maxlength="10" style="margin:12px 0 8px;width:100%;box-sizing:border-box" />
          <div class="voucher-buy-row">
            <button class="voucher-qty-btn" @click="transferCount = Math.max(1, transferCount - 1)">－</button>
            <span class="voucher-qty-num">{{ transferCount }} 张</span>
            <button class="voucher-qty-btn" @click="transferCount = Math.min(apiData.couponCount || 1, transferCount + 1)">＋</button>
          </div>
          <div class="pay-modal-btns" style="margin-top:14px">
            <button class="pay-cancel-btn" @click="showTransferVoucherModal = false">取消</button>
            <button class="pay-confirm-btn" @click="confirmTransferVoucher">确认转赠</button>
          </div>
        </div>
      </div>

      <!-- 自动拼团开关 -->
      <div class="pt-auto-row">
        <label class="pt-auto-label">
          <input type="checkbox" v-model="pintuanAutoRejoin" @change="toggleAutoRejoin" />
          <span class="pt-auto-text">自动拼团（未中奖自动进入下一场同档位）</span>
        </label>
      </div>

      <!-- 出局后级别流水分红说明 -->
      <div class="exit-rule-block" style="margin-top:4px">
        <div class="exit-rule-block-title">📊 出局后·级别流水分红（出局 1–9 人）</div>
        <div class="exit-rule-desc">出局 N 人 → 拿伞下 N 级网络拼团流水各 1%，V1即可参与</div>
        <div class="exit-level-table">
          <div class="exit-level-header">
            <span>出局次数</span><span>享受级别</span><span>约覆盖人数</span>
          </div>
          <div v-for="n in 9" :key="n" class="exit-level-row"
               :class="{ 'row-active': (dpStatus.exitCount || 0) >= n && (dpStatus.exitCount || 0) < 10 }">
            <span>{{ n }} 人</span>
            <span>1–{{ n }} 级</span>
            <span>~{{ Math.pow(2, n + 1) - 2 }} 人</span>
          </div>
        </div>
        <div class="exit-rule-example">
          💡 示例：出局9人，9级网络约1000人，每天参团20次（解锁后）<br>
          每天收益约 1000 × 15 × $15 × 1% = <b>$2250/天</b>（$10/$20均值）
        </div>
      </div>

      <!-- 活动规则 -->
      <div class="pt-rules">
        <div class="pt-rules-title">📋 活动规则</div>
        <div class="pt-rule-item">· 直推 <b>2人以上</b> 激活V1+ → 解锁两种各10次/天，<b>合计20次</b></div>
        <div class="pt-rule-item">· 未达标：$10/$20 可自由混搭，<b>合计10次</b>/天</div>
        <div class="pt-rule-item">· 拼团券独立计数：每天最多 <b>10次</b>（与现金无关）</div>
        <div class="pt-rule-item">· 现金拼团：6人团 4中2不中（中奖率 66.7%）</div>
        <div class="pt-rule-item">· 拼团券：6人团 3中3不中（中奖率 50%，无需现金）</div>
        <div class="pt-rule-item">· 连续签到 <b>7天</b>（首次）→ 送 <b>1张</b>拼团券</div>
        <div class="pt-rule-item">· 激活档位赠券：V1-V3 送 <b>8张</b>，V4-V6 送 <b>16张</b></div>
        <div class="pt-rule-item">· 拼团券 <b>$5/张</b>，余额可购买；使用 <b>4张</b>参团1次；券不可提现</div>
      </div>
    </div>
    <!-- 服务商 -->
    <div class="hehuo-card" v-if="activeNav === 'hehuo'">
      <!-- 服务商状态徽章 -->
      <div class="hehuo-badge-section" :class="{ qualified: hehuoStatus.isServiceProvider }">
        <div class="hehuo-badge-icon">{{ hehuoStatus.isServiceProvider ? '🏆' : '🏪' }}</div>
        <div class="hehuo-badge-info">
          <div class="hehuo-badge-title">{{ hehuoStatus.isServiceProvider ? '🏪 正式服务商' : '服务商资格' }}</div>
          <div class="hehuo-badge-sub">{{ hehuoStatus.isServiceProvider ? '已满足条件，享受服务商全部权益' : '激活$1000 + 出局30个店主 即可成为服务商' }}</div>
        </div>
        <span class="hehuo-badge-status" :class="hehuoStatus.isServiceProvider ? 'active' : 'pending'">
          {{ hehuoStatus.isServiceProvider ? '✅ 已达标' : '⏳ 未达标' }}
        </span>
      </div>

      <!-- 双条件进度 -->
      <div class="hehuo-progress-section">
        <div class="hehuo-progress-title">📋 服务商达标条件</div>

        <!-- 条件1：激活$1000 (V6) -->
        <div class="sp-cond-row">
          <div class="sp-cond-label">
            <span class="sp-cond-icon">{{ hehuoStatus.hasV6 ? '✅' : '○' }}</span>
            <span>激活 $1000 档位（V6）</span>
          </div>
          <span class="sp-cond-tag" :class="hehuoStatus.hasV6 ? 'tag-done' : 'tag-todo'">
            {{ hehuoStatus.hasV6 ? '已完成' : '未完成' }}
          </span>
        </div>

        <!-- 条件2：出局30个店主 -->
        <div class="sp-cond-row">
          <div class="sp-cond-label">
            <span class="sp-cond-icon">{{ (hehuoStatus.exitCount || 0) >= 30 ? '✅' : '○' }}</span>
            <span>出局30个店主（当前 {{ hehuoStatus.exitCount || 0 }}/30）</span>
          </div>
          <span class="sp-cond-tag" :class="(hehuoStatus.exitCount||0) >= 30 ? 'tag-done' : 'tag-todo'">
            {{ (hehuoStatus.exitCount||0) >= 30 ? '已完成' : `差${30-(hehuoStatus.exitCount||0)}人` }}
          </span>
        </div>
        <div class="hehuo-progress-bar-wrap" style="margin-top:8px">
          <div class="hehuo-progress-bar"
            :style="{ width: Math.min((hehuoStatus.exitCount||0)/30*100,100)+'%' }"></div>
        </div>
      </div>

      <!-- 服务商权益 -->
      <div class="hehuo-rights">
        <div class="hehuo-rights-title">🎖️ 服务商权益</div>
        <div class="hehuo-right-item">🛍️ 产品上架权（平台产品自由上架）</div>
        <div class="hehuo-right-item">💰 产品分红池 <b>10%</b> 日分（每日发放）</div>
        <div class="hehuo-right-item">⚖️ 交易对冲服务费 <b>5%</b></div>
        <div class="hehuo-right-item">✅ 平台共建服务商身份标识</div>
      </div>
    </div>

    <!-- 出局分润 -->
    <div class="partner-card" v-if="activeNav === 'partner'">

      <!-- 状态卡片（紧凑版） -->
      <div class="dp-mini-card" :class="{ 'dp-mini-active': dpStatus.isQualified }">
        <div class="dp-mini-left">
          <span class="dp-mini-icon">{{ dpStatus.isQualified ? '🏆' : dpStatus.hasShop ? '🎯' : '🔒' }}</span>
          <div class="dp-mini-tier">
            <span class="dp-mini-tier-name">{{
              (dpStatus.exitCount||0) >= 30 ? 'V6 最高档 · 10%' :
              (dpStatus.exitCount||0) >= 20 ? 'V4/V5 进阶档 · 6%' :
              (dpStatus.exitCount||0) >= 1  ? '拼团流水 · N层1%' : '出局分润'
            }}</span>
            <span class="dp-mini-desc">{{
              dpStatus.isQualified ? `已出局 ${dpStatus.exitCount} 人，每日分润` :
              dpStatus.hasShop ? '出局满20人开始分润' : '成为店主后开始计算'
            }}</span>
          </div>
        </div>
        <div class="dp-mini-right">
          <span class="dp-mini-earn-label">今日分润</span>
          <span class="dp-mini-earn-val">{{ dpStatus.isQualified ? '$' + (dpStatus.todayEarnings || 0).toFixed(2) : '--' }}</span>
        </div>
      </div>

      <!-- 出局进度 -->
      <div class="partner-progress">
        <div class="progress-item">
          <div class="progress-header">
            <span class="progress-label">我的店铺出局数</span>
            <span class="progress-value">{{ dpStatus.exitCount || 0 }} 人</span>
          </div>
          <!-- 进度条：1/20/30 -->
          <div class="exit-multi-progress">
            <div class="exit-multi-track">
              <div class="exit-multi-fill"
                :style="{ width: Math.min((dpStatus.exitCount || 0) / 30 * 100, 100) + '%' }"></div>
              <div class="exit-tick" style="left:66.6%"><span>20</span></div>
              <div class="exit-tick" style="left:100%"><span>30</span></div>
            </div>
            <div class="exit-multi-labels">
              <span>1人<br>拼团</span>
              <span>20人<br>6%</span>
              <span>30人<br>10%</span>
            </div>
          </div>
          <div class="progress-hint" v-if="dpStatus.hasShop">
            <template v-if="(dpStatus.exitCount||0) >= 30">🏆 已达最高档 V6，激活额 10% 分润</template>
            <template v-else-if="(dpStatus.exitCount||0) >= 20">还需出局 <strong>{{ 30-(dpStatus.exitCount||0) }}</strong> 人 → V6 10%</template>
            <template v-else>还需出局 <strong>{{ 20-(dpStatus.exitCount||0) }}</strong> 人 → V4/V5 6% 分润（当前享受拼团流水分红）</template>
          </div>
        </div>
      </div>

      <!-- 收益统计（已达标才显示） -->
      <div class="partner-dividend-stats" v-if="dpStatus.isQualified">
        <div class="stats-header">
          <span class="stats-title">分润统计</span>
          <span class="pool-badge">全网业绩 {{ Math.round((dpStatus.exitRate || 0.1) * 100) }}% 均分</span>
        </div>
        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-label">今日分润</span>
            <span class="stat-value gold">{{ fmt(dpStatus.todayEarnings) }}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">本月分润</span>
            <span class="stat-value gold">{{ fmt(dpStatus.monthEarnings) }}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">累计分润</span>
            <span class="stat-value gold">{{ fmt(dpStatus.totalEarnings) }}</span>
          </div>
        </div>
      </div>

      <!-- 规则说明 -->
      <div class="partner-dividend-info">
        <div class="info-header"><span class="info-title">📋 出局分润规则</span></div>

        <!-- 升级档位利润分红 5-30 -->
        <div class="exit-rule-block">
          <div class="exit-rule-block-title">🌐 升级档位利润分红（出局 20 人以上）</div>
          <div class="exit-rule-desc">分的是每单升级档位利润的 16%，达到哪档拿哪档，与同档用户均分</div>
          <div class="exit-global-tiers">
            <div class="exit-global-tier" :class="{ 'tier-active': (dpStatus.exitCount || 0) >= 30 }">
              <span class="tier-exit">出局 30 人</span>
              <span class="tier-rate">激活额 <b>10%</b> · V6</span>
              <span class="tier-tag tag-gold">最高档</span>
            </div>
            <div class="exit-global-tier" :class="{ 'tier-active': (dpStatus.exitCount || 0) >= 20 && (dpStatus.exitCount || 0) < 30 }">
              <span class="tier-exit">出局 20 人</span>
              <span class="tier-rate">激活额 <b>6%</b> · V4/V5</span>
              <span class="tier-tag tag-purple">进阶档</span>
            </div>
          </div>
          <div class="exit-rule-example">
            💡 示例：当日全网激活总额 $10000，V6达标用户5人均分<br>
            每人每天 = $10000 × 10% ÷ 5 = <b>$200/天</b>
          </div>
        </div>
      </div>
    </div>

    <!-- 互转余额弹窗 -->
    <div v-if="showTransferDialog" class="dialog-overlay" @click="showTransferDialog = false">
      <div class="dialog-box" @click.stop>
        <div class="dialog-header">
          <h3>互转余额</h3>
          <button class="close-btn" @click="showTransferDialog = false">✕</button>
        </div>

        <!-- Step 1: 填写转账信息 -->
        <template v-if="transferDialogStep === 1">
          <div class="dialog-body">
            <div class="form-group">
              <label>对方用户ID</label>
              <input
                v-model="transferForm.toUserId"
                type="text"
                placeholder="请输入对方ID（如：88322）"
                class="form-input" />
            </div>

            <div class="form-group">
              <label>转账金额</label>
              <input
                v-model.number="transferForm.amount"
                type="number"
                placeholder="请输入金额"
                class="form-input" />
              <div class="form-hint">当前可用：{{ currentBalance }}</div>
            </div>

            <div class="transfer-tip">
              💡 请确保已在场外收到对方付款后再确认转账
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn cancel" @click="showTransferDialog = false">取消</button>
            <button class="btn confirm" :disabled="isProcessing" @click="transferStepOne">{{ isProcessing ? '验证中...' : '下一步' }}</button>
          </div>
        </template>

        <!-- Step 2: 安全问题验证 -->
        <template v-else-if="transferDialogStep === 2">
          <div class="dialog-body">
            <p style="font-size:13px;color:#666;margin-bottom:12px">请回答安全问题以确认身份</p>
            <div class="form-group">
              <label>{{ transferSecQ }}</label>
              <input v-model="transferSecA" type="text" placeholder="请输入答案" class="form-input" />
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn cancel" @click="transferDialogStep = 1">返回</button>
            <button class="btn confirm" :disabled="isProcessing" @click="confirmTransfer">{{ isProcessing ? '处理中...' : '确认转账' }}</button>
          </div>
        </template>
      </div>
    </div>
    
    <!-- 激活/升级弹窗（多档选择） -->
    <div v-if="showActivateDialog" class="dialog-overlay" @click="showActivateDialog = false">
      <div class="dialog-box activate-dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ isActivated ? '📈 升级档位' : '👑 选择档位' }}</h3>
          <button class="close-btn" @click="showActivateDialog = false">✕</button>
        </div>

        <div class="dialog-body">
          <!-- 档位多选卡片 -->
          <div class="tier-grid">
            <div
              v-for="tier in availableTiers"
              :key="tier.id"
              :class="['tier-card', {
                'selected': selectedTiers.includes(tier.id),
                'activated': tier.alreadyActivated,
                'locked': tier.locked
              }]"
              @click="toggleTier(tier)">
              <div class="tier-badge" v-if="tier.badge">{{ tier.badge }}</div>
              <div class="tier-name">{{ tier.name }}</div>
              <div class="tier-price">{{ tier.price }}</div>
              <div class="tier-check" v-if="selectedTiers.includes(tier.id)">✓</div>
              <div class="tier-activated-mark" v-if="tier.alreadyActivated">已激活</div>
            </div>
          </div>

          <!-- 余额提示 -->
          <div class="balance-row">
            <span class="balance-hint">当前学分：<b>{{ currentBalance }}</b></span>
            <span
              v-if="multiTotalCost > 0"
              :class="currentBalance >= multiTotalCost ? 'balance-ok' : 'balance-warn'">
              {{ currentBalance >= multiTotalCost ? '✅ 学分充足' : '⚠️ 学分不足，请联系合伙人办理' }}
            </span>
          </div>

          <!-- 邀请码 -->
          <!-- 首次激活才需要邀请码，已激活用户升级无需填写 -->
          <div class="form-group" style="margin-top:12px" v-if="!isActivated">
            <label>邀请码 <span class="required">*必填</span></label>
            <input
              v-model="inviteCode"
              type="text"
              placeholder="请输入邀请码"
              class="form-input"
              maxlength="10" />
            <div class="form-hint">💡 激活需要邀请码，请联系推荐人获取</div>
          </div>
        </div>

        <!-- 支付方式选择 -->
        <div class="activate-pay-select" v-if="selectedTiers.length > 0">
          <div class="activate-pay-label">付款方式</div>
          <div class="activate-pay-options">
            <label class="activate-pay-opt" :class="{ selected: activatePayMethod === 'balance' }">
              <input type="radio" v-model="activatePayMethod" value="balance" />
              <span>💰 余额 <b>${{ (currentBalance || 0).toFixed(2) }}</b></span>
            </label>
            <label class="activate-pay-opt" :class="{ selected: activatePayMethod === 'help' }">
              <input type="radio" v-model="activatePayMethod" value="help" />
              <span>🤲 帮扶收益 <b>${{ (apiData.helpBalance || 0).toFixed(2) }}</b></span>
            </label>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn cancel" @click="showActivateDialog = false">取消</button>
          <button
            class="btn confirm"
            @click="doActivate"
            :disabled="selectedTiers.length === 0 || (activatePayMethod === 'balance' ? multiTotalCost > currentBalance : multiTotalCost > (apiData.helpBalance || 0)) || (!isActivated && !inviteCode)">
            {{ selectedTiers.length > 0 ? (isActivated ? '确认升级' : '确认激活') : '请选择档位' }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- 操作结果提示弹窗 -->
    <div v-if="showResultDialog" class="dialog-overlay" @click="showResultDialog = false">
      <div class="dialog-box result-dialog" :class="resultType" @click.stop>
        <div class="result-icon">{{ resultType === 'success' ? '✅' : '❌' }}</div>
        <div class="result-title">{{ resultTitle }}</div>
        <div class="result-message">{{ resultMessage }}</div>
        <button class="btn confirm" @click="showResultDialog = false">确定</button>
      </div>
    </div>

    <!-- 合伙人服务弹窗（余额不足时） -->
    <div v-if="showPartnerServiceDialog" class="dialog-overlay" @click.self="showPartnerServiceDialog = false">
      <div class="partner-service-dialog" @click.stop>
        <button class="dialog-close-btn" @click="showPartnerServiceDialog = false">✕</button>
        <div class="ps-title">🤝 合伙人点对点服务</div>
        <div class="ps-subtitle">学分不足，请联系以下合伙人办理激活</div>

        <div v-if="loadingTeamServicePartners" class="ps-loading">加载中...</div>

        <div v-else-if="teamServicePartners.length > 0" class="ps-list">
          <div v-for="p in teamServicePartners" :key="p.id" class="ps-item">
            <div class="ps-info">
              <span class="ps-name">{{ p.username || p.id }}</span>
              <span class="ps-wechat">微信：{{ p.wechatNumber }}</span>
            </div>
            <button class="ps-copy-btn" @click="copyTeamWechat(p.wechatNumber, p.id)">
              {{ teamCopiedId === p.id ? '✅ 已复制' : '📋 复制' }}
            </button>
          </div>
        </div>

        <div v-else-if="teamServicePartnersLoaded" class="ps-empty">暂无可用合伙人，请稍后再试</div>

        <div class="ps-tip">告知合伙人您的用户ID和需要激活的档位，由合伙人为您点对点完成激活服务</div>
        <button class="ps-close-main-btn" @click="showPartnerServiceDialog = false">关闭</button>
      </div>
    </div>

    </div> <!-- 关闭 content-area -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getOrCreateUserId } from '../utils/auth.js'
import { apiRequest } from '../config/api.js'
import { useToast } from '../composables/useToast.js'
import { useDebounceButton } from '../composables/useDebounce.js'
import { getRewardConfig } from '../config/rewardConfig.js'
// partnerApiService 已替换为直推分润接口
import { useValidation } from '../composables/useValidation.js'
import { Validator } from '../utils/validation/Validator.js'
import { Sanitizer } from '../utils/validation/Sanitizer.js'
import { useUserStore } from '../stores/userStore.js'

const router = useRouter()
const route = useRoute()
const { success, error } = useToast()
const userStore = useUserStore()

// ==================== 手动刷新 ====================
const isRefreshing = ref(false)
const refreshAll = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await loadUserDataFromApi()
    loadDividendStatus()
    if (activeNav.value === 'partner') loadPartnerInfo()
    success('已刷新', '')
  } finally {
    isRefreshing.value = false
  }
}

// ==================== 防重复点击保护 ====================
const isProcessing = ref(false)  // 全局处理状态

// ==================== 合伙人服务弹窗 ====================
const showPartnerServiceDialog = ref(false)
const teamServicePartners = ref([])
const loadingTeamServicePartners = ref(false)
const teamServicePartnersLoaded = ref(false)
const teamCopiedId = ref(null)

async function loadTeamServicePartners() {
  if (loadingTeamServicePartners.value || teamServicePartnersLoaded.value) return
  loadingTeamServicePartners.value = true
  try {
    const res = await apiRequest('/partner/service-three')
    teamServicePartners.value = res.code === 200 ? (res.data || []) : []
    teamServicePartnersLoaded.value = true
  } catch (e) {
    teamServicePartners.value = []
    teamServicePartnersLoaded.value = true
  } finally {
    loadingTeamServicePartners.value = false
  }
}

async function copyTeamWechat(wechat, id) {
  try {
    await navigator.clipboard.writeText(wechat)
    teamCopiedId.value = id
    setTimeout(() => { teamCopiedId.value = null }, 2000)
  } catch (e) {
    const el = document.createElement('textarea')
    el.value = wechat
    document.body.appendChild(el); el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    teamCopiedId.value = id
    setTimeout(() => { teamCopiedId.value = null }, 2000)
  }
}

// ==================== 左侧导航数据 ====================
const activeNav = ref('model')

const navItems = [
  { id: 'model', icon: '🎯', label: '1+1模型', color: 'linear-gradient(135deg, #FF6B9D 0%, #C44569 100%)' },
  { id: 'team', icon: '👥', label: '团队数据', color: 'linear-gradient(135deg, #07C160 0%, #06AD56 100%)' },
  { id: 'subsidy', icon: '🤲', label: '帮扶补贴', color: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)' },
  { id: 'partner', icon: '📊', label: '出局分润', color: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)' },
  { id: 'pintuan', icon: '🛍️', label: '拼团补贴', color: 'linear-gradient(135deg, #FF6B35 0%, #E63900 100%)' },
  { id: 'hehuo', icon: '🏪', label: '服务商', color: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
  { id: 'earnings', icon: '📈', label: '收益记录', color: 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)' },
  { id: 'history', icon: '📋', label: '结算明细', color: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }
]

// ==================== 数据 ====================

const currentUserId = ref(getOrCreateUserId())
const currentModel = ref('BASIC')
const showTransferDialog = ref(false)
const transferDialogStep = ref(1)
const transferSecQ = ref('')
const transferSecQIndex = ref(1)
const transferSecA = ref('')
const transferTokenTeam = ref('')
const isDataLoaded = ref(false)

// 激活弹窗相关
const showActivateDialog = ref(false)
const activatePayMethod = ref('balance')
const inviteCode = ref('')
const copiedCode = ref('')

// 拼团补贴（多档位）
const pintuanData    = ref({ todayCounts: { cash_10: 0, cash_20: 0, voucher: 0 }, isUnlocked: false, referralCount: 0, minReferrals: 2, sessions: {} })
const pintuanJoining = ref(false)
const activeTier     = ref('')
const pintuanAutoRejoin = ref(false)
const pintuanResult    = ref(null)
const ptCountdown      = ref({ mm: '20', ss: '00' })
const selectedTiers = ref([])  // 已选档位列表（有序）

// 五档定义（V1~V5）
const ALL_TIERS = [
  { id: 'BASIC',    name: 'V1', badge: 'V1', price: 50  },
  { id: 'PREMIUM',  name: 'V2', badge: 'V2', price: 100 },
  { id: 'ELITE',    name: 'V3', badge: 'V3', price: 200 },
  { id: 'TIER_300', name: 'V4', badge: 'V4', price: 300 },
  { id: 'TIER_500', name: 'V5', badge: 'V5', price: 500 },
]
const TIER_ORDER_LIST = ['BASIC','PREMIUM','ELITE','TIER_300','TIER_500']

// 分润利率映射（无复利，全部为空）
const PROFIT_RATE_MAP = {}
const PROFIT_TIER_PRICE = {}

// 分润相关数据
const profitBalance   = ref(0)
const isClaimingProfit = ref(false)

// 可选档位：已激活档显示灰色（从 activatedTiers 判断），未激活的任意档都可选
const availableTiers = computed(() => {
  const activatedSet = new Set(apiData.value.activatedTiers || [])
  return ALL_TIERS.map((tier) => ({
    ...tier,
    alreadyActivated: activatedSet.has(tier.id),
    locked: false
  }))
})

// 合计费用
const multiTotalCost = computed(() =>
  selectedTiers.value.reduce((sum, id) => {
    const t = ALL_TIERS.find(t => t.id === id)
    return sum + (t?.price || 0)
  }, 0)
)

// 点击档位卡片：点谁选谁，再点取消（灵活单档选择，不自动连带）
function toggleTier(tier) {
  if (tier.alreadyActivated) {
    showResult('error', '提示', `${tier.name} 已激活`)
    return
  }

  const isSelected = selectedTiers.value.includes(tier.id)
  if (isSelected) {
    // 取消该档
    selectedTiers.value = selectedTiers.value.filter(id => id !== tier.id)
  } else {
    // 选中该档，保留其他已选（按顺序排列）
    const newSelected = [...selectedTiers.value, tier.id]
    newSelected.sort((a, b) => TIER_ORDER_LIST.indexOf(a) - TIER_ORDER_LIST.indexOf(b))
    selectedTiers.value = newSelected
  }
}

// 结果反馈弹窗
const showResultDialog = ref(false)
const resultType = ref('success')
const resultTitle = ref('')
const resultMessage = ref('')

// 显示结果弹窗的函数
function showResult(type, title, message) {
  resultType.value = type
  resultTitle.value = title
  resultMessage.value = message
  showResultDialog.value = true
}

const transferForm = ref({
  toUserId: '',
  amount: 0
})

// Transfer form validation
const transferValidationSchema = {
  toUserId: [
    Validator.required('请输入对方用户ID'),
    Validator.custom(
      (value) => value && value.trim().length > 0,
      '用户ID不能为空'
    )
  ],
  amount: [
    Validator.required('请输入转账金额'),
    Validator.positiveNumber('金额必须大于0'),
    Validator.decimal(2, '金额最多2位小数'),
    Validator.custom(
      (value) => value <= currentBalance.value,
      '余额不足'
    )
  ]
}

const {
  errors: transferErrors,
  isValid: isTransferValid,
  validate: validateTransferField,
  validateAll: validateTransferForm,
  clearErrors: clearTransferErrors
} = useValidation(transferForm, transferValidationSchema)

// ==================== 服务商状态 ====================
const hehuoStatus = ref({
  isServiceProvider: false,
  hasV6: false,
  activatedTiers: [],
  exitCount: 0
})

async function loadHehuoStatus() {
  try {
    const uid = currentUserId.value
    if (!uid) return
    const res = await apiRequest(`/subscription/status/${uid}`)
    if (res.code === 200 && res.data) {
      const tiers = Array.isArray(res.data.activatedTiers) ? res.data.activatedTiers : []
      const exitCnt = res.data.exitCount || 0
      const hasV6 = tiers.includes('TIER_1000')
      hehuoStatus.value = {
        isServiceProvider: !!res.data.isServiceProvider || (hasV6 && exitCnt >= 30),
        hasV6,
        activatedTiers: tiers,
        exitCount: exitCnt
      }
    }
  } catch (e) {
    console.warn('[HeHuo] 加载失败:', e)
  }
}

// ==================== 直推分润状态 ====================
const dpStatus = ref({
  exitCount: 0,
  hasShop: false,
  isQualified: false,
  exitMin: 10,
  exitRate: 0.10,
  todayEarnings: 0,
  monthEarnings: 0,
  totalEarnings: 0
})

// 金币余额等值U（保留原有）

// 是否可以转出U（金币余额≥5U等值）
const canTransferU = computed(() => {
  return parseFloat(coinBalanceInU.value) >= 5
})

// 是否可以确认U转账
const canConfirmUTransfer = computed(() => {
  return uTransferForm.value.toUserId && 
         uTransferForm.value.amountU >= 5 &&
         parseFloat(coinBalanceInU.value) >= uTransferForm.value.amountU
})

// 格式化数字
function formatNumber(num) {
  if (!num) return '0'
  return Math.floor(num).toLocaleString()
}

// 格式化时间
function formatRecordTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}


const teamStats = ref({
  activeManagerCount: 0,
  exitCount: 0,
  directCount: 0,
  totalCount: 0
})

// 用户身份状态
const userStatus = ref({
  isLandlord: false,
  description: ''
})

// 模型数据
const modelData = ref({
  positionA: null,
  positionB: null,
  waitingCount: 0
})

// ==================== API 用户数据（替代 engine.js 本地数据）====================
const apiData = ref({
  isActive: false,
  cardType: null,
  balance: 0,
  repurchaseBalance: 0,
  subsidyPool: 0,
  isIndependent: false,
  hasSlideDown: false,
  hasContributed: false,
  directPushCount: 0,
  contributionSlot: null,
  shopOwnerId: null,
  role: null,
  activatedTiers: [],
  // earnings
  totalEarnings: 0,
  todayEarnings: 0,
  spotBonusTotal: 0,
  levelBonusTotal: 0,
  couponCount: 0
})

// 采购补贴池余额
const subsidyBalance = ref({
  reinvestPool: 0,
  transferPool: 0,
  shoppingGold: 0,
  shoppingGoldStartDate: null  // 购物金复利计时起点
})

// 购物金复利状态
const sgStatus = computed(() => {
  const startDate = subsidyBalance.value.shoppingGoldStartDate
  const sg = subsidyBalance.value.shoppingGold || 0
  if (!startDate || sg < 300) return { started: false, days: 0 }
  const diff = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
  return { started: true, days: Math.min(diff, 30) }
})

// 购物金手动领取
const sgClaiming = ref(false)
async function claimShoppingGold() {
  if (sgClaiming.value) return
  sgClaiming.value = true
  try {
    const uid = currentUserId.value
    const res = await apiRequest('/subscription/claim-shopping-gold', 'POST', { userId: uid })
    if (res.code === 200) {
      alert(`✅ 领取成功！${res.data.claimed} 已到账余额`)
      subsidyBalance.value.shoppingGold = 0
      subsidyBalance.value.shoppingGoldStartDate = null
      await refreshAll()
    } else {
      alert('领取失败：' + res.message)
    }
  } catch (e) {
    alert('网络错误，请重试')
  } finally {
    sgClaiming.value = false
  }
}

// 补贴转账已停用：补贴池满30自动结算为分润，不支持手动互转

// 全球贡献池余额
const contributionBalance = ref({
  autoRenew: 0,   // 15% 自动续费/购物
  burnPool: 0     // 10% 互转销毁
})
// 每日分红相关
const dividendStatus = ref({
  todayOrders: 0,
  todayAmount: 0,
  estimatedPool: 0,
  eligibleUsers: 0,
  isQualified: false,
  estimatedAmount: 0,
  executed: false
})

// ==================== 计算属性 ====================

// 金币余额（当前余额，用于 U 转账判断）
const coinBalanceInU = computed(() => apiData.value.balance || 0)

// 用户卡类型（apiData 未加载时 fallback 到 userStore，避免弹窗时序问题）
const userCardType = computed(() => apiData.value.cardType || userStore.cardType)

// 复投池阈值（按档位，满额自动升级到下一档）
const REINVEST_THRESHOLD_MAP = { BASIC: 100, PREMIUM: 200, ELITE: 300, TIER_300: 500, TIER_500: null }
const reinvestThreshold = computed(() => REINVEST_THRESHOLD_MAP[userCardType.value] ?? 30)

const userCardTypeName = computed(() => {
  if (!userCardType.value) return ''
  return getRewardConfig().getCardName(userCardType.value)
})

const activatePrice = computed(() => {
  try {
    const cardType = userCardType.value || 'BASIC'
    const price = getRewardConfig().getCardPrice(cardType)
    return price || 100
  } catch (e) {
    console.error('activatePrice error:', e)
    return 100
  }
})
const spotBonusAmount = computed(() => {
  try {
    const cardType = userCardType.value || 'BASIC'
    const amount = getRewardConfig().getSpotBonusAmount(cardType)
    return amount || 36
  } catch (e) {
    console.error('spotBonusAmount error:', e)
    return 36
  }
})
const levelBonusAmount = computed(() => {
  try {
    const cardType = userCardType.value || 'BASIC'
    const amount = getRewardConfig().getLevelBonusAmount(cardType)
    return amount || 8
  } catch (e) {
    console.error('levelBonusAmount error:', e)
    return 8
  }
})
const levelGenerations = computed(() => {
  try {
    return getRewardConfig().getLevelGenerations() || 6
  } catch (e) {
    console.error('levelGenerations error:', e)
    return 6
  }
})

const currentBalance = computed(() => apiData.value.balance || 0)

// 数字格式化：整数显示整数，否则保留2位小数
function fmt(val) {
  const n = Number(val) || 0
  return Number.isInteger(n) ? n : parseFloat(n.toFixed(2))
}

// ✅ 收益显示：优先今日，今日为0则显示累计总收益
const todayEarnings = computed(() => {
  const today = apiData.value.todayEarnings || 0
  const total = apiData.value.totalEarnings || 0
  return fmt(today > 0 ? today : total)
})
const earningsLabel = computed(() => {
  const today = apiData.value.todayEarnings || 0
  return today > 0 ? '今日收益' : '累计收益'
})

const withdrawable = computed(() => apiData.value.balance || 0)

const locked = computed(() => (apiData.value.repurchaseBalance || 0) + (apiData.value.subsidyPool || 0))

// 复投池余额（平级奖 10% → repurchase_balance）
const lockedUpgradeBalance = computed(() => apiData.value.repurchaseBalance || 0)

// isActivated：apiData 未加载时 fallback 到 userStore（防止弹窗时序问题导致邀请码误显示）
const isActivated = computed(() => apiData.value.isActive || userStore.isActivated || false)

// 分红资格进度（0-100）
const dividendProgress = computed(() => {
  const count = teamStats.value.directCount || 0
  return Math.min((count / 5) * 100, 100)
})

// 身份状态（店主/店长模式）
const identityStatus = computed(() => {
  const d = apiData.value
  if (!d.isActive && !d.isIndependent) {
    return {
      icon: '👔',
      title: '店长身份',
      subtitle: '等待加入店铺',
      badge: '未激活',
      badgeClass: 'pending',
      cardClass: '',
      isLandlord: false,
      hasSlippage: false,
      hasContributed: false,
      contributionProgress: '0/1',
      contributionPercent: 0,
      contributionHint: '推荐1个人后出局开店',
      nextIsContribution: true
    }
  }

  const isLandlord = d.isIndependent || false
  const hasSlippage = d.hasSlideDown || false
  const hasContributed = d.hasContributed || false
  const directCount = d.directPushCount || 0
  
  // 计算出局进度和提示
  let contributionProgress = ''
  let contributionPercent = 0
  let contributionHint = ''
  let nextIsContribution = false
  
  if (!hasContributed) {
    if (!isLandlord) {
      // 店长：第1个直推出局
      contributionProgress = `${directCount}/1`
      contributionPercent = directCount >= 1 ? 100 : 0
      contributionHint = '⚠️ 推荐1个人后，你将出局开店成为店主'
      nextIsContribution = true
    } else if (hasSlippage) {
      // 店主（有滑落）：第5个直推贡献
      contributionProgress = `${directCount}/5`
      contributionPercent = Math.min((directCount / 5) * 100, 100)
      if (directCount < 4) {
        contributionHint = `还需直推 ${5 - directCount} 人，第5个将贡献给上级`
        nextIsContribution = false
      } else if (directCount === 4) {
        contributionHint = '⚠️ 下一个直推（第5个）将贡献给上级！'
        nextIsContribution = true
      }
    } else {
      // 店主（自主出局）：第1个已贡献
      contributionProgress = '1/1'
      contributionPercent = 100
      contributionHint = '✅ 出局时已完成贡献'
    }
  }
  
  // 确定显示内容
  let icon, title, subtitle, badge, badgeClass, cardClass
  
  if (!isLandlord) {
    // 店长身份
    icon = '👔'
    title = '店长身份'
    subtitle = '在上级店铺工作，推满1人出局'
    badge = '等待出局'
    badgeClass = 'pending'
    cardClass = 'manager'
  } else if (hasContributed) {
    // 店主（已完成贡献）
    icon = '👑'
    title = '店主身份'
    subtitle = '永久拿见点奖，无限开店'
    badge = '独立店铺'
    badgeClass = 'landlord'
    cardClass = 'owner-completed'
  } else if (hasSlippage) {
    // 店主（有滑落，待贡献）
    icon = '👑'
    title = '店主身份（有滑落）'
    subtitle = '被上级直推替换出局'
    badge = directCount < 5 ? `待贡献` : '即将贡献'
    badgeClass = directCount === 4 ? 'warning' : 'active'
    cardClass = 'owner-slippage'
  } else {
    // 店主（自主出局）
    icon = '👑'
    title = '店主身份'
    subtitle = '自己直推替换出局开店'
    badge = '已贡献'
    badgeClass = 'landlord'
    cardClass = 'owner-self'
  }
  
  return {
    icon,
    title,
    subtitle,
    badge,
    badgeClass,
    cardClass,
    isLandlord,
    hasSlippage,
    hasContributed,
    contributionProgress,
    contributionPercent,
    contributionHint,
    nextIsContribution
  }
})

// ==================== 方法 ====================

const loadPintuanData = async () => {
  try {
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res  = await fetch('/api/pintuan/status', { headers })
    const json = await res.json()
    if (json.code === 0) {
      pintuanData.value       = json.data
      pintuanAutoRejoin.value = json.data.autoRejoin || false
    }
  } catch {}
}

const showBuyVoucherModal = ref(false)
const showTransferVoucherModal = ref(false)
const voucherBuyCount = ref(1)
const transferCount = ref(1)
const transferInviteCode = ref('')
let modelViewTracked = false

const confirmBuyVoucher = async () => {
  showBuyVoucherModal.value = false
  try {
    const res = await apiRequest('/pintuan/voucher/buy', 'POST', { count: voucherBuyCount.value })
    if (res.code === 200) {
      success('购买成功', res.message)
      await loadUserDataFromApi()
    } else {
      error('购买失败', res.message)
    }
  } catch { error('购买失败', '网络错误，请重试') }
  voucherBuyCount.value = 1
}

const confirmTransferVoucher = async () => {
  if (!transferInviteCode.value.trim()) { error('提示', '请输入对方邀请码'); return }
  showTransferVoucherModal.value = false
  try {
    const res = await apiRequest('/pintuan/voucher/transfer', 'POST', {
      toInviteCode: transferInviteCode.value.trim(),
      count: transferCount.value
    })
    if (res.code === 200) {
      success('转赠成功', res.message)
      await loadUserDataFromApi()
    } else {
      error('转赠失败', res.message)
    }
  } catch { error('转赠失败', '网络错误，请重试') }
  transferInviteCode.value = ''
  transferCount.value = 1
}

const isTierDisabled = (tierType) => {
  const counts = pintuanData.value.todayCounts || {}
  const isUnlocked = pintuanData.value.isUnlocked
  if (tierType === 'voucher') return (counts.voucher || 0) >= 10
  // 现金档：解锁后每种各10次，未解锁时$10/$20混搭合计10次
  if (isUnlocked) return (counts[tierType] || 0) >= 10
  return ((counts.cash_10 || 0) + (counts.cash_20 || 0)) >= 10
}

const getTierMsg = (tierType) => {
  if (tierType === 'voucher') return '今日已达10次'
  return '今日已达10次'
}

const joinPintuan = async (tierType) => {
  if (pintuanJoining.value) return
  pintuanJoining.value = true
  activeTier.value     = tierType
  pintuanResult.value  = null
  try {
    const token = localStorage.getItem('token')
    const res  = await fetch('/api/pintuan/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tierType, autoRejoin: pintuanAutoRejoin.value })
    })
    const json = await res.json()
    if (json.code === 0) {
      pintuanResult.value = { isWinner: json.data?.isWinner, message: json.message }
      await loadPintuanData()
      await loadUserDataFromApi()
    } else {
      error('提示', json.message)
    }
  } catch { error('提示', '网络错误') }
  finally { pintuanJoining.value = false; activeTier.value = '' }
}

const toggleAutoRejoin = async () => {
  try {
    const token = localStorage.getItem('token')
    await fetch('/api/pintuan/auto-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ autoRejoin: pintuanAutoRejoin.value })
    })
  } catch {}
}

// 倒计时：计算到下一个20分钟整点还剩多少秒
const startPtCountdown = () => {
  const tick = () => {
    const now = new Date()
    const mins = now.getMinutes()
    const secs = now.getSeconds()
    const nextMark = Math.ceil((mins + secs / 60) / 20) * 20
    const remainSecs = (nextMark * 60) - (mins * 60 + secs)
    const mm = String(Math.floor(remainSecs / 60)).padStart(2, '0')
    const ss = String(remainSecs % 60).padStart(2, '0')
    ptCountdown.value = { mm, ss }
  }
  tick()
  setInterval(tick, 1000)
}

const copyInviteCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code)
    copiedCode.value = code
    setTimeout(() => { copiedCode.value = '' }, 2000)
  } catch {
    success('提示', '邀请码：' + code)
  }
}

const switchModel = (modelType) => {
  currentModel.value = modelType
  loadTeamStats()
}

const goTo = (path) => {
  router.push(path)
}

// 从后端 API 加载用户真实数据（替代 engine.js 本地读取）
const loadUserDataFromApi = async () => {
  if (!currentUserId.value) return
  try {
    const [statusRes, earningsRes] = await Promise.all([
      fetch(`/api/subscription/status/${currentUserId.value}`),
      fetch(`/api/subscription/earnings/${currentUserId.value}`)
    ])
    const statusJson = await statusRes.json()
    const earningsJson = await earningsRes.json()

    if (statusJson.code === 200 && statusJson.data) {
      const d = statusJson.data
      apiData.value = {
        ...apiData.value,
        isActive: d.isActive || false,
        cardType: d.cardType || null,
        balance: parseFloat(d.balance) || 0,
        repurchaseBalance: d.repurchaseBalance || 0,
        subsidyPool: d.subsidyPool || 0,
        profitBalance: parseFloat(d.profitBalance) || 0,
        isIndependent: d.isIndependent || false,
        hasSlideDown: d.hasSlideDown || false,
        hasContributed: d.hasContributed || false,
        directPushCount: d.directPushCount || 0,
        exitCount: d.exitCount || 0,
        contributionSlot: d.contributionSlot || null,
        shopOwnerId: d.shopOwnerId || null,
        role: d.role || null,
        activatedTiers: d.activatedTiers || [],
        inviteCode: d.inviteCode || '',
        shopOwnerInviteCode: d.shopOwnerInviteCode || null,
        shopTenantInviteCode: d.shopTenantInviteCode || null,
        shop: d.shop || null,
        helpBalance: parseFloat(d.helpBalance) || 0,
        couponCount: d.couponCount || 0
      }
    }

    if (earningsJson.code === 200 && earningsJson.data) {
      const e = earningsJson.data
      apiData.value = {
        ...apiData.value,
        totalEarnings: e.totalEarnings || 0,
        todayEarnings: e.todayEarnings || 0,
        spotBonusTotal: e.spotBonusTotal || 0,
        levelBonusTotal: e.levelBonusTotal || 0
      }
    }

    // 同步分润余额
    if (statusJson.code === 200) {
      profitBalance.value = parseFloat(statusJson.data?.profitBalance) || 0
    }

    // 同步衍生状态
    const d = apiData.value
    teamStats.value = {
      activeManagerCount: d.shop?.slota_tenant_id ? 1 : 0,
      exitCount: d.exitCount || 0,
      directCount: d.directPushCount,
      totalCount: d.directPushCount,
    }

    // 从 team-stats API 获取公排真实人数
    try {
      const statsRes = await fetch(`/api/subscription/team-stats/${currentUserId.value}`)
      const statsData = await statsRes.json()
      if (statsData.code === 200 && statsData.data) {
        teamStats.value = {
          ...teamStats.value,
          directCount: statsData.data.directCount || 0,
          totalCount: statsData.data.totalCount || 0
        }
      }
    } catch (e) {
      console.warn('[Team] team-stats 加载失败:', e)
    }
    userStatus.value = {
      isLandlord: d.isIndependent,
      description: d.isIndependent ? '独立房东' : '报恩位'
    }
    const shopTenant = statusJson.data?.shop?.slota_tenant_id || null
    modelData.value = {
      positionA: d.isIndependent ? currentUserId.value : (d.shopOwnerId || '独立店铺'),
      positionB: d.isIndependent ? shopTenant : currentUserId.value,
      waitingCount: d.directPushCount,
      inviteCodeA: d.shopOwnerInviteCode || (d.isIndependent ? d.inviteCode : null),
      inviteCodeB: d.shopTenantInviteCode || (!d.isIndependent ? d.inviteCode : null)
    }
    subsidyBalance.value = {
      reinvestPool: d.repurchaseBalance || 0,
      transferPool: d.subsidyPool || 0,
      shoppingGold: d.shoppingGold || 0,
      shoppingGoldStartDate: d.shoppingGoldStartDate || null
    }

  } catch (e) {
    console.error('[Team] 加载用户数据失败:', e)
  }
}

// loadTeamStats 保留兼容调用，触发 API 重新加载
const loadTeamStats = () => {
  loadUserDataFromApi()
}

// loadUserData 别名（给 confirmSubsidyTransfer 等旧代码调用）
const loadUserData = loadUserDataFromApi

// 加载分红状态（从 partner API 读取真实数据）
const loadDividendStatus = async () => {
  if (!currentUserId.value) return
  try {
    const res = await fetch(`/api/partner/dividends?userId=${currentUserId.value}`)
    const data = await res.json()
    if (data.code === 200 && data.data) {
      const d = data.data
      dividendStatus.value = {
        todayOrders: 0,
        todayAmount: d.todayEarnings || 0,
        estimatedPool: d.totalEarnings || 0,
        eligibleUsers: 0,
        isQualified: (apiData.value.directPushCount || 0) >= 5,
        estimatedAmount: d.todayEarnings || 0,
        executed: false
      }
    }
  } catch (e) {
    console.error('加载分红状态失败:', e)
  }
}

const transferStepOne = async () => {
  if (isProcessing.value) return
  if (!validateTransferForm()) {
    const firstError = Object.values(transferErrors.value)[0]
    showResult('error', '输入错误', firstError)
    return
  }
  isProcessing.value = true
  try {
    const res = await fetch('/api/auth/get-security-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: String(currentUserId.value) })
    })
    const data = await res.json()
    if (data.code !== 200) {
      showResult('error', '请先设置安全问题', '互转余额需要安全验证')
      return
    }
    transferSecQ.value = data.data.question
    transferSecQIndex.value = data.data.questionIndex
    transferDialogStep.value = 2
  } catch (e) {
    showResult('error', '验证失败', '请检查网络')
  } finally {
    isProcessing.value = false
  }
}

const confirmTransfer = async () => {
  if (isProcessing.value) {
    error('提示', '操作正在处理中，请稍候')
    return
  }

  if (!transferSecA.value.trim()) {
    showResult('error', '请输入', '安全问题答案不能为空')
    return
  }

  // 验证安全问题，获取一次性 token
  isProcessing.value = true
  try {
    const verifyRes = await fetch('/api/auth/verify-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: String(currentUserId.value), questionIndex: transferSecQIndex.value, answer: transferSecA.value })
    })
    const verifyData = await verifyRes.json()
    if (verifyData.code !== 200) {
      showResult('error', '答案错误', verifyData.message || '请重新输入')
      isProcessing.value = false
      return
    }
    transferTokenTeam.value = verifyData.transferToken || ''
  } catch (e) {
    showResult('error', '验证失败', '请检查网络')
    isProcessing.value = false
    return
  }

  const sanitizedToUserId = Sanitizer.sanitizeUserId(transferForm.value.toUserId)
  const sanitizedAmount = parseFloat(Sanitizer.sanitizeAmount(transferForm.value.amount))

  // 🚀 乐观更新：先扣除本地余额，让用户即刻看到变化
  const prevBalance = apiData.value.balance || 0
  apiData.value = { ...apiData.value, balance: Math.max(0, prevBalance - sanitizedAmount) }
  userStore.setBalance(Math.max(0, (userStore.balance || 0) - sanitizedAmount))

  try {
    const result = await apiRequest('/transfer/send', {
      method: 'POST',
      body: { fromUserId: currentUserId.value, toPhone: sanitizedToUserId, amount: sanitizedAmount, transferToken: transferTokenTeam.value }
    })
    if (result.code === 200) {
      showTransferDialog.value = false
      transferDialogStep.value = 1
      transferSecA.value = ''
      transferTokenTeam.value = ''
      showResult('success', '🎉 转账成功！', `已向用户 ${sanitizedToUserId} 转账 ${sanitizedAmount}`)
      transferForm.value = { toUserId: '', amount: 0 }
      clearTransferErrors()
      // 后台精确刷新（确保和服务器一致）
      loadUserDataFromApi()
      userStore.fetchUserStatus()
    } else {
      // 回滚乐观更新
      apiData.value = { ...apiData.value, balance: prevBalance }
      userStore.setBalance(prevBalance)
      transferTokenTeam.value = ''
      showResult('error', '转账失败', result.message || '请稍后重试')
    }
  } catch (err) {
    // 回滚乐观更新
    apiData.value = { ...apiData.value, balance: prevBalance }
    userStore.setBalance(prevBalance)
    showResult('error', '转账失败', err.message)
  } finally {
    setTimeout(() => { isProcessing.value = false }, 1000)
  }
}

// confirmSubsidyTransfer 已停用（补贴池满30自动结算为分润）

// ==================== 分润相关方法 ====================

// 加载分润余额（从 status 接口同步）
const loadProfitBalance = async () => {
  try {
    const result = await apiRequest(`/subscription/status/${currentUserId.value}`)
    if (result.code === 200) {
      profitBalance.value = parseFloat(result.data?.profitBalance) || 0
    }
  } catch (e) { /* 静默失败 */ }
}

// 手动领取分润
const handleClaimProfit = async () => {
  if (profitBalance.value <= 0 || isClaimingProfit.value) return
  isClaimingProfit.value = true
  try {
    const result = await apiRequest('/subscription/claim-profit', {
      method: 'POST',
      body: { userId: currentUserId.value }
    })
    if (result.code === 200) {
      showResult('success', '🎉 领取成功！', `已领取分润 ${result.data?.claimed} 到余额`)
      profitBalance.value = 0
      await loadUserDataFromApi()
    } else {
      showResult('error', '领取失败', result.message || '请稍后重试')
    }
  } catch (e) {
    showResult('error', '领取失败', e.message)
  } finally {
    isClaimingProfit.value = false
  }
}

// ==================== 激活相关方法 ====================

const handleActivate = () => {
  if (isProcessing.value) {
    showResult('error', '操作提示', '操作正在处理中，请稍候')
    return
  }

  // 仅当 localStorage 缓存也空时才阻止（首次清缓存后 API 未返回的极端情况）
  if (!userStore.isInitialized && !userStore.isActivated) {
    showResult('error', '提示', '账户数据加载中，请稍候1-2秒再试')
    return
  }

  // 打开弹窗，重置选择（灵活激活，不预选任何档位）
  inviteCode.value = ''
  selectedTiers.value = []
  showActivateDialog.value = true
}

// 实际执行激活（多档批量）
const doActivate = async () => {
  // 首次激活必须填邀请码；已激活用户补选档位无需邀请码（推荐人已绑定）
  if (!isActivated.value && !inviteCode.value) {
    showResult('error', '请输入邀请码', '请填写推荐人的邀请码')
    return
  }
  // 不能使用自己的邀请码（前端双重校验，后端也有保护）
  const myInviteCode = apiData.value.inviteCode || ''
  if (inviteCode.value && myInviteCode && inviteCode.value.trim().toUpperCase() === myInviteCode.toUpperCase()) {
    showResult('error', '邀请码错误', '不能使用自己的邀请码，请填写推荐人的邀请码')
    return
  }
  if (selectedTiers.value.length === 0) {
    showResult('error', '请选择档位', '至少选择一个档位')
    return
  }
  if (multiTotalCost.value > currentBalance.value) {
    showActivateDialog.value = false
    showPartnerServiceDialog.value = true
    loadTeamServicePartners()
    return
  }

  isProcessing.value = true
  showActivateDialog.value = false

  try {
    const result = await apiRequest('/subscription/activate-multi', {
      method: 'POST',
      body: {
        userId: currentUserId.value,
        planTypes: selectedTiers.value,
        inviteCode: inviteCode.value || undefined,
        payMethod: activatePayMethod.value
      }
    })

    if (result.code === 200) {
      const tierName = result.data?.highestTierName || selectedTiers.value[selectedTiers.value.length - 1]
      showResult('success', '🎉 激活成功！', `恭喜您成为${tierName}会员！`)
      inviteCode.value = ''
      selectedTiers.value = []
      await loadUserDataFromApi()
    } else {
      showResult('error', '激活失败', result.message || '请稍后重试')
    }
  } catch (err) {
    showResult('error', '激活失败', err.message)
  } finally {
    setTimeout(() => { isProcessing.value = false }, 2000)
  }
}

// ==================== 直推分润相关方法 ====================

// 加载直推分润状态
const loadPartnerInfo = async () => {
  try {
    const uid = currentUserId.value
    if (!uid) return
    const res = await apiRequest(`/partner/direct-push-status?userId=${uid}`)
    if (res.code === 200) {
      dpStatus.value = { ...dpStatus.value, ...res.data }
    }
  } catch (e) {
    console.error('加载直推分润状态失败:', e)
  }
}

// ==================== 生命周期 ====================

onMounted(async () => {
  // 立即显示页面
  isDataLoaded.value = true

  // 根据 URL 参数设置当前导航
  if (route.query.nav) {
    activeNav.value = route.query.nav
  }

  // 先加载后端真实数据，再加载衍生数据
  await loadUserDataFromApi()
  loadDividendStatus()
  loadPartnerInfo()
  loadPintuanData()
  startPtCountdown()

  // 追踪共富模型查看次数（用于新人拼团券条件，每次进入页面计一次，最多计2次有效）
  if (!modelViewTracked && currentUserId.value) {
    modelViewTracked = true
    apiRequest('/pintuan/track-model-view', 'POST', {}).catch(() => {})
  }
})

// 🔄 页面重新激活时自动刷新（从其它页面回来）
onActivated(() => {
  loadUserDataFromApi()
})

// 🔄 激活状态变化 → 重新拉取数据（激活后模型立刻更新）
watch(() => userStore.isActivated, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    loadUserDataFromApi()
  }
})

// 🔄 全局余额变化 → 同步到本地（转账后立刻反映）
watch(() => userStore.balance, (newBal) => {
  if (Math.abs(newBal - (apiData.value.balance || 0)) > 0.001) {
    apiData.value = { ...apiData.value, balance: newBal }
  }
})

// 监听路由参数变化，支持页面内切换
watch(() => route.query.nav, (newNav) => {
  if (newNav) {
    activeNav.value = newNav
  }
})

// 监听activeNav变化，当切换到合伙人/直推分润页面时刷新数据
watch(activeNav, (newNav) => {
  if (newNav === 'partner') loadPartnerInfo()
  if (newNav === 'hehuo') loadHehuoStatus()
  if (newNav === 'pintuan') loadPintuanData()
})
</script>

<style scoped>
/* ==================== 刷新按钮 ==================== */
.refresh-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid #E0E0E0;
  border-radius: 20px;
  background: #fff;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.refresh-icon-btn:hover { background: #F5F5F5; color: #333; border-color: #CCC; }
.refresh-icon-btn.spinning svg { animation: spin 1s linear infinite; }
.section-refresh-row {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px 0;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

.team-container {
  display: flex;
  min-height: 100vh;
  height: 100%;
  background: #F5F5F5;
}

/* 左侧彩色导航栏 */
.side-nav {
  width: 70px;
  background: #FFFFFF;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  overflow-y: auto;
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

.nav-item.active {
  background: rgba(16, 174, 255, 0.08);
}

.nav-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.nav-item:hover .nav-icon {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.nav-icon span {
  font-size: 20px;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
}

.nav-label {
  font-size: 10px;
  color: #666;
  text-align: center;
  line-height: 1.2;
  word-break: break-all;
}

.nav-item.active .nav-label {
  color: #10AEFF;
  font-weight: 500;
}

/* 右侧内容区域 */
.content-area {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

/* 页面头部 */
.page-header {
  margin-bottom: 16px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #000;
  margin-bottom: 12px;
  text-align: center;
}

/* 模型切换 */
.model-switch {
  display: flex;
  background: #FFF;
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
}

.switch-btn {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: all 0.2s;
}

.switch-btn.active {
  background: linear-gradient(135deg, #F7B500 0%, #FFC700 100%);
  color: #FFF;
}

.model-bonus {
  font-size: 11px;
  opacity: 0.8;
}

/* 余额卡片 */
.balance-card {
  background: #FFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.balance-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.balance-type {
  font-size: 12px;
  color: #F7B500;
  background: rgba(247, 181, 0, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

/* 简化版余额显示 */
.balance-main {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  padding: 20px 0;
}

.balance-amount-large {
  font-size: 48px;
  font-weight: 700;
  color: #F7B500;
  line-height: 1;
}

.balance-unit {
  font-size: 16px;
  color: #999;
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.balance-item {
  background: #F9F9F9;
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}

.balance-item.main {
  background: linear-gradient(135deg, rgba(247, 181, 0, 0.1) 0%, rgba(255, 199, 0, 0.05) 100%);
}

.balance-label {
  font-size: 11px;
  color: #999;
  display: block;
  margin-bottom: 4px;
}

.balance-value {
  font-size: 16px;
  font-weight: 600;
  color: #F7B500;
}

.balance-value.success {
  color: #07C160;
}

.balance-value.locked {
  color: #999;
}

/* ✅ 今日收益横幅 */
.today-earnings-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: linear-gradient(135deg, #FFD89B 0%, #FF9A76 100%);
  padding: 16px 20px;
  border-radius: 12px;
  margin: 16px 0;
  box-shadow: 0 4px 12px rgba(255, 154, 118, 0.3);
}

.today-earnings-banner .earnings-icon {
  font-size: 24px;
}

.today-earnings-banner .earnings-label {
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
}

.today-earnings-banner .earnings-amount {
  font-size: 28px;
  font-weight: 700;
}

.today-earnings-banner .earnings-unit {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* 收益预估 */
.activate-guide-tip {
  background: linear-gradient(135deg, #FFFDE7 0%, #FFF8CC 100%);
  border: 1px solid rgba(247, 181, 0, 0.45);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #7a5500;
  font-weight: 500;
  text-align: center;
  letter-spacing: 0.2px;
}

/* 操作按钮 */
.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.action-btn {
  padding: 12px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.action-btn.transfer {
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
  color: #FFF;
}

.action-btn.activate {
  background: linear-gradient(135deg, #F7B500 0%, #FFC700 100%);
  color: #FFF;
}

.action-btn.full-width {
  flex: 1;
  width: 100%;
}

.action-btn:disabled {
  background: #E0E0E0;
  color: #999;
  cursor: not-allowed;
}

.action-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-icon {
  font-size: 16px;
}

/* ==================== 身份状态卡片 ==================== */

.identity-card {
  background: #FFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 2px solid rgba(247, 181, 0, 0.2);
  transition: all 0.3s ease;
}

.identity-card.completed {
  border-color: rgba(7, 193, 96, 0.3);
  background: linear-gradient(135deg, rgba(7, 193, 96, 0.03) 0%, #FFF 100%);
}

.identity-card.slippage {
  border-color: rgba(247, 181, 0, 0.3);
  background: linear-gradient(135deg, rgba(247, 181, 0, 0.03) 0%, #FFF 100%);
}

.identity-card.self {
  border-color: rgba(16, 174, 255, 0.3);
  background: linear-gradient(135deg, rgba(16, 174, 255, 0.03) 0%, #FFF 100%);
}

.identity-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.identity-icon {
  font-size: 32px;
}

.identity-info {
  flex: 1;
}

.identity-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.identity-subtitle {
  font-size: 12px;
  color: #999;
}

.identity-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.identity-badge.pending {
  background: #F5F5F5;
  color: #999;
}

.identity-badge.active {
  background: rgba(247, 181, 0, 0.15);
  color: #F7B500;
}

.identity-badge.landlord {
  background: linear-gradient(135deg, #07C160, #06AD56);
  color: #FFF;
}

.identity-badge.warning {
  background: linear-gradient(135deg, #FF6B6B, #FF5252);
  color: #FFF;
  animation: pulse-badge 1s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* 贡献进度 */
.contribution-section {
  background: #FAFAFA;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}

.contribution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.contribution-label {
  font-size: 13px;
  color: #666;
}

.contribution-value {
  font-size: 14px;
  font-weight: 600;
  color: #F7B500;
}

.contribution-bar {
  height: 6px;
  background: #E8E8E8;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.contribution-fill {
  height: 100%;
  background: linear-gradient(90deg, #F7B500 0%, #07C160 100%);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.contribution-hint {
  font-size: 12px;
  color: #666;
  text-align: center;
}

.contribution-hint.warning {
  color: #FF6B6B;
  font-weight: 500;
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 已完成贡献 */
.contribution-done {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(7, 193, 96, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.done-icon {
  font-size: 18px;
}

.done-text {
  font-size: 13px;
  color: #07C160;
  font-weight: 500;
}

/* 出局方式 */
.exit-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid #F0F0F0;
}

.exit-label {
  font-size: 12px;
  color: #999;
}

.exit-type {
  flex: 1;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  text-align: center;
}

.exit-type.slippage {
  background: rgba(247, 181, 0, 0.1);
  color: #F7B500;
}

.exit-type.self {
  background: rgba(16, 174, 255, 0.1);
  color: #10AEFF;
}

/* 团队卡片 */
.team-card {
  background: #FFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.team-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.stat-item {
  background: #F9F9F9;
  border-radius: 12px;
  padding: 14px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-icon {
  font-size: 20px;
  display: block;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  display: block;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 11px;
  color: #999;
}

/* 团队数据邀请码区域 */
.team-invite-section {
  margin-top: 14px;
  background: #FFFBEF;
  border: 1px solid #FFE082;
  border-radius: 12px;
  padding: 14px 16px;
}
.team-invite-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
  text-align: center;
}
.team-invite-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 6px;
}
.team-invite-code {
  font-size: 24px;
  font-weight: 800;
  color: #E65100;
  letter-spacing: 3px;
}
.team-invite-copy {
  background: #F7B500;
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.team-invite-usage {
  font-size: 11px;
  color: #888;
  text-align: center;
}

/* 快捷入口 */
.quick-links {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.link-item {
  background: #FFF;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.link-item:hover {
  background: #FAFAFA;
}

.link-icon {
  font-size: 20px;
}

.link-text {
  font-size: 14px;
  color: #333;
}

/* 弹窗 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.dialog-box {
  background: #FFF;
  border-radius: 16px;
  width: 100%;
  max-width: 360px;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #F0F0F0;
}

.dialog-header h3 {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #F5F5F5;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #666;
}

.dialog-body {
  padding: 16px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 12px;
  background: #F9F9F9;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #F7B500;
}

.form-hint {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.transfer-tip {
  background: rgba(247, 181, 0, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.dialog-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #F0F0F0;
}

.btn {
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn.cancel {
  background: #F5F5F5;
  color: #666;
}

.btn.confirm {
  background: linear-gradient(135deg, #F7B500 0%, #FFC700 100%);
  color: #FFF;
}

/* ==================== 模型可视化 ==================== */

.model-card {
  background: #FFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 2px solid rgba(247, 181, 0, 0.2);
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.model-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.model-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.model-badge.landlord {
  background: linear-gradient(135deg, #07C160, #06AD56);
  color: #FFF;
}

.model-badge.pending {
  background: linear-gradient(135deg, #F7B500, #FFC700);
  color: #FFF;
}

/* 模型图表 */
.model-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

/* 位置盒子 */
.position-box {
  width: 100%;
  max-width: 200px;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

/* A位：收租位 */
.position-a {
  background: linear-gradient(135deg, rgba(247, 181, 0, 0.15) 0%, rgba(255, 199, 0, 0.1) 100%);
  border: 2px solid rgba(247, 181, 0, 0.4);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 15px rgba(247, 181, 0, 0.2);
  }
  50% {
    box-shadow: 0 0 25px rgba(247, 181, 0, 0.4);
  }
}

/* 光晕效果 */
.position-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    from 0deg,
    transparent,
    rgba(247, 181, 0, 0.1),
    transparent,
    rgba(247, 181, 0, 0.1),
    transparent
  );
  animation: rotate-glow 4s linear infinite;
}

@keyframes rotate-glow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.position-content {
  position: relative;
  z-index: 1;
}

/* B位：临时位 */
.position-b {
  background: #F9F9F9;
  border: 2px dashed #E0E0E0;
  animation: slide-in 0.5s ease-out;
}

.position-b.has-user {
  border-color: #07C160;
  background: rgba(7, 193, 96, 0.05);
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.position-label {
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
}

.position-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F7B500, #FFC700);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
  animation: avatar-bounce 2s ease-in-out infinite;
}

.position-b .position-avatar {
  background: linear-gradient(135deg, #E0E0E0, #BDBDBD);
}

.position-b.has-user .position-avatar {
  background: linear-gradient(135deg, #07C160, #06AD56);
}

@keyframes avatar-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.avatar-icon {
  font-size: 24px;
}

.position-user {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.position-desc {
  font-size: 11px;
  color: #999;
}

.position-invite {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0;
  justify-content: center;
}

.invite-code-text {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.invite-copy-btn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid #F7B500;
  border-radius: 10px;
  background: transparent;
  color: #F7B500;
  cursor: pointer;
  font-weight: 600;
}

/* 连接线 */
.connection-line {
  width: 3px;
  height: 40px;
  background: linear-gradient(to bottom, #F7B500, #E0E0E0);
  position: relative;
  margin: 8px 0;
  border-radius: 2px;
  overflow: hidden;
}

.line-flow {
  position: absolute;
  top: -100%;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, transparent, rgba(247, 181, 0, 0.8), transparent);
  animation: flow-down 1.5s ease-in-out infinite;
}

@keyframes flow-down {
  0% { top: -100%; }
  100% { top: 100%; }
}

.line-arrow {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #F7B500;
  animation: arrow-bounce 1s ease-in-out infinite;
}

@keyframes arrow-bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(3px); }
}

/* 等待队列 */
.waiting-queue {
  margin-top: 16px;
  text-align: center;
  animation: fade-in 0.5s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.queue-label {
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
}

.queue-dots {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

.queue-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #F7B500;
  animation: dot-pulse 1.5s ease-in-out infinite;
}

.queue-dot:nth-child(2) { animation-delay: 0.2s; }
.queue-dot:nth-child(3) { animation-delay: 0.4s; }
.queue-dot:nth-child(4) { animation-delay: 0.6s; }
.queue-dot:nth-child(5) { animation-delay: 0.8s; }

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

.queue-more {
  font-size: 11px;
  color: #999;
  margin-left: 4px;
}

/* 模型说明 */
.model-tips {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #F0F0F0;
}

.tip-item {
  font-size: 12px;
  color: #666;
  padding: 4px 0;
  line-height: 1.5;
}

/* ==================== 每日分红卡片 ==================== */

.dividend-card {
  background: #FFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 2px solid rgba(247, 181, 0, 0.15);
  transition: all 0.3s ease;
}

.dividend-card.qualified {
  border-color: rgba(7, 193, 96, 0.3);
  background: linear-gradient(135deg, rgba(7, 193, 96, 0.02) 0%, #FFF 100%);
}

.dividend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.dividend-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.dividend-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.dividend-badge.active {
  background: linear-gradient(135deg, #07C160, #06AD56);
  color: #FFF;
}

.dividend-badge.pending {
  background: #F5F5F5;
  color: #999;
}

/* 分红资格进度 */
.dividend-progress {
  background: #FAFAFA;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 16px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-label {
  font-size: 13px;
  color: #666;
}

.progress-value {
  font-size: 14px;
  font-weight: 600;
  color: #F7B500;
}

.progress-bar-wrapper {
  margin-bottom: 10px;
}

.progress-bar-track {
  height: 8px;
  background: #E8E8E8;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #F7B500 0%, #07C160 100%);
  border-radius: 4px;
  transition: width 0.5s ease;
  position: relative;
}

.progress-bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-hint {
  font-size: 12px;
  color: #999;
  text-align: center;
}

.progress-hint strong {
  color: #F7B500;
}

.progress-hint.success {
  color: #07C160;
  font-weight: 500;
}

/* 分红统计 */
.dividend-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.dividend-stat {
  background: #F9F9F9;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dividend-stat.highlight {
  background: linear-gradient(135deg, rgba(247, 181, 0, 0.1) 0%, rgba(255, 199, 0, 0.05) 100%);
  border: 1px solid rgba(247, 181, 0, 0.2);
}

.dividend-stat .stat-icon {
  font-size: 18px;
}

.dividend-stat .stat-label {
  font-size: 11px;
  color: #999;
}

.dividend-stat .stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.dividend-stat .stat-value.gold {
  color: #F7B500;
}

/* 分红说明 */
.dividend-tips {
  background: rgba(247, 181, 0, 0.05);
  border-radius: 8px;
  padding: 10px 12px;
}

.dividend-tips .tip-item {
  font-size: 11px;
  color: #666;
  padding: 3px 0;
  line-height: 1.5;
}

/* 分红操作按钮 */
.dividend-actions {
  margin-top: 12px;
}

.dividend-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: linear-gradient(135deg, #F7B500 0%, #FFC700 100%);
  color: #FFF;
  transition: all 0.2s;
}

.dividend-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(247, 181, 0, 0.3);
}

/* 激活弹窗样式 */
.activate-dialog {
  max-width: 360px;
}

/* 档位网格：3列 */
.tier-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.tier-card {
  position: relative;
  border: 2px solid #E8E8E8;
  border-radius: 12px;
  padding: 10px 6px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.18s ease;
  background: #FAFAFA;
  user-select: none;
}

.tier-card:active {
  transform: scale(0.96);
}

.tier-card.selected {
  border-color: #10AEFF;
  background: linear-gradient(135deg, #E8F6FF 0%, #D0EEFF 100%);
}

.tier-card.activated {
  border-color: #C8E6C9;
  background: #F1F8E9;
  cursor: default;
  opacity: 0.7;
}

.tier-badge {
  font-size: 9px;
  background: linear-gradient(135deg, #FF6B9D, #C44569);
  color: #fff;
  border-radius: 4px;
  padding: 1px 4px;
  display: inline-block;
  margin-bottom: 4px;
}

.tier-card:nth-child(1) .tier-badge { background: linear-gradient(135deg, #90A4AE, #607D8B); }
.tier-card:nth-child(3) .tier-badge { background: linear-gradient(135deg, #FFB300, #FF8F00); }
.tier-card:nth-child(4) .tier-badge { background: linear-gradient(135deg, #42A5F5, #1976D2); }
.tier-card:nth-child(5) .tier-badge { background: linear-gradient(135deg, #7E57C2, #512DA8); }
.tier-card:nth-child(6) .tier-badge { background: linear-gradient(135deg, #EF5350, #C62828); }

.tier-name {
  font-size: 12px;
  color: #555;
  margin-bottom: 2px;
}

.tier-price {
  font-size: 22px;
  font-weight: 700;
  color: #333;
  line-height: 1.2;
}

.tier-card.selected .tier-price {
  color: #10AEFF;
}

.tier-check {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 13px;
  color: #10AEFF;
  font-weight: 700;
}

.tier-activated-mark {
  font-size: 9px;
  color: #4CAF50;
  margin-top: 2px;
}

/* 合计栏 */
.tier-total-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #FFF9E6, #FFF3CC);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
}

.total-label {
  font-size: 14px;
  color: #888;
  font-weight: 500;
}

.total-amount {
  font-size: 26px;
  font-weight: 700;
  color: #F7B500;
}

.total-placeholder {
  font-size: 14px;
  color: #CCC;
  font-weight: 400;
}

/* 余额行 */
.balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.balance-hint b { color: #333; }

.balance-ok  { color: #07C160; font-weight: 500; }
.balance-warn { color: #E74C3C; font-weight: 500; }

.required {
  color: #E74C3C;
  font-size: 11px;
  margin-left: 2px;
}

.activate-tip {
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-top: 12px;
}

.activate-tip.warning {
  background: rgba(231, 76, 60, 0.1);
  color: #E74C3C;
}

.activate-tip.success {
  background: rgba(7, 193, 96, 0.1);
  color: #07C160;
}

/* 分润卡片 */
.profit-card {
  background: linear-gradient(135deg, #F0FFF4 0%, #E6FFED 100%);
  border: 1.5px solid #A8E6C4;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.profit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.profit-title {
  font-size: 14px;
  font-weight: 600;
  color: #1A7F45;
}

.profit-rate-badge {
  background: linear-gradient(135deg, #07C160, #06AD56);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
}

.profit-body {
  margin-bottom: 12px;
}

.profit-balance-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.profit-balance-label {
  font-size: 13px;
  color: #555;
}

.profit-balance-val {
  font-size: 26px;
  font-weight: 700;
  color: #07C160;
}

.profit-calc-hint {
  font-size: 11px;
  color: #999;
}

.profit-claim-btn {
  width: 100%;
  padding: 11px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #07C160, #06AD56);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.profit-claim-btn:disabled {
  background: #CCC;
  cursor: not-allowed;
}

/* 结果反馈弹窗 */
.result-dialog {
  text-align: center;
  padding: 30px 24px;
  max-width: 300px;
}

.result-dialog .result-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.result-dialog .result-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.result-dialog .result-message {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
}

.result-dialog.success .result-title {
  color: #07C160;
}

.result-dialog.error .result-title {
  color: #E74C3C;
}

.result-dialog .btn.confirm {
  width: 100%;
  padding: 14px;
  font-size: 16px;
}

/* 采购补贴样式 */
.subsidy-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}

.subsidy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.subsidy-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.subsidy-badge {
  padding: 4px 10px;
  background: linear-gradient(135deg, #F43F5E, #E11D48);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
}

.subsidy-balance {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.subsidy-balance .balance-box {
  flex: 1;
  background: linear-gradient(135deg, #FFF0F3, #FFE5EA);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.subsidy-balance .balance-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.subsidy-balance .balance-amount {
  font-size: 24px;
  font-weight: 700;
  color: #F43F5E;
  margin-bottom: 4px;
}

.subsidy-balance .balance-percent {
  font-size: 11px;
  color: #999;
  background: rgba(0,0,0,0.05);
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-block;
}

.subsidy-balance .balance-hint {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.subsidy-transfer-btn {
  margin-top: 8px;
  width: 100%;
  padding: 6px 0;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #27ae60, #2ecc71);
  color: #fff;
  transition: opacity 0.2s;
}
.subsidy-transfer-btn:disabled {
  background: #ddd;
  color: #aaa;
  cursor: not-allowed;
}

.subsidy-features {
  background: #F9F9F9;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.subsidy-features .feature-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.subsidy-features .feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.subsidy-features .feature-item:last-child {
  border-bottom: none;
}

.subsidy-features .feature-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.subsidy-features .feature-content {
  flex: 1;
}

.subsidy-features .feature-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.subsidy-features .feature-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.subsidy-actions {
  margin-bottom: 16px;
}

.subsidy-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #F43F5E, #E11D48);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.subsidy-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(244, 63, 94, 0.3);
}

.subsidy-btn:active {
  transform: translateY(0);
}

/* 帮扶收益汇总卡 */
.help-balance-card {
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(135deg, #FFF8E1, #FFF3CD);
  border: 1px solid #FFD54F; border-radius: 12px; padding: 12px 14px; gap: 10px;
}
.help-balance-left { display: flex; align-items: center; gap: 8px; flex: 1; }
.help-balance-icon { font-size: 24px; flex-shrink: 0; }
.help-balance-title { font-size: 13px; font-weight: 700; color: #E65100; }
.help-balance-hint { font-size: 10px; color: #999; margin-top: 1px; }
.help-balance-right { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
.help-balance-label { font-size: 10px; color: #999; }
.help-balance-val { font-size: 16px; font-weight: 700; color: #E65100; }

/* 两类帮扶卡片网格 */
.help-types-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.help-type-card {
  background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 10px; padding: 10px 12px;
}
.help-type-card--pintuan { background: #FFF0F5; border-color: #FFB3CC; }
.help-type-header { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.help-type-icon { font-size: 16px; }
.help-type-name { font-size: 12px; font-weight: 700; color: #1a1a2e; flex: 1; }
.help-type-chip {
  font-size: 11px; font-weight: 700; color: white;
  background: #14B8A6; border-radius: 8px; padding: 1px 6px;
}
.help-type-card--pintuan .help-type-chip { background: #F43F5E; }
.help-type-body { display: flex; flex-direction: column; gap: 3px; }
.help-type-trigger { font-size: 10px; color: #888; }
.help-type-rule { font-size: 11px; color: #555; }
.help-type-max { font-size: 11px; color: #E65100; margin-top: 2px; }
.help-type-card--pintuan .help-type-max { color: #F43F5E; }

/* 参团支付弹窗 */
.pay-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9999;
  display: flex; align-items: flex-end; justify-content: center;
}
.pay-modal {
  background: white; border-radius: 16px 16px 0 0; padding: 20px;
  width: 100%; max-width: 480px; animation: slideUp 0.2s ease;
}
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.pay-modal-title { font-size: 16px; font-weight: 700; color: #1a1a2e; text-align: center; }
.pay-modal-subtitle { font-size: 13px; color: #999; text-align: center; margin: 4px 0 14px; }
.pay-options { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.pay-option {
  border: 2px solid #E9ECEF; border-radius: 10px; padding: 12px;
  cursor: pointer; transition: border-color 0.2s;
}
.pay-option.selected { border-color: #14B8A6; background: #F0FDFB; }
.pay-option input { display: none; }
.pay-opt-body { display: flex; justify-content: space-between; align-items: center; }
.pay-opt-name { font-size: 14px; font-weight: 600; color: #1a1a2e; }
.pay-opt-val { font-size: 14px; font-weight: 700; color: #14B8A6; }
.pay-opt-hint { font-size: 11px; color: #999; margin-top: 4px; }
.pay-modal-btns { display: flex; gap: 10px; }
.pay-cancel-btn { flex: 1; padding: 12px; border: 1px solid #E9ECEF; border-radius: 10px; background: white; font-size: 14px; color: #666; cursor: pointer; }
.pay-confirm-btn { flex: 2; padding: 12px; border: none; border-radius: 10px; background: #FF6B35; font-size: 14px; font-weight: 700; color: white; cursor: pointer; }

/* 拼团券卡片 */
.voucher-info-card {
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(135deg, #FFF7E6, #FFF3CC);
  border: 1px solid #F59E0B; border-radius: 10px;
  padding: 10px 14px; margin: 10px 0 6px;
}
.voucher-info-left { display: flex; align-items: center; gap: 8px; }
.voucher-info-icon { font-size: 20px; }
.voucher-info-text { font-size: 14px; color: #92400E; }
.voucher-info-text b { color: #D97706; font-size: 16px; }
.voucher-info-actions { display: flex; gap: 8px; }
.voucher-btn-buy, .voucher-btn-transfer {
  padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none;
}
.voucher-btn-buy { background: #FF6B35; color: white; }
.voucher-btn-transfer { background: white; color: #FF6B35; border: 1px solid #FF6B35; }
/* 购买/转赠弹窗内部 */
.voucher-buy-row { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0 6px; }
.voucher-qty-btn {
  width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid #FF6B35;
  background: white; color: #FF6B35; font-size: 20px; cursor: pointer; line-height: 1;
}
.voucher-qty-num { font-size: 18px; font-weight: 700; color: #1a1a2e; min-width: 50px; text-align: center; }
.voucher-buy-total { font-size: 13px; color: #666; text-align: center; }

/* 激活支付方式选择 */
.activate-pay-select { padding: 10px 0 4px; border-top: 1px solid #F0F0F0; margin-top: 4px; }
.activate-pay-label { font-size: 12px; color: #999; margin-bottom: 8px; }
.activate-pay-options { display: flex; gap: 8px; }
.activate-pay-opt {
  flex: 1; border: 2px solid #E9ECEF; border-radius: 8px; padding: 8px 10px;
  cursor: pointer; font-size: 12px; transition: border-color 0.2s;
}
.activate-pay-opt.selected { border-color: #14B8A6; background: #F0FDFB; }
.activate-pay-opt input { display: none; }

.subsidy-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subsidy-rules .rule-item {
  font-size: 13px;
  color: #666;
  padding: 6px 0;
}

/* 全球贡献奖励样式 */
.contribution-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}

.contribution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.contribution-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.contribution-badge {
  padding: 4px 10px;
  background: linear-gradient(135deg, #F7B500, #FFC700);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
}

.contribution-balance {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.balance-box {
  flex: 1;
  background: linear-gradient(135deg, #FFF8E7, #FFF3D0);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.balance-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.balance-amount {
  font-size: 24px;
  font-weight: 700;
  color: #F7B500;
  margin-bottom: 4px;
}

.balance-percent {
  font-size: 11px;
  color: #999;
  background: rgba(0,0,0,0.05);
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-block;
}

.contribution-features {
  background: #F9F9F9;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.feature-item:last-child {
  border-bottom: none;
}

.feature-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.feature-content {
  flex: 1;
}

.feature-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.feature-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.contribution-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contribution-rules .rule-item {
  font-size: 13px;
  color: #666;
  padding: 6px 0;
}

/* ==================== 合伙人样式 ==================== */

.partner-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 出局分润紧凑卡片 */
.dp-mini-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F5F5F5;
  border-radius: 12px;
  padding: 12px 14px;
  gap: 10px;
}
.dp-mini-card.dp-mini-active {
  background: linear-gradient(135deg, #E0F7F4 0%, #B2EBE5 100%);
  border: 1px solid #14B8A6;
}
.dp-mini-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.dp-mini-icon {
  font-size: 24px;
  flex-shrink: 0;
}
.dp-mini-tier {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dp-mini-tier-name {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a2e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dp-mini-card.dp-mini-active .dp-mini-tier-name {
  color: #0D9488;
}
.dp-mini-desc {
  font-size: 11px;
  color: #888;
  margin-top: 1px;
}
.dp-mini-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}
.dp-mini-earn-label {
  font-size: 10px;
  color: #999;
}
.dp-mini-earn-val {
  font-size: 15px;
  font-weight: 700;
  color: #E65100;
}
.dp-mini-card.dp-mini-active .dp-mini-earn-val {
  color: #0D9488;
}

/* （旧 badge 样式保留兼容，已不使用） */
.badge-status.active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

/* 资格进度 */
.partner-progress {
  background: white;
  padding: 20px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.progress-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: 14px;
  color: #666;
}

.progress-value {
  font-size: 16px;
  font-weight: 700;
  color: #14B8A6;
}

.progress-hint {
  font-size: 13px;
  color: #999;
  text-align: center;
}

.progress-hint strong {
  color: #14B8A6;
  font-weight: 700;
}

/* 微信二维码 */
/* 微信联系方式 */
.partner-contact {
  background: white;
  padding: 16px;
  border-radius: 16px;
}

.contact-header {
  margin-bottom: 12px;
}

.contact-title {
  font-size: 15px;
  font-weight: 600;
  color: #2C3E50;
}

.contact-display {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0fff4;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.wechat-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.wechat-num {
  flex: 1;
  font-size: 14px;
  color: #333;
  min-width: 0;
  word-break: break-all;
}

.copy-wechat-btn {
  padding: 5px 14px;
  background: #1677ff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}

.change-contact-btn {
  padding: 5px 10px;
  background: none;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 12px;
  color: #888;
  cursor: pointer;
  flex-shrink: 0;
}

.contact-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.contact-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.contact-input:focus {
  border-color: #14B8A6;
}

.save-contact-btn {
  padding: 8px 16px;
  background: #14B8A6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.save-contact-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.contact-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* 分红统计 */
.partner-dividend-stats {
  background: white;
  padding: 20px;
  border-radius: 16px;
}

.stats-header {
  margin-bottom: 16px;
}

.stats-title {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-box {
  background: #F9F9F9;
  padding: 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-box.highlight {
  background: linear-gradient(135deg, #FFF8E7 0%, #FFE082 100%);
}

.stat-label {
  font-size: 13px;
  color: #666;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #2C3E50;
}

.stat-value.gold {
  color: #F7B500;
}

/* 分红说明 */
/* 直推分润 — sub progress */
.dp-sub-progress {
  margin-top: 12px;
  padding: 10px 0;
  border-top: 1px dashed #E0E0E0;
}
.sub-progress-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  font-size: 12px;
}
.sub-label { color: #888; width: 36px; flex-shrink: 0; }
.sub-val   { color: #333; width: 52px; text-align: right; flex-shrink: 0; }
.fill-green { background: linear-gradient(90deg, #22c55e, #16a34a) !important; }
.pool-badge {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.partner-dividend-info {
  background: white;
  padding: 20px;
  border-radius: 16px;
}

.info-header {
  margin-bottom: 16px;
}

.info-title {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
}

.exit-rule-block {
  margin-bottom: 18px;
  background: #F8FAFC;
  border-radius: 12px;
  padding: 14px 16px;
}
.exit-rule-block-title {
  font-size: 14px;
  font-weight: 700;
  color: #1A3A50;
  margin-bottom: 4px;
}
.exit-rule-desc {
  font-size: 12px;
  color: #888;
  margin-bottom: 10px;
}
.exit-level-table {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #E8EEF4;
  margin-bottom: 10px;
  font-size: 12px;
}
.exit-level-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  background: #EBF4FB;
  padding: 6px 10px;
  font-weight: 700;
  color: #4A6A80;
}
.exit-level-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 5px 10px;
  border-top: 1px solid #F0F4F8;
  color: #555;
  transition: background 0.2s;
}
.exit-level-row.row-active {
  background: #E8F4FB;
  color: #0BBAC8;
  font-weight: 700;
}
.exit-global-tiers {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.exit-global-tier {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: #fff;
  border-radius: 10px;
  border: 1.5px solid #E8EEF4;
  font-size: 13px;
}
.exit-global-tier.tier-active {
  border-color: #0BBAC8;
  background: #E8F8FA;
}
.tier-exit { color: #555; flex: 1; }
.tier-rate { color: #1A3A50; font-weight: 600; flex: 1; }
.tier-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}
.tag-gold   { background: #FFF8E1; color: #E65100; }
.tag-purple { background: #F5F0FF; color: #7C3AED; }
.tag-blue   { background: #EBF4FB; color: #1565C0; }
.tag-green  { background: #E8F5E9; color: #2E7D32; }
.exit-rule-example {
  font-size: 12px;
  color: #666;
  background: #FFFBF0;
  border-radius: 8px;
  padding: 8px 12px;
  line-height: 1.7;
  border-left: 3px solid #FFB300;
}

/* 多段进度条 */
.exit-multi-progress { margin: 10px 0; }
.exit-multi-track {
  position: relative;
  height: 10px;
  background: #E8EEF4;
  border-radius: 5px;
  margin-bottom: 4px;
}
.exit-multi-fill {
  height: 100%;
  background: linear-gradient(90deg, #0BBAC8, #7C3AED);
  border-radius: 5px;
  transition: width 0.5s ease;
}
.exit-tick {
  position: absolute;
  top: -4px;
  transform: translateX(-50%);
  width: 2px;
  height: 18px;
  background: #C0CDD8;
}
.exit-tick span {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #888;
  white-space: nowrap;
}
.exit-multi-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  font-size: 10px;
  color: #999;
  text-align: center;
  line-height: 1.3;
}

/* 团队成员列表 */
.partner-team {
  background: white;
  padding: 20px;
  border-radius: 16px;
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.team-title {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
}

.team-count {
  font-size: 14px;
  color: #14B8A6;
  font-weight: 600;
}

.team-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.team-member {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #F9F9F9;
  border-radius: 12px;
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-icon {
  font-size: 20px;
}

.member-info {
  flex: 1;
}

.member-id {
  font-size: 14px;
  font-weight: 600;
  color: #2C3E50;
}

.member-level {
  font-size: 12px;
  color: #999;
}

.member-status {
  flex-shrink: 0;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.active {
  background: #E7F9F5;
  color: #14B8A6;
}

.status-badge.inactive {
  background: #F5F5F5;
  color: #999;
}

.team-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  background: #F9F9F9;
  border-radius: 12px;
}

.view-all-btn {
  width: 100%;
  padding: 12px;
  background: #F9F9F9;
  border: none;
  border-radius: 12px;
  color: #14B8A6;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 12px;
}

.view-all-btn:hover {
  background: #E7F9F5;
}

/* 场外交易说明 */
.partner-trade-info {
  background: white;
  padding: 20px;
  border-radius: 16px;
}

.trade-header {
  margin-bottom: 16px;
}

.trade-title {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
}

.trade-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.trade-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #F9F9F9;
  border-radius: 12px;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #14B8A6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-text {
  font-size: 14px;
  color: #666;
}

.trade-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.trade-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(20, 184, 166, 0.4);
}

/* ==================== 购物金复利领取 ==================== */
.sg-claim-box {
  background: linear-gradient(135deg, #FFF8E1, #FFF3CD);
  border: 1px solid #FFD54F;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sg-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.sg-day-badge {
  font-size: 12px; font-weight: 700; color: #E65100;
  background: #FFE0B2; border-radius: 6px; padding: 2px 8px; display: inline-block;
}
.sg-rate { font-size: 12px; color: #795548; }
.sg-claim-btn {
  background: linear-gradient(135deg, #FF9800, #F57C00);
  color: white; border: none; border-radius: 8px;
  padding: 8px 14px; font-size: 13px; font-weight: 600;
  cursor: pointer; white-space: nowrap;
}
.sg-claim-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.balance-amount.gold { color: #F59E0B; font-weight: 700; }

/* ==================== 拼团补贴 ==================== */
.pt-card { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

/* 解锁横幅 */
.pt-unlock-banner { padding: 10px 14px; border-radius: 12px; font-size: 13px; font-weight: 600; line-height: 1.5; text-align: center; }
.pt-unlocked { background: linear-gradient(135deg, #E8F5E9, #C8E6C9); color: #2E7D32; border: 1.5px solid #A5D6A7; }
.pt-locked   { background: linear-gradient(135deg, #FFF8E1, #FFF3CD); color: #795548; border: 1.5px solid #FFCC80; }

/* 3档卡片 */
.pt-tiers { display: flex; flex-direction: column; gap: 10px; }
.pt-tier-item { background: #fff; border: 1.5px solid #FFD4C2; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.pt-voucher-item { border-color: #D4C2FF; }
.pt-tier-header { display: flex; justify-content: space-between; align-items: center; }
.pt-tier-name { font-size: 15px; font-weight: 800; color: #E63900; }
.pt-voucher-item .pt-tier-name { color: #6B35E6; }
.pt-tier-stat { font-size: 12px; color: #888; }
.pt-tier-meta { font-size: 12px; color: #666; }
.pt-tier-prize { font-size: 13px; color: #333; font-weight: 600; }
.pt-tier-voucher-row { font-size: 12px; color: #6B35E6; }
.pt-tier-btn { width: 100%; padding: 11px; font-size: 14px; font-weight: 700; border: none; border-radius: 12px; cursor: pointer; transition: all 0.15s; }
.pt-tier-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.cash-btn { background: linear-gradient(135deg, #FF6B35, #E63900); color: #fff; box-shadow: 0 3px 12px rgba(230,57,0,0.3); }
.voucher-btn { background: linear-gradient(135deg, #8B5CF6, #6B35E6); color: #fff; box-shadow: 0 3px 12px rgba(107,53,230,0.3); }

.pt-header { display: flex; justify-content: space-between; align-items: center; }
.pt-title { font-size: 17px; font-weight: 800; color: #E63900; }
.pt-today { font-size: 13px; color: #666; background: #FFF0EB; padding: 4px 10px; border-radius: 20px; }
.pt-today b { color: #E63900; }

.pt-timer-box { background: linear-gradient(135deg, #1a1a2e, #2d1200); border-radius: 14px; padding: 16px; text-align: center; }
.pt-timer-label { font-size: 12px; color: rgba(255,255,255,0.55); margin-bottom: 8px; }
.pt-timer { display: flex; align-items: center; justify-content: center; gap: 6px; }
.pt-digit { font-size: 36px; font-weight: 900; color: #FF6B35; background: rgba(255,255,255,0.08); border-radius: 10px; padding: 4px 12px; min-width: 56px; text-align: center; }
.pt-colon { font-size: 30px; font-weight: 900; color: #FF6B35; }
.pt-timer-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 8px; }

/* 团型标签 */
.pt-type-badge { display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #FFF5F0, #FFF0EB); border: 1.5px solid #FFD4C2; border-radius: 12px; padding: 10px 14px; }
.pt-type-only { font-size: 15px; font-weight: 800; color: #E63900; }
.pt-type-detail { font-size: 12px; color: #666; }

/* 场次进度列表 */
.pt-sessions { margin-bottom: 4px; }
.pt-sessions-title { font-size: 12px; color: #888; margin-bottom: 8px; }
.pt-session-item { display: flex; align-items: center; gap: 8px; background: #F8FAFC; border-radius: 10px; padding: 8px 12px; margin-bottom: 6px; cursor: pointer; border: 1.5px solid #EEF2F7; transition: border-color 0.15s; }
.pt-session-item:active { border-color: #FF6B35; }
.pt-session-item.session-full { opacity: 0.5; cursor: not-allowed; }
.pt-session-left { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; min-width: 80px; }
.pt-session-label { font-size: 11px; color: #888; }
.pt-session-count { font-size: 13px; font-weight: 700; color: #333; }
.pt-session-bar-wrap { flex: 1; }
.pt-session-bar { height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden; }
.pt-session-fill { height: 100%; background: linear-gradient(90deg, #FF6B35, #E63900); border-radius: 4px; transition: width 0.3s ease; }
.pt-session-need { font-size: 11px; color: #FF6B35; font-weight: 600; flex-shrink: 0; white-space: nowrap; }
.pt-session-need.full { color: #94A3B8; }
.pt-sessions-empty { text-align: center; font-size: 12px; color: #999; padding: 12px; background: #F8FAFC; border-radius: 10px; margin-bottom: 8px; }

.pt-prize-box { background: linear-gradient(135deg, #FFF5F0, #FFF0EB); border: 1.5px solid #FFD4C2; border-radius: 14px; padding: 14px; }
.pt-prize-title { font-size: 14px; font-weight: 700; color: #C0392B; margin-bottom: 10px; }
.pt-prize-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #333; margin-bottom: 7px; }
.pt-prize-row.no-win { color: #666; margin-bottom: 0; }
.pt-prize-icon { font-size: 16px; flex-shrink: 0; }
.pt-prize-row b { color: #E63900; }

.pt-join-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #FF6B35, #E63900); color: #fff; font-size: 16px; font-weight: 800; border: none; border-radius: 16px; cursor: pointer; box-shadow: 0 4px 16px rgba(230,57,0,0.35); transition: all 0.15s; letter-spacing: 0.5px; }
.pt-join-btn:active { transform: scale(0.98); }
.pt-join-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.pt-referral-box { background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 14px; padding: 14px; }
.pt-referral-title { font-size: 14px; font-weight: 700; color: #15803D; margin-bottom: 10px; }
.pt-referral-rule { font-size: 13px; color: #166534; display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.pt-referral-rule b { color: #15803D; }
.pt-referral-note { font-size: 11px; color: #4ADE80; margin-top: 4px; }
.pt-referral-eg { background: rgba(255,255,255,0.6); border-radius: 10px; padding: 10px 12px; }
.pt-eg-title { font-size: 12px; font-weight: 600; color: #15803D; margin-bottom: 6px; }
.pt-eg-row { font-size: 12px; color: #166534; margin-bottom: 3px; }
.pt-eg-num { color: #15803D; font-size: 14px; }

.pt-rules { background: #F8F8F8; border-radius: 12px; padding: 12px 14px; }
.pt-rules-title { font-size: 13px; font-weight: 700; color: #555; margin-bottom: 8px; }
.pt-rule-item { font-size: 12px; color: #666; margin-bottom: 5px; line-height: 1.5; }
.pt-rule-item b { color: #E63900; }

/* pt-waiting-bar 已移除，改为 pt-sessions 进度列表 */

.pt-auto-row { display: flex; align-items: center; }
.pt-auto-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #555; user-select: none; }
.pt-auto-label input[type="checkbox"] { width: 18px; height: 18px; accent-color: #FF6B35; cursor: pointer; }
.pt-auto-text { line-height: 1.4; }

.pt-result { display: flex; align-items: center; gap: 10px; border-radius: 14px; padding: 12px 14px; position: relative; }
.pt-result.winner { background: linear-gradient(135deg, #FFF9E6, #FFFBD0); border: 1.5px solid #F0C030; }
.pt-result.loser  { background: linear-gradient(135deg, #F0F4FF, #E8EFFF); border: 1.5px solid #C0C8FF; }
.pt-result-icon { font-size: 24px; flex-shrink: 0; }
.pt-result-msg { flex: 1; font-size: 13px; color: #333; line-height: 1.5; }
.pt-result-close { background: none; border: none; font-size: 16px; color: #999; cursor: pointer; flex-shrink: 0; padding: 0 4px; }

/* ==================== 合伙人面板 ==================== */
.hehuo-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hehuo-badge-section {
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #FEF3C7, #FDE68A);
  border-radius: 12px;
  padding: 14px;
  border: 2px solid #F59E0B;
}
.hehuo-badge-section.qualified {
  background: linear-gradient(135deg, #D1FAE5, #A7F3D0);
  border-color: #10B981;
}
.hehuo-badge-icon { font-size: 28px; }
.hehuo-badge-info { flex: 1; }
.hehuo-badge-title { font-size: 15px; font-weight: 700; color: #92400E; }
.hehuo-badge-section.qualified .hehuo-badge-title { color: #065F46; }
.hehuo-badge-sub { font-size: 12px; color: #B45309; margin-top: 3px; }
.hehuo-badge-section.qualified .hehuo-badge-sub { color: #047857; }
.hehuo-badge-status { font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 8px; white-space: nowrap; }
.hehuo-badge-status.active { background: #10B981; color: white; }
.hehuo-badge-status.pending { background: #F59E0B; color: white; }

.hehuo-progress-section {
  background: #F9FAFB;
  border-radius: 12px;
  padding: 14px;
}
.hehuo-progress-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; }
.hehuo-tiers-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.hehuo-tier-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #E5E7EB;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: #6B7280;
}
.hehuo-tier-item.activated {
  background: #D1FAE5;
  color: #065F46;
  font-weight: 600;
}
.hehuo-tier-check { font-size: 14px; }
.hehuo-tier-name { font-size: 12px; }

.hehuo-progress-bar-wrap {
  height: 8px;
  background: #E5E7EB;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}
.hehuo-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #F59E0B, #10B981);
  border-radius: 4px;
  transition: width 0.4s ease;
}
.hehuo-progress-hint { font-size: 12px; color: #6B7280; text-align: center; }

.hehuo-rights {
  background: #EFF6FF;
  border-radius: 12px;
  padding: 14px;
  border-left: 3px solid #3B82F6;
}
.hehuo-rights-title { font-size: 13px; font-weight: 700; color: #1E40AF; margin-bottom: 8px; }
.hehuo-right-item { font-size: 12px; color: #1D4ED8; line-height: 1.8; }

/* 服务商双条件 */
.sp-cond-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #F0F4F8;
}
.sp-cond-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}
.sp-cond-icon { font-size: 16px; }
.sp-cond-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 10px;
  white-space: nowrap;
}
.tag-done { background: #D1FAE5; color: #065F46; }
.tag-todo { background: #FEF3C7; color: #92400E; }

/* ===== 合伙人服务弹窗 ===== */
.partner-service-dialog {
  background: white; border-radius: 16px;
  width: 90%; max-width: 360px;
  padding: 20px; position: relative;
  max-height: 90vh; overflow-y: auto;
}
.dialog-close-btn {
  position: absolute; top: 12px; right: 12px;
  width: 28px; height: 28px; border: none;
  background: #F5F5F5; border-radius: 50%;
  font-size: 16px; color: #999; cursor: pointer;
}
.ps-title {
  font-size: 17px; font-weight: 700; color: #1565C0;
  margin-bottom: 4px; margin-top: 4px;
}
.ps-subtitle {
  font-size: 12px; color: #F44336; margin-bottom: 14px;
}
.ps-loading {
  text-align: center; color: #999; padding: 16px;
}
.ps-list { display: flex; flex-direction: column; gap: 10px; }
.ps-item {
  display: flex; align-items: center; justify-content: space-between;
  background: #F0F7FF; border-radius: 10px; padding: 12px;
}
.ps-info { display: flex; flex-direction: column; gap: 3px; }
.ps-name { font-size: 14px; font-weight: 600; color: #2C3E50; }
.ps-wechat { font-size: 13px; color: #1565C0; }
.ps-copy-btn {
  padding: 7px 14px; border: none; border-radius: 8px;
  background: #1565C0; color: white; font-size: 12px;
  cursor: pointer; flex-shrink: 0;
}
.ps-empty { text-align: center; color: #999; padding: 16px; font-size: 13px; }
.ps-tip {
  margin-top: 12px; font-size: 11px; color: #666;
  background: #FFF8E1; border-radius: 8px; padding: 10px;
  line-height: 1.6;
}
.ps-close-main-btn {
  width: 100%; margin-top: 12px; padding: 12px;
  border: none; border-radius: 10px;
  background: #E0E0E0; color: #555;
  font-size: 14px; cursor: pointer;
}

</style>
// rebuild 1775901263

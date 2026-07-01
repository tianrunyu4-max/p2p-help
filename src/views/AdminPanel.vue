<template>
  <div class="admin-panel">
    <!-- 头部 -->
    <div class="page-header">
      <button class="back-btn-header" @click="goBack">←</button>
      <h1 class="page-title">👑 管理后台</h1>
      <div class="admin-badge">平台主专用</div>
    </div>

    <!-- 顶部 2行×5列 分类网格 -->
    <div class="admin-tab-grid">
      <button
        v-for="tab in adminTabs"
        :key="tab.value"
        class="grid-tab"
        :class="{ 'grid-tab-active': activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        <span class="grid-tab-icon">{{ tab.icon }}</span>
        <span class="grid-tab-text">{{ tab.label }}</span>
      </button>
    </div>

    <!-- 内容区域（全宽） -->
    <div class="main-body">
      <div class="admin-content">
        <!-- 用户管理 -->
        <div v-if="activeTab === 'users'" class="content-section">
          <div class="section-title-row">
            <span>👥 用户管理</span>
            <button class="refresh-btn" @click="loadAllUsers" :disabled="usersLoading">
              {{ usersLoading ? '加载中...' : '🔄 刷新' }}
            </button>
          </div>

          <!-- 统计 4格 -->
          <div class="stats-4grid">
            <div class="stat4-card">
              <div class="stat4-num">{{ userStats.total }}</div>
              <div class="stat4-lbl">总用户</div>
            </div>
            <div class="stat4-card green">
              <div class="stat4-num">{{ userStats.activated }}</div>
              <div class="stat4-lbl">已激活</div>
            </div>
            <div class="stat4-card gray">
              <div class="stat4-num">{{ userStats.inactive }}</div>
              <div class="stat4-lbl">未激活</div>
            </div>
            <div class="stat4-card gold">
              <div class="stat4-num">{{ userStats.totalBalance }}</div>
              <div class="stat4-lbl">总余额</div>
            </div>
          </div>

          <!-- 搜索和筛选 -->
          <div class="user-filter-bar">
            <input
              v-model="userSearch"
              type="text"
              placeholder="搜索ID / 昵称 / 邀请码"
              class="user-search-input"
              @input="onUserSearch"
            />
            <select v-model="userFilter" @change="onUserFilterChange" class="filter-select-sm">
              <option value="all">全部</option>
              <option value="activated">已激活</option>
              <option value="inactive">未激活</option>
            </select>
          </div>

          <!-- 用户卡片列表 -->
          <div class="user-card-list">
            <div v-if="usersLoading" class="loading-tip">加载中...</div>
            <div v-else-if="allUsers.length === 0" class="empty-state">暂无用户数据</div>
            <div
              v-for="user in allUsers"
              :key="user.id"
              class="user-item-card"
              @click="viewUserDetail(user)"
            >
              <!-- 左侧头像 -->
              <div class="uic-avatar" :class="user.is_active ? 'active' : 'inactive'">
                {{ (user.username || user.id || '?').toString()[0].toUpperCase() }}
              </div>
              <!-- 中间信息 -->
              <div class="uic-body">
                <div class="uic-top">
                  <span class="uic-id">{{ user.id }}</span>
                  <span v-if="user.username" class="uic-nick">{{ user.username }}</span>
                  <span class="uic-tier" :class="(user.card_type || 'basic').toLowerCase()">
                    {{ user.card_type || '-' }}
                  </span>
                  <span v-if="user.is_partner" class="uic-partner">🤝合伙人</span>
                </div>
                <div class="uic-bottom">
                  <span class="uic-stat">余额 <b>{{ user.coin_balance || 0 }}</b></span>
                  <span class="uic-stat">收益 <b>{{ user.total_earnings || 0 }}</b></span>
                  <span class="uic-stat">直推 <b>{{ user.direct_push_count || 0 }}</b>人</span>
                  <span v-if="user.referrer_id" class="uic-stat uic-ref">邀请人 <b>{{ user.referrer_id }}</b></span>
                </div>
              </div>
              <!-- 右侧状态 -->
              <div class="uic-right">
                <span class="uic-status" :class="user.is_active ? 'on' : 'off'">
                  {{ user.is_active ? '已激活' : '未激活' }}
                </span>
                <span class="uic-arrow">›</span>
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div class="pagination" v-if="userPagination.totalPages > 1">
            <button class="page-btn" :disabled="userCurrentPage === 1" @click="goToUserPage(userCurrentPage - 1)">上一页</button>
            <span class="page-info">{{ userCurrentPage }}/{{ userPagination.totalPages }}页 ({{ userPagination.total }}条)</span>
            <button class="page-btn" :disabled="userCurrentPage >= userPagination.totalPages" @click="goToUserPage(userCurrentPage + 1)">下一页</button>
          </div>

          <!-- 用户详情弹窗 -->
          <div v-if="selectedUser" class="modal-overlay" @click="selectedUser = null">
            <div class="user-detail-modal" @click.stop>
              <div class="modal-header">
                <h3>用户详情</h3>
                <button class="close-btn" @click="selectedUser = null">×</button>
              </div>
              <div class="detail-content">
                <!-- 加载中 -->
                <div v-if="selectedUserLoading" style="text-align:center;padding:20px;color:#999">加载中...</div>
                <template v-else>
                  <!-- 基本信息 -->
                  <div class="detail-section">
                    <div class="detail-title">基本信息</div>
                    <div class="detail-grid">
                      <div class="detail-item">
                        <span class="label">用户ID</span>
                        <span class="value">{{ selectedUser.id }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">昵称</span>
                        <span class="value">{{ selectedUser.username || '未设置' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">激活状态</span>
                        <span class="value" :class="selectedUser.is_active ? 'text-success' : 'text-warning'">
                          {{ selectedUser.is_active ? '✅ 已激活' : '⚠️ 未激活' }}
                        </span>
                      </div>
                      <div class="detail-item">
                        <span class="label">合伙人</span>
                        <span class="value" :style="selectedUser.is_partner ? 'color:#f59e0b;font-weight:bold' : ''">
                          {{ selectedUser.is_partner ? '🤝 是' : '否' }}
                        </span>
                      </div>
                      <div class="detail-item">
                        <span class="label">最高档位</span>
                        <span class="value">{{ selectedUser.card_type || '-' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">已激活档位</span>
                        <span class="value" style="display:flex;gap:4px;flex-wrap:wrap">
                          <template v-if="selectedUser.activated_types?.length">
                            <span v-for="t in selectedUser.activated_types" :key="t"
                              style="background:#e8f4fd;color:#1677ff;border-radius:4px;padding:1px 6px;font-size:11px">
                              {{ {BASIC:'V1',PREMIUM:'V2',ELITE:'V3',TIER_300:'V4',TIER_500:'V5'}[t] || t }}
                            </span>
                          </template>
                          <span v-else style="color:#999">-</span>
                        </span>
                      </div>
                      <div class="detail-item">
                        <span class="label">邀请码</span>
                        <span class="value">{{ selectedUser.invite_code || '-' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">注册时间</span>
                        <span class="value">{{ selectedUser.created_at ? selectedUser.created_at.slice(0,10) : '-' }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- 推荐人 -->
                  <div class="detail-section">
                    <div class="detail-title">邀请人</div>
                    <div v-if="selectedUserDetail?.referrer" class="detail-grid">
                      <div class="detail-item">
                        <span class="label">ID</span>
                        <span class="value">{{ selectedUserDetail.referrer.id }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">昵称</span>
                        <span class="value">{{ selectedUserDetail.referrer.username || '未设置' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">档位</span>
                        <span class="value">{{ selectedUserDetail.referrer.card_type || '-' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">状态</span>
                        <span class="value">{{ selectedUserDetail.referrer.is_active ? '✅ 已激活' : '未激活' }}</span>
                      </div>
                    </div>
                    <div v-else style="color:#999;font-size:13px;padding:8px 0">无邀请人（平台根账号）</div>
                  </div>

                  <!-- 财务信息 -->
                  <div class="detail-section">
                    <div class="detail-title">财务信息</div>
                    <div class="detail-grid">
                      <div class="detail-item">
                        <span class="label">余额</span>
                        <span class="value gold">{{ selectedUserDetail?.user?.coin_balance ?? selectedUser.coin_balance ?? 0 }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">复投池</span>
                        <span class="value">{{ selectedUserDetail?.user?.repurchase_balance ?? 0 }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">购物金</span>
                        <span class="value">{{ selectedUserDetail?.user?.shopping_gold ?? 0 }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">分润余额</span>
                        <span class="value">{{ selectedUserDetail?.user?.profit_balance ?? 0 }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">累计收益</span>
                        <span class="value gold">{{ selectedUser.total_earnings || 0 }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">见点奖</span>
                        <span class="value">{{ selectedUser.spot_bonus_earnings || 0 }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="label">平级奖</span>
                        <span class="value">{{ selectedUser.level_bonus_earnings || 0 }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- 直推列表 -->
                  <div class="detail-section">
                    <div class="detail-title">直推列表（{{ selectedUser.direct_push_count || 0 }}人）</div>
                    <div v-if="selectedUserDetail?.directPushes?.length" class="direct-push-list">
                      <div class="dp-header">
                        <span>ID</span><span>昵称</span><span>档位</span><span>状态</span><span>余额</span>
                      </div>
                      <div v-for="dp in selectedUserDetail.directPushes" :key="dp.id" class="dp-row">
                        <span class="dp-id">{{ dp.id }}</span>
                        <span>{{ dp.username || '-' }}</span>
                        <span>{{ dp.card_type || '-' }}</span>
                        <span :style="dp.is_active ? 'color:#07c160' : 'color:#999'">{{ dp.is_active ? '已激活' : '未激活' }}</span>
                        <span class="gold">{{ dp.coin_balance || 0 }}</span>
                      </div>
                    </div>
                    <div v-else style="color:#999;font-size:13px;padding:8px 0">暂无直推</div>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="detail-actions">
                    <button class="action-btn-large primary" @click="quickTransferToUser(selectedUser.id)">
                      💰 快速充值
                    </button>
                    <button class="action-btn-large" @click="viewUserTransactions(selectedUser.id)">
                      📊 查看交易
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 订阅套餐管理 -->
        <div v-if="activeTab === 'subscription'" class="content-section">
          <div class="section-title">👑 订阅套餐管理</div>
          <div class="plans-grid">
            <div v-for="plan in subscriptionPlans" :key="plan.type" class="plan-card" :class="{ premium: plan.hasDividend }">
              <div class="plan-badge" v-if="plan.hasDividend">分红</div>
              <div class="plan-name">{{ plan.name }}</div>
              <div class="plan-price">{{ plan.price }}</div>
              <div class="plan-days">{{ plan.days }}天</div>
            </div>
          </div>
          
          <div class="config-card">
            <div class="config-header">奖励配置</div>
            <div class="config-row">
              <label>见点奖</label>
              <span class="config-value">卡价 × 30%</span>
            </div>
            <div class="config-row">
              <label>平级奖</label>
              <span class="config-value">6层 × 8%</span>
            </div>
            <div class="config-row">
              <label>分红条件</label>
              <span class="config-value">半年卡及以上</span>
            </div>
          </div>
        </div>

        <!-- 兑换审核 -->
        <div v-if="activeTab === 'exchange'" class="content-section">
          <div class="section-title">💱 兑换审核</div>
          
          <!-- 统计卡片 -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">待审核</div>
              <div class="stat-value pending">{{ pendingExchanges.length }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">已通过</div>
              <div class="stat-value approved">{{ approvedCount }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">已拒绝</div>
              <div class="stat-value rejected">{{ rejectedCount }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">总兑换额</div>
              <div class="stat-value gold">{{ totalExchangeAmount }}</div>
            </div>
          </div>
          
          <!-- 筛选器 -->
          <div class="query-card">
            <div class="query-row">
              <select v-model="exchangeFilter" @change="loadExchangeRecords" class="form-select">
                <option value="all">全部记录</option>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
              </select>
              <button class="refresh-btn" @click="loadExchangeRecords">🔄 刷新</button>
            </div>
          </div>
          
          <!-- 兑换记录列表 -->
          <div class="exchange-list">
            <div v-if="loadingExchanges" class="loading-state">
              <div class="spinner"></div>
              <p>加载中...</p>
            </div>
            
            <div v-else-if="filteredExchanges.length === 0" class="empty-state">
              暂无兑换记录
            </div>
            
            <div v-else class="exchange-table">
              <div class="table-header">
                <div class="th th-user">用户ID</div>
                <div class="th th-amount">兑换金额</div>
                <div class="th th-time">申请时间</div>
                <div class="th th-status">状态</div>
                <div class="th th-actions">操作</div>
              </div>
              
              <div 
                v-for="record in filteredExchanges" 
                :key="record.id"
                class="table-row">
                <div class="td td-user">
                  <span class="user-id-text">{{ record.user_id }}</span>
                </div>
                <div class="td td-amount">
                  <span class="amount-value gold">{{ record.amount }}</span>
                </div>
                <div class="td td-time">
                  <span class="time-text">{{ formatTime(record.created_at) }}</span>
                </div>
                <div class="td td-status">
                  <span 
                    class="status-badge" 
                    :class="record.status">
                    {{ getStatusText(record.status) }}
                  </span>
                </div>
                <div class="td td-actions">
                  <button 
                    v-if="record.status === 'pending'"
                    class="action-btn approve" 
                    @click="approveExchange(record.id)">
                    ✅ 通过
                  </button>
                  <button 
                    v-if="record.status === 'pending'"
                    class="action-btn reject" 
                    @click="rejectExchange(record.id)">
                    ❌ 拒绝
                  </button>
                  <span v-if="record.status !== 'pending'" class="processed-info">
                    {{ record.processed_at ? formatTime(record.processed_at) : '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 提现审核 -->
        <div v-if="activeTab === 'withdraw_mgr'" class="content-section">
          <div class="section-title">💸 提现审核</div>

          <div class="query-card">
            <div class="query-row">
              <select v-model="wdFilter" @change="loadWithdrawals" class="form-select">
                <option value="pending">待打款</option>
                <option value="completed">已完成</option>
                <option value="rejected">已拒绝</option>
              </select>
              <button class="refresh-btn" @click="loadWithdrawals">🔄 刷新</button>
            </div>
            <div style="font-size:13px;color:#666;margin-top:8px">
              待打款：<strong style="color:#fa8c16">{{ withdrawals.filter(r=>r.status==='pending').length }}</strong> 笔
              &nbsp; 合计：<strong style="color:#fa8c16">${{ withdrawals.filter(r=>r.status==='pending').reduce((s,r)=>s+parseFloat(r.amount),0).toFixed(2) }}</strong>
            </div>
          </div>

          <div class="exchange-list">
            <div v-if="loadingWithdrawals" class="loading-state">
              <div class="spinner"></div><p>加载中...</p>
            </div>
            <div v-else-if="withdrawals.length === 0" class="empty-state">暂无记录</div>
            <div v-else class="exchange-table">
              <div class="table-header">
                <div class="th" style="flex:1">用户ID</div>
                <div class="th" style="flex:0.8">金额</div>
                <div class="th" style="flex:2.5">钱包地址</div>
                <div class="th" style="flex:1">时间</div>
                <div class="th" style="flex:1">操作</div>
              </div>
              <div v-for="r in withdrawals" :key="r.id" class="table-row" :style="r.status!=='pending'?'opacity:0.6':''">
                <div class="td" style="flex:1"><span style="font-family:monospace;font-size:13px">{{ r.user_id }}</span></div>
                <div class="td" style="flex:0.8"><span class="amount-value gold">${{ parseFloat(r.amount).toFixed(2) }}</span></div>
                <div class="td" style="flex:2.5">
                  <span style="font-family:monospace;font-size:10px;word-break:break-all">{{ r.wallet_address }}</span>
                </div>
                <div class="td" style="flex:1"><span style="font-size:11px;color:#999">{{ formatTime(r.created_at) }}</span></div>
                <div class="td" style="flex:1;gap:4px;display:flex;flex-wrap:wrap">
                  <template v-if="r.status === 'pending'">
                    <button class="action-btn approve" style="padding:4px 10px;font-size:12px" @click="approveWithdrawal(r.id)">✅打款</button>
                    <button class="action-btn reject" style="padding:4px 10px;font-size:12px" @click="rejectWithdrawal(r.id)">❌拒绝</button>
                  </template>
                  <span v-else class="status-badge" :class="r.status">{{ r.status === 'completed' ? '已打款' : '已拒绝' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 合伙人管理 -->
        <div v-if="activeTab === 'partner_mgr'" class="content-section">
          <div class="section-title">🤝 合伙人管理</div>

          <!-- 手动设置合伙人 -->
          <div class="query-card" style="margin-bottom:12px">
            <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px">➕ 手动设置合伙人</div>
            <div class="query-row" style="flex-wrap:wrap;gap:6px">
              <input v-model="setPartnerUserId" type="text" inputmode="numeric" class="form-input" placeholder="用户ID" style="flex:0 0 100px" />
              <input v-model="setPartnerWechat" type="text" class="form-input" placeholder="微信号（选填）" style="flex:1;min-width:120px" />
              <button class="action-btn approve" style="padding:6px 14px" :disabled="settingPartner" @click="handleAdminSetPartner">
                {{ settingPartner ? '设置中...' : '✅ 设为合伙人' }}
              </button>
            </div>
          </div>

          <!-- 强制设用户为独立店主 -->
          <div class="query-card" style="margin-bottom:12px">
            <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px">🔓 强制设为独立店主</div>
            <div style="font-size:12px;color:#888;margin-bottom:8px">设置后 role=owner / is_independent=true，同时清除店铺占位记录</div>
            <div class="query-row" style="flex-wrap:wrap;gap:6px">
              <input v-model="forceIndependentUserId" type="text" inputmode="numeric" class="form-input" placeholder="用户ID" style="flex:0 0 120px" />
              <button class="action-btn approve" style="padding:6px 14px;background:#f59e0b" :disabled="forcingIndependent" @click="handleForceIndependent">
                {{ forcingIndependent ? '处理中...' : '🔓 立即独立' }}
              </button>
            </div>
            <div v-if="forceIndependentResult" style="margin-top:8px;font-size:12px;padding:6px 10px;border-radius:6px"
              :style="forceIndependentResult.success ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'">
              {{ forceIndependentResult.message }}
            </div>
          </div>

          <div class="query-card">
            <div class="query-row">
              <button class="refresh-btn" @click="loadPartnerList">🔄 刷新</button>
              <span style="font-size:13px;color:#666">共 <strong>{{ partnerList.length }}</strong> 位合伙人</span>
            </div>
          </div>
          <div class="exchange-list">
            <div v-if="loadingPartnerList" class="loading-state">
              <div class="spinner"></div><p>加载中...</p>
            </div>
            <div v-else-if="partnerList.length === 0" class="empty-state">暂无合伙人</div>
            <div v-else class="exchange-table">
              <div class="table-header">
                <div class="th" style="flex:0.7">ID</div>
                <div class="th" style="flex:0.8">余额</div>
                <div class="th" style="flex:0.7">邀请人</div>
                <div class="th" style="flex:0.5">直推</div>
                <div class="th" style="flex:1.3">微信</div>
                <div class="th" style="flex:1">操作</div>
              </div>
              <div v-for="p in partnerList" :key="p.id" class="table-row">
                <div class="td" style="flex:0.7">
                  <span style="font-family:monospace;font-size:11px">{{ p.id }}</span>
                  <span v-if="p.isManual" style="font-size:10px;color:#fa8c16;margin-left:3px">手动</span>
                </div>
                <div class="td" style="flex:0.8"><span class="amount-value gold">${{ p.balance }}</span></div>
                <div class="td" style="flex:0.7"><span style="font-family:monospace;font-size:11px">{{ p.referrerId || '—' }}</span></div>
                <div class="td" style="flex:0.5"><strong style="color:#1677ff">{{ p.directPushCount }}</strong></div>
                <div class="td" style="flex:1.3;gap:4px;display:flex;align-items:center">
                  <span v-if="p.wechatNumber" style="font-size:12px">💚 {{ p.wechatNumber }}</span>
                  <span v-else style="color:#ccc;font-size:11px">未设置</span>
                  <button v-if="p.wechatNumber" class="action-btn approve" style="padding:2px 6px;font-size:11px" @click="copyText(p.wechatNumber)">复制</button>
                </div>
                <div class="td" style="flex:1;gap:4px;display:flex;flex-wrap:wrap">
                  <button class="action-btn reject" style="padding:3px 8px;font-size:11px" @click="handleAdminRevokePartner(p.id)">❌撤销</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 代币兑换管理 -->
        <div v-if="activeTab === 'token_redeem'" class="content-section">
          <div class="section-title">🪙 代币兑换管理</div>

          <!-- 兑换比例设置 -->
          <div class="config-card" style="margin-bottom:16px">
            <div class="config-header">⚙️ 兑换比例设置</div>
            <div class="config-row" style="align-items:center;gap:12px">
              <label style="white-space:nowrap">当前比例：1000积分 =</label>
              <input
                v-model.number="tokenRedeemRate"
                type="number" step="0.1" min="0.1" max="10"
                style="width:80px;padding:6px 8px;border:1px solid #ddd;border-radius:6px"
              />
              <span>代币</span>
              <button class="action-btn approve" style="padding:6px 16px" @click="updateTokenRedeemRate">保存</button>
            </div>
            <div style="font-size:12px;color:#999;margin-top:6px">
              当前：1000积分 = {{ Math.floor(1000 * tokenRedeemRate) }} 代币
            </div>
          </div>

          <!-- 筛选 + 统计 -->
          <div class="query-card">
            <div class="query-row">
              <select v-model="tokenRedeemFilter" @change="loadTokenRedemptions" class="form-select">
                <option value="pending">待处理</option>
                <option value="completed">已打款</option>
                <option value="all">全部</option>
              </select>
              <button class="refresh-btn" @click="loadTokenRedemptions">🔄 刷新</button>
            </div>
            <div style="font-size:13px;color:#666;margin-top:8px">
              待处理：<strong style="color:#fa8c16">{{ tokenRedemptions.filter(r=>r.status==='pending').length }}</strong> 笔
            </div>
          </div>

          <!-- 列表 -->
          <div class="exchange-list">
            <div v-if="loadingTokenRedemptions" class="loading-state">
              <div class="spinner"></div><p>加载中...</p>
            </div>
            <div v-else-if="tokenRedemptions.length === 0" class="empty-state">
              暂无兑换记录
            </div>
            <div v-else class="exchange-table">
              <div class="table-header">
                <div class="th" style="flex:1.2">用户ID</div>
                <div class="th" style="flex:0.8">扣积分</div>
                <div class="th" style="flex:0.8">代币数</div>
                <div class="th" style="flex:2.5">钱包地址</div>
                <div class="th" style="flex:1">时间</div>
                <div class="th" style="flex:0.8">操作</div>
              </div>
              <div
                v-for="record in tokenRedemptions"
                :key="record.id"
                class="table-row"
                :style="record.status==='completed' ? 'opacity:0.6' : ''"
              >
                <div class="td" style="flex:1.2">
                  <span style="font-family:monospace;font-size:13px">{{ record.user_id }}</span>
                </div>
                <div class="td" style="flex:0.8">
                  <span style="color:#e67e22;font-weight:600">{{ record.points_deducted }}</span>
                </div>
                <div class="td" style="flex:0.8">
                  <span style="color:#27ae60;font-weight:600">{{ record.token_amount }}</span>
                </div>
                <div class="td" style="flex:2.5;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-family:monospace;font-size:11px;word-break:break-all">
                      {{ record.wallet_address }}
                    </span>
                    <button
                      class="copy-addr-btn"
                      @click="copyWalletAddress(record.wallet_address)"
                      title="复制地址"
                    >📋</button>
                  </div>
                </div>
                <div class="td" style="flex:1;font-size:11px;color:#999">
                  {{ formatTime(record.created_at) }}
                </div>
                <div class="td" style="flex:0.8">
                  <span v-if="record.status==='completed'" style="color:#27ae60;font-size:12px">✅ 已打款</span>
                  <button
                    v-else
                    class="action-btn approve"
                    style="font-size:12px;padding:4px 10px;white-space:nowrap"
                    @click="completeTokenRedemption(record.id)"
                  >已打款</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 快速转账 -->
        <div v-if="activeTab === 'transfer'" class="content-section">
          <div class="section-title">💸 快速转账</div>
          
          <!-- 重置用户数据 -->
          <div class="quick-transfer-card" style="margin-bottom: 20px; border: 1px solid #ff4d4f22;">
            <div class="card-subtitle" style="color: #ff4d4f;">🗑️ 重置用户数据</div>
            <div class="form-hint" style="margin-bottom: 12px; color: #999;">
              清除用户的激活状态、余额、收益、推荐关系、签到等所有数据（ID行保留，因有关联数据）
            </div>
            <div class="form-group">
              <label>用户ID</label>
              <input
                v-model="resetUserId"
                type="text"
                placeholder="输入要重置的用户ID，如：82377"
                class="form-input"
              />
            </div>
            <button class="transfer-btn" style="background: #ff4d4f;" @click="handleResetUser" :disabled="isResetting">
              {{ isResetting ? '重置中...' : '确认重置用户' }}
            </button>
          </div>

          <!-- 🔒 重置安全问题（客服专用） -->
          <div class="quick-transfer-card" style="margin-bottom: 20px; border: 1px solid #f59e0b44;">
            <div class="card-subtitle" style="color: #f59e0b;">🔑 重置安全问题</div>
            <div class="form-hint" style="margin-bottom: 12px; color: #999;">
              用于用户忘记安全问题答案时，管理员清除后用户可重新设置。
            </div>
            <div class="form-group">
              <label>用户ID</label>
              <input v-model="secResetUserId" type="text" placeholder="输入用户ID，如：82377" class="form-input" />
            </div>
            <button class="transfer-btn" style="background: #f59e0b; color:#fff;"
              @click="handleResetSecurityQuestion" :disabled="isResettingSecurity">
              {{ isResettingSecurity ? '重置中...' : '🔓 重置该用户安全问题' }}
            </button>
            <div v-if="secResetResult" :style="`margin-top:10px;font-size:13px;color:${secResetResult.ok ? '#16a34a' : '#dc2626'}`">
              {{ secResetResult.msg }}
            </div>
          </div>

          <!-- 生成激活码 -->
          <div class="quick-transfer-card" style="margin-bottom: 20px;">
            <div class="card-subtitle">生成激活码（跨设备激活）</div>

            <div class="form-group">
              <label>激活套餐</label>
              <div class="amount-buttons">
                <button
                  v-for="plan in redeemPlans"
                  :key="plan.type"
                  class="amount-btn"
                  :class="{ active: redeemPlanType === plan.type }"
                  @click="redeemPlanType = plan.type">
                  {{ plan.label }}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label>生成数量</label>
              <input
                v-model.number="redeemCount"
                type="number"
                min="1"
                max="100"
                placeholder="数量（默认1）"
                class="form-input"
              />
            </div>

            <button class="transfer-btn" @click="generateRedeemCode" :disabled="isGeneratingCode">
              🔑 {{ isGeneratingCode ? '生成中...' : '生成激活码' }}
            </button>

            <div v-if="generatedCodes.length" class="generated-code">
              <div class="code-label">激活码（点击复制）：</div>
              <div
                v-for="item in generatedCodes"
                :key="item.code"
                class="code-value"
                @click="copyCode(item.code)">
                {{ item.code }} <span class="code-plan-tag">{{ item.plan_type }}</span>
              </div>
            </div>
          </div>
          
          <div class="quick-transfer-card">
            <div class="card-subtitle">给用户添加余额（同设备）</div>
            
            <div class="form-group">
              <label>对方用户ID</label>
              <input 
                v-model="transferForm.toUserId" 
                type="text" 
                placeholder="输入用户ID，如：88322"
                class="form-input"
              />
              <div class="form-hint">💡 提示：输入自己的ID可以给自己充值</div>
            </div>

            <div class="form-group">
              <label>转账金额</label>
              <div class="amount-buttons">
                <button 
                  v-for="amount in quickAmounts" 
                  :key="amount"
                  class="amount-btn"
                  @click="transferForm.amount = amount">
                  {{ amount }}
                </button>
              </div>
              <input 
                v-model.number="transferForm.amount" 
                type="number" 
                placeholder="或手动输入金额"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label>转账类型</label>
              <div class="type-switch">
                <button 
                  :class="['type-btn', 'active']"
                  disabled>
                  余额
                </button>
              </div>
            </div>

            <button class="transfer-btn" @click="handleAdminTransfer">
              ⚡ 立即转账
            </button>
          </div>

          <!-- 最近转账记录 -->
          <div class="recent-transfers">
            <div class="sub-title">📋 最近转账记录</div>
            <div v-if="recentTransfers.length === 0" class="empty-state-small">
              暂无转账记录
            </div>
            <div 
              v-for="transfer in recentTransfers" 
              :key="transfer.id"
              class="transfer-record">
              <div class="record-header">
                <span class="record-badge admin">管理员</span>
                <span class="record-time">{{ formatTime(transfer.timestamp) }}</span>
              </div>
              <div class="record-content">
                <span>{{ transfer.toUserId }}</span>
                <span class="amount">+{{ transfer.amount }}</span>
                <span class="type">余额</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 参数设置 (修正结构) -->
        <div v-if="activeTab === 'settings'" class="content-section">
          <div class="section-title">⚙️ 参数设置</div>
          
          <!-- 管理员密码设置 -->
          <div class="config-card">
            <div class="config-header">🔐 管理员密码设置</div>
            
            <!-- 修改登录码 -->
            <div class="password-section">
              <div class="password-title">修改登录码</div>
              <div class="password-hint">用于进入管理后台</div>
              <div class="config-row">
                <label>当前登录码</label>
                <input 
                  type="password" 
                  v-model="passwordForm.currentLoginCode" 
                  placeholder="输入当前登录码"
                  class="password-input"
                />
              </div>
              <div class="config-row">
                <label>新登录码</label>
                <input 
                  type="password" 
                  v-model="passwordForm.newLoginCode" 
                  placeholder="至少6位"
                  class="password-input"
                />
              </div>
              <div class="config-row">
                <label>确认新登录码</label>
                <input 
                  type="password" 
                  v-model="passwordForm.confirmLoginCode" 
                  placeholder="再次输入新登录码"
                  class="password-input"
                />
              </div>
              <button class="change-password-btn" @click="changeLoginCode">
                修改登录码
              </button>
            </div>
            
            <div class="divider"></div>
            
            <!-- 修改操作密码 -->
            <div class="password-section">
              <div class="password-title">修改操作密码</div>
              <div class="password-hint">用于清空数据等敏感操作</div>
              <div class="config-row">
                <label>当前密码</label>
                <input 
                  type="password" 
                  v-model="passwordForm.currentPassword" 
                  placeholder="输入当前密码"
                  class="password-input"
                />
              </div>
              <div class="config-row">
                <label>新密码</label>
                <input 
                  type="password" 
                  v-model="passwordForm.newPassword" 
                  placeholder="至少6位"
                  class="password-input"
                />
              </div>
              <div class="config-row">
                <label>确认新密码</label>
                <input 
                  type="password" 
                  v-model="passwordForm.confirmPassword" 
                  placeholder="再次输入新密码"
                  class="password-input"
                />
              </div>
              <button class="change-password-btn" @click="changeOperationPassword">
                修改操作密码
              </button>
            </div>
            
            <div class="divider"></div>
          </div>
          
          <!-- 奖励业务参数 -->
          <div class="section-title" style="margin-top: 30px;">📊 奖励业务参数</div>
          
          <!-- 奖励比例配置 -->
          <div class="config-card">
            <div class="config-header">📊 奖励比例 (卡价百分比)</div>
            <div class="config-row">
              <label>见点奖比例</label>
              <input type="number" v-model.number="configForm.bonusRates.spotBonus" step="0.01" min="0" max="1" />
              <span class="config-unit">(0.3 = 30%)</span>
            </div>
            <div class="config-row">
              <label>平级奖比例</label>
              <input type="number" v-model.number="configForm.bonusRates.levelBonus" step="0.01" min="0" max="1" />
              <span class="config-unit">每层</span>
            </div>
            <div class="config-row">
              <label>平级奖代数</label>
              <input type="number" v-model.number="configForm.bonusRates.levelGenerations" min="1" max="12" />
              <span class="config-unit">代</span>
            </div>
            <div class="config-row">
              <label>团队分红</label>
              <input type="number" v-model.number="configForm.bonusRates.teamDividend" step="0.01" min="0" max="1" />
              <span class="config-unit">每笔</span>
            </div>
            <div class="config-row">
              <label>全网分红</label>
              <input type="number" v-model.number="configForm.bonusRates.globalDividend" step="0.01" min="0" max="1" />
              <span class="config-unit">每笔</span>
            </div>
          </div>
          
          <!-- 分账比例 -->
          <div class="config-card">
            <div class="config-header">💰 平级奖分账 (合计1.0)</div>
            <div class="config-row">
              <label>可提现比例</label>
              <input type="number" v-model.number="configForm.levelBonusDistribution.withdrawable" step="0.01" />
            </div>
            <div class="config-row">
              <label>复购升级比例</label>
              <input type="number" v-model.number="configForm.levelBonusDistribution.lockedUpgrade" step="0.01" />
            </div>
            <div class="config-row">
              <label>补贴池比例（满30→分润）</label>
              <input type="number" v-model.number="configForm.levelBonusDistribution.lockedSubsidy" step="0.01" />
            </div>
          </div>
          
          <!-- 签到配置 -->
          <div class="config-card">
            <div class="config-header">📅 签到产出周期 (天)</div>
            <div class="config-row">
              <label>普通用户(无滑落)</label>
              <input type="number" v-model.number="configForm.checkin.noSlippage" min="1" />
            </div>
            <div class="config-row">
              <label>活跃用户(有滑落)</label>
              <input type="number" v-model.number="configForm.checkin.withSlippage" min="1" />
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="config-actions">
            <button class="save-btn" @click="saveConfig">💾 保存全局配置</button>
            <button class="reset-btn" @click="resetConfig">🔄 恢复默认出厂</button>
          </div>
        </div>

        <!-- 数据清理 -->
        <div v-if="activeTab === 'cleanup'" class="content-section">
          <div class="section-title">🗑️ 数据清理</div>
          <div class="cleanup-card">
            <button class="danger-btn" @click="clearAllData">
              ⚠️ 清空所有数据
            </button>
            <p class="warning-text">警告：此操作不可恢复，请谨慎操作！</p>
          </div>
        </div>

        <!-- 信息管理 -->
        <div v-if="activeTab === 'info_mgr'" class="content-section">
          <div class="section-title-row">
            <span>📋 信息管理</span>
            <button class="refresh-btn" @click="loadInfoPosts">🔄 刷新</button>
          </div>

          <!-- 统计 -->
          <div class="stats-4grid">
            <div class="stat4-card">
              <div class="stat4-num">{{ infoStats.total }}</div>
              <div class="stat4-lbl">总信息</div>
            </div>
            <div class="stat4-card gold">
              <div class="stat4-num">{{ infoStats.pinned }}</div>
              <div class="stat4-lbl">置顶</div>
            </div>
            <div class="stat4-card green">
              <div class="stat4-num">{{ infoTypeList.length }}</div>
              <div class="stat4-lbl">分类数</div>
            </div>
            <div class="stat4-card gray">
              <div class="stat4-num">{{ infoStats.today }}</div>
              <div class="stat4-lbl">今日新增</div>
            </div>
          </div>

          <!-- 类型筛选 -->
          <div class="info-filter-bar">
            <div
              v-for="t in [{ id: 'all', icon: '📋', label: '全部' }, ...infoTypeList]"
              :key="t.id"
              :class="['info-ftab', { active: infoFilterType === t.id }]"
              @click="infoFilterType = t.id"
            >{{ t.icon }} {{ t.label }}</div>
          </div>

          <!-- 列表 -->
          <div class="info-list">
            <div v-if="filteredInfoPosts.length === 0" class="empty-state">暂无信息数据</div>
            <div
              v-for="post in filteredInfoPosts"
              :key="post.id"
              class="info-item-card"
            >
              <div class="info-item-top">
                <span class="info-type-tag">{{ infoTypeLabel(post.type) }}</span>
                <span v-if="post.pinned" class="info-pin-badge">📌 置顶</span>
                <span class="info-city">📍 {{ post.city }}</span>
                <span class="info-time">{{ formatInfoTime(post.timestamp) }}</span>
              </div>
              <div class="info-item-title">{{ post.title }}</div>
              <div class="info-item-meta">
                <span class="info-cat">{{ post.category }}</span>
                <span v-if="post.price" class="info-price">{{ post.price }} AED</span>
                <span v-if="post.salary" class="info-price">{{ post.salary }}</span>
              </div>
              <div class="info-item-desc">{{ post.desc }}</div>
              <div class="info-item-contact">
                联系人：{{ post.contact }} · {{ post.phone }}
              </div>
              <div class="info-item-actions">
                <button
                  class="info-act-btn pin-btn"
                  @click="toggleInfoPin(post)"
                >{{ post.pinned ? '取消置顶' : '📌 置顶' }}</button>
                <button
                  class="info-act-btn del-btn"
                  @click="deleteInfoPost(post.id)"
                >🗑️ 删除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 群管理 -->
        <div v-if="activeTab === 'groups'" class="content-section">
          <div class="section-title">📲 群链接管理</div>
          <div v-for="g in groupForms" :key="g.type" class="group-admin-card">
            <div class="group-admin-title">
              {{ g.type === 'whatsapp' ? '📱 WhatsApp 群' : '💬 WeChat 群' }}
            </div>
            <div class="form-row">
              <label>群名称</label>
              <input v-model="g.name" type="text" class="admin-input" placeholder="如：阿联酋采购WhatsApp群" />
            </div>
            <div class="form-row">
              <label>入群费用</label>
              <input v-model="g.price" type="text" class="admin-input" placeholder="如：免费 / $10" />
            </div>
            <div class="form-row">
              <label>二维码图片</label>
              <div class="qr-upload-area">
                <img v-if="g.qr_url" :src="g.qr_url" class="qr-preview" alt="二维码" />
                <input
                  type="file"
                  accept="image/*"
                  class="qr-file-input"
                  @change="e => handleQrUpload(e, g)"
                />
                <span class="qr-upload-hint">{{ g.uploading ? '上传中...' : '点击上传二维码' }}</span>
              </div>
            </div>
            <div class="form-row toggle-row">
              <label>是否显示</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="g.enabled" />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">{{ g.enabled ? '显示' : '隐藏' }}</span>
            </div>
            <button
              class="save-btn"
              :disabled="g.saving"
              @click="saveGroup(g)">
              {{ g.saving ? '保存中...' : '💾 保存' }}
            </button>
          </div>
        </div>

        <!-- 自定义 -->
        <div v-if="activeTab === 'custom'" class="content-section">
          <div class="section-title">🎨 自定义</div>
          <div class="custom-card">
            <p class="coming-soon">🚧 功能开发中...</p>
            <p class="settings-hint">此处可自定义平台外观、Logo、名称等</p>
          </div>
        </div>

        <!-- 商品管理 -->
        <div v-if="activeTab === 'products'" class="content-section">
          <div class="section-title">🛍️ 商品管理</div>

          <!-- 新建/编辑表单 -->
          <div class="prod-form-card">
            <div class="prod-form-title">{{ productEditId ? '✏️ 编辑商品' : '➕ 新建商品' }}</div>

            <!-- 图片上传区（3张，仿淘宝） -->
            <div class="prod-section-label">商品图片 <span class="prod-tip">主图必填，最多3张</span></div>
            <div class="prod-img-row">
              <!-- 完全同QR上传：预览图 + 可见原生input，浏览器/PWA/iOS全通 -->
              <div v-for="n in 3" :key="n" class="prod-img-slot">
                <div class="slot-preview">
                  <div v-if="slotUploading[n-1]" class="slot-loading">⏳</div>
                  <img v-else-if="productImages[n-1]" :src="productImages[n-1]" class="slot-img" />
                  <div v-else class="slot-empty">
                    <div class="slot-plus">+</div>
                    <div class="slot-label">{{ n===1?'主图':'副图'+n }}</div>
                  </div>
                </div>
                <input type="file" accept="image/*" :disabled="slotUploading[n-1]" @change="e=>uploadSlotImage(e,n-1)" class="slot-native-btn" />
              </div>
            </div>

            <!-- 基本信息 -->
            <div class="prod-section-label">基本信息</div>
            <div class="prod-row-2">
              <div class="prod-field">
                <div class="field-label">区域</div>
                <select v-model="productForm.zone" class="prod-input">
                  <option value="uae">🛒 采购</option>
                  <option value="partner">🤝 服务商优选</option>
                  <option value="tech">🤖 AI科技</option>
                </select>
              </div>
              <div class="prod-field">
                <div class="field-label">周标签</div>
                <input v-model="productForm.week_label" type="text" placeholder="2026-W09" class="prod-input" />
              </div>
            </div>
            <div class="prod-field" style="margin-bottom:12px">
              <div class="field-label">商品名称 <span style="color:#f44">*</span></div>
              <input v-model="productForm.title" type="text" placeholder="输入商品名称" class="prod-input" />
            </div>
            <div class="prod-field" style="margin-bottom:12px">
              <div class="field-label">商品描述</div>
              <textarea v-model="productForm.description" placeholder="输入商品描述" class="prod-textarea" rows="3"></textarea>
            </div>

            <!-- 定价 -->
            <div class="prod-section-label">💰 定价（0=不支持）</div>
            <div class="prod-row-3">
              <div class="prod-field">
                <div class="field-label">余额价($)</div>
                <input v-model.number="productForm.price_balance" type="number" min="0" class="prod-input" />
              </div>
              <div class="prod-field">
                <div class="field-label">划线原价($)</div>
                <input v-model.number="productForm.price_original" type="number" min="0" class="prod-input" placeholder="0=不显示折扣" />
              </div>
              <div class="prod-field">
                <div class="field-label">购物金</div>
                <input v-model.number="productForm.price_shopping_coin" type="number" min="0" class="prod-input" />
              </div>
              <div class="prod-field">
                <div class="field-label">积分</div>
                <input v-model.number="productForm.price_points" type="number" min="0" class="prod-input" />
              </div>
            </div>

            <!-- 奖励 -->
            <div class="prod-section-label">🎁 购买奖励</div>
            <div class="prod-bonus-row">
              <label class="prod-toggle-row">
                <input type="checkbox" v-model="productForm.spot_bonus_enabled" class="prod-checkbox" />
                <span class="toggle-label">见点奖</span>
                <input v-if="productForm.spot_bonus_enabled" v-model.number="productForm.spot_bonus_rate" type="number" step="0.01" min="0" max="1" class="rate-input" />
                <span v-if="productForm.spot_bonus_enabled" class="rate-unit">× 价格</span>
              </label>
              <label class="prod-toggle-row">
                <input type="checkbox" v-model="productForm.level_bonus_enabled" class="prod-checkbox" />
                <span class="toggle-label">平级奖</span>
                <input v-if="productForm.level_bonus_enabled" v-model.number="productForm.level_bonus_rate" type="number" step="0.01" min="0" max="1" class="rate-input" />
                <span v-if="productForm.level_bonus_enabled" class="rate-unit">%/层 × </span>
                <input v-if="productForm.level_bonus_enabled" v-model.number="productForm.level_depth" type="number" min="1" max="10" class="rate-input" style="width:44px" />
                <span v-if="productForm.level_bonus_enabled" class="rate-unit">层</span>
              </label>
            </div>

            <!-- 库存排序 -->
            <div class="prod-row-2" style="margin-top:12px">
              <div class="prod-field">
                <div class="field-label">库存（-1无限）</div>
                <input v-model.number="productForm.stock" type="number" class="prod-input" />
              </div>
              <div class="prod-field">
                <div class="field-label">排序（小靠前）</div>
                <input v-model.number="productForm.sort_order" type="number" min="0" class="prod-input" />
              </div>
            </div>

            <button class="prod-submit-btn" :disabled="productSaving" @click="handleSaveProduct">
              {{ productSaving ? '保存中...' : (productEditId ? '💾 保存修改' : '➕ 创建商品') }}
            </button>
            <button v-if="productEditId" class="prod-cancel-btn" @click="resetProductForm">取消编辑</button>
          </div>

          <!-- 商品列表 -->
          <div class="prod-list-section">
            <div class="prod-list-header">
              <span>📦 已上架商品</span>
              <button class="refresh-btn" @click="loadAdminProducts">🔄 刷新</button>
            </div>
            <div v-if="productsLoading" class="loading-wrap"><div class="spinner"></div></div>
            <div v-else-if="productsList.length === 0" class="empty-wrap">暂无商品</div>
            <div v-else class="prod-list">
              <div v-for="p in productsList" :key="p.id" class="prod-list-item">
                <img v-if="p.image_url" :src="p.image_url" class="prod-list-img" />
                <div v-else class="prod-list-img-ph">📦</div>
                <div class="prod-list-info">
                  <div class="prod-list-name">{{ p.title }}</div>
                  <div class="prod-list-meta">{{ p.zone === 'uae' ? '采购' : p.zone === 'partner' ? '服务商优选' : 'AI科技' }} · AED {{ p.price_balance }}</div>
                </div>
                <div class="prod-list-actions">
                  <button class="edit-btn" @click="editProduct(p)">编辑</button>
                  <button class="toggle-btn" :class="p.status==='active'?'btn-off':'btn-on'" @click="handleToggleStatus(p)">
                    {{ p.status === 'active' ? '下架' : '上架' }}
                  </button>
                  <button class="del-btn" @click="handleDeleteProduct(p.id)">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 分润管理 -->
        <div v-if="activeTab === 'profit'" class="content-section">
          <div class="section-title">📈 分润管理</div>

          <!-- 统计卡片 -->
          <div class="config-card" style="margin-bottom:16px">
            <div class="config-header">📊 分润用户统计</div>
            <div class="stats-4grid">
              <div class="stat4-card gold">
                <div class="stat4-num">{{ profitStats.count }}</div>
                <div class="stat4-lbl">分润用户数</div>
              </div>
              <div class="stat4-card green">
                <div class="stat4-num">{{ profitStats.totalProfit.toFixed(2) }}</div>
                <div class="stat4-lbl">待领分润总额</div>
              </div>
              <div class="stat4-card">
                <div class="stat4-num">{{ profitStats.elite }}</div>
                <div class="stat4-lbl">60档用户</div>
              </div>
              <div class="stat4-card">
                <div class="stat4-num">{{ profitStats.tier100 + profitStats.tier200 }}</div>
                <div class="stat4-lbl">100/200档用户</div>
              </div>
            </div>
            <button class="refresh-btn" style="margin-top:10px" @click="loadProfitStats" :disabled="loadingProfitStats">
              {{ loadingProfitStats ? '加载中...' : '🔄 刷新统计' }}
            </button>
          </div>

          <!-- 重启分润操作区（分2档） -->
          <div class="config-card" style="border:1px solid #ffa39e">
            <div class="config-header" style="color:#cf1322">⚠️ 重启分润（分2档）</div>

            <!-- ── 档1：重启全部（含100/200/300） ── -->
            <div style="background:#fff1f0;border:1px solid #ffa39e;border-radius:10px;padding:14px;margin-bottom:16px">
              <div style="font-size:13px;font-weight:700;color:#cf1322;margin-bottom:8px">🔴 档1：重启全部分润（100+200+300档）</div>
              <div style="font-size:12px;color:#666;margin-bottom:12px;line-height:1.8">
                1️⃣ 所有 <b>100/200/300档</b> 用户分润余额 → 打入可用余额<br>
                2️⃣ 分润余额清零，各档位用户保留原档位<br>
                3️⃣ 下次签到重新从 0 开始累计复利<br>
                <span style="color:#389e0d">✅ V1/V2/V3 积分档用户不受影响</span>
              </div>
              <div v-if="!restartConfirming">
                <button class="danger-btn" style="width:100%;margin:0" @click="restartConfirming = true">
                  🔄 重启全部（100+200+300档）
                </button>
              </div>
              <div v-else style="border:1px solid #ff4d4f;border-radius:8px;padding:12px;background:#fff">
                <div style="font-size:13px;font-weight:600;color:#cf1322;margin-bottom:8px">⚠️ 不可撤销，请确认！</div>
                <input v-model="restartAdminCode" type="password" placeholder="输入管理员密码" class="form-input" style="margin-bottom:10px" />
                <div style="display:flex;gap:8px">
                  <button class="danger-btn" style="flex:1;margin:0" @click="handleRestartProfit" :disabled="isRestartingProfit">
                    {{ isRestartingProfit ? '执行中...' : '✅ 确认重启全部' }}
                  </button>
                  <button class="cancel-small-btn" style="flex:1" @click="restartConfirming = false; restartAdminCode = ''">取消</button>
                </div>
              </div>
              <div v-if="restartProfitResult" :style="`margin-top:10px;font-size:12px;padding:8px;border-radius:6px;color:${restartProfitResult.ok?'#16a34a':'#dc2626'};background:${restartProfitResult.ok?'#f0fdf4':'#fef2f2'}`">
                {{ restartProfitResult.msg }}
              </div>
            </div>

            <!-- ── 档2：仅重启200+300档 ── -->
            <div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:10px;padding:14px">
              <div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:8px">🟡 档2：仅重启200+300档分润</div>
              <div style="font-size:12px;color:#666;margin-bottom:12px;line-height:1.8">
                1️⃣ <b>200/300档</b>用户分润余额 → 打入可用余额，清零重算<br>
                2️⃣ <b>100档用户不受影响</b>，继续按 1%/天 累计利息<br>
                3️⃣ 100档用户手动领取后，自动回到余额并从0重新计算<br>
                <span style="color:#389e0d">✅ 100档复利持续运行，直到手动领取为止</span>
              </div>
              <div v-if="!restartConfirming2">
                <button style="width:100%;margin:0;padding:10px;background:#fa8c16;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600" @click="restartConfirming2 = true">
                  🟡 仅重启200+300档
                </button>
              </div>
              <div v-else style="border:1px solid #ffe58f;border-radius:8px;padding:12px;background:#fff">
                <div style="font-size:13px;font-weight:600;color:#b45309;margin-bottom:8px">⚠️ 不可撤销，请确认！</div>
                <input v-model="restartAdminCode2" type="password" placeholder="输入管理员密码" class="form-input" style="margin-bottom:10px" />
                <div style="display:flex;gap:8px">
                  <button style="flex:1;padding:10px;background:#fa8c16;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600" @click="handleRestartProfitTier200" :disabled="isRestartingProfit2">
                    {{ isRestartingProfit2 ? '执行中...' : '✅ 确认仅重启200+300' }}
                  </button>
                  <button class="cancel-small-btn" style="flex:1" @click="restartConfirming2 = false; restartAdminCode2 = ''">取消</button>
                </div>
              </div>
              <div v-if="restartProfitResult2" :style="`margin-top:10px;font-size:12px;padding:8px;border-radius:6px;color:${restartProfitResult2.ok?'#16a34a':'#dc2626'};background:${restartProfitResult2.ok?'#f0fdf4':'#fef2f2'}`">
                {{ restartProfitResult2.msg }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 操作结果提示弹窗 -->
    <div v-if="showResultDialog" class="result-overlay" @click="showResultDialog = false">
      <div class="result-box" :class="resultType" @click.stop>
        <div class="result-icon">{{ resultType === 'success' ? '✅' : '❌' }}</div>
        <div class="result-title">{{ resultTitle }}</div>
        <div class="result-message">{{ resultMessage }}</div>
        <button class="result-btn" @click="showResultDialog = false">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getOrCreateUserId } from '../utils/auth.js'
import { useToast } from '../composables/useToast.js'
import { getRewardConfig } from '../config/rewardConfig.js'
import { eventBus, EVENTS } from '../utils/eventBus.js'  // ✅ 新增
import { supabase } from '../config/supabase.js'  // ✅ 新增Supabase
import { 
  verifyAdminPassword, 
  isAdminAuthenticated,
  changeAdminLoginCode,
  changeAdminPassword
} from '../config/adminConfig.js'

const router = useRouter()
const { success, error, warning } = useToast()
const rewardConfigManager = getRewardConfig()

// ==================== 数据 ====================

const currentUserId = ref(getOrCreateUserId())
const quickAmounts = [10, 30, 60, 300]

const transferForm = ref({
  toUserId: '',
  amount: 0
})

const queryUserId = ref('')
const queriedUser = ref(null)
const recentTransfers = ref([])

// 激活码相关（五档）
const redeemPlans = [
  { type: 'BASIC',    label: 'V1 · 50'  },
  { type: 'PREMIUM',  label: 'V2 · 100' },
  { type: 'ELITE',    label: 'V3 · 200' },
  { type: 'TIER_300', label: 'V4 · 300' },
  { type: 'TIER_500', label: 'V5 · 500' },
]
const redeemPlanType = ref('BASIC')
const redeemCount = ref(1)
const generatedCodes = ref([])
const isGeneratingCode = ref(false)

// 重置用户数据
const resetUserId = ref('')
const isResetting = ref(false)

// 重置安全问题（客服专用）
const secResetUserId = ref('')
const isResettingSecurity = ref(false)
const secResetResult = ref(null)

// 分润管理
const profitStats = ref({ count: 0, totalProfit: 0, elite: 0, tier100: 0, tier200: 0 })
const loadingProfitStats = ref(false)
const restartConfirming = ref(false)
const restartAdminCode = ref('')
const isRestartingProfit = ref(false)
const restartProfitResult = ref(null)
// 仅重启200+300档
const restartConfirming2 = ref(false)
const restartAdminCode2 = ref('')
const isRestartingProfit2 = ref(false)
const restartProfitResult2 = ref(null)

// 用户管理相关
const allUsers = ref([])
const userSearch = ref('')
const userFilter = ref('activated')
const selectedUser = ref(null)
const selectedUserDetail = ref(null)  // 详情弹窗数据（推荐人+直推列表）
const selectedUserLoading = ref(false)
const usersLoading = ref(false)
const userCurrentPage = ref(1)
const userStats = ref({ total: 0, activated: 0, inactive: 0, totalBalance: 0 })
const userPagination = ref({ page: 1, limit: 30, total: 0, totalPages: 1 })
let userSearchTimer = null

// ── 代币兑换管理 ──
const tokenRedemptions = ref([])
const loadingTokenRedemptions = ref(false)
const tokenRedeemFilter = ref('pending')
const tokenRedeemRate = ref(1)

// ==================== 提现审核 ====================
const withdrawals = ref([])
const loadingWithdrawals = ref(false)
const wdFilter = ref('pending')

const loadWithdrawals = async () => {
  loadingWithdrawals.value = true
  try {
    const res = await fetch(`/api/withdraw/pending?status=${wdFilter.value}`)
    const data = await res.json()
    withdrawals.value = data.code === 200 ? data.data : []
  } catch { withdrawals.value = [] }
  loadingWithdrawals.value = false
}

const approveWithdrawal = async (id) => {
  const txid = prompt('输入链上交易哈希（可选，直接回车留空即可）')
  if (txid === null) return // 用户点取消
  const res = await fetch(`/api/withdraw/approve/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid: txid || null })
  })
  const data = await res.json()
  showResult(data.code === 200 ? 'success' : 'error', data.message)
  await loadWithdrawals()
}

const rejectWithdrawal = async (id) => {
  if (!confirm('确认拒绝此提现申请？余额将退回给用户')) return
  const res = await fetch(`/api/withdraw/reject/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: '管理员拒绝' })
  })
  const data = await res.json()
  showResult(data.code === 200 ? 'success' : 'error', data.message)
  await loadWithdrawals()
}

// 合伙人管理
const partnerList = ref([])
const loadingPartnerList = ref(false)
const setPartnerUserId = ref('')
const setPartnerWechat = ref('')
const settingPartner = ref(false)

// 强制独立店主
const forceIndependentUserId = ref('')
const forcingIndependent = ref(false)
const forceIndependentResult = ref(null)

const handleForceIndependent = async () => {
  const uid = forceIndependentUserId.value.trim()
  if (!uid) { alert('请输入用户ID'); return }
  if (!confirm(`确认将用户 ${uid} 强制设为独立店主？此操作不可撤销。`)) return
  forcingIndependent.value = true
  forceIndependentResult.value = null
  try {
    const res = await fetch('/api/admin/force-independent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode: ADMIN_CODE_LOCAL(), userId: uid })
    })
    const json = await res.json()
    forceIndependentResult.value = { success: json.success, message: json.message }
    if (json.success) forceIndependentUserId.value = ''
  } catch (e) {
    forceIndependentResult.value = { success: false, message: '请求失败：' + e.message }
  } finally {
    forcingIndependent.value = false
  }
}

const loadPartnerList = async () => {
  loadingPartnerList.value = true
  try {
    const res = await fetch(`/api/partner/admin-list?adminCode=${ADMIN_CODE_LOCAL()}`)
    const json = await res.json()
    if (json.code === 200) partnerList.value = json.data
    else console.error('[Partner] loadList error', json.message)
  } catch (e) {
    console.error('[Partner] loadList error', e)
  } finally {
    loadingPartnerList.value = false
  }
}

const handleAdminSetPartner = async () => {
  const uid = setPartnerUserId.value.trim()
  if (!uid) { alert('请输入用户ID'); return }
  if (!confirm(`确认将用户 ${uid} 设为合伙人？`)) return
  settingPartner.value = true
  try {
    const res = await fetch('/api/partner/admin-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode: ADMIN_CODE_LOCAL(), userId: uid, wechatNumber: setPartnerWechat.value.trim() || undefined })
    })
    const json = await res.json()
    if (json.code === 200) {
      alert(json.message)
      setPartnerUserId.value = ''
      setPartnerWechat.value = ''
      await loadPartnerList()
    } else {
      alert('设置失败：' + json.message)
    }
  } catch (e) {
    alert('设置失败：' + e.message)
  } finally {
    settingPartner.value = false
  }
}

const handleAdminRevokePartner = async (userId) => {
  if (!confirm(`确认撤销用户 ${userId} 的合伙人资格？`)) return
  try {
    const res = await fetch('/api/partner/admin-revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode: ADMIN_CODE_LOCAL(), userId })
    })
    const json = await res.json()
    alert(json.message)
    await loadPartnerList()
  } catch (e) {
    alert('撤销失败：' + e.message)
  }
}

const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.focus(); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    }
    alert('已复制：' + text)
  } catch { alert('复制失败，请手动复制') }
}

const loadTokenRedemptions = async () => {
  loadingTokenRedemptions.value = true
  try {
    const res = await fetch(`/api/token-redeem/list?status=${tokenRedeemFilter.value}`)
    const json = await res.json()
    if (json.code === 200) tokenRedemptions.value = json.data
  } catch (e) {
    console.error('[TokenRedeem] loadList error', e)
  } finally {
    loadingTokenRedemptions.value = false
  }
}

const loadTokenRedeemRate = async () => {
  try {
    const res = await fetch('/api/token-redeem/rate')
    const json = await res.json()
    if (json.code === 200) tokenRedeemRate.value = json.data.rate
  } catch {}
}

const updateTokenRedeemRate = async () => {
  try {
    const res = await fetch('/api/token-redeem/update-rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate: tokenRedeemRate.value })
    })
    const json = await res.json()
    alert(json.message || '已保存')
  } catch {
    alert('保存失败')
  }
}

const completeTokenRedemption = async (redemptionId) => {
  if (!confirm('确认已向该用户打款？此操作不可撤销')) return
  try {
    const res = await fetch('/api/token-redeem/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redemptionId })
    })
    const json = await res.json()
    if (json.code === 200) {
      await loadTokenRedemptions()
    } else {
      alert(json.message || '操作失败')
    }
  } catch {
    alert('网络错误')
  }
}

const copyWalletAddress = (address) => {
  navigator.clipboard.writeText(address).then(() => {
    alert('地址已复制')
  }).catch(() => {
    prompt('请手动复制地址：', address)
  })
}

// 兑换审核数据
const exchangeRecords = ref([])
const pendingExchanges = computed(() => exchangeRecords.value.filter(r => r.status === 'pending'))
const approvedCount = computed(() => exchangeRecords.value.filter(r => r.status === 'approved').length)
const rejectedCount = computed(() => exchangeRecords.value.filter(r => r.status === 'rejected').length)
const totalExchangeAmount = computed(() => {
  return exchangeRecords.value
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
    .toFixed(2)
})
const exchangeFilter = ref('all')
const loadingExchanges = ref(false)
const filteredExchanges = computed(() => {
  if (exchangeFilter.value === 'all') {
    return exchangeRecords.value
  }
  return exchangeRecords.value.filter(r => r.status === exchangeFilter.value)
})

// 订阅套餐配置
const subscriptionPlans = [
  { type: 'MONTH', name: '月卡', price: 10, days: 30, hasDividend: false },
  { type: 'QUARTER', name: '季卡', price: 30, days: 90, hasDividend: false },
  { type: 'HALF_YEAR', name: '半年卡', price: 60, days: 180, hasDividend: true },
  { type: 'YEAR', name: '年卡', price: 120, days: 365, hasDividend: true }
]

// 产品管理
const productEditId = ref(null)
const productSaving = ref(false)
const productsLoading = ref(false)
const productImages = ref(['', '', ''])
const slotUploading = ref([false, false, false])

async function uploadSlotImage(event, slotIndex) {
  const file = event.target.files?.[0]
  if (!file) return
  slotUploading.value[slotIndex] = true
  try {
    const { uploadFile } = await import('../services/uploadService.js')
    const result = await uploadFile(file, 'image')
    if (result?.url) {
      productImages.value[slotIndex] = result.url
    } else {
      error('上传失败', '请重试')
    }
  } catch (e) {
    error('上传失败', e.message)
  } finally {
    slotUploading.value[slotIndex] = false
    event.target.value = ''
  }
}

const productForm = ref({
  zone: 'uae',
  week_label: '',
  title: '',
  description: '',
  price_balance: 0,
  price_shopping_coin: 0,
  price_points: 0,
  spot_bonus_enabled: false,
  spot_bonus_rate: 0.30,
  level_bonus_enabled: false,
  level_bonus_rate: 0.10,
  level_depth: 6,
  stock: -1,
  sort_order: 0
})
const productsList = ref([])

// 奖励配置表单
const configForm = reactive(JSON.parse(JSON.stringify(rewardConfigManager.getConfig())))

// 密码修改表单
const passwordForm = reactive({
  // 登录码修改
  currentLoginCode: '',
  newLoginCode: '',
  confirmLoginCode: '',
  // 操作密码修改
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 管理后台分类标签
// 第一行
// 第二行
const adminTabs = [
  { label: '用户管理', value: 'users',        icon: '👥' },
  { label: '商品管理', value: 'products',     icon: '🛍️' },
  { label: '订阅套餐', value: 'subscription', icon: '👑' },
  { label: '快速转账', value: 'transfer',     icon: '💸' },
  { label: '发布管理', value: 'info_mgr',     icon: '📋' },
  { label: '分润管理', value: 'profit',       icon: '📈' },
  { label: '参数配置', value: 'settings',     icon: '⚙️' },
  { label: '数据清理', value: 'cleanup',      icon: '🗑️' },
  { label: '充值提现', value: 'exchange',     icon: '💰' },
  { label: '提现审核', value: 'withdraw_mgr', icon: '💸' },
  { label: '积分管理', value: 'token_redeem', icon: '🪙' },
  { label: '合伙人',   value: 'partner_mgr',  icon: '🤝' },
]

// 当前选中的标签
const activeTab = ref('transfer')

// 结果反馈弹窗
const showResultDialog = ref(false)
const resultType = ref('success')
const resultTitle = ref('')
const resultMessage = ref('')

// 显示结果弹窗
function showResult(type, title, message) {
  resultType.value = type
  resultTitle.value = title
  resultMessage.value = message
  showResultDialog.value = true
}

// ==================== 用户管理方法 ====================

// 动态读取，防止 localStorage 未设置时永远无权限
const ADMIN_CODE_LOCAL = () => localStorage.getItem('admin_code') || ''

async function loadAllUsers(page = 1) {
  usersLoading.value = true
  try {
    const apiBase = import.meta.env.DEV ? '/api' : 'https://ai-airdrop.uk/api'
    const res = await fetch(`${apiBase}/admin/auth/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: ADMIN_CODE_LOCAL(),
        page,
        limit: 30,
        search: userSearch.value,
        filter: userFilter.value
      })
    })
    const data = await res.json()
    if (data.success) {
      allUsers.value = data.users || []
      userStats.value = data.stats || { total: 0, activated: 0, inactive: 0, totalBalance: 0 }
      userPagination.value = data.pagination || { page: 1, limit: 30, total: 0, totalPages: 1 }
      userCurrentPage.value = page
    } else {
      console.error('加载用户失败:', data.message)
    }
  } catch (err) {
    console.error('加载用户数据失败:', err)
  } finally {
    usersLoading.value = false
  }
}

function onUserSearch() {
  clearTimeout(userSearchTimer)
  userSearchTimer = setTimeout(() => loadAllUsers(1), 400)
}

function onUserFilterChange() {
  loadAllUsers(1)
}

function goToUserPage(page) {
  loadAllUsers(page)
}

async function viewUserDetail(user) {
  selectedUser.value = user
  selectedUserDetail.value = null
  selectedUserLoading.value = true
  try {
    const res = await fetch('/api/admin/auth/user-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: adminCode.value, userId: user.id })
    })
    const json = await res.json()
    if (json.success) selectedUserDetail.value = json.data
  } catch (e) {}
  selectedUserLoading.value = false
}

function quickTransferToUser(userId) {
  selectedUser.value = null
  activeTab.value = 'transfer'
  transferForm.value.toUserId = userId
}

function viewUserTransactions(userId) {
  selectedUser.value = null
  router.push(`/transaction-history?userId=${userId}`)
}

// ==================== 原有方法 ====================

async function handleAdminTransfer() {
  if (!transferForm.value.toUserId) {
    showResult('error', '请输入用户ID', '请输入要充值的用户ID')
    return
  }
  
  if (!transferForm.value.amount || transferForm.value.amount <= 0) {
    showResult('error', '金额错误', '请输入正确的充值金额')
    return
  }
  
  try {
    const targetUserId = transferForm.value.toUserId.trim()
    const transferAmount = transferForm.value.amount

    console.log('========== 开始充值 ==========')
    console.log('目标用户ID:', targetUserId)
    console.log('充值金额:', transferAmount)

    // ========== 🔥 直接调用增量充值 API（从DB读取真实余额）==========
    let adminCode = ADMIN_CODE_LOCAL()
    if (!adminCode) {
      adminCode = prompt('请输入管理员登录码：')
      if (!adminCode) return
      localStorage.setItem('admin_code', adminCode.trim())
      adminCode = adminCode.trim()
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'https://ai-airdrop.uk'
    const response = await fetch(`${apiUrl}/api/admin/add-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUserId, amount: transferAmount, adminCode })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || '充值接口返回错误')
    }

    const { newBalance, previousBalance } = result.data
    console.log(`✅ 充值成功: ${previousBalance} + ${transferAmount} = ${newBalance}`)

    // 记录转账历史（管理后台显示）
    const record = {
      id: `ADMIN-${Date.now()}`,
      fromUserId: 'ADMIN',
      toUserId: targetUserId,
      amount: transferAmount,
      timestamp: Date.now()
    }
    recentTransfers.value.unshift(record)

    // 刷新用户列表
    loadAllUsers()

    showResult('success', '🎉 充值成功！', `已为用户 ${targetUserId} 充值 ${transferAmount}，当前余额: ${newBalance}`)

    // 清空表单
    transferForm.value = {
      toUserId: '',
      amount: 0
    }

  } catch (err) {
    console.error('❌ 充值失败:', err)
    showResult('error', '充值失败', err.message)
  }
}

async function queryUserBalance() {
  if (!queryUserId.value) {
    warning('请输入用户ID')
    return
  }

  const code = ADMIN_CODE_LOCAL()
  if (!code) {
    warning('请先设置管理员码')
    return
  }

  try {
    const res = await fetch('/api/admin/auth/user-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, userId: queryUserId.value.trim() })
    })
    const json = await res.json()
    if (json.success && json.data) {
      const u = json.data.user
      queriedUser.value = {
        id: u.id,
        balance: parseFloat(u.coin_balance) || parseFloat(u.balance) || 0,
        isActive: u.is_active,
        cardType: u.card_type,
        activatedTypes: u.activated_types,
        directPushCount: u.direct_push_count,
        isPartner: u.is_partner,
        inviteCode: u.invite_code,
        totalEarnings: parseFloat(u.total_earnings) || 0,
        repurchaseBalance: parseFloat(u.repurchase_balance) || 0,
        shoppingGold: parseFloat(u.shopping_gold) || 0,
      }
      success('查询成功')
    } else {
      queriedUser.value = null
      warning(json.message || '用户不存在（Supabase无记录）')
    }
  } catch (e) {
    queriedUser.value = null
    warning('查询失败: ' + e.message)
  }
}

function loadAdminTransfers() {
  try {
    const stored = localStorage.getItem('admin_transfers')
    if (stored) {
      recentTransfers.value = JSON.parse(stored)
    }
  } catch (err) {
    console.error('加载转账记录失败:', err)
  }
}

function saveAdminTransfers() {
  try {
    const data = recentTransfers.value.slice(0, 50)
    localStorage.setItem('admin_transfers', JSON.stringify(data))
  } catch (err) {
    console.error('保存转账记录失败:', err)
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// ==================== 配置管理 ====================

async function saveConfig() {
  let code = ADMIN_CODE_LOCAL()
  if (!code) {
    code = prompt('请输入管理员登录码：')
    if (!code) return
    localStorage.setItem('admin_code', code.trim())
    code = code.trim()
  }
  try {
    const { apiRequest: req } = await import('../config/api.js')
    const res = await req('/admin/auth/system-config', {
      method: 'POST',
      body: { adminCode: code, config: JSON.parse(JSON.stringify(configForm)) }
    })
    if (res.success) {
      showResult('success', '保存成功', '全局配置已保存到数据库')
    } else {
      showResult('error', '保存失败', res.message || '请重试')
    }
  } catch (e) {
    showResult('error', '保存失败', e.message)
  }
}

async function loadSystemConfig() {
  try {
    const { apiRequest: req } = await import('../config/api.js')
    const res = await req('/admin/auth/system-config')
    if (res.success && res.data) {
      for (const [key, value] of Object.entries(res.data)) {
        if (configForm[key] !== undefined && typeof value === 'object') {
          Object.assign(configForm[key], value)
        } else if (configForm[key] !== undefined) {
          configForm[key] = value
        }
      }
    }
  } catch (e) {
    console.warn('[Config] 加载系统配置失败:', e.message)
  }
}

function resetConfig() {
  if (!confirm('确定要恢复所有参数为默认值吗？')) return
  
  const result = rewardConfigManager.resetToDefault()
  if (result.success) {
    // 重新加载配置到表单
    const newConfig = rewardConfigManager.getConfig()
    Object.assign(configForm, JSON.parse(JSON.stringify(newConfig)))
    showResult('success', '已恢复默认', '所有参数已恢复为系统默认值')
  }
}

// ==================== 产品管理 ====================

function resetProductForm() {
  productEditId.value = null
  productForm.value = {
    zone: 'uae', week_label: '', title: '', description: '',
    price_balance: 0, price_original: 0, price_shopping_coin: 0, price_points: 0,
    spot_bonus_enabled: false, spot_bonus_rate: 0.30,
    level_bonus_enabled: false, level_bonus_rate: 0.10, level_depth: 6,
    stock: -1, sort_order: 0
  }
  productImages.value = ['', '', '']
}

function editProduct(product) {
  productEditId.value = product.id
  productForm.value = {
    zone: product.zone || 'uae',
    week_label: product.week_label || '',
    title: product.title || '',
    description: product.description || '',
    price_balance: product.price_balance || 0,
    price_original: product.price_original || 0,
    price_shopping_coin: product.price_shopping_coin || 0,
    price_points: product.price_points || 0,
    spot_bonus_enabled: product.spot_bonus_enabled || false,
    spot_bonus_rate: product.spot_bonus_rate || 0.30,
    level_bonus_enabled: product.level_bonus_enabled || false,
    level_bonus_rate: product.level_bonus_rate || 0.10,
    level_depth: product.level_depth || 6,
    stock: product.stock ?? -1,
    sort_order: product.sort_order || 0
  }
  // 解析JSON数组格式或旧版单URL格式
  try {
    const parsed = JSON.parse(product.image_url || '[]')
    productImages.value = Array.isArray(parsed)
      ? [parsed[0]||'', parsed[1]||'', parsed[2]||'']
      : [product.image_url||'', '', '']
  } catch { productImages.value = [product.image_url||'', '', ''] }
  // 滚到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function loadAdminProducts() {
  // admin_code 未设置时提示重新输入
  if (!ADMIN_CODE_LOCAL()) {
    const code = prompt('请输入管理员登录码（商品管理需要权限）：')
    if (code) localStorage.setItem('admin_code', code.trim())
    else return
  }
  productsLoading.value = true
  try {
    const { apiRequest } = await import('../config/api.js')
    const res = await apiRequest('/products/admin/list', {
      headers: { 'x-api-key': ADMIN_CODE_LOCAL() }
    })
    if (res.code === 200) {
      productsList.value = res.data || []
    } else if (res.message?.includes('权限') || res.code === 403) {
      // 权限错误：清除旧code，提示重新输入
      localStorage.removeItem('admin_code')
      const code = prompt('登录码已失效，请重新输入：')
      if (code) { localStorage.setItem('admin_code', code.trim()); loadAdminProducts() }
    } else {
      warning('加载商品失败: ' + res.message)
    }
  } catch (e) {
    warning('加载商品失败: ' + e.message)
  } finally {
    productsLoading.value = false
  }
}

async function handleSaveProduct() {
  if (!productForm.value.title) { warning('请输入商品名称'); return }
  if (!productForm.value.price_balance && !productForm.value.price_shopping_coin && !productForm.value.price_points) {
    warning('余额价、购物金、积分价格至少填一个'); return
  }
  productSaving.value = true
  try {
    const { apiRequest } = await import('../config/api.js')
    let res
    const adminHeaders = { 'x-api-key': ADMIN_CODE_LOCAL() }
    // 3张图存为JSON数组（向后兼容，旧产品单URL也能解析）
    const imgs = productImages.value.filter(u => u)
    const imageUrl = imgs.length > 1 ? JSON.stringify(imgs) : (imgs[0] || '')
    const body = { ...productForm.value, image_url: imageUrl }
    if (productEditId.value) {
      res = await apiRequest(`/products/admin/${productEditId.value}`, {
        method: 'PUT', body, headers: adminHeaders
      })
    } else {
      res = await apiRequest('/products/admin/create', {
        method: 'POST', body, headers: adminHeaders
      })
    }
    if (res.code === 200) {
      showResult('success', productEditId.value ? '更新成功' : '创建成功', `商品「${productForm.value.title}」已保存`)
      resetProductForm()
      await loadAdminProducts()
    } else {
      showResult('error', '保存失败', res.message)
    }
  } catch (e) {
    showResult('error', '保存失败', e.message)
  } finally {
    productSaving.value = false
  }
}

async function handleToggleStatus(product) {
  const newStatus = product.status === 'active' ? 'inactive' : 'active'
  try {
    const { apiRequest } = await import('../config/api.js')
    const res = await apiRequest(`/products/admin/${product.id}`, {
      method: 'PUT', body: { status: newStatus }, headers: { 'x-api-key': ADMIN_CODE_LOCAL() }
    })
    if (res.code === 200) {
      product.status = newStatus
      success(newStatus === 'active' ? '已上架' : '已下架')
    } else {
      warning('操作失败: ' + res.message)
    }
  } catch (e) {
    warning('操作失败: ' + e.message)
  }
}

async function handleDeleteProduct(productId) {
  if (!confirm('确定要删除这个商品吗？')) return
  try {
    const { apiRequest } = await import('../config/api.js')
    const res = await apiRequest(`/products/admin/${productId}`, { method: 'DELETE', headers: { 'x-api-key': ADMIN_CODE_LOCAL() } })
    if (res.code === 200) {
      productsList.value = productsList.value.filter(p => p.id !== productId)
      success('商品已删除')
    } else {
      warning('删除失败: ' + res.message)
    }
  } catch (e) {
    warning('删除失败: ' + e.message)
  }
}

// ==================== 信息管理 ====================

const infoTypeList = [
  { id: 'purchase',   icon: '📦', label: '采购需求' },
  { id: 'supply',     icon: '🏭', label: '供应信息' },
  { id: 'job',        icon: '💼', label: '招聘求职' },
  { id: 'house',      icon: '🏠', label: '房屋租售' },
  { id: 'secondhand', icon: '♻️', label: '二手交易' },
  { id: 'logistics',  icon: '🚢', label: '物流服务' },
  { id: 'service',    icon: '🔧', label: '商家服务' },
  { id: 'visa',       icon: '✈️', label: '旅游签证' },
  { id: 'social',     icon: '🎉', label: '交友聚会' },
  { id: 'promo',      icon: '📢', label: '社群广告' },
]

const infoFilterType = ref('all')
const allInfoPosts   = ref([])

const loadInfoPosts = () => {
  try { allInfoPosts.value = JSON.parse(localStorage.getItem('uae_publish_v1') || '[]') }
  catch { allInfoPosts.value = [] }
}

const filteredInfoPosts = computed(() =>
  allInfoPosts.value
    .filter(p => infoFilterType.value === 'all' || p.type === infoFilterType.value)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.timestamp - a.timestamp)
)

const infoStats = computed(() => {
  const all   = allInfoPosts.value
  const today = new Date(); today.setHours(0,0,0,0)
  return {
    total:  all.length,
    pinned: all.filter(p => p.pinned).length,
    today:  all.filter(p => p.timestamp >= today.getTime()).length,
  }
})

const infoTypeLabel = (id) => infoTypeList.find(t => t.id === id)?.label || id

const formatInfoTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
}

const toggleInfoPin = (post) => {
  post.pinned = !post.pinned
  localStorage.setItem('uae_publish_v1', JSON.stringify(allInfoPosts.value))
  loadInfoPosts()
  showResult('success', post.pinned ? '已置顶' : '已取消置顶', post.title)
}

const deleteInfoPost = (id) => {
  if (!confirm('确认删除此条信息？')) return
  allInfoPosts.value = allInfoPosts.value.filter(p => p.id !== id)
  localStorage.setItem('uae_publish_v1', JSON.stringify(allInfoPosts.value))
  showResult('success', '已删除', '信息已移除')
}

function goBack() {
  router.back()
}

// 重置安全问题（客服专用）
async function handleResetSecurityQuestion() {
  const uid = secResetUserId.value.trim()
  if (!uid) { secResetResult.value = { ok: false, msg: '请输入用户ID' }; return }
  if (!/^8\d{4}$/.test(uid)) { secResetResult.value = { ok: false, msg: '用户ID格式错误（8开头5位）' }; return }
  if (!confirm(`确认重置用户 ${uid} 的安全问题？重置后该用户可重新设置。`)) return
  isResettingSecurity.value = true
  secResetResult.value = null
  try {
    const res = await fetch('/api/auth/admin-reset-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode: ADMIN_CODE_LOCAL(), targetUserId: uid })
    })
    const data = await res.json()
    if (data.code === 200) {
      secResetResult.value = { ok: true, msg: `✅ ${data.message}` }
      secResetUserId.value = ''
    } else {
      secResetResult.value = { ok: false, msg: `❌ ${data.message}` }
    }
  } catch (e) {
    secResetResult.value = { ok: false, msg: '❌ 网络错误' }
  } finally {
    isResettingSecurity.value = false
  }
}

// 重置用户数据
async function handleResetUser() {
  const uid = resetUserId.value.trim()
  if (!uid) {
    showResult('error', '请输入用户ID', '')
    return
  }
  if (!/^8\d{4}$/.test(uid)) {
    showResult('error', '用户ID格式错误', '必须是8开头的5位数字')
    return
  }
  if (!confirm(`确定要彻底重置用户 ${uid} 的所有数据吗？此操作不可撤销！`)) return

  isResetting.value = true
  try {
    const res = await fetch('/api/admin/auth/reset-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: adminCode.value, userId: uid })
    })
    const data = await res.json()
    if (data.success) {
      showResult('success', '重置成功', `用户 ${uid} 的所有数据已清除`)
      resetUserId.value = ''
    } else {
      showResult('error', '重置失败', data.message)
    }
  } catch (err) {
    showResult('error', '网络错误', err.message)
  } finally {
    isResetting.value = false
  }
}

// 生成激活码（调用后端 API）
async function generateRedeemCode() {
  if (!redeemPlanType.value) {
    showResult('error', '请选择套餐', '请先选择激活套餐类型')
    return
  }

  isGeneratingCode.value = true
  generatedCodes.value = []

  try {
    const apiBase = import.meta.env.DEV ? '/api' : 'https://ai-airdrop.uk/api'
    const apiKey = import.meta.env.VITE_ENGINE_API_KEY || localStorage.getItem('adminApiKey') || ''
    const res = await fetch(`${apiBase}/redeem/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        planType: redeemPlanType.value,
        count: redeemCount.value || 1,
        createdBy: 'ADMIN'
      })
    })
    const data = await res.json()
    if (data.code === 200) {
      generatedCodes.value = data.data || []
      showResult('success', '激活码已生成', `生成了 ${generatedCodes.value.length} 个 ${redeemPlanType.value} 激活码`)
    } else {
      showResult('error', '生成失败', data.message || '请检查 API Key')
    }
  } catch (err) {
    showResult('error', '生成失败', err.message)
  } finally {
    isGeneratingCode.value = false
  }
}

// 复制充值码
function copyCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => {
      showResult('success', '已复制', code)
    })
  } else {
    showResult('success', '充值码', code)
  }
}

// ==================== 兑换审核方法 ====================

// 加载兑换记录
async function loadExchangeRecords() {
  loadingExchanges.value = true
  try {
    const status = exchangeFilter.value === 'all' ? '' : exchangeFilter.value
    const url = status ? `/api/exchange/all?status=${status}` : '/api/exchange/all'
    
    const response = await fetch(url)
    const result = await response.json()
    
    if (result.code === 200 && result.data) {
      exchangeRecords.value = result.data
    } else {
      exchangeRecords.value = []
    }
  } catch (err) {
    console.error('加载兑换记录失败:', err)
    error('加载失败', '无法加载兑换记录')
    exchangeRecords.value = []
  } finally {
    loadingExchanges.value = false
  }
}

// 审核通过
async function approveExchange(recordId) {
  if (!confirm('确定要通过这个兑换申请吗？')) return
  
  try {
    const response = await fetch(`/api/exchange/approve/${recordId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: currentUserId.value,
        note: '审核通过'
      })
    })
    
    const result = await response.json()
    
    if (result.code === 200) {
      success('审核成功', '已通过该兑换申请')
      // 重新加载记录
      await loadExchangeRecords()
    } else {
      error('审核失败', result.message || '请重试')
    }
  } catch (err) {
    console.error('审核失败:', err)
    error('审核失败', '网络错误，请重试')
  }
}

// 审核拒绝
async function rejectExchange(recordId) {
  const reason = prompt('请输入拒绝原因（可选）：')
  if (reason === null) return // 用户取消
  
  try {
    const response = await fetch(`/api/exchange/reject/${recordId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: currentUserId.value,
        note: reason || '审核拒绝'
      })
    })
    
    const result = await response.json()
    
    if (result.code === 200) {
      success('已拒绝', '已拒绝该兑换申请，余额已退回用户')
      // 重新加载记录
      await loadExchangeRecords()
    } else {
      error('操作失败', result.message || '请重试')
    }
  } catch (err) {
    console.error('操作失败:', err)
    error('操作失败', '网络错误，请重试')
  }
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    'pending': '⏳ 待审核',
    'approved': '✅ 已通过',
    'rejected': '❌ 已拒绝',
    'completed': '✅ 已完成'
  }
  return statusMap[status] || status
}

// 清空所有数据
async function clearAllData() {
  // 第一步：确认操作
  if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) {
    return
  }
  
  // 第二步：验证管理员密码
  const password = prompt('请输入管理员密码以确认清空操作：')
  if (!password) return
  
  // 调用后端 API 验证密码
  const isValid = await verifyAdminPassword(password)
  
  if (!isValid) {
    error('密码错误', '清空操作已取消')
    return
  }
  
  // 第三步：再次确认
  if (!confirm('⚠️ 最后确认：真的要清空所有数据吗？')) {
    return
  }
  
  // 执行清空
  localStorage.clear()
  success('所有数据已清空', '页面将在3秒后刷新')
  
  setTimeout(() => {
    location.reload()
  }, 3000)
}

// ==================== 密码管理 ====================

// 修改登录码
async function changeLoginCode() {
  const { currentLoginCode, newLoginCode, confirmLoginCode } = passwordForm
  
  // 验证输入
  if (!currentLoginCode || !newLoginCode || !confirmLoginCode) {
    error('请填写完整', '所有字段都必须填写')
    return
  }
  
  if (newLoginCode !== confirmLoginCode) {
    error('两次输入不一致', '请确认新登录码')
    return
  }
  
  if (newLoginCode.length < 6) {
    error('登录码太短', '至少需要6位')
    return
  }
  
  // 调用后端 API 修改
  const result = await changeAdminLoginCode(currentLoginCode, newLoginCode)
  
  if (result.success) {
    success('修改成功', result.message)
    // 清空表单
    passwordForm.currentLoginCode = ''
    passwordForm.newLoginCode = ''
    passwordForm.confirmLoginCode = ''
  } else {
    error('修改失败', result.message)
  }
}

// 修改操作密码
async function changeOperationPassword() {
  const { currentPassword, newPassword, confirmPassword } = passwordForm
  
  // 验证输入
  if (!currentPassword || !newPassword || !confirmPassword) {
    error('请填写完整', '所有字段都必须填写')
    return
  }
  
  if (newPassword !== confirmPassword) {
    error('两次输入不一致', '请确认新密码')
    return
  }
  
  if (newPassword.length < 6) {
    error('密码太短', '至少需要6位')
    return
  }
  
  // 调用后端 API 修改
  const result = await changeAdminPassword(currentPassword, newPassword)
  
  if (result.success) {
    success('修改成功', result.message)
    // 清空表单
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } else {
    error('修改失败', result.message)
  }
}


// ==================== 生命周期 ====================

// ==================== 群管理 ====================

const groupForms = ref([
  { type: 'whatsapp', name: '', price: '免费', qr_url: '', enabled: true, saving: false, uploading: false },
  { type: 'wechat',   name: '', price: '免费', qr_url: '', enabled: true, saving: false, uploading: false }
])

async function loadGroupData() {
  try {
    const res = await fetch('/api/groups')
    const data = await res.json()
    if (data.code === 200 && data.data) {
      data.data.forEach(g => {
        const form = groupForms.value.find(f => f.type === g.type)
        if (form) {
          form.name = g.name || ''
          form.price = g.price || '免费'
          form.qr_url = g.qr_url || ''
        }
      })
    }
  } catch {}
}

async function handleQrUpload(event, group) {
  const file = event.target.files?.[0]
  if (!file) return
  group.uploading = true
  try {
    const { uploadFile } = await import('../services/uploadService.js')
    const result = await uploadFile(file, 'image')
    group.qr_url = result.url
  } catch (err) {
    showResult('error', '上传失败', err.message)
  } finally {
    group.uploading = false
    event.target.value = ''
  }
}

async function saveGroup(group) {
  group.saving = true
  try {
    const apiKey = import.meta.env.VITE_ENGINE_API_KEY || localStorage.getItem('adminApiKey') || ''
    const res = await fetch('/api/groups/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        type: group.type,
        name: group.name,
        price: group.price,
        qr_url: group.qr_url,
        enabled: group.enabled
      })
    })
    const data = await res.json()
    if (data.code === 200) {
      showResult('success', '保存成功', `${group.type === 'whatsapp' ? 'WhatsApp' : 'WeChat'} 群信息已更新`)
    } else {
      showResult('error', '保存失败', data.message)
    }
  } catch (err) {
    showResult('error', '网络错误', err.message)
  } finally {
    group.saving = false
  }
}

// ==================== 分润管理方法 ====================

async function loadProfitStats() {
  loadingProfitStats.value = true
  try {
    const apiBase = import.meta.env.DEV ? '/api' : 'https://ai-airdrop.uk/api'
    const res = await fetch(`${apiBase}/subscription/profit-stats`, {
      headers: { 'X-Admin-Secret': restartAdminCode.value || ADMIN_CODE_LOCAL() }
    })
    const json = await res.json()
    if (json.code === 200 && json.data) {
      profitStats.value = {
        count:       json.data.count       || 0,
        totalProfit: json.data.totalProfit || 0,
        elite:       json.data.elite       || 0,
        tier100:     json.data.tier100     || 0,
        tier200:     json.data.tier200     || 0
      }
    }
  } catch (e) {
    console.error('[ProfitStats] load error', e)
  } finally {
    loadingProfitStats.value = false
  }
}

async function handleRestartProfit() {
  if (!restartAdminCode.value) { alert('请输入管理员密码'); return }
  isRestartingProfit.value = true
  restartProfitResult.value = null
  try {
    const apiBase = import.meta.env.DEV ? '/api' : 'https://ai-airdrop.uk/api'
    const res = await fetch(`${apiBase}/subscription/admin/restart-profit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': restartAdminCode.value }
    })
    const json = await res.json()
    if (json.code === 200) {
      restartProfitResult.value = {
        ok: true,
        msg: `✅ 重启全部成功！处理 ${json.data?.processedUsers || 0} 位用户，共打入余额 ${(json.data?.totalProfitPaid || 0).toFixed(2)} 元`
      }
      restartConfirming.value = false
      restartAdminCode.value = ''
      await loadProfitStats()
    } else {
      restartProfitResult.value = { ok: false, msg: `❌ ${json.message || '操作失败'}` }
    }
  } catch (e) {
    restartProfitResult.value = { ok: false, msg: `❌ 网络错误：${e.message}` }
  } finally {
    isRestartingProfit.value = false
  }
}

async function handleRestartProfitTier200() {
  if (!restartAdminCode2.value) { alert('请输入管理员密码'); return }
  isRestartingProfit2.value = true
  restartProfitResult2.value = null
  try {
    const apiBase = import.meta.env.DEV ? '/api' : 'https://ai-airdrop.uk/api'
    const res = await fetch(`${apiBase}/subscription/admin/restart-profit/tier200`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': restartAdminCode2.value }
    })
    const json = await res.json()
    if (json.code === 200) {
      restartProfitResult2.value = {
        ok: true,
        msg: `✅ 仅重启200+300档成功！处理 ${json.data?.processedUsers || 0} 位用户，共打入余额 ${(json.data?.totalProfitPaid || 0).toFixed(2)} 元。100档用户继续正常累利。`
      }
      restartConfirming2.value = false
      restartAdminCode2.value = ''
      await loadProfitStats()
    } else {
      restartProfitResult2.value = { ok: false, msg: `❌ ${json.message || '操作失败'}` }
    }
  } catch (e) {
    restartProfitResult2.value = { ok: false, msg: `❌ 网络错误：${e.message}` }
  } finally {
    isRestartingProfit2.value = false
  }
}

onMounted(() => {
  // 安全检查：如果未验证管理员，退回个人中心
  if (!isAdminAuthenticated()) {
    router.replace('/profile')
    return
  }
  loadSystemConfig()
  loadAdminTransfers()
  loadAllUsers()
  loadExchangeRecords()
  loadAdminProducts()
  loadTokenRedemptions()
  loadWithdrawals()
  loadTokenRedeemRate()
  loadInfoPosts()
  loadGroupData()
  loadProfitStats()
  loadPartnerList()
})
</script>

<style scoped>
.admin-panel {
  height: 100vh;
  background: #F5F5F5;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #FFF;
  border-bottom: 1px solid #E5E5E5;
  flex-shrink: 0;
}

.admin-tabs {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #E5E5E5;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.admin-tabs::-webkit-scrollbar {
  display: none;
}

.back-btn-header {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: #000;
  margin: 0;
}

.admin-badge {
  font-size: 11px;
  background: linear-gradient(135deg, #F7B500, #FFC700);
  color: #FFF;
  padding: 2px 8px;
  border-radius: 10px;
}

/* 顶部 2行×5列 分类网格 */
.admin-tab-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  background: #fff;
  border-bottom: 1px solid #E5E5E5;
  flex-shrink: 0;
}

.grid-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 10px 4px;
  border: none;
  border-right: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
  cursor: pointer;
  transition: background .15s;
  position: relative;
}
.grid-tab:nth-child(5n) { border-right: none; }
.grid-tab:nth-child(n+6) { border-bottom: none; }

.grid-tab:active { background: #FFF8E6; }

.grid-tab-active {
  background: linear-gradient(135deg, #FFF8E6, #FFF3CD) !important;
}
.grid-tab-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  background: #F7B500;
  border-radius: 1px;
}

.grid-tab-icon { font-size: 18px; line-height: 1; }
.grid-tab-text {
  font-size: 11px;
  color: #444;
  font-weight: 500;
  white-space: nowrap;
}
.grid-tab-active .grid-tab-text { color: #D48806; font-weight: 700; }

/* 主体区域（全宽内容） */
.main-body {
  flex: 1;
  overflow: visible;
  display: flex;
  min-height: 0;
}

/* 内容区 */
.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.content-section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 卡片 */
.quick-transfer-card,
.query-card,
.recent-transfers {
  background: #FFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 12px;
  color: #999;
  margin-bottom: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

/* 表单 */
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

/* 金额按钮 */
.amount-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.amount-btn {
  padding: 8px 14px;
  background: #F5F5F5;
  border: 1px solid #E0E0E0;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.amount-btn:hover {
  background: rgba(247, 181, 0, 0.1);
  border-color: #F7B500;
  color: #F7B500;
}

.amount-btn.active {
  background: rgba(102, 126, 234, 0.12);
  border-color: #667EEA;
  color: #667EEA;
  font-weight: 600;
}

.code-plan-tag {
  font-size: 11px;
  background: #667EEA;
  color: white;
  border-radius: 4px;
  padding: 1px 6px;
  margin-left: 8px;
  vertical-align: middle;
}

/* 类型切换 */
.type-switch {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  padding: 10px;
  background: #F5F5F5;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn.active {
  background: linear-gradient(135deg, #F7B500, #FFC700);
  border-color: transparent;
  color: #FFF;
}

/* 转账按钮 */
.transfer-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #F7B500, #FFC700);
  color: #FFF;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.transfer-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(247, 181, 0, 0.3);
}

/* 查询 */
.query-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.query-row .flex-1 {
  flex: 1;
}

.tab-item {
  padding: 8px 16px;
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s;
  flex-shrink: 0;
}

.query-btn {
  padding: 12px 20px;
  background: #333;
  color: #FFF;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

/* 用户信息卡片 */
.user-info-card {
  background: #F9F9F9;
  border-radius: 10px;
  padding: 14px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.user-id {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.status-tag.landlord {
  background: rgba(7, 193, 96, 0.1);
  color: #07C160;
}

.status-tag.pending {
  background: rgba(247, 181, 0, 0.1);
  color: #F7B500;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.info-item {
  background: #FFF;
  border-radius: 8px;
  padding: 10px;
}

.info-item .label {
  display: block;
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}

.info-item .value {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.info-item .value.success {
  color: #07C160;
}

.info-item .value.gold {
  color: #F7B500;
}

/* 转账记录 */
.empty-state {
  text-align: center;
  padding: 30px;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 10px;
}

.empty-text {
  font-size: 14px;
  color: #999;
}

.transfer-record {
  background: #F9F9F9;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.record-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.record-badge.admin {
  background: rgba(247, 181, 0, 0.1);
  color: #F7B500;
}

.record-time {
  font-size: 12px;
  color: #999;
}

.record-content {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.record-info {
  font-size: 13px;
}

.record-info .label {
  color: #999;
}

.record-info .value {
  color: #333;
}

.record-info .value.amount {
  color: #07C160;
  font-weight: 600;
}

/* 返回按钮 */
.back-btn {
  width: 100%;
  padding: 14px;
  background: #F5F5F5;
  color: #666;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 10px;
}

/* 类型卡片 */
.type-card {
  background: #FFF;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #E5E5E5;
}

.type-card.premium {
  background: linear-gradient(135deg, rgba(247, 227, 175, 0.1) 0%, rgba(247, 181, 0, 0.05) 100%);
  border-color: #F7B500;
}

.type-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.type-stats .stat-item {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #F9F9F9;
  border-radius: 8px;
}

.type-stats .stat-label {
  display: block;
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.type-stats .stat-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #F7B500;
}

.type-desc {
  font-size: 13px;
  color: #666;
  margin: 0;
}

/* 设置卡片 */
.settings-card,
.cleanup-card,
.custom-card {
  background: #FFF;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.coming-soon {
  font-size: 16px;
  color: #999;
  margin: 0 0 8px 0;
}

.settings-hint {
  font-size: 13px;
  color: #999;
  margin: 0;
}

/* 群管理 */
.group-admin-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.group-admin-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #111;
}
.form-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.form-row label {
  min-width: 72px;
  font-size: 13px;
  color: #555;
}
.admin-input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
}
.admin-input:focus { border-color: #07C160; }
.qr-upload-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qr-preview {
  width: 100px;
  height: 100px;
  object-fit: contain;
  border: 1px solid #eee;
  border-radius: 8px;
}
.qr-file-input {
  font-size: 12px;
  color: #555;
}
.qr-upload-hint {
  font-size: 12px;
  color: #999;
}
.toggle-row { align-items: center; }
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  inset: 0;
  background: #ccc;
  border-radius: 24px;
  cursor: pointer;
  transition: 0.3s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}
.toggle-switch input:checked + .toggle-slider { background: #07C160; }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(18px); }
.toggle-label { font-size: 13px; color: #555; }
.save-btn {
  width: 100%;
  padding: 10px;
  background: #07C160;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}
.save-btn:disabled { opacity: 0.6; }

/* 危险按钮 */
.danger-btn {
  padding: 14px 32px;
  background: linear-gradient(135deg, #FF6B6B 0%, #E74C3C 100%);
  color: #FFF;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 12px;
}

.warning-text {
  font-size: 12px;
  color: #E74C3C;
  margin: 0;
}

/* 小标题 */
.sub-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin: 16px 0 12px 0;
}

/* 小型空状态 */
.empty-state-small {
  font-size: 13px;
  color: #999;
  text-align: center;
  padding: 20px;
}

/* 记录内容行内 */
.record-content .amount {
  color: #07C160;
  font-weight: 600;
}

.record-content .type {
  color: #F7B500;
  font-size: 12px;
}

/* 结果反馈弹窗 */
.result-overlay {
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
}

.result-box {
  background: #FFF;
  border-radius: 16px;
  padding: 30px 24px;
  text-align: center;
  max-width: 300px;
  width: 85%;
  animation: popIn 0.3s ease;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.result-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.result-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.result-box.success .result-title {
  color: #07C160;
}

.result-box.error .result-title {
  color: #E74C3C;
}

.result-message {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
}

.result-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #F7B500 0%, #FFC700 100%);
  color: #FFF;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

/* ==================== 配置界面样式 ==================== */
.config-card {
  background: #FFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.config-header {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #F0F0F0;
}

.config-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.config-row label {
  flex: 1;
  font-size: 14px;
  color: #666;
}

.config-row input {
  width: 80px;
  padding: 8px 10px;
  border: 1px solid #E0E0E0;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.config-row input:focus {
  outline: none;
  border-color: #F7B500;
}

.config-unit {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
  min-width: 50px;
}

.config-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.save-btn {
  flex: 1;
  padding: 14px;
  background: linear-gradient(135deg, #07C160 0%, #10D56A 100%);
  color: #FFF;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.reset-btn {
  flex: 1;
  padding: 14px;
  background: #F5F5F5;
  color: #666;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.reset-btn:hover {
  background: #EBEBEB;
}

/* 订阅套餐网格 */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.plan-card {
  background: #FFF;
  border: 2px solid #E5E5E5;
  border-radius: 14px;
  padding: 16px;
  text-align: center;
  position: relative;
}

.plan-card.premium {
  border-color: #4CAF50;
  background: #F1F8E9;
}

.plan-badge {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 12px;
  background: linear-gradient(135deg, #4CAF50, #8BC34A);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 10px;
}

.plan-name {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
  margin-bottom: 8px;
}

.plan-price {
  font-size: 28px;
  font-weight: 700;
  color: #F7B500;
  margin-bottom: 4px;
}

.plan-days {
  font-size: 13px;
  color: #999;
}

.config-value {
  font-size: 14px;
  font-weight: 600;
  color: #F7B500;
}

.status-tag.member {
  background: #4CAF50;
  color: white;
}

/* 产品管理样式 */
.product-form-card {
  background: white;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
}
.img-upload-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.img-upload-row .form-input { flex: 1; }
.img-upload-btn {
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.img-upload-btn:disabled,
.img-upload-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}
.img-preview-wrap {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
  width: 100%;
  max-height: 160px;
}
.img-preview {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 8px;
}

.card-subtitle {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}

.form-group.half {
  flex: 1;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #F7B500;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-size: 14px;
  min-height: 80px;
  resize: vertical;
  box-sizing: border-box;
}

.image-upload {
  margin-top: 6px;
}

.upload-preview {
  width: 100%;
  height: 120px;
  border: 2px dashed #E0E0E0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background: #FAFAFA;
}

.upload-preview:hover {
  border-color: #F7B500;
  background: #FFF8E1;
}

.upload-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-preview span {
  color: #999;
  font-size: 14px;
}

.products-list {
  background: white;
  border-radius: 14px;
  padding: 16px;
}

.sub-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.empty-state-small {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 14px;
}

.product-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #F8F9FA;
  border-radius: 10px;
  margin-bottom: 8px;
}

.product-thumb {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  object-fit: cover;
}

.product-info {
  flex: 1;
}

.product-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.product-price {
  font-size: 12px;
  margin-top: 4px;
}

.price-usdt {
  color: #F7B500;
  font-weight: 600;
}

.price-coin {
  color: #999;
  margin-left: 6px;
}

.delete-btn-small {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #F44336;
  color: white;
  font-size: 16px;
  cursor: pointer;
}

/* 产品管理新样式 */
.bonus-toggles {
  background: #F8F9FA;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toggle-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.toggle-rate {
  font-size: 12px;
  color: #666;
  padding-left: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rate-input {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid #DDD;
  border-radius: 6px;
  font-size: 12px;
}

.form-btns {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.cancel-small-btn {
  padding: 10px 16px;
  border: 2px solid #E0E0E0;
  border-radius: 10px;
  background: white;
  color: #666;
  font-size: 13px;
  cursor: pointer;
}

.refresh-btn {
  padding: 4px 10px;
  border: 1px solid #DDD;
  border-radius: 6px;
  background: white;
  font-size: 12px;
  cursor: pointer;
}

.product-item-new {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px;
  background: white;
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid #EFEFEF;
  gap: 10px;
}

.product-item-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.product-thumb-placeholder {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  background: #F0F0F0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.product-item-info {
  flex: 1;
  min-width: 0;
}

.product-item-title {
  font-size: 13px;
  font-weight: 600;
  color: #2C3E50;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.meta-zone { font-size: 12px; }

.meta-price {
  font-size: 11px;
  padding: 1px 6px;
  background: #FFF3E0;
  color: #E65100;
  border-radius: 4px;
}

.meta-stock {
  font-size: 11px;
  padding: 1px 6px;
  background: #E8F5E9;
  color: #2E7D32;
  border-radius: 4px;
}

.meta-bonus {
  font-size: 11px;
  padding: 1px 6px;
  background: linear-gradient(135deg, #F7B500, #FFC700);
  color: white;
  border-radius: 4px;
}

.product-item-status {
  font-size: 11px;
  font-weight: 600;
}

.product-item-status.active { color: #4CAF50; }
.product-item-status.inactive { color: #999; }

.product-item-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn-edit, .action-btn-toggle, .action-btn-delete {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.action-btn-edit { background: #E3F2FD; color: #1565C0; }
.action-btn-toggle { background: #F3E5F5; color: #6A1B9A; }
.action-btn-delete { background: #FFEBEE; color: #B71C1C; }

/* 充值码样式 */
.generated-code {
  margin-top: 20px;
  padding: 16px;
  background: #f0f9ff;
  border-radius: 12px;
  border: 2px dashed #3b82f6;
}

.code-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}

.code-value {
  font-size: 24px;
  font-weight: 700;
  color: #2563eb;
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  user-select: all;
  margin-bottom: 8px;
}

.code-value:hover {
  background: #f8fafc;
}

.code-info {
  font-size: 12px;
  color: #64748b;
}

/* ==================== 密码设置样式 ==================== */
.password-section {
  margin-bottom: 30px;
}

.password-title {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
  margin-bottom: 8px;
}

.password-hint {
  font-size: 13px;
  color: #999;
  margin-bottom: 16px;
}

.password-hint.warning-hint {
  color: #E74C3C;
  font-weight: 500;
}

.password-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #E5E5E5;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s;
}

.password-input:focus {
  outline: none;
  border-color: #F7B500;
  box-shadow: 0 0 0 3px rgba(247, 181, 0, 0.1);
}

.change-password-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667EEA, #764BA2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 16px;
}

.change-password-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.reset-password-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #E74C3C, #C0392B);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 16px;
}

.reset-password-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
}

.divider {
  height: 1px;
  background: linear-gradient(to right, transparent, #E5E5E5, transparent);
  margin: 30px 0;
}

/* ==================== 兑换审核样式 ==================== */

.exchange-list {
  margin-top: 20px;
}

.exchange-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.exchange-table .table-header {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1.5fr 1fr 1.5fr;
  gap: 12px;
  padding: 16px 20px;
  background: #F8F9FA;
  border-bottom: 1px solid #E5E7EB;
  font-weight: 600;
  font-size: 13px;
  color: #6B7280;
}

.exchange-table .table-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1.5fr 1fr 1.5fr;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #F3F4F6;
  transition: background 0.2s;
}

.exchange-table .table-row:hover {
  background: #F9FAFB;
}

.exchange-table .table-row:last-child {
  border-bottom: none;
}

.exchange-table .td {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.exchange-table .td-user .user-id-text {
  font-family: 'Courier New', monospace;
  color: #374151;
  font-weight: 500;
}

.exchange-table .td-amount .amount-value {
  font-size: 16px;
  font-weight: 600;
}

.exchange-table .td-time .time-text {
  font-size: 13px;
  color: #6B7280;
}

.exchange-table .status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.exchange-table .status-badge.pending {
  background: #FEF3C7;
  color: #D97706;
}

.exchange-table .status-badge.approved {
  background: #D1FAE5;
  color: #059669;
}

.exchange-table .status-badge.rejected {
  background: #FEE2E2;
  color: #DC2626;
}

.exchange-table .status-badge.completed {
  background: #DBEAFE;
  color: #2563EB;
}

.exchange-table .td-actions {
  display: flex;
  gap: 8px;
}

.exchange-table .action-btn.approve {
  padding: 6px 12px;
  background: linear-gradient(135deg, #10B981, #059669);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.exchange-table .action-btn.approve:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.exchange-table .action-btn.reject {
  padding: 6px 12px;
  background: linear-gradient(135deg, #EF4444, #DC2626);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.exchange-table .action-btn.reject:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.exchange-table .processed-info {
  font-size: 12px;
  color: #9CA3AF;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6B7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #E5E7EB;
  border-top-color: #667EEA;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.refresh-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: #F9FAFB;
  border-color: #D1D5DB;
}

.stat-value.pending {
  color: #D97706;
}

.stat-value.approved {
  color: #059669;
}

.stat-value.rejected {
  color: #DC2626;
}

/* ===== 信息管理 ===== */
.info-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 0 6px;
}
.info-ftab {
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: #666;
  white-space: nowrap;
}
.info-ftab.active {
  background: #07c160;
  color: #fff;
  border-color: #07c160;
  font-weight: 600;
}

.info-list { margin-top: 8px; display: flex; flex-direction: column; gap: 10px; }

.info-item-card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  padding: 12px 14px;
}
.info-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.info-type-tag {
  font-size: 11px;
  background: #e8f5e9;
  color: #07c160;
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 600;
}
.info-pin-badge { font-size: 11px; color: #c8a84b; }
.info-city      { font-size: 11px; color: #999; }
.info-time      { font-size: 11px; color: #ccc; margin-left: auto; }

.info-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}
.info-item-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}
.info-cat   { font-size: 11px; color: #888; background: #f5f5f5; padding: 2px 7px; border-radius: 8px; }
.info-price { font-size: 12px; color: #e67e22; font-weight: 600; }

.info-item-desc {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.info-item-contact {
  font-size: 12px;
  color: #07c160;
  margin-bottom: 8px;
}
.info-item-actions { display: flex; gap: 8px; }
.info-act-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
}
.pin-btn { background: #e8f5e9; color: #07c160; }
.pin-btn:hover { background: #c8e6c9; }

/* ===== 商品管理重设计 ===== */
.prod-form-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.prod-form-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}
.prod-section-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  margin-top: 16px;
  font-weight: 500;
}
.prod-section-label:first-of-type { margin-top: 0; }
.prod-tip { font-size: 11px; color: #999; font-weight: 400; margin-left: 4px; }

/* 图片上传区 */
.prod-img-row {
  display: flex;
  gap: 10px;
}
/* 图片格子：同QR上传布局 */
.prod-img-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.slot-preview {
  width: 95px;
  height: 95px;
  border: 1.5px dashed #d0d0d0;
  border-radius: 8px;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
/* 原生可见input，同QR方式，PWA/iOS/Android全通 */
.slot-native-btn {
  width: 95px;
  font-size: 11px;
  color: #555;
  cursor: pointer;
}
.slot-overlay-input { display: none; }
.slot-file-btn {
  display: none;
}
.slot-img {
  width: 100%; height: 100%;
  object-fit: cover;
}
.slot-empty { text-align: center; }
.slot-plus { font-size: 28px; color: #bbb; line-height: 1; }
.slot-label { font-size: 11px; color: #bbb; margin-top: 2px; }
.slot-loading { font-size: 20px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 表单布局 */
.prod-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.prod-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.prod-field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 12px; color: #666; }
.prod-input {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  background: #fafafa;
  width: 100%;
  box-sizing: border-box;
}
.prod-textarea {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  background: #fafafa;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}
.prod-input:focus, .prod-textarea:focus { border-color: #6366f1; outline: none; }

/* 奖励区 */
.prod-bonus-row { display: flex; flex-direction: column; gap: 10px; }
.prod-toggle-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.prod-checkbox { width: 18px; height: 18px; cursor: pointer; }
.rate-input {
  width: 60px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  background: #fafafa;
}
.rate-unit { font-size: 12px; color: #888; }

/* 按钮 */
.prod-submit-btn {
  width: 100%;
  margin-top: 20px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 13px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.prod-submit-btn:disabled { opacity: 0.6; }
.prod-cancel-btn {
  width: 100%;
  margin-top: 8px;
  background: #f5f5f5;
  color: #666;
  border: none;
  border-radius: 10px;
  padding: 11px;
  font-size: 14px;
  cursor: pointer;
}

/* 商品列表 */
.prod-list-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}
.prod-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}
.loading-wrap { text-align: center; padding: 24px; }
.empty-wrap { text-align: center; padding: 24px; color: #999; font-size: 14px; }
.spinner {
  width: 28px; height: 28px;
  border: 3px solid #e0e0e0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}
.prod-list { display: flex; flex-direction: column; gap: 10px; }
.prod-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #fafafa;
  border-radius: 8px;
}
.prod-list-img {
  width: 56px; height: 56px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}
.prod-list-img-ph {
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
  background: #eee; border-radius: 6px;
  font-size: 20px; flex-shrink: 0;
}
.prod-list-info { flex: 1; min-width: 0; }
.prod-list-name { font-size: 14px; font-weight: 500; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prod-list-meta { font-size: 12px; color: #999; margin-top: 2px; }
.prod-list-actions { display: flex; gap: 6px; flex-shrink: 0; }
.edit-btn {
  background: #6366f1; color: #fff;
  border: none; border-radius: 6px;
  padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.del-btn {
  background: #ff4d4f; color: #fff;
  border: none; border-radius: 6px;
  padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.toggle-btn {
  border: none; border-radius: 6px;
  padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.btn-off { background: #ff9500; color: #fff; }
.btn-on  { background: #34c759; color: #fff; }
</style>




/* ==================== 用户管理样式（重设计）==================== */
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 700;
  color: #333;
  margin-bottom: 12px;
}

/* 统计4格 */
.stats-4grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.stat4-card {
  background: #FFF;
  border-radius: 10px;
  padding: 10px 6px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.stat4-card.green { border-top: 3px solid #07C160; }
.stat4-card.gray  { border-top: 3px solid #999; }
.stat4-card.gold  { border-top: 3px solid #F7B500; }
.stat4-num {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  line-height: 1.2;
}
.stat4-lbl {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

/* 搜索栏 */
.user-filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.user-search-input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}
.user-search-input:focus { border-color: #F7B500; }
.filter-select-sm {
  padding: 8px 10px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-size: 13px;
  background: #FFF;
  cursor: pointer;
  min-width: 70px;
}

/* 用户卡片列表 */
.user-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.loading-tip {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 14px;
}
.user-item-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #FFF;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: background 0.15s;
}
.user-item-card:active { background: #FAFAFA; }

/* 头像 */
.uic-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #FFF;
  flex-shrink: 0;
}
.uic-avatar.active  { background: linear-gradient(135deg, #07C160, #5AC87C); }
.uic-avatar.inactive { background: linear-gradient(135deg, #CCC, #AAA); }

/* 中间body */
.uic-body { flex: 1; min-width: 0; }
.uic-top {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.uic-id   { font-size: 14px; font-weight: 700; color: #333; }
.uic-nick { font-size: 12px; color: #888; }
.uic-tier {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #EEE;
  color: #666;
}
.uic-tier.basic   { background: #E8F5E9; color: #07C160; }
.uic-tier.premium { background: #FFF8E1; color: #F7B500; }
.uic-tier.elite   { background: #FDE8E8; color: #E53935; }
.uic-bottom { display: flex; gap: 8px; flex-wrap: wrap; }
.uic-stat { font-size: 12px; color: #999; }
.uic-stat b { color: #333; font-weight: 600; }
.uic-partner { font-size: 11px; background: #fff7e6; color: #f59e0b; border-radius: 4px; padding: 1px 5px; font-weight: 600; }
.uic-ref { color: #aaa; }

/* 直推列表 */
.direct-push-list { border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; font-size: 12px; }
.dp-header { display: grid; grid-template-columns: 1fr 1fr 0.7fr 0.8fr 0.7fr; gap: 4px; padding: 6px 10px; background: #f7f7f7; color: #999; font-weight: 600; }
.dp-row { display: grid; grid-template-columns: 1fr 1fr 0.7fr 0.8fr 0.7fr; gap: 4px; padding: 7px 10px; border-top: 1px solid #f0f0f0; }
.dp-row:hover { background: #fafafa; }
.dp-id { font-family: monospace; color: #666; }

/* 右侧状态 */
.uic-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}
.uic-status {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.uic-status.on  { background: #E8F5E9; color: #07C160; }
.uic-status.off { background: #F5F5F5; color: #999; }
.uic-arrow { font-size: 18px; color: #CCC; line-height: 1; }

.form-select {
  padding: 10px 12px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-size: 14px;
  background: #FFF;
  cursor: pointer;
}

.action-btn {
  padding: 6px 14px;
  background: #F7B500;
  color: #FFF;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.action-btn:hover { opacity: 0.8; }

.copy-addr-btn {
  background: none; border: none;
  cursor: pointer; font-size: 14px;
  padding: 2px 4px; border-radius: 4px;
  flex-shrink: 0;
}
.copy-addr-btn:hover { background: #f0f0f0; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: #FFF;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.page-btn {
  padding: 8px 16px;
  background: #F7B500;
  color: #FFF;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.page-btn:hover:not(:disabled) {
  opacity: 0.8;
}

.page-btn:disabled {
  background: #E0E0E0;
  color: #999;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #666;
}

/* 用户详情弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.user-detail-modal {
  background: #FFF;
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #E5E5E5;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #F5F5F5;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #E5E5E5;
}

.detail-content {
  padding: 20px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #F0F0F0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item .label {
  font-size: 12px;
  color: #999;
}

.detail-item .value {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.detail-item .value.gold {
  color: #F7B500;
}

.detail-item .value.text-success {
  color: #07C160;
}

.detail-item .value.text-warning {
  color: #FF9500;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.action-btn-large {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  background: #F5F5F5;
  color: #666;
  transition: opacity 0.2s;
}

.action-btn-large:hover {
  opacity: 0.8;
}

.action-btn-large.primary {
  background: linear-gradient(135deg, #F7B500 0%, #FFC700 100%);
  color: #FFF;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

/**
 * 合伙人服务 - Partner Service
 * 提供合伙人相关的业务逻辑
 * 
 * 功能：
 * - 合伙人资格检查
 * - 合伙人信息查询
 * - 微信二维码上传
 * - 分红统计计算
 */

const PARTNER_CONFIG = {
    DIRECT_PUSH_REQUIRED: 10,    // 合伙人直推要求
    TEAM_SIZE_REQUIRED: 50,      // 合伙人团队要求（6层内）
    TEAM_DEPTH: 6,               // 团队统计深度
    DIVIDEND_RATE: 0.16          // 合伙人分红比例 16%
}

/**
 * 检查用户是否满足合伙人资格标准
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Object>} 资格状态和要求
 */
export async function checkPartnerEligibility(supabase, userId) {
    try {
        // 查询用户的直推人数和团队人数
        const { data: user, error } = await supabase
            .from('users')
            .select('direct_push_count, team_count_6_layers')
            .eq('id', userId)
            .single()

        if (error) throw error
        if (!user) {
            throw new Error('用户不存在')
        }

        const directPushCount = user.direct_push_count || 0
        const teamCount = user.team_count_6_layers || 0

        // 判断是否符合资格
        const directPushMet = directPushCount >= PARTNER_CONFIG.DIRECT_PUSH_REQUIRED
        const teamMet = teamCount >= PARTNER_CONFIG.TEAM_SIZE_REQUIRED
        const isEligible = directPushMet && teamMet

        return {
            isEligible,
            directPushCount,
            teamCount,
            requirements: {
                directPushRequired: PARTNER_CONFIG.DIRECT_PUSH_REQUIRED,
                teamRequired: PARTNER_CONFIG.TEAM_SIZE_REQUIRED,
                directPushMet,
                teamMet
            }
        }
    } catch (error) {
        console.error('[PartnerService] checkPartnerEligibility error:', error)
        throw error
    }
}

/**
 * 获取合伙人信息（包括状态和二维码）
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Object>} 合伙人信息
 */
export async function getPartnerInfo(supabase, userId) {
    try {
        // 查询用户的合伙人信息
        const { data: user, error } = await supabase
            .from('users')
            .select('is_partner, partner_wechat_qr, partner_qualified_at, direct_push_count, team_count_6_layers')
            .eq('id', userId)
            .single()

        if (error) throw error
        if (!user) {
            throw new Error('用户不存在')
        }

        const directPushCount = user.direct_push_count || 0
        const teamCount = user.team_count_6_layers || 0

        // 计算进度百分比
        const directPushProgress = Math.min(100, Math.floor((directPushCount / PARTNER_CONFIG.DIRECT_PUSH_REQUIRED) * 100))
        const teamProgress = Math.min(100, Math.floor((teamCount / PARTNER_CONFIG.TEAM_SIZE_REQUIRED) * 100))

        return {
            isPartner: user.is_partner || false,
            directPushCount,
            teamCount,
            wechatQrCode: user.partner_wechat_qr || null,
            qualifiedAt: user.partner_qualified_at || null,
            progress: {
                directPushProgress,
                teamProgress
            }
        }
    } catch (error) {
        console.error('[PartnerService] getPartnerInfo error:', error)
        throw error
    }
}

/**
 * 为合伙人上传并存储微信二维码
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @param {File} file
 * @returns {Promise<string>} 已上传二维码的公开URL
 */
export async function uploadPartnerQRCode(supabase, userId, file) {
    try {
        // 验证文件
        const validation = validateQRCodeFile(file)
        if (!validation.valid) {
            throw new Error(validation.error)
        }

        // 生成文件名
        const fileExt = file.name.split('.').pop()
        const fileName = `${userId}_${Date.now()}.${fileExt}`
        const filePath = `partner-qrcodes/${fileName}`

        // 上传到Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('partner-qrcodes')
            .upload(filePath, file, {
                contentType: file.type,
                upsert: true
            })

        if (uploadError) throw uploadError

        // 获取公开URL
        const { data: urlData } = supabase.storage
            .from('partner-qrcodes')
            .getPublicUrl(filePath)

        const publicUrl = urlData.publicUrl

        // 更新用户的partner_wechat_qr字段
        const { error: updateError } = await supabase
            .from('users')
            .update({ partner_wechat_qr: publicUrl })
            .eq('id', userId)

        if (updateError) throw updateError

        console.log('[PartnerService] QR code uploaded:', publicUrl)
        return publicUrl

    } catch (error) {
        console.error('[PartnerService] uploadPartnerQRCode error:', error)
        throw error
    }
}

/**
 * 验证二维码文件
 * @param {File} file
 * @returns {Object} 验证结果
 */
function validateQRCodeFile(file) {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: '文件格式不支持，仅支持 jpg、png、webp 格式'
        }
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
        return {
            valid: false,
            error: '文件大小超过限制，最大支持 5MB'
        }
    }

    return { valid: true }
}

/**
 * 计算合伙人的分红统计
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Object>} 分红统计
 */
export async function getPartnerDividends(supabase, userId) {
    try {
        // 获取今日分红
        const today = new Date().toISOString().split('T')[0]
        const { data: todayDividends } = await supabase
            .from('partner_dividends')
            .select('amount')
            .eq('user_id', userId)
            .eq('source_date', today)

        const todayTotal = todayDividends?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0

        // 获取本月分红
        const thisMonthStart = new Date()
        thisMonthStart.setDate(1)
        const thisMonthStartStr = thisMonthStart.toISOString().split('T')[0]

        const { data: monthDividends } = await supabase
            .from('partner_dividends')
            .select('amount')
            .eq('user_id', userId)
            .gte('source_date', thisMonthStartStr)

        const thisMonthTotal = monthDividends?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0

        // 获取累计分红
        const { data: allDividends } = await supabase
            .from('partner_dividends')
            .select('amount')
            .eq('user_id', userId)

        const totalDividend = allDividends?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0

        // 预估明日分红
        const estimated = await estimateTomorrowDividend(supabase)

        return {
            today: todayTotal,
            thisMonth: thisMonthTotal,
            total: totalDividend,
            estimatedTomorrow: estimated.perPartner,
            calculation: {
                yesterdayTotal: estimated.yesterdayTotal,
                partnerCount: estimated.partnerCount,
                dividendPool: estimated.dividendPool
            }
        }
    } catch (error) {
        console.error('[PartnerService] getPartnerDividends error:', error)
        throw error
    }
}

/**
 * 基于昨日订单预估明日分红
 * @param {SupabaseClient} supabase
 * @returns {Promise<Object>} 预估分红信息
 */
export async function estimateTomorrowDividend(supabase) {
    try {
        // 获取昨日订单总额
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        const { data: orders } = await supabase
            .from('subscription_logs')
            .select('amount')
            .gte('created_at', `${yesterdayStr}T00:00:00`)
            .lt('created_at', `${yesterdayStr}T23:59:59`)

        const yesterdayTotal = orders?.reduce((sum, o) => sum + parseFloat(o.amount), 0) || 0

        // 如果昨日无订单，返回0
        if (yesterdayTotal === 0) {
            return {
                yesterdayTotal: 0,
                dividendPool: 0,
                partnerCount: 0,
                perPartner: 0
            }
        }

        // 计算分红池
        const dividendPool = yesterdayTotal * PARTNER_CONFIG.DIVIDEND_RATE

        // 统计当前合伙人数量
        const { data: partners, error } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('is_partner', true)

        const partnerCount = partners?.length || 0

        // 如果无合伙人，返回0
        if (partnerCount === 0) {
            return {
                yesterdayTotal,
                dividendPool,
                partnerCount: 0,
                perPartner: 0
            }
        }

        // 计算人均分红
        const perPartner = dividendPool / partnerCount

        return {
            yesterdayTotal,
            dividendPool,
            partnerCount,
            perPartner
        }
    } catch (error) {
        console.error('[PartnerService] estimateTomorrowDividend error:', error)
        throw error
    }
}

/**
 * 递归计算6层内的团队人数
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @param {number} maxDepth
 * @returns {Promise<number>} 团队总人数
 */
export async function calculateTeamCount(supabase, userId, maxDepth = 6) {
    try {
        let totalCount = 0
        const visited = new Set()
        const queue = [{ userId, level: 0 }]

        while (queue.length > 0) {
            const { userId: currentUserId, level } = queue.shift()

            if (visited.has(currentUserId) || level >= maxDepth) continue
            visited.add(currentUserId)

            // 获取直推成员（仅已激活）
            const { data: directPush } = await supabase
                .from('users')
                .select('id')
                .eq('referrer_id', currentUserId)
                .eq('is_member', true)

            if (directPush && directPush.length > 0) {
                totalCount += directPush.length

                // 添加到队列继续遍历
                directPush.forEach(member => {
                    queue.push({ userId: member.id, level: level + 1 })
                })
            }
        }

        return totalCount
    } catch (error) {
        console.error('[PartnerService] calculateTeamCount error:', error)
        throw error
    }
}

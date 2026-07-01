/**
 * AuditService - 后端审计日志服务
 * 
 * 功能：
 * - 接收和存储审计日志
 * - 查询审计日志
 * - 可疑活动检测
 * - 日志保留策略（90天）
 */

import { createClient } from '@supabase/supabase-js'

/**
 * 审计服务类
 */
export class AuditService {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  /**
   * 批量插入审计日志
   * @param {Array} logs - 日志数组
   * @returns {Promise<Object>}
   */
  async insertLogs(logs) {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .insert(logs)

      if (error) {
        throw error
      }

      return {
        success: true,
        count: logs.length,
        data
      }
    } catch (error) {
      console.error('插入审计日志失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 查询审计日志
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>}
   */
  async queryLogs(filters = {}) {
    try {
      let query = this.supabase
        .from('audit_logs')
        .select('*')

      // 按用户ID过滤
      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      // 按类型过滤
      if (filters.type) {
        query = query.eq('type', filters.type)
      }

      // 按时间范围过滤
      if (filters.startTime) {
        query = query.gte('timestamp', filters.startTime)
      }
      if (filters.endTime) {
        query = query.lte('timestamp', filters.endTime)
      }

      // 排序
      query = query.order('timestamp', { ascending: false })

      // 限制数量
      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return {
        success: true,
        logs: data
      }
    } catch (error) {
      console.error('查询审计日志失败:', error)
      return {
        success: false,
        error: error.message,
        logs: []
      }
    }
  }

  /**
   * 获取用户的审计日志
   * @param {string} userId - 用户ID
   * @param {number} [limit=50] - 数量限制
   * @returns {Promise<Array>}
   */
  async getUserLogs(userId, limit = 50) {
    return this.queryLogs({ userId, limit })
  }

  /**
   * 获取特定类型的日志
   * @param {string} type - 事件类型
   * @param {number} [limit=50] - 数量限制
   * @returns {Promise<Array>}
   */
  async getLogsByType(type, limit = 50) {
    return this.queryLogs({ type, limit })
  }

  /**
   * 获取可疑活动
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>}
   */
  async getSuspiciousActivities(filters = {}) {
    try {
      let query = this.supabase
        .from('suspicious_activities')
        .select('*')

      // 按用户ID过滤
      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      // 按状态过滤
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      // 按严重程度过滤
      if (filters.severity) {
        query = query.eq('severity', filters.severity)
      }

      // 排序
      query = query.order('detected_at', { ascending: false })

      // 限制数量
      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return {
        success: true,
        activities: data
      }
    } catch (error) {
      console.error('查询可疑活动失败:', error)
      return {
        success: false,
        error: error.message,
        activities: []
      }
    }
  }

  /**
   * 更新可疑活动状态
   * @param {number} activityId - 活动ID
   * @param {string} status - 新状态
   * @param {string} reviewedBy - 审核人
   * @param {string} [notes] - 备注
   * @returns {Promise<Object>}
   */
  async updateSuspiciousActivity(activityId, status, reviewedBy, notes = null) {
    try {
      const { data, error } = await this.supabase
        .from('suspicious_activities')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          notes
        })
        .eq('id', activityId)

      if (error) {
        throw error
      }

      return {
        success: true,
        data
      }
    } catch (error) {
      console.error('更新可疑活动失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取统计信息
   * @param {string} [userId] - 用户ID（可选）
   * @returns {Promise<Object>}
   */
  async getStats(userId = null) {
    try {
      const stats = {
        totalLogs: 0,
        byType: {},
        suspiciousActivities: 0,
        recentActivity: []
      }

      // 总日志数
      let countQuery = this.supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })

      if (userId) {
        countQuery = countQuery.eq('user_id', userId)
      }

      const { count } = await countQuery
      stats.totalLogs = count || 0

      // 按类型统计
      let typeQuery = this.supabase
        .from('audit_logs')
        .select('type')

      if (userId) {
        typeQuery = typeQuery.eq('user_id', userId)
      }

      const { data: typesData } = await typeQuery

      if (typesData) {
        for (const log of typesData) {
          stats.byType[log.type] = (stats.byType[log.type] || 0) + 1
        }
      }

      // 可疑活动数
      let suspiciousQuery = this.supabase
        .from('suspicious_activities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (userId) {
        suspiciousQuery = suspiciousQuery.eq('user_id', userId)
      }

      const { count: suspiciousCount } = await suspiciousQuery
      stats.suspiciousActivities = suspiciousCount || 0

      // 最近活动
      let recentQuery = this.supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10)

      if (userId) {
        recentQuery = recentQuery.eq('user_id', userId)
      }

      const { data: recentData } = await recentQuery
      stats.recentActivity = recentData || []

      return {
        success: true,
        stats
      }
    } catch (error) {
      console.error('获取统计信息失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 清理旧日志（90天前）
   * @returns {Promise<Object>}
   */
  async cleanupOldLogs() {
    try {
      const { error } = await this.supabase
        .rpc('cleanup_old_audit_logs')

      if (error) {
        throw error
      }

      return {
        success: true,
        message: '旧日志清理成功'
      }
    } catch (error) {
      console.error('清理旧日志失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

/**
 * 创建审计服务实例
 * @param {Object} env - 环境变量
 * @returns {AuditService}
 */
export function createAuditService(env) {
  return new AuditService(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

export default AuditService

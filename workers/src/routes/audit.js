/**
 * 审计日志API路由
 */

import { createAuditService } from '../services/auditService.js'
import { verifyAuth } from '../middleware/auth.js'

/**
 * 处理审计日志请求
 */
export async function handleAuditRequest(request, env) {
  const url = new URL(request.url)
  const path = url.pathname

  // 创建审计服务
  const auditService = createAuditService(env)

  try {
    // POST /api/audit/logs - 批量插入日志
    if (path === '/api/audit/logs' && request.method === 'POST') {
      return await handleInsertLogs(request, auditService)
    }

    // GET /api/audit/logs - 查询日志
    if (path === '/api/audit/logs' && request.method === 'GET') {
      return await handleQueryLogs(request, auditService, env)
    }

    // GET /api/audit/logs/user/:userId - 获取用户日志
    if (path.match(/^\/api\/audit\/logs\/user\/[^/]+$/) && request.method === 'GET') {
      const userId = path.split('/').pop()
      return await handleGetUserLogs(request, userId, auditService, env)
    }

    // GET /api/audit/suspicious - 获取可疑活动
    if (path === '/api/audit/suspicious' && request.method === 'GET') {
      return await handleGetSuspiciousActivities(request, auditService, env)
    }

    // PUT /api/audit/suspicious/:id - 更新可疑活动状态
    if (path.match(/^\/api\/audit\/suspicious\/\d+$/) && request.method === 'PUT') {
      const activityId = parseInt(path.split('/').pop())
      return await handleUpdateSuspiciousActivity(request, activityId, auditService, env)
    }

    // GET /api/audit/stats - 获取统计信息
    if (path === '/api/audit/stats' && request.method === 'GET') {
      return await handleGetStats(request, auditService, env)
    }

    // POST /api/audit/cleanup - 清理旧日志
    if (path === '/api/audit/cleanup' && request.method === 'POST') {
      return await handleCleanup(request, auditService, env)
    }

    return new Response('Not Found', { status: 404 })

  } catch (error) {
    console.error('审计日志API错误:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 批量插入日志
 */
async function handleInsertLogs(request, auditService) {
  try {
    const body = await request.json()
    const { logs } = body

    if (!logs || !Array.isArray(logs)) {
      return new Response(JSON.stringify({
        success: false,
        error: '无效的日志数据'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await auditService.insertLogs(logs)

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 查询日志
 */
async function handleQueryLogs(request, auditService, env) {
  try {
    // 验证管理员权限
    const authResult = await verifyAuth(request, env)
    if (!authResult.success || !authResult.user.is_admin) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(request.url)
    const filters = {
      userId: url.searchParams.get('userId'),
      type: url.searchParams.get('type'),
      startTime: url.searchParams.get('startTime') ? parseInt(url.searchParams.get('startTime')) : null,
      endTime: url.searchParams.get('endTime') ? parseInt(url.searchParams.get('endTime')) : null,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : 50
    }

    const result = await auditService.queryLogs(filters)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 获取用户日志
 */
async function handleGetUserLogs(request, userId, auditService, env) {
  try {
    // 验证权限（用户只能查看自己的日志，管理员可以查看所有）
    const authResult = await verifyAuth(request, env)
    if (!authResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: '未授权'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (authResult.user.id !== userId && !authResult.user.is_admin) {
      return new Response(JSON.stringify({
        success: false,
        error: '无权限查看其他用户的日志'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : 50

    const result = await auditService.getUserLogs(userId, limit)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 获取可疑活动
 */
async function handleGetSuspiciousActivities(request, auditService, env) {
  try {
    // 验证管理员权限
    const authResult = await verifyAuth(request, env)
    if (!authResult.success || !authResult.user.is_admin) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(request.url)
    const filters = {
      userId: url.searchParams.get('userId'),
      status: url.searchParams.get('status'),
      severity: url.searchParams.get('severity'),
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : 50
    }

    const result = await auditService.getSuspiciousActivities(filters)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 更新可疑活动状态
 */
async function handleUpdateSuspiciousActivity(request, activityId, auditService, env) {
  try {
    // 验证管理员权限
    const authResult = await verifyAuth(request, env)
    if (!authResult.success || !authResult.user.is_admin) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await request.json()
    const { status, notes } = body

    if (!status) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少状态参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await auditService.updateSuspiciousActivity(
      activityId,
      status,
      authResult.user.id,
      notes
    )

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 获取统计信息
 */
async function handleGetStats(request, auditService, env) {
  try {
    // 验证权限
    const authResult = await verifyAuth(request, env)
    if (!authResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: '未授权'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 管理员可以查看所有统计，普通用户只能查看自己的
    const userId = authResult.user.is_admin ? null : authResult.user.id

    const result = await auditService.getStats(userId)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 清理旧日志
 */
async function handleCleanup(request, auditService, env) {
  try {
    // 验证管理员权限
    const authResult = await verifyAuth(request, env)
    if (!authResult.success || !authResult.user.is_admin) {
      return new Response(JSON.stringify({
        success: false,
        error: '需要管理员权限'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await auditService.cleanupOldLogs()

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 内容管理服务
 * 管理任务、资讯、产品、活动的发布与查询
 */

const STORAGE_KEY = 'taskchain_content_posts'
const MAX_DAILY_POSTS = 50

/**
 * 内容发布数据结构
 */
class ContentPost {
  constructor(data) {
    this.id = data.id || `POST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.type = data.type // 'task' | 'info' | 'product' | 'event'
    this.userId = data.userId
    this.title = data.title
    this.description = data.description
    this.price = data.price || null // 任务/产品价格
    this.requirement = data.requirement || null // 任务要求
    this.images = data.images || [] // 图片URL数组
    this.content = data.content || '' // 资讯内容（富文本）
    this.isPremium = data.isPremium || false // 是否300型用户（加权展示）
    this.status = data.status || 'active' // 'active' | 'completed' | 'deleted'
    this.views = data.views || 0
    this.likes = data.likes || 0
    this.createdAt = data.createdAt || Date.now()
    this.updatedAt = data.updatedAt || Date.now()
  }
}

class ContentService {
  constructor() {
    this.posts = []
    this.loadFromStorage()
  }

  /**
   * 从 localStorage 加载数据
   */
  loadFromStorage() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY)
      if (savedData) {
        const postsData = JSON.parse(savedData)
        this.posts = postsData.map(data => new ContentPost(data))
      }
    } catch (error) {
      this.posts = []
    }
  }

  /**
   * 保存到 localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.posts))
    } catch (error) {
      // 保存失败静默处理
    }
  }

  /**
   * 检查今日发布数量
   */
  checkDailyLimit(userId) {
    const today = new Date().setHours(0, 0, 0, 0)
    const todayPosts = this.posts.filter(post => {
      const postDate = new Date(post.createdAt).setHours(0, 0, 0, 0)
      return post.userId === userId && postDate === today
    })
    
    return {
      count: todayPosts.length,
      remaining: MAX_DAILY_POSTS - todayPosts.length,
      canPost: todayPosts.length < MAX_DAILY_POSTS
    }
  }

  /**
   * 发布内容
   */
  publishPost(postData) {
    // 检查每日发布限制
    const limit = this.checkDailyLimit(postData.userId)
    if (!limit.canPost) {
      throw new Error(`每日最多发布${MAX_DAILY_POSTS}条内容，今日已达上限`)
    }

    const post = new ContentPost(postData)
    this.posts.unshift(post) // 新发布的放在最前面
    this.saveToStorage()
    
    return post
  }

  /**
   * 获取内容列表
   */
  getPosts(filter = {}) {
    let filteredPosts = [...this.posts]

    // 按类型筛选
    if (filter.type) {
      filteredPosts = filteredPosts.filter(post => post.type === filter.type)
    }

    // 按用户筛选
    if (filter.userId) {
      filteredPosts = filteredPosts.filter(post => post.userId === filter.userId)
    }

    // 只显示激活状态
    if (filter.activeOnly !== false) {
      filteredPosts = filteredPosts.filter(post => post.status === 'active')
    }

    // 排序：300型用户的内容加权置顶
    filteredPosts.sort((a, b) => {
      // 首先按 isPremium 排序
      if (a.isPremium && !b.isPremium) return -1
      if (!a.isPremium && b.isPremium) return 1
      // 然后按时间排序
      return b.createdAt - a.createdAt
    })

    // 分页
    if (filter.limit) {
      filteredPosts = filteredPosts.slice(0, filter.limit)
    }

    return filteredPosts
  }

  /**
   * 获取单个内容
   */
  getPost(postId) {
    return this.posts.find(post => post.id === postId)
  }

  /**
   * 更新内容
   */
  updatePost(postId, updateData) {
    const post = this.getPost(postId)
    if (!post) {
      throw new Error('内容不存在')
    }

    Object.assign(post, updateData)
    post.updatedAt = Date.now()
    this.saveToStorage()
    
    return post
  }

  /**
   * 删除内容
   */
  deletePost(postId) {
    const index = this.posts.findIndex(post => post.id === postId)
    if (index !== -1) {
      this.posts.splice(index, 1)
      this.saveToStorage()
      return true
    }
    return false
  }

  /**
   * 增加浏览量
   */
  incrementViews(postId) {
    const post = this.getPost(postId)
    if (post) {
      post.views++
      this.saveToStorage()
    }
  }

  /**
   * 点赞/取消点赞
   */
  toggleLike(postId) {
    const post = this.getPost(postId)
    if (post) {
      post.likes++
      this.saveToStorage()
      return post.likes
    }
    return 0
  }

  /**
   * 获取统计数据
   */
  getStats(userId = null) {
    let posts = this.posts
    if (userId) {
      posts = posts.filter(post => post.userId === userId)
    }

    return {
      total: posts.length,
      tasks: posts.filter(p => p.type === 'task').length,
      info: posts.filter(p => p.type === 'info').length,
      products: posts.filter(p => p.type === 'product').length,
      events: posts.filter(p => p.type === 'event').length,
      totalViews: posts.reduce((sum, p) => sum + p.views, 0),
      totalLikes: posts.reduce((sum, p) => sum + p.likes, 0)
    }
  }
}

// 单例
let contentServiceInstance = null

export function getContentService() {
  if (!contentServiceInstance) {
    contentServiceInstance = new ContentService()
  }
  return contentServiceInstance
}

export default getContentService


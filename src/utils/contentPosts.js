/**
 * 内容发布管理模块
 * 模拟 Supabase content_posts 表
 */

// 每日发布限制
const DAILY_LIMIT = 50

/**
 * 内容发布类结构
 */
class ContentPost {
  constructor(data) {
    this.id = `POST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.type = data.type // task | info | product | event
    this.title = data.title
    this.description = data.description
    this.price = data.price || 0
    this.eventTime = data.eventTime || ''
    this.images = data.images || []
    this.isPremium = data.isPremium || false // 300型用户加权标记
    this.isOfficial = data.isOfficial || false // 官方认证（300型资讯）
    this.authorId = data.authorId
    this.authorName = data.authorName || data.authorId
    this.views = 0
    this.likes = 0
    this.status = 'published' // published | archived
    this.createdAt = Date.now()
    this.updatedAt = Date.now()
  }
}

/**
 * 从 localStorage 加载所有发布内容
 */
export function getAllPosts() {
  try {
    const posts = localStorage.getItem('taskchain_posts')
    if (posts) {
      return JSON.parse(posts)
    }
  } catch (error) {
    // 加载失败
  }
  return []
}

/**
 * 保存所有发布内容到 localStorage
 */
export function savePosts(posts) {
  try {
    localStorage.setItem('taskchain_posts', JSON.stringify(posts))
  } catch (error) {
    // 保存失败
  }
}

/**
 * 获取今日发布数量
 */
export function getTodayPostCount() {
  const posts = getAllPosts()
  const today = new Date().setHours(0, 0, 0, 0)
  
  return posts.filter(post => {
    const postDate = new Date(post.createdAt).setHours(0, 0, 0, 0)
    return postDate === today
  }).length
}

/**
 * 创建新发布
 */
export function createPost(data) {
  // 检查每日限制
  const todayCount = getTodayPostCount()
  if (todayCount >= DAILY_LIMIT) {
    throw new Error('今日发布已达上限（50条）')
  }
  
  const post = new ContentPost(data)
  const posts = getAllPosts()
  posts.unshift(post) // 最新的在前面
  
  // 只保留最近1000条
  if (posts.length > 1000) {
    posts.length = 1000
  }
  
  savePosts(posts)
  
  // 触发全局事件（用于社区播报）
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('contentPublished', { detail: post }))
  }
  
  return post
}

/**
 * 根据类型获取发布内容
 */
export function getPostsByType(type, limit = 50) {
  const allPosts = getAllPosts()
  
  return allPosts
    .filter(post => post.type === type && post.status === 'published')
    .slice(0, limit)
}

/**
 * 获取推荐内容（300型加权）
 */
export function getRecommendedPosts(type, limit = 20) {
  const allPosts = getAllPosts()
  
  // 分离加权和普通内容
  const premiumPosts = []
  const normalPosts = []
  
  allPosts.forEach(post => {
    if (post.type === type && post.status === 'published') {
      if (post.isPremium) {
        premiumPosts.push(post)
      } else {
        normalPosts.push(post)
      }
    }
  })
  
  // 加权内容置顶，然后是普通内容
  return [...premiumPosts, ...normalPosts].slice(0, limit)
}

/**
 * 获取用户的发布内容
 */
export function getUserPosts(authorId) {
  const allPosts = getAllPosts()
  
  return allPosts.filter(post => post.authorId === authorId)
}

/**
 * 更新发布内容
 */
export function updatePost(postId, updates) {
  const posts = getAllPosts()
  const index = posts.findIndex(p => p.id === postId)
  
  if (index !== -1) {
    posts[index] = {
      ...posts[index],
      ...updates,
      updatedAt: Date.now()
    }
    savePosts(posts)
    return posts[index]
  }
  
  return null
}

/**
 * 删除发布内容（归档）
 */
export function archivePost(postId) {
  return updatePost(postId, { status: 'archived' })
}

/**
 * 增加浏览量
 */
export function incrementViews(postId) {
  const posts = getAllPosts()
  const post = posts.find(p => p.id === postId)
  
  if (post) {
    post.views++
    savePosts(posts)
  }
}

/**
 * 点赞/取消点赞
 */
export function toggleLike(postId) {
  const posts = getAllPosts()
  const post = posts.find(p => p.id === postId)
  
  if (post) {
    // 简化处理：直接增加点赞数（实际应该记录用户是否已点赞）
    post.likes++
    savePosts(posts)
    return post.likes
  }
  
  return 0
}

/**
 * 获取统计数据
 */
export function getPostsStats() {
  const posts = getAllPosts()
  
  return {
    total: posts.length,
    task: posts.filter(p => p.type === 'task').length,
    info: posts.filter(p => p.type === 'info').length,
    product: posts.filter(p => p.type === 'product').length,
    event: posts.filter(p => p.type === 'event').length,
    premium: posts.filter(p => p.isPremium).length,
    todayCount: getTodayPostCount(),
    dailyLimit: DAILY_LIMIT
  }
}


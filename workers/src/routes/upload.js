/**
 * 文件上传路由
 * 处理头像、图片、视频上传到 Supabase Storage
 */
import { json } from 'itty-router'

/**
 * 注册上传路由
 */
export function registerUploadRoutes(router) {
    // 上传文件（通用接口）
    router.post('/api/upload', handleUpload)

    // 获取公开 URL（如果需要预签名）
    router.get('/api/upload/url/:bucket/:path', getPublicUrl)
}

/**
 * 处理文件上传
 * POST /api/upload
 * Body: FormData with 'file' field
 * Query: ?type=avatar|image|video
 */
async function handleUpload(request) {
    const { supabase } = request
    const url = new URL(request.url)
    const fileType = url.searchParams.get('type') || 'image'

    try {
        // 解析 FormData
        const formData = await request.formData()
        const file = formData.get('file')

        if (!file) {
            return json({ code: 400, message: '未找到文件' }, { status: 400 })
        }

        // 验证文件类型
        const allowedTypes = {
            avatar: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            video: ['video/mp4', 'video/webm', 'video/quicktime']
        }

        if (!allowedTypes[fileType]?.includes(file.type)) {
            return json({
                code: 400,
                message: `不支持的文件类型: ${file.type}`
            }, { status: 400 })
        }

        // 文件大小限制
        const maxSize = {
            avatar: 2 * 1024 * 1024,   // 2MB
            image: 10 * 1024 * 1024,   // 10MB (match frontend limit)
            video: 50 * 1024 * 1024    // 50MB
        }

        if (file.size > maxSize[fileType]) {
            return json({
                code: 400,
                message: `文件过大，最大 ${maxSize[fileType] / 1024 / 1024}MB`
            }, { status: 400 })
        }

        // 生成唯一文件名
        const ext = file.name.split('.').pop() || 'jpg'
        const timestamp = Date.now()
        const random = Math.random().toString(36).substr(2, 6)
        const fileName = `${fileType}/${timestamp}_${random}.${ext}`

        // 上传到 Supabase Storage
        const bucket = 'media' // 存储桶名称
        const fileBuffer = await file.arrayBuffer()

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, fileBuffer, {
                contentType: file.type,
                upsert: false
            })

        if (error) {
            console.error('上传失败:', error)
            return json({
                code: 500,
                message: '上传失败',
                error: error.message
            }, { status: 500 })
        }

        // 获取公开 URL
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName)

        return json({
            code: 200,
            data: {
                path: data.path,
                url: urlData.publicUrl,
                type: fileType,
                name: file.name,
                size: file.size
            }
        })

    } catch (error) {
        console.error('上传处理错误:', error)
        return json({
            code: 500,
            message: '服务器错误',
            error: error.message
        }, { status: 500 })
    }
}

/**
 * 获取文件公开 URL
 */
async function getPublicUrl(request) {
    const { supabase, params } = request
    const { bucket, path } = params

    try {
        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(decodeURIComponent(path))

        return json({
            code: 200,
            data: { url: data.publicUrl }
        })
    } catch (error) {
        return json({
            code: 500,
            message: '获取 URL 失败'
        }, { status: 500 })
    }
}

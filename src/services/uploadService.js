/**
 * 媒体上传服务
 * 处理头像、图片、视频上传到服务器
 */

/**
 * Canvas 压缩图片
 * 将图片压缩到最大 800px 宽度，质量 0.70，输出 JPEG
 * 对于已经很小的图片（< 80KB）直接跳过压缩
 * @param {File} file
 * @param {number} maxWidth - 最大宽度，默认800
 * @param {number} quality - JPEG 质量 0~1，默认0.70
 * @returns {Promise<File>}
 */
async function compressImage(file, maxWidth = 800, quality = 0.70) {
    // 小图不压缩，直接返回
    if (file.size < 80 * 1024) return file
    // GIF 不压缩（会失帧）
    if (file.type === 'image/gif') return file

    return new Promise((resolve) => {
        const img = new Image()
        const blobUrl = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(blobUrl)
            let { width, height } = img
            if (width > maxWidth) {
                height = Math.round(height * maxWidth / width)
                width = maxWidth
            }
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)
            canvas.toBlob(
                (blob) => {
                    if (!blob || blob.size >= file.size) {
                        // 压缩后反而更大（罕见），用原图
                        resolve(file)
                        return
                    }
                    const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    })
                    resolve(compressed)
                },
                'image/jpeg',
                quality
            )
        }
        img.onerror = () => {
            URL.revokeObjectURL(blobUrl)
            resolve(file) // 解析失败就用原图
        }
        img.src = blobUrl
    })
}

/**
 * 上传文件到服务器
 * @param {File} file - 要上传的文件
 * @param {string} type - 文件类型: 'avatar' | 'image' | 'video'
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadFile(file, type = 'image') {
    const formData = new FormData()
    formData.append('file', file)

    // 超时控制：图片30秒，视频60秒
    const timeout = type === 'video' ? 60000 : 30000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
        const response = await fetch(`/api/upload?type=${type}`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        })
        clearTimeout(timeoutId)

        const data = await response.json()

        if (data.code === 200 && data.data?.url) {
            return {
                url: data.data.url,
                path: data.data.path,
                name: data.data.name,
                size: data.data.size
            }
        }

        throw new Error(data.message || '上传失败')
    } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
            throw new Error('上传超时，请检查网络后重试')
        }
        console.error('❌ 上传文件失败:', error)
        throw error
    }
}

/**
 * 上传头像（压缩到 400px）
 * @param {File} file - 图片文件
 * @returns {Promise<string>} - 返回头像 URL
 */
export async function uploadAvatar(file) {
    const compressed = await compressImage(file, 400, 0.85)
    const result = await uploadFile(compressed, 'avatar')
    return result.url
}

/**
 * 上传聊天图片（压缩到 800px，质量0.70 → 更快上传）
 * @param {File} file - 图片文件
 * @returns {Promise<{url: string, name: string}>}
 */
export async function uploadImage(file) {
    const compressed = await compressImage(file, 800, 0.70)
    const result = await uploadFile(compressed, 'image')
    return {
        url: result.url,
        name: file.name
    }
}

/**
 * 上传聊天视频
 * @param {File} file - 视频文件
 * @returns {Promise<{url: string, name: string}>}
 */
export async function uploadVideo(file) {
    const result = await uploadFile(file, 'video')
    return {
        url: result.url,
        name: file.name
    }
}

/**
 * 检查文件类型
 */
export function getFileType(file) {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    return 'unknown'
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

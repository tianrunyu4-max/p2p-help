async function compressImage(file, maxWidth = 800, quality = 0.70) {
  if (file.size < 80 * 1024 || file.type === 'image/gif') return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob || blob.size >= file.size) { resolve(file); return }
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

import { apiUrl } from '../utils/apiBase.js'

async function uploadFile(file, type = 'image') {
  const formData = new FormData()
  formData.append('file', file)
  const timeout = type === 'video' ? 60000 : 30000
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(apiUrl(`/api/upload?type=${type}`), { method: 'POST', body: formData, signal: controller.signal })
    clearTimeout(id)
    const data = await res.json()
    if (data.code === 200 && data.data?.url) return data.data
    throw new Error(data.message || '上传失败')
  } catch (e) {
    clearTimeout(id)
    if (e.name === 'AbortError') throw new Error('上传超时，请检查网络后重试')
    throw e
  }
}

export async function uploadAvatar(file) {
  const compressed = await compressImage(file, 400, 0.85)
  return (await uploadFile(compressed, 'avatar')).url
}

export async function uploadImage(file) {
  const compressed = await compressImage(file, 800, 0.70)
  const result = await uploadFile(compressed, 'image')
  return { url: result.url, name: file.name }
}

export async function uploadVideo(file) {
  const result = await uploadFile(file, 'video')
  return { url: result.url, name: file.name }
}

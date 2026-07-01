<template>
  <div class="publish-modal-overlay" @click="$emit('close')">
    <div class="publish-modal" @click.stop>
      <!-- 标题栏 -->
      <div class="modal-header">
        <button class="header-btn cancel" @click="$emit('close')">取消</button>
        <h3 class="modal-title">{{ titleText }}</h3>
        <button class="header-btn submit" @click="handleSubmit">发布</button>
      </div>
      
      <!-- 表单内容 -->
      <div class="modal-body">
        <!-- 标题 -->
        <div class="form-group">
          <input 
            v-model="form.title"
            type="text" 
            :placeholder="placeholderTitle"
            class="form-input title-input"
            maxlength="50" />
          <span class="char-count">{{ form.title.length }}/50</span>
        </div>
        
        <!-- 描述/内容 -->
        <div class="form-group">
          <textarea 
            v-model="form.description"
            :placeholder="placeholderDescription"
            class="form-textarea"
            :rows="publishType === 'info' ? 12 : 6"
            maxlength="500"></textarea>
          <span class="char-count">{{ form.description.length }}/500</span>
        </div>
        
        <!-- 价格/要求（任务和产品） -->
        <div v-if="publishType === 'task' || publishType === 'product'" class="form-group">
          <div class="input-with-label">
            <span class="input-label">{{ publishType === 'task' ? '悬赏金额' : '产品价格' }}</span>
            <input 
              v-model.number="form.price"
              type="number" 
              placeholder="请输入金额"
              class="form-input price-input" />
            <span class="input-unit">元</span>
          </div>
        </div>
        
        <!-- 活动时间（活动） -->
        <div v-if="publishType === 'event'" class="form-group">
          <div class="input-with-label">
            <span class="input-label">活动时间</span>
            <input 
              v-model="form.eventTime"
              type="text" 
              placeholder="例如：2024-01-01 14:00"
              class="form-input" />
          </div>
        </div>
        
        <!-- 图片上传 -->
        <div class="form-group">
          <div class="upload-label">图片（选填）</div>
          <div class="image-upload-area">
            <div v-for="(img, index) in form.images" :key="index" class="image-preview">
              <img :src="img" alt="预览图" />
              <button class="image-remove" @click="removeImage(index)">×</button>
            </div>
            <label v-if="form.images.length < 3" class="upload-btn">
              <input type="file" accept="image/*" @change="handleImageUpload" hidden />
              <div class="upload-icon">📷</div>
              <div class="upload-text">添加图片</div>
            </label>
          </div>
          <div class="upload-hint">最多上传3张图片</div>
        </div>
        
        <!-- 加权展示（仅300型会员） -->
        <div v-if="isPremiumUser" class="form-group">
          <label class="checkbox-label">
            <input v-model="form.isPremium" type="checkbox" class="checkbox-input" />
            <span class="checkbox-text">
              <span class="premium-badge">300型</span>
              加权展示（置顶推荐）
            </span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getOrCreateUserId } from '../utils/auth.js'
import { useToast } from '../composables/useToast.js'
import { createPost } from '../utils/contentPosts.js'

const props = defineProps({
  publishType: {
    type: String,
    required: true,
    validator: (value) => ['task', 'info', 'product', 'event'].includes(value)
  }
})

const emit = defineEmits(['close', 'success'])
const { success, error } = useToast()

// 表单数据
const form = ref({
  title: '',
  description: '',
  price: 0,
  eventTime: '',
  images: [],
  isPremium: false
})

// 用户信息
const userId = getOrCreateUserId()

// 是否是已激活会员（任何档位均可使用加权展示）
const isPremiumUser = computed(() => localStorage.getItem('cachedIsActive') === 'true')

// 标题文本
const titleText = computed(() => {
  const titles = {
    task: '发布任务',
    info: '发布资讯',
    product: '发布产品',
    event: '发布活动'
  }
  return titles[props.publishType]
})

// 占位符
const placeholderTitle = computed(() => {
  const placeholders = {
    task: '请输入任务标题（如：招聘兼职设计师）',
    info: '请输入资讯标题',
    product: '请输入产品名称',
    event: '请输入活动名称'
  }
  return placeholders[props.publishType]
})

const placeholderDescription = computed(() => {
  const placeholders = {
    task: '请详细描述任务要求、交付标准等...',
    info: '分享您的见解、经验或行业资讯...',
    product: '请详细描述产品特点、规格、优势等...',
    event: '请详细描述活动内容、地点、报名方式等...'
  }
  return placeholders[props.publishType]
})

// 图片上传
const handleImageUpload = (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  if (form.value.images.length >= 3) {
    error('提示', '最多上传3张图片')
    return
  }
  
  // 模拟图片上传（实际应该上传到服务器）
  const reader = new FileReader()
  reader.onload = (event) => {
    form.value.images.push(event.target.result)
  }
  reader.readAsDataURL(file)
}

// 删除图片
const removeImage = (index) => {
  form.value.images.splice(index, 1)
}

// 提交发布
const handleSubmit = () => {
  // 验证
  if (!form.value.title.trim()) {
    error('提示', '请输入标题')
    return
  }
  
  if (!form.value.description.trim()) {
    error('提示', '请输入描述内容')
    return
  }
  
  if ((props.publishType === 'task' || props.publishType === 'product') && !form.value.price) {
    error('提示', '请输入金额')
    return
  }
  
  // 创建发布内容
  try {
    const post = createPost({
      type: props.publishType,
      title: form.value.title,
      description: form.value.description,
      price: form.value.price,
      eventTime: form.value.eventTime,
      images: form.value.images,
      isPremium: form.value.isPremium && isPremiumUser.value,
      authorId: userId,
      authorName: userId,
      isOfficial: isPremiumUser.value && props.publishType === 'info'
    })
    
    // 触发成功事件
    emit('success', post)
  } catch (err) {
    error('发布失败', err.message)
  }
}
</script>

<style scoped>
.publish-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
  animation: fade-in 0.3s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.publish-modal {
  background: #FFFFFF;
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: slide-up 0.3s ease;
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* 标题栏 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.header-btn {
  padding: 8px 16px;
  border: none;
  background: none;
  font-size: 15px;
  cursor: pointer;
}

.header-btn.cancel {
  color: rgba(0, 0, 0, 0.6);
}

.header-btn.submit {
  color: #07C160;
  font-weight: 500;
}

.modal-title {
  font-size: 17px;
  font-weight: 500;
  color: #000000;
}

/* 表单内容 */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-group {
  margin-bottom: 20px;
  position: relative;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px;
  background: #F7F7F7;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 15px;
  color: #000000;
  outline: none;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-textarea:focus {
  background: #FFFFFF;
  border-color: #F7E3AF;
}

.title-input {
  font-weight: 500;
}

.form-textarea {
  resize: none;
  line-height: 1.6;
  font-family: inherit;
}

.char-count {
  position: absolute;
  right: 12px;
  bottom: 12px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
}

/* 带标签的输入框 */
.input-with-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #F7F7F7;
  border-radius: 8px;
}

.input-label {
  font-size: 15px;
  color: rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}

.price-input {
  flex: 1;
  padding: 0;
  background: transparent;
  border: none;
  text-align: right;
  font-size: 20px;
  font-weight: 600;
  color: #F7B500;
}

.input-unit {
  font-size: 15px;
  color: rgba(0, 0, 0, 0.6);
}

/* 图片上传 */
.upload-label {
  font-size: 15px;
  color: rgba(0, 0, 0, 0.8);
  margin-bottom: 12px;
}

.image-upload-area {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.image-preview {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #FFFFFF;
  border: none;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.upload-btn {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #F7F7F7;
  border: 2px dashed rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-btn:hover {
  border-color: #F7E3AF;
  background: rgba(247, 227, 175, 0.1);
}

.upload-icon {
  font-size: 32px;
  margin-bottom: 4px;
}

.upload-text {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
}

.upload-hint {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
}

/* 复选框 */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(247, 227, 175, 0.1);
  border-radius: 8px;
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.8);
}

.premium-badge {
  display: inline-block;
  padding: 2px 8px;
  background: linear-gradient(135deg, #F7E3AF 0%, #D4AF37 100%);
  color: #000000;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
</style>


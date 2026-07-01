<template>
  <div class="register-page">
    <div class="register-container">
      <!-- Logo和标题 -->
      <div class="header-section">
        <div class="logo">
          <img src="/logo.jpg" alt="Logo" class="logo-img" />
        </div>
        <h1 class="title">欢迎注册</h1>
        <p class="subtitle">与ai同在 链接新世界</p>
      </div>

      <!-- 注册表单 -->
      <div class="form-section">
        <div class="form-group">
          <label>昵称</label>
          <input
            v-model="nickname"
            type="text"
            placeholder="QQ号/微信号/自定义昵称"
            class="input-field"
            :class="{ 'error': errors.nickname }"
            @input="clearError('nickname')"
          />
          <span v-if="errors.nickname" class="error-text">{{ errors.nickname }}</span>
          <div class="input-hint">可以使用QQ号、微信号或任意昵称，聊天时将显示此昵称</div>
        </div>

        <div class="form-group">
          <label>密码</label>
          <div class="password-input">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="至少6位"
              class="input-field"
              :class="{ 'error': errors.password }"
              @input="clearError('password')"
            />
            <button
              type="button"
              class="toggle-password"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <span v-if="errors.password" class="error-text">{{ errors.password }}</span>
          <div v-if="password" class="password-strength">
            <div class="strength-bar" :class="passwordStrength.class">
              <div class="strength-fill" :style="{ width: passwordStrength.width }"></div>
            </div>
            <span class="strength-text">{{ passwordStrength.text }}</span>
          </div>
        </div>

        <div class="form-group">
          <label>确认密码</label>
          <input
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            placeholder="再次输入密码"
            class="input-field"
            :class="{ 'error': errors.confirmPassword }"
            @input="clearError('confirmPassword')"
          />
          <span v-if="errors.confirmPassword" class="error-text">{{ errors.confirmPassword }}</span>
        </div>

        <!-- 注册按钮 -->
        <button
          class="register-btn"
          :disabled="isRegistering"
          @click="handleRegister"
        >
          <span v-if="!isRegistering">立即注册</span>
          <span v-else>注册中...</span>
        </button>

        <!-- 登录链接 -->
        <div class="footer-links">
          <span>已有账号？</span>
          <router-link to="/login" class="link">立即登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '../utils/auth.js'
import { useToast } from '../composables/useToast.js'

const router = useRouter()
const { success, error: showError } = useToast()

const nickname = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const isRegistering = ref(false)

const errors = ref({
  nickname: '',
  password: '',
  confirmPassword: ''
})

// 密码强度计算
const passwordStrength = computed(() => {
  const pwd = password.value
  if (!pwd) return { width: '0%', class: '', text: '' }

  let strength = 0
  if (pwd.length >= 6) strength++
  if (pwd.length >= 8) strength++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++
  if (/\d/.test(pwd)) strength++
  if (/[^a-zA-Z0-9]/.test(pwd)) strength++

  if (strength <= 2) {
    return { width: '33%', class: 'weak', text: '弱' }
  } else if (strength <= 3) {
    return { width: '66%', class: 'medium', text: '中' }
  } else {
    return { width: '100%', class: 'strong', text: '强' }
  }
})

// 清除错误
const clearError = (field) => {
  errors.value[field] = ''
}

// 验证表单
const validateForm = () => {
  let isValid = true

  if (!nickname.value || nickname.value.trim().length < 2) {
    errors.value.nickname = '昵称至少2个字符'
    isValid = false
  }

  if (nickname.value.trim().length > 20) {
    errors.value.nickname = '昵称最多20个字符'
    isValid = false
  }

  if (!password.value || password.value.length < 6) {
    errors.value.password = '密码至少6位'
    isValid = false
  }

  if (password.value !== confirmPassword.value) {
    errors.value.confirmPassword = '两次密码不一致'
    isValid = false
  }

  return isValid
}

// 处理注册
const handleRegister = async () => {
  if (!validateForm()) {
    return
  }

  isRegistering.value = true

  try {
    const result = await register({
      nickname: nickname.value.trim(),
      password: password.value
    })

    if (result.success) {
      success('注册成功', `欢迎加入！您的社区ID: ${result.communityId}`)
      setTimeout(() => {
        router.push('/')
      }, 1500)
    } else {
      showError('注册失败', result.error)
      isRegistering.value = false
    }
  } catch (err) {
    showError('注册失败', '发生未知错误，请重试')
    isRegistering.value = false
  }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #FFF8E1 0%, #FFE082 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.register-container {
  width: 100%;
  max-width: 420px;
  background: #FFFFFF;
  border-radius: 24px;
  padding: 40px 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* 头部 */
.header-section {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  font-size: 64px;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo-img {
  width: 120px;
  height: auto;
  object-fit: contain;
}

.title {
  font-size: 28px;
  font-weight: 700;
  color: #1A1A2E;
  margin: 0 0 8px;
}

.subtitle {
  font-size: 14px;
  color: #6C757D;
  margin: 0;
}

/* 表单 */
.form-section {
  margin-top: 32px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.optional {
  font-weight: 400;
  color: #999;
  font-size: 12px;
}

.input-field {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #E0E0E0;
  border-radius: 12px;
  font-size: 15px;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.input-field:focus {
  outline: none;
  border-color: #FFC933;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-field.error {
  border-color: #E74C3C;
}

.error-text {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: #E74C3C;
}

.info-text {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: #4CAF50;
}

.input-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #999;
}

/* 密码输入 */
.password-input {
  position: relative;
}

.toggle-password {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
}

/* 密码强度 */
.password-strength {
  margin-top: 8px;
}

.strength-bar {
  height: 4px;
  background: #E0E0E0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s ease;
}

.strength-bar.weak .strength-fill {
  background: #E74C3C;
}

.strength-bar.medium .strength-fill {
  background: #F39C12;
}

.strength-bar.strong .strength-fill {
  background: #4CAF50;
}

.strength-text {
  font-size: 12px;
  color: #666;
}

/* 注册按钮 */
.register-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #FFC933 0%, #FFB300 100%);
  border: none;
  border-radius: 12px;
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 24px;
}

.register-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.register-btn:active:not(:disabled) {
  transform: translateY(0);
}

.register-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 底部链接 */
.footer-links {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #666;
}

.link {
  color: #FFC933;
  text-decoration: none;
  font-weight: 600;
  margin-left: 8px;
}

.link:hover {
  text-decoration: underline;
}
</style>

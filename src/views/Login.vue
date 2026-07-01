<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Logo和标题 -->
      <div class="header-section">
        <div class="logo">
          <img src="/logo.jpg" alt="Logo" class="logo-img" />
        </div>
        <h1 class="title">欢迎回来</h1>
        <p class="subtitle">与ai同在 链接新世界</p>
      </div>

      <!-- 登录表单 -->
      <div class="form-section">
        <div class="form-group">
          <label>用户名</label>
          <input
            v-model="username"
            type="text"
            placeholder="请输入昵称"
            class="input-field"
            :class="{ 'error': errors.username }"
            @input="clearError('username')"
            @keyup.enter="handleLogin"
          />
          <span v-if="errors.username" class="error-text">{{ errors.username }}</span>
        </div>

        <div class="form-group">
          <label>密码</label>
          <div class="password-input">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              class="input-field"
              :class="{ 'error': errors.password }"
              @input="clearError('password')"
              @keyup.enter="handleLogin"
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
        </div>

        <!-- 记住我 -->
        <div class="options-row">
          <label class="remember-me">
            <input type="checkbox" v-model="rememberMe" />
            <span>记住我</span>
          </label>
        </div>

        <!-- 登录按钮 -->
        <button
          class="login-btn"
          :disabled="isLoggingIn"
          @click="handleLogin"
        >
          <span v-if="!isLoggingIn">登录</span>
          <span v-else>登录中...</span>
        </button>

        <!-- 注册链接 -->
        <div class="footer-links">
          <span>还没有账号？</span>
          <router-link to="/register" class="link">立即注册</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../utils/auth.js'
import { useToast } from '../composables/useToast.js'

const router = useRouter()
const { success, error: showError } = useToast()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const rememberMe = ref(false)
const isLoggingIn = ref(false)

const errors = ref({
  username: '',
  password: ''
})

// 清除错误
const clearError = (field) => {
  errors.value[field] = ''
}

// 验证表单
const validateForm = () => {
  let isValid = true

  if (!username.value || username.value.trim().length === 0) {
    errors.value.username = '请输入用户名'
    isValid = false
  }

  if (!password.value) {
    errors.value.password = '请输入密码'
    isValid = false
  }

  return isValid
}

// 处理登录
const handleLogin = async () => {
  if (!validateForm()) {
    return
  }

  isLoggingIn.value = true

  try {
    console.log('开始登录...')
    const result = await login(username.value, password.value)
    console.log('登录结果:', result)

    if (result.success) {
      success('登录成功', `欢迎回来，${result.username || result.nickname}！`)
      setTimeout(() => {
        // 跳转到首页或之前的页面
        const redirect = router.currentRoute.value.query.redirect || '/'
        router.push(redirect)
      }, 1000)
    } else {
      showError('登录失败', result.error)
      isLoggingIn.value = false
    }
  } catch (err) {
    console.error('登录错误:', err)
    showError('登录失败', '发生未知错误，请重试')
    isLoggingIn.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #FFF8E1 0%, #FFE082 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-container {
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

/* 选项行 */
.options-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
}

.remember-me input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* 登录按钮 */
.login-btn {
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
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 193, 51, 0.4);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
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

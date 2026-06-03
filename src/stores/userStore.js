import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

// 生成6位数字ID（8开头）
function generateLocalId() {
  const id = '8' + Math.floor(10000 + Math.random() * 90000)
  localStorage.setItem('p2p_local_id', id)
  return id
}

export function getOrCreateLocalId() {
  return localStorage.getItem('p2p_local_id') || generateLocalId()
}

export const useUserStore = defineStore('user', () => {
  const token    = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || 'null'))
  const localId  = ref(getOrCreateLocalId())

  const isLoggedIn   = computed(() => !!token.value)
  const isActivated  = computed(() => userInfo.value?.is_active === true)
  const hasReferrer  = computed(() => !!userInfo.value?.referrer_id)
  const isExited     = computed(() => userInfo.value?.is_exited === true)
  const userId       = computed(() => userInfo.value?.user_no || localId.value)
  const inviteCode   = computed(() => userInfo.value?.invite_code || '')

  function setToken(t) {
    token.value = t
    localStorage.setItem('token', t)
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
  }

  function setUserInfo(info) {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  // 自动初始化：首次进入自动建档
  async function autoInit() {
    if (token.value && userInfo.value) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      return
    }
    try {
      const res = await axios.post('/api/auth/init', { localId: localId.value })
      if (res.data.code === 200) {
        setToken(res.data.data.token)
        setUserInfo(res.data.data.user)
      }
    } catch {}
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    delete axios.defaults.headers.common['Authorization']
  }

  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  return {
    token, userInfo, localId,
    isLoggedIn, isActivated, hasReferrer, isExited,
    userId, inviteCode,
    setToken, setUserInfo, autoInit, logout,
  }
})

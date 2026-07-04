const USER_ID_KEY = 'chatUserId'

function cleanupOldIds() {
  if (localStorage.getItem('id_cleanup_done') === 'true') return
  const cur = localStorage.getItem(USER_ID_KEY)
  if (cur && cur.startsWith('U_')) localStorage.removeItem(USER_ID_KEY)
  localStorage.setItem('id_cleanup_done', 'true')
}

function generateUserId() {
  const id = '8' + Math.floor(1000 + Math.random() * 9000)
  localStorage.setItem(USER_ID_KEY, id)
  return id
}

export function getOrCreateUserId() {
  cleanupOldIds()
  return localStorage.getItem(USER_ID_KEY) || generateUserId()
}

export function getUserId() {
  return localStorage.getItem(USER_ID_KEY)
}

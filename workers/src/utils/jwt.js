// CF Workers Web Crypto JWT (HS256)
const ENC = new TextEncoder()

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw', ENC.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  )
}

export async function signJWT(payload, secret, expiresInSec = 86400 * 30) {
  const header  = b64url(ENC.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body    = b64url(ENC.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec })))
  const key     = await getKey(secret)
  const sig     = await crypto.subtle.sign('HMAC', key, ENC.encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(sig)}`
}

export async function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.')
    const key = await getKey(secret)
    const valid = await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(sig.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)), ENC.encode(`${header}.${body}`))
    if (!valid) return null
    const payload = JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/')))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

export function getTokenFromRequest(request) {
  const auth = request.headers.get('Authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

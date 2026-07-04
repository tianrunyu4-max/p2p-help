/**
 * APK OTA 热更新版本接口
 * GET /api/app-update
 *
 * 返回格式（@capgo/capacitor-updater 要求）：
 * { "version": "1234567890", "url": "https://...bundle.zip" }
 *
 * version.json 由 deploy.yml 构建时生成：{ "v": "UNIX时间戳" }
 * bundle.zip   由 deploy.yml 构建后打包放入 dist/，随 Worker 一起部署
 */
export async function handleAppUpdate(request, env, pathname) {
  if (pathname !== '/api/app-update' || request.method !== 'GET') return null

  let version = '0'
  try {
    // version.json 是部署时自动生成的静态资源
    const vRes = await env.ASSETS.fetch(new Request(new URL('/version.json', request.url).toString()))
    const data = await vRes.json()
    version = String(data.v || '0')
  } catch {
    version = '0'
  }

  const bundleUrl = 'https://p2p.ai-airdrop.uk/bundle.zip'

  return new Response(
    JSON.stringify({ version, url: bundleUrl }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    }
  )
}

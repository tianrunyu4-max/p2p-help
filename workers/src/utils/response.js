const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

export const ok  = (data)    => Response.json({ code: 200, data },           { headers: CORS })
export const err = (msg, s=400) => Response.json({ code: s, message: msg }, { status: s, headers: CORS })
export const cors = ()        => new Response(null, { status: 204, headers: CORS })

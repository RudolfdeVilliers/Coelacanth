import { exchangeCode } from '@/lib/connectors/gmail'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function successHtml(provider) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connected</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
</head><body style="font-family:'DM Sans',sans-serif;text-align:center;padding:72px 24px;background:#fff">
<div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:28px">
  <div style="width:12px;height:12px;background:#5ce1e6;border-radius:50%"></div>
  <strong style="color:#083470;letter-spacing:.1em;text-transform:uppercase;font-size:12px">Coelacanth</strong>
</div>
<h2 style="color:#083470;font-size:22px;font-weight:500;margin:0 0 10px">✓ ${provider} connected</h2>
<p style="color:#5d879a;font-size:14px;margin:0">You can close this tab and return to the widget.</p>
</body></html>`
}

function errorHtml(msg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px 24px">
<h2 style="color:#e74c3c">Authorization failed</h2>
<p style="color:#666">${msg}</p></body></html>`
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return new Response(errorHtml(oauthError), { headers: { 'Content-Type': 'text/html' } })
  }

  let orgSlug
  try {
    orgSlug = JSON.parse(Buffer.from(state, 'base64').toString()).orgSlug
  } catch {
    return new Response(errorHtml('Invalid state parameter'), { headers: { 'Content-Type': 'text/html' } })
  }

  let tokens
  try {
    tokens = await exchangeCode(code)
  } catch (err) {
    return new Response(errorHtml(err.message), { headers: { 'Content-Type': 'text/html' } })
  }

  const db = getSupabaseAdmin()
  await db.from('oauth_tokens').upsert({
    org_slug: orgSlug,
    provider: 'gmail',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_slug,provider' })

  return new Response(successHtml('Gmail'), { headers: { 'Content-Type': 'text/html' } })
}

import { google } from 'googleapis'
import { getSupabaseAdmin } from '@/lib/supabase'

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(state) {
  const client = createOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
    state,
  })
}

export async function exchangeCode(code) {
  const client = createOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function sendEmail({ to, subject, body, accessToken, refreshToken, orgSlug }) {
  console.log('Sending email to:', to, 'subject:', subject)
  const client = createOAuth2Client()
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

  // Persist refreshed access token automatically
  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const db = getSupabaseAdmin()
      await db
        .from('oauth_tokens')
        .update({
          access_token: tokens.access_token,
          expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('org_slug', orgSlug)
        .eq('provider', 'gmail')
    }
  })

  const gmail = google.gmail({ version: 'v1', auth: client })

  const raw = Buffer.from(
    [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ].join('\r\n')
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
}

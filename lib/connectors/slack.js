import { WebClient } from '@slack/web-api'

export async function sendMessage({ channel, text, accessToken }) {
  const slack = new WebClient(accessToken)
  const normalizedChannel = channel.startsWith('#') ? channel.slice(1) : channel
  await slack.chat.postMessage({ channel: normalizedChannel, text })
}

export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    scope: 'chat:write,channels:read,groups:read,channels:join',
    redirect_uri: process.env.SLACK_REDIRECT_URI,
    state,
  })
  return `https://slack.com/oauth/v2/authorize?${params}`
}

export async function exchangeCode(code) {
  const params = new URLSearchParams({
    code,
    client_id: process.env.SLACK_CLIENT_ID,
    client_secret: process.env.SLACK_CLIENT_SECRET,
    redirect_uri: process.env.SLACK_REDIRECT_URI,
  })

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const data = await res.json()

  if (!data.ok) throw new Error(data.error || 'Slack OAuth failed')

  return { access_token: data.access_token, team_name: data.team?.name }
}

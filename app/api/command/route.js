import { getSupabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { sendEmail } from '@/lib/connectors/gmail'
import { sendMessage } from '@/lib/connectors/slack'

export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders })
  }

  const { command, orgSlug } = body

  if (!command || typeof command !== 'string' || command.trim().length < 2) {
    return Response.json({ error: 'command is required' }, { status: 400, headers: corsHeaders })
  }
  if (!orgSlug || typeof orgSlug !== 'string') {
    return Response.json({ error: 'orgSlug is required' }, { status: 400, headers: corsHeaders })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const parsePrompt = `You are parsing a natural language command for Coelacanth.
Extract the intent and details from this command: "${command.replace(/"/g, '\\"')}"

Return JSON only:
{
  "action": "send_email" | "send_slack" | "find_file" | "unknown",
  "to": "recipient name or email",
  "email": "email address if mentioned",
  "subject": "inferred email subject",
  "body": "the message to send",
  "channel": "slack channel if mentioned (without #)",
  "filename": "file name if mentioned"
}`

  let parsed
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: parsePrompt }],
    })
    parsed = JSON.parse(message.content[0].text)
  } catch {
    return Response.json(
      { ok: false, message: "Couldn't understand that command." },
      { headers: corsHeaders }
    )
  }

  const { action } = parsed

  if (action === 'unknown') {
    return Response.json(
      { ok: false, message: 'Try: "Email [name] about..." or "Send a Slack message to #channel saying..."' },
      { headers: corsHeaders }
    )
  }

  if (action === 'find_file') {
    return Response.json({ ok: false, message: 'File search is coming soon.' }, { headers: corsHeaders })
  }

  const db = getSupabaseAdmin()

  // ── Gmail ──────────────────────────────────────────────────────────────────

  if (action === 'send_email') {
    const { data: token, error } = await db
      .from('oauth_tokens')
      .select('access_token, refresh_token')
      .eq('org_slug', orgSlug)
      .eq('provider', 'gmail')
      .single()

    if (error || !token) {
      return Response.json(
        { ok: false, message: 'Gmail not connected — open Settings to connect.' },
        { headers: corsHeaders }
      )
    }

    try {
      await sendEmail({
        to: parsed.email || parsed.to,
        subject: parsed.subject || '(no subject)',
        body: parsed.body || '',
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        orgSlug,
      })
    } catch (err) {
      return Response.json(
        { ok: false, message: `Gmail error: ${err.message}` },
        { headers: corsHeaders }
      )
    }

    const recipient = parsed.to || parsed.email || 'recipient'
    return Response.json({ ok: true, message: `Email sent to ${recipient}` }, { headers: corsHeaders })
  }

  // ── Slack ──────────────────────────────────────────────────────────────────

  if (action === 'send_slack') {
    const { data: token, error } = await db
      .from('oauth_tokens')
      .select('access_token')
      .eq('org_slug', orgSlug)
      .eq('provider', 'slack')
      .single()

    if (error || !token) {
      return Response.json(
        { ok: false, message: 'Slack not connected — open Settings to connect.' },
        { headers: corsHeaders }
      )
    }

    try {
      await sendMessage({
        channel: parsed.channel || 'general',
        text: parsed.body || command,
        accessToken: token.access_token,
      })
    } catch (err) {
      return Response.json(
        { ok: false, message: `Slack error: ${err.message}` },
        { headers: corsHeaders }
      )
    }

    const target = parsed.channel ? `#${parsed.channel}` : 'Slack'
    return Response.json({ ok: true, message: `Message sent to ${target}` }, { headers: corsHeaders })
  }

  return Response.json(
    { ok: false, message: `'${action}' is not yet supported.` },
    { headers: corsHeaders }
  )
}

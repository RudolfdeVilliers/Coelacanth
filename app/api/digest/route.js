import { getSupabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { buildDigestEmail } from '@/lib/email'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const MODEL = 'claude-sonnet-4-20250514'

export async function POST(req) {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Fetch all organisations
  const { data: orgs, error: orgsError } = await db
    .from('organisations')
    .select('id, name, slug, admin_email')

  if (orgsError) {
    return Response.json({ error: 'Failed to fetch organisations' }, { status: 500 })
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekOf = new Date().toISOString().split('T')[0]

  const results = await Promise.allSettled(
    orgs.map(org => processOrg(org, weekAgo, weekOf, db, anthropic, resend))
  )

  const summary = results.map((r, i) => ({
    org: orgs[i].slug,
    status: r.status,
    reason: r.status === 'rejected' ? r.reason?.message : undefined,
  }))

  return Response.json({ ok: true, summary })
}

async function processOrg(org, weekAgo, weekOf, db, anthropic, resend) {
  // Fetch this week's ideas
  const { data: ideas, error } = await db
    .from('ideas')
    .select('body, category')
    .eq('org_id', org.id)
    .gte('submitted_at', weekAgo)

  if (error) throw new Error(`Failed to fetch ideas: ${error.message}`)

  // Skip if fewer than 3 ideas
  if (!ideas || ideas.length < 3) {
    return { skipped: true, reason: 'insufficient ideas' }
  }

  // Build Claude prompt
  const prompt = `You are analysing anonymous employee feedback submitted this week.
Company: ${org.name}
Total submissions: ${ideas.length}

Submissions (format: [category] text):
${ideas.map((i, n) => `${n + 1}. [${i.category || 'general'}] ${i.body}`).join('\n')}

Return a JSON object with exactly these fields:
{
  "top_issues": [
    { "theme": "short theme title", "count": N, "example": "quote from an actual submission" }
  ],
  "top_opportunities": [
    { "theme": "short theme title", "count": N }
  ],
  "quick_wins": ["actionable item 1", "actionable item 2", "actionable item 3"],
  "sentiment": {
    "positive_pct": N,
    "neutral_pct": N,
    "frustrated_pct": N
  },
  "ai_insight": "One sentence. Most important pattern in plain English.",
  "participation_note": "Optional: one sentence if participation seems low or unusually high."
}

Rules:
- top_issues: max 3 items, sorted by count descending
- top_opportunities: max 2 items
- quick_wins: max 3 items, each under 10 words, genuinely actionable
- sentiment percentages must sum to 100
- example quotes must be paraphrased, not verbatim (protect anonymity)
- Return ONLY the JSON object, no markdown, no preamble`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const insights = JSON.parse(message.content[0].text)

  // Upsert digest
  const { error: upsertError } = await db
    .from('digests')
    .upsert({
      org_id: org.id,
      week_of: weekOf,
      total_submissions: ideas.length,
      insights,
    }, { onConflict: 'org_id,week_of' })

  if (upsertError) throw new Error(`Failed to upsert digest: ${upsertError.message}`)

  // Send email
  const html = buildDigestEmail(org.name, weekOf, ideas.length, insights)

  const { error: emailError } = await resend.emails.send({
    from: 'Coelacanth Digest <hi@coelacanth.co.za>',
    to: org.admin_email,
    subject: `${org.name} — Weekly Insights (${weekOf})`,
    html,
  })

  if (emailError) throw new Error(`Failed to send email: ${emailError.message}`)

  return { ok: true, ideasProcessed: ideas.length }
}

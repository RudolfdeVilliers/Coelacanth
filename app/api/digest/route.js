import { getSupabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import PDFDocument from 'pdfkit'

export const dynamic = 'force-dynamic'

const MODEL = 'claude-sonnet-4-20250514'

// Brand colours
const NAVY = '#083470'
const CYAN = '#5ce1e6'
const SLATE = '#5d879a'

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

  // Generate PDF
  const pdfBuffer = await generatePDF(org, weekOf, ideas.length, insights, ideas)

  // Save PDF to Supabase Storage
  const pdfPath = `${org.slug}/week-${weekOf}.pdf`
  const { error: storageError } = await db.storage
    .from('digests')
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (storageError) {
    console.error(`Storage upload failed for ${org.slug}:`, storageError.message)
    // Non-fatal — continue to email
  }

  // Send email with PDF attachment
  const emailHtml = buildBriefEmail(org.name, weekOf, ideas.length, insights)

  const { error: emailError } = await resend.emails.send({
    from: 'Coelacanth Digest <hi@coelacanth.co.za>',
    to: org.admin_email,
    subject: `Coelacanth Weekly Insights — week of ${weekOf}`,
    html: emailHtml,
    attachments: [{
      filename: `coelacanth-insights-${weekOf}.pdf`,
      content: pdfBuffer,
    }],
  })

  if (emailError) throw new Error(`Failed to send email: ${emailError.message}`)

  return { ok: true, ideasProcessed: ideas.length }
}

// ─── PDF generation ─────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function generatePDF(org, weekOf, totalIdeas, insights, ideas) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 70, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `${org.name} — Weekly Employee Insights`,
        Author: 'Coelacanth',
        Subject: `Week of ${weekOf}`,
      },
    })

    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = doc.page.width
    const contentW = pageW - 100 // 50px margin each side
    const [nr, ng, nb] = hexToRgb(NAVY)
    const [cr, cg, cb] = hexToRgb(CYAN)
    const [sr, sg, sb] = hexToRgb(SLATE)

    // ── COVER PAGE ──────────────────────────────────────────────────────────
    // Top accent bar
    doc.rect(0, 0, pageW, 6).fill(CYAN)

    doc.moveDown(5)
    doc.fontSize(10)
      .fillColor(SLATE)
      .font('Helvetica')
      .text('WEEKLY EMPLOYEE INSIGHTS', { align: 'center', characterSpacing: 2 })

    doc.moveDown(0.6)
    doc.fontSize(26)
      .fillColor(NAVY)
      .font('Helvetica-Bold')
      .text(org.name, { align: 'center' })

    doc.moveDown(0.5)
    doc.fontSize(13)
      .fillColor(SLATE)
      .font('Helvetica')
      .text(`Week of ${weekOf}`, { align: 'center' })

    doc.moveDown(1.5)
    // Stat box
    const boxX = pageW / 2 - 80
    const boxY = doc.y
    doc.roundedRect(boxX, boxY, 160, 64, 8)
      .fillAndStroke('#f0fbfc', CYAN)
    doc.fontSize(28)
      .fillColor(NAVY)
      .font('Helvetica-Bold')
      .text(`${totalIdeas}`, boxX, boxY + 10, { width: 160, align: 'center' })
    doc.fontSize(11)
      .fillColor(SLATE)
      .font('Helvetica')
      .text('submissions this week', boxX, boxY + 42, { width: 160, align: 'center' })

    doc.moveDown(6)
    doc.fontSize(9)
      .fillColor(SLATE)
      .text('Confidential — prepared for admin use only', { align: 'center' })

    // ── PAGE 1: Summary ──────────────────────────────────────────────────────
    doc.addPage()
    addSectionHeader(doc, 'Summary', contentW, NAVY, CYAN)

    // Sentiment breakdown
    const s = insights.sentiment || {}
    addSubheading(doc, 'Sentiment breakdown', SLATE)

    const sentiments = [
      { label: 'Positive', pct: s.positive_pct || 0, color: '#22c55e' },
      { label: 'Neutral', pct: s.neutral_pct || 0, color: SLATE },
      { label: 'Frustrated', pct: s.frustrated_pct || 0, color: '#ef4444' },
    ]
    sentiments.forEach(({ label, pct, color }) => {
      const y = doc.y
      doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica').text(`${label}`, 50, y)
      doc.fontSize(11).fillColor(color).font('Helvetica-Bold').text(`${pct}%`, 130, y)
      // Bar
      const barX = 180
      const barW = contentW - 130
      doc.rect(barX, y + 3, barW, 8).fill('#f0f0f0')
      doc.rect(barX, y + 3, Math.round((pct / 100) * barW), 8).fill(color)
      doc.moveDown(0.9)
    })

    doc.moveDown(0.5)
    if (insights.participation_note) {
      doc.fontSize(11).fillColor(SLATE).font('Helvetica-Oblique')
        .text(insights.participation_note, { lineGap: 2 })
    }

    // ── PAGE 2: Top Issues ───────────────────────────────────────────────────
    doc.addPage()
    addSectionHeader(doc, 'Top Issues', contentW, NAVY, CYAN)

    const topIssues = insights.top_issues || []
    topIssues.forEach((issue, i) => {
      const y = doc.y
      // Number badge
      doc.circle(60, y + 8, 10).fill(CYAN)
      doc.fontSize(11).fillColor('white').font('Helvetica-Bold')
        .text(`${i + 1}`, 54, y + 3)
      doc.fontSize(13).fillColor(NAVY).font('Helvetica-Bold')
        .text(issue.theme, 78, y, { width: contentW - 30 })
      doc.fontSize(11).fillColor(SLATE).font('Helvetica')
        .text(`${issue.count} mention${issue.count !== 1 ? 's' : ''}`, 78, doc.y)
      if (issue.example) {
        doc.moveDown(0.3)
        doc.fontSize(11).fillColor('#555555').font('Helvetica-Oblique')
          .text(`"${issue.example}"`, 78, doc.y, { width: contentW - 30, lineGap: 2 })
      }
      doc.moveDown(1)
    })

    // ── PAGE 3: Opportunities + Quick Wins ───────────────────────────────────
    doc.addPage()
    addSectionHeader(doc, 'Opportunities', contentW, NAVY, CYAN)

    const opps = insights.top_opportunities || []
    opps.forEach(opp => {
      doc.rect(50, doc.y, 3, 18).fill(CYAN)
      doc.fontSize(13).fillColor(NAVY).font('Helvetica-Bold')
        .text(opp.theme, 62, doc.y - 16, { width: contentW - 14 })
      doc.fontSize(11).fillColor(SLATE).font('Helvetica')
        .text(`${opp.count} mention${opp.count !== 1 ? 's' : ''}`, 62, doc.y)
      doc.moveDown(0.8)
    })

    doc.moveDown(0.8)
    addSectionHeader(doc, 'Quick Wins', contentW, NAVY, CYAN)

    const wins = insights.quick_wins || []
    wins.forEach(win => {
      const y = doc.y
      doc.rect(50, y + 4, 6, 6).fill(CYAN)
      doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica')
        .text(win, 65, y, { width: contentW - 17, lineGap: 2 })
      doc.moveDown(0.6)
    })

    // ── PAGE 4: AI Insight + Raw Samples ─────────────────────────────────────
    doc.addPage()
    addSectionHeader(doc, 'AI Insight', contentW, NAVY, CYAN)

    // Insight box
    const insightY = doc.y
    const insightH = 70
    doc.rect(50, insightY, contentW, insightH).fill('#f0fbfc')
    doc.rect(50, insightY, 4, insightH).fill(CYAN)
    doc.fontSize(12).fillColor(NAVY).font('Helvetica-Oblique')
      .text(insights.ai_insight || '', 62, insightY + 16, {
        width: contentW - 20,
        lineGap: 3,
      })
    doc.y = insightY + insightH + 16

    doc.moveDown(0.5)
    addSectionHeader(doc, 'Submission Samples', contentW, NAVY, CYAN)

    doc.fontSize(9).fillColor(SLATE).font('Helvetica')
      .text('The following are anonymised samples from this week\'s submissions.', {
        lineGap: 2,
      })
    doc.moveDown(0.6)

    const samples = (ideas || []).slice(0, 8)
    samples.forEach((idea, i) => {
      const cat = idea.category ? `[${idea.category}]` : '[general]'
      doc.fontSize(10).fillColor(SLATE).font('Helvetica-Bold')
        .text(`${i + 1}. ${cat} `, { continued: true })
      doc.fontSize(10).fillColor('#1a1a1a').font('Helvetica')
        .text(idea.body, { lineGap: 2 })
      doc.moveDown(0.4)
    })

    // ── Footers on every page ─────────────────────────────────────────────────
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i)
      const pageNum = i + 1
      const total = range.count
      const footerY = doc.page.height - 40

      // Bottom rule
      doc.moveTo(50, footerY - 8).lineTo(pageW - 50, footerY - 8)
        .strokeColor(CYAN).lineWidth(0.5).stroke()

      doc.fontSize(8).fillColor(SLATE).font('Helvetica')
        .text('Coelacanth — confidential', 50, footerY, {
          width: contentW,
          continued: true,
          align: 'left',
        })
        .text(`Page ${pageNum} of ${total}`, { align: 'right' })
    }

    doc.flushPages()
    doc.end()
  })
}

function addSectionHeader(doc, title, contentW, navy, cyan) {
  doc.fontSize(17).fillColor(navy).font('Helvetica-Bold').text(title)
  doc.moveDown(0.2)
  const lineY = doc.y
  doc.moveTo(50, lineY).lineTo(50 + contentW, lineY)
    .strokeColor(cyan).lineWidth(1.5).stroke()
  doc.moveDown(0.8)
}

function addSubheading(doc, text, slate) {
  doc.fontSize(11).fillColor(slate).font('Helvetica-Bold')
    .text(text.toUpperCase(), { characterSpacing: 0.5 })
  doc.moveDown(0.5)
}

// ─── Brief email body ────────────────────────────────────────────────────────

function buildBriefEmail(orgName, weekOf, totalIdeas, insights) {
  const topIssue = insights.top_issues?.[0]
  const wins = insights.quick_wins || []

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">

  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
    <div style="width: 18px; height: 18px; background: #5ce1e6; border-radius: 50%;"></div>
    <strong style="font-size: 16px; color: #083470;">Coelacanth</strong>
    <span style="color: #888; font-size: 13px; margin-left: auto;">Week of ${weekOf}</span>
  </div>

  <h1 style="font-size: 20px; margin: 0 0 4px; color: #083470;">${orgName} — Weekly Insights</h1>
  <p style="color: #5d879a; font-size: 14px; margin: 0 0 24px;">${totalIdeas} anonymous submissions this week</p>

  ${topIssue ? `
  <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 10px;">Top issue this week</h2>
  <div style="padding: 12px 16px; background: #f0fbfc; border-left: 3px solid #5ce1e6; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
    <strong style="font-size: 15px; color: #083470;">${topIssue.theme}</strong>
    <span style="color: #5d879a; font-size: 13px; margin-left: 8px;">${topIssue.count} mentions</span>
    ${topIssue.example ? `<p style="color: #555; font-size: 13px; margin: 6px 0 0; font-style: italic;">"${topIssue.example}"</p>` : ''}
  </div>
  ` : ''}

  ${wins.length ? `
  <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 10px;">Quick wins</h2>
  ${wins.map(win => `
    <div style="padding: 8px 12px; border-left: 3px solid #5ce1e6; margin-bottom: 6px; font-size: 14px;">${win}</div>
  `).join('')}
  ` : ''}

  <div style="background: #fffff8; border: 1px solid #5ce1e6; border-radius: 8px; padding: 14px; margin: 24px 0;">
    <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #5d879a;">AI insight</strong>
    <p style="margin: 6px 0 0; font-size: 14px; font-style: italic; color: #083470;">${insights.ai_insight || ''}</p>
  </div>

  <p style="color: #aaa; font-size: 12px; margin-top: 24px;">Full report attached as PDF.</p>
  <p style="color: #aaa; font-size: 12px; margin-top: 8px; text-align: center;">
    Powered by Coelacanth
  </p>

</body>
</html>`
}

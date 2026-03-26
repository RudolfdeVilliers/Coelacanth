import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

// ANONYMITY: do not add user tracking here
// Simple in-memory rate limiter: max 20 requests/min per orgSlug
const rateLimitMap = new Map()

function checkRateLimit(orgSlug) {
  const now = Date.now()
  const windowMs = 60 * 1000
  const maxRequests = 20

  if (!rateLimitMap.has(orgSlug)) {
    rateLimitMap.set(orgSlug, [])
  }

  const timestamps = rateLimitMap.get(orgSlug).filter(t => now - t < windowMs)
  if (timestamps.length >= maxRequests) {
    return false
  }

  timestamps.push(now)
  rateLimitMap.set(orgSlug, timestamps)
  return true
}

function stripPII(text) {
  // Remove email addresses
  let clean = text.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[email removed]')
  // Remove phone numbers (various formats)
  clean = clean.replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[phone removed]')
  return clean
}

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders })
  }

  const { idea, category, orgSlug, file } = body

  // Validate
  if (!idea || typeof idea !== 'string') {
    return Response.json({ error: 'idea is required' }, { status: 400, headers: corsHeaders })
  }
  if (idea.length < 5 || idea.length > 1000) {
    return Response.json({ error: 'idea must be between 5 and 1000 characters' }, { status: 400, headers: corsHeaders })
  }
  if (!orgSlug || typeof orgSlug !== 'string') {
    return Response.json({ error: 'orgSlug is required' }, { status: 400, headers: corsHeaders })
  }

  const validCategories = ['operations', 'culture', 'product', 'management', 'other']
  if (category && !validCategories.includes(category)) {
    return Response.json({ error: 'invalid category' }, { status: 400, headers: corsHeaders })
  }

  // Validate file if present
  if (file) {
    if (!file.name || !file.type || !file.data) {
      return Response.json({ error: 'invalid file attachment' }, { status: 400, headers: corsHeaders })
    }
    const allowedTypes = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png', 'image/jpeg', 'text/plain']
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: 'unsupported file type' }, { status: 400, headers: corsHeaders })
    }
  }

  // Rate limit
  if (!checkRateLimit(orgSlug)) {
    return Response.json({ error: 'Too many submissions. Please wait a moment.' }, { status: 429, headers: corsHeaders })
  }

  const db = getSupabaseAdmin()

  // Look up org
  const { data: org, error: orgError } = await db
    .from('organisations')
    .select('id')
    .eq('slug', orgSlug)
    .single()

  if (orgError || !org) {
    return Response.json({ error: 'Organisation not found' }, { status: 404, headers: corsHeaders })
  }

  // Strip PII before saving
  const cleanBody = stripPII(idea)

  // Insert idea — no user ID, no IP address, nothing identifying
  const { data: newIdea, error: insertError } = await db
    .from('ideas')
    .insert({
      org_id: org.id,
      body: cleanBody,
      category: category || null,
    })
    .select('id')
    .single()

  if (insertError || !newIdea) {
    return Response.json({ error: 'Failed to save idea' }, { status: 500, headers: corsHeaders })
  }

  // Handle file attachment if present
  if (file) {
    try {
      const fileBuffer = Buffer.from(file.data, 'base64')
      const filePath = `${org.id}/${newIdea.id}/${file.name}`

      const { error: uploadError } = await db.storage
        .from('attachments')
        .upload(filePath, fileBuffer, { contentType: file.type, upsert: false })

      if (!uploadError) {
        await db
          .from('ideas')
          .update({ attachment_path: filePath })
          .eq('id', newIdea.id)
      }
      // If upload fails, the idea is still saved — attachment is optional
    } catch {
      // Non-fatal: attachment upload failure doesn't block submission
    }
  }

  // Count similar ideas this week for the toast
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await db
    .from('ideas')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .gte('submitted_at', weekAgo)

  return Response.json({ ok: true, similar_count: count ?? 0 }, { headers: corsHeaders })
}

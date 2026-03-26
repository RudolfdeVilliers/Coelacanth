import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email } = body

  if (!email || typeof email !== 'string') {
    return Response.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email.trim())) {
    return Response.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const normalised = email.trim().toLowerCase()

  const { error: insertError } = await db
    .from('waitlist')
    .insert({ email: normalised })

  if (insertError) {
    if (insertError.code === '23505') {
      // Unique violation — already on the list
      return Response.json({ error: "You're already on the list!" }, { status: 409 })
    }
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  const { count } = await db
    .from('waitlist')
    .select('*', { count: 'exact', head: true })

  return Response.json({ ok: true, position: count ?? 1 })
}

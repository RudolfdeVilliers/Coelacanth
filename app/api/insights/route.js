import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function checkAuth(req) {
  const auth = req.headers.get('Authorization')
  const expected = process.env.ADMIN_PASSWORD
  return auth === expected || auth === `Bearer ${expected}`
}

export async function GET(req) {
  if (!checkAuth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const orgSlug = searchParams.get('orgSlug')
  const weeks = parseInt(searchParams.get('weeks') || '4', 10)

  if (!orgSlug) {
    return Response.json({ error: 'orgSlug is required' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // Fetch org
  const { data: org, error: orgError } = await db
    .from('organisations')
    .select('id, name, slug, admin_email')
    .eq('slug', orgSlug)
    .single()

  if (orgError || !org) {
    return Response.json({ error: 'Organisation not found' }, { status: 404 })
  }

  // This week boundaries
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  // This week's ideas
  const { data: thisWeekIdeas } = await db
    .from('ideas')
    .select('category')
    .eq('org_id', org.id)
    .gte('submitted_at', startOfWeek.toISOString())

  const byCategory = { operations: 0, culture: 0, product: 0, management: 0, other: 0 }
  for (const idea of thisWeekIdeas || []) {
    const cat = idea.category || 'other'
    if (byCategory[cat] !== undefined) byCategory[cat]++
    else byCategory.other++
  }

  // Latest digest
  const { data: latestDigest } = await db
    .from('digests')
    .select('*')
    .eq('org_id', org.id)
    .order('week_of', { ascending: false })
    .limit(1)
    .single()

  // Recent digests for trend chart
  const { data: recentDigests } = await db
    .from('digests')
    .select('week_of, total_submissions, insights')
    .eq('org_id', org.id)
    .order('week_of', { ascending: false })
    .limit(weeks)

  // Raw feed (last 20 ideas)
  const { data: rawFeed } = await db
    .from('ideas')
    .select('body, category, submitted_at')
    .eq('org_id', org.id)
    .order('submitted_at', { ascending: false })
    .limit(20)

  return Response.json({
    org: { name: org.name, slug: org.slug },
    thisWeek: {
      total: thisWeekIdeas?.length ?? 0,
      byCategory,
    },
    latestDigest: latestDigest ?? null,
    recentDigests: recentDigests ?? [],
    rawFeed: rawFeed ?? [],
  })
}

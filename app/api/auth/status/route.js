import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const orgSlug = searchParams.get('orgSlug')
  const provider = searchParams.get('provider')

  if (!orgSlug || !provider) {
    return Response.json(
      { error: 'orgSlug and provider are required' },
      { status: 400, headers: corsHeaders }
    )
  }

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('oauth_tokens')
    .select('id')
    .eq('org_slug', orgSlug)
    .eq('provider', provider)
    .single()

  return Response.json({ connected: !error && !!data }, { headers: corsHeaders })
}

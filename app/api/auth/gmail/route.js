import { getAuthUrl } from '@/lib/connectors/gmail'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const orgSlug = searchParams.get('orgSlug')

  if (!orgSlug) {
    return Response.json({ error: 'orgSlug is required' }, { status: 400 })
  }

  const state = Buffer.from(JSON.stringify({ orgSlug })).toString('base64')
  return Response.redirect(getAuthUrl(state))
}

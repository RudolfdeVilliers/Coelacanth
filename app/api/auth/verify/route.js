export const dynamic = 'force-dynamic'

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { password } = body

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = Buffer.from(password).toString('base64')
  return Response.json({ ok: true, token })
}

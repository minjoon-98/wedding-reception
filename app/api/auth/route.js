import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { verifyPin, createToken } from '@/lib/auth'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: '잘못된 요청입니다.' },
      { status: 400 }
    )
  }

  const { weddingId, pin } = body

  if (!weddingId || !pin) {
    return NextResponse.json(
      { success: false, error: '결혼식 ID와 PIN을 입력해주세요.' },
      { status: 400 }
    )
  }

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { success: false, error: 'PIN은 4자리 숫자여야 합니다.' },
      { status: 400 }
    )
  }

  const supabase = createSupabaseServer()
  const { data: wedding, error } = await supabase
    .from('weddings')
    .select('id, pin_master, pin_groom, pin_bride, groom_name, bride_name')
    .eq('id', weddingId)
    .single()

  if (error || !wedding) {
    return NextResponse.json(
      { success: false, error: '결혼식을 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  // Check PINs: master first, then groom, then bride
  const pinChecks = [
    { hash: wedding.pin_master, role: 'admin', side: null },
    { hash: wedding.pin_groom, role: 'recorder', side: '신랑측' },
    { hash: wedding.pin_bride, role: 'recorder', side: '신부측' },
  ]

  let matchedRole = null
  let matchedSide = null

  for (const check of pinChecks) {
    if (check.hash && (await verifyPin(pin, check.hash))) {
      matchedRole = check.role
      matchedSide = check.side
      break
    }
  }

  if (!matchedRole) {
    return NextResponse.json(
      { success: false, error: 'PIN이 일치하지 않습니다.' },
      { status: 401 }
    )
  }

  const token = await createToken({
    weddingId,
    role: matchedRole,
    side: matchedSide,
  })

  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === 'production'

  cookieStore.set(`wedding_${weddingId}`, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return NextResponse.json({
    success: true,
    role: matchedRole,
    side: matchedSide,
    groomName: wedding.groom_name,
    brideName: wedding.bride_name,
  })
}

import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createSupabaseServer } from '@/lib/supabase-server'
import { hashPin } from '@/lib/auth'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: '잘못된 요청입니다.' },
      { status: 400 },
    )
  }

  const {
    groomName,
    brideName,
    weddingDate,
    venueName,
    venueDetail,
    venueAddress,
    groomFather,
    groomMother,
    brideFather,
    brideMother,
    invitationUrl,
    pinGroom,
    pinBride,
    pinMaster,
  } = body

  // Validate required fields
  if (!groomName || !brideName) {
    return NextResponse.json(
      { success: false, error: '신랑과 신부 이름은 필수입니다.' },
      { status: 400 },
    )
  }

  // Validate PINs: all must be 4 digits
  const pinRegex = /^\d{4}$/
  if (!pinRegex.test(pinGroom) || !pinRegex.test(pinBride) || !pinRegex.test(pinMaster)) {
    return NextResponse.json(
      { success: false, error: 'PIN은 모두 4자리 숫자여야 합니다.' },
      { status: 400 },
    )
  }

  // Validate PINs: all must be different
  if (pinGroom === pinBride || pinGroom === pinMaster || pinBride === pinMaster) {
    return NextResponse.json(
      { success: false, error: '세 개의 PIN은 모두 달라야 합니다.' },
      { status: 400 },
    )
  }

  const id = nanoid(8)

  const [hashedGroom, hashedBride, hashedMaster] = await Promise.all([
    hashPin(pinGroom),
    hashPin(pinBride),
    hashPin(pinMaster),
  ])

  const supabase = createSupabaseServer()
  const { error } = await supabase.from('weddings').insert({
    id,
    groom_name: groomName,
    bride_name: brideName,
    wedding_date: weddingDate || null,
    venue_name: venueName || null,
    venue_detail: venueDetail || null,
    venue_address: venueAddress || null,
    groom_father: groomFather || null,
    groom_mother: groomMother || null,
    bride_father: brideFather || null,
    bride_mother: brideMother || null,
    invitation_url: invitationUrl || null,
    pin_groom: hashedGroom,
    pin_bride: hashedBride,
    pin_master: hashedMaster,
  })

  if (error) {
    return NextResponse.json(
      { success: false, error: '결혼식 생성에 실패했습니다.', detail: error.message, code: error.code },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, id })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'ID가 필요합니다.' },
      { status: 400 },
    )
  }

  const supabase = createSupabaseServer()
  const { data: wedding, error } = await supabase
    .from('weddings')
    .select('groom_name, bride_name, wedding_date, venue_name')
    .eq('id', id)
    .single()

  if (error || !wedding) {
    return NextResponse.json(
      { success: false, error: '결혼식을 찾을 수 없습니다.' },
      { status: 404 },
    )
  }

  return NextResponse.json({
    success: true,
    groomName: wedding.groom_name,
    brideName: wedding.bride_name,
    weddingDate: wedding.wedding_date,
    venueName: wedding.venue_name,
  })
}

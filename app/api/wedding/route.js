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

  // 청첩장 URL 중복 검사
  if (invitationUrl) {
    const supabaseCheck = createSupabaseServer()
    const { data: existing } = await supabaseCheck
      .from('weddings')
      .select('id, groom_name, bride_name')
      .eq('invitation_url', invitationUrl)
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        duplicate: true,
        existingId: existing.id,
        error: `이미 등록된 청첩장입니다. (${existing.groom_name} ♥ ${existing.bride_name})`,
      }, { status: 409 })
    }
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
  const q = searchParams.get('q')

  const supabase = createSupabaseServer()

  // ID로 단일 조회
  if (id) {
    const { data: wedding, error } = await supabase
      .from('weddings')
      .select('id, groom_name, bride_name, wedding_date, venue_name, invitation_url')
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
      id: wedding.id,
      groomName: wedding.groom_name,
      brideName: wedding.bride_name,
      weddingDate: wedding.wedding_date,
      venueName: wedding.venue_name,
      invitationUrl: wedding.invitation_url,
    })
  }

  // 검색 (이름, 장소, 날짜)
  if (q) {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      return NextResponse.json({ success: true, results: [] })
    }

    const { data: results, error } = await supabase
      .from('weddings')
      .select('id, groom_name, bride_name, wedding_date, venue_name, invitation_url')
      .or(`groom_name.ilike.%${trimmed.replace(/[,%()]/g, '')}%,bride_name.ilike.%${trimmed.replace(/[,%()]/g, '')}%,venue_name.ilike.%${trimmed.replace(/[,%()]/g, '')}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      results: (results || []).map(w => ({
        id: w.id,
        groomName: w.groom_name,
        brideName: w.bride_name,
        weddingDate: w.wedding_date,
        venueName: w.venue_name,
        invitationUrl: w.invitation_url,
      })),
    })
  }

  return NextResponse.json({ success: false, error: 'id 또는 q 파라미터가 필요합니다.' }, { status: 400 })
}

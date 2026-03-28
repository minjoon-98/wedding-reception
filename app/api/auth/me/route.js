import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  const weddingId = request.headers.get('x-wedding-id')

  if (!weddingId) {
    return NextResponse.json(
      { error: '결혼식 ID가 필요합니다.' },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(`wedding_${weddingId}`)?.value

  if (!token) {
    return NextResponse.json(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    )
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return NextResponse.json(
      { error: '유효하지 않은 토큰입니다.' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    role: payload.role,
    side: payload.side,
  })
}

import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PROTECTED_PATTERN = /^\/w\/([^/]+)\/(record|admin)/

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const match = pathname.match(PROTECTED_PATTERN)

  if (!match) {
    return NextResponse.next()
  }

  const weddingId = match[1]
  const section = match[2]

  const token = request.cookies.get(`wedding_${weddingId}`)?.value

  if (!token) {
    return NextResponse.redirect(new URL(`/w/${weddingId}`, request.url))
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return NextResponse.redirect(new URL(`/w/${weddingId}`, request.url))
  }

  // Admin pages require admin role
  if (section === 'admin' && payload.role !== 'admin') {
    return NextResponse.redirect(new URL(`/w/${weddingId}`, request.url))
  }

  // Pass auth info via request headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-wedding-id', weddingId)
  requestHeaders.set('x-wedding-role', payload.role)
  requestHeaders.set('x-wedding-side', payload.side || '')

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: ['/w/:id/record/:path*', '/w/:id/admin/:path*'],
}

'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

export default function AdminPage({ params }) {
  const { id } = use(params)
  const [auth, setAuth] = useState(null)

  useEffect(() => {
    async function fetchAuth() {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'x-wedding-id': id },
        })
        if (res.ok) {
          setAuth(await res.json())
        }
      } catch {}
    }
    fetchAuth()
  }, [id])

  // Auth API returns Korean side ('신랑측'/'신부측') — convert to English for AdminPanel
  const normalizedSide = auth?.side === '신부측' ? 'bride'
    : auth?.side === '신랑측' ? 'groom'
    : auth?.side // 'groom'/'bride' or null for admin

  const sideLabel = normalizedSide === 'groom' ? '신랑측'
    : normalizedSide === 'bride' ? '신부측'
    : auth?.role === 'admin' ? '전체'
    : ''

  return (
    <main className="min-h-screen max-w-4xl lg:max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold text-gold-700">
            관리
          </h1>
          {sideLabel && (
            <span className={`text-xs px-2 py-1 rounded-full border ${
              normalizedSide === 'groom' ? 'bg-groom-100 text-groom-600 border-groom-200'
              : normalizedSide === 'bride' ? 'bg-bride-100 text-bride-600 border-bride-200'
              : 'bg-gold-100 text-gold-600 border-gold-200'
            }`}>
              {sideLabel}
            </span>
          )}
        </div>
        <Link
          href={`/w/${id}/record`}
          className="text-sm text-gold-500 hover:text-gold-700 transition-colors"
        >
          접수 화면
        </Link>
      </div>

      {auth ? (
        <AdminPanel weddingId={id} side={normalizedSide} role={auth.role} />
      ) : (
        <p className="text-gold-500 text-center animate-pulse py-12">불러오는 중...</p>
      )}
    </main>
  )
}

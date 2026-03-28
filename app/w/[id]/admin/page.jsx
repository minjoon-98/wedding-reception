'use client'

import { use } from 'react'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

export default function AdminPage({ params }) {
  const { id } = use(params)

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-gold-700">
          관리자
        </h1>
        <Link
          href={`/w/${id}/record`}
          className="text-sm text-gold-500 hover:text-gold-700 transition-colors"
        >
          ← 접수 화면
        </Link>
      </div>

      <AdminPanel weddingId={id} />
    </main>
  )
}

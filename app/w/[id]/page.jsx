'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PinInput from '@/components/PinInput'

export default function WeddingEntryPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [wedding, setWedding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function fetchWedding() {
      try {
        const res = await fetch(`/api/wedding?id=${encodeURIComponent(id)}`)
        const data = await res.json()

        if (!data.success) {
          setNotFound(true)
        } else {
          setWedding(data)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchWedding()
  }, [id])

  const handlePinSuccess = (data) => {
    if (data.role === 'admin') {
      router.push(`/w/${id}/admin`)
    } else {
      router.push(`/w/${id}/record`)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-gold-500 animate-pulse">불러오는 중...</p>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 gap-4">
        <h1 className="text-2xl font-display text-gold-700">404</h1>
        <p className="text-gold-500">결혼식을 찾을 수 없습니다.</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 gap-8">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-bold text-gold-700">
          {wedding.groomName} ♥ {wedding.brideName}
        </h1>
        {wedding.venueName && (
          <p className="text-gold-500 text-sm">{wedding.venueName}</p>
        )}
      </div>

      <PinInput weddingId={id} onSuccess={handlePinSuccess} />
    </main>
  )
}

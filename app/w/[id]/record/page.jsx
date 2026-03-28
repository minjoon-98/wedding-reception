'use client'

import { use, useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { formatAmount } from '@/lib/format'
import RecordForm from '@/components/RecordForm'
import GuestList from '@/components/GuestList'

const GROOM_SIDES = ['신랑측', '신랑 부모님', '미분류']
const BRIDE_SIDES = ['신부측', '신부 부모님', '미분류']

export default function RecordPage({ params }) {
  const { id } = use(params)
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [auth, setAuth] = useState(null)
  const channelRef = useRef(null)

  // Fetch auth info
  useEffect(() => {
    async function fetchAuth() {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'x-wedding-id': id },
        })
        if (res.ok) {
          const data = await res.json()
          setAuth(data)
        }
      } catch {
        // Auth info will be null, page still works
      }
    }
    fetchAuth()
  }, [id])

  // Load guests
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('wedding_id', id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setGuests(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`record-guests-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guests',
          filter: `wedding_id=eq.${id}`,
        },
        (payload) => {
          setGuests((prev) => {
            if (prev.some((g) => g.id === payload.new.id)) return prev
            return [payload.new, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'guests',
          filter: `wedding_id=eq.${id}`,
        },
        (payload) => {
          setGuests((prev) =>
            prev.map((g) => (g.id === payload.new.id ? payload.new : g))
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'guests',
          filter: `wedding_id=eq.${id}`,
        },
        (payload) => {
          setGuests((prev) => prev.filter((g) => g.id !== payload.old.id))
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // Determine side for current user
  const side = auth?.side === '신부측' ? 'bride' : 'groom'
  const sideFilter = side === 'bride' ? BRIDE_SIDES : GROOM_SIDES

  // Filter guests by side
  const myGuests = useMemo(
    () => guests.filter((g) => sideFilter.includes(g.side)),
    [guests, sideFilter]
  )

  // Stats
  const stats = useMemo(() => {
    const count = myGuests.length
    const total = myGuests.reduce((sum, g) => sum + (g.amount || 0), 0)
    return { count, total }
  }, [myGuests])

  // Last 10 for display
  const recentGuests = useMemo(() => myGuests.slice(0, 10), [myGuests])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gold-500 animate-pulse">불러오는 중...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Stats header */}
      <div className="flex justify-between items-center p-4 rounded-xl bg-gold-50 border border-gold-200">
        <div>
          <p className="text-sm text-gold-500">접수 현황</p>
          <p className="text-xl font-bold text-gold-700">
            {stats.count}명 · {formatAmount(stats.total)}원
          </p>
        </div>
        <div className="text-right">
          <span
            className={`text-xs px-2 py-1 rounded-full border ${
              side === 'bride'
                ? 'bg-bride-100 text-bride-600 border-bride-200'
                : 'bg-groom-100 text-groom-600 border-groom-200'
            }`}
          >
            {side === 'bride' ? '신부측' : '신랑측'}
          </span>
        </div>
      </div>

      {/* Record form */}
      <div className="bg-white rounded-xl border border-gold-200 shadow-sm">
        <RecordForm
          weddingId={id}
          side={side}
          allGuests={guests}
          onSubmitSuccess={() => {}}
        />
      </div>

      {/* Recent guests */}
      <div className="bg-white rounded-xl border border-gold-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gold-100">
          <h3 className="text-sm font-medium text-gold-600">최근 접수</h3>
        </div>
        <GuestList guests={recentGuests} />
      </div>
    </main>
  )
}

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
        .is('deleted_at', null)
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
            // Already have this guest by real ID
            if (prev.some((g) => g.id === payload.new.id)) return prev
            // Replace optimistic entry if one matches
            const idx = prev.findIndex(
              (g) => g._optimistic && g.name === payload.new.name && g.amount === payload.new.amount && g.recorded_by === payload.new.recorded_by
            )
            if (idx >= 0) {
              return prev.map((g, i) => (i === idx ? payload.new : g))
            }
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
          // Soft deleted — remove from list
          if (payload.new.deleted_at) {
            setGuests((prev) => prev.filter((g) => g.id !== payload.new.id))
            return
          }
          setGuests((prev) =>
            prev.map((g) => (g.id === payload.new.id ? payload.new : g))
          )
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // Determine side for current user (auth API returns Korean side values)
  const isAdmin = auth?.role === 'admin'
  const side = isAdmin ? 'all'
    : auth?.side === '신부측' ? 'bride'
    : 'groom'
  // Filter guests by side (admin sees all)
  const myGuests = useMemo(
    () => isAdmin ? guests : guests.filter((g) => (side === 'bride' ? BRIDE_SIDES : GROOM_SIDES).includes(g.side)),
    [guests, isAdmin, side]
  )

  // Stats
  const stats = useMemo(() => {
    const count = myGuests.length
    const total = myGuests.reduce((sum, g) => sum + (g.amount || 0), 0)
    return { count, total }
  }, [myGuests])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gold-500 animate-pulse">불러오는 중...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen mx-auto px-4 py-6 max-w-lg lg:max-w-5xl">
      {/* Stats header */}
      <div className="flex justify-between items-center p-4 rounded-xl bg-gold-50 border border-gold-200">
        <div>
          <p className="text-sm text-gold-500">접수 현황</p>
          <p className="text-xl lg:text-2xl font-bold text-gold-700">
            {stats.count}명 · {formatAmount(stats.total)}원
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded-full border ${
              side === 'bride'
                ? 'bg-bride-100 text-bride-600 border-bride-200'
                : side === 'all'
                ? 'bg-gold-100 text-gold-600 border-gold-200'
                : 'bg-groom-100 text-groom-600 border-groom-200'
            }`}
          >
            {side === 'bride' ? '신부측' : side === 'all' ? '전체' : '신랑측'}
          </span>
          <a
            href={`/w/${id}/admin`}
            className="text-sm px-4 py-2 rounded-full border border-gold-300 text-gold-600 hover:bg-gold-50 transition"
          >
            관리
          </a>
        </div>
      </div>

      {/* Main content - responsive 2-column on desktop */}
      <div className="mt-6 lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
        {/* Record form */}
        <div className="bg-white rounded-xl border border-gold-200 shadow-sm">
          <RecordForm
            weddingId={id}
            side={side}
            allGuests={myGuests}
            onSubmitSuccess={(guest) => {
              setGuests((prev) => [guest, ...prev])
            }}
            onSubmitError={(tempId) => {
              setGuests((prev) => prev.filter((g) => g.id !== tempId))
            }}
            onSubmitReplace={(tempId, realGuest) => {
              setGuests((prev) => {
                // Realtime already added the real guest — just remove temp
                if (prev.some((g) => g.id === realGuest.id)) {
                  return prev.filter((g) => g.id !== tempId)
                }
                // Replace temp with real data
                return prev.map((g) => (g.id === tempId ? realGuest : g))
              })
            }}
          />
        </div>

        {/* Recent guests */}
        <div className="bg-white rounded-xl border border-gold-200 shadow-sm flex flex-col max-h-96 lg:max-h-[calc(100vh-12rem)]">
          <div className="px-4 py-3 border-b border-gold-100 shrink-0">
            <h3 className="text-sm font-medium text-gold-600">
              최근 접수 <span className="text-gold-400">({myGuests.length})</span>
            </h3>
          </div>
          <div className="overflow-y-auto flex-1">
            <GuestList guests={myGuests} />
          </div>
        </div>
      </div>
    </main>
  )
}

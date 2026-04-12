'use client'

import { useMemo } from 'react'
import { formatAmount } from '@/lib/format'

const SIDE_LABELS = {
  '전체': 'bg-gold-50 border-gold-200 text-gold-700',
  '신랑측': 'bg-groom-50 border-groom-200 text-groom-600',
  '신부측': 'bg-bride-50 border-bride-200 text-bride-600',
  '신랑 부모님': 'bg-groom-200 border-groom-400 text-groom-600',
  '신부 부모님': 'bg-bride-200 border-bride-400 text-bride-600',
  '기타': 'bg-gold-50 border-gold-200 text-gold-500',
  '미분류': 'bg-gold-50 border-gold-200 text-gold-400',
}

export default function StatsCards({ guests }) {
  const stats = useMemo(() => {
    const totalAmount = guests.reduce((sum, g) => sum + (g.amount || 0), 0)
    const totalCount = guests.length

    const bySide = {}
    for (const g of guests) {
      const side = g.side || '미분류'
      if (!bySide[side]) {
        bySide[side] = { count: 0, amount: 0 }
      }
      bySide[side] = {
        count: bySide[side].count + 1,
        amount: bySide[side].amount + (g.amount || 0),
      }
    }

    return { totalAmount, totalCount, bySide }
  }, [guests])

  const sideEntries = Object.entries(stats.bySide)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {/* Total card */}
      <div className="col-span-2 sm:col-span-3 lg:col-span-4 rounded-xl border-2 border-gold-200 bg-gold-50 p-4 text-center">
        <p className="text-sm text-gold-500">전체</p>
        <p className="text-2xl font-bold text-gold-700">
          {formatAmount(stats.totalAmount)}원
        </p>
        <p className="text-sm text-gold-400">{stats.totalCount}명</p>
      </div>

      {/* Per-side cards */}
      {sideEntries.map(([side, data]) => (
        <div
          key={side}
          className={`rounded-xl border p-3 text-center ${SIDE_LABELS[side] || SIDE_LABELS['기타']}`}
        >
          <p className="text-xs opacity-70">{side}</p>
          <p className="text-lg font-bold">{formatAmount(data.amount)}원</p>
          <p className="text-xs opacity-60">{data.count}명</p>
        </div>
      ))}
    </div>
  )
}

'use client'

import { formatAmount, formatDateTime } from '@/lib/format'
import { getSideBadgeStyle } from '@/lib/constants'

export default function GuestList({ guests }) {
  if (!guests || guests.length === 0) {
    return (
      <div className="text-center py-8 text-gold-400 text-sm">
        아직 접수된 하객이 없습니다
      </div>
    )
  }

  return (
    <div className="divide-y divide-gold-100">
      {guests.map((guest) => (
        <div
          key={guest.id}
          className={`flex items-center justify-between py-3 px-4 ${
            guest._optimistic ? 'bg-gold-50/50 animate-pulse' : ''
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="font-medium text-gold-800 truncate">
              {guest.name}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${getSideBadgeStyle(
                guest.side
              )}`}
            >
              {guest.side}
            </span>
            {(guest.relation || guest.memo) && (
              <span className="text-xs text-gold-400 truncate hidden lg:inline">
                {[guest.relation, guest.memo].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-medium text-gold-700">
              {formatAmount(guest.amount)}원
            </span>
            <span className="text-xs text-gold-400">
              {formatDateTime(guest.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

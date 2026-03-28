'use client'

import { useState, useRef, useCallback } from 'react'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 60 * 1000 // 1 minute

export default function PinInput({ weddingId, onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(null)
  const inputRef = useRef(null)

  const isLocked = lockedUntil && Date.now() < lockedUntil

  const handleChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, '')
    if (value.length <= 4) {
      setPin(value)
      setError('')
    }
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()

      if (isLocked) {
        const remaining = Math.ceil((lockedUntil - Date.now()) / 1000)
        setError(`너무 많은 시도입니다. ${remaining}초 후 다시 시도해주세요.`)
        return
      }

      if (pin.length !== 4) {
        setError('4자리 PIN을 입력해주세요.')
        return
      }

      setLoading(true)
      setError('')

      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weddingId, pin }),
        })

        const data = await res.json()

        if (data.success) {
          setAttempts(0)
          setLockedUntil(null)
          onSuccess(data)
        } else {
          const newAttempts = attempts + 1
          setAttempts(newAttempts)
          setPin('')

          if (newAttempts >= MAX_ATTEMPTS) {
            const lockUntil = Date.now() + LOCKOUT_DURATION_MS
            setLockedUntil(lockUntil)
            setError('5회 실패했습니다. 1분 후 다시 시도해주세요.')
            setAttempts(0)
          } else {
            setError(
              data.error ||
                `PIN이 일치하지 않습니다. (${newAttempts}/${MAX_ATTEMPTS})`
            )
          }

          inputRef.current?.focus()
        }
      } catch {
        setError('서버 연결에 실패했습니다. 다시 시도해주세요.')
      } finally {
        setLoading(false)
      }
    },
    [pin, weddingId, onSuccess, attempts, isLocked, lockedUntil]
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-xl font-display text-gold-700 mb-2">
          PIN 입력
        </h2>
        <p className="text-sm text-gold-500">
          공유받은 4자리 PIN을 입력해주세요
        </p>
      </div>

      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={handleChange}
        disabled={loading || isLocked}
        placeholder="••••"
        autoFocus
        className="w-48 h-14 text-center text-2xl tracking-[0.5em] font-mono
          border-2 border-gold-200 rounded-xl bg-white
          focus:border-gold-600 focus:ring-2 focus:ring-gold-100
          disabled:opacity-50 disabled:cursor-not-allowed
          outline-none transition-all placeholder:text-gold-200"
      />

      {error && (
        <p className="text-sm text-red-500 text-center max-w-xs" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pin.length !== 4 || loading || isLocked}
        className="w-48 h-12 rounded-xl font-medium text-white
          bg-gold-600 hover:bg-gold-700 active:bg-gold-800
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors"
      >
        {loading ? '확인 중...' : '입장하기'}
      </button>
    </form>
  )
}

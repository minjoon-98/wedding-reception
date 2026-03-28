'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { QUICK_AMOUNTS } from '@/lib/constants'
import { formatAmountShort } from '@/lib/format'

const SIDE_MAP = {
  groom: '신랑측',
  bride: '신부측',
}

export default function RecordForm({ weddingId, side, allGuests, onSubmitSuccess }) {
  const [recorderName, setRecorderName] = useState('')
  const [recorderInput, setRecorderInput] = useState('')
  const [isSetup, setIsSetup] = useState(false)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [relation, setRelation] = useState('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(false)

  const nameRef = useRef(null)
  const storageKey = `recorder_${weddingId}`

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      setRecorderName(saved)
      setIsSetup(true)
    }
  }, [storageKey])

  const handleRecorderSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const trimmed = recorderInput.trim()
      if (!trimmed) return
      localStorage.setItem(storageKey, trimmed)
      setRecorderName(trimmed)
      setIsSetup(true)
    },
    [recorderInput, storageKey]
  )

  const handleNameChange = useCallback(
    (e) => {
      const value = e.target.value
      setName(value)
      const trimmed = value.trim()
      if (trimmed && allGuests.some((g) => g.name === trimmed)) {
        setDuplicateWarning(true)
      } else {
        setDuplicateWarning(false)
      }
    },
    [allGuests]
  )

  const handleAmountChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, '')
    setAmount(value)
  }, [])

  const handleQuickAmount = useCallback((quickAmount) => {
    setAmount(String(quickAmount))
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const trimmedName = name.trim()
      if (!trimmedName) return

      setLoading(true)
      try {
        const guestSide = SIDE_MAP[side] || '미분류'
        const { error } = await supabase.from('guests').insert({
          wedding_id: weddingId,
          name: trimmedName,
          amount: amount ? parseInt(amount, 10) : 0,
          side: guestSide,
          relation: relation.trim() || null,
          memo: memo.trim() || null,
          recorded_by: recorderName,
        })

        if (error) {
          setToast({ type: 'error', message: '저장에 실패했습니다.' })
        } else {
          setToast({ type: 'success', message: `${trimmedName}님 접수 완료!` })
          setName('')
          setAmount('')
          setRelation('')
          setMemo('')
          setShowExtra(false)
          setDuplicateWarning(false)
          onSubmitSuccess?.()
          nameRef.current?.focus()
        }
      } catch {
        setToast({ type: 'error', message: '네트워크 오류가 발생했습니다.' })
      } finally {
        setLoading(false)
      }
    },
    [name, amount, relation, memo, side, weddingId, recorderName, onSubmitSuccess]
  )

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  if (!isSetup) {
    return (
      <form onSubmit={handleRecorderSubmit} className="space-y-4 p-4">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-display text-gold-700">접수자 이름 설정</h2>
          <p className="text-sm text-gold-500">
            누가 접수하는지 기록하기 위해 이름을 입력해주세요
          </p>
        </div>
        <input
          type="text"
          value={recorderInput}
          onChange={(e) => setRecorderInput(e.target.value)}
          placeholder="접수자 이름"
          autoFocus
          className="w-full h-12 px-4 border-2 border-gold-200 rounded-xl bg-white
            focus:border-gold-600 focus:ring-2 focus:ring-gold-100
            outline-none transition-all text-center"
        />
        <button
          type="submit"
          disabled={!recorderInput.trim()}
          className="w-full h-12 rounded-xl font-medium text-white
            bg-gold-600 hover:bg-gold-700 active:bg-gold-800
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          시작하기
        </button>
      </form>
    )
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg
            text-white text-sm font-medium animate-bounce
            ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Name */}
        <div>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="이름"
            autoFocus
            className="w-full h-12 px-4 border-2 border-gold-200 rounded-xl bg-white
              focus:border-gold-600 focus:ring-2 focus:ring-gold-100
              outline-none transition-all"
          />
          {duplicateWarning && (
            <p className="text-xs text-orange-500 mt-1 px-1">
              ⚠ 동일한 이름이 이미 접수되어 있습니다
            </p>
          )}
        </div>

        {/* Amount */}
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={handleAmountChange}
          placeholder="금액 (원)"
          className="w-full h-12 px-4 border-2 border-gold-200 rounded-xl bg-white
            focus:border-gold-600 focus:ring-2 focus:ring-gold-100
            outline-none transition-all"
        />

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((qa) => (
            <button
              key={qa}
              type="button"
              onClick={() => handleQuickAmount(qa)}
              className={`h-10 rounded-lg text-sm font-medium transition-colors
                ${String(qa) === amount
                  ? 'bg-gold-600 text-white'
                  : 'bg-gold-50 text-gold-700 hover:bg-gold-100 border border-gold-200'
                }`}
            >
              {formatAmountShort(qa)}
            </button>
          ))}
        </div>

        {/* Extra fields toggle */}
        <button
          type="button"
          onClick={() => setShowExtra((prev) => !prev)}
          className="text-sm text-gold-500 hover:text-gold-700 transition-colors"
        >
          {showExtra ? '▲ 추가 정보 접기' : '▼ 추가 정보 (관계, 메모)'}
        </button>

        {showExtra && (
          <div className="space-y-3">
            <input
              type="text"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="관계 (예: 대학동기, 직장동료)"
              className="w-full h-10 px-4 border-2 border-gold-200 rounded-xl bg-white
                focus:border-gold-600 focus:ring-2 focus:ring-gold-100
                outline-none transition-all text-sm"
            />
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모 (예: 인상착의)"
              className="w-full h-10 px-4 border-2 border-gold-200 rounded-xl bg-white
                focus:border-gold-600 focus:ring-2 focus:ring-gold-100
                outline-none transition-all text-sm"
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="w-full h-12 rounded-xl font-medium text-white
            bg-gold-600 hover:bg-gold-700 active:bg-gold-800
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '저장 중...' : '접수하기'}
        </button>
      </form>
    </div>
  )
}

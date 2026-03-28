'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfirmPage() {
  const router = useRouter()
  const [showParents, setShowParents] = useState(false)
  const [form, setForm] = useState({
    groomName: '',
    brideName: '',
    weddingDate: '',
    weddingTime: '',
    venueName: '',
    venueDetail: '',
    venueAddress: '',
    groomFather: '',
    groomMother: '',
    brideFather: '',
    brideMother: '',
    invitationUrl: '',
  })

  useEffect(() => {
    const raw = sessionStorage.getItem('wedding_draft')
    if (!raw) {
      router.replace('/create')
      return
    }

    try {
      const draft = JSON.parse(raw)

      // weddingDate가 ISO 형식("2026-04-19T14:00:00")이면 date/time 분리
      let dateStr = draft.weddingDate || ''
      let timeStr = draft.weddingTime || ''
      if (dateStr.includes('T')) {
        const dt = new Date(dateStr)
        if (!isNaN(dt.getTime())) {
          dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
          timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
        }
      }

      setForm((prev) => ({
        ...prev,
        groomName: draft.groomName || '',
        brideName: draft.brideName || '',
        weddingDate: dateStr,
        weddingTime: timeStr,
        venueName: draft.venueName || '',
        venueDetail: draft.venueDetail || '',
        venueAddress: draft.venueAddress || '',
        groomFather: draft.groomFather || '',
        groomMother: draft.groomMother || '',
        brideFather: draft.brideFather || '',
        brideMother: draft.brideMother || '',
        invitationUrl: draft.invitationUrl || '',
      }))

      const hasParentInfo =
        draft.groomFather || draft.groomMother || draft.brideFather || draft.brideMother
      if (hasParentInfo) {
        setShowParents(true)
      }
    } catch {
      router.replace('/create')
    }
  }, [router])

  function handleChange(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    // date + time을 ISO 형식으로 합쳐서 저장
    let weddingDate = null
    if (form.weddingDate) {
      weddingDate = form.weddingTime
        ? `${form.weddingDate}T${form.weddingTime}:00`
        : `${form.weddingDate}T12:00:00`
    }
    sessionStorage.setItem('wedding_confirmed', JSON.stringify({
      ...form,
      weddingDate,
    }))
    router.push('/create/pin')
  }

  const isValid = form.groomName.trim() && form.brideName.trim()

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-gold-700">
            결혼식 정보 확인
          </h1>
          <p className="mt-2 text-gold-500">
            정보를 확인하고 수정해주세요
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-gold-200 bg-parchment p-6 shadow-sm"
        >
          {/* Groom & Bride Names */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="신랑 이름 *"
              value={form.groomName}
              onChange={handleChange('groomName')}
              placeholder="홍길동"
            />
            <FormField
              label="신부 이름 *"
              value={form.brideName}
              onChange={handleChange('brideName')}
              placeholder="김영희"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="결혼식 날짜"
              type="date"
              value={form.weddingDate}
              onChange={handleChange('weddingDate')}
            />
            <FormField
              label="결혼식 시간"
              type="time"
              value={form.weddingTime}
              onChange={handleChange('weddingTime')}
            />
          </div>

          {/* Venue */}
          <FormField
            label="예식장 이름"
            value={form.venueName}
            onChange={handleChange('venueName')}
            placeholder="○○웨딩홀"
          />
          <FormField
            label="예식장 상세"
            value={form.venueDetail}
            onChange={handleChange('venueDetail')}
            placeholder="본관 3층 그랜드홀"
          />
          <FormField
            label="예식장 주소"
            value={form.venueAddress}
            onChange={handleChange('venueAddress')}
            placeholder="서울시 강남구..."
          />

          {/* Parents - collapsible */}
          <div className="border-t border-gold-200 pt-4">
            <button
              type="button"
              onClick={() => setShowParents((prev) => !prev)}
              className="flex w-full items-center justify-between text-sm font-medium text-gold-600"
            >
              <span>부모님 성함</span>
              <svg
                className={`h-4 w-4 transition-transform ${showParents ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showParents && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="신랑 아버지"
                    value={form.groomFather}
                    onChange={handleChange('groomFather')}
                  />
                  <FormField
                    label="신랑 어머니"
                    value={form.groomMother}
                    onChange={handleChange('groomMother')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="신부 아버지"
                    value={form.brideFather}
                    onChange={handleChange('brideFather')}
                  />
                  <FormField
                    label="신부 어머니"
                    value={form.brideMother}
                    onChange={handleChange('brideMother')}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="w-full rounded-lg bg-gold-600 py-3 font-semibold text-white shadow-md transition-colors hover:bg-gold-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음: PIN 설정
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => router.back()}
            className="text-sm text-gold-400 transition-colors hover:text-gold-600"
          >
            이전으로 돌아가기
          </button>
        </div>
      </div>
    </main>
  )
}

function FormField({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gold-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-gold-200 bg-ivory px-3 py-2 text-gold-800 placeholder-gold-300 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-200"
      />
    </div>
  )
}

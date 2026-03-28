'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const PIN_CONFIGS = [
  {
    key: 'pinGroom',
    label: '신랑측 PIN',
    color: 'groom-600',
    bgColor: 'bg-groom-50',
    borderColor: 'border-groom-200',
    focusRing: 'focus:ring-groom-200 focus:border-groom-400',
  },
  {
    key: 'pinBride',
    label: '신부측 PIN',
    color: 'bride-600',
    bgColor: 'bg-bride-50',
    borderColor: 'border-bride-200',
    focusRing: 'focus:ring-bride-200 focus:border-bride-400',
  },
  {
    key: 'pinMaster',
    label: '관리자 PIN',
    color: 'gold-700',
    bgColor: 'bg-gold-50',
    borderColor: 'border-gold-200',
    focusRing: 'focus:ring-gold-200 focus:border-gold-400',
  },
]

export default function PinPage() {
  const router = useRouter()
  const [pins, setPins] = useState({ pinGroom: '', pinBride: '', pinMaster: '' })
  const [error, setError] = useState('')
  const [duplicateId, setDuplicateId] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('wedding_confirmed')
    if (!raw) {
      router.replace('/create')
    }
  }, [router])

  function handlePinChange(key) {
    return (e) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 4)
      setPins((prev) => ({ ...prev, [key]: value }))
      setError('')
    }
  }

  function validate() {
    const { pinGroom, pinBride, pinMaster } = pins
    if (pinGroom.length !== 4 || pinBride.length !== 4 || pinMaster.length !== 4) {
      return 'PIN은 모두 4자리 숫자여야 합니다.'
    }
    if (pinGroom === pinBride || pinGroom === pinMaster || pinBride === pinMaster) {
      return '세 개의 PIN은 모두 달라야 합니다.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const confirmed = JSON.parse(sessionStorage.getItem('wedding_confirmed') || '{}')

      const payload = {
        groomName: confirmed.groomName,
        brideName: confirmed.brideName,
        weddingDate: confirmed.weddingDate || null,
        venueName: confirmed.venueName || null,
        venueDetail: confirmed.venueDetail || null,
        venueAddress: confirmed.venueAddress || null,
        groomFather: confirmed.groomFather || null,
        groomMother: confirmed.groomMother || null,
        brideFather: confirmed.brideFather || null,
        brideMother: confirmed.brideMother || null,
        invitationUrl: confirmed.invitationUrl || null,
        pinGroom: pins.pinGroom,
        pinBride: pins.pinBride,
        pinMaster: pins.pinMaster,
      }

      const res = await fetch('/api/wedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()

      if (result.success) {
        sessionStorage.setItem(
          'wedding_created',
          JSON.stringify({
            id: result.id,
            groomName: confirmed.groomName,
            brideName: confirmed.brideName,
            pinGroom: pins.pinGroom,
            pinBride: pins.pinBride,
            pinMaster: pins.pinMaster,
          }),
        )
        sessionStorage.removeItem('wedding_draft')
        sessionStorage.removeItem('wedding_confirmed')
        router.push('/create/done')
      } else if (result.duplicate) {
        setError(result.error)
        setDuplicateId(result.existingId)
      } else {
        setError(result.error || '결혼식 생성에 실패했습니다.')
      }
    } catch {
      setError('서버와 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-gold-700">
            PIN 설정
          </h1>
          <p className="mt-2 text-gold-500">
            접수자별 4자리 PIN을 설정해주세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {PIN_CONFIGS.map((config) => (
            <div
              key={config.key}
              className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4`}
            >
              <label
                htmlFor={config.key}
                className={`block text-sm font-semibold text-${config.color}`}
              >
                {config.label}
              </label>
              <input
                id={config.key}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pins[config.key]}
                onChange={handlePinChange(config.key)}
                placeholder="0000"
                disabled={loading}
                className={`mt-2 w-full rounded-lg border ${config.borderColor} bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] text-gold-800 outline-none ${config.focusRing} disabled:opacity-50`}
              />
            </div>
          ))}

          {error && (
            <div className="text-center space-y-2">
              <p className="text-sm text-bride-600">{error}</p>
              {duplicateId && (
                <a
                  href={`/w/${duplicateId}`}
                  className="inline-block text-sm text-groom-600 underline hover:text-groom-400"
                >
                  기존 결혼식으로 입장하기
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gold-600 py-3 font-semibold text-white shadow-md transition-colors hover:bg-gold-700 disabled:opacity-50"
          >
            {loading ? '생성 중...' : '결혼식 생성하기'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => router.back()}
            disabled={loading}
            className="text-sm text-gold-400 transition-colors hover:text-gold-600 disabled:opacity-50"
          >
            이전으로 돌아가기
          </button>
        </div>
      </div>
    </main>
  )
}

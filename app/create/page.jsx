'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreatePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [extractMethod, setExtractMethod] = useState('auto') // 'auto' | 'regex' | 'ai'

  async function handleCrawl() {
    if (!url.trim()) {
      setError('URL을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), method: extractMethod }),
      })

      const result = await res.json()

      if (result.success) {
        sessionStorage.setItem(
          'wedding_draft',
          JSON.stringify({ ...result.data, invitationUrl: url.trim() }),
        )
        router.push('/create/confirm')
      } else if (result.fallbackToManual) {
        setError('자동 추출에 실패했습니다. 직접 입력해주세요.')
      } else {
        setError(result.error || '알 수 없는 오류가 발생했습니다.')
      }
    } catch {
      setError('서버와 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleManualEntry() {
    sessionStorage.setItem('wedding_draft', JSON.stringify({}))
    router.push('/create/confirm')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-gold-700">
            새 결혼식 만들기
          </h1>
          <p className="mt-2 text-gold-500">
            모바일 청첩장 URL을 입력하면 정보를 자동으로 가져옵니다
          </p>
        </div>

        <div className="rounded-xl border border-gold-200 bg-parchment p-6 shadow-sm">
          <label
            htmlFor="invitation-url"
            className="block text-sm font-medium text-gold-700"
          >
            청첩장 URL
          </label>
          <input
            id="invitation-url"
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError('')
            }}
            disabled={loading}
            className="mt-2 w-full rounded-lg border border-gold-200 bg-ivory px-4 py-3 text-gold-800 placeholder-gold-300 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-200 disabled:opacity-50"
          />

          {/* 추출 방법 선택 */}
          <div className="mt-4">
            <p className="mb-2 text-xs text-gold-500">추출 방법</p>
            <div className="flex gap-2">
              {[
                { value: 'auto', label: '자동 (정규식→AI)' },
                { value: 'regex', label: '정규식만' },
                { value: 'ai', label: 'AI 분석' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExtractMethod(value)}
                  disabled={loading}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    extractMethod === value
                      ? 'border-gold-600 bg-gold-600 text-white'
                      : 'border-gold-200 bg-ivory text-gold-600 hover:border-gold-400'
                  } disabled:opacity-50`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="mt-2 text-sm text-bride-600">{error}</p>
          )}

          <button
            onClick={handleCrawl}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-gold-600 py-3 font-semibold text-white shadow-md transition-colors hover:bg-gold-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                가져오는 중...
              </span>
            ) : (
              '자동으로 가져오기'
            )}
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={handleManualEntry}
            disabled={loading}
            className="text-gold-500 underline underline-offset-4 transition-colors hover:text-gold-700 disabled:opacity-50"
          >
            직접 입력하기
          </button>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gold-400 transition-colors hover:text-gold-600"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  )
}

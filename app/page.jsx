'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function formatDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function WeddingCard({ wedding, onSelect }) {
  return (
    <button
      onClick={() => onSelect(wedding)}
      className="w-full text-left p-4 rounded-xl border border-gold-200 bg-white hover:border-gold-400 hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-bold text-gold-700">
            {wedding.groomName} ♥ {wedding.brideName}
          </p>
          <p className="text-sm text-gold-500 mt-1">
            {formatDate(wedding.weddingDate)}
            {wedding.venueName ? ` · ${wedding.venueName}` : ''}
          </p>
        </div>
        <svg className="w-5 h-5 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

function WeddingPreview({ wedding, onConfirm, onCancel }) {
  return (
    <div className="space-y-4">
      <div className="p-6 rounded-xl border-2 border-gold-300 bg-white text-center space-y-3">
        <p className="font-display text-2xl font-bold text-gold-700">
          {wedding.groomName} ♥ {wedding.brideName}
        </p>
        <p className="text-gold-500">
          {formatDate(wedding.weddingDate)}
        </p>
        {wedding.venueName && (
          <p className="text-sm text-gold-400">{wedding.venueName}</p>
        )}
        {wedding.invitationUrl && (
          <a
            href={wedding.invitationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-groom-600 underline hover:text-groom-400 transition"
          >
            모바일 청첩장 보기
          </a>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-lg border-2 border-gold-200 text-gold-600 font-medium hover:bg-gold-50 transition"
        >
          다른 결혼식
        </button>
        <button
          onClick={() => onConfirm(wedding)}
          className="flex-1 py-3 rounded-lg bg-gold-600 text-white font-medium hover:bg-gold-700 transition"
        >
          입장하기
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState('code') // 'code' | 'search'
  const [input, setInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [preview, setPreview] = useState(null) // 미리보기 결혼식
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 코드/링크로 조회
  async function handleCodeSubmit(e) {
    e.preventDefault()
    const code = input.trim()
    if (!code) return

    setLoading(true)
    setError('')
    setPreview(null)

    // URL이면 ID 추출
    let id = code
    const urlMatch = code.match(/\/w\/([^/?]+)/)
    if (urlMatch) {
      id = urlMatch[1]
    } else if (code.includes('/')) {
      // 전체 URL에서 마지막 path segment
      const segments = code.split('/').filter(Boolean)
      id = segments[segments.length - 1]
    }

    try {
      const res = await fetch(`/api/wedding?id=${id}`)
      if (res.ok) {
        const data = await res.json()
        setPreview({ ...data, id })
      } else {
        setError('결혼식을 찾을 수 없습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 이름/장소 검색
  async function handleSearch(e) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q.length < 2) {
      setError('2자 이상 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setSearchResults([])

    try {
      const res = await fetch(`/api/wedding?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.success && data.results.length > 0) {
        setSearchResults(data.results)
      } else {
        setError('검색 결과가 없습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectWedding(wedding) {
    setPreview(wedding)
    setSearchResults([])
  }

  function handleConfirm(wedding) {
    router.push(`/w/${wedding.id}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* 타이틀 */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-gold-700 sm:text-5xl">
            축의금 접수
          </h1>
          <p className="mt-2 text-gold-500 text-lg">
            결혼식 축의금을 간편하게 접수하고 관리하세요
          </p>
        </div>

        {/* 새 결혼식 만들기 */}
        <Link
          href="/create"
          className="block w-full text-center rounded-lg bg-gold-600 px-8 py-3 text-lg font-semibold text-white shadow-md transition-colors hover:bg-gold-700"
        >
          새 결혼식 만들기
        </Link>

        {/* 구분선 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gold-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-ivory px-4 text-sm text-gold-400">기존 결혼식 입장</span>
          </div>
        </div>

        {/* 미리보기 (선택된 결혼식) */}
        {preview ? (
          <div>
            <p className="text-sm text-gold-600 font-medium mb-3 text-center">이 결혼식이 맞나요?</p>
            <WeddingPreview
              wedding={preview}
              onConfirm={handleConfirm}
              onCancel={() => { setPreview(null); setError('') }}
            />
          </div>
        ) : (
          <>
            {/* 탭 전환 */}
            <div className="flex rounded-lg border border-gold-200 overflow-hidden">
              <button
                onClick={() => { setMode('code'); setError(''); setSearchResults([]) }}
                className={`flex-1 py-2.5 text-sm font-medium transition ${
                  mode === 'code' ? 'bg-gold-600 text-white' : 'bg-white text-gold-600 hover:bg-gold-50'
                }`}
              >
                코드 / 링크
              </button>
              <button
                onClick={() => { setMode('search'); setError(''); setPreview(null) }}
                className={`flex-1 py-2.5 text-sm font-medium transition ${
                  mode === 'search' ? 'bg-gold-600 text-white' : 'bg-white text-gold-600 hover:bg-gold-50'
                }`}
              >
                이름으로 검색
              </button>
            </div>

            {/* 코드/링크 입력 */}
            {mode === 'code' && (
              <form onSubmit={handleCodeSubmit} className="space-y-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError('') }}
                  placeholder="결혼식 코드 또는 링크 붙여넣기"
                  className="w-full px-4 py-3 border-2 border-gold-200 rounded-lg bg-parchment text-gold-800 placeholder-gold-300 focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none"
                />
                {error && <p className="text-sm text-bride-600">{error}</p>}
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="w-full rounded-lg border-2 border-gold-600 py-3 font-semibold text-gold-600 transition-colors hover:bg-gold-600 hover:text-white disabled:opacity-40"
                >
                  {loading ? '찾는 중...' : '찾기'}
                </button>
              </form>
            )}

            {/* 이름 검색 */}
            {mode === 'search' && (
              <div className="space-y-3">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setError('') }}
                    placeholder="신랑/신부 이름 또는 예식장"
                    className="flex-1 px-4 py-3 border-2 border-gold-200 rounded-lg bg-parchment text-gold-800 placeholder-gold-300 focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={searchQuery.trim().length < 2 || loading}
                    className="px-5 py-3 rounded-lg bg-gold-600 text-white font-medium hover:bg-gold-700 disabled:opacity-40 transition"
                  >
                    {loading ? '...' : '검색'}
                  </button>
                </form>

                {error && <p className="text-sm text-bride-600">{error}</p>}

                {/* 검색 결과 */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gold-500">{searchResults.length}건 검색됨</p>
                    {searchResults.map((w) => (
                      <WeddingCard key={w.id} wedding={w} onSelect={handleSelectWedding} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DonePage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const raw = sessionStorage.getItem('wedding_created')
    if (!raw) {
      router.replace('/create')
      return
    }

    try {
      setData(JSON.parse(raw))
    } catch {
      router.replace('/create')
    }
  }, [router])

  async function copyToClipboard(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    }
  }

  if (!data) {
    return null
  }

  const weddingLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/w/${data.id}`

  const cards = [
    {
      key: 'groom',
      label: '신랑측',
      pin: data.pinGroom,
      bgClass: 'bg-groom-50',
      borderClass: 'border-groom-200',
      textClass: 'text-groom-600',
      showCopy: true,
    },
    {
      key: 'bride',
      label: '신부측',
      pin: data.pinBride,
      bgClass: 'bg-bride-50',
      borderClass: 'border-bride-200',
      textClass: 'text-bride-600',
      showCopy: true,
    },
    {
      key: 'master',
      label: '관리자',
      pin: data.pinMaster,
      bgClass: 'bg-gold-50',
      borderClass: 'border-gold-200',
      textClass: 'text-gold-700',
      showCopy: false,
    },
  ]

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🎉</div>
          <h1 className="font-display text-3xl font-bold text-gold-700">
            결혼식이 생성되었습니다!
          </h1>
          <p className="text-xl text-gold-600">
            {data.groomName} ♥ {data.brideName}
          </p>
        </div>

        {/* Link display */}
        <div className="rounded-xl border border-gold-200 bg-parchment p-4">
          <p className="text-sm font-medium text-gold-600 mb-2">접수 링크</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-ivory px-3 py-2 text-sm text-gold-800">
              {weddingLink}
            </code>
            <button
              onClick={() => copyToClipboard(weddingLink, 'link')}
              className="shrink-0 rounded-lg bg-gold-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gold-700"
            >
              {copied === 'link' ? '복사됨!' : '복사'}
            </button>
          </div>
        </div>

        {/* PIN cards */}
        <div className="space-y-3">
          {cards.map((card) => (
            <div
              key={card.key}
              className={`rounded-xl border ${card.borderClass} ${card.bgClass} p-4`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold ${card.textClass}`}>
                    {card.label}
                  </p>
                  <p className="mt-1 font-mono text-2xl tracking-[0.3em] text-gold-800">
                    {card.pin}
                  </p>
                </div>
                {card.showCopy ? (
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `${weddingLink}\nPIN: ${card.pin}`,
                        card.key,
                      )
                    }
                    className={`rounded-lg border ${card.borderClass} bg-white px-3 py-2 text-sm font-medium ${card.textClass} transition-colors hover:bg-opacity-80`}
                  >
                    {copied === card.key ? '복사됨!' : '링크+PIN 복사'}
                  </button>
                ) : (
                  <span className="text-xs text-gold-400">본인만 보관</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Home link */}
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

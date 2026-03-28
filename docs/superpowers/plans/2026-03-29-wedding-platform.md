# Wedding Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 결혼식 축의금 앱을 멀티 결혼식 플랫폼으로 확장. 모바일 청첩장 크롤링, 측별 PIN 인증, Next.js 마이그레이션.

**Architecture:** Next.js App Router + Supabase. 결혼식 생성 시 Firecrawl → 정규식 → Groq 폴백 파이프라인으로 청첩장 정보 추출. PIN 기반 측별 접근 제어 (JWT 쿠키). 기존 React 컴포넌트를 Next.js 클라이언트 컴포넌트로 이관.

**Tech Stack:** Next.js 15 (App Router, JSX), Supabase, Tailwind CSS 3, Firecrawl, Groq (Llama 3.3 70B), nanoid, bcryptjs, jose (JWT)

**Spec:** `docs/superpowers/specs/2026-03-29-wedding-platform-design.md`

---

## File Structure

```
wedding-reception-next/          # 새 Next.js 프로젝트 (기존 프로젝트와 별도)
├── app/
│   ├── layout.jsx               # 루트 레이아웃 (폰트, 메타)
│   ├── page.jsx                 # 홈 (생성 or 접속)
│   ├── create/
│   │   ├── page.jsx             # 청첩장 URL 입력
│   │   ├── confirm/page.jsx     # 추출 정보 확인/수정
│   │   ├── pin/page.jsx         # PIN 설정
│   │   └── done/page.jsx        # 생성 완료 + 링크 공유
│   ├── w/[id]/
│   │   ├── page.jsx             # PIN 입력 화면
│   │   ├── record/page.jsx      # 접수 화면 (기존 App.jsx 이관)
│   │   └── admin/page.jsx       # 관리자 화면 (기존 AdminView.jsx 이관)
│   └── api/
│       ├── crawl/route.js        # 청첩장 크롤링 API
│       ├── wedding/route.js      # 결혼식 생성 API
│       └── auth/route.js         # PIN 검증 + JWT 발급 API
├── lib/
│   ├── supabase-server.js       # 서버사이드 Supabase 클라이언트
│   ├── supabase-browser.js      # 브라우저 Supabase 클라이언트
│   ├── format.js                # 기존 포맷 유틸 이관
│   ├── crawl/
│   │   ├── firecrawl.js         # Firecrawl 클라이언트
│   │   ├── regex-extractor.js   # 정규식 패턴 추출기
│   │   └── groq-extractor.js    # Groq AI 추출기
│   ├── auth.js                  # PIN 해싱, JWT 발급/검증
│   └── constants.js             # 공통 상수 (SIDE_OPTIONS 등)
├── components/
│   ├── RecordForm.jsx           # 접수 폼 (기존 App.jsx에서 추출)
│   ├── AdminPanel.jsx           # 관리자 패널 (기존 AdminView.jsx에서 추출)
│   ├── GuestList.jsx            # 최근 접수 목록
│   ├── StatsCards.jsx           # 통계 카드
│   └── PinInput.jsx             # PIN 입력 컴포넌트
├── middleware.js                 # PIN 인증 미들웨어 (쿠키 검증)
├── tailwind.config.js           # 기존 테마 이관
├── next.config.mjs              # Next.js 설정
├── .env.local                   # 환경변수
└── package.json
```

---

## Task 1: Next.js 프로젝트 초기화

**Files:**
- Create: `next.config.mjs`, `package.json`, `tailwind.config.js`, `app/layout.jsx`, `app/page.jsx`, `.env.local`, `.gitignore`

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
cd /Users/minjoon/minjoon
npx create-next-app@latest wedding-reception-next --js --app --tailwind --eslint --no-src-dir --no-turbopack --import-alias "@/*"
```

- [ ] **Step 2: 추가 의존성 설치**

```bash
cd /Users/minjoon/minjoon/wedding-reception-next
npm install @supabase/supabase-js nanoid bcryptjs jose groq-sdk @mendable/firecrawl-js
```

- [ ] **Step 3: Tailwind 테마 이관**

`tailwind.config.js`의 `theme.extend`를 기존 프로젝트에서 복사:

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard"', 'system-ui', 'sans-serif'],
        display: ['"Noto Serif KR"', 'serif'],
      },
      colors: {
        ivory: '#FFFEF9',
        parchment: '#FAF8F2',
        gold: {
          50: '#FAF3E0',
          100: '#F0EBE0',
          200: '#E5DFD1',
          300: '#D4C5A0',
          400: '#B8A88A',
          500: '#A09680',
          600: '#8B6914',
          700: '#5C4A1E',
          800: '#3D3520',
        },
        groom: {
          50: '#F0F4FA',
          100: '#E8F0FE',
          200: '#D6E0F0',
          400: '#6B85AA',
          600: '#2B5EA7',
        },
        bride: {
          50: '#FAF0F0',
          100: '#FDE8E8',
          200: '#F0D6D6',
          400: '#AA6B6B',
          600: '#A72B2B',
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: 루트 레이아웃 설정**

```jsx
// app/layout.jsx
import './globals.css'

export const metadata = {
  title: '축의금 접수 시스템',
  description: '결혼식 축의금을 실시간으로 접수하고 관리하세요',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ivory min-h-screen font-sans text-gold-800">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: 환경변수 설정**

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=<기존 .env에서 복사>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<기존 .env에서 복사>
FIRECRAWL_API_KEY=<Firecrawl 무료 플랜 키>
GROQ_API_KEY=<Groq 무료 API 키>
JWT_SECRET=<openssl rand -hex 32 로 생성>
```

- [ ] **Step 6: 홈 페이지 플레이스홀더**

```jsx
// app/page.jsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="font-display text-3xl text-gold-700 mb-2">축의금 접수</h1>
      <p className="text-gold-500 mb-8">결혼식 축의금을 실시간으로 관리하세요</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/create"
          className="bg-gold-600 text-white text-center py-3 rounded-lg font-medium hover:bg-gold-700 transition"
        >
          새 결혼식 만들기
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 개발 서버 실행 확인**

```bash
cd /Users/minjoon/minjoon/wedding-reception-next
npm run dev
```

Expected: `http://localhost:3000`에서 홈 페이지 렌더링 확인

- [ ] **Step 8: 커밋**

```bash
git init
git add -A
git commit -m "feat: Next.js 프로젝트 초기화 + Tailwind 테마 이관"
```

---

## Task 2: Supabase 클라이언트 + DB 스키마 확장

**Files:**
- Create: `lib/supabase-server.js`, `lib/supabase-browser.js`, `lib/format.js`, `lib/constants.js`

- [ ] **Step 1: 서버사이드 Supabase 클라이언트**

```javascript
// lib/supabase-server.js
import { createClient } from '@supabase/supabase-js'

export function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  }

  return createClient(url, key)
}
```

- [ ] **Step 2: 브라우저 Supabase 클라이언트**

```javascript
// lib/supabase-browser.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url, key)
```

- [ ] **Step 3: 포맷 유틸 이관**

```javascript
// lib/format.js
// 기존 src/lib/format.js 내용 그대로 복사
export function formatDateTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isToday) {
    return `오늘 ${timeStr}`
  }

  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return `${dateStr} ${timeStr}`
}

export function formatAmount(num) {
  if (!num) return '0'
  return num.toLocaleString()
}

export function formatAmountShort(num) {
  if (num >= 10000) {
    const man = num / 10000
    return `${man}만`
  }
  return formatAmount(num)
}
```

- [ ] **Step 4: 공통 상수**

```javascript
// lib/constants.js
export const SIDE_OPTIONS = ['미분류', '신랑측', '신부측', '신랑 부모님', '신부 부모님', '기타']

export const QUICK_AMOUNTS = [30000, 50000, 70000, 100000, 150000, 200000, 300000, 500000]

export function getSideBadgeStyle(side) {
  if (side === '신랑측' || side === '신랑 부모님') {
    return 'bg-groom-100 text-groom-600 border-groom-200'
  }
  if (side === '신부측' || side === '신부 부모님') {
    return 'bg-bride-100 text-bride-600 border-bride-200'
  }
  return 'bg-gold-100 text-gold-500 border-gold-200'
}
```

- [ ] **Step 5: Supabase에서 weddings 테이블 생성**

Supabase Dashboard SQL Editor에서 실행:

```sql
-- weddings 테이블 생성
CREATE TABLE weddings (
  id TEXT PRIMARY KEY,
  groom_name TEXT NOT NULL,
  bride_name TEXT NOT NULL,
  wedding_date TIMESTAMPTZ,
  venue_name TEXT DEFAULT '',
  venue_detail TEXT DEFAULT '',
  venue_address TEXT DEFAULT '',
  venue_lat FLOAT,
  venue_lng FLOAT,
  groom_father TEXT DEFAULT '',
  groom_mother TEXT DEFAULT '',
  bride_father TEXT DEFAULT '',
  bride_mother TEXT DEFAULT '',
  invitation_url TEXT DEFAULT '',
  pin_groom TEXT NOT NULL,
  pin_bride TEXT NOT NULL,
  pin_master TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- guests 테이블에 wedding_id 추가
ALTER TABLE guests ADD COLUMN IF NOT EXISTS wedding_id TEXT REFERENCES weddings(id);

-- RLS 정책
ALTER TABLE weddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weddings_insert" ON weddings FOR INSERT WITH CHECK (true);
CREATE POLICY "weddings_select" ON weddings FOR SELECT USING (true);
CREATE POLICY "weddings_update" ON weddings FOR UPDATE USING (true);

-- guests RLS 업데이트 (기존 정책 유지 + wedding_id 기반)
-- 기존 정책이 이미 permissive이므로 추가 변경 불필요
```

- [ ] **Step 6: 커밋**

```bash
git add lib/
git commit -m "feat: Supabase 클라이언트 + 유틸 + DB 스키마"
```

---

## Task 3: PIN 인증 시스템

**Files:**
- Create: `lib/auth.js`, `app/api/auth/route.js`, `middleware.js`, `components/PinInput.jsx`

- [ ] **Step 1: 인증 유틸 (해싱 + JWT)**

```javascript
// lib/auth.js
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me')
const SALT_ROUNDS = 10

export async function hashPin(pin) {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

export async function verifyPin(pin, hash) {
  return bcrypt.compare(pin, hash)
}

export async function createToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(JWT_SECRET_KEY)
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY)
    return payload
  } catch {
    return null
  }
}
```

- [ ] **Step 2: PIN 검증 API**

```javascript
// app/api/auth/route.js
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { verifyPin, createToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request) {
  const { weddingId, pin } = await request.json()

  if (!weddingId || !pin) {
    return NextResponse.json({ success: false, error: 'weddingId와 pin은 필수입니다' }, { status: 400 })
  }

  const supabase = createSupabaseServer()
  const { data: wedding, error } = await supabase
    .from('weddings')
    .select('pin_groom, pin_bride, pin_master, groom_name, bride_name')
    .eq('id', weddingId)
    .single()

  if (error || !wedding) {
    return NextResponse.json({ success: false, error: '결혼식을 찾을 수 없습니다' }, { status: 404 })
  }

  // PIN 매칭 확인 (마스터 → 신랑 → 신부 순서)
  let role = null
  let side = null

  if (await verifyPin(pin, wedding.pin_master)) {
    role = 'admin'
    side = 'all'
  } else if (await verifyPin(pin, wedding.pin_groom)) {
    role = 'recorder'
    side = 'groom'
  } else if (await verifyPin(pin, wedding.pin_bride)) {
    role = 'recorder'
    side = 'bride'
  }

  if (!role) {
    return NextResponse.json({ success: false, error: 'PIN이 일치하지 않습니다' }, { status: 401 })
  }

  const token = await createToken({ weddingId, role, side })

  const cookieStore = await cookies()
  cookieStore.set(`wedding_${weddingId}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24시간
    path: '/',
  })

  return NextResponse.json({
    success: true,
    role,
    side,
    groomName: wedding.groom_name,
    brideName: wedding.bride_name,
  })
}
```

- [ ] **Step 3: 미들웨어 (보호된 라우트 검증)**

```javascript
// middleware.js
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me')

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // /w/[id]/record 또는 /w/[id]/admin 패턴 매칭
  const match = pathname.match(/^\/w\/([^/]+)\/(record|admin)$/)
  if (!match) return NextResponse.next()

  const weddingId = match[1]
  const page = match[2]
  const token = request.cookies.get(`wedding_${weddingId}`)?.value

  if (!token) {
    return NextResponse.redirect(new URL(`/w/${weddingId}`, request.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY)

    if (payload.weddingId !== weddingId) {
      return NextResponse.redirect(new URL(`/w/${weddingId}`, request.url))
    }

    if (page === 'admin' && payload.role !== 'admin') {
      return NextResponse.redirect(new URL(`/w/${weddingId}`, request.url))
    }

    // 헤더에 인증 정보 추가 (서버 컴포넌트에서 읽기용)
    const headers = new Headers(request.headers)
    headers.set('x-wedding-role', payload.role)
    headers.set('x-wedding-side', payload.side)
    headers.set('x-wedding-id', weddingId)

    return NextResponse.next({ headers })
  } catch {
    return NextResponse.redirect(new URL(`/w/${weddingId}`, request.url))
  }
}

export const config = {
  matcher: '/w/:id/(record|admin)',
}
```

- [ ] **Step 4: PIN 입력 컴포넌트**

```jsx
// components/PinInput.jsx
'use client'

import { useState } from 'react'

export default function PinInput({ weddingId, onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (locked || !pin.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId, pin: pin.trim() }),
      })

      const data = await res.json()

      if (data.success) {
        onSuccess(data)
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)

        if (newAttempts >= 5) {
          setLocked(true)
          setError('5회 실패. 1분 후 다시 시도해주세요.')
          setTimeout(() => {
            setLocked(false)
            setAttempts(0)
          }, 60000)
        } else {
          setError(data.error || 'PIN이 일치하지 않습니다')
        }
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
      setPin('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        placeholder="PIN 4자리"
        disabled={locked}
        className="w-40 text-center text-2xl tracking-[0.5em] py-3 border-2 border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none disabled:opacity-50"
        autoFocus
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || locked || pin.length < 4}
        className="bg-gold-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-gold-700 transition disabled:opacity-50"
      >
        {loading ? '확인 중...' : '입장'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: 커밋**

```bash
git add lib/auth.js app/api/auth/ middleware.js components/PinInput.jsx
git commit -m "feat: PIN 인증 시스템 (해싱, JWT, 미들웨어)"
```

---

## Task 4: 청첩장 크롤링 파이프라인

**Files:**
- Create: `lib/crawl/firecrawl.js`, `lib/crawl/regex-extractor.js`, `lib/crawl/groq-extractor.js`, `app/api/crawl/route.js`

- [ ] **Step 1: Firecrawl 클라이언트**

```javascript
// lib/crawl/firecrawl.js
import FirecrawlApp from '@mendable/firecrawl-js'

export async function scrapeToMarkdown(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    return { success: false, error: 'FIRECRAWL_API_KEY가 설정되지 않았습니다' }
  }

  try {
    const app = new FirecrawlApp({ apiKey })
    const result = await app.scrapeUrl(url, { formats: ['markdown'] })

    if (!result.success) {
      return { success: false, error: '크롤링에 실패했습니다' }
    }

    return { success: true, markdown: result.markdown }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
```

- [ ] **Step 2: 정규식 추출기**

```javascript
// lib/crawl/regex-extractor.js

/**
 * 한국 모바일 청첩장 마크다운에서 정규식으로 결혼식 정보 추출
 * 청첩장은 형식이 정형화되어 있어 정규식으로 90% 커버 가능
 */
export function extractWithRegex(markdown) {
  if (!markdown) return { success: false }

  const result = {
    groomName: null,
    brideName: null,
    weddingDate: null,
    venueName: null,
    venueDetail: null,
    venueAddress: null,
  }

  let matched = 0

  // 신랑 ♥ 신부 패턴 (가장 흔한 형식)
  // "김용준 ♥ 장문희", "김용준 ❤️ 장문희", "김용준 ❤ 장문희"
  const namePattern = /([가-힣]{2,4})\s*[♥❤️💕♡&]\s*([가-힣]{2,4})/
  const nameMatch = markdown.match(namePattern)
  if (nameMatch) {
    result.groomName = nameMatch[1]
    result.brideName = nameMatch[2]
    matched += 2
  }

  // 날짜 패턴: "2026년 4월 19일" 또는 "2026. 4. 19"
  const datePattern1 = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/
  const datePattern2 = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/
  const dateMatch = markdown.match(datePattern1) || markdown.match(datePattern2)

  // 시간 패턴: "오후 2시", "오전 11시 30분", "14:00"
  const timePattern1 = /(오전|오후)\s*(\d{1,2})시\s*(\d{1,2})?분?/
  const timePattern2 = /(\d{1,2}):(\d{2})/

  if (dateMatch) {
    const year = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2]) - 1
    const day = parseInt(dateMatch[3])

    let hour = 12
    let minute = 0

    const timeMatch = markdown.match(timePattern1)
    if (timeMatch) {
      hour = parseInt(timeMatch[2])
      if (timeMatch[1] === '오후' && hour < 12) hour += 12
      if (timeMatch[1] === '오전' && hour === 12) hour = 0
      minute = timeMatch[3] ? parseInt(timeMatch[3]) : 0
    } else {
      const timeMatch2 = markdown.match(timePattern2)
      if (timeMatch2) {
        hour = parseInt(timeMatch2[1])
        minute = parseInt(timeMatch2[2])
      }
    }

    result.weddingDate = new Date(year, month, day, hour, minute).toISOString()
    matched++
  }

  // 장소 패턴: 흔한 웨딩홀 키워드 근처 텍스트
  const venueKeywords = /(?:더\s*)?([가-힣A-Za-z\s]+(?:웨딩홀|컨벤션|호텔|예식장|웨딩|홀|가든|하우스|팰리스|아트홀|센터))/
  const venueMatch = markdown.match(venueKeywords)
  if (venueMatch) {
    result.venueName = venueMatch[0].trim()
    matched++
  }

  // 주소 패턴: "서울 OO구" 등
  const addressPattern = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*[가-힣]+(?:시|구|군)\s*[가-힣0-9\s-]+/
  const addressMatch = markdown.match(addressPattern)
  if (addressMatch) {
    result.venueAddress = addressMatch[0].trim()
    matched++
  }

  // 층/홀 패턴: "1층 그랜드볼룸홀", "3F 다이아몬드홀"
  const detailPattern = /(\d+층\s*[가-힣A-Za-z]+(?:홀|룸)?|\d+F\s*[가-힣A-Za-z]+)/
  const detailMatch = markdown.match(detailPattern)
  if (detailMatch) {
    result.venueDetail = detailMatch[0].trim()
    matched++
  }

  // 최소 이름 2개 + 날짜가 매칭되어야 성공
  const confidence = matched / 6
  return {
    success: confidence >= 0.5,
    confidence,
    data: result,
  }
}
```

- [ ] **Step 3: Groq AI 추출기**

```javascript
// lib/crawl/groq-extractor.js
import Groq from 'groq-sdk'

export async function extractWithGroq(markdown) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { success: false, error: 'GROQ_API_KEY가 설정되지 않았습니다' }
  }

  const groq = new Groq({ apiKey })

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `너는 한국 결혼식 모바일 청첩장에서 정보를 추출하는 도우미야.
주어진 마크다운 텍스트에서 결혼식 정보를 JSON으로 추출해.
반드시 아래 형식의 JSON만 반환해. 다른 텍스트는 포함하지 마.
찾을 수 없는 필드는 null로 설정해.

{
  "groomName": "신랑 풀네임 (성+이름)",
  "brideName": "신부 풀네임 (성+이름)",
  "weddingDate": "ISO 8601 형식 (예: 2026-04-19T14:00:00)",
  "venueName": "예식장 이름",
  "venueDetail": "층/홀 정보",
  "venueAddress": "주소",
  "groomFather": "신랑 부친 이름",
  "groomMother": "신랑 모친 이름",
  "brideFather": "신부 부친 이름",
  "brideMother": "신부 모친 이름"
}`
        },
        {
          role: 'user',
          content: markdown.substring(0, 4000), // 토큰 절약
        },
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'AI 응답이 비어있습니다' }

    const parsed = JSON.parse(content)
    return { success: true, data: parsed }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
```

- [ ] **Step 4: 크롤링 API Route**

```javascript
// app/api/crawl/route.js
import { NextResponse } from 'next/server'
import { scrapeToMarkdown } from '@/lib/crawl/firecrawl'
import { extractWithRegex } from '@/lib/crawl/regex-extractor'
import { extractWithGroq } from '@/lib/crawl/groq-extractor'

export async function POST(request) {
  const { url } = await request.json()

  if (!url) {
    return NextResponse.json({ success: false, error: 'URL은 필수입니다' }, { status: 400 })
  }

  // Step 1: Firecrawl로 마크다운 변환
  const scrapeResult = await scrapeToMarkdown(url)
  if (!scrapeResult.success) {
    return NextResponse.json({
      success: false,
      error: scrapeResult.error,
      fallbackToManual: true,
    })
  }

  const { markdown } = scrapeResult

  // Step 2: 정규식 추출 시도
  const regexResult = extractWithRegex(markdown)
  if (regexResult.success && regexResult.confidence >= 0.5) {
    return NextResponse.json({
      success: true,
      method: 'regex',
      confidence: regexResult.confidence,
      data: regexResult.data,
    })
  }

  // Step 3: Groq AI 추출 폴백
  const groqResult = await extractWithGroq(markdown)
  if (groqResult.success) {
    return NextResponse.json({
      success: true,
      method: 'ai',
      data: groqResult.data,
    })
  }

  // Step 4: 모두 실패 → 수동 입력
  return NextResponse.json({
    success: false,
    error: '자동 추출에 실패했습니다. 직접 입력해주세요.',
    fallbackToManual: true,
  })
}
```

- [ ] **Step 5: 커밋**

```bash
git add lib/crawl/ app/api/crawl/
git commit -m "feat: 청첩장 크롤링 파이프라인 (Firecrawl + 정규식 + Groq)"
```

---

## Task 5: 결혼식 생성 플로우 (UI)

**Files:**
- Create: `app/create/page.jsx`, `app/create/confirm/page.jsx`, `app/create/pin/page.jsx`, `app/create/done/page.jsx`, `app/api/wedding/route.js`

- [ ] **Step 1: 결혼식 생성 API**

```javascript
// app/api/wedding/route.js
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createSupabaseServer } from '@/lib/supabase-server'
import { hashPin } from '@/lib/auth'

export async function POST(request) {
  const body = await request.json()
  const { groomName, brideName, weddingDate, venueName, venueDetail, venueAddress,
          groomFather, groomMother, brideFather, brideMother,
          invitationUrl, pinGroom, pinBride, pinMaster } = body

  if (!groomName || !brideName || !pinGroom || !pinBride || !pinMaster) {
    return NextResponse.json({ success: false, error: '필수 항목이 누락되었습니다' }, { status: 400 })
  }

  if (pinGroom.length !== 4 || pinBride.length !== 4 || pinMaster.length !== 4) {
    return NextResponse.json({ success: false, error: 'PIN은 4자리여야 합니다' }, { status: 400 })
  }

  if (pinGroom === pinBride || pinGroom === pinMaster || pinBride === pinMaster) {
    return NextResponse.json({ success: false, error: '각 PIN은 서로 달라야 합니다' }, { status: 400 })
  }

  const id = nanoid(8)
  const supabase = createSupabaseServer()

  const { error } = await supabase.from('weddings').insert({
    id,
    groom_name: groomName,
    bride_name: brideName,
    wedding_date: weddingDate || null,
    venue_name: venueName || '',
    venue_detail: venueDetail || '',
    venue_address: venueAddress || '',
    groom_father: groomFather || '',
    groom_mother: groomMother || '',
    bride_father: brideFather || '',
    bride_mother: brideMother || '',
    invitation_url: invitationUrl || '',
    pin_groom: await hashPin(pinGroom),
    pin_bride: await hashPin(pinBride),
    pin_master: await hashPin(pinMaster),
  })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id })
}
```

- [ ] **Step 2: 청첩장 URL 입력 페이지**

```jsx
// app/create/page.jsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreatePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCrawl(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()

      if (data.success) {
        // 추출 성공 → confirm 페이지로
        sessionStorage.setItem('wedding_draft', JSON.stringify({
          ...data.data,
          invitationUrl: url,
          method: data.method,
        }))
        router.push('/create/confirm')
      } else if (data.fallbackToManual) {
        // 추출 실패 → 빈 폼으로 confirm 페이지
        sessionStorage.setItem('wedding_draft', JSON.stringify({ invitationUrl: url }))
        router.push('/create/confirm')
      } else {
        setError(data.error || '알 수 없는 오류')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function handleManual() {
    sessionStorage.setItem('wedding_draft', JSON.stringify({}))
    router.push('/create/confirm')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="font-display text-2xl text-gold-700 mb-2">새 결혼식 만들기</h1>
      <p className="text-gold-500 mb-8 text-center">
        모바일 청첩장 링크를 입력하면<br />결혼식 정보를 자동으로 가져옵니다
      </p>

      <form onSubmit={handleCrawl} className="w-full max-w-md flex flex-col gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://makedear.com/mcard/view/..."
          className="w-full px-4 py-3 border-2 border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none"
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-gold-600 text-white py-3 rounded-lg font-medium hover:bg-gold-700 transition disabled:opacity-50"
        >
          {loading ? '정보 가져오는 중...' : '자동으로 가져오기'}
        </button>
      </form>

      <button
        onClick={handleManual}
        className="mt-4 text-gold-500 underline text-sm hover:text-gold-700"
      >
        직접 입력하기
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 정보 확인/수정 페이지**

```jsx
// app/create/confirm/page.jsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfirmPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    groomName: '', brideName: '', weddingDate: '', weddingTime: '',
    venueName: '', venueDetail: '', venueAddress: '',
    groomFather: '', groomMother: '', brideFather: '', brideMother: '',
    invitationUrl: '',
  })

  useEffect(() => {
    const draft = sessionStorage.getItem('wedding_draft')
    if (!draft) {
      router.push('/create')
      return
    }

    const data = JSON.parse(draft)

    // weddingDate가 ISO string이면 날짜/시간 분리
    let dateStr = ''
    let timeStr = ''
    if (data.weddingDate) {
      const d = new Date(data.weddingDate)
      dateStr = d.toISOString().split('T')[0]
      timeStr = d.toTimeString().slice(0, 5)
    }

    setForm({
      groomName: data.groomName || '',
      brideName: data.brideName || '',
      weddingDate: dateStr,
      weddingTime: timeStr,
      venueName: data.venueName || '',
      venueDetail: data.venueDetail || '',
      venueAddress: data.venueAddress || '',
      groomFather: data.groomFather || '',
      groomMother: data.groomMother || '',
      brideFather: data.brideFather || '',
      brideMother: data.brideMother || '',
      invitationUrl: data.invitationUrl || '',
    })
  }, [router])

  function handleChange(field) {
    return (e) => setForm({ ...form, [field]: e.target.value })
  }

  function handleNext(e) {
    e.preventDefault()
    if (!form.groomName.trim() || !form.brideName.trim()) return

    // 날짜+시간 합치기
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

  const inputClass = "w-full px-3 py-2.5 border border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none"
  const labelClass = "text-sm font-medium text-gold-600 mb-1"

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <h1 className="font-display text-2xl text-gold-700 mb-1 mt-8">결혼식 정보 확인</h1>
      <p className="text-gold-500 mb-6 text-sm">자동으로 가져온 정보를 확인하고 수정해주세요</p>

      <form onSubmit={handleNext} className="w-full max-w-md flex flex-col gap-4">
        {/* 신랑/신부 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className={labelClass}>신랑 이름 *</label>
            <input value={form.groomName} onChange={handleChange('groomName')} className={inputClass} required />
          </div>
          <div className="flex flex-col">
            <label className={labelClass}>신부 이름 *</label>
            <input value={form.brideName} onChange={handleChange('brideName')} className={inputClass} required />
          </div>
        </div>

        {/* 날짜/시간 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className={labelClass}>결혼식 날짜</label>
            <input type="date" value={form.weddingDate} onChange={handleChange('weddingDate')} className={inputClass} />
          </div>
          <div className="flex flex-col">
            <label className={labelClass}>시간</label>
            <input type="time" value={form.weddingTime} onChange={handleChange('weddingTime')} className={inputClass} />
          </div>
        </div>

        {/* 장소 */}
        <div className="flex flex-col">
          <label className={labelClass}>예식장</label>
          <input value={form.venueName} onChange={handleChange('venueName')} placeholder="예: 더컨벤션 영등포" className={inputClass} />
        </div>
        <div className="flex flex-col">
          <label className={labelClass}>층/홀</label>
          <input value={form.venueDetail} onChange={handleChange('venueDetail')} placeholder="예: 1층 그랜드볼룸홀" className={inputClass} />
        </div>
        <div className="flex flex-col">
          <label className={labelClass}>주소</label>
          <input value={form.venueAddress} onChange={handleChange('venueAddress')} placeholder="예: 서울 영등포구..." className={inputClass} />
        </div>

        {/* 부모님 (접히는 섹션) */}
        <details className="border border-gold-200 rounded-lg p-3">
          <summary className="text-sm text-gold-500 cursor-pointer">부모님 성함 (선택)</summary>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="flex flex-col">
              <label className={labelClass}>신랑 부친</label>
              <input value={form.groomFather} onChange={handleChange('groomFather')} className={inputClass} />
            </div>
            <div className="flex flex-col">
              <label className={labelClass}>신랑 모친</label>
              <input value={form.groomMother} onChange={handleChange('groomMother')} className={inputClass} />
            </div>
            <div className="flex flex-col">
              <label className={labelClass}>신부 부친</label>
              <input value={form.brideFather} onChange={handleChange('brideFather')} className={inputClass} />
            </div>
            <div className="flex flex-col">
              <label className={labelClass}>신부 모친</label>
              <input value={form.brideMother} onChange={handleChange('brideMother')} className={inputClass} />
            </div>
          </div>
        </details>

        <button
          type="submit"
          className="bg-gold-600 text-white py-3 rounded-lg font-medium hover:bg-gold-700 transition mt-2"
        >
          다음: PIN 설정
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: PIN 설정 페이지**

```jsx
// app/create/pin/page.jsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PinSetupPage() {
  const router = useRouter()
  const [pins, setPins] = useState({ groom: '', bride: '', master: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionStorage.getItem('wedding_confirmed')) {
      router.push('/create')
    }
  }, [router])

  function handleChange(field) {
    return (e) => setPins({ ...pins, [field]: e.target.value.replace(/\D/g, '').slice(0, 4) })
  }

  const allValid = pins.groom.length === 4 && pins.bride.length === 4 && pins.master.length === 4
  const allDifferent = new Set([pins.groom, pins.bride, pins.master]).size === 3

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allValid || !allDifferent) return

    setLoading(true)
    setError('')

    try {
      const confirmed = JSON.parse(sessionStorage.getItem('wedding_confirmed'))

      const res = await fetch('/api/wedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groomName: confirmed.groomName,
          brideName: confirmed.brideName,
          weddingDate: confirmed.weddingDate,
          venueName: confirmed.venueName,
          venueDetail: confirmed.venueDetail,
          venueAddress: confirmed.venueAddress,
          groomFather: confirmed.groomFather,
          groomMother: confirmed.groomMother,
          brideFather: confirmed.brideFather,
          brideMother: confirmed.brideMother,
          invitationUrl: confirmed.invitationUrl,
          pinGroom: pins.groom,
          pinBride: pins.bride,
          pinMaster: pins.master,
        }),
      })

      const data = await res.json()

      if (data.success) {
        sessionStorage.setItem('wedding_created', JSON.stringify({
          id: data.id,
          groomName: confirmed.groomName,
          brideName: confirmed.brideName,
          pinGroom: pins.groom,
          pinBride: pins.bride,
          pinMaster: pins.master,
        }))
        sessionStorage.removeItem('wedding_draft')
        sessionStorage.removeItem('wedding_confirmed')
        router.push('/create/done')
      } else {
        setError(data.error || '생성에 실패했습니다')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const pinInputClass = "w-full text-center text-xl tracking-[0.3em] py-3 border-2 border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none"

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <h1 className="font-display text-2xl text-gold-700 mb-1 mt-8">PIN 설정</h1>
      <p className="text-gold-500 mb-6 text-sm text-center">
        각 측 접수자와 관리자를 위한<br />서로 다른 4자리 PIN을 설정해주세요
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-groom-600">신랑측 PIN</label>
          <input type="password" inputMode="numeric" maxLength={4} value={pins.groom} onChange={handleChange('groom')} className={pinInputClass} placeholder="••••" />
          <p className="text-xs text-gold-400">신랑측 접수자에게 공유</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-bride-600">신부측 PIN</label>
          <input type="password" inputMode="numeric" maxLength={4} value={pins.bride} onChange={handleChange('bride')} className={pinInputClass} placeholder="••••" />
          <p className="text-xs text-gold-400">신부측 접수자에게 공유</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gold-700">관리자 PIN</label>
          <input type="password" inputMode="numeric" maxLength={4} value={pins.master} onChange={handleChange('master')} className={pinInputClass} placeholder="••••" />
          <p className="text-xs text-gold-400">양측 통합 관리용 (본인만 보관)</p>
        </div>

        {!allDifferent && allValid && (
          <p className="text-red-500 text-sm">각 PIN은 서로 달라야 합니다</p>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !allValid || !allDifferent}
          className="bg-gold-600 text-white py-3 rounded-lg font-medium hover:bg-gold-700 transition disabled:opacity-50 mt-2"
        >
          {loading ? '생성 중...' : '결혼식 생성'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: 생성 완료 + 링크 공유 페이지**

```jsx
// app/create/done/page.jsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DonePage() {
  const router = useRouter()
  const [wedding, setWedding] = useState(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const data = sessionStorage.getItem('wedding_created')
    if (!data) {
      router.push('/create')
      return
    }
    setWedding(JSON.parse(data))
  }, [router])

  if (!wedding) return null

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const link = `${baseUrl}/w/${wedding.id}`

  async function copyToClipboard(text, label) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <div className="mt-12 text-center mb-8">
        <div className="text-4xl mb-3">🎉</div>
        <h1 className="font-display text-2xl text-gold-700 mb-1">결혼식이 생성되었습니다!</h1>
        <p className="text-gold-500">{wedding.groomName} ♥ {wedding.brideName}</p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">
        {/* 접수 링크 */}
        <div className="bg-white border border-gold-200 rounded-lg p-4">
          <h2 className="font-medium text-gold-700 mb-2">접수 링크</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-parchment px-3 py-2 rounded break-all">{link}</code>
            <button
              onClick={() => copyToClipboard(link, 'link')}
              className="px-3 py-2 bg-gold-600 text-white rounded text-sm hover:bg-gold-700 transition shrink-0"
            >
              {copied === 'link' ? '복사됨!' : '복사'}
            </button>
          </div>
        </div>

        {/* 신랑측 PIN */}
        <div className="bg-groom-50 border border-groom-200 rounded-lg p-4">
          <h2 className="font-medium text-groom-600 mb-1">신랑측</h2>
          <p className="text-sm text-gold-500 mb-2">접수자에게 링크와 함께 공유하세요</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg tracking-widest">{wedding.pinGroom}</span>
            <button
              onClick={() => copyToClipboard(`${link}\nPIN: ${wedding.pinGroom}`, 'groom')}
              className="px-3 py-1.5 bg-groom-600 text-white rounded text-sm hover:opacity-90 transition"
            >
              {copied === 'groom' ? '복사됨!' : '링크+PIN 복사'}
            </button>
          </div>
        </div>

        {/* 신부측 PIN */}
        <div className="bg-bride-50 border border-bride-200 rounded-lg p-4">
          <h2 className="font-medium text-bride-600 mb-1">신부측</h2>
          <p className="text-sm text-gold-500 mb-2">접수자에게 링크와 함께 공유하세요</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg tracking-widest">{wedding.pinBride}</span>
            <button
              onClick={() => copyToClipboard(`${link}\nPIN: ${wedding.pinBride}`, 'bride')}
              className="px-3 py-1.5 bg-bride-600 text-white rounded text-sm hover:opacity-90 transition"
            >
              {copied === 'bride' ? '복사됨!' : '링크+PIN 복사'}
            </button>
          </div>
        </div>

        {/* 관리자 PIN */}
        <div className="bg-gold-50 border border-gold-200 rounded-lg p-4">
          <h2 className="font-medium text-gold-700 mb-1">관리자</h2>
          <p className="text-sm text-gold-500">양측 통합 관리용 — 본인만 보관하세요</p>
          <span className="font-mono text-lg tracking-widest">{wedding.pinMaster}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 커밋**

```bash
git add app/create/ app/api/wedding/
git commit -m "feat: 결혼식 생성 플로우 (URL 입력 → 확인 → PIN → 완료)"
```

---

## Task 6: PIN 입력 + 라우팅 진입점

**Files:**
- Create: `app/w/[id]/page.jsx`

- [ ] **Step 1: PIN 입력 페이지**

```jsx
// app/w/[id]/page.jsx
'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import PinInput from '@/components/PinInput'

export default function WeddingEntryPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [weddingName, setWeddingName] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function fetchWedding() {
      const res = await fetch(`/api/wedding?id=${id}`)
      if (res.ok) {
        const data = await res.json()
        setWeddingName(`${data.groomName} ♥ ${data.brideName}`)
      } else {
        setNotFound(true)
      }
    }
    fetchWedding()
  }, [id])

  function handleSuccess(data) {
    if (data.role === 'admin') {
      router.push(`/w/${id}/admin`)
    } else {
      router.push(`/w/${id}/record`)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-gold-500 text-lg">결혼식을 찾을 수 없습니다</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {weddingName && (
        <h1 className="font-display text-2xl text-gold-700 mb-6">{weddingName}</h1>
      )}
      <p className="text-gold-500 mb-6">PIN을 입력해주세요</p>
      <PinInput weddingId={id} onSuccess={handleSuccess} />
    </div>
  )
}
```

- [ ] **Step 2: 결혼식 정보 조회 API (GET) 추가**

```javascript
// app/api/wedding/route.js 에 GET 핸들러 추가 (기존 POST 아래)
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createSupabaseServer } from '@/lib/supabase-server'
import { hashPin } from '@/lib/auth'

// ... 기존 POST 핸들러 유지 ...

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id는 필수입니다' }, { status: 400 })
  }

  const supabase = createSupabaseServer()
  const { data, error } = await supabase
    .from('weddings')
    .select('groom_name, bride_name, wedding_date, venue_name')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '결혼식을 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json({
    groomName: data.groom_name,
    brideName: data.bride_name,
    weddingDate: data.wedding_date,
    venueName: data.venue_name,
  })
}
```

- [ ] **Step 3: 커밋**

```bash
git add app/w/ app/api/wedding/
git commit -m "feat: PIN 입력 화면 + 결혼식 진입점"
```

---

## Task 7: 접수 화면 이관

**Files:**
- Create: `app/w/[id]/record/page.jsx`, `components/RecordForm.jsx`, `components/GuestList.jsx`

- [ ] **Step 1: 접수 폼 컴포넌트**

기존 `App.jsx`의 로직을 `RecordForm.jsx`로 추출. `weddingId`와 `side` props를 받아 해당 결혼식/측에 맞는 접수 처리.

```jsx
// components/RecordForm.jsx
'use client'

import { useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { formatAmount } from '@/lib/format'
import { QUICK_AMOUNTS, SIDE_OPTIONS, getSideBadgeStyle } from '@/lib/constants'

export default function RecordForm({ weddingId, side, allGuests, onSubmitSuccess }) {
  const [recorder, setRecorder] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(`recorder_${weddingId}`) || '' : ''
  )
  const [recorderInput, setRecorderInput] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [guestSide, setGuestSide] = useState(side === 'groom' ? '신랑측' : side === 'bride' ? '신부측' : '미분류')
  const [relation, setRelation] = useState('')
  const [memo, setMemo] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const nameInputRef = useRef(null)

  function saveRecorder(val) {
    const trimmed = val.trim()
    if (!trimmed) return
    localStorage.setItem(`recorder_${weddingId}`, trimmed)
    setRecorder(trimmed)
  }

  const duplicateWarning = useMemo(() => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const matches = allGuests.filter(g => g.name === trimmed)
    if (matches.length === 0) return null
    return `"${trimmed}" 이름으로 이미 ${matches.length}건 접수되어 있습니다`
  }, [name, allGuests])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || isSubmitting) return

    setIsSubmitting(true)

    const { error } = await supabase.from('guests').insert({
      name: trimmedName,
      amount: parseInt(amount) || 0,
      side: guestSide,
      relation: relation.trim(),
      memo: memo.trim(),
      recorded_by: recorder,
      wedding_id: weddingId,
    })

    setIsSubmitting(false)

    if (!error) {
      setName('')
      setAmount('')
      setRelation('')
      setMemo('')
      setShowExtra(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1500)
      nameInputRef.current?.focus()
      onSubmitSuccess?.()
    }
  }

  // 접수자 설정 화면
  if (!recorder) {
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <h2 className="font-display text-xl text-gold-700">접수자 이름</h2>
        <p className="text-gold-500 text-sm">접수 기록에 표시될 이름을 입력해주세요</p>
        <input
          value={recorderInput}
          onChange={(e) => setRecorderInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveRecorder(recorderInput)}
          placeholder="예: 김민준"
          className="px-4 py-2.5 border-2 border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none w-48 text-center"
          autoFocus
        />
        <button
          onClick={() => saveRecorder(recorderInput)}
          className="bg-gold-600 text-white px-6 py-2 rounded-lg"
        >
          시작
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      {/* 성공 토스트 */}
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-2 rounded-lg shadow-lg z-50 animate-bounce">
          ✓ 접수 완료
        </div>
      )}

      {/* 이름 */}
      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="이름"
        className="px-4 py-3 border-2 border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none text-lg"
        autoFocus
      />
      {duplicateWarning && (
        <p className="text-amber-600 text-sm -mt-1">{duplicateWarning}</p>
      )}

      {/* 금액 */}
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        placeholder="금액"
        className="px-4 py-3 border-2 border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none text-lg"
      />
      {amount && <p className="text-gold-500 text-sm -mt-1">{formatAmount(parseInt(amount))}원</p>}

      {/* 빠른 금액 버튼 */}
      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map(q => (
          <button
            key={q}
            type="button"
            onClick={() => setAmount(String(q))}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              parseInt(amount) === q
                ? 'bg-gold-600 text-white border-gold-600'
                : 'bg-white text-gold-600 border-gold-200 hover:border-gold-400'
            }`}
          >
            {q >= 10000 ? `${q / 10000}만` : formatAmount(q)}
          </button>
        ))}
      </div>

      {/* 추가 정보 토글 */}
      <button
        type="button"
        onClick={() => setShowExtra(!showExtra)}
        className="text-gold-500 text-sm underline self-start"
      >
        {showExtra ? '추가 정보 접기' : '추가 정보 (관계, 메모)'}
      </button>

      {showExtra && (
        <div className="flex flex-col gap-2">
          <input
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            placeholder="관계 (예: 대학동기)"
            className="px-3 py-2 border border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none"
          />
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (예: 인상착의)"
            className="px-3 py-2 border border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none"
          />
        </div>
      )}

      {/* 제출 */}
      <button
        type="submit"
        disabled={!name.trim() || isSubmitting}
        className="bg-gold-600 text-white py-3 rounded-lg font-medium hover:bg-gold-700 transition disabled:opacity-50 mt-1"
      >
        {isSubmitting ? '접수 중...' : '접수'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: 최근 접수 목록 컴포넌트**

```jsx
// components/GuestList.jsx
'use client'

import { formatAmount, formatDateTime } from '@/lib/format'
import { getSideBadgeStyle } from '@/lib/constants'

export default function GuestList({ guests }) {
  if (guests.length === 0) {
    return <p className="text-gold-400 text-center py-8">아직 접수된 내역이 없습니다</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {guests.map((g) => (
        <div key={g.id} className="flex items-center justify-between bg-white border border-gold-100 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-medium">{g.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${getSideBadgeStyle(g.side)}`}>
              {g.side}
            </span>
          </div>
          <div className="text-right">
            <span className="font-medium">{formatAmount(g.amount)}원</span>
            <p className="text-xs text-gold-400">{formatDateTime(g.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 접수 화면 페이지**

```jsx
// app/w/[id]/record/page.jsx
'use client'

import { useState, useEffect, useMemo, use } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { formatAmount } from '@/lib/format'
import RecordForm from '@/components/RecordForm'
import GuestList from '@/components/GuestList'

export default function RecordPage({ params }) {
  const { id } = use(params)
  const [allGuests, setAllGuests] = useState([])
  const [side, setSide] = useState(null)
  const [weddingName, setWeddingName] = useState('')

  // 인증 정보 확인 + 초기 데이터 로드
  useEffect(() => {
    async function init() {
      // 결혼식 정보 + 인증 상태
      const res = await fetch(`/api/wedding?id=${id}`)
      if (res.ok) {
        const data = await res.json()
        setWeddingName(`${data.groomName} ♥ ${data.brideName}`)
      }

      // side 정보는 쿠키의 JWT에서 → API로 확인
      const authRes = await fetch('/api/auth/me', {
        headers: { 'x-wedding-id': id },
      })
      if (authRes.ok) {
        const authData = await authRes.json()
        setSide(authData.side)
      }

      // 게스트 목록 로드
      const { data: guests } = await supabase
        .from('guests')
        .select('*')
        .eq('wedding_id', id)
        .order('created_at', { ascending: false })

      if (guests) setAllGuests(guests)
    }
    init()

    // Realtime 구독
    const channel = supabase
      .channel(`guests_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guests', filter: `wedding_id=eq.${id}` },
        (payload) => setAllGuests(prev => prev.some(g => g.id === payload.new.id) ? prev : [payload.new, ...prev])
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guests', filter: `wedding_id=eq.${id}` },
        (payload) => setAllGuests(prev => prev.map(g => g.id === payload.new.id ? payload.new : g))
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guests', filter: `wedding_id=eq.${id}` },
        (payload) => setAllGuests(prev => prev.filter(g => g.id !== payload.old.id))
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  // 측별 필터링
  const filteredGuests = useMemo(() => {
    if (!side || side === 'all') return allGuests
    const sideLabel = side === 'groom' ? '신랑측' : '신부측'
    const parentLabel = side === 'groom' ? '신랑 부모님' : '신부 부모님'
    return allGuests.filter(g => g.side === sideLabel || g.side === parentLabel || g.side === '미분류')
  }, [allGuests, side])

  const stats = useMemo(() => ({
    count: filteredGuests.length,
    total: filteredGuests.reduce((sum, g) => sum + (g.amount || 0), 0),
  }), [filteredGuests])

  const sideLabel = side === 'groom' ? '신랑측' : side === 'bride' ? '신부측' : ''

  return (
    <div className="min-h-screen bg-ivory">
      {/* 헤더 */}
      <header className="bg-white border-b border-gold-100 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg text-gold-700">{weddingName}</h1>
          {sideLabel && <span className={`text-xs px-2 py-0.5 rounded-full border ${getSideBadgeStyle(sideLabel)}`}>{sideLabel}</span>}
        </div>
        <div className="text-right">
          <p className="text-sm text-gold-500">{stats.count}건</p>
          <p className="font-medium text-gold-700">{formatAmount(stats.total)}원</p>
        </div>
      </header>

      {/* 접수 폼 */}
      <div className="max-w-lg mx-auto">
        <RecordForm weddingId={id} side={side} allGuests={filteredGuests} />

        {/* 최근 접수 */}
        <div className="px-4 pb-8">
          <h2 className="text-sm font-medium text-gold-500 mb-2">최근 접수</h2>
          <GuestList guests={filteredGuests.slice(0, 10)} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 인증 정보 확인 API 추가**

```javascript
// app/api/auth/me/route.js
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  const weddingId = request.headers.get('x-wedding-id')
  if (!weddingId) {
    return NextResponse.json({ error: 'wedding ID 필요' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(`wedding_${weddingId}`)?.value

  if (!token) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload || payload.weddingId !== weddingId) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 401 })
  }

  return NextResponse.json({ role: payload.role, side: payload.side })
}
```

- [ ] **Step 5: 커밋**

```bash
git add components/RecordForm.jsx components/GuestList.jsx app/w/ app/api/auth/me/
git commit -m "feat: 접수 화면 이관 (RecordForm + GuestList + Realtime)"
```

---

## Task 8: 관리자 화면 이관

**Files:**
- Create: `app/w/[id]/admin/page.jsx`, `components/AdminPanel.jsx`, `components/StatsCards.jsx`

- [ ] **Step 1: 통계 카드 컴포넌트**

```jsx
// components/StatsCards.jsx
'use client'

import { formatAmount } from '@/lib/format'

export default function StatsCards({ guests }) {
  const sides = ['전체', '신랑측', '신부측', '신랑 부모님', '신부 부모님', '기타', '미분류']

  const stats = sides.map(s => {
    const filtered = s === '전체' ? guests : guests.filter(g => g.side === s)
    return {
      label: s,
      count: filtered.length,
      total: filtered.reduce((sum, g) => sum + (g.amount || 0), 0),
    }
  }).filter(s => s.label === '전체' || s.count > 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stats.map(s => (
        <div key={s.label} className="bg-white border border-gold-100 rounded-lg p-3">
          <p className="text-xs text-gold-500">{s.label}</p>
          <p className="font-medium text-gold-700">{formatAmount(s.total)}원</p>
          <p className="text-xs text-gold-400">{s.count}건</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 관리자 패널 컴포넌트**

기존 `AdminView.jsx`의 핵심 로직(검색, 필터, 일괄 분류, 인라인 편집, 삭제, CSV 내보내기)을 `AdminPanel.jsx`로 이관. `weddingId` prop을 받아 해당 결혼식 데이터만 표시.

이 컴포넌트는 기존 `AdminView.jsx`에서 Supabase 쿼리에 `.eq('wedding_id', weddingId)` 필터를 추가하고, `react-router-dom`의 `Link`를 `next/link`로 변경하는 것이 핵심 변경점.

```jsx
// components/AdminPanel.jsx
'use client'

// 기존 AdminView.jsx의 전체 로직을 이관
// 주요 변경점:
// 1. props로 weddingId 받음
// 2. supabase 쿼리에 .eq('wedding_id', weddingId) 추가
// 3. import { Link } from 'react-router-dom' → import Link from 'next/link'
// 4. /admin 링크 → /w/{weddingId}/record
// 5. SIDE_OPTIONS, getSideBadgeStyle 등을 @/lib/constants에서 import

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-browser'
import { formatAmount, formatAmountShort, formatDateTime } from '@/lib/format'
import { SIDE_OPTIONS, getSideBadgeStyle } from '@/lib/constants'
import StatsCards from '@/components/StatsCards'

export default function AdminPanel({ weddingId }) {
  const [guests, setGuests] = useState([])
  const [search, setSearch] = useState('')
  const [filterSide, setFilterSide] = useState('전체')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // 데이터 로드 + Realtime
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('guests')
        .select('*')
        .eq('wedding_id', weddingId)
        .order('created_at', { ascending: false })
      if (data) setGuests(data)
    }
    load()

    const channel = supabase
      .channel(`admin_${weddingId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guests', filter: `wedding_id=eq.${weddingId}` },
        (payload) => setGuests(prev => prev.some(g => g.id === payload.new.id) ? prev : [payload.new, ...prev])
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guests', filter: `wedding_id=eq.${weddingId}` },
        (payload) => setGuests(prev => prev.map(g => g.id === payload.new.id ? payload.new : g))
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guests', filter: `wedding_id=eq.${weddingId}` },
        (payload) => {
          setGuests(prev => prev.filter(g => g.id !== payload.old.id))
          setSelected(prev => { const next = new Set(prev); next.delete(payload.old.id); return next })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [weddingId])

  // 필터 + 검색 + 정렬
  const filtered = useMemo(() => {
    let result = guests

    if (filterSide !== '전체') {
      result = result.filter(g => g.side === filterSide)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) ||
        (g.relation || '').toLowerCase().includes(q) ||
        (g.memo || '').toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'amount') cmp = (a.amount || 0) - (b.amount || 0)
      else cmp = new Date(a.created_at) - new Date(b.created_at)
      return sortAsc ? cmp : -cmp
    })

    return result
  }, [guests, filterSide, search, sortBy, sortAsc])

  // 일괄 분류
  async function bulkClassify(side) {
    const ids = [...selected]
    if (ids.length === 0) return

    const recorder = typeof window !== 'undefined' ? localStorage.getItem(`recorder_${weddingId}`) || '관리자' : '관리자'

    for (const id of ids) {
      await supabase.from('guests').update({
        side,
        updated_by: recorder,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
    }
    setSelected(new Set())
  }

  // 인라인 편집
  function startEdit(guest) {
    setEditingId(guest.id)
    setEditForm({ name: guest.name, amount: guest.amount, side: guest.side, relation: guest.relation || '', memo: guest.memo || '' })
  }

  async function saveEdit() {
    const recorder = typeof window !== 'undefined' ? localStorage.getItem(`recorder_${weddingId}`) || '관리자' : '관리자'
    await supabase.from('guests').update({
      ...editForm,
      amount: parseInt(editForm.amount) || 0,
      updated_by: recorder,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId)
    setEditingId(null)
  }

  // 삭제
  async function deleteGuest(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('guests').delete().eq('id', id)
  }

  // CSV 내보내기
  function exportCSV() {
    const BOM = '\uFEFF'
    const header = '이름,금액,구분,관계,메모,접수자,일시\n'
    const rows = filtered.map(g =>
      `${g.name},${g.amount},${g.side},${g.relation || ''},${g.memo || ''},${g.recorded_by || ''},${g.created_at}`
    ).join('\n')
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `축의금_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* 통계 */}
      <StatsCards guests={guests} />

      {/* 필터/검색 바 */}
      <div className="flex flex-wrap gap-2 mt-4 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 관계, 메모 검색"
          className="flex-1 min-w-[200px] px-3 py-2 border border-gold-200 rounded-lg bg-parchment focus:border-gold-600 focus:outline-none"
        />
        <select
          value={filterSide}
          onChange={(e) => setFilterSide(e.target.value)}
          className="px-3 py-2 border border-gold-200 rounded-lg bg-parchment"
        >
          <option>전체</option>
          {SIDE_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={exportCSV} className="px-3 py-2 bg-gold-600 text-white rounded-lg text-sm hover:bg-gold-700">
          CSV
        </button>
      </div>

      {/* 일괄 분류 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-gold-50 rounded-lg">
          <span className="text-sm text-gold-600">{selected.size}건 선택</span>
          {SIDE_OPTIONS.filter(s => s !== '미분류').map(s => (
            <button key={s} onClick={() => bulkClassify(s)} className="px-2 py-1 text-xs border border-gold-300 rounded hover:bg-gold-100">
              {s}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="px-2 py-1 text-xs text-red-500">취소</button>
        </div>
      )}

      {/* 게스트 목록 */}
      <div className="flex flex-col gap-1">
        {filtered.map(g => (
          <div key={g.id} className="flex items-center gap-2 bg-white border border-gold-100 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={selected.has(g.id)}
              onChange={(e) => {
                const next = new Set(selected)
                e.target.checked ? next.add(g.id) : next.delete(g.id)
                setSelected(next)
              }}
              className="shrink-0"
            />

            {editingId === g.id ? (
              <div className="flex-1 flex flex-wrap gap-1">
                <input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-20 px-1 border rounded" />
                <input value={editForm.amount} onChange={(e) => setEditForm({...editForm, amount: e.target.value})} className="w-20 px-1 border rounded" inputMode="numeric" />
                <select value={editForm.side} onChange={(e) => setEditForm({...editForm, side: e.target.value})} className="px-1 border rounded text-sm">
                  {SIDE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={saveEdit} className="text-green-600 text-sm">저장</button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 text-sm">취소</button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{g.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${getSideBadgeStyle(g.side)}`}>{g.side}</span>
                  {g.relation && <span className="text-xs text-gold-400">{g.relation}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatAmount(g.amount)}원</span>
                  <button onClick={() => startEdit(g)} className="text-gold-400 text-xs hover:text-gold-600">수정</button>
                  <button onClick={() => deleteGuest(g.id)} className="text-red-400 text-xs hover:text-red-600">삭제</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-gold-400 text-center py-8">데이터가 없습니다</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 관리자 페이지**

```jsx
// app/w/[id]/admin/page.jsx
'use client'

import { use } from 'react'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

export default function AdminPage({ params }) {
  const { id } = use(params)

  return (
    <div className="min-h-screen bg-ivory">
      <header className="bg-white border-b border-gold-100 px-4 py-3 flex items-center justify-between">
        <h1 className="font-display text-lg text-gold-700">관리자</h1>
        <Link
          href={`/w/${id}/record`}
          className="text-sm text-gold-500 hover:text-gold-700 underline"
        >
          접수 화면
        </Link>
      </header>
      <AdminPanel weddingId={id} />
    </div>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add components/AdminPanel.jsx components/StatsCards.jsx app/w/
git commit -m "feat: 관리자 화면 이관 (검색, 필터, 일괄분류, CSV)"
```

---

## Task 9: 빌드 검증 + 최종 테스트

**Files:** 없음 (검증만)

- [ ] **Step 1: 빌드 확인**

```bash
cd /Users/minjoon/minjoon/wedding-reception-next
npm run build
```

Expected: 빌드 성공, 에러 없음

- [ ] **Step 2: 로컬 테스트 — 결혼식 생성 플로우**

```bash
npm run dev
```

1. `http://localhost:3000` 접속 → "새 결혼식 만들기" 클릭
2. 청첩장 URL 입력 (또는 "직접 입력하기")
3. 정보 확인 → PIN 설정 → 생성 완료
4. 생성된 링크와 PIN 확인

- [ ] **Step 3: 로컬 테스트 — 접수 플로우**

1. 생성된 링크 `/w/{id}` 접속
2. 신랑측 PIN 입력 → 접수 화면 진입
3. 이름 + 금액 입력 → 접수
4. 다른 탭에서 같은 링크 + 신부측 PIN → 신부측 접수 화면 확인

- [ ] **Step 4: 로컬 테스트 — 관리자 플로우**

1. `/w/{id}` 접속 → 마스터 PIN 입력 → 관리자 화면
2. 양측 데이터 모두 표시 확인
3. 검색, 필터, 일괄 분류, CSV 내보내기 확인

- [ ] **Step 5: .gitignore 정리 + 최종 커밋**

```bash
# .gitignore에 추가
echo ".env.local" >> .gitignore
echo ".env*.local" >> .gitignore

git add -A
git commit -m "chore: 빌드 검증 + gitignore 정리"
```

---

## Task 10: Vercel 배포

- [ ] **Step 1: Vercel에 연결**

```bash
cd /Users/minjoon/minjoon/wedding-reception-next
npx vercel
```

프롬프트에 따라 프로젝트 연결.

- [ ] **Step 2: 환경변수 설정**

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add FIRECRAWL_API_KEY
npx vercel env add GROQ_API_KEY
npx vercel env add JWT_SECRET
```

- [ ] **Step 3: 프로덕션 배포**

```bash
npx vercel --prod
```

Expected: 배포 성공, URL 출력

- [ ] **Step 4: 프로덕션 테스트**

배포된 URL에서 전체 플로우 (생성 → 접수 → 관리) 확인

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "chore: Vercel 배포 설정"
```

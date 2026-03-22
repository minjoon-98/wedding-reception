# Wedding Reception - Claude Code 프로젝트 가이드

## 프로젝트 개요

결혼식 축의금 접수 시스템. React + Vite + Tailwind CSS + Supabase 기반.
두 명(나 + 삼촌)이 각자 폰으로 동시에 접수 가능한 실시간 동기화 앱.

## 기술 스택

- **프론트엔드**: React 18 (JSX, TypeScript 아님), Vite 5, Tailwind CSS 3
- **백엔드/DB**: Supabase (PostgreSQL + Realtime)
- **라우팅**: React Router 6 (/, /admin)
- **배포**: Vercel (예정)

## 디자인 시스템

- **테마**: 웨딩 골드/아이보리 톤 (`gold-50` ~ `gold-800`)
- **신랑측**: 블루 계열 (`groom-50` ~ `groom-600`)
- **신부측**: 로즈 계열 (`bride-50` ~ `bride-600`)
- **폰트**: Pretendard (본문), Noto Serif KR (타이틀)
- **컬러 정의**: `tailwind.config.js` 참고

## 파일 구조

- `src/App.jsx` — 접수 화면 (현장용, 빠른 입력)
- `src/pages/AdminView.jsx` — 관리자 뷰 (사후 분류/편집)
- `src/lib/supabase.js` — Supabase 클라이언트
- `src/index.css` — Tailwind 디렉티브 + 커스텀 애니메이션

## 코드 컨벤션

- 컴포넌트: 함수형 컴포넌트, `export default function ComponentName()`
- 상태: React hooks (useState, useEffect, useMemo, useRef)
- Supabase 호출: async/await, 에러 체크 후 상태 업데이트
- 스타일: Tailwind 유틸리티 클래스 (인라인 style 지양)
- 불변성: setState에서 항상 새 객체/배열 생성

## Supabase 테이블

```sql
guests (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  side TEXT DEFAULT '미분류',    -- 신랑측/신부측/신랑 부모님/신부 부모님/기타/미분류
  relation TEXT,                 -- 대학동기, 직장동료 등
  memo TEXT,                     -- 인상착의 등 자유 메모
  recorded_by TEXT,              -- 접수자 (미사용)
  created_at TIMESTAMPTZ
)
```

## 환경 변수

- `VITE_SUPABASE_URL` — Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon public key
- `.env` 파일은 git에 포함하지 않음

## 개발 명령어

- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npm run preview` — 빌드 결과 미리보기

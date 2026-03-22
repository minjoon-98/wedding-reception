# 축의금 접수 시스템

결혼식 현장에서 축의금을 빠르게 접수하고, 사후에 편리하게 분류/관리할 수 있는 웹 애플리케이션.

## 주요 기능

### 접수 화면 (`/`)
- 이름 + 금액 빠른 입력 (빠른 금액 버튼 지원)
- 선택적 추가 정보: 구분(신랑측/신부측 등), 관계, 메모
- 실시간 총액/인원 통계 (신랑측/신부측 분리)
- 최근 접수 목록 실시간 표시

### 관리자 뷰 (`/admin`)
- 전체 접수 목록 검색/필터/정렬
- 인라인 편집 (이름, 금액, 구분, 관계, 메모)
- 미분류 항목 일괄 분류
- 측별 통계 카드
- CSV 다운로드

### 실시간 동기화
- Supabase Realtime을 통한 다중 기기 동시 접수
- 두 명이 각자 폰으로 동시에 입력 가능

## 기술 스택

| 기술 | 용도 |
|------|------|
| React 18 | UI 프레임워크 |
| Vite 5 | 빌드 도구 |
| Tailwind CSS 3 | 스타일링 |
| Supabase | 데이터베이스 (PostgreSQL) + 실시간 동기화 |
| React Router 6 | 라우팅 |

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 가입 (GitHub 계정 추천)
2. New Project 생성 (Region: Northeast Asia / Seoul)
3. SQL Editor에서 아래 SQL 실행:

```sql
CREATE TABLE guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  side TEXT NOT NULL DEFAULT '미분류',
  relation TEXT,
  memo TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON guests
  FOR ALL USING (true) WITH CHECK (true);
```

4. Settings > API에서 **Project URL**과 **anon public key** 복사

### 3. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 Supabase 정보 입력:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. 개발 서버 실행

```bash
npm run dev
```

### 5. 배포 (Vercel CLI)

GitHub 없이도 로컬에서 바로 배포 가능:

```bash
npx vercel
```

배포 후 생성되는 URL을 결혼식 당일 폰 브라우저에서 접속하면 됩니다.

## 프로젝트 구조

```
wedding-reception/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js       # 골드/웨딩 테마 커스텀 컬러
├── .env.example
└── src/
    ├── main.jsx             # React 앱 마운트 + 라우팅
    ├── App.jsx              # 접수 화면
    ├── index.css            # Tailwind + 커스텀 애니메이션
    ├── lib/
    │   └── supabase.js      # Supabase 클라이언트
    └── pages/
        └── AdminView.jsx    # 관리자 뷰
```

## 사용 시나리오

1. **결혼식 당일**: 접수 화면에서 이름+금액만 빠르게 입력 (추가 정보는 선택)
2. **여유 있을 때**: 추가 정보 펼쳐서 구분/관계/메모도 입력
3. **결혼식 후**: 관리자 뷰에서 미분류 항목을 신랑측/신부측으로 분류, CSV 다운로드

# 💒 결혼식 축의금 접수 시스템

결혼식 현장에서 축의금을 빠르게 접수하고, 사후에 관리자 뷰에서 분류/정리할 수 있는 웹앱입니다.

## 기술 스택
- **Frontend**: React + Vite + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Realtime)
- **배포**: Vercel (권장)

## 기능
### 접수 화면 (현장용)
- 이름 + 금액만 빠르게 입력
- 실시간 동기화 (여러 기기에서 동시 입력 가능)
- 최근 접수 내역 확인

### 관리자 뷰 (사후 정리용)
- 전체 하객 목록 조회
- 신랑측/신부측/부모님지인 등 분류
- 동명이인 메모 추가
- 검색/필터/정렬
- 총액 통계 (전체, 측별)
- CSV 다운로드

## 세팅 방법

### 1. Supabase 프로젝트 생성
1. [supabase.com](https://supabase.com) 가입
2. New Project → Region: Seoul
3. SQL Editor에서 아래 실행:

```sql
CREATE TABLE guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  side TEXT DEFAULT '미분류',
  relation TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  recorded_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON guests
  FOR ALL USING (true) WITH CHECK (true);
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
```
`.env` 파일에 Supabase URL과 anon key 입력:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 실행
```bash
npm install
npm run dev
```

### 4. 배포 (Vercel)
```bash
npm install -g vercel
vercel
```
환경 변수를 Vercel 대시보드에서도 설정해주세요.

## 사용법
- `/` — 접수 화면 (현장에서 폰으로 사용)
- `/admin` — 관리자 뷰 (사후 정리용)

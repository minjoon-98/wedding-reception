# Wedding Reception Platform — 설계 문서

> 작성일: 2026-03-29
> 상태: 승인 대기

---

## 1. 프로젝트 개요

### 현재 상태
결혼식 축의금 접수 시스템. React + Vite + Tailwind CSS + Supabase 기반.
두 명(나 + 삼촌)이 각자 폰으로 동시에 접수 가능한 실시간 동기화 앱.

- 접수 화면 (`/`) — 이름 + 금액 빠른 입력
- 관리자 뷰 (`/admin`) — 검색, 필터, 일괄 분류, CSV 내보내기
- 실시간 동기화 (Supabase Realtime INSERT/UPDATE/DELETE)

### 목표
단일 결혼식용 앱 → **멀티 결혼식 플랫폼**으로 확장.
모바일 청첩장 URL만 입력하면 자동으로 결혼식 정보를 추출하고,
신랑측/신부측이 독립적으로 축의금을 관리할 수 있는 서비스.

### 핵심 사용 시나리오
1. 사용자가 모바일 청첩장 URL을 입력
2. 시스템이 자동으로 결혼식 정보(신랑/신부, 날짜, 장소) 추출
3. "이 정보가 맞나요?" 확인 화면 → 수정 가능
4. PIN 설정 (신랑측 PIN, 신부측 PIN, 마스터 PIN)
5. 고유 링크 생성 (`/w/abc123`)
6. 해당 링크 + PIN으로 접수자들이 접속하여 축의금 접수
7. 마스터 PIN으로 양측 통합 관리

---

## 2. 설계 결정 기록 (ADR)

### ADR-1: 결혼식 단위 접근 방식

**결정: 링크 기반 (`/w/:id`)**

| 검토 옵션 | 장점 | 단점 | 판정 |
|-----------|------|------|------|
| **A) 링크 기반** | 회원가입 불필요, URL만 공유하면 됨, 현장에서 즉시 접속 가능 | 링크 유출 시 접근 가능 (PIN으로 보완) | ✅ 채택 |
| B) 계정 기반 | 보안 강함 | 현장에서 삼촌 등 다른 사람 접속 어려움, 가입 허들 | ❌ |
| C) 초대 코드 기반 | 코드만 알면 접속 | 링크 기반과 유사하나 UX가 한 단계 더 복잡 | ❌ |

**근거**: 결혼식 당일 현장에서 삼촌에게 "이 링크 열고 PIN 입력해" 한 마디면 끝. 계정 기반은 "먼저 가입하고..." 단계가 추가되어 현장 사용성이 떨어짐.

---

### ADR-2: 접수자 권한 관리

**결정: PIN 보호 (4자리)**

| 검토 옵션 | 장점 | 단점 | 판정 |
|-----------|------|------|------|
| A) 완전 공개 | 가장 간단 | 링크 유출 시 장난 가능 | ❌ |
| **B) PIN 보호** | 간단하면서도 기본 보안 확보, "링크 + PIN 4자리"만 공유 | PIN이 단순할 수 있음 | ✅ 채택 |
| C) 초대 링크 분리 | 역할별 링크 분리 | 링크 관리 복잡, PIN과 비교 시 장점 없음 | ❌ |

**근거**: 결혼식 축의금 앱의 보안 수준은 "장난 방지" 정도면 충분. 은행급 보안은 불필요. 4자리 PIN은 현장에서 구두로 전달하기에 최적.

---

### ADR-3: 신랑측/신부측 분리 운영

**결정: 측별 별도 PIN + 마스터 PIN**

| 검토 옵션 | 장점 | 단점 | 판정 |
|-----------|------|------|------|
| **A) 측별 별도 PIN** | 데이터 격리 자연스러움, PIN으로 측 자동 결정 | PIN 3개 관리 필요 | ✅ 채택 |
| B) 같은 화면, 측 선택 | 단순 | 양쪽 데이터 혼재, 접수 시 매번 측 선택 필요 | ❌ |
| C) 완전 독립 | 완전 격리 | 통합 통계 어려움, 결혼식 2개처럼 관리 | ❌ |

**PIN 구조:**
- 신랑측 PIN (예: 1234) → 접속 시 자동으로 신랑측 접수 화면
- 신부측 PIN (예: 5678) → 접속 시 자동으로 신부측 접수 화면
- 마스터 PIN (예: 0000) → 양측 통합 관리자 화면

**근거**: 실제 결혼식에서 신랑측과 신부측은 물리적으로 다른 테이블에서 접수. 각 측이 상대측 데이터를 볼 필요 없음. 마스터 PIN은 양가 부모님 또는 웨딩플래너가 전체 현황 파악용.

---

### ADR-4: 모바일 청첩장 크롤링 방식

**결정: Firecrawl(무료) → 정규식 우선 + Groq 무료 API 폴백**

이 결정은 가장 많은 검토를 거쳤으며, 9가지 방법을 비교 분석함.

#### 배경: 모바일 청첩장 생태계

한국 모바일 청첩장 사이트는 10개 이상 존재:
- makedear.com, 바른손카드(mcard.barunsoncard.com), 디얼디어(deardeer.kr)
- 달팽(dalpeng.com), 잇츠카드(itscard.co.kr), 투아워게스트(toourguest.com)
- 파스텔무비(pastelletters.com), 프롬투데이(fromtoday.co.kr), 데어무드(theirmood.com), 필카드(directwedcard.com)

각 사이트마다 HTML 구조가 다르므로, **사이트별 파서를 만드는 것은 비현실적**.

#### 크롤링 기술 조사: makedear.com 분석

makedear.com을 Playwright로 분석한 결과:
- **Nuxt.js (SSR)** 기반, `window.__NUXT__` 객체에 모든 데이터 구조화
- 직접 HTTP fetch는 **403 차단** (bot 방어)
- 브라우저 렌더링(Playwright/Puppeteer) 필요

**추출 가능 데이터:**

| 항목 | 데이터 경로 | 예시 |
|------|-----------|------|
| 신랑/신부 | `basic.types[0].members` | 김용준 / 장문희 |
| 날짜/시간 | `basic.date` | 2026-04-19 오후 2시 |
| 장소 | `basic.place` + `placeDetail` | 더컨벤션 영등포 1층 그랜드볼룸홀 |
| 주소/좌표 | `editor.map` | 서울 영등포구 국회대로38길 2 (lat: 37.527, lng: 126.899) |
| 부모님 | `editor.family.man/woman` | 김석재·우성란 / 장세근·문기수 |
| 연락처 | `editor.contact` | 전화번호 6명분 |
| 계좌정보 | `editor.account.groups` | 신랑측 3개, 신부측 3개 계좌 |

→ 그러나 이 구조는 makedear.com에만 해당. 범용적 방법 필요.

#### 범용 크롤링 전략: Firecrawl

Firecrawl은 어떤 사이트든 **마크다운으로 변환**해주는 서비스.
- 무료 플랜: **500 크레딧** (일회성, 스크래핑 1회 = 1크레딧)
- 결혼식 생성 시 1번만 크롤링 → 500개 결혼식까지 무료

#### AI 추출 방법: 9가지 비교 분석

| # | 방법 | 비용 | 속도 | 정확도 | 유지보수 | 프라이버시 | 한계 |
|---|------|------|------|--------|----------|-----------|------|
| A | 브라우저 경량 모델 (SmolLM2-360M, WebGPU) | 완전 무료 | 느림 (첫 로드 5-10초, 추론 3-5초) | 중 | 낮음 | 최고 | 250MB 다운로드, 구형 브라우저 불가 |
| B | Vercel Serverless + Transformers.js (Qwen3-0.6B ONNX) | 완전 무료 | 느림 (콜드스타트 5-15초) | 중상 | 중 | 좋음 | Vercel 메모리 제한, 콜드스타트 |
| C | HuggingFace ZeroGPU (gpt-oss-20b Gradio API) | 무료 (일일 한도) | 보통 (2-5초) | 높음 | 중 | 보통 | Gradio SDK만, 큐 대기 가능 |
| **D** | **Groq 무료 API (Llama 3.3 70B)** | **무료 (30req/분, 14400/일)** | **매우 빠름 (<1초)** | **매우 높음** | **매우 낮음** | 보통 | API 키 필요, 한도 변경 가능성 |
| E | Google Gemini Flash-Lite 무료 | 무료 (1000req/일) | 빠름 (1-2초) | 높음 | 매우 낮음 | 보통 | 한도 변경 가능성 |
| F | Cloudflare Workers AI (Llama 3.2) | 무료 (10K neurons/일) | 빠름 (1-2초) | 중상 | 낮음 | 좋음 (엣지) | 양자화 모델, 한국어 성능 미지수 |
| G | HuggingFace Inference API (무료) | 무료 (수백 req/시간) | 보통 (2-5초) | 중상 | 낮음 | 보통 | 레이트 리밋, SLA 없음 |
| **H** | **정규식 패턴 매칭만** | **완전 무료** | **즉시** | 사이트별 다름 | 높음 | **최고** | 새 사이트 대응 수동 |
| I | 자체 GPU 서버 (gpt-oss-20b) | GPU 서버 비용 | 빠름 | 매우 높음 | 높음 | 최고 | 서버 관리 필요 |

#### 오픈소스 모델 검토

사용자 요청으로 "API 콜링 없이 자체 실행 가능한 무료 모델"을 심도 있게 검토함:

**검토된 오픈소스 모델:**
- **gpt-oss-20b** (OpenAI, Apache 2.0): 21B params, MoE 활성 3.6B, 16GB RAM. 성능 최고급이나 Vercel serverless에서 실행 불가 (GPU 필요)
- **gpt-oss-120b** (OpenAI, Apache 2.0): 117B params, 단일 80GB GPU. 오버킬.
- **Gemma 3 4B** (Google): 4B params, 8GB RAM. 텍스트 추출에 강함.
- **Phi-4 Mini** (Microsoft): 3.8B params, 매우 가벼움.
- **SmolLM2-360M** (HuggingFace): 360M params, 브라우저 실행 가능 (250MB). 정확도 제한적.
- **Qwen3-0.6B** (Alibaba): 0.6B params, ONNX INT4 양자화로 ~200MB. Transformers.js로 Node.js 실행 가능.

**자체 실행 환경 검토:**
- **Vercel Serverless**: GPU 없음, 메모리 3GB 제한 → 소형 ONNX 모델만 가능 (Qwen3-0.6B 수준)
- **브라우저 (WebGPU/ONNX Runtime Web)**: SmolLM2-360M 실행 가능하나 250MB 다운로드 필요
- **HuggingFace ZeroGPU**: 무료 H200 GPU 할당, gpt-oss-20b 실행 가능하나 Gradio SDK 전용
- **무료 GPU 호스팅**: 실질적으로 "항시 무료"인 GPU 서버는 없음. RunPod, Vast.ai 등은 유료.

**결론**: 결혼식 생성은 **딱 1번 실행**되는 작업. 250MB 모델 다운로드나 GPU 서버 유지는 오버킬. **정규식(즉시, 무료) + Groq API(무료, <1초)** 조합이 비용-성능-유지보수 모든 면에서 최적.

#### 최종 결정: H + D 하이브리드

```
Firecrawl (마크다운 변환)
    ↓
정규식 패턴 매칭 (1차 시도)
    ↓ 실패 시
Groq 무료 API - Llama 3.3 70B (2차 시도)
    ↓ 실패 시
수동 입력 폼 (최종 폴백)
    ↓
"이 정보가 맞나요?" 확인 화면
    ↓
결혼식 생성
```

**선택 근거:**
1. 결혼식 생성은 딱 1번 — 하루 14,400건 무료면 평생 충분
2. 정규식이 90% 커버 — 한국 청첩장 형식이 정형화됨 ("OOO ♥ OOO", "YYYY년 M월 D일")
3. Groq이 가장 빠르고 정확 — 700+ tokens/sec, Llama 3.3 70B
4. 구현 복잡도 최저 — API 한 줄 호출, 모델 서빙/관리 불필요
5. 브라우저 모델 대비 — 250MB 다운로드는 모바일 UX 킬러
6. 자체 GPU 대비 — 서버 관리 비용 > API 비용 (무료니까)

---

### ADR-5: 기술 스택 변경

**결정: Next.js로 마이그레이션**

| 검토 옵션 | 장점 | 단점 | 판정 |
|-----------|------|------|------|
| A) React + Vite 유지 | 변경 없음 | 서버 로직을 Supabase Edge Functions로 분산 | ❌ |
| **B) Next.js 마이그레이션** | API Routes로 서버 통합, Vercel 최적화, App Router 라우팅 | 마이그레이션 작업 | ✅ 채택 |
| C) 프론트 유지 + 별도 백엔드 | 프론트 변경 없음 | 두 프로젝트 관리, 배포 복잡 | ❌ |

**근거**: 현재 코드가 `App.jsx` + `AdminView.jsx` 두 파일이라 마이그레이션 부담이 작음. 크롤링/AI 추출은 서버 기능이 필수인데, Next.js API Routes가 가장 자연스러운 통합 방식. Vercel 배포도 Next.js에 최적화.

---

### ADR-6: 배포 및 도메인

**결정: Vercel 무료 플랜 + 기본 도메인**

| 검토 옵션 | 장점 | 단점 | 판정 |
|-----------|------|------|------|
| **A) Vercel 무료 + 기본 도메인** | 무료, 즉시 사용 가능 | `.vercel.app` 도메인 | ✅ 채택 |
| B) Vercel + 커스텀 도메인 | 서비스 느낌 | 연 1-2만원 비용 | 나중에 |
| C) 일단 A, 나중에 B | 점진적 | - | A와 동일 |

**근거**: 서비스화 전 단계에서는 기본 도메인으로 충분. 나중에 필요하면 도메인 연결은 5분 작업.

---

## 3. 데이터 모델

### 신규 테이블: `weddings`

```sql
weddings (
  id TEXT PRIMARY KEY,              -- nanoid 등 짧은 고유 ID (URL용)
  groom_name TEXT NOT NULL,         -- 신랑 이름
  bride_name TEXT NOT NULL,         -- 신부 이름
  wedding_date TIMESTAMPTZ,         -- 결혼식 날짜/시간
  venue_name TEXT,                  -- 예식장 이름
  venue_detail TEXT,                -- 층/홀 정보
  venue_address TEXT,               -- 주소
  venue_lat FLOAT,                  -- 위도
  venue_lng FLOAT,                  -- 경도
  groom_father TEXT,                -- 신랑 부친
  groom_mother TEXT,                -- 신랑 모친
  bride_father TEXT,                -- 신부 부친
  bride_mother TEXT,                -- 신부 모친
  invitation_url TEXT,              -- 모바일 청첩장 원본 URL
  pin_groom TEXT NOT NULL,          -- 신랑측 PIN (해시 저장)
  pin_bride TEXT NOT NULL,          -- 신부측 PIN (해시 저장)
  pin_master TEXT NOT NULL,         -- 마스터 PIN (해시 저장)
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 기존 테이블 변경: `guests`

```sql
-- 추가 컬럼
ALTER TABLE guests ADD COLUMN wedding_id TEXT REFERENCES weddings(id);

-- 기존 데이터 마이그레이션: 기본 결혼식에 연결
-- (기존 guests 데이터를 위한 default wedding 생성 후 연결)
```

### RLS 정책 업데이트

```sql
-- weddings: 누구나 생성 가능, 읽기는 ID 기반
-- guests: wedding_id 기반 접근 (PIN 검증은 앱 레벨)
```

---

## 4. 라우팅 구조

```
/                           → 홈 (결혼식 생성 or 기존 결혼식 접속)
/create                     → 결혼식 생성 플로우
  /create/url               → 청첩장 URL 입력
  /create/confirm            → 추출된 정보 확인/수정
  /create/pin               → PIN 설정
  /create/done              → 생성 완료 (링크 공유)
/w/[id]                     → PIN 입력 화면
/w/[id]/record              → 접수 화면 (측별, PIN 검증 후)
/w/[id]/admin               → 관리자 화면 (마스터 PIN 검증 후)
```

---

## 5. 핵심 플로우

### 5.1 결혼식 생성 플로우

```
사용자 → [홈] "새 결혼식 만들기"
    → [URL 입력] 모바일 청첩장 URL 입력 (또는 "수동 입력" 선택)
    → [서버] Firecrawl로 마크다운 변환
    → [서버] 정규식 추출 시도
    → [서버] 실패 시 Groq API로 AI 추출
    → [확인] "이 정보가 맞나요?" + 수정 가능 폼
    → [PIN 설정] 신랑측 PIN, 신부측 PIN, 마스터 PIN 입력
    → [완료] 고유 링크 생성 + 공유 안내
```

### 5.2 접수 플로우

```
접수자 → [/w/abc123] PIN 입력
    → PIN이 신랑측 PIN과 일치 → 신랑측 접수 화면
    → PIN이 신부측 PIN과 일치 → 신부측 접수 화면
    → PIN이 마스터 PIN과 일치 → 관리자 화면
    → 불일치 → 에러 메시지
```

### 5.3 크롤링 파이프라인 (서버사이드)

```javascript
// Next.js API Route: /api/crawl
async function crawlInvitation(url) {
  // Step 1: Firecrawl로 마크다운 변환
  const markdown = await firecrawl.scrapeUrl(url, { formats: ['markdown'] });

  // Step 2: 정규식 패턴 매칭 (1차)
  const regexResult = extractWithRegex(markdown);
  if (regexResult.confidence > 0.8) return regexResult;

  // Step 3: Groq AI 추출 (2차 폴백)
  const aiResult = await extractWithGroq(markdown);
  if (aiResult) return aiResult;

  // Step 4: 수동 입력 폴백
  return { success: false, rawMarkdown: markdown };
}
```

---

## 6. 기술 스택

| 레이어 | 기술 | 용도 |
|--------|------|------|
| 프레임워크 | Next.js (App Router, JSX) | 프론트 + API Routes |
| 스타일 | Tailwind CSS 3 | 웨딩 골드/아이보리 테마 유지 |
| DB/Auth | Supabase (PostgreSQL + Realtime) | 데이터 저장 + 실시간 동기화 |
| 크롤링 | Firecrawl (무료 플랜) | 청첩장 → 마크다운 변환 |
| AI 추출 | Groq API (무료, Llama 3.3 70B) | 마크다운 → 구조화 데이터 |
| 배포 | Vercel (무료 플랜) | 호스팅 + CI/CD |
| ID 생성 | nanoid | 짧은 URL-safe ID |

### 환경변수 (추가)

```
FIRECRAWL_API_KEY=...         # Firecrawl 무료 플랜 API 키
GROQ_API_KEY=...              # Groq 무료 API 키
```

---

## 7. 구현 단계

### Phase 1: Next.js 프로젝트 셋업 + DB 스키마 확장
- Next.js 프로젝트 생성 (App Router, JSX)
- 기존 Tailwind 테마/스타일 이관
- `weddings` 테이블 생성
- `guests` 테이블에 `wedding_id` 추가
- 기존 데이터 마이그레이션

### Phase 2: 결혼식 생성 플로우
- 홈 페이지 (새 결혼식 생성 / 기존 결혼식 접속)
- 청첩장 URL 입력 화면
- Firecrawl + 정규식 + Groq 크롤링 파이프라인 API
- 정보 확인/수정 화면
- PIN 설정 화면
- 생성 완료 + 링크 공유 화면

### Phase 3: 측별 접근 + 기존 기능 이관
- PIN 입력 화면 (`/w/[id]`)
- 접수 화면 이관 (`/w/[id]/record`) — 기존 App.jsx 로직 재활용
- 관리자 화면 이관 (`/w/[id]/admin`) — 기존 AdminView.jsx 로직 재활용
- Supabase Realtime 구독을 wedding_id 기반으로 필터링

### Phase 4: 배포 + 마무리
- Vercel 배포 설정
- 환경변수 설정 (Supabase, Firecrawl, Groq)
- 기존 결혼식 데이터 마이그레이션
- E2E 테스트

---

## 8. 보안 고려사항

- **PIN 저장**: 평문 저장하지 않음. bcrypt 또는 SHA-256 해시 저장
- **PIN 검증**: 서버사이드 API Route에서 해시 비교 검증. 성공 시 httpOnly 쿠키에 JWT 토큰 발급 (payload: `{ weddingId, side, role }`, 만료: 24시간). 이후 요청은 쿠키 기반 인증.
- **Brute-force 방지**: PIN 입력 시도 횟수 제한 (5회 실패 시 1분 잠금)
- **API 키 보호**: Firecrawl/Groq API 키는 서버사이드에서만 사용 (클라이언트 노출 안 됨)
- **Supabase RLS**: wedding_id 기반 행 수준 보안

---

## 9. 향후 확장 가능성 (구현하지 않음)

아래 항목은 DB 스키마 설계 시 고려하되, 현재는 구현하지 않음:

- 회원가입/로그인 시스템
- 커스텀 도메인
- 결혼식 대시보드 (내 결혼식 목록)
- 결혼식 간 데이터 분석/통계
- 청첩장 크롤링 사이트별 최적화 파서
- 오프라인 모드 (Service Worker)
- 축의금 영수증/감사 메시지 자동 발송

---

## 10. 참고 자료

- [makedear.com 크롤링 분석 결과](#adr-4-모바일-청첩장-크롤링-방식) — Playwright로 `window.__NUXT__` 구조 분석
- [Firecrawl 가격](https://www.firecrawl.dev/pricing) — 무료 500크레딧
- [Groq 가격](https://groq.com/pricing) — 무료 30req/분, 14400/일
- [gpt-oss-20b](https://huggingface.co/openai/gpt-oss-20b) — 검토했으나 Vercel에서 실행 불가
- [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) — 브라우저/Node.js ML 추론
- [SmolLM2 Browser Extraction](https://www.sitepoint.com/slm-structured-data-extraction-browser/) — 브라우저 경량 모델
- [WebLLM](https://github.com/mlc-ai/web-llm) — 브라우저 LLM 추론 엔진
- [HuggingFace ZeroGPU](https://huggingface.co/docs/hub/en/spaces-zerogpu) — 무료 GPU 할당
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) — 엣지 AI 추론
- [Google Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing) — 무료 티어
- [한국 모바일 청첩장 사이트 목록](#adr-4-모바일-청첩장-크롤링-방식) — makedear, 바른손카드 등 10+개

# 트러블슈팅 기록

> 작성일: 2026-03-29

---

## 1. Supabase URL 불일치 — `TypeError: fetch failed`

**증상**: `POST /api/wedding` 호출 시 `{ success: false, error: "결혼식 생성에 실패했습니다.", detail: "TypeError: fetch failed" }`

**원인**: `.env.local`에 잘못된 Supabase URL이 설정되어 있었음.
- 잘못된 값: `https://fhqjoftmyamjbfntazab.supabase.co` (Task 1 에이전트가 잘못 생성)
- 올바른 값: `https://ulkfzcyyanjlpojipqpu.supabase.co` (기존 프로젝트 `.env`에서 확인)

**해결**: `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 기존 프로젝트의 값으로 수정.

**교훈**: 새 프로젝트 생성 시 기존 환경변수를 복사하는 과정에서 값 검증 필수. `Could not resolve host` 에러가 나면 URL부터 확인.

---

## 2. Vercel 배포 404 — `NOT_FOUND`

**증상**: Vercel 대시보드에서 "READY" 상태인데, `https://wedding-reception-mu.vercel.app/` 접속 시 404 NOT_FOUND.

**원인**: 복합적 문제:

### 2-1. Framework 미스매칭
기존 React+Vite 프로젝트가 Vercel에 연결되어 있어서, `outputDirectory`가 `dist`로 설정되어 있었음. Next.js는 `.next` 폴더를 사용하므로 빌드 결과물을 찾지 못함.

**해결**: Vercel API로 framework을 `nextjs`로 변경.
```bash
curl -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"framework":"nextjs","outputDirectory":"","buildCommand":"next build"}'
```

### 2-2. buildCommand 수동 설정 문제
`buildCommand: "next build"`를 수동 설정했더니, Vercel이 `npm install` 없이 직접 `next build`를 실행하려 해서 빌드가 0ms (또는 90ms)에 완료됨. 빈 output 생성.

**증거**: 빌드 로그에 `Build Completed in /vercel/output [90ms]` — 정상 빌드는 25초 소요.

**해결**: `buildCommand`를 `null`로 리셋하여 Vercel 자동 감지 활성화.
```bash
curl -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"buildCommand":null,"installCommand":null,"outputDirectory":null}'
```

리셋 후 Vercel이 자동으로 `npm install` → `npm run build` → `next build` 순서로 실행하여 정상 빌드 (25초).

### 2-3. SSO Protection
`ssoProtection: {'deploymentType': 'all_except_custom_domains'}`가 활성화되어 있어서 비로그인 사용자 접근 차단.

**해결**: SSO Protection 비활성화.
```bash
curl -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"ssoProtection":null}'
```

### 2-4. CLI 배포 vs Git 배포 충돌
`npx vercel --prod`(CLI)로 배포하면 프로덕션 alias에 할당되었지만, GitHub push가 트리거하는 자동 배포와 충돌. CLI 배포는 `buildCommand` 설정 문제로 빈 빌드가 올라감.

**최종 해결**: buildCommand null 리셋 후, **Git push로 자동 배포** 트리거하여 정상 빌드 확인.

**교훈**:
1. Vite → Next.js 마이그레이션 시 Vercel의 framework 설정을 반드시 변경
2. `buildCommand`는 null(자동 감지)이 가장 안전 — 수동 설정은 `npm install` 누락 등 사이드이펙트 발생 가능
3. CLI 배포보다 Git push 기반 자동 배포가 더 안정적 (설정이 Vercel 서버에서 올바르게 적용됨)
4. 404가 뜨면 빌드 로그의 빌드 시간부터 확인 — 0ms~100ms면 빌드가 실행되지 않은 것

---

## 3. Git Author 일괄 변경

**배경**: 커밋이 `minjoon-krafton` (회사 계정)으로 되어있어서 개인 계정 `minjoon-98`으로 변경 필요.

**해결**:
```bash
# 프로젝트 로컬 설정
git config user.name "minjoon-98"
git config user.email "4kmj54321@gmail.com"

# 모든 기존 커밋 author 변경
git filter-branch -f --env-filter '
export GIT_AUTHOR_NAME="minjoon-98"
export GIT_AUTHOR_EMAIL="4kmj54321@gmail.com"
export GIT_COMMITTER_NAME="minjoon-98"
export GIT_COMMITTER_EMAIL="4kmj54321@gmail.com"
' -- --all

# 강제 push (모든 브랜치)
git push --force origin main
git push --force origin legacy-react
```

**주의**: `filter-branch`는 모든 커밋의 해시를 변경하므로, 협업자가 있는 리포에서는 사전 공지 필요.

---

## 4. middleware.js Deprecation Warning

**증상**: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`

**원인**: Next.js 16에서 `middleware.js`가 `proxy.js`로 리네임됨.

**현재 상태**: 기능은 정상 동작. 리네임은 다음 세션에서 처리 예정.

**해결 (TODO)**:
```bash
mv middleware.js proxy.js
# 내용 변경 없이 파일명만 변경
```

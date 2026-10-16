# Voca — 우리 아이 영어 단어 시험

두 자녀가 각자 영어 단어를 등록해 두고 **일주일에 두 번** 시험을 보는 가족용 웹앱입니다.
자동 채점, 결과 보관, 틀린 단어 재시험, 발음 듣기를 지원합니다.

- **Frontend/BFF**: Next.js 16 (App Router, Server Components, Server Actions), TypeScript strict, Tailwind v4
- **DB/Auth**: Supabase (Postgres + Auth)
- **배포**: Vercel
- **사진 인식**: Gemini(`GEMINI_API_KEY`, 무료 등급 가능) → Claude(`ANTHROPIC_API_KEY`) → 브라우저 내 Tesseract OCR 순으로 사용
- **발음**: 기기 내장 음성(Web Speech API) + 서버 TTS(`/api/tts`, 시험 철자 문항)

**운영**: https://voca-pink.vercel.app

## 문서

| 문서 | 내용 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | AI·개발자 작업 지침 (명령어, 반드시 지킬 규칙, 코드 지도) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 구조, 역할·권한, 데이터 모델, 규칙 위치, OCR·TTS |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | 운영 환경, 환경변수, 배포·마이그레이션 절차, 장애 대응 |
| [docs/HISTORY.md](docs/HISTORY.md) | PR 이력, 요구사항, 결정 이유, 알려진 한계, 후속 후보 |
| [e2e/README.md](e2e/README.md) | Playwright E2E 실행법 |

---

## 기능 요약

| 구분 | 내용 |
| --- | --- |
| 가족/계정 | 부모 2명이 각자 이메일 계정으로 로그인. 한 명이 가족을 만들고 **초대코드**(72시간·1회용)로 배우자 합류 |
| 자녀 | 자녀별 프로필(단어·시험·횟수 분리). 부모가 설정에서 **자녀 전용 아이디/비밀번호**를 만들어 주면 아이 혼자 로그인 가능(본인 프로필 고정, 부모 기능 불가). 아이디 없이 부모 계정에서 "누가 공부하나요?"로 골라 쓸 수도 있음 |
| 부모 모드 | 가족 공용 **부모 PIN**(4~8자리)으로 잠금 해제(30분). 단어 수정/삭제, 채점 정정, 설정, 진행 중 시험 취소는 부모 모드에서만 가능. 5회 실패 시 5분 잠금 |
| 단어 등록 | **자녀 모드에서도 가능**. 직접 입력 / 여러 줄 붙여넣기(`apple 사과`, `apple - 사과`, 탭 구분 등) / **사진 촬영**(사전형 교재도 AI 인식) → 확인·수정 후 저장. 영어 칸은 영문 키보드 힌트, 단어장은 **등록한 순서대로** 표시 |
| 출제 규칙 | 정기 시험은 **등록 다음 날(KST)부터**, 아직 정기 시험에 나온 적 없는 단어를 **전부** 출제. 출제 대상이 **50개 미만이면 시작 불가**. **주 2회**(KST 월요일 시작) |
| 시험 유형 | 철자 쓰기(뜻+발음 → 영어) / 뜻 쓰기(영어 → 한글 뜻) / 섞어서 |
| 채점 | 서버에서만 채점. 철자는 대소문자·공백 무시, 뜻은 여러 뜻 중 하나(여러 개 쓰면 모두 맞아야 정답), 괄호 보충설명 무시. 애매한 답은 부모가 결과 화면에서 **정답 인정**(누가 정정했는지 기록) |
| 재시험 | 틀린 문항만, 주간 횟수에 포함되지 않음. 다 맞을 때까지 반복 가능 |
| 오답 연습 | 틀렸던 단어(최근 틀림 / 한 번이라도 틀림)를 카드 넘기기·철자 쓰기·뜻 쓰기로 무제한 연습. 모르는 단어는 다시 나와 다 맞힐 때까지. 점수·횟수에 영향 없음 |
| 기록 | 시험별 결과·점수 추이, 단어별 틀린 횟수. 시험 문항은 매번 **무작위 순서** |

자녀별 주간 횟수(기본 2)와 최소 출제 단어 수(기본 50)는 설정에서 바꿀 수 있습니다.

## 설계 메모 (리뷰어용)

- **BFF 보안 모델**: 브라우저는 Supabase Auth만 사용합니다. 모든 테이블은 RLS 활성 + 정책 없음 + `anon/authenticated` 권한 회수로 브라우저에서 직접 읽고 쓸 수 없습니다. 데이터 접근은 Next.js 서버가 `service_role`로 하며, `requireMember()`로 검증한 `family_id`를 repo 계층의 모든 쿼리에 강제합니다(`src/lib/server/repo.ts`).
- **정답 비노출**: 시험 화면에는 문제 텍스트만 내려갑니다. 철자 문항의 발음은 `/api/tts?item=<문항 id>`로 서버가 합성하므로 영어 철자가 브라우저로 전달되지 않습니다.
- **정합성**: 주간 횟수, 자녀별 진행 중 시험 1건, 출제 대상 선정(등록 다음 날·미출제·최소 개수), 제출 확정, 채점 정정, 초대코드 사용은 모두 Postgres 함수 안에서 단일 트랜잭션 + advisory lock / 행 잠금으로 처리합니다(`supabase/migrations`). 동시 제출이나 동시 시작에도 안전합니다.
- **감사 추적**: 문항에 출제 시점 스냅샷(term/meaning), 자동 채점 원본(`auto_correct`), 정정자(`overridden_by`)와 시각을 남깁니다. 단어를 나중에 고쳐도 과거 결과는 바뀌지 않습니다.
- **시간대**: 모든 주/일 경계는 KST 기준입니다(`kst_week_start()`, `src/lib/domain/week.ts`).

## 배포 (최초 1회)

### 1. Supabase

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다(Region: Northeast Asia (Seoul) 권장).
2. **SQL Editor**에서 `supabase/migrations/` 의 SQL 파일을 **파일명 순서대로** 모두 실행합니다.
   (Supabase CLI를 쓴다면 `npx supabase link --project-ref <ref>` 후 `npx supabase db push`)
3. **Authentication → Sign In / Providers → Email**: 활성화합니다. 가족만 쓸 경우 두 부모가 가입한 뒤 **Allow new users to sign up**을 끄는 것을 권장합니다.
4. **Authentication → URL Configuration**: Site URL을 Vercel 도메인(예: `https://voca-xxx.vercel.app`)으로, Redirect URLs에 `https://voca-xxx.vercel.app/auth/callback`을 추가합니다.
5. **Project Settings → API**에서 Project URL, `anon`(publishable) 키, `service_role`(secret) 키를 확인합니다.

### 2. Vercel

1. Vercel에서 이 GitHub 저장소를 Import합니다(Framework: Next.js 자동 인식).
2. Environment Variables를 등록합니다(`.env.example` 참고).

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon / publishable 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role / secret 키. **절대 `NEXT_PUBLIC_` 접두어 금지** |
| `APP_SECRET` | ✅ | 부모 모드 쿠키 서명용 32자 이상 랜덤값 (`openssl rand -base64 32`) |
| `GEMINI_API_KEY` | 권장 | 교재 사진 단어 인식(Gemini, **무료 등급 사용 가능**, [Google AI Studio](https://aistudio.google.com/apikey)에서 발급). 설정 시 최우선 사용 |
| `GEMINI_MODEL` | 선택 | 기본 `gemini-3.5-flash-lite` (못 찾으면 다른 Flash 모델로 자동 재시도) |
| `ANTHROPIC_API_KEY` | 선택 | Gemini 키가 없을 때 Claude Vision 사용. 둘 다 없으면 브라우저 OCR(사전형 교재는 인식 불가) |
| `GOOGLE_TTS_API_KEY` | 선택 | 시험 발음 품질·안정성 향상(Google Cloud TTS). 없으면 비공식 Google Translate TTS 사용 |

3. Deploy합니다.

### 3. 처음 사용

1. 사이트 접속 → 부모 한 명이 **회원가입** → 메일 인증 → 로그인합니다.
2. **새 가족 만들기**(가족 이름, 호칭) → **설정**에서 **부모 PIN을 먼저 설정**합니다.
3. **자녀 추가**(두 아이) → 설정 → **배우자 초대코드 만들기** → 배우자가 회원가입 후 코드를 입력합니다.
4. 자녀를 선택해 **단어 등록**(사진/직접 입력) → 다음 날부터 50개 이상이면 시험을 볼 수 있습니다.
5. 설정 → 자녀별 설정에서 **자녀 로그인 계정**(아이디/비밀번호)을 만들어 주면 아이가 혼자 로그인합니다. 로그인 화면에 아이디만 입력하면 됩니다.
6. 자녀 계정 없이 쓸 때는 아이 기기에서 부모 계정으로 로그인한 뒤 자녀를 선택하고 상단의 🔓 배지를 눌러 **부모 모드를 잠가** 두세요.

## 로컬 개발

```bash
npm install
cp .env.example .env.local      # 값 채우기
npm run dev                     # http://localhost:3000

# 로컬 Supabase (Docker 필요)
npx supabase start              # 마이그레이션 자동 적용, 출력된 URL/키를 .env.local 에
```

품질 검사:

```bash
npm run typecheck
npm run lint
npm test        # 도메인 단위 테스트 + 마이그레이션 SQL을 PGlite(실제 Postgres)에 적용한 규칙 테스트
npm run build
```

## 디렉터리

```
supabase/migrations/   스키마·RLS·트랜잭션 함수 (출제/채점/횟수 규칙의 원천)
src/proxy.ts           세션 갱신 + 비로그인 리다이렉트 (Next 16의 middleware)
src/app/actions.ts     Server Actions (입력 검증 → 인가 → repo)
src/app/(app)/         로그인 후 화면 (홈, 단어, 시험, 기록, 설정, 프로필)
src/app/api/tts        발음 합성 (문항 id 기반)
src/app/api/ocr        사진 → 단어 목록 (src/lib/server/ocr: Gemini / Claude)
src/lib/domain/        순수 도메인 로직 (채점, 주차, 파싱, PIN/토큰, 초대코드, 자녀 아이디)
src/lib/server/        서버 전용 (인증 컨텍스트, 부모 모드, repo)
tests/                 vitest
e2e/                   Playwright E2E (e2e/README.md)
docs/                  아키텍처·운영·이력 문서
```

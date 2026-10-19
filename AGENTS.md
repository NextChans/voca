# AGENTS.md — AI 작업자용 안내

이 저장소에서 작업하는 AI 에이전트(Claude Code, Codex, Cursor, Gemini CLI 등)를 위한 지침입니다.
처음 들어왔다면 이 파일 → `docs/ARCHITECTURE.md` → `docs/HISTORY.md` 순서로 읽으세요.

## 프로젝트 한 줄 요약

가족용 **영어 단어 성취도 평가** 웹앱. 부모(각자 이메일 계정)와 자녀(최대 4명, 자녀 전용 아이디 또는 프로필 선택)가
단어를 등록하고, 자녀가 정기 시험(기본 **주 2회**, 등록 다음 날부터, 미출제 단어 전부, 최소 50개 — 자녀별 설정)과 무제한 재시험을 봅니다.
일반 무료 공개 준비(처리방침·동의·탈퇴·한도·보안 점검)까지 완료. 남은 일과 보류 항목은 `docs/HISTORY.md` "현재 상태".

- 운영: https://voca-pink.vercel.app (Vercel 함수 리전 `syd1` — DB가 시드니라 같은 리전에 둠)
- DB/Auth: Supabase 프로젝트 `juyduseodcrqfinsnqll` (키는 Vercel 환경변수에만 존재)
- 사용자(소유자)는 한국어로 소통하며, 시니어 개발자입니다. 기초 설명은 생략하고 결정은 권장안으로 진행하되, 사람 손이 꼭 필요한 일(키 발급, SQL 실행, 대시보드 설정)만 마지막에 정리해 전달합니다.

## 명령어

```bash
npm install
npm run dev          # http://localhost:3000 (.env.local 필요, .env.example 참고)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint, 경고 0개 기준
npm test             # vitest: 도메인 단위 테스트 + 마이그레이션 SQL을 PGlite에 적용한 DB 규칙 테스트
npm run build        # next build (CI와 동일)
```

PR 전에는 위 네 가지(typecheck/lint/test/build)를 모두 통과시키세요. CI(`.github/workflows/ci.yml`)도 같은 순서로 돌립니다.
UI 흐름을 바꿨다면 `e2e/README.md`의 Playwright E2E도 돌리세요.

## 반드시 지킬 규칙 (깨면 보안·정합성 사고)

1. **브라우저에서 DB를 직접 읽고 쓰지 않는다.** 모든 테이블은 RLS 활성 + 정책 없음 + `anon/authenticated` 권한 회수 상태입니다.
   데이터 접근은 서버(`src/lib/server/repo.ts`, service_role)에서만 하고, **모든 쿼리에 `family_id` 조건**을 겁니다.
   새 테이블을 만들면 같은 패턴(RLS enable + revoke)을 반드시 적용하세요.
2. **인가는 서버 액션/라우트 안에서 다시 확인한다.** `requireMember()` / `requireLearner()` / `requireParent()`(`src/lib/server/context.ts`, `parent.ts`).
   `src/proxy.ts`(Next 16의 middleware)는 세션 갱신과 낙관적 리다이렉트용일 뿐 인가 수단이 아닙니다.
3. **시험 중 정답을 브라우저로 보내지 않는다.** 응시 화면은 `getTestQuestions()`(정답 없음)만 사용. 철자 문항 발음은 `/api/tts?item=<문항id>`로 서버가 합성.
4. **출제·횟수·제출·정정 규칙은 DB 함수가 원천.** `create_test`, `submit_test`, `override_item` 등(`supabase/migrations`)을 우회하는 직접 INSERT/UPDATE를 추가하지 마세요.
   규칙을 바꾸면 **새 마이그레이션 파일**을 만들고 `tests/db.test.ts`에 케이스를 추가합니다. 기존 마이그레이션 파일은 이미 운영에 적용됐으니 수정 금지.
5. **채점은 서버에서만.** `src/lib/domain/grading.ts`의 순수 함수를 `submitTestAction`에서 호출합니다.
6. **시간 경계는 KST.** 주 시작은 월요일 00:00 KST, "등록 다음 날"도 KST 날짜 기준(`src/lib/domain/week.ts` ↔ SQL `kst_week_start()`). 둘을 항상 같이 바꿀 것.
7. **자녀 계정은 부모 권한을 절대 갖지 않는다.** `isParentMode()`는 `role !== 'parent'`면 무조건 false. DB 트리거가 한 계정이 부모/자녀를 겸하지 못하게 막습니다.
8. **비밀값을 커밋하지 않는다.** `.env*`는 gitignore. `NEXT_PUBLIC_*`에 서버 비밀을 넣지 말 것.
9. **부모는 현재 버전 약관 동의가 있어야 이용 가능.** `requireMember()`가 `family_members.consent_version !== LEGAL_VERSION`이면 `/consent`로 보낸다. 처리방침·약관 문구를 바꾸면 `src/lib/legal.ts`의 `LEGAL_VERSION`을 올려 재동의를 받는다. 동의 이력은 `user_consents`(감사 추적), 기록은 DB 함수 `record_consent`로만.
10. **탈퇴·삭제는 DB 함수가 원천.** `delete_parent_account`(마지막 부모면 가족 전체), 자녀 로그인 계정은 앱이 Auth Admin API로 삭제. 새 테이블을 만들면 가족 삭제 시 cascade 되는지 반드시 확인.

## 코드 지도

```
supabase/migrations/        스키마·RLS·트랜잭션 함수 (적용 순서 = 파일명 순서)
src/proxy.ts                세션 쿠키 갱신 + 비로그인 리다이렉트
src/app/actions.ts          모든 Server Action (zod 검증 → 인가 → repo)
src/app/(app)/              로그인 후 화면: 홈, words, test, practice, results, settings, profiles
src/app/login, onboarding   로그인(이메일 또는 자녀 아이디) / 가족 생성·합류(필수 동의 포함)
src/app/consent             약관 재동의 (기존 가입자·문서 개정)
src/app/privacy, terms      개인정보 처리방침·이용약관 (공개, 상수는 src/lib/legal.ts)
src/app/auth/forgot, reset  부모 비밀번호 재설정
src/app/api/tts             발음 합성 (문항 id 또는 텍스트)
src/app/api/ocr             사진 → 단어 목록 (src/lib/server/ocr: Gemini → Claude 순)
src/lib/domain/             순수 로직 (채점, 주차, 텍스트 파싱, PIN/토큰, 초대코드, 자녀 아이디)
src/lib/server/             서버 전용 (auth, context, parent, repo, env, ocr)
src/lib/supabase/           browser(로그인 전용) / server(쿠키 세션) / admin(service_role)
tests/                      vitest (db.test.ts 는 PGlite로 실제 SQL 실행)
e2e/                        Playwright E2E (로컬 Supabase + next start)
docs/                       ARCHITECTURE / OPERATIONS / HISTORY
```

## 작업 관례

- Next.js 16: `params`/`searchParams`/`cookies()`는 Promise. middleware 대신 `src/proxy.ts`. 문서는 `node_modules/next/dist/docs`에 있습니다.
- Tailwind v4: 공용 클래스는 `globals.css`의 `@utility`(`btn-primary`, `card`, `input` 등). `@layer components`에 만들면 `@apply`가 안 됩니다.
- UI 문구는 아이가 읽는다는 전제로 쉬운 한국어. 오류는 `DomainError`/`ParentLockedError`로 던지면 액션의 `run()`이 사용자 메시지로 바꿉니다.
- 커밋 메시지는 한국어 conventional 스타일(`feat:`, `fix(ocr):` …). 브랜치 → PR → CI 통과 → squash merge.
- DB 마이그레이션이 포함된 PR은 **운영 DB에 SQL을 먼저 실행한 뒤 병합**해야 합니다(병합 즉시 Vercel이 배포함). 사용자에게 SQL 실행을 요청하고 확인 후 병합하세요.
- **서버 액션 후 `router.refresh()` 금지.** 액션이 `revalidatePath`를 부르면 응답에 갱신된 화면이 이미 담겨 온다. refresh는 서버 렌더를 한 번 더 돌릴 뿐이다.
- **상태를 바꾸는 서버 액션은 `revalidatePath('/', 'layout')` 필수** (redirect 하는 액션 포함). `next.config.ts`의 `staleTimes.dynamic`(10초) 때문에 빠뜨리면 이전 화면 캐시가 재사용된다. `tests/actionsRevalidate.test.ts`가 검사한다.
- 인증 확인은 `src/proxy.ts`에서 `getClaims()`(JWT 로컬 검증, ES256), 페이지·액션의 `requireUser()`에서 `getUser()`(Auth 서버, 요청당 1회). proxy에 `getUser()`를 다시 넣지 말 것(탭 프리페치마다 Auth 왕복 발생).
- **리다이렉트 대상은 `safeInternalPath()`로만** (`src/lib/domain/safePath.ts`). `startsWith('/')` 문자열 검사는 `/\t/evil.com` 같은 우회에 뚫린다.
- 외부 유료 API 호출은 `consume_quota` 로 먼저 차감하고, **공급자가 처리하지 않은 실패만** 환불(`OcrError.refundable`). 거부·토큰 초과 등은 환불 금지(일부러 일으켜 한도 우회 가능).
- 부모 PIN 확인은 `verifyParentPin()`만 사용 (확인 전에 시도 차감, 지수 잠금). 새 SQL 함수는 `security definer` 쓰지 말고(service_role 로만 호출) 마이그레이션은 `begin; … commit;`.
- 운영 상태 점검·장애 대응은 `docs/OPERATIONS.md`.

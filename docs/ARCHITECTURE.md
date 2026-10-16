# 아키텍처

## 1. 구성

```
브라우저 (React 19, Next.js 16 App Router)
   │  ① Supabase Auth 만 직접 호출 (로그인/로그아웃, 세션 쿠키)
   │  ② 나머지는 전부 Next.js 서버로: Server Components / Server Actions / Route Handlers
   ▼
Next.js 서버 (Vercel, icn1)  ── BFF
   │  requireUser → getMembership(역할·family_id) → repo.* (service_role, family_id 필수)
   ▼
Supabase Postgres  ── 테이블은 RLS 활성 + 정책 없음 + anon/authenticated 권한 회수
   └ 규칙성 로직은 plpgsql 함수(트랜잭션·잠금)로: create_test / submit_test / override_item / ...
외부 API: Gemini 또는 Claude(사진 → 단어), Google TTS(발음)
```

**왜 BFF인가**: 시험 정답(문항 스냅샷)이 응시 중 브라우저로 새면 안 되고, 주간 횟수·출제 규칙을 클라이언트가 우회하면 안 되기 때문입니다.
RLS 정책을 테이블별로 세밀하게 짜는 대신 브라우저 롤의 접근을 전부 막고, 서버에서 검증된 `family_id`로 범위를 강제합니다.

## 2. 사용자·역할

| 역할 | 정체 | 할 수 있는 것 |
| --- | --- | --- |
| 부모 | Supabase Auth 이메일 사용자 + `family_members` 행 | 전부. 단, 관리 기능은 **부모 모드**(가족 공용 PIN 잠금 해제) 상태에서만 |
| 자녀 계정 | Supabase Auth 사용자(가상 이메일 `<아이디>@kids.voca.invalid`) + `learners.user_id` 연결 | 본인 프로필 고정. 단어 **추가**, 시험, 기록 보기. 부모 모드 불가 |
| 자녀 프로필(계정 없이) | 부모 계정으로 로그인한 기기에서 `voca_learner` 쿠키로 선택 | 부모 모드가 잠겨 있으면 자녀 계정과 같은 권한 |

- 역할 판정: `repo.getMembership(userId)` → `family_members`에 있으면 `parent`, `learners.user_id`에 있으면 `child`.
- DB 트리거 `ensure_single_role`이 한 Auth 사용자가 부모·자녀를 겸하지 못하게 막습니다.
- **부모 모드**: `families.parent_pin_hash`(scrypt). 잠금 해제 시 `voca_parent` 쿠키(HMAC-SHA256, `APP_SECRET`, 부모 user id에 바인딩, 30분).
  PIN 5회 연속 실패 시 5분 잠금(`record_pin_attempt`). PIN이 아직 없으면 부모 계정은 부모 모드로 간주(설정 유도 배지 표시).
- **가족 합류**: 부모가 초대코드 생성(8자, 72시간, 1회용, DB에는 sha256만) → 배우자가 가입 후 `join_family`.
- **자녀 계정**: 부모가 설정에서 생성(`auth.admin.createUser`, `email_confirm: true`) → `learners.user_id/login_id` 연결. 연결 실패 시 Auth 사용자 삭제(보상 처리). 로그인 화면은 입력에 `@`가 없으면 아이디로 보고 가상 이메일로 변환(`src/lib/domain/kidLogin.ts`).

## 3. 데이터 모델 (`supabase/migrations`)

| 테이블 | 핵심 컬럼 | 비고 |
| --- | --- | --- |
| `families` | name, parent_pin_hash, pin_failed_count, pin_locked_until | 테넌트 |
| `family_members` | family_id, user_id(unique), display_name | 부모 |
| `family_invites` | code_hash(unique), expires_at, used_by/used_at | 1회용 |
| `learners` | family_id, name, avatar, weekly_limit(2), min_test_words(50), user_id, login_id | 자녀 |
| `words` | family_id, learner_id, term, meaning, created_by, created_at | (learner_id, lower(term)) unique |
| `tests` | learner_id, kind(regular/retest), mode(spelling/meaning/mixed), parent_test_id, status(in_progress/submitted/cancelled), week_start, total, correct | 자녀별 진행 중 1건(partial unique index) |
| `test_items` | test_id, word_id, seq, direction, **term/meaning 스냅샷**, answer, is_correct, auto_correct, overridden_by/at | 감사 추적 |
| `word_stats` (view) | word_id별 attempts, wrong_count | 제출된 시험만 |

## 4. 핵심 규칙과 위치

| 규칙 | 구현 |
| --- | --- |
| 정기 시험 출제 대상 = 등록일(KST) 다음 날부터 + 비취소 정기 시험에 나온 적 없는 단어 전부, 오래된 순 최대 300 | SQL `create_test` |
| 출제 대상 < `min_test_words`(기본 50) → `NOT_ENOUGH_WORDS` | SQL `create_test` |
| 주간 정기 시험 ≤ `weekly_limit`(기본 2), 주 = KST 월요일 시작, 취소분 제외 | SQL `create_test`, `kst_week_start()` |
| 자녀별 진행 중 시험 1건, 동시 시작 직렬화 | partial unique index + `pg_advisory_xact_lock` |
| 재시험 = 제출된 시험의 오답 문항만(방향 유지), 횟수 미포함, 연쇄 가능 | SQL `create_test(kind='retest')` |
| 제출은 전 문항이 정확히 1번씩 채점돼야 확정, 중복 제출 거부 | SQL `submit_test` (행 잠금) |
| 채점: 철자 = 대소문자·공백·둥근따옴표 무시, `a / b` 변형 허용. 뜻 = `, ; / ·` 로 나눈 후보 중 일치, 괄호·공백·문장부호 무시, 여러 개 쓰면 전부 맞아야 정답 | `src/lib/domain/grading.ts` |
| 부모 정답 인정/취소 → 점수 재계산 + 정정자 기록 | SQL `override_item` |
| 시험 취소 = 부모 모드만, 취소분은 횟수·출제 이력에서 제외 | `cancelTestAction` |
| 오답 연습 = 제출된 시험 문항 결과(정정 반영)에서 한 번이라도 틀린 단어. 클라이언트에서 채점·반복, 서버에 아무것도 기록하지 않음 | `buildPracticeWords`(`src/lib/domain/practice.ts`), `/practice` |
| 단어 추가 = 누구나(자녀 포함), 수정·삭제 = 부모 모드 | `addWordsAction` / `updateWordAction` / `deleteWordAction` |

## 5. 요청 흐름 예시: 시험

1. `/test/new` → `startTestAction(mode)` → `repo.createTest` → SQL `create_test`가 대상 선정·검증·문항 스냅샷 생성 → `/test/[id]`로 이동.
2. `/test/[id]` 서버 컴포넌트가 `getTestQuestions()`(문제 텍스트만)를 `TestRunner`에 전달. 답안은 `localStorage(voca:test:<id>)`에 임시 저장.
3. 철자 문항 🔊 → `/api/tts?item=<문항id>` → 서버가 문항의 철자를 조회해 음성 합성(정답 비노출). 그 외는 기기 `speechSynthesis`.
4. 제출 → `submitTestAction(id, answers)` → 서버에서 `gradeItem` → SQL `submit_test` → `/results/[id]`.

## 6. 사진 → 단어 (OCR)

- 클라이언트(`PhotoPanel`, `CameraCapture`): `getUserMedia` 카메라(미지원 시 파일 선택) → 긴 변 1600px JPEG로 축소 → `/api/ocr`.
- 서버(`src/lib/server/ocr`): `GEMINI_API_KEY` 있으면 Gemini(`@google/genai` `generateContent` + `responseJsonSchema`, 기본 `gemini-3.5-flash-lite`,
  404 → 대체 모델, 스키마 거부 → 스키마 없이 재시도), 없으면 `ANTHROPIC_API_KEY`로 Claude(`claude-opus-5-5`, 구조화 출력), 둘 다 없으면 501 → 브라우저 Tesseract.
- 프롬프트(`ocr/prompt.ts`)는 **사전형 교재**(번호 + 굵은 표제어 + 발음기호 + 품사 기호 뜻 + 예문/해석 + 반의어·파생어, 2단) 기준으로 표제어와 대표 뜻만 추출하도록 작성됨.
- 결과는 항상 편집 가능한 표로 보여주고 사람이 확인 후 저장. 사진은 저장하지 않음.
- 브라우저 Tesseract는 "단어 뜻" 한 줄 목록만 현실적으로 처리 가능(`src/lib/domain/wordParse.ts`).

## 7. 보안 헤더 / 기타

- `next.config.ts`: CSP(`connect-src`는 `NEXT_PUBLIC_SUPABASE_URL` 출처 + jsDelivr), X-Frame-Options DENY, Permissions-Policy(camera=self).
- `/api/tts`, `/api/ocr`: `sec-fetch-site` 교차 사이트 차단 + 로그인·가족 소속 확인.
- PWA: `src/app/manifest.ts`, 아이콘 `src/app/icon.svg`(path만 사용) / `apple-icon.png` / `public/icon-*.png`.

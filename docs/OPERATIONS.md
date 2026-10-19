# 운영 가이드

## 현재 운영 환경

| 항목 | 값 |
| --- | --- |
| 서비스 URL | https://voca-pink.vercel.app |
| 호스팅 | Vercel (GitHub `NextChans/voca` main 브랜치 자동 배포, `vercel.json`: framework nextjs, region **syd1** (2026-10-19, DB와 같은 시드니로 이동. 이전 icn1)) |
| DB/Auth | Supabase 프로젝트 ref `juyduseodcrqfinsnqll` (`https://juyduseodcrqfinsnqll.supabase.co`), 리전 **ap-southeast-2 (시드니)**. 앱 서버도 syd1에 둬서 서버↔DB 왕복을 수 ms로 유지 (함수 리전을 옮기면 쿼리마다 대륙 간 왕복이 붙음) |
| 사진 인식 | Gemini (`GEMINI_API_KEY`). Google Cloud 프로젝트에 결제 연결됨(2026-10-18) → 유료 등급(사진이 Google 학습에 쓰이지 않음, 소액 과금) |
| 발음 | Google Cloud TTS (`GOOGLE_TTS_API_KEY`, 음성 `en-US-Neural2-F`), 운영 적용 확인(2026-10-18). Cloud 프로젝트 할당량 All requests per minute = 60 |
| CI | GitHub Actions `.github/workflows/ci.yml` (PR·main push: typecheck → lint → test → build) |

> 키 값은 Vercel 환경변수에만 있습니다. 문서·코드·채팅에 비밀 키를 남기지 마세요.

## 환경변수 (Vercel → Settings → Environment Variables)

| 이름 | 유형 | 필수 | 설명 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Config | ✅ | 빌드 시 번들에 인라인 → 변경 후 반드시 Redeploy |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | ✅ | `sb_publishable_…` (공개 키, 테이블 접근은 DB에서 차단됨) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | ✅ | `sb_secret_…`. 서버 전용 |
| `APP_SECRET` | Secret | ✅ | 32자 이상. 부모 모드 쿠키 서명. 바꾸면 열려 있던 부모 모드만 잠김 |
| `GEMINI_API_KEY` | Secret | 권장 | Google AI Studio 발급. 무료 등급은 입력 데이터가 Google 서비스 개선에 쓰일 수 있음 |
| `GEMINI_MODEL` | Config | 선택 | 기본 `gemini-3.5-flash-lite` |
| `ANTHROPIC_API_KEY` | Secret | 선택 | Gemini 키가 없을 때만 사용 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Config | 선택 | Cloudflare Turnstile 사이트 키. 설정하면 로그인·가입·비밀번호 재설정·탈퇴에 사람 확인 위젯. **Supabase CAPTCHA보다 먼저** 넣고 Redeploy |
| `GOOGLE_TTS_API_KEY` | Secret | 권장(설정됨) | Cloud Text-to-Speech API로만 제한한 키. 실패 시 `[api/tts] synthesis failed` 로그 + 502. 없으면 서버 합성 불가(503) → 기기 음성만 |

Production·Preview 모두 체크. 환경변수 변경은 **Redeploy** 해야 반영됩니다.

## Supabase 설정 체크리스트

- Authentication → URL Configuration: Site URL `https://voca-pink.vercel.app`, Redirect URLs `https://voca-pink.vercel.app/auth/callback**` (비밀번호 재설정이 `?next=/auth/reset` 쿼리를 붙이므로 와일드카드)
- Authentication → Emails → Reset Password 템플릿: 한국어로 바꾸면 좋음
- Authentication → Sign In / Providers → Email: 활성. 부모 둘 다 가입 후 **Allow new users to sign up 끄기** 권장
  (자녀 계정은 서버 admin API로 만들므로 가입 차단과 무관)
- Data API(PostgREST): 켜져 있어야 함(서버가 supabase-js로 사용). Exposed schemas에 `public`
- Project Settings → JWT Keys: Current 키가 **ECC (P-256, ES256)** 여야 함(2026-10-18 확인). proxy의 `getClaims()`가 이 공개키로 로컬 검증한다. 대칭키(HS256)로 바꾸면 기능은 그대로지만 매 요청 Auth 서버 왕복으로 느려진다. 키 회전 시 JWKS는 인스턴스별 메모리에 캐시되므로 이전 키를 잠시 Standby로 남길 것
- Authentication → Providers → Email: **Secure password change** 켜기 (비밀번호 변경 시 재인증)
- 기본 메일 발송은 제한적(시간당 소량). 인증 메일이 안 오면 Authentication → Users → Add user(Auto Confirm)로 생성 가능

## 배포 절차

1. 브랜치에서 작업 → PR → CI 통과 확인 → squash merge → Vercel이 main을 자동 배포.
2. **DB 마이그레이션이 포함된 경우**: 병합 **전에** 운영 DB에 새 SQL 파일을 실행.
   - Supabase 대시보드 → SQL Editor에 `supabase/migrations/<새 파일>.sql` 전체 붙여넣고 Run
   - 또는 로컬에서 `npx supabase link --project-ref juyduseodcrqfinsnqll && npx supabase db push`
   - 확인: 공개 키로 `GET /rest/v1/<table>?select=<새컬럼>` 시 `42703`(컬럼 없음)이 아니라 `42501`(권한 없음)이면 적용된 것
3. 운영 적용 완료(2026-10-16): `20261016000000_init.sql`, `20261017000000_learner_login.sql`, `20261018000000_backfill_word_order.sql`(데이터 보정, 재실행 안전).
   운영 적용 완료(2026-10-19): `20261019000000_consent_and_account_deletion.sql` (PR #16).
   운영 적용 완료(2026-10-19): `20261020000000_quotas_and_caps.sql` (PR #17, 한 트랜잭션, 기존 데이터 변경 없음).
   공개 전 점검: 아래 쿼리 결과가 `kst_week_start` 하나뿐이어야 함 (브라우저 롤이 실행 가능한 함수)
   `select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');`
   새 마이그레이션을 추가하면 이 목록에 적용 여부를 갱신하세요.

## CAPTCHA (Cloudflare Turnstile) 켜기 — 순서 중요

1. Cloudflare → Turnstile → Add widget: 호스트 `voca-pink.vercel.app`, Mode Managed. Site Key / Secret Key 확보
2. Vercel `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = Site Key (Production) → **Redeploy** → /login 에 위젯 보이는지 확인
3. 그다음 Supabase → Authentication → Attack Protection → CAPTCHA 켜기(Turnstile, Secret Key)
4. 부모 로그인·아이 아이디 로그인·가입·비밀번호 재설정·탈퇴 확인

순서를 거꾸로 하면 모든 로그인이 실패한다. 되돌릴 때는 Supabase CAPTCHA 먼저 끄고 변수 제거.
Preview 배포(`*.vercel.app` 다른 호스트)는 위젯 호스트에 없으면 로그인 불가 → Preview 는 위젯 호스트 추가 또는 사용 안 함.

## 사용 한도 (src/lib/limits.ts ↔ DB)

| 한도 | 값 | 위치 |
| --- | --- | --- |
| 사진 인식 | 가족당 하루 10회 (KST 자정 초기화, 실패 시 환불) | `consume_quota('ocr')`, `/api/ocr` 429 |
| 서버 발음 합성 | 가족당 하루 500회 | `consume_quota('tts')`, `/api/tts` 429 |
| 자녀 프로필 | 가족당 4명 | 트리거 `enforce_learner_cap` |
| 단어 | 자녀당 5,000개 | 트리거 `enforce_word_cap` (동시 입력 시 소폭 초과 가능한 소프트 상한) |

특정 가족 한도 조회: `select * from usage_counters where family_id = '<id>' order by day desc;`

## 빠른 점검

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://voca-pink.vercel.app/login          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://voca-pink.vercel.app/api/ocr        # 401 (비로그인 차단)
# 브라우저 롤 차단 확인 (publishable 키 사용, 42501 이어야 정상)
curl -s "https://juyduseodcrqfinsnqll.supabase.co/rest/v1/words?select=id&limit=1" -H "apikey: <publishable key>"
```

## 자주 나는 문제

| 증상 | 원인 / 조치 |
| --- | --- |
| Vercel 빌드 후 `No Output Directory named "public"` | Framework Preset이 Other로 잡힘. `vercel.json`의 `"framework": "nextjs"`가 해결(이미 반영) |
| 로그인 시 "인터넷 연결을 확인해 주세요" | CSP `connect-src`가 Supabase 출처를 막음. `NEXT_PUBLIC_SUPABASE_URL` 확인 후 Redeploy |
| Supabase REST가 `PGRST002`(schema cache) | Data API 꺼짐/프로젝트 준비 중. Data API 활성화, `notify pgrst, 'reload schema';` 실행 |
| 인증 메일 미수신 | 기본 SMTP 제한. 대시보드에서 Add user(Auto Confirm) 또는 커스텀 SMTP 설정 |
| 인증 링크가 localhost로 열림 | Supabase Site URL 미설정 |
| 사진 인식 "사진 인식 서버에 문제가 있어요 (Gemini NNN)" | 400/403: 키 확인. 404: 모델명(`GEMINI_MODEL`) 확인. 429: 무료 한도 초과. Vercel Logs에서 `[ocr/gemini]` 검색 |
| 사진 탭에 "기기 내 글자 인식만 켜져 있어요" 경고 | `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` 미설정 또는 Redeploy 안 함 |
| 자녀가 시험 시작 불가 | 홈/시험 화면에 이유 표시: 주간 횟수 소진, 출제 대상 < 50, 진행 중 시험 존재(부모가 설정에서 취소 가능) |
| 부모 PIN 분실 | SQL Editor: `update families set parent_pin_hash = null where id = '<family id>';` → 앱 설정에서 새 PIN 설정 |
| 발음 버튼 ⚠️ / `/api/tts` 502 | Vercel Logs `[api/tts]` 확인. 403: TTS API 사용 설정·키 제한, 429: Cloud 할당량(분당 60), 400: 음성 이름 |
| 부모 비밀번호 분실 | 로그인 → '비밀번호를 잊었어요' → 메일 링크를 **같은 브라우저**에서 열기 → `/auth/reset` |
| 탈퇴 후 Auth 사용자가 남음 | Vercel Logs `[repo] deleteParentAccount auth delete failed` / `deleteLearner auth delete failed` 의 userId 를 Authentication → Users 에서 삭제 (데이터는 이미 삭제됨) |
| 자녀 비밀번호 분실 | 부모 모드 → 설정 → 자녀별 설정 → 비밀번호 바꾸기 |

## 로컬 개발 / 검증

```bash
cp .env.example .env.local
npx supabase start            # Docker 필요. 마이그레이션 자동 적용, 출력된 URL/키를 .env.local 에
npm run dev
npx supabase db reset         # 로컬 DB 초기화(마이그레이션 재적용)
```

E2E는 `e2e/README.md` 참고.

## 데이터 백업

Supabase 무료 플랜은 자동 백업 보존이 짧습니다. 중요하면 주기적으로
`npx supabase db dump --data-only -f backup.sql` (link 후) 또는 대시보드 Database → Backups 확인.

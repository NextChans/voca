# 운영 가이드

## 현재 운영 환경

| 항목 | 값 |
| --- | --- |
| 서비스 URL | https://voca-pink.vercel.app |
| 호스팅 | Vercel (GitHub `NextChans/voca` main 브랜치 자동 배포, `vercel.json`: framework nextjs, region icn1) |
| DB/Auth | Supabase 프로젝트 ref `juyduseodcrqfinsnqll` (`https://juyduseodcrqfinsnqll.supabase.co`) |
| 사진 인식 | Gemini (`GEMINI_API_KEY`, 무료 등급) |
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
| `GOOGLE_TTS_API_KEY` | Secret | 선택 | 없으면 비공식 Google Translate TTS 폴백 |

Production·Preview 모두 체크. 환경변수 변경은 **Redeploy** 해야 반영됩니다.

## Supabase 설정 체크리스트

- Authentication → URL Configuration: Site URL `https://voca-pink.vercel.app`, Redirect URLs `https://voca-pink.vercel.app/auth/callback`
- Authentication → Sign In / Providers → Email: 활성. 부모 둘 다 가입 후 **Allow new users to sign up 끄기** 권장
  (자녀 계정은 서버 admin API로 만들므로 가입 차단과 무관)
- Data API(PostgREST): 켜져 있어야 함(서버가 supabase-js로 사용). Exposed schemas에 `public`
- 기본 메일 발송은 제한적(시간당 소량). 인증 메일이 안 오면 Authentication → Users → Add user(Auto Confirm)로 생성 가능

## 배포 절차

1. 브랜치에서 작업 → PR → CI 통과 확인 → squash merge → Vercel이 main을 자동 배포.
2. **DB 마이그레이션이 포함된 경우**: 병합 **전에** 운영 DB에 새 SQL 파일을 실행.
   - Supabase 대시보드 → SQL Editor에 `supabase/migrations/<새 파일>.sql` 전체 붙여넣고 Run
   - 또는 로컬에서 `npx supabase link --project-ref juyduseodcrqfinsnqll && npx supabase db push`
   - 확인: 공개 키로 `GET /rest/v1/<table>?select=<새컬럼>` 시 `42703`(컬럼 없음)이 아니라 `42501`(권한 없음)이면 적용된 것
3. 적용된 마이그레이션: `20261016000000_init.sql`, `20261017000000_learner_login.sql` (운영 적용 완료), `20261018000000_backfill_word_order.sql`(데이터 보정, 재실행 안전 — 운영 실행 여부는 HISTORY 참고)

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

# E2E (Playwright)

로컬 Supabase + 프로덕션 빌드(`next start`)를 대상으로 실제 브라우저 흐름을 검증합니다.

| 스크립트 | 검증 내용 |
| --- | --- |
| `full-flow.mjs` | 비로그인 루트 → 소개(`/welcome`) → 로그인 → 필수 동의(미체크 시 차단·기록 확인) → 가족 생성 → 자녀 2명 → PIN → 배우자 초대 합류 → 단어 52개 붙여넣기 → 당일 시험 불가 → (DB로 등록일을 어제로) 시험 응시 → **정답 HTML 비노출** → 채점 → 부모 정정(정정자 기록) → 오답 연습(카드 완주·뜻 쓰기 채점) → 새 단어 연습(오늘 등록 범위 완주) → 단어 여러 개 선택 삭제 → 재시험 → 잠금 상태 권한 → 주 2회 제한 → 자녀 간 데이터 분리 → 재동의 게이트 → 처리방침·약관 비로그인 접근 → 자녀 프로필 삭제 → 회원 탈퇴(다른 부모 있으면 본인만, 마지막 부모면 가족·Auth 전체) |
| `kid-account.mjs` | 자녀 아이디 생성 → 아이디 로그인 → 프로필 전환 불가 → 부모 모드 UI 없음 → 단어 등록 가능/삭제 불가 → 가짜 카메라 촬영 → 비밀번호 재설정 → 자녀 프로필 삭제 시 자녀 계정 로그인 불가 |

## 실행

```bash
npx supabase start                      # Docker 필요
npx supabase status -o env              # 출력된 로컬 URL/키로 .env.local 작성 (APP_SECRET 은 32자 이상 아무 값)
npm run build && npm start &            # http://localhost:3000
npx supabase db reset                   # 스크립트마다 깨끗한 DB에서 시작
node e2e/full-flow.mjs
npx supabase db reset && node e2e/kid-account.mjs
```

- 브라우저: Playwright Chromium. 설치된 Chromium 경로가 따로 있으면 `CHROMIUM_PATH=/path/to/chrome`.
- 대상 URL 변경: `E2E_BASE_URL`.
- 스크립트의 Supabase 키는 **로컬 데모 기본값**입니다(공개값). 운영 키를 넣지 마세요.
- 실패 시 `e2e/shots/`의 스크린샷을 확인하세요(gitignore).
- 로컬에는 `GOOGLE_TTS_API_KEY`가 없어 `/api/tts`가 503을 돌려준다(콘솔 오류로 찍히지만 정상). Vercel Analytics는 Vercel 환경에서만 로드된다.

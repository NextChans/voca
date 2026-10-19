// 로컬 Supabase 데모 키(공개 기본값)만 사용. 운영 키를 넣지 말 것.
// E2E: 로컬 Supabase + next start 대상 전체 흐름 검증
import { chromium } from 'playwright-core';
import pg from 'pg';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const SB = 'http://127.0.0.1:54321';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
await import('node:fs').then((fs) => fs.mkdirSync(SHOTS, { recursive: true }));
const db = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });

async function createUser(email) {
  const res = await fetch(`${SB}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123!', email_confirm: true }),
  });
  if (!res.ok) throw new Error(`createUser ${res.status} ${await res.text()}`);
}

let step = 0;
async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}${String(++step).padStart(2, '0')}-${name}.png`, fullPage: true });
}
function log(...a) {
  console.log('✔', ...a);
}

async function login(page, email) {
  // 비로그인 루트는 소개 페이지 → '무료로 시작하기'로 로그인 화면
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/welcome/);
  await page.getByRole('link', { name: /무료로 시작하기/ }).first().click();
  await page.waitForURL(/\/login/);
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').first().fill('password123!');
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
}

async function main() {
  await db.connect();
  await createUser('dad@test.local');
  await createUser('mom@test.local');

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const dad = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  const errors = [];
  dad.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  dad.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

  // 1. 로그인 → 온보딩 → 가족 생성
  await login(dad, 'dad@test.local');
  await dad.waitForURL(/\/onboarding/);
  await shot(dad, 'onboarding');
  await dad.getByPlaceholder('예: 행복한 우리집').fill('우리집');
  await dad.getByPlaceholder('예: 아빠, 엄마').fill('아빠');
  // 필수 동의 없이 제출 → 브라우저 required 로 막힘 (URL 유지)
  await dad.getByRole('button', { name: /가족 만들기/ }).click();
  await dad.waitForTimeout(500);
  if (!dad.url().includes('/onboarding')) throw new Error('동의 없이 가족 생성됨');
  await dad.getByLabel('모두 동의해요').first().check();
  await dad.getByRole('button', { name: /가족 만들기/ }).click();
  await dad.waitForURL(/\/profiles/);
  const consent = (await db.query(`select version, kinds from public.user_consents`)).rows;
  if (consent.length !== 1 || consent[0].kinds.length !== 4) throw new Error(`동의 기록 이상 ${JSON.stringify(consent)}`);
  log('필수 동의 + 기록', consent[0].version);
  log('가족 생성');

  // 2. 자녀 2명 추가
  for (const name of ['지우', '하준']) {
    await dad.getByPlaceholder('예: 지우').fill(name);
    await dad.getByRole('button', { name: /자녀 추가|추가하기|추가/ }).last().click();
    await dad.getByText(name, { exact: true }).first().waitFor();
  }
  await shot(dad, 'profiles');
  log('자녀 2명 추가');

  // 3. 부모 PIN 설정
  await dad.goto(`${BASE}/settings`);
  await shot(dad, 'settings-nopin');
  await dad.locator('input[name=pin]').last().fill('1234');
  await dad.locator('#confirm_pin').fill('1234');
  await dad.getByRole('button', { name: /PIN.*(저장|설정)|저장/ }).first().click();
  await dad.getByText(/PIN을 저장했어요/).waitFor();
  log('PIN 설정');

  // 4. 초대코드 → 엄마 합류
  await dad.getByRole('button', { name: /초대코드/ }).click();
  const codeEl = dad.getByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/).first();
  await codeEl.waitFor();
  const code = (await codeEl.textContent()).trim();
  await shot(dad, 'invite');
  const momCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mom = await momCtx.newPage();
  await login(mom, 'mom@test.local');
  await mom.waitForURL(/\/onboarding/);
  await mom.getByPlaceholder('ABCD-EFGH').fill(code.toLowerCase());
  await mom.getByPlaceholder('예: 엄마, 아빠').fill('엄마');
  await mom.getByLabel('모두 동의해요').last().check();
  await mom.getByRole('button', { name: /합류/ }).click();
  await mom.waitForURL(/\/profiles/);
  await mom.getByText('하준').first().waitFor();
  log('엄마 초대코드 합류, 같은 자녀 목록 확인', code);

  // 5. 지우 선택 → 단어 50개 붙여넣기 등록
  await dad.goto(`${BASE}/profiles`);
  await dad.getByRole('button', { name: /지우/ }).first().click();
  await dad.waitForURL(`${BASE}/`);
  await dad.goto(`${BASE}/words/new`);
  await dad.getByRole('tab', { name: /붙여넣기/ }).click().catch(() => dad.getByText(/붙여넣기/).first().click());
  const lines = Array.from({ length: 52 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))} - 뜻${i + 1}`);
  lines[0] = 'apple - 사과, 능금';
  lines[1] = 'be good at ~을 잘하다';
  lines[2] = '① happy 행복한';
  await dad.getByLabel('단어 목록 붙여넣기').fill(lines.join('\n'));
  await dad.getByRole('button', { name: /표로 옮기기/ }).click();
  await dad.getByText(/52개/).first().waitFor();
  await shot(dad, 'words-new');
  await dad.getByRole('button', { name: /52개 저장/ }).click();
  await dad.getByText(/52개 저장했어요/).waitFor();
  log('단어 52개 등록');

  // 6. 오늘 등록 → 시험 불가 확인
  await dad.goto(`${BASE}/test/new`);
  await shot(dad, 'test-new-blocked');
  if (await dad.getByRole('button', { name: /시험 시작/ }).count()) throw new Error('오늘 등록한 단어로 시험이 시작 가능함');
  log('등록 당일 시험 불가 확인');

  // 7. 등록일을 어제로 → 시험 시작 (철자/뜻 섞어서)
  await db.query(`update public.words set created_at = created_at - interval '1 day'`);
  await dad.goto(`${BASE}/words`);
  await shot(dad, 'words-list');
  const order = await dad.evaluate(() =>
    [...document.querySelectorAll('[lang="en"]')].map((e) => e.textContent?.trim()).filter(Boolean).slice(0, 4)
  );
  if (order.join('|') !== 'apple|be good at|happy|wordda') throw new Error(`등록 순서와 다름: ${order.join(', ')}`);
  log('단어 목록이 등록한 순서대로 표시', order.join(' → '));
  await dad.goto(`${BASE}/test/new`);
  await dad.getByText(/섞어서/).first().click();
  await dad.getByRole('button', { name: /시험 시작/ }).click();
  await dad.waitForURL(/\/test\/[0-9a-f-]{36}$/);
  const testId = dad.url().split('/').pop();
  log('시험 시작', testId);

  // 응시 화면 HTML 에 정답 철자가 없는지 (spelling 문항)
  const items = (
    await db.query(`select id, direction, term, meaning, seq from public.test_items where test_id = $1 order by seq`, [testId])
  ).rows;
  const html = await dad.content();
  const leaked = items.filter((i) => i.direction === 'spelling' && html.includes(`"${i.term}"`));
  if (leaked.length) throw new Error(`철자 정답 노출: ${leaked.map((i) => i.term).join(',')}`);
  log(`정답 비노출 확인 (spelling ${items.filter((i) => i.direction === 'spelling').length}문항)`);

  // TTS 라우트: 문항 id 로 음성 요청 시 인증 필요 + 동작
  const ttsStatus = await dad.evaluate(async (id) => (await fetch(`/api/tts?item=${id}`)).status, items[0].id);
  log('TTS item status', ttsStatus);

  // 8. 응시: 앞 5문항은 오답, 나머지는 정답 (뜻 문항은 공백 섞어 입력)
  const input = dad.locator('input.input').first();
  await input.waitFor();
  await shot(dad, 'test-q1');
  for (const it of items) {
    let ans = it.direction === 'spelling' ? it.term.toUpperCase() : it.meaning.split(',')[0].split('').join(' ');
    if (it.seq <= 5) ans = 'wrong';
    await input.fill(ans);
    await input.press('Enter');
  }
  await shot(dad, 'test-end');
  // 마지막 문항에서 Enter → 제출 확인 대화상자가 열림
  await dad.getByText('모두 답했어요! 제출할까요?').waitFor();
  await dad.getByRole('button', { name: /^제출하기$/ }).click();
  await dad.waitForURL(/\/results\//, { timeout: 15000 });
  await shot(dad, 'result');
  const t = (await db.query(`select status, correct, total from public.tests where id = $1`, [testId])).rows[0];
  if (t.status !== 'submitted' || t.correct !== t.total - 5) throw new Error(`채점 이상: ${JSON.stringify(t)}`);
  log('제출·채점', `${t.correct}/${t.total}`);

  // 9. 부모 정정: 첫 오답 '정답 인정'
  await dad.getByRole('button', { name: /정답 인정/ }).first().click();
  await dad.waitForTimeout(1500);
  const t2 = (await db.query(`select correct from public.tests where id = $1`, [testId])).rows[0];
  if (t2.correct !== t.correct + 1) throw new Error(`정정 반영 안 됨 ${t2.correct}`);
  const ov = (await db.query(`select overridden_by from public.test_items where test_id = $1 and overridden_by is not null`, [testId])).rows;
  log('부모 정정 반영', t2.correct, 'overridden_by 기록', ov.length);
  await shot(dad, 'result-overridden');

  // 9-1. 오답 연습: 최근 틀린 4개(1개는 부모 정정) → 카드 모드로 끝까지, 뜻 쓰기 1문항 채점
  await dad.goto(`${BASE}/practice`);
  await dad.getByText('마지막 시험에서 틀린 4개').waitFor();
  await dad.getByRole('button', { name: /연습 시작 \(4개\)/ }).click();
  await dad.getByRole('button', { name: /다시 볼래요/ }).click(); // 첫 카드는 뒤로 보내기
  for (let i = 0; i < 4; i++) await dad.getByRole('button', { name: /알아요/ }).click();
  await dad.getByText('연습 끝! 모두 맞혔어요').waitFor();
  await shot(dad, 'practice-done');
  await dad.getByRole('button', { name: '처음으로' }).click();
  await dad.getByRole('button', { name: /뜻 쓰기/ }).click();
  await dad.getByRole('button', { name: /연습 시작/ }).click();
  const prompt = (await dad.locator('.card p.text-3xl').textContent()).trim();
  const meaning = (await db.query(`select meaning from public.words where term = $1`, [prompt])).rows[0].meaning;
  await dad.locator('input.input').fill(meaning.split(',')[0]);
  await dad.getByRole('button', { name: '확인' }).click();
  await dad.getByText('⭕ 정답!').waitFor();
  const testsBefore = (await db.query(`select count(*)::int c from public.tests`)).rows[0].c;
  log('오답 연습: 카드 모드 완주 + 뜻 쓰기 즉시 채점', `(시험 수 ${testsBefore}, 연습은 기록 안 함)`);

  // 9-2. 새 단어 연습: 오늘 등록한 단어만 '오늘 등록' 범위에, 출제된 단어는 제외
  await db.query(
    `insert into public.words (family_id, learner_id, term, meaning)
     select family_id, learner_id, t, '오늘' || t from public.words, unnest(array['todaya','todayb','todayc']) t
      where term = 'apple'`
  );
  await dad.goto(`${BASE}/practice?tab=new`);
  await dad.getByText(/오늘 등록한 단어/).first().waitFor();
  await shot(dad, 'practice-new');
  const newStart = await dad.getByRole('button', { name: /연습 시작 \(\d+개\)/ }).textContent();
  if (!/\(3개\)/.test(newStart)) throw new Error(`새 단어(오늘) 범위 이상: ${newStart}`);
  await dad.getByRole('button', { name: /연습 시작/ }).click();
  for (let i = 0; i < 3; i++) await dad.getByRole('button', { name: /알아요/ }).click();
  await dad.getByText('연습 끝! 모두 맞혔어요').waitFor();
  log('새 단어 연습: 오늘 등록 3개 완주');

  // 9-3. 여러 개 선택 삭제 (부모 모드)
  await dad.goto(`${BASE}/words`);
  await dad.getByRole('button', { name: /여러 개 지우기/ }).click();
  await dad.getByLabel('todaya 선택').check();
  await dad.getByLabel('todayb 선택').check();
  await shot(dad, 'words-multi-select');
  dad.once('dialog', (d) => d.accept());
  await dad.getByRole('button', { name: /2개 지우기/ }).click();
  await dad.getByText('2개 지웠어요.').waitFor();
  const left = (await db.query(`select term from public.words where term like 'today%' order by term`)).rows.map((r) => r.term);
  if (left.join() !== 'todayc') throw new Error(`선택 삭제 이상: ${left.join()}`);
  log('여러 개 선택 삭제', '2개 삭제, 1개 남음');
  await db.query(`delete from public.words where term = 'todayc'`);

  // 10. 재시험 (틀린 4개)
  await dad.goto(`${BASE}/results/${testId}`);
  await dad.getByRole('button', { name: /재시험/ }).first().click();
  await dad.waitForURL(/\/test\/[0-9a-f-]{36}$/);
  const retestId = dad.url().split('/').pop();
  const r = (await db.query(`select kind, total from public.tests where id = $1`, [retestId])).rows[0];
  if (r.kind !== 'retest' || r.total !== 4) throw new Error(`재시험 이상 ${JSON.stringify(r)}`);
  log('재시험 생성', r.total, '문항');

  // 11. 부모 모드 잠금 → 자녀 모드에서는 관리 기능 숨김 + 서버 액션 차단
  await dad.goto(`${BASE}/words`);
  await dad.getByRole('button', { name: /부모 모드/ }).click();
  await dad.waitForTimeout(800);
  await dad.goto(`${BASE}/words/new`);
  await shot(dad, 'words-new-locked');
  await dad.getByRole('tab', { name: /붙여넣기/ }).waitFor();
  await dad.goto(`${BASE}/words`);
  if (await dad.getByRole('button', { name: /삭제/ }).count()) throw new Error('잠금 상태에서 삭제 버튼 노출');
  log('부모 모드 잠금: 단어 등록 가능, 수정·삭제 불가');

  // 12. 같은 주 정기 시험 2회 제한
  await db.query(`update public.tests set status='cancelled' where id = $1`, [retestId]);
  await db.query(
    `insert into public.words (family_id, learner_id, term, meaning, created_at)
     select family_id, learner_id, 'extra' || chr(96 + g) || chr(96 + g), '추가' || g, now() - interval '1 day'
       from public.words, generate_series(1, 26) g where term = 'apple' limit 26`
  );
  await db.query(
    `insert into public.words (family_id, learner_id, term, meaning, created_at)
     select family_id, learner_id, 'more' || chr(96 + g) || chr(97 + g), '더' || g, now() - interval '1 day'
       from public.words, generate_series(1, 25) g where term = 'apple' limit 25`
  );
  await dad.goto(`${BASE}/test/new`);
  await dad.getByRole('button', { name: /시험 시작/ }).click();
  await dad.waitForURL(/\/test\/[0-9a-f-]{36}$/);
  const second = dad.url().split('/').pop();
  await db.query(`update public.tests set status='cancelled' where id = $1`, [second]); // 취소분은 횟수 제외
  await db.query(
    `insert into public.tests (family_id, learner_id, kind, mode, week_start, total, correct, status, submitted_at)
     select family_id, learner_id, 'regular', 'spelling', public.kst_week_start(), 1, 1, 'submitted', now() from public.tests where id = $1`,
    [testId]
  );
  await dad.goto(`${BASE}/test/new`);
  await shot(dad, 'test-new-weekly-limit');
  if (await dad.getByRole('button', { name: /시험 시작/ }).count()) throw new Error('주 2회 초과 시작 가능');
  log('주 2회 제한 확인');

  // 13. 하준(다른 자녀)은 독립: 단어 0개
  await mom.goto(`${BASE}/profiles`);
  await mom.getByRole('button', { name: /하준/ }).first().click();
  await mom.waitForURL(`${BASE}/`);
  await mom.goto(`${BASE}/words`);
  await shot(mom, 'mom-hajun-words');
  if (await mom.getByText('apple').count()) throw new Error('자녀 간 단어 섞임');
  log('자녀별 데이터 분리 확인');

  // 14. 기록 화면
  await dad.goto(`${BASE}/results`);
  await shot(dad, 'results');
  await dad.goto(`${BASE}/`);
  await shot(dad, 'home');

  // 15. 약관 개정/기존 가입자: 동의 버전이 다르면 /consent 로, 동의 후 복귀
  await db.query(`update public.family_members set consent_version = null where display_name = '엄마'`);
  await mom.goto(`${BASE}/words`);
  await mom.waitForURL(/\/consent/);
  await mom.getByLabel('모두 동의해요').check();
  await mom.getByRole('button', { name: /동의하고 계속하기/ }).click();
  await mom.waitForURL(`${BASE}/`);
  log('재동의 게이트');

  // 16. 공개 문서는 로그인 없이 열림
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  for (const path of ['/privacy', '/terms']) {
    await ap.goto(`${BASE}${path}`);
    if (!ap.url().endsWith(path)) throw new Error(`${path} 가 공개되지 않음`);
  }
  await anon.close();
  log('처리방침·약관 공개 접근');

  // 17. 자녀 프로필 삭제 (부모 모드, 이름 재입력)
  const unlock = async (page) => {
    await page.goto(`${BASE}/settings`);
    if (await page.getByText('부모 모드가 켜져 있어요').count()) return;
    await page.locator('input[name=pin]').first().fill('1234');
    await page.getByRole('button', { name: /잠금 해제/ }).first().click();
    await page.getByText('부모 모드가 켜져 있어요').waitFor();
  };
  await unlock(dad);
  await unlock(mom);
  await dad.goto(`${BASE}/settings`);
  await dad.getByText('하준 프로필 삭제').click();
  await dad.getByLabel(/이름 '하준'/).fill('하준');
  await dad.getByRole('button', { name: '삭제', exact: true }).click();
  await dad.getByText('자녀 프로필과 기록을 모두 삭제했어요.').waitFor();
  if ((await db.query(`select 1 from public.learners where name = '하준'`)).rows.length) throw new Error('자녀 삭제 안 됨');
  log('자녀 프로필 삭제');

  // 18. 회원 탈퇴: 엄마(다른 부모 있음) → 본인만, 아빠(마지막) → 가족 전체
  const withdraw = async (page, password = 'password123!') => {
    await page.goto(`${BASE}/settings`);
    await page.locator('#delete-account-title').click();
    await page.getByLabel('현재 비밀번호').fill(password);
    await page.getByLabel(/'탈퇴'라고 입력/).fill('탈퇴');
    await page.getByRole('button', { name: '회원 탈퇴' }).click();
  };
  await withdraw(mom, 'wrong-password');
  await mom.getByText('비밀번호가 맞지 않아요.').waitFor();
  await withdraw(mom);
  await mom.waitForURL(/\/login\?deleted=1/);
  const fam = (await db.query(`select count(*)::int c from public.families`)).rows[0].c;
  const authMom = (await db.query(`select count(*)::int c from auth.users where email = 'mom@test.local'`)).rows[0].c;
  if (fam !== 1 || authMom !== 0) throw new Error(`엄마 탈퇴 이상 fam=${fam} auth=${authMom}`);
  await withdraw(dad);
  await dad.waitForURL(/\/login\?deleted=1/);
  const remain = (await db.query(
    `select (select count(*) from public.families)::int f, (select count(*) from public.words)::int w,
            (select count(*) from auth.users)::int u`
  )).rows[0];
  if (remain.f !== 0 || remain.w !== 0 || remain.u !== 0) throw new Error(`가족 삭제 이상 ${JSON.stringify(remain)}`);
  log('회원 탈퇴: 다른 부모 있으면 본인만, 마지막 부모면 가족·Auth 전체 삭제');

  console.log('\nbrowser errors:', errors.length ? errors : 'none');
  await browser.close();
  await db.end();
}

main().catch(async (e) => {
  console.error('✘', e.message);
  process.exitCode = 1;
  await db.end().catch(() => {});
  process.exit(1);
});

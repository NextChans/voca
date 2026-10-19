// 로컬 Supabase 데모 키(공개 기본값)만 사용. 운영 키를 넣지 말 것.
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const SB = 'http://127.0.0.1:54321';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
await import('node:fs').then((fs) => fs.mkdirSync(SHOTS, { recursive: true }));
const log = (...a) => console.log('✔', ...a);

await fetch(`${SB}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'dad2@test.local', password: 'password123!', email_confirm: true }),
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const errors = [];
async function login(page, id, pw) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[name=email]').fill(id);
  await page.locator('input[name=password]').first().fill(pw);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
}

try {
  const dad = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  dad.on('pageerror', (e) => errors.push(e.message));
  await login(dad, 'dad2@test.local', 'password123!');
  await dad.getByPlaceholder('예: 행복한 우리집').fill('우리집');
  await dad.getByPlaceholder('예: 아빠, 엄마').fill('아빠');
  await dad.getByLabel('모두 동의해요').first().check();
  await dad.getByRole('button', { name: /가족 만들기/ }).click();
  await dad.waitForURL(/\/profiles/);
  await dad.getByPlaceholder('예: 지우').fill('지우');
  await dad.getByRole('button', { name: /추가/ }).last().click();
  await dad.getByText('지우', { exact: true }).first().waitFor();
  await dad.goto(`${BASE}/settings`);
  await dad.locator('input[name=pin]').last().fill('1234');
  await dad.locator('input[name=confirm]').first().fill('1234');
  await dad.getByRole('button', { name: /PIN.*(저장|설정)|저장/ }).first().click();
  await dad.getByText(/PIN을 저장했어요/).waitFor();
  log('부모: 가족·자녀·PIN 준비');

  // 자녀 로그인 계정 생성
  await dad.getByPlaceholder('예: jiwoo').fill('jiwoo');
  const form = dad.locator('form', { has: dad.getByPlaceholder('예: jiwoo') });
  await form.locator('input[name=password]').fill('kid123!');
  await form.locator('input[name=confirm]').fill('kid123!');
  await form.getByRole('button', { name: /로그인 계정 만들기/ }).click();
  await dad.getByText('로그인 아이디:').waitFor();
  await dad.screenshot({ path: `${SHOTS}k1-settings-kid-login.png`, fullPage: true });
  log('부모: 자녀 아이디 생성');

  // 자녀 로그인
  const kidCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  const kid = await kidCtx.newPage();
  kid.on('pageerror', (e) => errors.push(e.message));
  await login(kid, 'JiWoo', 'kid123!');
  await kid.waitForURL(`${BASE}/`);
  await kid.getByText('🧒 내 계정').waitFor();
  await kid.screenshot({ path: `${SHOTS}k2-kid-home.png`, fullPage: true });
  log('자녀: 아이디로 로그인 → 본인 홈');

  await kid.goto(`${BASE}/profiles`);
  await kid.waitForURL(`${BASE}/`);
  log('자녀: 프로필 전환 불가(/profiles → /)');

  await kid.goto(`${BASE}/settings`);
  if (await kid.locator('input[name=pin]').count()) throw new Error('자녀에게 PIN 입력창 노출');
  log('자녀: 부모 모드 진입 UI 없음');

  // 자녀가 단어 등록
  await kid.goto(`${BASE}/words/new`);
  await kid.getByRole('tab', { name: /붙여넣기/ }).click();
  await kid.getByLabel('단어 목록 붙여넣기').fill('apple 사과\nbanana 바나나\ncherry 체리');
  await kid.getByRole('button', { name: /표로 옮기기/ }).click();
  await kid.getByRole('button', { name: /3개 저장/ }).click();
  await kid.getByText(/3개 저장했어요/).waitFor();
  log('자녀: 단어 등록 가능');

  await kid.goto(`${BASE}/words`);
  if (await kid.getByRole('button', { name: /삭제/ }).count()) throw new Error('자녀에게 삭제 버튼 노출');
  log('자녀: 단어 수정·삭제 불가');

  // 카메라
  await kid.goto(`${BASE}/words/new`);
  await kid.getByRole('tab', { name: /사진/ }).click();
  await kid.getByRole('button', { name: /사진 찍기/ }).click();
  await kid.getByRole('dialog', { name: '카메라' }).waitFor();
  await kid.getByRole('button', { name: '촬영' }).waitFor({ state: 'visible' });
  await kid.waitForFunction(() => !document.querySelector('button[aria-label="촬영"]')?.disabled);
  await kid.screenshot({ path: `${SHOTS}k3-camera.png` });
  await kid.getByRole('button', { name: '촬영' }).click();
  await kid.getByRole('dialog', { name: '카메라' }).waitFor({ state: 'detached' });
  await kid.getByAltText('올린 사진 미리보기').waitFor();
  log('자녀: 페이지 내 카메라 촬영 → 인식 단계 진입');

  // 부모가 비밀번호 재설정 → 새 비밀번호로 로그인
  await dad.reload();
  const reset = dad.locator('form', { has: dad.getByRole('button', { name: /비밀번호 바꾸기/ }) });
  await reset.locator('input[name=password]').fill('newpw456');
  await reset.locator('input[name=confirm]').fill('newpw456');
  await reset.getByRole('button', { name: /비밀번호 바꾸기/ }).click();
  await dad.getByText('비밀번호를 바꿨어요.').waitFor();
  const kid2 = await (await browser.newContext()).newPage();
  await login(kid2, 'jiwoo', 'newpw456');
  log('부모: 자녀 비밀번호 재설정 → 새 비밀번호 로그인');

  // 부모가 자녀 프로필 삭제 → 자녀 로그인 계정도 삭제되어 로그인 불가
  await dad.goto(`${BASE}/settings`);
  await dad.getByText('지우 프로필 삭제').click();
  await dad.getByLabel(/이름 '지우'/).fill('지우');
  await dad.getByRole('button', { name: '삭제', exact: true }).click();
  await dad.getByText('지우의 프로필과 기록을 모두 삭제했어요.').waitFor();
  const kid3 = await (await browser.newContext()).newPage();
  await kid3.goto(`${BASE}/login`);
  await kid3.locator('input[name=email]').fill('jiwoo');
  await kid3.locator('input[name=password]').first().fill('newpw456');
  await kid3.locator('form button[type=submit]').first().click();
  await kid3.getByRole('alert').first().waitFor();
  if (!kid3.url().includes('/login')) throw new Error('삭제된 자녀 계정으로 로그인됨');
  log('부모: 자녀 프로필 삭제 → 자녀 계정 로그인 불가');

  console.log('page errors:', errors.length ? errors : 'none');
} catch (e) {
  console.error('✘', e.message.split('\n')[0]);
  process.exitCode = 1;
} finally {
  await browser.close();
}

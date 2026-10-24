// 로컬 Supabase 데모 키(공개 기본값)만 사용. 운영 키를 넣지 말 것.
// E2E: 단어책 — 책이 없는 자녀는 화면이 그대로, 책 만들기·책으로 등록·거르기·옮기기·연습·단어책 시험·책 삭제
import { chromium } from 'playwright-core';
import pg from 'pg';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const SB = 'http://127.0.0.1:54321';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
await import('node:fs').then((fs) => fs.mkdirSync(SHOTS, { recursive: true }));
const db = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
const log = (...a) => console.log('✔', ...a);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}b-${name}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let page;

async function paste(page, text, saveLabel) {
  await page.getByRole('tab', { name: /붙여넣기/ }).click();
  await page.getByLabel('단어 목록 붙여넣기').fill(text);
  await page.getByRole('button', { name: /표로 옮기기/ }).click();
  await page.getByRole('button', { name: saveLabel }).click();
}

try {
  await db.connect();
  await fetch(`${SB}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'books@test.local', password: 'password123!', email_confirm: true }),
  });

  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '능률보카 1' : undefined));

  await page.goto(`${BASE}/login`);
  await page.locator('input[name=email]').fill('books@test.local');
  await page.locator('input[name=password]').first().fill('password123!');
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.getByPlaceholder('예: 행복한 우리집').fill('우리집');
  await page.getByPlaceholder('예: 아빠, 엄마').fill('아빠');
  await page.getByLabel('모두 동의해요').first().check();
  await page.getByRole('button', { name: /가족 만들기/ }).click();
  await page.waitForURL(/\/profiles/);
  for (const name of ['언니', '동생']) {
    await page.getByPlaceholder('예: 지우').fill(name);
    await page.getByRole('button', { name: /추가/ }).last().click();
    await page.getByText(name, { exact: true }).first().waitFor();
  }
  await page.goto(`${BASE}/settings`);
  await page.locator('input[name=pin]').last().fill('1234');
  await page.locator('input[name=confirm]').first().fill('1234');
  await page.getByRole('button', { name: /PIN.*(저장|설정)|저장/ }).first().click();
  await page.getByText(/PIN을 저장했어요/).waitFor();
  log('준비: 가족·자녀 2명·PIN');

  // 1. 책이 없는 자녀(동생): 단어 등록 화면에 책 고르기가 없고 단어장엔 안내 링크만
  await page.goto(`${BASE}/profiles`);
  await page.getByRole('button', { name: /동생/ }).first().click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/words/new`);
  await page.getByRole('tab', { name: /붙여넣기/ }).waitFor();
  if (await page.getByText('📗 단어책').count()) throw new Error('책 없는 자녀에게 책 고르기 노출');
  await paste(page, 'dog 개', /1개 저장/);
  await page.getByText(/동생에게 1개 저장했어요/).waitFor();
  await page.goto(`${BASE}/words`);
  await page.getByRole('link', { name: '📗 단어책별로 나눠 담기' }).waitFor();
  if (await page.getByRole('navigation', { name: '단어책' }).count()) throw new Error('책 없는 자녀에게 책 거르기 노출');
  log('책 없는 자녀: 화면 그대로 (안내 링크만)');

  // 2. 언니: 단어 등록 화면에서 새 단어책 만들기 → 그 책으로 3개 등록, 책 없음으로 2개 등록
  await page.goto(`${BASE}/profiles`);
  await page.getByRole('button', { name: /언니/ }).first().click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/words/books`);
  await page.getByLabel('단어책 이름').fill('빈 책');
  await page.getByRole('button', { name: '만들기' }).click();
  await page.getByText("'빈 책' 단어책을 만들었어요.").waitFor();
  await page.goto(`${BASE}/words/new`);
  const picker = page.getByRole('combobox').first();
  await picker.selectOption({ label: '＋ 새 단어책 만들기…' }); // prompt → '능률보카 1'
  await page.waitForFunction(() => document.querySelector('select')?.selectedOptions[0]?.textContent === '능률보카 1');
  await paste(page, 'apple 사과\nbanana 바나나\ncherry 체리', /3개 저장/);
  await page.getByText(/'능률보카 1'에 3개 저장했어요/).waitFor();
  await shot(page, 'new-with-book');

  // 마지막으로 쓴 책을 기억한다 → 책 없음으로 바꿔서 2개
  await page.reload();
  await page.waitForFunction(() => document.querySelector('select')?.selectedOptions[0]?.textContent === '능률보카 1');
  await picker.selectOption({ label: '책 없음' });
  await paste(page, 'river 강\nmountain 산', /2개 저장/);
  await page.getByText(/언니에게 2개 저장했어요/).waitFor();
  const rows = (
    await db.query(
      `select w.term, b.name from public.words w join public.learners l on l.id = w.learner_id
         left join public.word_books b on b.id = w.book_id where l.name = '언니' order by w.term`
    )
  ).rows.map((r) => `${r.term}:${r.name ?? '-'}`);
  if (rows.join() !== 'apple:능률보카 1,banana:능률보카 1,cherry:능률보카 1,mountain:-,river:-')
    throw new Error(`책 저장 이상: ${rows.join()}`);
  log('등록 화면: 새 책 만들기·책으로 저장·마지막 책 기억');

  // 3. 단어장 거르기 + 옮기기(부모 모드)
  await page.goto(`${BASE}/words`);
  const nav = page.getByRole('navigation', { name: '단어책' });
  await nav.getByRole('link', { name: '📗 능률보카 1' }).click();
  await page.waitForURL(/book=/);
  await page.getByText('📗 능률보카 1 · 3개').waitFor();
  await nav.getByRole('link', { name: '책 없음' }).click();
  await page.getByText('책 없음 · 2개').waitFor();
  await page.getByRole('button', { name: /여러 개 옮기기·지우기/ }).click();
  await page.getByLabel('river 선택').check();
  await page.getByRole('combobox', { name: '단어책으로 옮기기' }).selectOption({ label: '능률보카 1' });
  await page.getByText("1개를 '능률보카 1'(으)로 옮겼어요.").waitFor();
  await page.getByText('책 없음 · 1개').waitFor();
  await nav.getByRole('link', { name: '전체' }).click();
  await page.getByText('📗 능률보카 1').nth(1).waitFor(); // 행 꼬리표
  await shot(page, 'words-all');
  log('단어장: 책 거르기·여러 개 옮기기·꼬리표');

  // 4. 연습: 책으로 거르면 그 책 단어만
  await page.goto(`${BASE}/practice?tab=new`);
  await page.getByRole('navigation', { name: '단어책' }).getByRole('link', { name: '📗 능률보카 1' }).click();
  await page.waitForURL(/tab=new.*book=|book=.*tab=new/);
  await page.getByText('모두 4개').waitFor();
  log('연습: 책별 새 단어 4개');

  // 5. 단어책 시험 (오늘 등록한 단어도 출제, 빈 책은 고를 수 없음)
  await page.goto(`${BASE}/test/new`);
  const bookTest = page.locator('#book-test');
  const empty = bookTest.locator('option', { hasText: '빈 책' });
  const emptyState = await empty.evaluate((o) => ({ text: o.textContent, disabled: o.disabled }));
  if (!emptyState.disabled) throw new Error(`빈 책이 선택 가능: ${JSON.stringify(emptyState)}`);
  await bookTest.getByRole('combobox').selectOption({ label: '능률보카 1 (4개)' });
  await bookTest.getByText('뜻 쓰기').click();
  await shot(page, 'test-new');
  await bookTest.getByRole('button', { name: /단어책 시험 시작 \(4문제\)/ }).click();
  await page.waitForURL(/\/test\/[0-9a-f-]{36}$/);
  await page.getByText(/단어책 시험 · 능률보카 1/).first().waitFor();
  const testId = page.url().split('/').pop();
  const items = (
    await db.query(`select term, meaning from public.test_items where test_id = $1 order by seq`, [testId])
  ).rows;
  if (items.length !== 4) throw new Error(`단어책 시험 문항 수 이상: ${items.length}`);
  const input = page.locator('input.input').first();
  for (const [i, it] of items.entries()) {
    await input.fill(i === 0 ? 'wrong' : it.meaning);
    await input.press('Enter');
  }
  await page.getByRole('button', { name: /^제출하기$/ }).click();
  await page.waitForURL(/\/results\//);
  await page.getByText('📗 능률보카 1').first().waitFor();
  const used = (
    await db.query(`select count(*)::int c from public.tests where kind = 'regular'`)
  ).rows[0].c;
  if (used !== 0) throw new Error('단어책 시험이 정기 시험으로 기록됨');
  await shot(page, 'book-result');
  log('단어책 시험: 4문제 응시·채점, 주간 횟수 미포함');

  // 재시험은 책 이름을 이어받는다
  await page.getByRole('button', { name: /재시험|다시 풀기/ }).first().click();
  await page.waitForURL(/\/test\/[0-9a-f-]{36}$/);
  await page.getByText(/재시험 · 능률보카 1/).first().waitFor();
  log('단어책 시험의 재시험: 책 이름 유지');

  // 6. 책 삭제(부모 모드) → 단어와 시험 기록은 남고 책 없음으로
  await page.goto(`${BASE}/words/books`);
  await shot(page, 'books');
  const row = page.locator('li', { hasText: '📗 능률보카 1' });
  await row.getByRole('button', { name: /지우기/ }).click();
  await page.locator('li', { hasText: '📗 능률보카 1' }).waitFor({ state: 'detached' });
  const after = (
    await db.query(
      `select count(*) filter (where w.book_id is null)::int nobook, count(*)::int total
         from public.words w join public.learners l on l.id = w.learner_id where l.name = '언니'`
    )
  ).rows[0];
  if (after.nobook !== 5 || after.total !== 5) throw new Error(`책 삭제 후 단어 이상: ${JSON.stringify(after)}`);
  const kept = (await db.query(`select count(*)::int c from public.tests where book_name = '능률보카 1'`)).rows[0].c;
  if (kept !== 2) throw new Error(`책 삭제 후 시험 기록 이상: ${kept}`);
  log('책 삭제: 단어 5개 책 없음으로, 시험 기록 2건 유지');

  console.log('page errors:', errors.length ? errors : 'none');
  if (errors.length) process.exitCode = 1;
} catch (e) {
  console.error('✘', e.message.split('\n')[0], page?.url());
  await page?.screenshot({ path: `${SHOTS}b-failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await db.end();
}

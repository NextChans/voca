/**
 * 마이그레이션 SQL 을 실제 Postgres(PGlite, WASM)에 적용해 출제·채점 규칙을 검증한다.
 * Supabase 고유 객체(auth.users, 롤)는 최소 스텁으로 대체.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../supabase/migrations');

const PARENT_A = '00000000-0000-0000-0000-00000000000a';
const PARENT_B = '00000000-0000-0000-0000-00000000000b';
const STRANGER = '00000000-0000-0000-0000-00000000000c';

let db: PGlite;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const rows = await q<T>(sql, params);
  if (!rows[0]) throw new Error('no rows');
  return rows[0];
}
async function expectError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toThrow(code);
}

async function setup() {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${PARENT_A}'), ('${PARENT_B}'), ('${STRANGER}');
  `);
  for (const f of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
  }
}

async function createFamilyWithLearner() {
  const { family } = await one<{ family: string }>(
    `select public.create_family($1, '우리집', '아빠') as family`,
    [PARENT_A]
  );
  const { id: learner } = await one<{ id: string }>(
    `insert into public.learners (family_id, name) values ($1, '첫째') returning id`,
    [family]
  );
  return { family, learner };
}

/** n 개 단어를 daysAgo 일 전에 등록 */
async function addWords(family: string, learner: string, n: number, daysAgo: number, prefix = 'w') {
  await db.query(
    `insert into public.words (family_id, learner_id, term, meaning, created_at)
     select $1, $2, $3 || g, '뜻' || g, now() - make_interval(days => $4)
       from generate_series(1, $5) g`,
    [family, learner, prefix, daysAgo, n]
  );
}

const createTest = (family: string, learner: string, kind = 'regular', mode = 'spelling', parent: string | null = null) =>
  one<{ id: string }>(`select public.create_test($1, $2, $3, $4, $5) as id`, [
    family,
    learner,
    kind,
    mode,
    parent,
  ]).then((r) => r.id);

async function submitAll(family: string, testId: string, correctPredicate: (seq: number) => boolean) {
  const items = await q<{ id: string; seq: number }>(
    `select id, seq from public.test_items where test_id = $1`,
    [testId]
  );
  const results = items.map((i) => ({ id: i.id, answer: 'x', is_correct: correctPredicate(i.seq) }));
  return one<{ correct: number }>(`select public.submit_test($1, $2, $3::jsonb) as correct`, [
    family,
    testId,
    JSON.stringify(results),
  ]).then((r) => r.correct);
}

describe('family / invite', () => {
  beforeEach(setup);

  it('초대코드는 1회용이고 만료되면 사용할 수 없다', async () => {
    const { family } = await createFamilyWithLearner();
    await db.query(
      `insert into public.family_invites (family_id, code_hash, created_by, expires_at)
       values ($1, 'h1', $2, now() + interval '1 day'), ($1, 'h2', $2, now() - interval '1 second')`,
      [family, PARENT_A]
    );
    const joined = await one<{ f: string }>(`select public.join_family($1, 'h1', '엄마') as f`, [PARENT_B]);
    expect(joined.f).toBe(family);
    await expectError(db.query(`select public.join_family($1, 'h1', '남')`, [STRANGER]), 'INVITE_INVALID');
    await expectError(db.query(`select public.join_family($1, 'h2', '남')`, [STRANGER]), 'INVITE_INVALID');
    await expectError(db.query(`select public.create_family($1, 'x', 'y')`, [PARENT_B]), 'ALREADY_IN_FAMILY');
  });
});

describe('learner login', () => {
  beforeEach(setup);

  it('한 계정은 부모 또는 자녀 중 하나만 될 수 있다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    // 부모 계정을 자녀에 연결 불가
    await expectError(
      db.query(`update public.learners set user_id = $1 where id = $2`, [PARENT_A, learner]),
      'ACCOUNT_IS_PARENT'
    );
    // 자녀 계정 연결 후, 그 계정으로 가족 합류/생성 불가
    await db.query(`update public.learners set user_id = $1, login_id = 'jiwoo' where id = $2`, [STRANGER, learner]);
    await db.query(
      `insert into public.family_invites (family_id, code_hash, created_by, expires_at)
       values ($1, 'kid', $2, now() + interval '1 day')`,
      [family, PARENT_A]
    );
    await expectError(db.query(`select public.join_family($1, 'kid', '자녀')`, [STRANGER]), 'ACCOUNT_IS_LEARNER');
    await expectError(db.query(`select public.create_family($1, 'x', 'y')`, [STRANGER]), 'ACCOUNT_IS_LEARNER');
  });

  it('로그인 아이디 형식과 중복을 막는다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await expect(db.query(`update public.learners set login_id = 'Bad-ID' where id = $1`, [learner])).rejects.toThrow();
    await db.query(`update public.learners set login_id = 'jiwoo' where id = $1`, [learner]);
    await expect(
      db.query(`insert into public.learners (family_id, name, login_id) values ($1, '둘째', 'jiwoo')`, [family])
    ).rejects.toThrow();
  });
});

describe('consent / account deletion', () => {
  beforeEach(setup);
  const ALL = `array['terms','privacy','overseas_transfer','guardian']`;

  it('필수 동의가 모두 있어야 기록되고, 부모의 최신 동의 버전이 갱신된다', async () => {
    await createFamilyWithLearner();
    await expectError(
      db.query(`select public.record_consent($1, 'v1', array['terms','privacy'])`, [PARENT_A]),
      'CONSENT_INCOMPLETE'
    );
    await db.query(`select public.record_consent($1, 'v1', ${ALL})`, [PARENT_A]);
    await db.query(`select public.record_consent($1, 'v2', ${ALL})`, [PARENT_A]);
    const m = await one<{ consent_version: string }>(
      `select consent_version from public.family_members where user_id = $1`,
      [PARENT_A]
    );
    expect(m.consent_version).toBe('v2');
    const hist = await q(`select version from public.user_consents where user_id = $1 order by id`, [PARENT_A]);
    expect(hist.map((r) => r.version)).toEqual(['v1', 'v2']);
  });

  it('다른 부모가 남아 있으면 본인만 탈퇴, 마지막 부모면 가족 전체와 자녀 계정 목록을 돌려준다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await addWords(family, learner, 3, 1);
    await db.query(`update public.learners set user_id = $1, login_id = 'jiwoo' where id = $2`, [STRANGER, learner]);
    await db.query(
      `insert into public.family_invites (family_id, code_hash, created_by, expires_at)
       values ($1, 'h', $2, now() + interval '1 day')`,
      [family, PARENT_A]
    );
    await db.query(`select public.join_family($1, 'h', '엄마')`, [PARENT_B]);

    const first = await one<{ r: { family_deleted: boolean; kid_user_ids: string[] } }>(
      `select public.delete_parent_account($1) as r`,
      [PARENT_A]
    );
    expect(first.r).toEqual({ family_deleted: false, kid_user_ids: [] });
    expect((await q(`select 1 from public.words where family_id = $1`, [family])).length).toBe(3);

    const last = await one<{ r: { family_deleted: boolean; kid_user_ids: string[] } }>(
      `select public.delete_parent_account($1) as r`,
      [PARENT_B]
    );
    expect(last.r).toEqual({ family_deleted: true, kid_user_ids: [STRANGER] });
    for (const t of ['families', 'family_members', 'learners', 'words', 'tests', 'test_items']) {
      expect((await q(`select 1 from public.${t}`)).length, t).toBe(0);
    }
    // 가족이 없는 계정은 아무것도 지우지 않는다
    const none = await one<{ r: { family_deleted: boolean } }>(`select public.delete_parent_account($1) as r`, [PARENT_A]);
    expect(none.r.family_deleted).toBe(false);
  });
});

describe('quotas / caps', () => {
  beforeEach(setup);

  it('일일 한도까지만 증가하고 넘으면 QUOTA_EXCEEDED, 환불하면 다시 쓸 수 있다', async () => {
    const { family } = await createFamilyWithLearner();
    for (let i = 1; i <= 3; i++) {
      const r = await one<{ c: number }>(`select public.consume_quota($1, 'ocr', 3) as c`, [family]);
      expect(r.c).toBe(i);
    }
    await expectError(db.query(`select public.consume_quota($1, 'ocr', 3)`, [family]), 'QUOTA_EXCEEDED');
    // 종류별로 따로 센다
    expect((await one<{ c: number }>(`select public.consume_quota($1, 'tts', 3) as c`, [family])).c).toBe(1);
    await db.query(`select public.refund_quota($1, 'ocr')`, [family]);
    expect((await one<{ c: number }>(`select public.consume_quota($1, 'ocr', 3) as c`, [family])).c).toBe(3);
  });

  it('가족당 자녀 4명, 자녀당 단어 5,000개를 넘으면 문 전체가 거부된다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await db.query(`insert into public.learners (family_id, name) values ($1, '둘째'), ($1, '셋째'), ($1, '넷째')`, [family]);
    await expectError(
      db.query(`insert into public.learners (family_id, name) values ($1, '다섯째')`, [family]),
      'LEARNER_LIMIT'
    );
    await addWords(family, learner, 4999, 1);
    await expectError(addWords(family, learner, 2, 1, 'x'), 'WORD_LIMIT');
    expect((await q(`select 1 from public.words where learner_id = $1`, [learner])).length).toBe(4999);
    await addWords(family, learner, 1, 1, 'y');
    expect((await q(`select 1 from public.words where learner_id = $1`, [learner])).length).toBe(5000);
  });
});

describe('create_test (regular)', () => {
  beforeEach(setup);

  it('오늘 등록한 단어는 출제되지 않고, 대상이 50개 미만이면 시작할 수 없다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await addWords(family, learner, 49, 1, 'old');
    await addWords(family, learner, 30, 0, 'today');
    await expectError(createTest(family, learner), 'NOT_ENOUGH_WORDS');

    await addWords(family, learner, 1, 2, 'older');
    const testId = await createTest(family, learner);
    const items = await q<{ term: string; seq: number }>(
      `select term, seq from public.test_items where test_id = $1 order by seq`,
      [testId]
    );
    expect(items).toHaveLength(50);
    expect(items.every((i) => !i.term.startsWith('today'))).toBe(true);
    expect(items.map((i) => i.seq)).toEqual(Array.from({ length: 50 }, (_, k) => k + 1));
  });

  it('이미 정기 시험에 나온 단어는 다시 출제되지 않는다 (취소된 시험은 제외)', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await addWords(family, learner, 50, 3, 'a');
    const t1 = await createTest(family, learner);
    await db.query(`update public.tests set status = 'cancelled' where id = $1`, [t1]);

    const t2 = await createTest(family, learner); // 취소분은 다시 출제 가능
    await submitAll(family, t2, () => true);
    await expectError(createTest(family, learner), 'NOT_ENOUGH_WORDS');

    await addWords(family, learner, 55, 1, 'b');
    const t3 = await createTest(family, learner);
    const terms = await q<{ term: string }>(`select term from public.test_items where test_id = $1`, [t3]);
    expect(terms).toHaveLength(55);
    expect(terms.every((t) => t.term.startsWith('b'))).toBe(true);
  });

  it('주당 정기 시험은 2회까지, 진행 중 시험은 1건만, 취소분은 횟수에서 제외', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await addWords(family, learner, 200, 1);
    await db.query(`update public.learners set min_test_words = 10 where id = $1`, [learner]);

    const t1 = await createTest(family, learner);
    await expectError(createTest(family, learner), 'TEST_IN_PROGRESS');
    await db.query(`update public.tests set status = 'cancelled' where id = $1`, [t1]);

    const t2 = await createTest(family, learner);
    await submitAll(family, t2, () => true);
    // 남은 단어가 없으므로 단어를 더 넣고 두 번째 시험
    await addWords(family, learner, 20, 1, 'more');
    const t3 = await createTest(family, learner);
    await submitAll(family, t3, () => true);
    await addWords(family, learner, 20, 1, 'more2');
    await expectError(createTest(family, learner), 'WEEKLY_LIMIT_REACHED');
  });

  it('출제 대상이 300개를 넘으면 오래된 300개만 출제하고 나머지는 다음 시험으로 남긴다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await addWords(family, learner, 300, 3, 'old');
    await addWords(family, learner, 60, 1, 'new');
    const t1 = await createTest(family, learner);
    const terms = await q<{ term: string }>(`select term from public.test_items where test_id = $1`, [t1]);
    expect(terms).toHaveLength(300);
    expect(terms.every((t) => t.term.startsWith('old'))).toBe(true);
    await submitAll(family, t1, () => true);
    const t2 = await createTest(family, learner);
    const rest = await q<{ term: string }>(`select term from public.test_items where test_id = $1`, [t2]);
    expect(rest).toHaveLength(60);
  });

  it('다른 가족의 자녀로는 시험을 만들 수 없다', async () => {
    const { learner } = await createFamilyWithLearner();
    const { other } = await one<{ other: string }>(
      `select public.create_family($1, '남의집', '남') as other`,
      [STRANGER]
    );
    await expectError(createTest(other, learner), 'LEARNER_NOT_FOUND');
  });
});

describe('submit / retest / override', () => {
  beforeEach(setup);

  it('제출은 전체 문항이 한 번씩 채점되어야 하며 중복 제출은 거부된다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await addWords(family, learner, 50, 1);
    const testId = await createTest(family, learner, 'regular', 'mixed');

    const items = await q<{ id: string }>(`select id from public.test_items where test_id = $1`, [testId]);
    const partial = items.slice(0, 10).map((i) => ({ id: i.id, answer: 'a', is_correct: true }));
    await expectError(
      db.query(`select public.submit_test($1, $2, $3::jsonb)`, [family, testId, JSON.stringify(partial)]),
      'RESULT_MISMATCH'
    );

    const correct = await submitAll(family, testId, (seq) => seq % 5 !== 0); // 10개 오답
    expect(correct).toBe(40);
    await expectError(submitAll(family, testId, () => true), 'TEST_NOT_IN_PROGRESS');

    const test = await one<{ status: string; correct: number }>(
      `select status, correct from public.tests where id = $1`,
      [testId]
    );
    expect(test).toEqual({ status: 'submitted', correct: 40 });
  });

  it('재시험은 틀린 문항만, 주간 횟수에 포함되지 않는다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await db.query(`update public.learners set weekly_limit = 1 where id = $1`, [learner]);
    await addWords(family, learner, 50, 1);
    const t1 = await createTest(family, learner, 'regular', 'mixed');
    await submitAll(family, t1, (seq) => seq > 3); // 3개 오답

    const r1 = await createTest(family, learner, 'retest', 'mixed', t1);
    const retestItems = await q<{ term: string; direction: string }>(
      `select term, direction from public.test_items where test_id = $1`,
      [r1]
    );
    const wrong = await q<{ term: string; direction: string }>(
      `select term, direction from public.test_items where test_id = $1 and is_correct = false`,
      [t1]
    );
    expect(retestItems).toHaveLength(3);
    expect(new Set(retestItems.map((i) => `${i.term}:${i.direction}`))).toEqual(
      new Set(wrong.map((i) => `${i.term}:${i.direction}`))
    );
    await submitAll(family, r1, () => true);
    await expectError(createTest(family, learner, 'retest', 'mixed', r1), 'NO_WRONG_ITEMS');
  });

  it('부모의 정답 인정은 점수를 재계산하고 누가 바꿨는지 남긴다', async () => {
    const { family, learner } = await createFamilyWithLearner();
    await addWords(family, learner, 50, 1);
    const t1 = await createTest(family, learner);
    await submitAll(family, t1, (seq) => seq !== 1);
    const item = await one<{ id: string }>(
      `select id from public.test_items where test_id = $1 and seq = 1`,
      [t1]
    );

    const after = await one<{ c: number }>(`select public.override_item($1, $2, $3, true) as c`, [
      family,
      PARENT_A,
      item.id,
    ]);
    expect(after.c).toBe(50);
    const row = await one<{ is_correct: boolean; auto_correct: boolean; overridden_by: string }>(
      `select is_correct, auto_correct, overridden_by from public.test_items where id = $1`,
      [item.id]
    );
    expect(row).toEqual({ is_correct: true, auto_correct: false, overridden_by: PARENT_A });

    // 되돌리면 정정 기록도 지워진다
    await db.query(`select public.override_item($1, $2, $3, false)`, [family, PARENT_B, item.id]);
    const reverted = await one<{ overridden_by: string | null }>(
      `select overridden_by from public.test_items where id = $1`,
      [item.id]
    );
    expect(reverted.overridden_by).toBeNull();
  });

  it('PIN 시도는 확인 전에 차감되고, 5회마다 5분·10분… 지수 잠금, 성공하면 초기화', async () => {
    const { family } = await createFamilyWithLearner();
    const lockMinutes = async () =>
      (
        await one<{ m: number }>(
          `select round(extract(epoch from pin_locked_until - now()) / 60)::int as m from public.families where id = $1`,
          [family]
        )
      ).m;
    for (let i = 0; i < 5; i++) await db.query(`select public.reserve_pin_attempt($1)`, [family]);
    expect(await lockMinutes()).toBe(5);
    await expectError(db.query(`select public.reserve_pin_attempt($1)`, [family]), 'PIN_LOCKED');

    // 잠금 만료 후 다시 5회 실패 → 10분
    await db.query(`update public.families set pin_locked_until = now() - interval '1 second' where id = $1`, [family]);
    for (let i = 0; i < 5; i++) await db.query(`select public.reserve_pin_attempt($1)`, [family]);
    expect(await lockMinutes()).toBe(10);

    // 성공하면 잠금 단계까지 초기화
    await db.query(`select public.record_pin_attempt($1, true)`, [family]);
    const f = await one<{ c: number; l: number; u: string | null }>(
      `select pin_failed_count c, pin_lock_count l, pin_locked_until u from public.families where id = $1`,
      [family]
    );
    expect(f).toEqual({ c: 0, l: 0, u: null });
  });
});

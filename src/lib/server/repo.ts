import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Direction } from '@/lib/domain/grading';
import type { TestKind, TestMode, TestStatus } from '@/lib/domain/types';
import { kstWeekStart } from '@/lib/domain/week';

/**
 * 데이터 접근 계층. service_role 로 RLS 를 우회하므로
 * 모든 함수는 서버에서 검증한 familyId 를 받고 모든 쿼리에 family_id 조건을 건다.
 */

export interface Membership {
  family_id: string;
  family_name: string;
  display_name: string;
  /** parent: 가족 관리 가능한 부모 계정 / child: 특정 자녀에 고정된 자녀 계정 */
  role: 'parent' | 'child';
  learner_id: string | null;
}
export interface FamilyMember {
  user_id: string;
  display_name: string;
  joined_at: string;
}
export interface Learner {
  id: string;
  name: string;
  avatar: string;
  weekly_limit: number;
  min_test_words: number;
  login_id: string | null;
}
export interface Word {
  id: string;
  term: string;
  meaning: string;
  created_at: string;
}
export interface TestRow {
  id: string;
  learner_id: string;
  kind: TestKind;
  mode: TestMode;
  parent_test_id: string | null;
  status: TestStatus;
  week_start: string;
  total: number;
  correct: number | null;
  started_at: string;
  submitted_at: string | null;
}
export interface TestItemRow {
  id: string;
  word_id: string | null;
  seq: number;
  direction: Direction;
  term: string;
  meaning: string;
  answer: string | null;
  is_correct: boolean | null;
  auto_correct: boolean | null;
  overridden_by: string | null;
  overridden_at: string | null;
}
/** 응시 화면용 — 정답 필드가 없다 */
export interface TestQuestion {
  id: string;
  seq: number;
  direction: Direction;
  prompt: string;
}

/** 사용자에게 그대로 보여줄 수 있는 도메인 오류 */
export class DomainError extends Error {}

const RPC_ERRORS: Record<string, string> = {
  ALREADY_IN_FAMILY: '이미 가족에 속해 있어요.',
  INVITE_INVALID: '초대코드가 올바르지 않거나 만료됐어요. 새 코드를 받아 주세요.',
  LEARNER_NOT_FOUND: '자녀 프로필을 찾을 수 없어요.',
  TEST_IN_PROGRESS: '진행 중인 시험이 있어요. 먼저 끝내거나 부모 모드에서 취소해 주세요.',
  WEEKLY_LIMIT_REACHED: '이번 주 시험 횟수를 모두 사용했어요. 다음 주 월요일에 다시 볼 수 있어요.',
  NOT_ENOUGH_WORDS: '시험 볼 수 있는 단어가 부족해요.',
  NO_WRONG_ITEMS: '틀린 단어가 없어요. 훌륭해요! 🎉',
  TOO_MANY_WORDS: '한 번에 출제할 수 있는 단어(300개)를 넘었어요.',
  PARENT_TEST_NOT_FOUND: '원래 시험을 찾을 수 없어요.',
  TEST_NOT_FOUND: '시험을 찾을 수 없어요.',
  TEST_NOT_IN_PROGRESS: '이미 제출했거나 취소된 시험이에요.',
  RESULT_MISMATCH: '채점 데이터가 올바르지 않아요. 다시 시도해 주세요.',
  ITEM_NOT_FOUND: '문항을 찾을 수 없어요.',
  ACCOUNT_IS_LEARNER: '자녀 계정으로는 가족을 만들거나 합류할 수 없어요.',
  ACCOUNT_IS_PARENT: '부모 계정은 자녀 계정으로 쓸 수 없어요.',
};

function fail(error: { message: string; code?: string } | null, context: string): never {
  const key = error?.message?.trim() ?? '';
  if (key in RPC_ERRORS) throw new DomainError(RPC_ERRORS[key]);
  if (error?.code === '23505') throw new DomainError('이미 같은 이름(단어)이 있어요.');
  console.error(`[repo] ${context} failed`, error);
  throw new Error(`${context} failed`);
}

const db = () => supabaseAdmin();

// ================================================================ 가족

export async function getMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await db()
    .from('family_members')
    .select('family_id, display_name, families(name)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail(error, 'getMembership');
  if (data) {
    const fam = data.families as unknown as { name: string } | null;
    return {
      family_id: data.family_id,
      display_name: data.display_name,
      family_name: fam?.name ?? '',
      role: 'parent',
      learner_id: null,
    };
  }

  // 자녀 로그인 계정
  const { data: kid, error: kidError } = await db()
    .from('learners')
    .select('id, family_id, name, families(name)')
    .eq('user_id', userId)
    .maybeSingle();
  if (kidError) fail(kidError, 'getMembership(learner)');
  if (!kid) return null;
  const fam = kid.families as unknown as { name: string } | null;
  return {
    family_id: kid.family_id,
    display_name: kid.name,
    family_name: fam?.name ?? '',
    role: 'child',
    learner_id: kid.id,
  };
}

export async function listMembers(familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await db()
    .from('family_members')
    .select('user_id, display_name, joined_at')
    .eq('family_id', familyId)
    .order('joined_at');
  if (error) fail(error, 'listMembers');
  return data ?? [];
}

export async function createFamily(userId: string, familyName: string, displayName: string): Promise<string> {
  const { data, error } = await db().rpc('create_family', {
    p_user_id: userId,
    p_family_name: familyName,
    p_display_name: displayName,
  });
  if (error) fail(error, 'createFamily');
  return data as string;
}

export async function joinFamily(userId: string, codeHash: string, displayName: string): Promise<string> {
  const { data, error } = await db().rpc('join_family', {
    p_user_id: userId,
    p_code_hash: codeHash,
    p_display_name: displayName,
  });
  if (error) fail(error, 'joinFamily');
  return data as string;
}

export async function createInvite(
  familyId: string,
  userId: string,
  codeHash: string,
  expiresAt: Date
): Promise<void> {
  const { error } = await db().from('family_invites').insert({
    family_id: familyId,
    created_by: userId,
    code_hash: codeHash,
    expires_at: expiresAt.toISOString(),
  });
  if (error) fail(error, 'createInvite');
}

export async function getPinState(
  familyId: string
): Promise<{ parent_pin_hash: string | null; pin_locked_until: string | null }> {
  const { data, error } = await db()
    .from('families')
    .select('parent_pin_hash, pin_locked_until')
    .eq('id', familyId)
    .single();
  if (error) fail(error, 'getPinState');
  return data;
}

export async function setPinHash(familyId: string, hash: string): Promise<void> {
  const { error } = await db()
    .from('families')
    .update({ parent_pin_hash: hash, pin_failed_count: 0, pin_locked_until: null })
    .eq('id', familyId);
  if (error) fail(error, 'setPinHash');
}

/** 반환: 이번 시도로 잠긴 경우 잠금 해제 시각 */
export async function recordPinAttempt(familyId: string, success: boolean): Promise<string | null> {
  const { data, error } = await db().rpc('record_pin_attempt', {
    p_family_id: familyId,
    p_success: success,
  });
  if (error) fail(error, 'recordPinAttempt');
  return (data as string | null) ?? null;
}

// ================================================================ 자녀

const LEARNER_COLUMNS = 'id, name, avatar, weekly_limit, min_test_words, login_id';

export async function listLearners(familyId: string): Promise<Learner[]> {
  const { data, error } = await db()
    .from('learners')
    .select(LEARNER_COLUMNS)
    .eq('family_id', familyId)
    .order('created_at');
  if (error) fail(error, 'listLearners');
  return data ?? [];
}

export async function getLearner(familyId: string, learnerId: string): Promise<Learner | null> {
  const { data, error } = await db()
    .from('learners')
    .select(LEARNER_COLUMNS)
    .eq('family_id', familyId)
    .eq('id', learnerId)
    .maybeSingle();
  if (error) fail(error, 'getLearner');
  return data;
}

export async function createLearner(familyId: string, name: string, avatar: string): Promise<string> {
  const { data, error } = await db()
    .from('learners')
    .insert({ family_id: familyId, name, avatar })
    .select('id')
    .single();
  if (error) fail(error, 'createLearner');
  return data.id;
}

export async function updateLearner(
  familyId: string,
  learnerId: string,
  patch: Partial<Pick<Learner, 'name' | 'avatar' | 'weekly_limit' | 'min_test_words'>>
): Promise<void> {
  const { error } = await db()
    .from('learners')
    .update(patch)
    .eq('family_id', familyId)
    .eq('id', learnerId);
  if (error) fail(error, 'updateLearner');
}

// ================================================================ 자녀 로그인 계정

/** 자녀 계정 생성: Auth 사용자 생성 → learners 연결. 연결 실패 시 Auth 사용자 삭제(보상 트랜잭션). */
export async function createLearnerLogin(
  familyId: string,
  learnerId: string,
  loginId: string,
  email: string,
  password: string
): Promise<void> {
  const learner = await getLearnerAuth(familyId, learnerId);
  if (!learner) throw new DomainError('자녀 프로필을 찾을 수 없어요.');
  if (learner.user_id) throw new DomainError('이미 로그인 계정이 있어요.');

  const { data, error } = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { kind: 'learner', learner_id: learnerId },
  });
  if (error || !data.user) {
    if (/already|registered|exists/i.test(error?.message ?? '')) {
      throw new DomainError('이미 사용 중인 아이디예요. 다른 아이디를 골라 주세요.');
    }
    if (/password/i.test(error?.message ?? '')) {
      throw new DomainError('비밀번호가 너무 쉬워요. 더 길게 정해 주세요.');
    }
    console.error('[repo] createLearnerLogin auth failed', error);
    throw new Error('createLearnerLogin failed');
  }

  const { error: linkError } = await db()
    .from('learners')
    .update({ user_id: data.user.id, login_id: loginId })
    .eq('family_id', familyId)
    .eq('id', learnerId)
    .is('user_id', null);
  if (linkError) {
    await db().auth.admin.deleteUser(data.user.id);
    fail(linkError, 'createLearnerLogin(link)');
  }
}

export async function resetLearnerPassword(familyId: string, learnerId: string, password: string): Promise<void> {
  const learner = await getLearnerAuth(familyId, learnerId);
  if (!learner?.user_id) throw new DomainError('로그인 계정이 없어요.');
  const { error } = await db().auth.admin.updateUserById(learner.user_id, { password });
  if (error) {
    if (/password/i.test(error.message)) throw new DomainError('비밀번호가 너무 쉬워요. 더 길게 정해 주세요.');
    console.error('[repo] resetLearnerPassword failed', error);
    throw new Error('resetLearnerPassword failed');
  }
}

/** 자녀 계정 삭제 (프로필·단어·시험 기록은 유지) */
export async function removeLearnerLogin(familyId: string, learnerId: string): Promise<void> {
  const learner = await getLearnerAuth(familyId, learnerId);
  if (!learner?.user_id) return;
  const { error: unlinkError } = await db()
    .from('learners')
    .update({ user_id: null, login_id: null })
    .eq('family_id', familyId)
    .eq('id', learnerId);
  if (unlinkError) fail(unlinkError, 'removeLearnerLogin(unlink)');
  const { error } = await db().auth.admin.deleteUser(learner.user_id);
  if (error) console.error('[repo] removeLearnerLogin auth delete failed (unlinked already)', error);
}

async function getLearnerAuth(
  familyId: string,
  learnerId: string
): Promise<{ user_id: string | null } | null> {
  const { data, error } = await db()
    .from('learners')
    .select('user_id')
    .eq('family_id', familyId)
    .eq('id', learnerId)
    .maybeSingle();
  if (error) fail(error, 'getLearnerAuth');
  return data;
}

// ================================================================ 단어

export async function listWords(familyId: string, learnerId: string): Promise<Word[]> {
  const { data, error } = await db()
    .from('words')
    .select('id, term, meaning, created_at')
    .eq('family_id', familyId)
    .eq('learner_id', learnerId)
    // 등록한 순서대로 (같은 시각에 저장된 과거 데이터만 철자순으로 보조 정렬)
    .order('created_at', { ascending: true })
    .order('term');
  if (error) fail(error, 'listWords');
  return data ?? [];
}

/** 이미 있는 철자(대소문자 무시)는 건너뛴다 */
export async function addWords(
  familyId: string,
  learnerId: string,
  userId: string,
  rows: { term: string; meaning: string }[]
): Promise<{ added: number; skipped: number }> {
  const existing = new Set(
    (await listWords(familyId, learnerId)).map((w) => w.term.trim().toLowerCase())
  );
  const fresh: { term: string; meaning: string }[] = [];
  for (const r of rows) {
    const key = r.term.trim().toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    fresh.push({ term: r.term.trim(), meaning: r.meaning.trim() });
  }
  if (fresh.length > 0) {
    const base = Date.now();
    const { error } = await db()
      .from('words')
      .insert(
        // 한 번에 저장해도 입력 순서가 유지되도록 1ms 씩 증가시킨 등록 시각을 부여
        fresh.map((r, i) => ({
          ...r,
          family_id: familyId,
          learner_id: learnerId,
          created_by: userId,
          created_at: new Date(base + i).toISOString(),
        }))
      );
    if (error) fail(error, 'addWords');
  }
  return { added: fresh.length, skipped: rows.length - fresh.length };
}

export async function updateWord(
  familyId: string,
  wordId: string,
  patch: { term: string; meaning: string }
): Promise<void> {
  const { error } = await db()
    .from('words')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('family_id', familyId)
    .eq('id', wordId);
  if (error) fail(error, 'updateWord');
}

export async function deleteWord(familyId: string, wordId: string): Promise<void> {
  const { error } = await db().from('words').delete().eq('family_id', familyId).eq('id', wordId);
  if (error) fail(error, 'deleteWord');
}

export async function listWordStats(
  familyId: string
): Promise<Map<string, { attempts: number; wrong_count: number }>> {
  const { data, error } = await db()
    .from('word_stats')
    .select('word_id, attempts, wrong_count')
    .eq('family_id', familyId);
  if (error) fail(error, 'listWordStats');
  return new Map((data ?? []).map((s) => [s.word_id as string, s]));
}

/** 정기 시험에 이미 출제된(취소 제외) 단어 id 집합 */
export async function listRegularTestedWordIds(familyId: string, learnerId: string): Promise<Set<string>> {
  const { data, error } = await db()
    .from('test_items')
    .select('word_id, tests!inner(learner_id, kind, status)')
    .eq('family_id', familyId)
    .eq('tests.learner_id', learnerId)
    .eq('tests.kind', 'regular')
    .neq('tests.status', 'cancelled')
    .not('word_id', 'is', null);
  if (error) fail(error, 'listRegularTestedWordIds');
  return new Set((data ?? []).map((r) => r.word_id as string));
}

/** 오답 연습용: 이 자녀의 제출된 시험 문항 결과 (정답 포함 — 연습 화면 전용) */
export async function listSubmittedItemResults(
  familyId: string,
  learnerId: string
): Promise<{ word_id: string | null; term: string; meaning: string; is_correct: boolean | null; submitted_at: string }[]> {
  const { data, error } = await db()
    .from('test_items')
    .select('word_id, term, meaning, is_correct, tests!inner(learner_id, status, submitted_at)')
    .eq('family_id', familyId)
    .eq('tests.learner_id', learnerId)
    .eq('tests.status', 'submitted')
    .limit(10000);
  if (error) fail(error, 'listSubmittedItemResults');
  return (data ?? []).map((r) => {
    const t = r.tests as unknown as { submitted_at: string };
    return { word_id: r.word_id, term: r.term, meaning: r.meaning, is_correct: r.is_correct, submitted_at: t.submitted_at };
  });
}

// ================================================================ 시험

const TEST_COLUMNS =
  'id, learner_id, kind, mode, parent_test_id, status, week_start, total, correct, started_at, submitted_at';

export async function countRegularTestsThisWeek(familyId: string, learnerId: string): Promise<number> {
  const { count, error } = await db()
    .from('tests')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('learner_id', learnerId)
    .eq('kind', 'regular')
    .neq('status', 'cancelled')
    .eq('week_start', kstWeekStart());
  if (error) fail(error, 'countRegularTestsThisWeek');
  return count ?? 0;
}

export async function getInProgressTest(familyId: string, learnerId: string): Promise<TestRow | null> {
  const { data, error } = await db()
    .from('tests')
    .select(TEST_COLUMNS)
    .eq('family_id', familyId)
    .eq('learner_id', learnerId)
    .eq('status', 'in_progress')
    .maybeSingle();
  if (error) fail(error, 'getInProgressTest');
  return data as TestRow | null;
}

export async function createTest(
  familyId: string,
  learnerId: string,
  input: { kind: TestKind; mode: TestMode; parentTestId: string | null }
): Promise<string> {
  const { data, error } = await db().rpc('create_test', {
    p_family_id: familyId,
    p_learner_id: learnerId,
    p_kind: input.kind,
    p_mode: input.mode,
    p_parent_test_id: input.parentTestId,
  });
  if (error) fail(error, 'createTest');
  return data as string;
}

export async function getTest(familyId: string, testId: string): Promise<TestRow | null> {
  const { data, error } = await db()
    .from('tests')
    .select(TEST_COLUMNS)
    .eq('family_id', familyId)
    .eq('id', testId)
    .maybeSingle();
  if (error) fail(error, 'getTest');
  return data as TestRow | null;
}

export async function getTestItems(familyId: string, testId: string): Promise<TestItemRow[]> {
  const { data, error } = await db()
    .from('test_items')
    .select(
      'id, word_id, seq, direction, term, meaning, answer, is_correct, auto_correct, overridden_by, overridden_at'
    )
    .eq('family_id', familyId)
    .eq('test_id', testId)
    .order('seq');
  if (error) fail(error, 'getTestItems');
  return (data ?? []) as TestItemRow[];
}

/** 응시 화면용: 문제 텍스트만. spelling 문항의 영어 철자는 절대 포함하지 않는다. */
export async function getTestQuestions(familyId: string, testId: string): Promise<TestQuestion[]> {
  const items = await getTestItems(familyId, testId);
  return items.map((i) => ({
    id: i.id,
    seq: i.seq,
    direction: i.direction,
    prompt: i.direction === 'spelling' ? i.meaning : i.term,
  }));
}

export async function submitTest(
  familyId: string,
  testId: string,
  results: { id: string; answer: string; is_correct: boolean }[]
): Promise<number> {
  const { data, error } = await db().rpc('submit_test', {
    p_family_id: familyId,
    p_test_id: testId,
    p_results: results,
  });
  if (error) fail(error, 'submitTest');
  return data as number;
}

export async function overrideItem(
  familyId: string,
  userId: string,
  itemId: string,
  isCorrect: boolean
): Promise<void> {
  const { error } = await db().rpc('override_item', {
    p_family_id: familyId,
    p_user_id: userId,
    p_item_id: itemId,
    p_is_correct: isCorrect,
  });
  if (error) fail(error, 'overrideItem');
}

export async function cancelTest(familyId: string, userId: string, testId: string): Promise<void> {
  const { error } = await db()
    .from('tests')
    .update({ status: 'cancelled', cancelled_by: userId })
    .eq('family_id', familyId)
    .eq('id', testId)
    .eq('status', 'in_progress');
  if (error) fail(error, 'cancelTest');
}

export async function listTests(
  familyId: string,
  learnerId: string,
  opts: { limit?: number; status?: TestStatus } = {}
): Promise<TestRow[]> {
  let q = db()
    .from('tests')
    .select(TEST_COLUMNS)
    .eq('family_id', familyId)
    .eq('learner_id', learnerId)
    .order('started_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  if (error) fail(error, 'listTests');
  return (data ?? []) as TestRow[];
}

export async function listRetestsOf(familyId: string, testId: string): Promise<TestRow[]> {
  const { data, error } = await db()
    .from('tests')
    .select(TEST_COLUMNS)
    .eq('family_id', familyId)
    .eq('parent_test_id', testId)
    .neq('status', 'cancelled')
    .order('started_at');
  if (error) fail(error, 'listRetestsOf');
  return (data ?? []) as TestRow[];
}

/** TTS 용: 문항의 영어 철자 (같은 가족 문항만) */
export async function getItemTerm(familyId: string, itemId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('test_items')
    .select('term')
    .eq('family_id', familyId)
    .eq('id', itemId)
    .maybeSingle();
  if (error) fail(error, 'getItemTerm');
  return data?.term ?? null;
}

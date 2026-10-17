'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { gradeItem } from '@/lib/domain/grading';
import {
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  INVITE_TTL_MS,
  normalizeInviteCode,
} from '@/lib/domain/invite';
import { isValidLoginId, loginIdToEmail, MIN_KID_PASSWORD, normalizeLoginId } from '@/lib/domain/kidLogin';
import { hashPin, isValidPin, verifyPin } from '@/lib/domain/parentToken';
import { requireUser } from '@/lib/server/auth';
import { requireLearner, requireMember, setSelectedLearner } from '@/lib/server/context';
import {
  clearParentUnlocked,
  ParentLockedError,
  requireParent,
  setParentUnlocked,
} from '@/lib/server/parent';
import * as repo from '@/lib/server/repo';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ActionState {
  error?: string;
  message?: string;
  /** 초대코드처럼 한 번만 보여줄 값 */
  secret?: string;
}

/** 사용자에게 보여줄 수 있는 오류만 메시지로, 나머지는 일반 메시지로 변환 */
async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    if (e instanceof repo.DomainError || e instanceof ParentLockedError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? '입력값을 확인해 주세요.' };
    console.error('[action] unexpected error', e);
    return { error: '잠시 후 다시 시도해 주세요.' };
  }
}

const uuid = z.uuid();
const termSchema = z
  .string()
  .trim()
  .min(1, '영어 단어를 입력해 주세요.')
  .max(100, '단어가 너무 길어요.')
  .regex(/^[a-z][a-z\s'’\-./]*$/i, '영어 단어는 알파벳으로만 입력해 주세요.');
const meaningSchema = z.string().trim().min(1, '뜻을 입력해 주세요.').max(200, '뜻이 너무 길어요.');
const personNameSchema = z.string().trim().min(1, '이름을 입력해 주세요.').max(20, '이름이 너무 길어요.');
const avatarSchema = z.string().trim().min(1).max(8).default('🐣');

/** 부모 전용 액션 공통 가드 */
async function parentCtx() {
  const ctx = await requireMember();
  await requireParent(ctx.user.id, ctx.member.family_id);
  return ctx;
}

// ================================================================ 인증 / 가족

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearParentUnlocked();
  redirect('/login');
}

export async function createFamilyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await run(async () => {
    await repo.createFamily(
      user.id,
      z.string().trim().min(1, '가족 이름을 입력해 주세요.').max(30).parse(formData.get('family_name')),
      personNameSchema.parse(formData.get('display_name'))
    );
  });
  if (result.error) return result;
  redirect('/profiles');
}

export async function joinFamilyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await run(async () => {
    const code = normalizeInviteCode(String(formData.get('code') ?? ''));
    if (code.length !== 8) return { error: '초대코드 8자리를 입력해 주세요.' };
    await repo.joinFamily(user.id, hashInviteCode(code), personNameSchema.parse(formData.get('display_name')));
  });
  if (result.error) return result;
  redirect('/profiles');
}

export async function createInviteAction(): Promise<ActionState> {
  return run(async () => {
    const { user, member } = await parentCtx();
    const code = generateInviteCode();
    await repo.createInvite(member.family_id, user.id, hashInviteCode(code), new Date(Date.now() + INVITE_TTL_MS));
    return {
      secret: formatInviteCode(code),
      message: '배우자가 회원가입 후 이 코드를 입력하면 가족으로 합류해요. (72시간, 1회용)',
    };
  });
}

// ================================================================ 부모 모드

export async function unlockParentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, member } = await requireMember();
  const result = await run(async () => {
    if (member.role !== 'parent') return { error: '자녀 계정에서는 부모 모드를 켤 수 없어요.' };
    const pin = String(formData.get('pin') ?? '');
    const state = await repo.getPinState(member.family_id);
    if (!state.parent_pin_hash) return { message: '아직 PIN이 없어요. 아래에서 먼저 설정해 주세요.' };
    if (state.pin_locked_until && Date.parse(state.pin_locked_until) > Date.now()) {
      return { error: '여러 번 틀려서 잠시 잠겼어요. 5분 뒤에 다시 시도해 주세요.' };
    }
    const ok = isValidPin(pin) && verifyPin(pin, state.parent_pin_hash);
    const lockedUntil = await repo.recordPinAttempt(member.family_id, ok);
    if (!ok) return { error: lockedUntil ? '5번 틀려서 5분 동안 잠겼어요.' : 'PIN이 맞지 않아요.' };
    await setParentUnlocked(user.id);
  });
  if (result.error || result.message) return result;
  const next = String(formData.get('next') ?? '');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/settings');
}

export async function lockParentAction(): Promise<void> {
  await requireMember();
  await clearParentUnlocked();
  revalidatePath('/', 'layout');
}

export async function setPinAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, member } = await parentCtx();
    const pin = String(formData.get('pin') ?? '');
    const confirm = String(formData.get('confirm') ?? '');
    if (!isValidPin(pin)) return { error: 'PIN은 숫자 4~8자리로 정해 주세요.' };
    if (pin !== confirm) return { error: '두 PIN이 서로 달라요.' };
    await repo.setPinHash(member.family_id, hashPin(pin));
    await setParentUnlocked(user.id);
    revalidatePath('/', 'layout');
    return { message: 'PIN을 저장했어요. 단어 관리·채점 수정·설정은 부모 모드에서만 할 수 있어요.' };
  });
}

// ================================================================ 자녀 프로필

export async function selectLearnerAction(learnerId: string): Promise<void> {
  const { member } = await requireMember();
  if (member.role === 'child') redirect('/'); // 자녀 계정은 본인 프로필 고정
  const learner = await repo.getLearner(member.family_id, uuid.parse(learnerId));
  if (!learner) redirect('/profiles');
  await setSelectedLearner(learner.id);
  redirect('/');
}

export async function createLearnerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { member } = await parentCtx();
    await repo.createLearner(
      member.family_id,
      personNameSchema.parse(formData.get('name')),
      avatarSchema.parse(formData.get('avatar') || undefined)
    );
    revalidatePath('/', 'layout');
    return { message: '자녀 프로필을 추가했어요.' };
  });
}

const learnerSettingsSchema = z.object({
  learnerId: uuid,
  name: personNameSchema,
  avatar: avatarSchema,
  weekly_limit: z.coerce.number().int().min(1, '1회 이상').max(14),
  min_test_words: z.coerce.number().int().min(1).max(200),
});

export async function updateLearnerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { member } = await parentCtx();
    const { learnerId, ...patch } = learnerSettingsSchema.parse(Object.fromEntries(formData));
    await repo.updateLearner(member.family_id, learnerId, patch);
    revalidatePath('/', 'layout');
    return { message: '저장했어요.' };
  });
}

// ================================================================ 자녀 로그인 계정 (부모 전용)

const kidPasswordSchema = z
  .string()
  .min(MIN_KID_PASSWORD, `비밀번호는 ${MIN_KID_PASSWORD}자 이상으로 정해 주세요.`)
  .max(72, '비밀번호가 너무 길어요.');

export async function createLearnerLoginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { member } = await parentCtx();
    const learnerId = uuid.parse(formData.get('learnerId'));
    const loginId = normalizeLoginId(String(formData.get('login_id') ?? ''));
    if (!isValidLoginId(loginId)) return { error: '아이디는 영어 소문자·숫자·_ 로 3~20자예요.' };
    const password = kidPasswordSchema.parse(formData.get('password'));
    if (password !== String(formData.get('confirm') ?? '')) return { error: '두 비밀번호가 서로 달라요.' };
    await repo.createLearnerLogin(member.family_id, learnerId, loginId, loginIdToEmail(loginId), password);
    revalidatePath('/settings');
    return { message: `아이디 "${loginId}"로 로그인할 수 있어요.` };
  });
}

export async function resetLearnerPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { member } = await parentCtx();
    const learnerId = uuid.parse(formData.get('learnerId'));
    const password = kidPasswordSchema.parse(formData.get('password'));
    if (password !== String(formData.get('confirm') ?? '')) return { error: '두 비밀번호가 서로 달라요.' };
    await repo.resetLearnerPassword(member.family_id, learnerId, password);
    return { message: '비밀번호를 바꿨어요.' };
  });
}

export async function removeLearnerLoginAction(learnerId: string): Promise<ActionState> {
  return run(async () => {
    const { member } = await parentCtx();
    await repo.removeLearnerLogin(member.family_id, uuid.parse(learnerId));
    revalidatePath('/settings');
    return { message: '로그인 계정을 삭제했어요. (단어와 시험 기록은 그대로예요)' };
  });
}

// ================================================================ 단어 (현재 선택된 자녀)

const addWordsSchema = z
  .array(z.object({ term: termSchema, meaning: meaningSchema }))
  .min(1, '저장할 단어가 없어요.')
  .max(300, '한 번에 300개까지 저장할 수 있어요.');

/** 단어 추가는 자녀 모드에서도 허용 (수정·삭제는 부모 전용). 등록 당일엔 출제되지 않으므로 시험 공정성에는 영향 없음. */
export async function addWordsAction(rows: { term: string; meaning: string }[]): Promise<ActionState> {
  return run(async () => {
    const { user, member, learner } = await requireLearner();
    const { added, skipped } = await repo.addWords(
      member.family_id,
      learner.id,
      user.id,
      addWordsSchema.parse(rows)
    );
    revalidatePath('/', 'layout');
    return {
      message: `${learner.name}에게 ${added}개 저장했어요. 내일부터 시험에 나와요.${
        skipped ? ` (이미 있는 단어 ${skipped}개는 건너뛰었어요)` : ''
      }`,
    };
  });
}

export async function updateWordAction(wordId: string, term: string, meaning: string): Promise<ActionState> {
  return run(async () => {
    const { member } = await parentCtx();
    await repo.updateWord(member.family_id, uuid.parse(wordId), {
      term: termSchema.parse(term),
      meaning: meaningSchema.parse(meaning),
    });
    revalidatePath('/words');
  });
}

const deleteWordsSchema = z.array(uuid).min(1, '지울 단어를 골라 주세요.').max(500, '한 번에 500개까지 지울 수 있어요.');

/** 단어 삭제(1개 이상). 부모 모드 전용. 시험 기록의 문항은 스냅샷이라 그대로 남는다. */
export async function deleteWordsAction(wordIds: string[]): Promise<ActionState> {
  return run(async () => {
    const { user, member } = await parentCtx();
    const ids = [...new Set(deleteWordsSchema.parse(wordIds))];
    const deleted = await repo.deleteWords(member.family_id, ids);
    console.info('[words] delete', { family: member.family_id, by: user.id, requested: ids.length, deleted });
    revalidatePath('/', 'layout');
    return { message: `${deleted}개 지웠어요.` };
  });
}

// ================================================================ 시험

export async function startTestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let testId = '';
  const result = await run(async () => {
    const { member, learner } = await requireLearner();
    const mode = z.enum(['spelling', 'meaning', 'mixed']).parse(formData.get('mode'));
    testId = await repo.createTest(member.family_id, learner.id, { kind: 'regular', mode, parentTestId: null });
  });
  if (!testId) return result;
  redirect(`/test/${testId}`);
}

export async function startRetestAction(parentTestId: string): Promise<ActionState> {
  let testId = '';
  const result = await run(async () => {
    const { member, learner } = await requireLearner();
    const parent = await repo.getTest(member.family_id, uuid.parse(parentTestId));
    if (!parent || parent.learner_id !== learner.id) return { error: '시험을 찾을 수 없어요.' };
    testId = await repo.createTest(member.family_id, learner.id, {
      kind: 'retest',
      mode: parent.mode,
      parentTestId: parent.id,
    });
  });
  if (!testId) return result;
  redirect(`/test/${testId}`);
}

const answersSchema = z.record(z.string(), z.string().max(200));

/** 채점은 서버에서만. 클라이언트는 문항 id → 답안 문자열만 보낸다. */
export async function submitTestAction(testId: string, answers: Record<string, string>): Promise<ActionState> {
  const id = uuid.parse(testId);
  const result = await run(async () => {
    const { member } = await requireMember();
    const parsed = answersSchema.parse(answers);
    const test = await repo.getTest(member.family_id, id);
    if (!test) return { error: '시험을 찾을 수 없어요.' };
    if (test.status !== 'in_progress') return; // 중복 제출 → 결과 화면으로
    const items = await repo.getTestItems(member.family_id, id);
    const results = items.map((item) => {
      const answer = (parsed[item.id] ?? '').trim();
      return { id: item.id, answer, is_correct: gradeItem(item, answer) };
    });
    await repo.submitTest(member.family_id, id, results);
  });
  if (result.error) return result;
  revalidatePath('/', 'layout');
  redirect(`/results/${id}`);
}

export async function overrideItemAction(itemId: string, isCorrect: boolean): Promise<ActionState> {
  return run(async () => {
    const { user, member } = await parentCtx();
    await repo.overrideItem(member.family_id, user.id, uuid.parse(itemId), z.boolean().parse(isCorrect));
    revalidatePath('/', 'layout');
  });
}

export async function cancelTestAction(testId: string): Promise<ActionState> {
  return run(async () => {
    const { user, member } = await parentCtx();
    await repo.cancelTest(member.family_id, user.id, uuid.parse(testId));
    revalidatePath('/', 'layout');
    return { message: '진행 중이던 시험을 취소했어요.' };
  });
}

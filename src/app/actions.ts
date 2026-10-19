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
import { hashPin, isValidPin } from '@/lib/domain/parentToken';
import { safeInternalPath } from '@/lib/domain/safePath';
import { requireUser } from '@/lib/server/auth';
import {
  clearSelectedLearner,
  getMembershipOnce,
  requireLearner,
  requireMember,
  setSelectedLearner,
} from '@/lib/server/context';
import {
  clearParentUnlocked,
  ParentLockedError,
  isParentMode,
  requireParent,
  setParentUnlocked,
  verifyParentPin,
} from '@/lib/server/parent';
import { CONSENT_KINDS, LEGAL_VERSION } from '@/lib/legal';
import * as repo from '@/lib/server/repo';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
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

/** 필수 동의 항목이 모두 체크됐는지 (체크박스 name="consent") */
function parseConsents(formData: FormData): string[] {
  const kinds = formData.getAll('consent').map(String);
  if (!CONSENT_KINDS.every((k) => kinds.includes(k))) {
    throw new repo.DomainError('필수 약관에 모두 동의해 주세요.');
  }
  return [...CONSENT_KINDS];
}

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
  revalidatePath('/', 'layout'); // 같은 기기의 다음 사용자에게 이전 계정 화면 캐시가 보이지 않도록
  redirect('/login');
}

export async function createFamilyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await run(async () => {
    const consents = parseConsents(formData);
    await repo.createFamily(
      user.id,
      z.string().trim().min(1, '가족 이름을 입력해 주세요.').max(30).parse(formData.get('family_name')),
      personNameSchema.parse(formData.get('display_name'))
    );
    // 가족 생성 직후 기록. 실패해도 다음 화면에서 /consent 로 다시 받는다(자가 복구).
    await repo.recordConsent(user.id, LEGAL_VERSION, consents);
  });
  if (result.error) return result;
  revalidatePath('/', 'layout');
  redirect('/profiles');
}

export async function joinFamilyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await run(async () => {
    const code = normalizeInviteCode(String(formData.get('code') ?? ''));
    if (code.length !== 8) return { error: '초대코드 8자리를 입력해 주세요.' };
    const consents = parseConsents(formData);
    await repo.joinFamily(user.id, hashInviteCode(code), personNameSchema.parse(formData.get('display_name')));
    await repo.recordConsent(user.id, LEGAL_VERSION, consents);
  });
  if (result.error) return result;
  revalidatePath('/', 'layout');
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
    const ok = await verifyParentPin(member.family_id, String(formData.get('pin') ?? ''));
    if (ok === null) return { message: '아직 PIN이 없어요. 아래에서 먼저 설정해 주세요.' };
    if (!ok) return { error: 'PIN이 맞지 않아요. (5번 틀리면 잠시 잠겨요)' };
    await setParentUnlocked(user.id);
  });
  if (result.error || result.message) return result;
  revalidatePath('/', 'layout');
  redirect(safeInternalPath(formData.get('next'), '/settings'));
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
  revalidatePath('/', 'layout'); // 다른 자녀의 캐시된 화면이 보이지 않도록
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
    return { message: '로그인 계정을 삭제했어요. (단어와 시험 기록은 그대로예요)' };
  });
}

/** 자녀 프로필 삭제 (단어·시험 기록과 자녀 로그인 계정까지). 부모 모드 + 이름 재입력 확인. */
export async function deleteLearnerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let deletedName = '';
  const result = await run(async () => {
    const { user, member } = await parentCtx();
    const learnerId = uuid.parse(formData.get('learner_id'));
    const learner = await repo.getLearner(member.family_id, learnerId);
    if (!learner) return { error: '자녀를 찾을 수 없어요.' };
    if (String(formData.get('confirm_name') ?? '').trim() !== learner.name) {
      return { error: `확인을 위해 이름 '${learner.name}'을(를) 정확히 입력해 주세요.` };
    }
    await repo.deleteLearner(member.family_id, learnerId);
    console.info('[audit] learner deleted', { family: member.family_id, learner: learnerId, by: user.id });
    deletedName = learner.name;
  });
  if (result.error || !deletedName) return result;
  revalidatePath('/', 'layout');
  // 삭제된 자녀의 폼은 화면에서 사라지므로 결과는 설정 화면 상단에 표시
  // 이름은 URL·방문 통계에 남지 않도록 플래그만
  redirect('/settings?removed=1');
}

// ================================================================ 동의 / 탈퇴

/** 약관 재동의 (기존 가입자, 문서 개정 시). requireMember 는 동의 전이라 /consent 로 보내므로 직접 확인한다. */
export async function recordConsentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await run(async () => {
    const member = await getMembershipOnce(user.id);
    if (!member) return { error: '가족 정보가 없어요.' };
    if (member.role !== 'parent') return { error: '부모님 계정에서만 동의할 수 있어요.' };
    await repo.recordConsent(user.id, LEGAL_VERSION, parseConsents(formData));
  });
  if (result.error) return result;
  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * 부모 회원 탈퇴. 비밀번호 재확인 + '탈퇴' 입력. 다른 부모가 있으면 본인만, 마지막 부모면 가족 전체 삭제.
 * 부모 모드(PIN)는 요구하지 않는다: 비밀번호 재확인이 더 강하고, 탈퇴는 본인 계정에 대한 권리이므로.
 */
export async function deleteAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await run(async () => {
    const member = await getMembershipOnce(user.id);
    if (member?.role === 'child') return { error: '아이 계정은 부모님이 설정에서 지울 수 있어요.' };
    if (String(formData.get('confirm') ?? '').trim() !== '탈퇴') return { error: "확인 칸에 '탈퇴'라고 입력해 주세요." };
    if (!user.email) return { error: '계정 정보를 확인할 수 없어요.' };
    // 부모 PIN 이 있으면 부모 모드이거나 PIN 을 함께 입력해야 한다
    // (부모 계정으로 로그인된 기기를 아이가 쓰는 상황에서 가족 전체 삭제 방지)
    if (member && !(await isParentMode(user.id, member.family_id))) {
      const pinOk = await verifyParentPin(member.family_id, String(formData.get('pin') ?? ''));
      if (pinOk === false) return { error: '부모 PIN이 맞지 않아요. (5번 틀리면 잠시 잠겨요)' };
    }
    // 비밀번호 재확인: 세션을 저장하지 않는 별도 클라이언트로 로그인 시도
    const verifier = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    // Supabase CAPTCHA 보호가 켜져 있으면 이 로그인에도 Turnstile 토큰이 필요하다 (폼의 hidden 필드)
    const captchaToken = String(formData.get('captcha_token') ?? '').trim();
    const { error: authError } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: String(formData.get('password') ?? ''),
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    if (authError) {
      // src/lib/captcha.ts 의 isCaptchaError / CAPTCHA_FAILED_MESSAGE 와 같은 규칙
      if (authError.message.toLowerCase().includes('captcha')) return { error: '사람 확인이 실패했어요. 다시 시도해 주세요.' };
      return { error: '비밀번호가 맞지 않아요.' };
    }
    await verifier.auth.signOut({ scope: 'local' }).catch(() => {});

    const { familyDeleted, kidAccounts } = await repo.deleteParentAccount(user.id);
    console.info('[audit] account deleted', { user: user.id, family: member?.family_id, familyDeleted, kidAccounts });
  });
  if (result.error) return result;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut().catch(() => {});
  await clearParentUnlocked();
  await clearSelectedLearner();
  revalidatePath('/', 'layout');
  redirect('/login?deleted=1');
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
    revalidatePath('/', 'layout');
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
  revalidatePath('/', 'layout');
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
  revalidatePath('/', 'layout');
  redirect(`/test/${testId}`);
}

const answersSchema = z.record(z.string(), z.string().max(200));

/** 채점은 서버에서만. 클라이언트는 문항 id → 답안 문자열만 보낸다. */
export async function submitTestAction(testId: string, answers: Record<string, string>): Promise<ActionState> {
  const id = uuid.parse(testId);
  const result = await run(async () => {
    const { member, learner } = await requireLearner();
    const parsed = answersSchema.parse(answers);
    const test = await repo.getTest(member.family_id, id);
    if (!test || test.learner_id !== learner.id) return { error: '시험을 찾을 수 없어요.' };
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

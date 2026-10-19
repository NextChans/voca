import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser, type SessionUser } from '@/lib/server/auth';
import { LEGAL_VERSION } from '@/lib/legal';
import * as repo from '@/lib/server/repo';

const LEARNER_COOKIE = 'voca_learner';

export interface MemberContext {
  user: SessionUser;
  member: repo.Membership;
}
export interface LearnerContext extends MemberContext {
  learner: repo.Learner;
}

/** 요청당 1회만 소속 조회 (requireMember 와 isParentMode 가 공유) */
export const getMembershipOnce = cache(repo.getMembership);

/** 로그인 + 가족 소속 확인. 가족이 없으면 온보딩으로. */
export const requireMember = cache(async (): Promise<MemberContext> => {
  const user = await requireUser();
  const member = await getMembershipOnce(user.id);
  if (!member) redirect('/onboarding');
  // 부모는 현재 버전의 약관·처리방침 동의가 있어야 이용 가능 (자녀 계정은 부모가 대신 동의)
  if (member.role === 'parent' && member.consent_version !== LEGAL_VERSION) redirect('/consent');
  return { user, member };
});

/** 현재 기기에서 선택된 자녀 (쿠키). 다른 가족의 id 이거나 삭제됐으면 null. */
export const getSelectedLearner = cache(async (familyId: string): Promise<repo.Learner | null> => {
  const id = (await cookies()).get(LEARNER_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return repo.getLearner(familyId, id);
});

/** 현재 학습자: 자녀 계정이면 본인 프로필에 고정, 부모 계정이면 기기에서 선택한 프로필 */
export async function getCurrentLearner(member: repo.Membership): Promise<repo.Learner | null> {
  if (member.role === 'child') {
    return member.learner_id ? repo.getLearner(member.family_id, member.learner_id) : null;
  }
  return getSelectedLearner(member.family_id);
}

export async function requireLearner(): Promise<LearnerContext> {
  const ctx = await requireMember();
  const learner = await getCurrentLearner(ctx.member);
  if (!learner) redirect(ctx.member.role === 'child' ? '/login' : '/profiles');
  return { ...ctx, learner };
}

export async function setSelectedLearner(learnerId: string): Promise<void> {
  (await cookies()).set(LEARNER_COOKIE, learnerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSelectedLearner(): Promise<void> {
  (await cookies()).delete(LEARNER_COOKIE);
}

import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser, type SessionUser } from '@/lib/server/auth';
import * as repo from '@/lib/server/repo';

const LEARNER_COOKIE = 'voca_learner';

export interface MemberContext {
  user: SessionUser;
  member: repo.Membership;
}
export interface LearnerContext extends MemberContext {
  learner: repo.Learner;
}

/** 로그인 + 가족 소속 확인. 가족이 없으면 온보딩으로. */
export const requireMember = cache(async (): Promise<MemberContext> => {
  const user = await requireUser();
  const member = await repo.getMembership(user.id);
  if (!member) redirect('/onboarding');
  return { user, member };
});

/** 현재 기기에서 선택된 자녀 (쿠키). 다른 가족의 id 이거나 삭제됐으면 null. */
export const getSelectedLearner = cache(async (familyId: string): Promise<repo.Learner | null> => {
  const id = (await cookies()).get(LEARNER_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return repo.getLearner(familyId, id);
});

export async function requireLearner(): Promise<LearnerContext> {
  const ctx = await requireMember();
  const learner = await getSelectedLearner(ctx.member.family_id);
  if (!learner) redirect('/profiles');
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

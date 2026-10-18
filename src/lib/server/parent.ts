import 'server-only';
import { cookies } from 'next/headers';
import { issueUnlockToken, verifyUnlockToken } from '@/lib/domain/parentToken';
import { serverEnv } from '@/lib/server/env';
import { getMembershipOnce } from '@/lib/server/context';
import { getPinState } from '@/lib/server/repo';

const COOKIE = 'voca_parent';
const TTL_MS = 30 * 60 * 1000;

/**
 * 부모 모드 여부. 가족 PIN 이 아직 없으면 최초 설정을 위해 부모 모드로 간주한다
 * (화면 곳곳에서 PIN 설정을 유도). 토큰은 로그인한 부모 계정에 묶인다.
 */
export async function isParentMode(
  userId: string,
  familyId: string,
  /** 호출 측이 이미 조회한 PIN 상태 (레이아웃의 중복 조회 방지) */
  pinState?: { parent_pin_hash: string | null }
): Promise<boolean> {
  // 자녀 계정은 PIN 을 알더라도 부모 모드가 될 수 없다
  const member = await getMembershipOnce(userId);
  if (member?.role !== 'parent' || member.family_id !== familyId) return false;
  const { parent_pin_hash } = pinState ?? (await getPinState(familyId));
  if (!parent_pin_hash) return true;
  const token = (await cookies()).get(COOKIE)?.value;
  return verifyUnlockToken(token, userId, serverEnv.appSecret());
}

export async function requireParent(userId: string, familyId: string): Promise<void> {
  if (!(await isParentMode(userId, familyId))) throw new ParentLockedError();
}

export async function setParentUnlocked(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, issueUnlockToken(userId, TTL_MS, serverEnv.appSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  });
}

export async function clearParentUnlocked(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export class ParentLockedError extends Error {
  constructor() {
    super('부모 모드에서만 할 수 있어요. 설정에서 PIN으로 잠금을 해제해 주세요.');
  }
}

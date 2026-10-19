import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/actions';
import { formatLegalDate, LEGAL_VERSION } from '@/lib/legal';
import { requireUser } from '@/lib/server/auth';
import { getMembershipOnce } from '@/lib/server/context';
import { DeleteAccountForm } from '@/components/DeleteAccountForm';
import { isParentMode } from '@/lib/server/parent';
import * as repo from '@/lib/server/repo';
import { ConsentForm } from './ConsentForm';

export const metadata: Metadata = { title: '약관 동의' };

/** 기존 가입자 또는 문서 개정 시 재동의. requireMember 가 동의 버전이 다르면 여기로 보낸다. */
export default async function ConsentPage() {
  const user = await requireUser();
  const member = await getMembershipOnce(user.id);
  if (!member) redirect('/onboarding');
  if (member.role !== 'parent' || member.consent_version === LEGAL_VERSION) redirect('/');
  const [members, pin, parentMode] = await Promise.all([
    repo.listMembers(member.family_id),
    repo.getPinState(member.family_id),
    isParentMode(user.id, member.family_id),
  ]);
  const lastParent = members.length <= 1;
  const needsPin = !!pin.parent_pin_hash && !parentMode;

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6 text-center">
        <div className="text-5xl" aria-hidden>
          📄
        </div>
        <h1 className="mt-3 text-2xl font-bold">약관 동의가 필요해요</h1>
        <p className="mt-2 text-sm text-slate-500">
          {member.consent_version ? '약관·개인정보 처리방침이 바뀌었어요.' : 'voca를 계속 쓰려면 아래 내용에 동의해 주세요.'}{' '}
          ({formatLegalDate()} 시행)
        </p>
      </div>
      <section className="card">
        <ConsentForm />
      </section>
      <details className="card mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">동의하지 않고 탈퇴할래요</summary>
        <div className="mt-3">
          <DeleteAccountForm lastParent={lastParent} needsPin={needsPin} />
        </div>
      </details>
      <p className="mt-4 text-center text-xs text-slate-500">
        <Link href="/terms" className="underline">
          이용약관
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="underline">
          개인정보 처리방침
        </Link>
      </p>
      <form action={signOutAction} className="mt-6 text-center">
        <button type="submit" className="btn-ghost text-sm">
          로그아웃
        </button>
      </form>
    </main>
  );
}

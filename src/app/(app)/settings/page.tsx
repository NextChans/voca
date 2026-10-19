import type { Metadata } from 'next';
import Link from 'next/link';
import { safeInternalPath } from '@/lib/domain/safePath';
import { DeleteAccountForm } from '@/components/DeleteAccountForm';
import { lockParentAction, signOutAction } from '@/app/actions';
import { requireMember } from '@/lib/server/context';
import { isParentMode } from '@/lib/server/parent';
import * as repo from '@/lib/server/repo';
import {
  CancelTestButton,
  DeleteLearnerForm,
  InviteCreator,
  LearnerLoginForm,
  LearnerSettingsForm,
  SetPinForm,
  UnlockForm,
} from './SettingsForms';

export const metadata: Metadata = { title: '설정' };

function safeNext(next: string | string[] | undefined): string {
  return safeInternalPath(Array.isArray(next) ? next[0] : next, '/settings');
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, member } = await requireMember();
  const familyId = member.family_id;
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const removed = sp.removed === '1';

  const [pinState, parentMode] = await Promise.all([
    repo.getPinState(familyId),
    isParentMode(user.id, familyId),
  ]);
  const hasPin = !!pinState.parent_pin_hash;

  const [learners, members] = parentMode
    ? await Promise.all([repo.listLearners(familyId), repo.listMembers(familyId)])
    : [[], []];
  const inProgress = parentMode
    ? await Promise.all(learners.map((l) => repo.getInProgressTest(familyId, l.id)))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">⚙️ 설정</h1>
      {removed && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          자녀 프로필과 기록을 모두 삭제했어요.
        </p>
      )}

      {/* a. 부모 모드 (자녀 계정에는 표시하지 않음) */}
      {member.role === 'parent' && (
      <section className="card space-y-3" aria-labelledby="parent-mode-title">
        <h2 id="parent-mode-title" className="text-lg font-bold">
          부모 모드
        </h2>
        {!parentMode ? (
          <>
            <p className="text-sm text-slate-600">
              🔒 지금은 자녀 모드예요. 단어 관리·채점 수정·설정은 부모님 PIN으로 잠금을 풀어야 해요.
            </p>
            <UnlockForm next={next} />
          </>
        ) : hasPin ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">🔓 부모 모드가 켜져 있어요. 30분 뒤 자동으로 잠겨요.</p>
            <form action={lockParentAction}>
              <button type="submit" className="btn-secondary">
                🔒 잠그기
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-slate-600">PIN을 정하면 부모 모드를 잠글 수 있어요.</p>
        )}
      </section>
      )}

      {parentMode && (
        <>
          {/* b. PIN */}
          <section className="card space-y-3" aria-labelledby="pin-title">
            <h2 id="pin-title" className="text-lg font-bold">
              PIN {hasPin ? '변경' : '설정'}
            </h2>
            {!hasPin && (
              <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                ⚠️ 아직 PIN이 없어서 <b>누구나</b> 단어·시험·설정을 바꿀 수 있어요. 지금 PIN을 정해 주세요!
              </p>
            )}
            <SetPinForm hasPin={hasPin} />
          </section>

          {/* c. 자녀별 설정 */}
          <section className="card space-y-4" aria-labelledby="learners-title">
            <h2 id="learners-title" className="text-lg font-bold">
              자녀별 설정
            </h2>
            {learners.length === 0 ? (
              <p className="text-sm text-slate-500">
                아직 자녀 프로필이 없어요. 프로필 화면에서 추가해 주세요.
              </p>
            ) : (
              <ul className="space-y-4">
                {learners.map((l, i) => {
                  const test = inProgress[i];
                  return (
                    <li key={l.id} className="rounded-xl border border-slate-200 p-4">
                      <LearnerSettingsForm learner={l} />
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <LearnerLoginForm learner={l} />
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <DeleteLearnerForm learner={l} />
                      </div>
                      {test && (
                        <div className="mt-4 rounded-xl bg-amber-50 p-3">
                          <p className="text-sm text-amber-900">
                            ✏️ 진행 중인 {test.kind === 'regular' ? '정기 시험' : '재시험'}이 있어요 (
                            {test.total}문제). 취소하면 이번 주 횟수에서 빠지고, 단어는 다시 출제 대상이
                            돼요.
                          </p>
                          <CancelTestButton testId={test.id} learnerName={l.name} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* d. 가족 구성원 */}
          <section className="card space-y-3" aria-labelledby="members-title">
            <h2 id="members-title" className="text-lg font-bold">
              가족 구성원
            </h2>
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between py-2">
                  <span className="font-medium">
                    {m.display_name}
                    {m.user_id === user.id && <span className="badge ml-2 bg-slate-100 text-slate-600">나</span>}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(
                      new Date(m.joined_at)
                    )}{' '}
                    합류
                  </span>
                </li>
              ))}
            </ul>
            <InviteCreator />
          </section>
        </>
      )}

      {/* e. 계정 */}
      <section className="card space-y-3" aria-labelledby="account-title">
        <h2 id="account-title" className="text-lg font-bold">
          계정
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">로그인</dt>
          <dd className="break-all">
            {member.role === 'child' ? `${member.display_name} 전용 아이디` : (user.email ?? '-')}
          </dd>
          <dt className="text-slate-500">가족</dt>
          <dd>{member.family_name}</dd>
          <dt className="text-slate-500">내 이름</dt>
          <dd>{member.display_name}</dd>
        </dl>
        <form action={signOutAction}>
          <button type="submit" className="btn-secondary">
            로그아웃
          </button>
        </form>
      </section>

      {/* f. 회원 탈퇴 (부모 모드에서만, 비밀번호 재확인) */}
      {parentMode && member.role === 'parent' && (
        <section id="delete-account" className="card space-y-3" aria-labelledby="delete-account-title">
          <details>
            <summary id="delete-account-title" className="cursor-pointer text-lg font-bold text-rose-700">
              회원 탈퇴
            </summary>
            <div className="mt-3">
              <DeleteAccountForm lastParent={members.length <= 1} />
            </div>
          </details>
        </section>
      )}

      <p className="text-center text-xs text-slate-400">
        <Link href="/terms" className="underline">
          이용약관
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="underline">
          개인정보 처리방침
        </Link>
      </p>

      {!parentMode && member.role === 'parent' && (
        <p className="text-center text-xs text-slate-400">
          자녀 설정·PIN 변경·가족 초대는 부모 모드에서 볼 수 있어요.
        </p>
      )}
    </div>
  );
}

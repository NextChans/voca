import type { Metadata } from 'next';
import { selectLearnerAction } from '@/app/actions';
import { ParentLockNotice } from '@/components/ParentLockNotice';
import { getSelectedLearner, requireMember } from '@/lib/server/context';
import { isParentMode } from '@/lib/server/parent';
import * as repo from '@/lib/server/repo';
import { AddLearnerForm } from './AddLearnerForm';

export const metadata: Metadata = { title: '누가 공부하나요?' };

export default async function ProfilesPage() {
  const { user, member } = await requireMember();
  const familyId = member.family_id;
  const [learners, selected, parentMode] = await Promise.all([
    repo.listLearners(familyId),
    getSelectedLearner(familyId),
    isParentMode(user.id, familyId),
  ]);

  const summaries = await Promise.all(
    learners.map(async (l) => {
      const [used, last] = await Promise.all([
        repo.countRegularTestsThisWeek(familyId, l.id),
        repo.listTests(familyId, l.id, { status: 'submitted', limit: 1 }),
      ]);
      return { learner: l, used, last: last[0] ?? null };
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-bold">누가 공부하나요? 🙋</h1>

      {learners.length === 0 ? (
        <div className="card text-center">
          <div className="text-5xl" aria-hidden>
            🐣
          </div>
          <p className="mt-3 font-semibold">아직 자녀 프로필이 없어요.</p>
          <p className="mt-1 text-sm text-slate-500">
            {parentMode ? '아래에서 아이 이름과 캐릭터를 골라 추가해 주세요.' : '부모님이 먼저 프로필을 추가해 주세요.'}
          </p>
          {!parentMode && (
            <div className="mt-4 text-left">
              <ParentLockNotice next="/profiles" what="자녀 추가" />
            </div>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {summaries.map(({ learner, used, last }) => {
            const isSelected = selected?.id === learner.id;
            const pct = last && last.correct != null ? Math.round((last.correct / last.total) * 100) : null;
            return (
              <li key={learner.id}>
                <form action={selectLearnerAction.bind(null, learner.id)}>
                  <button
                    type="submit"
                    aria-pressed={isSelected}
                    aria-label={`${learner.name}${isSelected ? ' (선택됨)' : ''} 로 공부하기`}
                    className={`flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition active:scale-[0.98] ${
                      isSelected
                        ? 'border-brand-500 ring-4 ring-brand-100'
                        : 'border-slate-200 hover:border-brand-500'
                    }`}
                  >
                    <span className="text-6xl leading-none" aria-hidden>
                      {learner.avatar}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-xl font-bold">{learner.name}</span>
                        {isSelected && <span className="badge bg-brand-100 text-brand-700">지금 선택</span>}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        이번 주 시험 {used}/{learner.weekly_limit}회
                      </span>
                      <span className="block text-sm text-slate-500">
                        {last && last.correct != null
                          ? `최근 점수 ${last.correct}/${last.total} (${pct}%)`
                          : '아직 본 시험이 없어요'}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {parentMode ? (
        <section className="card" aria-labelledby="add-learner-title">
          <h2 id="add-learner-title" className="text-lg font-bold">
            ➕ 자녀 추가
          </h2>
          <AddLearnerForm />
        </section>
      ) : (
        learners.length > 0 && <ParentLockNotice next="/profiles" what="자녀 추가" />
      )}
    </div>
  );
}

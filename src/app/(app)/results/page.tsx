import Link from 'next/link';
import { requireLearner } from '@/lib/server/context';
import * as repo from '@/lib/server/repo';
import { MODE_LABEL } from '@/lib/domain/types';
import { formatKst, weekRangeLabel } from '@/lib/domain/week';
import { percent, scoreBarClass, scoreTextClass } from './_components/score';

export const metadata = { title: '시험 기록' };

export default async function ResultsPage() {
  const { member, learner } = await requireLearner();
  const tests = await repo.listTests(member.family_id, learner.id, { limit: 200 });

  // 최근 정기 시험 10개 (오래된 것 → 최신 순으로 그래프)
  const recentRegular = tests
    .filter((t) => t.kind === 'regular' && t.status === 'submitted')
    .slice(0, 10)
    .reverse();
  const avg =
    recentRegular.length > 0
      ? Math.round(recentRegular.reduce((s, t) => s + percent(t.correct, t.total), 0) / recentRegular.length)
      : null;

  // 주간별 묶기 (listTests 는 최신순)
  const groups: { week: string; tests: repo.TestRow[] }[] = [];
  for (const t of tests) {
    const last = groups.at(-1);
    if (last && last.week === t.week_start) last.tests.push(t);
    else groups.push({ week: t.week_start, tests: [t] });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">📊 {learner.name}의 시험 기록</h1>

      <section className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">최근 정기 시험 점수</h2>
          {avg !== null && (
            <span className="text-sm text-slate-500">
              평균 <b className={`text-lg ${scoreTextClass(avg)}`}>{avg}%</b>
            </span>
          )}
        </div>
        {recentRegular.length === 0 ? (
          <p className="py-8 text-center text-slate-500">아직 정기 시험 기록이 없어요. 첫 시험을 기다리고 있어요! ✨</p>
        ) : (
          <div className="relative mt-4">
            {avg !== null && (
              <div
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-slate-300"
                style={{ bottom: `calc(${avg}% * 0.75 + 1.5rem)` }}
                aria-hidden
              />
            )}
            <ol className="flex h-48 items-end gap-2" aria-label="최근 정기 시험 점수 그래프">
              {recentRegular.map((t) => {
                const pct = percent(t.correct, t.total);
                return (
                  <li key={t.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                    <Link
                      href={`/results/${t.id}`}
                      className="flex h-full w-full flex-col items-center justify-end"
                      title={`${formatKst(t.submitted_at ?? t.started_at, false)} ${pct}%`}
                    >
                      <span className={`text-xs font-bold ${scoreTextClass(pct)}`}>{pct}</span>
                      <span
                        className={`w-full max-w-10 rounded-t-lg ${scoreBarClass(pct)}`}
                        style={{ height: `${Math.max(pct, 2) * 0.75}%` }}
                      />
                      <span className="mt-1 h-5 w-full truncate text-center text-[10px] text-slate-500">
                        {formatKst(t.submitted_at ?? t.started_at, false).replace(/\s*\(.*\)$/, '')}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      {groups.length === 0 ? (
        <section className="card text-center">
          <p className="text-4xl">📝</p>
          <p className="mt-2 text-slate-600">아직 본 시험이 없어요.</p>
          <Link href="/test/new" className="btn-primary mt-4">
            시험 보러 가기
          </Link>
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.week}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500">🗓️ {weekRangeLabel(g.week)}</h2>
            <ul className="space-y-2">
              {g.tests.map((t) => {
                const pct = percent(t.correct, t.total);
                const href = t.status === 'in_progress' ? `/test/${t.id}` : `/results/${t.id}`;
                const muted = t.status === 'cancelled';
                return (
                  <li key={t.id}>
                    <Link
                      href={href}
                      className={`card flex items-center gap-3 p-4 transition hover:border-brand-500 ${
                        muted ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`badge ${
                              t.kind === 'regular' ? 'bg-brand-100 text-brand-700' : 'bg-violet-100 text-violet-700'
                            }`}
                          >
                            {t.kind === 'regular' ? '정기' : '재시험'}
                          </span>
                          <span className="badge bg-slate-100 text-slate-600">{MODE_LABEL[t.mode]}</span>
                          {t.status === 'cancelled' && <span className="badge bg-slate-200 text-slate-600">취소됨</span>}
                          {t.status === 'in_progress' && (
                            <span className="badge bg-amber-100 text-amber-800">푸는 중</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{formatKst(t.submitted_at ?? t.started_at)}</p>
                      </div>
                      {t.status === 'submitted' ? (
                        <div className="text-right">
                          <p className={`text-2xl font-extrabold ${scoreTextClass(pct)}`}>{pct}%</p>
                          <p className="text-xs text-slate-500">
                            {t.correct} / {t.total}
                          </p>
                        </div>
                      ) : t.status === 'in_progress' ? (
                        <span className="text-sm font-semibold text-brand-600">이어서 풀기 →</span>
                      ) : (
                        <span className="text-sm text-slate-400">{t.total}문제</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

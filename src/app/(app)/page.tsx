import Link from 'next/link';
import { requireLearner } from '@/lib/server/context';
import * as repo from '@/lib/server/repo';
import { formatKst, isTestableWord, kstWeekStart, weekRangeLabel } from '@/lib/domain/week';

type Status =
  | { kind: 'in_progress'; testId: string }
  | { kind: 'limit' }
  | { kind: 'not_enough'; missing: number }
  | { kind: 'ready' };

export default async function HomePage() {
  const { member, learner } = await requireLearner();
  const familyId = member.family_id;

  const [used, words, testedIds, inProgress, recent] = await Promise.all([
    repo.countRegularTestsThisWeek(familyId, learner.id),
    repo.listWords(familyId, learner.id),
    repo.listRegularTestedWordIds(familyId, learner.id),
    repo.getInProgressTest(familyId, learner.id),
    repo.listTests(familyId, learner.id, { status: 'submitted', limit: 5 }),
  ]);

  const now = new Date();
  let testable = 0;
  let today = 0;
  for (const w of words) {
    if (!isTestableWord(w.created_at, now)) today++;
    else if (!testedIds.has(w.id)) testable++;
  }

  const limit = learner.weekly_limit;
  const minWords = learner.min_test_words;
  const status: Status = inProgress
    ? { kind: 'in_progress', testId: inProgress.id }
    : used >= limit
      ? { kind: 'limit' }
      : testable < minWords
        ? { kind: 'not_enough', missing: minWords - testable }
        : { kind: 'ready' };

  const progressPct = Math.min(100, Math.round((testable / Math.max(1, minWords)) * 100));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        <span aria-hidden>{learner.avatar}</span> {learner.name}, 안녕! 오늘도 화이팅 💪
      </h1>

      <section className="card space-y-4" aria-labelledby="week-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="week-title" className="text-lg font-bold">
            이번 주 시험
          </h2>
          <span className="text-sm text-slate-500">{weekRangeLabel(kstWeekStart(now))}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">본 시험</p>
            <p className="text-2xl font-bold">
              {used}
              <span className="text-base font-medium text-slate-400"> / {limit}회</span>
            </p>
            <div className="mt-2 flex gap-1" aria-hidden>
              {Array.from({ length: limit }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full ${i < used ? 'bg-brand-500' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">시험 볼 수 있는 단어</p>
            <p className="text-2xl font-bold">
              {testable}
              <span className="text-base font-medium text-slate-400"> / {minWords}개</span>
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label="시험 가능한 단어 수"
              aria-valuemin={0}
              aria-valuemax={minWords}
              aria-valuenow={Math.min(testable, minWords)}
            >
              <div
                className={`h-full rounded-full ${testable >= minWords ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {today > 0 && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
            🌙 오늘 등록한 {today}개는 내일부터 시험에 나와요.
          </p>
        )}

        <StatusBox status={status} />
      </section>

      <Link
        href="/practice"
        className="card flex items-center gap-3 border-emerald-200 bg-emerald-50 transition hover:bg-emerald-100"
      >
        <span className="text-3xl">🔁</span>
        <span className="flex-1">
          <span className="block font-bold text-emerald-900">오답 연습</span>
          <span className="block text-sm text-emerald-800">틀렸던 단어를 카드·쓰기로 마음껏 연습해요 (점수에 안 들어가요)</span>
        </span>
        <span className="text-emerald-700">→</span>
      </Link>

      <section className="card" aria-labelledby="recent-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-title" className="text-lg font-bold">
            최근 결과
          </h2>
          <Link href="/results" className="text-sm font-semibold text-brand-600">
            전체 보기 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">아직 제출한 시험이 없어요. 첫 시험을 기다리고 있어요! ✨</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((t) => {
              const correct = t.correct ?? 0;
              const pct = Math.round((correct / t.total) * 100);
              const wrong = t.total - correct;
              return (
                <li key={t.id}>
                  <Link
                    href={`/results/${t.id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50"
                  >
                    <span
                      className={`badge ${
                        t.kind === 'regular' ? 'bg-brand-100 text-brand-700' : 'bg-violet-100 text-violet-700'
                      }`}
                    >
                      {t.kind === 'regular' ? '정기' : '재시험'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-500">
                        {formatKst(t.submitted_at ?? t.started_at)}
                      </span>
                      {wrong > 0 && (
                        <span className="block text-xs font-medium text-amber-700">
                          🔁 틀린 {wrong}개 재시험 가능
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="block font-bold">
                        {correct}/{t.total}
                      </span>
                      <span className={`block text-sm ${scoreColor(pct)}`}>{pct}%</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function scoreColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-600';
  if (pct >= 70) return 'text-brand-600';
  return 'text-amber-600';
}

function StatusBox({ status }: { status: Status }) {
  switch (status.kind) {
    case 'in_progress':
      return (
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">✏️ 풀다 만 시험이 있어요.</p>
          <Link href={`/test/${status.testId}`} className="btn-primary mt-3 w-full py-3 text-base">
            이어서 풀기
          </Link>
        </div>
      );
    case 'limit':
      return (
        <p className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">
          🎉 이번 주 시험을 모두 봤어요! 다음 주 월요일에 다시 만나요.
        </p>
      );
    case 'not_enough':
      return (
        <p className="rounded-xl bg-slate-100 p-4 text-slate-700">
          📚 단어가 {status.missing}개 더 있으면 시험을 볼 수 있어요.
          <Link href="/words" className="ml-1 font-semibold text-brand-600 underline">
            단어 보러 가기
          </Link>
        </p>
      );
    case 'ready':
      return (
        <Link href="/test/new" className="btn-primary w-full py-4 text-lg">
          🚀 시험 시작하기
        </Link>
      );
  }
}

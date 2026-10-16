import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireLearner } from '@/lib/server/context';
import { isParentMode } from '@/lib/server/parent';
import * as repo from '@/lib/server/repo';
import { MODE_LABEL } from '@/lib/domain/types';
import { formatKst } from '@/lib/domain/week';
import { RetestButton } from '../../test/_components/RetestButton';
import { ClearSavedAnswers } from '../_components/ClearSavedAnswers';
import { ResultItems, type ResultItem } from '../_components/ResultItems';
import { percent, scoreFeedback, scoreTextClass } from '../_components/score';

export const metadata = { title: '시험 결과' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { user, member, learner } = await requireLearner();
  const fid = member.family_id;

  const test = await repo.getTest(fid, id);
  if (!test || test.learner_id !== learner.id) notFound();
  if (test.status === 'in_progress') redirect(`/test/${id}`);

  const [items, retests, members, parentMode, parentTest] = await Promise.all([
    repo.getTestItems(fid, id),
    repo.listRetestsOf(fid, id),
    repo.listMembers(fid),
    isParentMode(user.id, fid),
    test.parent_test_id ? repo.getTest(fid, test.parent_test_id) : Promise.resolve(null),
  ]);

  const nameOf = new Map(members.map((m) => [m.user_id, m.display_name]));
  const cancelled = test.status === 'cancelled';
  const correct = test.correct ?? 0;
  const pct = percent(correct, test.total);
  const wrong = test.total - correct;
  const feedback = scoreFeedback(pct);

  const resultItems: ResultItem[] = items.map((i) => ({
    id: i.id,
    seq: i.seq,
    direction: i.direction,
    term: i.term,
    prompt: i.direction === 'spelling' ? i.meaning : i.term,
    expected: i.direction === 'spelling' ? i.term : i.meaning,
    answer: i.answer ?? '',
    isCorrect: i.is_correct === true,
    overriddenByName: i.overridden_by ? (nameOf.get(i.overridden_by) ?? '가족') : null,
  }));

  return (
    <div className="space-y-5">
      <ClearSavedAnswers testId={id} />

      <Link href="/results" className="btn-ghost -ml-2 px-2">
        ← 기록 목록
      </Link>

      {/* 점수 헤더 */}
      <section className={`card text-center ${cancelled ? 'opacity-60' : ''}`}>
        <div className="flex flex-wrap justify-center gap-1.5">
          <span
            className={`badge ${
              test.kind === 'regular' ? 'bg-brand-100 text-brand-700' : 'bg-violet-100 text-violet-700'
            }`}
          >
            {test.kind === 'regular' ? '정기 시험' : '재시험'}
          </span>
          <span className="badge bg-slate-100 text-slate-600">{MODE_LABEL[test.mode]}</span>
          {cancelled && <span className="badge bg-slate-200 text-slate-600">취소됨</span>}
        </div>
        <p className="mt-2 text-sm text-slate-500">{formatKst(test.submitted_at ?? test.started_at)}</p>

        {cancelled ? (
          <p className="mt-4 text-slate-600">🛑 이 시험은 부모님이 취소했어요. 점수에 들어가지 않아요.</p>
        ) : (
          <>
            <p className="mt-3 text-6xl" aria-hidden>
              {feedback.emoji}
            </p>
            <p className={`mt-2 text-5xl font-black ${scoreTextClass(pct)}`}>{pct}점</p>
            <p className="mt-1 text-lg font-semibold text-slate-600">
              {test.total}문제 중 {correct}개 맞았어요
            </p>
            <p className="mt-2 text-slate-600">{feedback.text}</p>
          </>
        )}

        {parentTest && (
          <p className="mt-4 text-sm">
            <Link href={`/results/${parentTest.id}`} className="text-brand-600 underline">
              ↩ 원래 시험 보기 ({formatKst(parentTest.submitted_at ?? parentTest.started_at, false)}{' '}
              {parentTest.kind === 'retest' ? '재시험' : '정기 시험'})
            </Link>
          </p>
        )}
      </section>

      {/* 재시험 */}
      {!cancelled && wrong > 0 && (
        <section className="card border-violet-200 bg-violet-50 text-center">
          <p className="font-semibold text-violet-800">틀린 단어만 다시 풀어 볼까요? 재시험은 이번 주 횟수에 안 들어가요.</p>
          <RetestButton testId={id} className="btn-primary mt-3 h-14 w-full bg-violet-600 text-lg hover:bg-violet-700">
            🔁 틀린 {wrong}개 재시험 보기
          </RetestButton>
        </section>
      )}

      {retests.length > 0 && (
        <section className="card">
          <h2 className="font-bold">🔁 이 시험의 재시험</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {retests.map((r) => {
              const rp = percent(r.correct, r.total);
              return (
                <li key={r.id}>
                  <Link
                    href={r.status === 'in_progress' ? `/test/${r.id}` : `/results/${r.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:underline"
                  >
                    <span className="text-sm text-slate-600">{formatKst(r.submitted_at ?? r.started_at)}</span>
                    {r.status === 'submitted' ? (
                      <span className={`font-bold ${scoreTextClass(rp)}`}>
                        {r.correct}/{r.total} · {rp}% {rp === 100 ? '🏆' : ''}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-brand-600">푸는 중 · 이어서 풀기 →</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 문항 */}
      {!cancelled && (
        <>
          {parentMode && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              🔓 부모 모드: 유의어나 사소한 차이는 &lsquo;정답 인정&rsquo;으로 고칠 수 있어요.
            </p>
          )}
          <ResultItems items={resultItems} parentMode={parentMode} />
        </>
      )}
    </div>
  );
}

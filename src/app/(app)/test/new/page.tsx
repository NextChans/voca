import Link from 'next/link';
import { requireLearner } from '@/lib/server/context';
import * as repo from '@/lib/server/repo';
import { MODE_LABEL, testTitle } from '@/lib/domain/types';
import { formatKst, isTestableWord, kstDate, kstWeekStart } from '@/lib/domain/week';
import { BookTestForm, StartTestForm } from '../_components/StartTestForm';
import { RetestButton } from '../_components/RetestButton';

export const metadata = { title: '시험 보기' };

const MAX_ITEMS = 300; // DB create_test 의 1회 출제 한도 (넘치면 오래된 순 300개, 나머지는 다음 시험)

function nextMondayLabel(): string {
  const start = Date.parse(`${kstWeekStart()}T00:00:00Z`) + 7 * 24 * 60 * 60 * 1000;
  const d = new Date(start);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 월요일`;
}

export default async function NewTestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { member, learner } = await requireLearner();
  const fid = member.family_id;

  const [words, testedIds, usedThisWeek, inProgress, tests, books, params] = await Promise.all([
    repo.listWords(fid, learner.id),
    repo.listRegularTestedWordIds(fid, learner.id),
    repo.countRegularTestsThisWeek(fid, learner.id),
    repo.getInProgressTest(fid, learner.id),
    repo.listTests(fid, learner.id, { limit: 100 }),
    repo.listBooks(fid, learner.id),
    searchParams,
  ]);
  const bookCounts = new Map<string, number>();
  for (const w of words) if (w.book_id) bookCounts.set(w.book_id, (bookCounts.get(w.book_id) ?? 0) + 1);

  const now = new Date();
  const today = kstDate(now);
  const untested = words.filter((w) => !testedIds.has(w.id));
  const testable = untested.filter((w) => isTestableWord(w.created_at, now)).length;
  const addedToday = untested.filter((w) => kstDate(w.created_at) >= today).length;
  const limit = learner.weekly_limit;
  const minWords = learner.min_test_words;
  const weekFull = usedThisWeek >= limit;
  const enoughWords = testable >= minWords;
  const questionCount = Math.min(testable, MAX_ITEMS);
  const canStart = !inProgress && !weekFull && enoughWords;

  // 재시험 가능: 틀린 문항이 있고, 아직 그 시험에서 이어진 (제출된) 재시험이 없는 것 = 재시험 사슬의 끝
  const submittedChildOf = new Set(
    tests
      .filter((t) => t.kind === 'retest' && t.status === 'submitted' && t.parent_test_id)
      .map((t) => t.parent_test_id)
  );
  const retestable = tests
    .filter(
      (t) =>
        t.status === 'submitted' &&
        t.correct !== null &&
        t.correct < t.total &&
        !submittedChildOf.has(t.id)
    )
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">✏️ {learner.name}의 단어 시험</h1>

      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-sm text-slate-500">이번 주 시험</p>
          <p className="mt-1 text-3xl font-extrabold">
            <span className={weekFull ? 'text-rose-600' : 'text-brand-600'}>{usedThisWeek}</span>
            <span className="text-xl text-slate-400"> / {limit}회</span>
          </p>
          <div className="mt-2 flex gap-1" aria-hidden>
            {Array.from({ length: limit }, (_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${i < usedThisWeek ? 'bg-brand-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">시험 볼 수 있는 단어</p>
          <p className="mt-1 text-3xl font-extrabold">
            <span className={enoughWords ? 'text-emerald-600' : 'text-amber-600'}>{testable}</span>
            <span className="text-xl text-slate-400">개</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            최소 {minWords}개가 모여야 시험을 볼 수 있어요
          </p>
        </div>
      </section>

      {inProgress ? (
        <section className="card border-brand-100 bg-brand-50 text-center">
          <p className="text-4xl">📝</p>
          <p className="mt-2 text-lg font-bold">풀던 시험이 있어요!</p>
          <p className="mt-1 text-sm text-slate-600">
            {testTitle(inProgress)} · {MODE_LABEL[inProgress.mode]}{' '}
            · {inProgress.total}문제 · {formatKst(inProgress.started_at)} 시작
          </p>
          <Link href={`/test/${inProgress.id}`} className="btn-primary mt-4 h-14 w-full text-lg">
            이어서 풀기 →
          </Link>
          <p className="mt-3 text-xs text-slate-500">
            이 시험을 끝내야 새 시험을 볼 수 있어요. (취소는 부모님이 할 수 있어요)
          </p>
        </section>
      ) : canStart ? (
        <section className="card">
          <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {testable > MAX_ITEMS ? (
              <>
                🎯 쌓인 단어 {testable}개 중 먼저 등록한 <b>{questionCount}개</b>가 나와요. 나머지는
                다음 시험에!
              </>
            ) : (
              <>
                🎯 아직 시험 보지 않은 단어 <b>{testable}개</b>가 전부 나와요. 차근차근 해 봐요!
              </>
            )}
          </p>
          <StartTestForm count={questionCount} />
        </section>
      ) : (
        <section className="card text-center">
          {weekFull ? (
            <>
              <p className="text-4xl">🌙</p>
              <p className="mt-2 text-lg font-bold">이번 주 시험은 다 봤어요. 수고했어요!</p>
              <p className="mt-1 text-slate-600">
                다음 시험은 <b>{nextMondayLabel()}</b>부터 볼 수 있어요.
              </p>
              {!enoughWords && (
                <p className="mt-1 text-sm text-slate-500">
                  그때까지 단어 {minWords - testable}개를 더 모아 두면 좋아요.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-4xl">🌱</p>
              <p className="mt-2 text-lg font-bold">단어를 조금 더 모아 볼까요?</p>
              <p className="mt-1 text-slate-600">
                시험을 보려면 단어가 <b>{minWords - testable}개</b> 더 필요해요. ({testable} /{' '}
                {minWords})
              </p>
              {addedToday > 0 && (
                <p className="mt-1 text-sm text-slate-500">
                  오늘 등록한 단어 {addedToday}개는 내일부터 시험에 나와요.
                </p>
              )}
              <Link href="/words" className="btn-secondary mt-4">
                📚 단어 보러 가기
              </Link>
            </>
          )}
        </section>
      )}

      {books.length > 0 && (
        <section id="book-test" className="card scroll-mt-20">
          <h2 className="text-lg font-bold">📗 단어책 시험</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            고른 단어책의 단어로 시험을 봐요. 이번 주 횟수에 들어가지 않고, 정기 시험에 나올 단어도 그대로예요.
          </p>
          {inProgress ? (
            <p className="text-sm text-slate-500">풀던 시험을 끝내면 단어책 시험을 볼 수 있어요.</p>
          ) : (
            <BookTestForm
              books={books.map((b) => ({ ...b, count: bookCounts.get(b.id) ?? 0 }))}
              defaultBook={typeof params.book === 'string' ? params.book : null}
              maxItems={MAX_ITEMS}
            />
          )}
        </section>
      )}

      {retestable.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-bold">🔁 재시험 가능한 시험</h2>
          <p className="mt-1 text-sm text-slate-500">
            틀린 단어만 다시 풀어요. 재시험은 이번 주 횟수에 포함되지 않아요.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {retestable.map((t) => {
              const wrong = t.total - (t.correct ?? 0);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link href={`/results/${t.id}`} className="min-w-0 hover:underline">
                    <span className="block font-semibold">
                      {formatKst(t.submitted_at ?? t.started_at, false)} {testTitle(t)}
                    </span>
                    <span className="block text-sm text-slate-500">
                      {MODE_LABEL[t.mode]} · {t.correct}/{t.total} 맞음 · 틀린 단어 {wrong}개
                    </span>
                  </Link>
                  {!inProgress && (
                    <RetestButton testId={t.id} className="btn-primary h-12 px-5">
                      틀린 {wrong}개 다시 풀기
                    </RetestButton>
                  )}
                </li>
              );
            })}
          </ul>
          {inProgress && (
            <p className="mt-2 text-xs text-slate-500">풀던 시험을 끝내면 재시험을 볼 수 있어요.</p>
          )}
        </section>
      )}
    </div>
  );
}

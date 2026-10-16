import Link from 'next/link';
import { ParentLockNotice } from '@/components/ParentLockNotice';
import { isTestableWord, kstDate } from '@/lib/domain/week';
import { requireLearner } from '@/lib/server/context';
import { isParentMode } from '@/lib/server/parent';
import * as repo from '@/lib/server/repo';
import { WordList, type WordGroup } from './_components/WordList';

export const metadata = { title: '단어장' };

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → '10/16(목)' */
function dateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})`;
}

export default async function WordsPage() {
  const { user, member, learner } = await requireLearner();
  const [words, stats, tested, parentMode] = await Promise.all([
    repo.listWords(member.family_id, learner.id),
    repo.listWordStats(member.family_id),
    repo.listRegularTestedWordIds(member.family_id, learner.id),
    isParentMode(user.id, member.family_id),
  ]);

  const now = new Date();
  let waiting = 0;
  let tomorrow = 0;
  let done = 0;
  const byDate = new Map<string, WordGroup>();

  for (const w of words) {
    const date = kstDate(w.created_at);
    const isTested = tested.has(w.id);
    const testable = isTestableWord(w.created_at, now);
    if (isTested) done++;
    else if (testable) waiting++;
    else tomorrow++;

    let group = byDate.get(date);
    if (!group) {
      group = { date, label: dateLabel(date), testable, words: [] };
      byDate.set(date, group);
    }
    const s = stats.get(w.id);
    group.words.push({
      id: w.id,
      term: w.term,
      meaning: w.meaning,
      tested: isTested,
      wrong: s?.wrong_count ?? 0,
      attempts: s?.attempts ?? 0,
    });
  }
  const groups = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const minWords = learner.min_test_words;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">📚 {learner.name}의 단어장</h1>
          <p className="mt-0.5 text-sm text-slate-500">모두 {words.length}개</p>
        </div>
        <Link href="/words/new" className="btn-primary shrink-0">
          ➕ 단어 등록
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryChip label="시험 대기" value={waiting} tone="bg-brand-50 text-brand-700" />
        <SummaryChip label="내일부터" value={tomorrow} tone="bg-amber-50 text-amber-700" />
        <SummaryChip label="출제 완료" value={done} tone="bg-emerald-50 text-emerald-700" />
      </div>
      {waiting > 0 && waiting < minWords && (
        <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
          시험은 대기 단어가 {minWords}개 이상일 때 볼 수 있어요. ({minWords - waiting}개 더 필요해요)
        </p>
      )}

      {!parentMode && <ParentLockNotice next="/words" what="단어 수정·삭제" />}

      {groups.length === 0 ? (
        <div className="card text-center text-slate-500">
          <p className="text-4xl">📝</p>
          <p className="mt-2">아직 등록된 단어가 없어요.</p>
          <Link href="/words/new" className="btn-primary mt-4">
            첫 단어 등록하기
          </Link>
        </div>
      ) : (
        <WordList groups={groups} parentMode={parentMode} />
      )}
    </div>
  );
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl px-3 py-3 text-center ${tone}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

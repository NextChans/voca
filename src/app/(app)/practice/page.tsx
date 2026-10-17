import Link from 'next/link';
import { buildNewWords, buildPracticeWords } from '@/lib/domain/practice';
import { requireLearner } from '@/lib/server/context';
import * as repo from '@/lib/server/repo';
import { PracticeRunner, type PracticeCardWord, type PracticeScope } from './_components/PracticeRunner';

export const metadata = { title: '연습' };

type Tab = 'wrong' | 'new';

const TABS: { value: Tab; label: string; href: string }[] = [
  { value: 'wrong', label: '🔁 오답 연습', href: '/practice' },
  { value: 'new', label: '🆕 새 단어 연습', href: '/practice?tab=new' },
];

/** '2026-10-16' → '10/16' */
function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { member, learner } = await requireLearner();
  const tab: Tab = (await searchParams).tab === 'new' ? 'new' : 'wrong';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">{learner.name}의 연습</h1>
        <p className="mt-1 text-sm text-slate-500">
          {tab === 'new'
            ? '새로 등록한 단어를 시험 전에 미리 연습해요.'
            : '시험에서 틀렸던 단어를 연습해요.'}{' '}
          연습은 점수나 시험 횟수에 들어가지 않아요. 마음껏 해 보세요!
        </p>
      </div>

      <nav aria-label="연습 종류" className="flex gap-1 rounded-2xl bg-slate-200/70 p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.href}
            replace
            aria-current={tab === t.value ? 'page' : undefined}
            className={`flex-1 rounded-xl px-2 py-2 text-center text-sm font-semibold transition ${
              tab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'new' ? (
        <NewWordsPractice familyId={member.family_id} learnerId={learner.id} />
      ) : (
        <WrongWordsPractice familyId={member.family_id} learnerId={learner.id} />
      )}
    </div>
  );
}

async function WrongWordsPractice({ familyId, learnerId }: { familyId: string; learnerId: string }) {
  const words = buildPracticeWords(await repo.listSubmittedItemResults(familyId, learnerId));

  if (words.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-5xl">🌟</p>
        <p className="mt-3 text-lg font-bold">아직 틀린 단어가 없어요!</p>
        <p className="mt-1 text-sm text-slate-500">시험을 보고 나면 틀린 단어가 여기에 모여요.</p>
        <Link href="/test/new" className="btn-primary mt-4">
          시험 보러 가기
        </Link>
      </div>
    );
  }

  const cards = words.map(
    (w): PracticeCardWord & { lastWrong: boolean } => ({
      key: w.key,
      term: w.term,
      meaning: w.meaning,
      lastWrong: w.lastWrong,
      badge: {
        text: `${w.wrongCount}번 틀림`,
        tone: w.lastWrong ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500',
      },
    })
  );
  const recent = cards.filter((w) => w.lastWrong);
  const scopes: PracticeScope[] = [
    { key: 'recent', title: '최근에 틀린 단어', desc: `마지막 시험에서 틀린 ${recent.length}개`, words: recent },
    { key: 'all', title: '한 번이라도 틀린 단어', desc: `모두 ${cards.length}개`, words: cards },
  ];

  return <PracticeRunner key="wrong" scopes={scopes} listWords={cards} listTitle="틀린 단어 목록 보기" />;
}

async function NewWordsPractice({ familyId, learnerId }: { familyId: string; learnerId: string }) {
  const now = new Date();
  const [all, tested] = await Promise.all([
    repo.listWords(familyId, learnerId),
    repo.listRegularTestedWordIds(familyId, learnerId),
  ]);
  const words = buildNewWords(all, tested, now);

  if (words.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-5xl">📭</p>
        <p className="mt-3 text-lg font-bold">아직 시험 안 본 새 단어가 없어요</p>
        <p className="mt-1 text-sm text-slate-500">단어를 등록하면 시험 전에 여기서 미리 연습할 수 있어요.</p>
        <Link href="/words/new" className="btn-primary mt-4">
          단어 등록하러 가기
        </Link>
      </div>
    );
  }

  const cards = words.map(
    (w): PracticeCardWord & { registeredToday: boolean } => ({
      key: w.key,
      term: w.term,
      meaning: w.meaning,
      registeredToday: w.registeredToday,
      badge: w.registeredToday
        ? { text: '오늘', tone: 'bg-amber-100 text-amber-800' }
        : { text: shortDate(w.registeredDate), tone: 'bg-slate-100 text-slate-500' },
    })
  );
  const today = cards.filter((w) => w.registeredToday);
  const scopes: PracticeScope[] = [
    { key: 'today', title: '오늘 등록한 단어', desc: `오늘 넣은 ${today.length}개`, words: today },
    { key: 'all', title: '아직 시험 안 본 단어 전부', desc: `모두 ${cards.length}개`, words: cards },
  ];

  return <PracticeRunner key="new" scopes={scopes} listWords={cards} listTitle="새 단어 목록 보기" />;
}

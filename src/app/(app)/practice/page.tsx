import Link from 'next/link';
import { buildPracticeWords } from '@/lib/domain/practice';
import { requireLearner } from '@/lib/server/context';
import * as repo from '@/lib/server/repo';
import { PracticeRunner } from './_components/PracticeRunner';

export const metadata = { title: '오답 연습' };

export default async function PracticePage() {
  const { member, learner } = await requireLearner();
  const words = buildPracticeWords(await repo.listSubmittedItemResults(member.family_id, learner.id));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">🔁 {learner.name}의 오답 연습</h1>
        <p className="mt-1 text-sm text-slate-500">
          시험에서 틀렸던 단어를 연습해요. 연습은 점수나 시험 횟수에 들어가지 않아요. 마음껏 해 보세요!
        </p>
      </div>

      {words.length === 0 ? (
        <div className="card text-center">
          <p className="text-5xl">🌟</p>
          <p className="mt-3 text-lg font-bold">아직 틀린 단어가 없어요!</p>
          <p className="mt-1 text-sm text-slate-500">시험을 보고 나면 틀린 단어가 여기에 모여요.</p>
          <Link href="/test/new" className="btn-primary mt-4">
            시험 보러 가기
          </Link>
        </div>
      ) : (
        <PracticeRunner
          words={words.map((w) => ({
            key: w.key,
            term: w.term,
            meaning: w.meaning,
            wrongCount: w.wrongCount,
            lastWrong: w.lastWrong,
          }))}
        />
      )}
    </div>
  );
}

import Link from 'next/link';
import { requireLearner } from '@/lib/server/context';
import { serverEnv } from '@/lib/server/env';
import { WordEntry } from './_components/WordEntry';

export const metadata = { title: '단어 등록' };

export default async function NewWordsPage() {
  // 단어 추가는 자녀 모드에서도 가능 (수정·삭제는 단어장 화면에서 부모 모드로)
  const { learner } = await requireLearner();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/words" className="text-sm text-slate-500 hover:underline">
          ← 단어장
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          {learner.avatar} {learner.name} 단어 등록
        </h1>
      </div>

      <WordEntry aiOcr={Boolean(serverEnv.anthropicApiKey())} learnerName={learner.name} />
    </div>
  );
}

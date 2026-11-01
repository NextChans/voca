import Link from 'next/link';
import { requireLearner } from '@/lib/server/context';
import { activeOcrProvider } from '@/lib/server/ocr';
import * as repo from '@/lib/server/repo';
import { WordEntry } from './_components/WordEntry';

export const metadata = { title: '단어 등록' };

export default async function NewWordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 단어 추가는 자녀 모드에서도 가능 (수정·삭제는 단어장 화면에서 부모 모드로)
  const { member, learner } = await requireLearner();
  const [books, params] = await Promise.all([repo.listBooks(member.family_id, learner.id), searchParams]);
  const requested = typeof params.book === 'string' && books.some((b) => b.id === params.book) ? params.book : null;

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

      <WordEntry
        aiOcr={activeOcrProvider() !== null}
        learnerId={learner.id}
        learnerName={learner.name}
        books={books}
        requestedBook={requested}
        minTestWords={learner.min_test_words}
      />
    </div>
  );
}

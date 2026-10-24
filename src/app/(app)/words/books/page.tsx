import Link from 'next/link';
import { ParentLockNotice } from '@/components/ParentLockNotice';
import { MAX_BOOKS_PER_LEARNER } from '@/lib/limits';
import { requireLearner } from '@/lib/server/context';
import { isParentMode } from '@/lib/server/parent';
import * as repo from '@/lib/server/repo';
import { BooksManager } from './_components/BooksManager';

export const metadata = { title: '단어책' };

export default async function BooksPage() {
  const { user, member, learner } = await requireLearner();
  const [books, words, parentMode] = await Promise.all([
    repo.listBooks(member.family_id, learner.id),
    repo.listWords(member.family_id, learner.id),
    isParentMode(user.id, member.family_id),
  ]);

  const counts = new Map<string, number>();
  for (const w of words) if (w.book_id) counts.set(w.book_id, (counts.get(w.book_id) ?? 0) + 1);
  const unassigned = words.filter((w) => !w.book_id).length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/words" className="text-sm text-slate-500 hover:underline">
          ← 단어장
        </Link>
        <h1 className="mt-1 text-2xl font-bold">📗 {learner.name}의 단어책</h1>
        <p className="mt-1 text-sm text-slate-500">
          공부하는 책별로 단어를 나눠 담아요. 단어책을 만들지 않아도 지금처럼 쓸 수 있어요.
        </p>
      </div>

      <BooksManager
        books={books.map((b) => ({ ...b, count: counts.get(b.id) ?? 0 }))}
        unassigned={unassigned}
        parentMode={parentMode}
        maxBooks={MAX_BOOKS_PER_LEARNER}
      />

      {!parentMode && books.length > 0 && <ParentLockNotice next="/words/books" what="단어책 이름 바꾸기·지우기" />}
    </div>
  );
}

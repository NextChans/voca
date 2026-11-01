'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { createBookAction, deleteBookAction, renameBookAction, type ActionState } from '@/app/actions';
import { FormMessage } from '@/components/FormMessage';

export interface BookSummary {
  id: string;
  name: string;
  count: number;
}

export function BooksManager({
  books,
  unassigned,
  parentMode,
  maxBooks,
}: {
  books: BookSummary[];
  /** 책 없음 단어 수 */
  unassigned: number;
  parentMode: boolean;
  maxBooks: number;
}) {
  const [name, setName] = useState('');
  const [state, setState] = useState<ActionState | undefined>();
  const [pending, startTransition] = useTransition();

  const create = () => {
    startTransition(async () => {
      const res = await createBookAction(name);
      setState(res);
      if (!res.error) setName('');
    });
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h2 className="font-bold">새 단어책</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input
            className="input flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="예: 능률보카 초등 1"
            aria-label="단어책 이름"
          />
          <button type="submit" className="btn-primary shrink-0" disabled={pending || !name.trim() || books.length >= maxBooks}>
            {pending ? '만드는 중…' : '만들기'}
          </button>
        </form>
        <p className="text-xs text-slate-500">
          {books.length} / {maxBooks}권
        </p>
        <FormMessage state={state} />
      </section>

      {books.length > 0 && (
        <section className="card p-0">
          <ul className="divide-y divide-slate-100">
            {books.map((b) => (
              <BookRow key={b.id} book={b} parentMode={parentMode} />
            ))}
            <li className="flex items-center justify-between gap-2 px-4 py-3 text-slate-500">
              <span>책 없음</span>
              <Link href="/words?book=none" className="text-sm hover:underline">
                {unassigned}개 보기
              </Link>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}

function BookRow({ book, parentMode }: { book: BookSummary; parentMode: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(book.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const res = await renameBookAction(book.id, name);
      if (res.error) return setError(res.error);
      setError(null);
      setEditing(false);
    });
  };

  const remove = () => {
    if (
      !window.confirm(
        `'${book.name}' 단어책을 지울까요?\n안에 있는 단어 ${book.count}개와 시험 기록은 지워지지 않고 '책 없음'으로 옮겨져요.`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteBookAction(book.id);
      if (res.error) setError(res.error);
    });
  };

  if (editing) {
    return (
      <li className="space-y-2 bg-amber-50/50 px-4 py-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            className="input flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            aria-label="새 이름"
            autoFocus
          />
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={pending}>
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={pending || !name.trim()}>
            저장
          </button>
        </form>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </li>
    );
  }

  return (
    <li className={`space-y-2 px-4 py-3 ${pending ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/words?book=${book.id}`} className="min-w-0 font-semibold hover:underline">
          <span className="block truncate">📗 {book.name}</span>
        </Link>
        <span className="shrink-0 text-sm text-slate-500">{book.count}개</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-sm">
        <Link href={`/words/new?book=${book.id}`} className="btn-ghost px-2 py-1">
          ➕ 단어 넣기
        </Link>
        <Link href={`/practice?book=${book.id}`} className="btn-ghost px-2 py-1">
          🃏 연습
        </Link>
        <Link href={`/test/new?book=${book.id}#book-test`} className="btn-ghost px-2 py-1">
          📝 시험
        </Link>
        {parentMode && (
          <>
            <button type="button" className="btn-ghost px-2 py-1" onClick={() => setEditing(true)} disabled={pending}>
              ✏️ 이름
            </button>
            <button type="button" className="btn-ghost px-2 py-1 text-rose-600" onClick={remove} disabled={pending}>
              🗑️ 지우기
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </li>
  );
}

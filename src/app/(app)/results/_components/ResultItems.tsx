'use client';

import { useState, useTransition } from 'react';
import { overrideItemAction } from '@/app/actions';
import { SpeakButton } from '@/components/SpeakButton';

export interface ResultItem {
  id: string;
  seq: number;
  direction: 'spelling' | 'meaning';
  term: string;
  prompt: string;
  expected: string;
  answer: string;
  isCorrect: boolean;
  /** 부모가 정정한 경우 정정한 사람 이름 */
  overriddenByName: string | null;
}

export function ResultItems({ items, parentMode }: { items: ResultItem[]; parentMode: boolean }) {
  const wrongCount = items.filter((i) => !i.isCorrect).length;
  const [tab, setTab] = useState<'all' | 'wrong'>('all');
  const shown = tab === 'wrong' ? items.filter((i) => !i.isCorrect) : items;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="tablist">
        {(
          [
            ['all', `전체 ${items.length}`],
            ['wrong', `틀린 것만 ${wrongCount}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`h-11 rounded-xl text-base font-semibold transition ${
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="card text-center text-slate-600">틀린 단어가 하나도 없어요! 🎉</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <ItemRow key={item.id} item={item} parentMode={parentMode} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemRow({ item, parentMode }: { item: ResultItem; parentMode: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await overrideItemAction(item.id, !item.isCorrect);
      if (res.error) setError(res.error);
    });
  };

  return (
    <li
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        item.isCorrect ? 'border-slate-200' : 'border-rose-200 bg-rose-50/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            item.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
          }`}
          aria-label={item.isCorrect ? '정답' : '오답'}
        >
          {item.isCorrect ? '✔' : '✘'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">{item.seq}번</span>
            <span className="text-xs text-slate-400">
              {item.direction === 'spelling' ? '철자 쓰기' : '뜻 쓰기'}
            </span>
          </div>
          <p className="break-keep text-lg font-bold" lang={item.direction === 'spelling' ? 'ko' : 'en'}>
            {item.prompt}
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            <dt className="text-slate-500">정답</dt>
            <dd className="font-semibold text-emerald-700" lang={item.direction === 'spelling' ? 'en' : 'ko'}>
              {item.expected}
            </dd>
            <dt className="text-slate-500">내 답</dt>
            <dd
              className={`font-semibold ${item.isCorrect ? 'text-slate-700' : 'text-rose-600'} ${
                item.answer ? '' : 'italic text-slate-400'
              }`}
            >
              {item.answer || '(빈칸)'}
            </dd>
          </dl>
          {item.overriddenByName && (
            <p className="mt-1 text-xs text-amber-700">✏️ 부모 정정 · {item.overriddenByName}</p>
          )}
          {error && (
            <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <SpeakButton text={item.term} label={`${item.term} 발음 듣기`} />
          {parentMode && (
            <button
              type="button"
              onClick={toggle}
              disabled={pending}
              className={`btn h-10 px-3 text-xs ${
                item.isCorrect
                  ? 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                  : 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {pending ? '저장 중…' : item.isCorrect ? '오답 처리' : '정답 인정'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

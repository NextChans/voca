'use client';

import { useState } from 'react';
import { WordRow } from './WordRow';

export interface WordItem {
  id: string;
  term: string;
  meaning: string;
  tested: boolean;
  wrong: number;
  attempts: number;
}

export interface WordGroup {
  /** KST 등록일 YYYY-MM-DD */
  date: string;
  /** '10/16(목)' */
  label: string;
  /** 등록일 다음 날이 지났는지 */
  testable: boolean;
  words: WordItem[];
}

export type Mask = 'none' | 'meaning' | 'term';

const MASKS: { value: Mask; label: string }[] = [
  { value: 'none', label: '모두 보기' },
  { value: 'meaning', label: '뜻 가리기' },
  { value: 'term', label: '단어 가리기' },
];

function groupBadge(g: WordGroup) {
  const done = g.words.filter((w) => w.tested).length;
  if (!g.testable) return { text: '내일부터 시험', tone: 'bg-amber-100 text-amber-800' };
  if (done === g.words.length) return { text: '출제 완료', tone: 'bg-emerald-100 text-emerald-800' };
  if (done === 0) return { text: '시험 대기', tone: 'bg-brand-100 text-brand-700' };
  return { text: `시험 대기 ${g.words.length - done}개`, tone: 'bg-brand-100 text-brand-700' };
}

export function WordList({ groups, parentMode }: { groups: WordGroup[]; parentMode: boolean }) {
  const [mask, setMask] = useState<Mask>('none');
  // 가리기 모드를 바꾸면 펼쳐 본 단어도 다시 가린다 (key 로 행 상태 초기화)
  const [maskVersion, setMaskVersion] = useState(0);

  const changeMask = (m: Mask) => {
    setMask(m);
    setMaskVersion((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-[57px] z-[5] -mx-4 bg-slate-50/95 px-4 py-2 backdrop-blur">
        <div role="radiogroup" aria-label="혼자 공부하기" className="flex gap-1 rounded-2xl bg-slate-200/70 p-1">
          {MASKS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mask === m.value}
              onClick={() => changeMask(m.value)}
              className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                mask === m.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mask !== 'none' && (
          <p className="mt-1.5 text-center text-xs text-slate-500">가려진 칸을 누르면 정답이 보여요 👀</p>
        )}
      </div>

      {groups.map((g) => {
        const badge = groupBadge(g);
        return (
          <section key={g.date} className="card p-0">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h2 className="font-bold text-slate-700">
                {g.label} 등록 · {g.words.length}개
              </h2>
              <span className={`badge ${badge.tone}`}>{badge.text}</span>
            </header>
            <ul className="divide-y divide-slate-100">
              {g.words.map((w) => (
                <WordRow key={`${w.id}-${maskVersion}`} word={w} mask={mask} parentMode={parentMode} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

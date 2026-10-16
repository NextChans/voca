'use client';

import { englishInputProps, koreanInputProps } from '@/lib/client/keyboard';
import { useEffect, useRef } from 'react';
import { MAX_ROWS, rowIssue, type EditRow } from './rows';

interface Props {
  rows: EditRow[];
  duplicates: Set<string>;
  onChange: (key: string, field: 'term' | 'meaning', value: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => string | null;
}

/** 편집 가능한 단어 표. Enter → 다음 칸 (마지막 뜻 칸이면 새 줄) */
export function WordTable({ rows, duplicates, onChange, onRemove, onAdd }: Props) {
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingFocus.current) return;
    const el = inputs.current.get(pendingFocus.current);
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  });

  const focus = (id: string) => {
    const el = inputs.current.get(id);
    if (el) el.focus();
    else pendingFocus.current = id;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: 'term' | 'meaning') => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const row = rows[index];
    if (!row) return;
    if (field === 'term') return focus(`${row.key}:meaning`);
    const next = rows[index + 1];
    if (next) return focus(`${next.key}:term`);
    const key = onAdd();
    if (key) focus(`${key}:term`);
  };

  const ref = (id: string) => (el: HTMLInputElement | null) => {
    if (el) inputs.current.set(id, el);
    else inputs.current.delete(id);
  };

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[2rem_minmax(0,2fr)_minmax(0,3fr)_2.5rem] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
        <span className="text-center">#</span>
        <span>영어 단어</span>
        <span>뜻</span>
        <span />
      </div>
      <ol className="space-y-2">
        {rows.map((r, i) => {
          const issue = rowIssue(r);
          const dup = duplicates.has(r.key);
          const termBad = issue?.field === 'term' || dup;
          const meaningBad = issue?.field === 'meaning';
          return (
            <li key={r.key}>
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-2 sm:grid-cols-[2rem_minmax(0,2fr)_minmax(0,3fr)_2.5rem]">
                <span className="row-span-2 text-center text-xs text-slate-400 sm:row-span-1">{i + 1}</span>
                <input
                  ref={ref(`${r.key}:term`)}
                  className={`input ${termBad ? 'border-rose-400 bg-rose-50' : ''}`}
                  value={r.term}
                  onChange={(e) => onChange(r.key, 'term', e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, i, 'term')}
                  placeholder="apple"
                  aria-label={`${i + 1}번 영어 단어`}
                  aria-invalid={termBad || undefined}
                  {...englishInputProps}
                  autoComplete="off"
                  enterKeyHint="next"
                  maxLength={100}
                />
                <input
                  ref={ref(`${r.key}:meaning`)}
                  className={`input col-start-2 row-start-2 sm:col-start-auto sm:row-start-auto ${
                    meaningBad ? 'border-rose-400 bg-rose-50' : ''
                  }`}
                  value={r.meaning}
                  onChange={(e) => onChange(r.key, 'meaning', e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, i, 'meaning')}
                  placeholder="사과"
                  aria-label={`${i + 1}번 뜻`}
                  aria-invalid={meaningBad || undefined}
                  {...koreanInputProps}
                  autoComplete="off"
                  enterKeyHint="next"
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={() => onRemove(r.key)}
                  className="col-start-3 row-span-2 row-start-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 sm:col-start-auto sm:row-span-1 sm:row-start-auto"
                  aria-label={`${i + 1}번 줄 지우기`}
                >
                  ✕
                </button>
              </div>
              {(issue || dup) && (
                <p className="ml-10 mt-1 text-xs text-rose-600">
                  {dup ? '위에 같은 단어가 있어요.' : issue?.message}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="btn-secondary w-full border-dashed"
        onClick={() => {
          const key = onAdd();
          if (key) focus(`${key}:term`);
        }}
        disabled={rows.length >= MAX_ROWS}
      >
        ➕ 줄 추가
      </button>
    </div>
  );
}

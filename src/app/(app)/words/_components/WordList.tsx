'use client';

import { useState, useTransition } from 'react';
import { deleteWordsAction, moveWordsAction } from '@/app/actions';
import { WordRow } from './WordRow';

export interface WordItem {
  id: string;
  term: string;
  meaning: string;
  tested: boolean;
  wrong: number;
  attempts: number;
  /** 전체 보기에서 붙는 단어책 이름 */
  book: string | null;
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

export function WordList({
  groups,
  parentMode,
  books,
}: {
  groups: WordGroup[];
  parentMode: boolean;
  books: { id: string; name: string }[];
}) {
  const [mask, setMask] = useState<Mask>('none');
  // 가리기 모드를 바꾸면 펼쳐 본 단어도 다시 가린다 (key 로 행 상태 초기화)
  const [maskVersion, setMaskVersion] = useState(0);

  const changeMask = (m: Mask) => {
    setMask(m);
    setMaskVersion((v) => v + 1);
  };

  // 여러 개 선택해서 지우기·단어책 옮기기 (부모 모드 전용)
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const exitSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const removeSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 단어 ${ids.length}개를 지울까요?\n시험 기록의 해당 문항은 그대로 남아요.`)) return;
    startTransition(async () => {
      const res = await deleteWordsAction(ids);
      if (res.error) return setNotice({ ok: false, text: res.error });
      setNotice({ ok: true, text: res.message ?? '지웠어요.' });
      exitSelecting();
    });
  };

  const moveSelected = (bookId: string | null) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await moveWordsAction(ids, bookId);
      if (res.error) return setNotice({ ok: false, text: res.error });
      setNotice({ ok: true, text: res.message ?? '옮겼어요.' });
      exitSelecting();
    });
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

      {parentMode && (
        <div className="flex items-center justify-end gap-2">
          {notice && (
            <p role="status" className={`flex-1 text-sm ${notice.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
              {notice.text}
            </p>
          )}
          <button
            type="button"
            className={selecting ? 'btn-secondary' : 'btn-ghost'}
            onClick={() => {
              setNotice(null);
              if (selecting) exitSelecting();
              else setSelecting(true);
            }}
            disabled={pending}
          >
            {selecting ? '선택 끝내기' : books.length > 0 ? '☑️ 여러 개 옮기기·지우기' : '☑️ 여러 개 지우기'}
          </button>
        </div>
      )}

      {groups.map((g) => {
        const badge = groupBadge(g);
        const ids = g.words.map((w) => w.id);
        const allOn = ids.every((id) => selected.has(id));
        return (
          <section key={g.date} className="card p-0">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              {selecting ? (
                <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={() => toggle(ids, !allOn)}
                    className="h-5 w-5 accent-rose-600"
                  />
                  {g.label} 등록 · {g.words.length}개 모두 선택
                </label>
              ) : (
                <h2 className="font-bold text-slate-700">
                  {g.label} 등록 · {g.words.length}개
                </h2>
              )}
              <span className={`badge ${badge.tone}`}>{badge.text}</span>
            </header>
            <ul className="divide-y divide-slate-100">
              {g.words.map((w) => (
                <WordRow
                  key={`${w.id}-${maskVersion}`}
                  word={w}
                  mask={mask}
                  parentMode={parentMode}
                  selection={
                    selecting
                      ? { selected: selected.has(w.id), onToggle: () => toggle([w.id], !selected.has(w.id)) }
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}

      {selecting && <div aria-hidden className="h-16" />}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4">
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg">
            <span className="flex-1 text-sm font-semibold">{selected.size}개 선택</span>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              onClick={() => setSelected(new Set())}
              disabled={pending || selected.size === 0}
            >
              선택 해제
            </button>
            {books.length > 0 && (
              <select
                aria-label="단어책으로 옮기기"
                className="max-w-32 rounded-xl bg-slate-700 px-2 py-2 text-sm font-bold disabled:opacity-40"
                value=""
                disabled={pending || selected.size === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) moveSelected(v === 'none' ? null : v);
                }}
              >
                <option value="">📗 옮기기</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value="none">책 없음</option>
              </select>
            )}
            <button
              type="button"
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold hover:bg-rose-500 disabled:opacity-40"
              onClick={removeSelected}
              disabled={pending || selected.size === 0}
            >
              {pending ? '처리 중…' : `🗑️ ${selected.size}개 지우기`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

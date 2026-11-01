'use client';

import { englishInputProps, koreanInputProps } from '@/lib/client/keyboard';
import { useState, useTransition, type ReactNode } from 'react';
import { deleteWordsAction, updateWordAction } from '@/app/actions';
import { SpeakButton } from '@/components/SpeakButton';
import { isValidTerm, TERM_ERROR } from '@/lib/domain/term';
import type { Mask, WordItem } from './WordList';

export function WordRow({
  word,
  mask,
  parentMode,
  selection,
}: {
  word: WordItem;
  mask: Mask;
  parentMode: boolean;
  /** 여러 개 선택 모드일 때만 전달 */
  selection?: { selected: boolean; onToggle: () => void };
}) {
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [term, setTerm] = useState(word.term);
  const [meaning, setMeaning] = useState(word.meaning);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hideTerm = mask === 'term' && !revealed;
  const hideMeaning = mask === 'meaning' && !revealed;

  const startEdit = () => {
    setTerm(word.term);
    setMeaning(word.meaning);
    setError(null);
    setEditing(true);
  };

  const save = () => {
    const t = term.trim();
    const m = meaning.trim();
    if (!isValidTerm(t)) return setError(TERM_ERROR);
    if (!m) return setError('뜻을 입력해 주세요.');
    startTransition(async () => {
      const res = await updateWordAction(word.id, t, m);
      if (res.error) return setError(res.error);
      setEditing(false);
    });
  };

  const remove = () => {
    if (!window.confirm(`'${word.term}' 단어를 지울까요?\n시험 기록의 해당 문항은 그대로 남아요.`)) return;
    startTransition(async () => {
      const res = await deleteWordsAction([word.id]);
      if (res.error) setError(res.error);
    });
  };

  if (editing) {
    return (
      <li className="space-y-2 bg-amber-50/50 px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="input"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="영어 단어"
            {...englishInputProps}
            maxLength={100}
            autoFocus
          />
          <input
            className="input"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) save();
            }}
            aria-label="뜻"
            {...koreanInputProps}
            maxLength={200}
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={pending}>
            취소
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={pending}>
            {pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`flex items-center gap-2 px-4 py-2.5 ${pending ? 'opacity-50' : ''} ${
        selection?.selected ? 'bg-rose-50' : ''
      }`}
    >
      {selection && (
        <input
          type="checkbox"
          checked={selection.selected}
          onChange={selection.onToggle}
          className="h-5 w-5 shrink-0 accent-rose-600"
          aria-label={`${word.term} 선택`}
        />
      )}
      <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 items-center gap-1">
          {hideTerm ? (
            <Cover onClick={() => setRevealed(true)} label="단어 보기" />
          ) : (
            <Revealed active={mask === 'term'} onHide={() => setRevealed(false)}>
              <span className="truncate text-lg font-semibold text-slate-900" lang="en">
                {word.term}
              </span>
            </Revealed>
          )}
          <SpeakButton text={word.term} />
        </div>
        <div className="min-w-0">
          {hideMeaning ? (
            <Cover onClick={() => setRevealed(true)} label="뜻 보기" />
          ) : (
            <Revealed active={mask === 'meaning'} onHide={() => setRevealed(false)}>
              <span className="text-slate-600">{word.meaning}</span>
            </Revealed>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-rose-600 sm:col-span-2">
            {error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {word.book && <span className="badge max-w-28 truncate bg-teal-50 text-teal-700">📗 {word.book}</span>}
        {word.tested && <span className="badge bg-emerald-50 text-emerald-700">출제됨</span>}
        {word.wrong > 0 && <span className="badge bg-rose-50 text-rose-600">틀림 {word.wrong}회</span>}
      </div>

      {parentMode && !selection && (
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label={`${word.term} 고치기`}
            title="고치기"
            disabled={pending}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={remove}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-rose-50"
            aria-label={`${word.term} 지우기`}
            title="지우기"
            disabled={pending}
          >
            🗑️
          </button>
        </div>
      )}
    </li>
  );
}

function Cover({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-8 w-full max-w-40 rounded-lg bg-slate-200 text-xs font-medium text-slate-400 hover:bg-slate-300"
    >
      눌러서 보기
    </button>
  );
}

/** 가리기 모드에서 펼친 칸: 한 번 더 누르면 다시 가린다 */
function Revealed({ active, onHide, children }: { active: boolean; onHide: () => void; children: ReactNode }) {
  if (!active) return children;
  return (
    <button
      type="button"
      onClick={onHide}
      aria-label="다시 가리기"
      className="flex min-w-0 max-w-full rounded-lg text-left hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

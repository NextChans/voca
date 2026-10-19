'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addWordsAction, type ActionState } from '@/app/actions';
import { FormMessage } from '@/components/FormMessage';
import { PastePanel } from './PastePanel';
import { PhotoPanel } from './PhotoPanel';
import { appendRows, duplicateKeys, isBlank, MAX_ROWS, newRow, rowIssue, type EditRow } from './rows';
import { WordTable } from './WordTable';

type Tab = 'manual' | 'paste' | 'photo';

const TABS: { value: Tab; label: string }[] = [
  { value: 'manual', label: '✍️ 직접 입력' },
  { value: 'paste', label: '📋 붙여넣기' },
  { value: 'photo', label: '📷 사진' },
];

export function WordEntry({
  aiOcr,
  learnerName,
  minTestWords,
}: {
  aiOcr: boolean;
  learnerName: string;
  /** 자녀별 설정의 '시험 최소 단어 수' */
  minTestWords: number;
}) {
  const [tab, setTab] = useState<Tab>('manual');
  const [rows, setRows] = useState<EditRow[]>(() => [newRow()]);
  const [state, setState] = useState<ActionState | undefined>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  // 사진 인식처럼 비동기로 끝나는 추가에서도 최신 표를 기준으로 붙이기 위해
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const filled = useMemo(() => rows.filter((r) => !isBlank(r)), [rows]);
  const duplicates = useMemo(() => duplicateKeys(rows), [rows]);
  const invalidCount = useMemo(() => filled.filter((r) => rowIssue(r)).length, [filled]);

  const update = (key: string, field: 'term' | 'meaning', value: string) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };
  const remove = (key: string) => {
    setRows((rs) => {
      const next = rs.filter((r) => r.key !== key);
      return next.length ? next : [newRow()];
    });
  };
  const add = (): string | null => {
    if (rows.length >= MAX_ROWS) return null;
    const r = newRow();
    setRows((rs) => [...rs, r]);
    return r.key;
  };
  const appendParsed = (words: { term: string; meaning: string }[]): string => {
    const res = appendRows(rowsRef.current, words);
    rowsRef.current = res.rows;
    setRows(res.rows.length ? res.rows : [newRow()]);
    setState(undefined);
    setSaved(false);
    return `${res.added}개를 아래 표에 넣었어요.${
      res.dropped ? ` (한 번에 ${MAX_ROWS}개까지라 ${res.dropped}개는 빠졌어요)` : ''
    }`;
  };
  const removeDuplicates = () => {
    setRows((rs) => rs.filter((r) => !duplicates.has(r.key)));
  };

  const save = () => {
    setSaved(false);
    if (filled.length === 0) return setState({ error: '저장할 단어가 없어요.' });
    if (invalidCount > 0) return setState({ error: `빨간 칸 ${invalidCount}개를 먼저 고쳐 주세요.` });
    if (duplicates.size > 0) return setState({ error: '표 안에 겹치는 단어가 있어요. 정리한 뒤 저장해 주세요.' });
    if (filled.length > MAX_ROWS) return setState({ error: `한 번에 ${MAX_ROWS}개까지 저장할 수 있어요.` });
    const payload = filled.map((r) => ({ term: r.term.trim(), meaning: r.meaning.trim() }));
    startTransition(async () => {
      const res = await addWordsAction(payload);
      setState(res);
      if (!res.error) {
        setRows([newRow()]);
        setSaved(true);
      }
    });
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-4">
        <div role="tablist" aria-label="등록 방법" className="flex gap-1 rounded-2xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold transition ${
                tab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === 'manual' && (
            <p className="text-sm text-slate-600">
              아래 표에 바로 입력하세요. <span className="text-slate-400">Enter를 누르면 다음 칸으로 넘어가요.</span>
            </p>
          )}
          {tab === 'paste' && <PastePanel onParsed={appendParsed} />}
          {tab === 'photo' && <PhotoPanel aiOcr={aiOcr} onParsed={appendParsed} />}
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">
            등록할 단어 <span className="text-brand-600">{filled.length}개</span>
          </h2>
          {duplicates.size > 0 && (
            <button type="button" className="btn-ghost px-2 py-1 text-xs text-rose-600" onClick={removeDuplicates}>
              겹치는 단어 {duplicates.size}개 지우기
            </button>
          )}
        </div>
        <WordTable rows={rows} duplicates={duplicates} onChange={update} onRemove={remove} onAdd={add} />
      </section>

      <div className="space-y-2">
        <button
          type="button"
          className="btn-primary h-14 w-full text-lg"
          onClick={save}
          disabled={pending || filled.length === 0}
        >
          {pending ? '저장 중…' : `💾 ${learnerName}에게 ${filled.length}개 저장`}
        </button>
        <p className="text-center text-xs text-slate-500">
          오늘 등록한 단어는 내일부터 시험에 나와요 · 시험은 {minTestWords}개 이상부터
        </p>
        <FormMessage state={state} />
        {saved && (
          <div className="flex gap-2">
            <Link href="/words" className="btn-secondary flex-1">
              📚 단어장 보기
            </Link>
            <button type="button" className="btn-ghost flex-1" onClick={() => setSaved(false)}>
              더 등록하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

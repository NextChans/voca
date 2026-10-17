'use client';

import { englishInputProps, koreanInputProps } from '@/lib/client/keyboard';
import { useMemo, useRef, useState } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { gradeMeaning, gradeSpelling } from '@/lib/domain/grading';

export interface PracticeCardWord {
  key: string;
  term: string;
  meaning: string;
  /** "목록 보기"에 붙는 꼬리표 (예: '2번 틀림', '오늘') */
  badge?: { text: string; tone: string };
}

export interface PracticeScope {
  key: string;
  title: string;
  desc: string;
  words: PracticeCardWord[];
}

type Mode = 'card' | 'spelling' | 'meaning';

const MODES: { value: Mode; label: string; desc: string; icon: string }[] = [
  { value: 'card', label: '카드 넘기기', desc: '영어를 보고 뜻을 떠올린 뒤 카드를 뒤집어요', icon: '🃏' },
  { value: 'spelling', label: '철자 쓰기', desc: '뜻과 발음을 듣고 영어로 써요', icon: '✍️' },
  { value: 'meaning', label: '뜻 쓰기', desc: '영어를 보고 한글 뜻을 써요', icon: '💬' },
];

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * 연습 화면 (오답 연습 · 새 단어 연습 공용).
 * scopes: 고를 수 있는 단어 묶음. 단어가 0개인 묶음은 비활성. 처음엔 단어가 있는 첫 묶음을 고른다.
 * listWords: "목록 보기"에 보여 줄 단어 (보통 가장 넓은 묶음)
 */
export function PracticeRunner({
  scopes,
  listWords,
  listTitle,
}: {
  scopes: PracticeScope[];
  listWords: PracticeCardWord[];
  listTitle: string;
}) {
  const [scopeKey, setScopeKey] = useState(() => (scopes.find((s) => s.words.length > 0) ?? scopes[0])?.key);
  const [mode, setMode] = useState<Mode>('card');
  const [session, setSession] = useState<null | { id: number; queue: PracticeCardWord[]; total: number }>(null);

  const pool = useMemo(() => scopes.find((s) => s.key === scopeKey)?.words ?? [], [scopes, scopeKey]);

  if (session) {
    return (
      <Session
        key={session.id}
        initial={session}
        mode={mode}
        onExit={() => setSession(null)}
        onRestart={() => setSession({ id: Date.now(), queue: shuffle(pool), total: pool.length })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-bold">어떤 단어를 연습할까요?</h2>
        <div className="grid grid-cols-2 gap-2">
          {scopes.map((s) => (
            <ScopeButton
              key={s.key}
              active={scopeKey === s.key}
              disabled={s.words.length === 0}
              onClick={() => setScopeKey(s.key)}
              title={s.title}
              desc={s.desc}
            />
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">어떻게 연습할까요?</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              aria-pressed={mode === m.value}
              className={`rounded-xl border-2 p-3 text-left transition ${
                mode === m.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              <span className="mt-1 block font-semibold">{m.label}</span>
              <span className="block text-xs text-slate-500">{m.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        className="btn-primary h-14 w-full text-lg"
        disabled={pool.length === 0}
        onClick={() => setSession({ id: Date.now(), queue: shuffle(pool), total: pool.length })}
      >
        연습 시작 ({pool.length}개)
      </button>

      <details className="card">
        <summary className="cursor-pointer font-semibold">{listTitle}</summary>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {listWords.map((w) => (
            <li key={w.key} className="flex items-center gap-2 py-2">
              <SpeakButton text={w.term} />
              <span className="font-semibold">{w.term}</span>
              <span className="flex-1 text-slate-500">{w.meaning}</span>
              {w.badge && <span className={`badge ${w.badge.tone}`}>{w.badge.text}</span>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ScopeButton(props: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.active}
      className={`rounded-xl border-2 p-3 text-left transition disabled:opacity-40 ${
        props.active ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <span className="block font-semibold">{props.title}</span>
      <span className="block text-xs text-slate-500">{props.desc}</span>
    </button>
  );
}

/** 한 번의 연습: 모르는 단어는 큐 뒤로 보내 다 맞힐 때까지 */
function Session({
  initial,
  mode,
  onExit,
  onRestart,
}: {
  initial: { queue: PracticeCardWord[]; total: number };
  mode: Mode;
  onExit: () => void;
  onRestart: () => void;
}) {
  const [queue, setQueue] = useState(initial.queue);
  const [missed, setMissed] = useState<Set<string>>(() => new Set());
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<null | { ok: boolean }>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const done = initial.total - queue.length;
  const current = queue[0];

  const next = (knew: boolean) => {
    if (!current) return;
    if (!knew) setMissed((m) => new Set(m).add(current.key));
    setQueue((q) => (knew ? q.slice(1) : [...q.slice(1), q[0]!]));
    setFlipped(false);
    setAnswer('');
    setFeedback(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (!current) {
    const firstTryOk = initial.total - missed.size;
    return (
      <div className="card space-y-4 text-center">
        <p className="text-6xl">🎉</p>
        <p className="text-xl font-extrabold">연습 끝! 모두 맞혔어요</p>
        <p className="text-slate-600">
          {initial.total}개 중 <b className="text-emerald-600">{firstTryOk}개</b>는 한 번에 맞혔어요.
          {missed.size > 0 && ` ${missed.size}개는 다시 해서 맞혔어요.`}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary h-12" onClick={onExit}>
            처음으로
          </button>
          <button type="button" className="btn-primary h-12" onClick={onRestart}>
            한 번 더
          </button>
        </div>
      </div>
    );
  }

  const check = () => {
    if (feedback || !answer.trim()) return;
    const ok = mode === 'spelling' ? gradeSpelling(current.term, answer) : gradeMeaning(current.meaning, answer);
    setFeedback({ ok });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <button type="button" className="btn-ghost px-2" onClick={onExit}>
          ← 그만하기
        </button>
        <span>
          맞힘 <b className="text-emerald-600">{done}</b> / {initial.total} · 남은 카드 {queue.length}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / initial.total) * 100}%` }} />
      </div>

      {mode === 'card' ? (
        <div className="card space-y-5 text-center">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="block w-full rounded-2xl bg-slate-50 px-4 py-10"
            aria-label={flipped ? '카드 앞면 보기' : '카드 뒤집기'}
          >
            <span className="block text-4xl font-extrabold tracking-wide">{current.term}</span>
            {flipped ? (
              <span className="mt-4 block text-2xl font-semibold text-brand-700">{current.meaning}</span>
            ) : (
              <span className="mt-4 block text-sm text-slate-400">눌러서 뜻 보기 👆</span>
            )}
          </button>
          <SpeakButton text={current.term} size="lg" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary h-14 text-base" onClick={() => next(false)}>
              🤔 다시 볼래요
            </button>
            <button type="button" className="btn-primary h-14 text-base" onClick={() => next(true)}>
              😊 알아요
            </button>
          </div>
        </div>
      ) : (
        <div className="card space-y-4 text-center">
          <p className="text-sm font-semibold text-slate-500">
            {mode === 'spelling' ? '✍️ 이 뜻의 영어 단어를 써 보세요' : '💬 이 단어의 뜻을 써 보세요'}
          </p>
          <p className="text-3xl font-extrabold">{mode === 'spelling' ? current.meaning : current.term}</p>
          <SpeakButton text={current.term} size="lg" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (feedback) next(feedback.ok);
              else check();
            }}
            className="space-y-3"
          >
            <input
              ref={inputRef}
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={!!feedback}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              {...(mode === 'spelling' ? englishInputProps : koreanInputProps)}
              placeholder={mode === 'spelling' ? '영어로 쓰기' : '뜻 쓰기'}
              className="input h-14 text-center text-2xl"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault();
              }}
            />
            {feedback && (
              <p
                role="status"
                className={`rounded-xl px-3 py-3 text-lg font-semibold ${
                  feedback.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {feedback.ok ? '⭕ 정답!' : '❌ 아쉬워요'}{' '}
                <span className="block text-base font-normal text-slate-700">
                  {current.term} = {current.meaning}
                </span>
              </p>
            )}
            {feedback ? (
              <button type="submit" className="btn-primary h-14 w-full text-lg">
                {feedback.ok ? '다음 →' : '다음 (나중에 다시 나와요) →'}
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button type="button" className="btn-secondary h-14" onClick={() => next(false)}>
                  모르겠어요
                </button>
                <button type="submit" className="btn-primary col-span-2 h-14 text-lg" disabled={!answer.trim()}>
                  확인
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { submitTestAction } from '@/app/actions';
import { SpeakButton } from '@/components/SpeakButton';
import { speakItem } from '@/lib/client/speech';
import type { TestQuestion } from '@/lib/server/repo';

interface Props {
  testId: string;
  questions: TestQuestion[];
  title: string;
}

type Answers = Record<string, string>;

export const testStorageKey = (testId: string) => `voca:test:${testId}`;

function loadAnswers(key: string, questions: TestQuestion[]): Answers {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Answers = {};
    for (const q of questions) {
      const v = (parsed as Record<string, unknown>)[q.id];
      if (typeof v === 'string') out[q.id] = v.slice(0, 200);
    }
    return out;
  } catch {
    return {};
  }
}

function saveAnswers(key: string, answers: Answers) {
  try {
    window.localStorage.setItem(key, JSON.stringify(answers));
  } catch {
    // 저장 공간이 없거나 사생활 보호 모드 — 화면의 답은 그대로 유지된다
  }
}

const noopSubscribe = () => () => {};

/** 서버 렌더와 첫 하이드레이션은 로딩 화면, 그 뒤 localStorage 에서 답안을 복원해 시작 */
export function TestRunner(props: Props) {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  if (!hydrated) {
    return <p className="py-20 text-center text-lg text-slate-500">시험지를 펼치는 중… 📄</p>;
  }
  if (props.questions.length === 0) {
    return <p className="card text-center text-slate-600">문제가 없어요.</p>;
  }
  return <Runner {...props} />;
}

const isBlank = (v: string | undefined) => !v || v.trim() === '';

function Runner({ testId, questions, title }: Props) {
  const storageKey = testStorageKey(testId);
  const total = questions.length;

  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(storageKey, questions));
  // 이어서 풀 때는 첫 빈칸부터
  const [index, setIndex] = useState(() => {
    const restored = loadAnswers(storageKey, questions);
    const i = questions.findIndex((q) => isBlank(restored[q.id]));
    return i === -1 ? total - 1 : i;
  });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submittingRef = useRef(false);
  const interactedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = questions[index];
  const isSpelling = q.direction === 'spelling';
  const answeredCount = questions.reduce((n, x) => n + (isBlank(answers[x.id]) ? 0 : 1), 0);
  const blankNumbers = questions.flatMap((x, i) => (isBlank(answers[x.id]) ? [i + 1] : []));

  // 문제가 바뀌면 입력칸에 포커스 + (사용자가 한 번이라도 조작한 뒤라면) 철자 문제 발음 자동 재생
  useEffect(() => {
    if (!interactedRef.current) return;
    inputRef.current?.focus();
    const cur = questions[index];
    if (cur?.direction === 'spelling') speakItem(cur.id).catch(() => {});
  }, [index, questions]);

  const setAnswer = (value: string) => {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    saveAnswers(storageKey, next);
  };

  const go = (i: number) => setIndex(Math.max(0, Math.min(total - 1, i)));
  const goNext = () => (index === total - 1 ? setConfirming(true) : go(index + 1));

  const submit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const res = await submitTestAction(testId, answers);
        // 성공하면 액션이 결과 화면으로 이동시킨다
        if (res?.error) {
          setError(res.error);
          submittingRef.current = false;
        }
      } catch (e) {
        unstable_rethrow(e);
        setError('제출하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. (답은 이 기기에 저장돼 있어요)');
        submittingRef.current = false;
      }
    });
  };

  // 버튼을 눌러도 입력칸 포커스(모바일 키보드)가 유지되도록
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      className="mx-auto max-w-xl space-y-4"
      onPointerDownCapture={() => (interactedRef.current = true)}
      onKeyDownCapture={() => (interactedRef.current = true)}
    >
      {/* 진행 상황 */}
      <div>
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="font-semibold text-slate-600">{title}</span>
          <span className="text-lg font-extrabold text-brand-600">
            {index + 1} <span className="text-slate-400">/ {total}</span>
          </span>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
          aria-label={`${total}문제 중 ${answeredCount}문제 답함`}
        >
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${(answeredCount / total) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-slate-500">
          {answeredCount}개 답했어요 · 남은 빈칸 {total - answeredCount}개
        </p>
      </div>

      {/* 문제 */}
      <section className="card space-y-5 py-8 text-center">
        <p className="text-sm font-semibold text-slate-500">
          {isSpelling ? '✍️ 이 뜻의 영어 단어를 써 보세요' : '💬 이 단어의 뜻을 한글로 써 보세요'}
        </p>
        <p
          className={`break-keep text-4xl font-extrabold leading-tight sm:text-5xl ${
            isSpelling ? 'text-slate-800' : 'text-brand-700'
          }`}
          lang={isSpelling ? 'ko' : 'en'}
        >
          {q.prompt}
        </p>
        <div className="flex justify-center">
          {isSpelling ? (
            <SpeakButton key={q.id} itemId={q.id} size="lg" label="발음 듣기" />
          ) : (
            <SpeakButton key={q.id} text={q.prompt} size="lg" label="발음 듣기" />
          )}
        </div>

        <input
          ref={inputRef}
          value={answers[q.id] ?? ''}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            // 한글 IME 조합 중 Enter 는 글자 확정용 — 다음 문제로 넘기지 않는다
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            goNext();
          }}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          lang={isSpelling ? 'en' : 'ko'}
          enterKeyHint={index === total - 1 ? 'done' : 'next'}
          maxLength={200}
          placeholder={isSpelling ? '영어로 쓰기' : '뜻을 한글로 쓰기'}
          aria-label={`${index + 1}번 답`}
          className="input h-16 text-center text-2xl font-semibold"
        />
      </section>

      {/* 이동 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="btn-secondary h-14 text-lg"
          onMouseDown={keepFocus}
          onClick={() => go(index - 1)}
          disabled={index === 0 || pending}
        >
          ← 이전
        </button>
        {index === total - 1 ? (
          <button
            type="button"
            className="btn-primary h-14 bg-emerald-600 text-lg hover:bg-emerald-700"
            onClick={() => setConfirming(true)}
            disabled={pending}
          >
            제출하기 ✅
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary h-14 text-lg"
            onMouseDown={keepFocus}
            onClick={() => go(index + 1)}
            disabled={pending}
          >
            다음 →
          </button>
        )}
      </div>

      {error && !confirming && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* 문제 번호 한눈에 보기 */}
      <details className="card p-4" open={total <= 60}>
        <summary className="cursor-pointer select-none font-semibold text-slate-700">
          📋 전체 문제 보기 <span className="text-sm font-normal text-slate-500">(빈칸 {total - answeredCount}개)</span>
        </summary>
        <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-10">
          {questions.map((x, i) => {
            const done = !isBlank(answers[x.id]);
            const current = i === index;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`${i + 1}번 문제${done ? ' (답함)' : ' (빈칸)'}`}
                aria-current={current ? 'step' : undefined}
                className={`h-10 rounded-lg text-sm font-semibold transition ${
                  done ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400'
                } ${current ? 'ring-2 ring-brand-600 ring-offset-1' : ''}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="btn-ghost mt-3 w-full text-emerald-700"
          onClick={() => setConfirming(true)}
          disabled={pending}
        >
          다 풀었어요, 제출할래요
        </button>
      </details>

      {/* 제출 확인 */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="text-5xl">{blankNumbers.length === 0 ? '🙌' : '🤔'}</p>
            <h2 id="submit-title" className="mt-3 text-xl font-bold">
              {blankNumbers.length === 0 ? '모두 답했어요! 제출할까요?' : `아직 빈칸이 ${blankNumbers.length}개 있어요`}
            </h2>
            {blankNumbers.length > 0 && (
              <>
                <p className="mt-1 text-sm text-slate-600">빈칸은 틀린 것으로 채점돼요. 번호를 누르면 그 문제로 가요.</p>
                <div className="mt-3 flex max-h-32 flex-wrap justify-center gap-1.5 overflow-y-auto">
                  {blankNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="badge bg-amber-100 px-3 py-1.5 text-sm text-amber-800"
                      onClick={() => {
                        setConfirming(false);
                        go(n - 1);
                      }}
                      disabled={pending}
                    >
                      {n}번
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="mt-3 text-sm text-slate-500">제출하면 답을 고칠 수 없어요.</p>
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="btn-secondary h-14 text-base"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                다시 볼게요
              </button>
              <button
                type="button"
                className="btn-primary h-14 bg-emerald-600 text-base hover:bg-emerald-700"
                onClick={submit}
                disabled={pending}
              >
                {pending ? '채점 중…' : '제출하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

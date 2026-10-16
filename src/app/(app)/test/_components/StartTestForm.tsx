'use client';

import { useActionState } from 'react';
import { startTestAction, type ActionState } from '@/app/actions';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import type { TestMode } from '@/lib/domain/types';

const MODES: { value: TestMode; icon: string; title: string; desc: string }[] = [
  { value: 'spelling', icon: '✍️', title: '철자 쓰기', desc: '한글 뜻과 발음을 듣고 영어 철자를 써요' },
  { value: 'meaning', icon: '💬', title: '뜻 쓰기', desc: '영어 단어를 보고 한글 뜻을 써요' },
  { value: 'mixed', icon: '🎲', title: '섞어서', desc: '철자 문제와 뜻 문제가 골고루 섞여 나와요' },
];

export function StartTestForm({ count }: { count: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(startTestAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-base font-bold text-slate-700">어떤 방식으로 볼까요?</legend>
        {MODES.map((m, i) => (
          <label
            key={m.value}
            className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4 transition hover:border-brand-500 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
          >
            <input
              type="radio"
              name="mode"
              value={m.value}
              defaultChecked={i === 0}
              className="h-5 w-5 shrink-0 accent-brand-600"
            />
            <span className="text-3xl" aria-hidden>
              {m.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold">{m.title}</span>
              <span className="block text-sm text-slate-500">{m.desc}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <SubmitButton className="btn-primary h-14 w-full text-lg" pendingText="시험지 만드는 중…">
        시험 시작 ({count}문제) 🚀
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

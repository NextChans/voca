'use client';

import { useActionState, useState } from 'react';
import { createLearnerAction, type ActionState } from '@/app/actions';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

// 12지신 순서. 목록에 없는 기존 캐릭터(예: 🐣)는 AvatarPicker 가 맨 앞에 남겨 그대로 유지된다.
const ZODIAC = [
  ['🐭', '쥐'],
  ['🐮', '소'],
  ['🐯', '호랑이'],
  ['🐰', '토끼'],
  ['🐲', '용'],
  ['🐍', '뱀'],
  ['🐴', '말'],
  ['🐑', '양'],
  ['🐵', '원숭이'],
  ['🐔', '닭'],
  ['🐶', '개'],
  ['🐷', '돼지'],
] as const;

export const AVATARS: readonly string[] = ZODIAC.map(([emoji]) => emoji);
const AVATAR_NAMES: Record<string, string> = Object.fromEntries(ZODIAC);

export function AvatarPicker({
  value,
  onChange,
  name = 'avatar',
  idPrefix,
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
  idPrefix: string;
}) {
  const options: readonly string[] = AVATARS.includes(value) ? AVATARS : [value, ...AVATARS];
  return (
    <fieldset>
      <legend className="label">캐릭터</legend>
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-label="캐릭터 선택" className="grid grid-cols-6 gap-2">
        {options.map((a) => (
          <button
            key={a}
            id={`${idPrefix}-${a}`}
            type="button"
            role="radio"
            aria-checked={value === a}
            aria-label={AVATAR_NAMES[a] ?? '지금 캐릭터'}
            title={AVATAR_NAMES[a]}
            onClick={() => onChange(a)}
            className={`flex h-12 items-center justify-center rounded-xl border-2 text-2xl transition ${
              value === a ? 'border-brand-500 bg-brand-50' : 'border-transparent bg-slate-100 hover:bg-slate-200'
            }`}
          >
            <span aria-hidden>{a}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AddLearnerForm() {
  const [state, action] = useActionState(createLearnerAction, {} as ActionState);
  const [avatar, setAvatar] = useState<string>(ZODIAC[0][0]);
  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label htmlFor="learner_name" className="label">
          이름
        </label>
        <input id="learner_name" name="name" required maxLength={20} className="input" placeholder="예: 지우" />
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} idPrefix="new-avatar" />
      <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="추가하는 중…">
        추가하기
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

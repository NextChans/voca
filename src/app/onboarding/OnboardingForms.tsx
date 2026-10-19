'use client';

import { useActionState } from 'react';
import { createFamilyAction, joinFamilyAction, type ActionState } from '@/app/actions';
import { ConsentFields } from '@/components/ConsentFields';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

const initial: ActionState = {};

export function CreateFamilyForm() {
  const [state, action] = useActionState(createFamilyAction, initial);
  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label htmlFor="family_name" className="label">
          가족 이름
        </label>
        <input
          id="family_name"
          name="family_name"
          required
          maxLength={30}
          className="input"
          placeholder="예: 행복한 우리집"
        />
      </div>
      <div>
        <label htmlFor="create_display_name" className="label">
          나를 부르는 이름
        </label>
        <input
          id="create_display_name"
          name="display_name"
          required
          maxLength={20}
          className="input"
          placeholder="예: 아빠, 엄마"
        />
      </div>
      <ConsentFields />
      <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="만드는 중…">
        가족 만들기
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function JoinFamilyForm() {
  const [state, action] = useActionState(joinFamilyAction, initial);
  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label htmlFor="code" className="label">
          초대코드
        </label>
        <input
          id="code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="input font-mono text-lg tracking-widest uppercase"
          placeholder="ABCD-EFGH"
        />
      </div>
      <div>
        <label htmlFor="join_display_name" className="label">
          나를 부르는 이름
        </label>
        <input
          id="join_display_name"
          name="display_name"
          required
          maxLength={20}
          className="input"
          placeholder="예: 엄마, 아빠"
        />
      </div>
      <ConsentFields />
      <SubmitButton className="btn-secondary w-full py-3 text-base" pendingText="확인 중…">
        가족에 합류하기
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

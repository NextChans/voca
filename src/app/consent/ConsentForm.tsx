'use client';

import { useActionState } from 'react';
import { recordConsentAction, type ActionState } from '@/app/actions';
import { ConsentFields } from '@/components/ConsentFields';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

export function ConsentForm() {
  const [state, action] = useActionState(recordConsentAction, {} as ActionState);
  return (
    <form action={action} className="space-y-4">
      <ConsentFields />
      <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="저장 중…">
        동의하고 계속하기
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { startRetestAction, type ActionState } from '@/app/actions';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

/** 틀린 문항만 다시 보는 재시험 시작 버튼. 성공하면 액션이 /test/{id} 로 이동시킨다. */
export function RetestButton({
  testId,
  children,
  className = 'btn-primary',
}: {
  testId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState<ActionState>(() => startRetestAction(testId), {});
  return (
    <form action={formAction}>
      <SubmitButton className={className} pendingText="준비 중…">
        {children}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

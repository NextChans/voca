'use client';

import { useActionState } from 'react';
import { deleteAccountAction, type ActionState } from '@/app/actions';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';

/** 부모 회원 탈퇴. 비밀번호 재확인 + '탈퇴' 입력. */
export function DeleteAccountForm({ lastParent }: { lastParent: boolean }) {
  const [state, action] = useActionState(deleteAccountAction, {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {lastParent ? (
          <>
            가족에 남은 부모님이 없어서 <b>가족 전체</b>(아이 프로필·아이 계정·단어·시험 기록)가 바로 삭제돼요. 되돌릴
            수 없어요.
          </>
        ) : (
          <>내 계정만 삭제돼요. 다른 부모님과 아이들의 기록은 그대로 남아요.</>
        )}
      </div>
      <div>
        <label htmlFor="delete_password" className="label">
          현재 비밀번호
        </label>
        <input
          id="delete_password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="delete_confirm" className="label">
          확인을 위해 &apos;탈퇴&apos;라고 입력해 주세요
        </label>
        <input id="delete_confirm" name="confirm" required autoComplete="off" className="input" placeholder="탈퇴" />
      </div>
      <SubmitButton className="btn-danger w-full" pendingText="삭제하는 중…">
        회원 탈퇴
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

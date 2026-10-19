'use client';

import { useActionState, useState } from 'react';
import { deleteAccountAction, type ActionState } from '@/app/actions';
import { FormMessage } from '@/components/FormMessage';
import { SubmitButton } from '@/components/SubmitButton';
import { Turnstile } from '@/components/Turnstile';
import { CAPTCHA_ENABLED, CAPTCHA_WAITING_MESSAGE, TURNSTILE_SITE_KEY } from '@/lib/captcha';

type DeleteState = ActionState & { attempt?: number };

/** 시도 횟수를 붙여, 실패할 때마다 CAPTCHA 위젯을 다시 띄운다(토큰은 1회용). 성공 시엔 액션이 redirect 한다. */
async function deleteWithAttempt(prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const result = await deleteAccountAction(prev, formData);
  return { ...result, attempt: (prev.attempt ?? 0) + 1 };
}

/** 부모 회원 탈퇴. 비밀번호 재확인 + '탈퇴' 입력. */
export function DeleteAccountForm({
  lastParent,
  needsPin = false,
}: {
  lastParent: boolean;
  /** 가족 PIN 이 있는데 부모 모드가 아닐 때 (예: 약관 재동의 화면) PIN 도 함께 받는다 */
  needsPin?: boolean;
}) {
  const [state, action] = useActionState(deleteWithAttempt, {} as DeleteState);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const needsCaptcha = CAPTCHA_ENABLED && !captchaToken;
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
      {needsPin && (
        <div>
          <label htmlFor="delete_pin" className="label">
            부모 PIN
          </label>
          <input
            id="delete_pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            autoComplete="off"
            className="input"
          />
        </div>
      )}
      <div>
        <label htmlFor="delete_confirm" className="label">
          확인을 위해 &apos;탈퇴&apos;라고 입력해 주세요
        </label>
        <input id="delete_confirm" name="confirm" required autoComplete="off" className="input" placeholder="탈퇴" />
      </div>
      {CAPTCHA_ENABLED && (
        <>
          <Turnstile key={state.attempt ?? 0} siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />
          <input type="hidden" name="captcha_token" value={captchaToken ?? ''} />
        </>
      )}
      <SubmitButton className="btn-danger w-full" pendingText="삭제하는 중…" disabled={needsCaptcha}>
        {needsCaptcha ? CAPTCHA_WAITING_MESSAGE : '회원 탈퇴'}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

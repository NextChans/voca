'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/** 회원가입과 같은 규칙 (LoginForm, supabase/config.toml minimum_password_length) */
const MIN_PASSWORD_LENGTH = 6;

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('different from the old') || m.includes('same password') || m.includes('same_password'))
    return '전에 쓰던 비밀번호와 달라야 해요. 다른 비밀번호를 정해 주세요.';
  if (m.includes('password') && (m.includes('at least') || m.includes('short') || m.includes('weak')))
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상, 조금 더 복잡하게 정해 주세요.`;
  if (m.includes('session') || m.includes('jwt') || m.includes('expired') || m.includes('reauthenticat'))
    return '링크가 만료됐어요. 비밀번호 찾기에서 링크를 다시 받아 주세요.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (m.includes('fetch') || m.includes('network')) return '인터넷 연결을 확인해 주세요.';
  return '잠시 후 다시 시도해 주세요.';
}

export function ResetForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상으로 정해 주세요.`);
      return;
    }
    if (password !== String(fd.get('confirm') ?? '')) {
      setError('두 비밀번호가 서로 달라요.');
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(friendlyError(error.message));
        return;
      }
      setDone(true);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : ''));
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="card space-y-4">
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          새 비밀번호로 바꿨어요! 다음부터는 새 비밀번호로 로그인하세요.
        </p>
        <Link href="/" className="btn-primary w-full py-3 text-base">
          홈으로 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="label">
            새 비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className="input"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            새 비밀번호 확인
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className="input"
          />
        </div>

        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
          {pending ? '잠시만요…' : '비밀번호 바꾸기'}
        </button>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

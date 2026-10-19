'use client';

import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const SENT_MESSAGE = '입력한 이메일로 재설정 링크를 보냈어요. 메일의 링크는 이 브라우저에서 열어 주세요.';

/** 계정 존재 여부가 드러나지 않도록, 속도 제한·네트워크 오류 외에는 모두 같은 성공 문구를 보여준다. */
function friendlyError(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (m.includes('fetch') || m.includes('network')) return '인터넷 연결을 확인해 주세요.';
  if (m.includes('invalid') && m.includes('email')) return '이메일 주소 형식을 확인해 주세요.';
  return null;
}

export function ForgotForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    setError(null);
    setInfo(null);

    if (!email.includes('@')) {
      setInfo('아이 계정 비밀번호는 부모님이 설정 → 자녀별 설정에서 바꿀 수 있어요.');
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
      });
      const friendly = error ? friendlyError(error.message) : null;
      if (friendly) setError(friendly);
      else setInfo(SENT_MESSAGE);
    } catch (err) {
      const friendly = friendlyError(err instanceof Error ? err.message : '');
      setError(friendly ?? '잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="card">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="text"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
            className="input"
            placeholder="parent@example.com"
          />
        </div>

        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
          {pending ? '잠시만요…' : '재설정 링크 받기'}
        </button>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </p>
        )}
      </form>
    </div>
  );
}

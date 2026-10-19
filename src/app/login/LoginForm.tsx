'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toAuthEmail } from '@/lib/domain/kidLogin';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Mode = 'signin' | 'signup';

/** Supabase 영문 오류 → 친절한 한국어 */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return '이메일(아이디) 또는 비밀번호가 맞지 않아요.';
  if (m.includes('email not confirmed')) return '아직 이메일 인증을 하지 않았어요. 메일함에서 인증 링크를 눌러주세요.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return '이미 가입된 이메일이에요. 로그인 탭에서 로그인해 주세요.';
  if (m.includes('password') && (m.includes('at least') || m.includes('short') || m.includes('weak')))
    return '비밀번호는 6자 이상, 조금 더 복잡하게 정해 주세요.';
  if (m.includes('invalid') && m.includes('email')) return '이메일 주소 형식을 확인해 주세요.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (m.includes('fetch') || m.includes('network')) return '인터넷 연결을 확인해 주세요.';
  return '잠시 후 다시 시도해 주세요.';
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    setError(null);
    setInfo(null);

    if (mode === 'signup' && password !== String(fd.get('confirm') ?? '')) {
      setError('두 비밀번호가 서로 달라요.');
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(email), password });
        if (error) {
          setError(friendlyError(error.message));
          return;
        }
        router.replace('/');
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) {
          setError(friendlyError(error.message));
          return;
        }
        if (!data.session) {
          setInfo('가입 신청 완료! 메일함에서 인증 링크를 눌러주세요. 📬');
          return;
        }
        router.replace('/');
        router.refresh();
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : ''));
    } finally {
      setPending(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-sm font-semibold transition ${
      active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="card">
      <div role="tablist" aria-label="로그인 또는 회원가입" className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={tabClass(mode === 'signin')}
          onClick={() => switchMode('signin')}
        >
          로그인
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={tabClass(mode === 'signup')}
          onClick={() => switchMode('signup')}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" key={mode}>
        <div>
          <label htmlFor="email" className="label">
            {mode === 'signin' ? '이메일 또는 아이디' : '이메일'}
          </label>
          <input
            id="email"
            name="email"
            type={mode === 'signin' ? 'text' : 'email'}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
            className="input"
            placeholder={mode === 'signin' ? '부모님 이메일 또는 아이 아이디' : 'parent@example.com'}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            className="input"
          />
        </div>
        {mode === 'signup' && (
          <div>
            <label htmlFor="confirm" className="label">
              비밀번호 확인
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              className="input"
            />
          </div>
        )}

        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
          {pending ? '잠시만요…' : mode === 'signin' ? '로그인' : '가입하기'}
        </button>

        {mode === 'signin' && (
          <p className="text-center text-sm">
            <Link href="/auth/forgot" className="text-slate-500 hover:text-slate-700 hover:underline">
              비밀번호를 잊었어요
            </Link>
          </p>
        )}

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

      {mode === 'signup' && (
        <p className="mt-4 text-xs text-slate-500">
          가입 후 새 가족을 만들거나, 배우자에게 받은 초대코드로 같은 가족에 합류할 수 있어요. 가입하면 이메일이
          계정 확인용으로 수집되며, 가족을 만들 때{' '}
          <Link href="/terms" className="underline">
            이용약관
          </Link>
          과{' '}
          <Link href="/privacy" className="underline">
            개인정보 처리방침
          </Link>{' '}
          동의를 받아요.
        </p>
      )}
    </div>
  );
}

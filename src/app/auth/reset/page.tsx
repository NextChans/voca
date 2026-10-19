import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ResetForm } from './ResetForm';

export const metadata: Metadata = { title: '새 비밀번호 정하기' };

/** 비밀번호 재설정 메일 링크로 막 로그인한 세션인지 (JWT amr 에 recovery/otp 가 최근 1시간 안에 기록) */
async function isRecoverySession(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims?.amr ?? []) as ({ method?: string; timestamp?: number } | string)[];
  const now = Math.floor(Date.now() / 1000);
  return amr.some((a) => {
    const method = typeof a === 'string' ? a : a.method;
    const fresh = typeof a === 'string' || (!!a.timestamp && now - a.timestamp < 3600);
    return (method === 'recovery' || method === 'otp') && fresh;
  });
}

export default async function ResetPasswordPage() {
  // 일반 로그인 세션으로는 열지 않는다: 부모 계정 기기를 쓰는 아이가 비밀번호를 바꾸고 탈퇴까지 하는 경로 차단
  const user = await isRecoverySession();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="text-5xl" aria-hidden>
          🔒
        </div>
        <h1 className="mt-3 text-2xl font-bold">새 비밀번호 정하기</h1>
      </div>
      {user ? (
        <ResetForm />
      ) : (
        <div className="card space-y-4">
          <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            링크가 만료됐거나 다른 브라우저에서 열렸어요. 링크를 다시 받아서, 링크를 요청한 브라우저에서 열어 주세요.
          </p>
          <Link href="/auth/forgot" className="btn-primary w-full py-3 text-base">
            링크 다시 받기
          </Link>
        </div>
      )}
    </main>
  );
}

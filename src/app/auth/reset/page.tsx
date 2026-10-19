import type { Metadata } from 'next';
import Link from 'next/link';
import { getUser } from '@/lib/server/auth';
import { ResetForm } from './ResetForm';

export const metadata: Metadata = { title: '새 비밀번호 정하기' };

export default async function ResetPasswordPage() {
  const user = await getUser();

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

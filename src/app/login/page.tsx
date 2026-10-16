import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/server/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: '로그인' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getUser()) redirect('/');
  const linkFailed = (await searchParams).error === 'link';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="text-5xl" aria-hidden>
          📚
        </div>
        <h1 className="mt-3 text-2xl font-bold">우리 가족 영어 단어 시험</h1>
        <p className="mt-2 text-sm text-slate-500">
          부모님 계정으로 로그인해요. 아이들은 로그인 후 프로필을 골라 공부해요.
        </p>
      </div>
      {linkFailed && (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          인증 링크가 만료됐거나 다른 기기에서 열렸어요. 가입한 이메일과 비밀번호로 로그인해 보세요.
        </p>
      )}
      <LoginForm />
    </main>
  );
}

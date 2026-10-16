import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/server/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: '로그인' };

export default async function LoginPage() {
  if (await getUser()) redirect('/');

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
      <LoginForm />
    </main>
  );
}

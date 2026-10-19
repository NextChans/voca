import type { Metadata } from 'next';
import Link from 'next/link';
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
  const sp = await searchParams;
  const linkFailed = sp.error === 'link';
  const deleted = sp.deleted === '1';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="text-5xl" aria-hidden>
          📚
        </div>
        <h1 className="mt-3 text-2xl font-bold">우리 가족 영어 단어 시험</h1>
        <p className="mt-2 text-sm text-slate-500">
          부모님은 이메일로, 아이들은 부모님이 만들어 준 아이디로 로그인해요.
        </p>
      </div>
      {linkFailed && (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          인증 링크가 만료됐거나 다른 기기에서 열렸어요. 가입한 이메일과 비밀번호로 로그인해 보세요.
        </p>
      )}
      {deleted && (
        <p role="status" className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
          회원 탈퇴가 완료됐어요. 그동안 이용해 주셔서 고마워요.
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-center text-xs text-slate-400">
        <Link href="/terms" className="underline">
          이용약관
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="underline">
          개인정보 처리방침
        </Link>
      </p>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = { title: '비밀번호 찾기' };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="text-5xl" aria-hidden>
          🔑
        </div>
        <h1 className="mt-3 text-2xl font-bold">비밀번호를 잊었어요</h1>
        <p className="mt-2 text-sm text-slate-500">
          가입한 이메일을 적으면 새 비밀번호를 정하는 링크를 보내 드려요.
        </p>
      </div>
      <ForgotForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          로그인 화면으로 돌아가기
        </Link>
      </p>
    </main>
  );
}

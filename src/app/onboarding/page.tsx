import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/actions';
import { requireUser } from '@/lib/server/auth';
import * as repo from '@/lib/server/repo';
import { CreateFamilyForm, JoinFamilyForm } from './OnboardingForms';

export const metadata: Metadata = { title: '시작하기' };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await repo.getMembership(user.id)) redirect('/profiles');

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6 text-center">
        <div className="text-5xl" aria-hidden>
          👨‍👩‍👧‍👦
        </div>
        <h1 className="mt-3 text-2xl font-bold">환영해요!</h1>
        <p className="mt-2 text-sm text-slate-500">
          처음이라면 새 가족을 만들고, 배우자가 이미 만들었다면 초대코드로 합류해요.
        </p>
      </div>

      <div className="space-y-5">
        <section className="card" aria-labelledby="create-family-title">
          <h2 id="create-family-title" className="text-lg font-bold">
            🏠 새 가족 만들기
          </h2>
          <p className="mt-1 text-sm text-slate-500">가족을 만든 뒤 아이들 프로필을 추가할 수 있어요.</p>
          <CreateFamilyForm />
        </section>

        <section className="card" aria-labelledby="join-family-title">
          <h2 id="join-family-title" className="text-lg font-bold">
            🔑 초대코드로 합류
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            배우자가 설정 화면에서 만든 8자리 초대코드를 입력해 주세요.
          </p>
          <JoinFamilyForm />
        </section>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-sm text-slate-500">
        {user.email && <p>{user.email} 로 로그인 중</p>}
        <form action={signOutAction}>
          <button type="submit" className="btn-ghost">
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}

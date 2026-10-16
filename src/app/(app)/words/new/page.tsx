import Link from 'next/link';
import { ParentLockNotice } from '@/components/ParentLockNotice';
import { requireLearner } from '@/lib/server/context';
import { serverEnv } from '@/lib/server/env';
import { isParentMode } from '@/lib/server/parent';
import { WordEntry } from './_components/WordEntry';

export const metadata = { title: '단어 등록' };

export default async function NewWordsPage() {
  const { user, member, learner } = await requireLearner();
  const parentMode = await isParentMode(user.id, member.family_id);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/words" className="text-sm text-slate-500 hover:underline">
          ← 단어장
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          {learner.avatar} {learner.name} 단어 등록
        </h1>
      </div>

      {parentMode ? (
        <WordEntry aiOcr={Boolean(serverEnv.anthropicApiKey())} learnerName={learner.name} />
      ) : (
        <ParentLockNotice next="/words/new" what="단어 등록" />
      )}
    </div>
  );
}

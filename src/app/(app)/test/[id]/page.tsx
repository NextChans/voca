import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireLearner } from '@/lib/server/context';
import * as repo from '@/lib/server/repo';
import { MODE_LABEL } from '@/lib/domain/types';
import { TestRunner } from '../_components/TestRunner';

export const metadata = { title: '시험 보는 중' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { member, learner } = await requireLearner();

  const test = await repo.getTest(member.family_id, id);
  if (!test || test.learner_id !== learner.id) notFound();
  if (test.status === 'submitted') redirect(`/results/${id}`);

  if (test.status === 'cancelled') {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="text-5xl">🛑</p>
        <h1 className="mt-3 text-xl font-bold">이 시험은 취소됐어요</h1>
        <p className="mt-2 text-slate-600">
          부모님이 시험을 취소했어요. 이번 주 횟수에서도 빠졌으니 새로 시험을 볼 수 있어요.
        </p>
        <Link href="/test/new" className="btn-primary mt-5 h-12 w-full">
          시험 화면으로
        </Link>
      </div>
    );
  }

  // 정답(철자/뜻)이 없는 문제 목록만 클라이언트로 보낸다
  const questions = await repo.getTestQuestions(member.family_id, id);

  return (
    <TestRunner
      testId={id}
      questions={questions}
      title={`${test.kind === 'retest' ? '🔁 재시험' : '✏️ 정기 시험'} · ${MODE_LABEL[test.mode]}`}
    />
  );
}

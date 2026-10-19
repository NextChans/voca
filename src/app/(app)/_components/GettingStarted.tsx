import Link from 'next/link';

type Step = {
  key: string;
  title: string;
  done: boolean;
  hint?: string;
  href?: string;
  cta?: string;
};

/**
 * 첫 시험을 보기 전까지 홈 맨 위에 보이는 시작 가이드.
 * 각 단계의 완료 여부는 홈 페이지가 이미 불러온 실제 데이터로 계산해 넘긴다.
 */
export function GettingStarted({
  learnerName,
  isParent,
  hasPin,
  wordCount,
  minWords,
  hasSubmittedTest,
}: {
  learnerName: string;
  isParent: boolean;
  hasPin: boolean;
  wordCount: number;
  minWords: number;
  hasSubmittedTest: boolean;
}) {
  if (hasSubmittedTest) return null;

  const steps: Step[] = [
    { key: 'profile', title: '아이 프로필 만들기', done: true },
    ...(isParent
      ? [
          {
            key: 'pin',
            title: '부모 PIN 정하기',
            done: hasPin,
            hint: 'PIN을 정하면 아이가 단어·설정을 함부로 바꿀 수 없어요.',
            href: '/settings',
            cta: 'PIN 정하러 가기',
          },
        ]
      : []),
    {
      key: 'words',
      title: '단어 등록하기',
      done: wordCount > 0,
      hint: '직접 입력하거나, 붙여 넣거나, 사진을 찍어서 등록해요.',
      href: '/words/new',
      cta: '단어 등록하러 가기',
    },
    {
      key: 'test',
      title: '다음 날 첫 시험 보기',
      done: hasSubmittedTest,
      hint: `등록한 단어는 다음 날부터 시험에 나와요. 시험 볼 수 있는 단어가 ${minWords}개 이상이면 시작할 수 있어요.`,
      href: '/test/new',
      cta: '시험 보러 가기',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="card space-y-4 border-brand-100 bg-brand-50" aria-labelledby="getting-started-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="getting-started-title" className="text-lg font-bold text-brand-700">
          🧭 {learnerName}의 시작 가이드
        </h2>
        <span className="text-sm font-medium text-brand-700">
          {doneCount} / {steps.length} 완료
        </span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.key} className="flex gap-3 rounded-xl bg-white p-3">
            <span className="text-xl leading-none" aria-hidden>
              {s.done ? '✅' : '⬜'}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${s.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                {circled(i + 1)} {s.title}
                <span className="sr-only">{s.done ? ' (완료)' : ' (아직 안 함)'}</span>
              </p>
              {!s.done && s.hint && <p className="mt-1 text-sm text-slate-600">{s.hint}</p>}
              {!s.done && s.href && s.cta && (
                <Link href={s.href} className="mt-2 inline-block text-sm font-semibold text-brand-600 underline">
                  {s.cta} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function circled(n: number): string {
  return String.fromCharCode(0x2460 + n - 1);
}

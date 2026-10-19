import type { Metadata } from 'next';
import Link from 'next/link';
import { OPERATOR, SERVICE_NAME } from '@/lib/legal';

// 공개 랜딩 페이지. 쿠키·세션을 읽지 않는 정적 서버 컴포넌트로 유지한다.
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: { absolute: `${SERVICE_NAME} — 가족 영어 단어 시험` },
  description:
    '우리 아이 영어 단어, 등록부터 시험·복습까지 한 번에. 사진으로 단어를 등록하고, 다음 날부터 자동 출제·자동 채점되는 무료 가족 서비스예요.',
  robots: { index: true, follow: true },
};

const FEATURES = [
  {
    emoji: '📸',
    title: '사진으로 단어 등록',
    body: '교재나 단어장을 찍으면 AI가 단어와 뜻을 읽어 줘요. 직접 입력하거나 붙여 넣어도 돼요.',
  },
  {
    emoji: '📅',
    title: '등록 다음 날부터 자동 출제',
    body: '오늘 넣은 단어는 내일부터 시험에 나와요. 아이마다 한 번에 볼 단어 수를 정할 수 있어요.',
  },
  {
    emoji: '✅',
    title: '자동 채점 + 틀린 단어 재시험',
    body: '제출하면 바로 채점돼요. 틀린 단어만 모아 몇 번이든 다시 볼 수 있어요.',
  },
  {
    emoji: '🔊',
    title: '발음 듣기·연습 모드',
    body: '단어 발음을 들으며 공부해요. 틀린 단어·새 단어를 카드와 쓰기로 연습할 수 있어요.',
  },
  {
    emoji: '🔒',
    title: '부모님 PIN으로 관리',
    body: '단어 관리, 채점 수정, 설정은 부모님 PIN이 있어야 바꿀 수 있어요.',
  },
] as const;

const STEPS = [
  { emoji: '🏠', title: '가족 만들기', body: '부모님이 이메일로 가입해요. 배우자는 초대 코드로 합류해요.' },
  { emoji: '🧒', title: '아이 추가', body: '아이 프로필을 만들어요. 원하면 아이 전용 아이디도 줄 수 있어요.' },
  { emoji: '📝', title: '단어 등록', body: '입력·붙여 넣기·사진으로 이번 주 단어를 넣어요.' },
  { emoji: '🚀', title: '다음 날 시험', body: '다음 날부터 아이가 시험을 보고, 기록이 쌓여요.' },
] as const;

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      {/* 히어로 */}
      <section className="text-center" aria-labelledby="hero-title">
        <div className="text-5xl" aria-hidden>
          📚
        </div>
        <h1 id="hero-title" className="mt-3 text-4xl font-extrabold tracking-tight text-brand-700">
          {SERVICE_NAME}
        </h1>
        <p className="mt-3 text-lg font-semibold text-slate-800 sm:text-xl">
          우리 아이 영어 단어,
          <br className="sm:hidden" /> 등록부터 시험·복습까지 한 번에
        </p>
        <p className="mt-2 text-sm text-slate-500">부모님과 아이가 함께 쓰는 가족 영어 단어 시험 서비스</p>
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-3">
          <Link href="/login" className="btn-primary w-full py-3.5 text-base">
            무료로 시작하기
          </Link>
          <Link href="/login" className="text-sm font-semibold text-brand-600 underline">
            이미 계정이 있어요 · 로그인
          </Link>
        </div>
      </section>

      {/* 기능 */}
      <section className="mt-14" aria-labelledby="features-title">
        <h2 id="features-title" className="text-center text-xl font-bold">
          이런 걸 할 수 있어요
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="card flex gap-4">
              <span className="text-3xl leading-none" aria-hidden>
                {f.emoji}
              </span>
              <div className="min-w-0">
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 사용 순서 */}
      <section className="mt-14" aria-labelledby="steps-title">
        <h2 id="steps-title" className="text-center text-xl font-bold">
          이렇게 써요
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-4 text-center">
              <span className="badge bg-brand-100 text-brand-700">{i + 1}단계</span>
              <div className="mt-2 text-3xl" aria-hidden>
                {s.emoji}
              </div>
              <h3 className="mt-1 font-bold">{s.title}</h3>
              <p className="mt-1 text-xs text-slate-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 안내 */}
      <section className="mt-14 rounded-2xl bg-brand-50 p-5 text-sm text-slate-700" aria-labelledby="note-title">
        <h2 id="note-title" className="font-bold text-brand-700">
          💙 무료 가족 서비스예요
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>요금도 광고도 없어요.</li>
          <li>가입은 부모님만 해요. 아이 정보(이름, 단어, 시험 기록)는 부모님이 직접 입력하고 관리해요.</li>
        </ul>
        <Link href="/login" className="btn-primary mt-4 w-full py-3 text-base sm:w-auto">
          무료로 시작하기
        </Link>
      </section>

      {/* 푸터 */}
      <footer className="mt-14 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
        <p>
          <Link href="/terms" className="underline">
            이용약관
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="underline">
            개인정보 처리방침
          </Link>
        </p>
        <p className="mt-2">
          문의:{' '}
          <a href={`mailto:${OPERATOR.email}`} className="underline">
            {OPERATOR.email}
          </a>
        </p>
        <p className="mt-2">© {SERVICE_NAME}</p>
      </footer>
    </main>
  );
}

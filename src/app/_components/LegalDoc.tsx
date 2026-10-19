import Link from 'next/link';
import { formatLegalDate, LEGAL_VERSION } from '@/lib/legal';

type Props = {
  title: string;
  /** 다른 법적 문서로의 교차 링크 */
  other: { href: string; label: string };
  children: React.ReactNode;
};

/** 개인정보 처리방침·이용약관 공용 레이아웃 (로그인 없이 열람, 클라이언트 JS 없음) */
export function LegalDoc({ title, other, children }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <header className="mb-4 flex items-center justify-between text-sm">
        <Link href="/" className="font-semibold text-brand-600 hover:underline">
          ← 돌아가기
        </Link>
        <Link href={other.href} className="text-slate-500 hover:underline">
          {other.label}
        </Link>
      </header>
      <main className="card space-y-8 leading-relaxed text-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">시행일: {formatLegalDate(LEGAL_VERSION)}</p>
        </div>
        {children}
      </main>
      <footer className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-slate-500">
        <Link href="/privacy" className="hover:underline">
          개인정보 처리방침
        </Link>
        <Link href="/terms" className="hover:underline">
          이용약관
        </Link>
      </footer>
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function Bullets({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

export function Numbered({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>;
}

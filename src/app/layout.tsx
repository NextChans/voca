import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '단어 시험', template: '%s · 단어 시험' },
  description: '영어 단어 성취도 평가',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: '단어 시험', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        {children}
        {/* Vercel Web Analytics: 쿠키 없이 익명 방문 통계 (처리방침에 고지). Vercel 밖(로컬·E2E)에는 스크립트가 없어 제외 */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl">🔍</p>
      <h1 className="text-xl font-bold">페이지를 찾을 수 없어요</h1>
      <Link href="/" className="btn-primary">
        홈으로
      </Link>
    </main>
  );
}

'use client';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md text-center">
      <p className="text-4xl">😵</p>
      <h1 className="mt-2 text-lg font-bold">앗, 문제가 생겼어요</h1>
      <p className="mt-1 text-sm text-slate-500">잠시 후 다시 시도해 주세요.</p>
      <button type="button" className="btn-primary mt-4" onClick={reset}>
        다시 시도
      </button>
    </div>
  );
}

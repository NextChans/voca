import Link from 'next/link';

/** 부모 모드가 아닐 때 관리 기능 자리에 표시 */
export function ParentLockNotice({ next, what = '이 기능' }: { next: string; what?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
      🔒 {what}은(는) 부모 모드에서 사용할 수 있어요.{' '}
      <Link href={`/settings?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-600 underline">
        잠금 해제
      </Link>
    </div>
  );
}

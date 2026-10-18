/** 탭 이동 중 본문 자리 표시 (레이아웃·하단 메뉴는 그대로 유지됨) */
export default function Loading() {
  return (
    <div role="status" aria-label="불러오는 중" className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-xl bg-slate-200" />
      <div className="h-4 w-64 rounded-lg bg-slate-200" />
      <div className="h-32 rounded-2xl bg-slate-200/80" />
      <div className="h-24 rounded-2xl bg-slate-200/70" />
      <span className="sr-only">불러오는 중…</span>
    </div>
  );
}

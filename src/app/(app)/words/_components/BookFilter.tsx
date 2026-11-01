import Link from 'next/link';

/** 'all' = 전체, 'none' = 책 없음, 그 외 = 단어책 id */
export type BookFilterValue = string;

/** 단어책 거르기 (단어책이 하나 이상 있을 때만 보인다). basePath 의 다른 쿼리는 extra 로 넘긴다. */
export function BookFilter({
  books,
  value,
  basePath = '/words',
  extra = {},
  showNone = true,
  manage = true,
}: {
  books: { id: string; name: string }[];
  value: BookFilterValue;
  basePath?: string;
  extra?: Record<string, string>;
  showNone?: boolean;
  manage?: boolean;
}) {
  const href = (book: string | null) => {
    const q = new URLSearchParams(extra);
    if (book) q.set('book', book);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const chips = [
    { value: 'all', label: '전체', href: href(null) },
    ...books.map((b) => ({ value: b.id, label: `📗 ${b.name}`, href: href(b.id) })),
    ...(showNone ? [{ value: 'none', label: '책 없음', href: href('none') }] : []),
  ];
  return (
    <nav aria-label="단어책" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {chips.map((c) => (
        <Link
          key={c.value}
          href={c.href}
          replace
          scroll={false}
          aria-current={value === c.value ? 'page' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
            value === c.value ? 'bg-slate-900 text-white' : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {c.label}
        </Link>
      ))}
      {manage && (
        <Link
          href="/words/books"
          className="shrink-0 rounded-full px-3 py-1.5 text-sm whitespace-nowrap text-slate-500 hover:bg-slate-200"
        >
          ⚙️ 단어책 관리
        </Link>
      )}
    </nav>
  );
}

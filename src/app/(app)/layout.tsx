import Link from 'next/link';
import { lockParentAction } from '@/app/actions';
import { getSelectedLearner, requireMember } from '@/lib/server/context';
import { isParentMode } from '@/lib/server/parent';

const NAV = [
  { href: '/', label: '홈', icon: '🏠' },
  { href: '/words', label: '단어', icon: '📚' },
  { href: '/test/new', label: '시험', icon: '✏️' },
  { href: '/results', label: '기록', icon: '📊' },
  { href: '/settings', label: '설정', icon: '⚙️' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await requireMember();
  const [learner, parentMode] = await Promise.all([
    getSelectedLearner(member.family_id),
    isParentMode(user.id, member.family_id),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Link href="/profiles" className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100">
          <span className="text-2xl">{learner?.avatar ?? '👨‍👩‍👧‍👦'}</span>
          <span className="font-bold">{learner?.name ?? '자녀 선택'}</span>
          <span className="text-xs text-slate-400">바꾸기</span>
        </Link>
        {parentMode ? (
          <form action={lockParentAction}>
            <button className="badge bg-amber-100 px-3 py-1 text-amber-800" title="눌러서 부모 모드 잠그기">
              🔓 부모 모드 · {member.display_name}
            </button>
          </form>
        ) : (
          <Link href="/settings" className="badge bg-slate-100 px-3 py-1 text-slate-500">
            🔒 자녀 모드
          </Link>
        )}
      </header>

      <main className="flex-1 px-4 pb-28 pt-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-3xl justify-around">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="flex flex-col items-center px-4 py-2 text-xs text-slate-600">
                <span className="text-xl">{n.icon}</span>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

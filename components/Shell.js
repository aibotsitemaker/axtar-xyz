'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

const NAV = [
  { href: '/books', label: 'Kitablar', icon: '📚' },
  { href: '/pdfs', label: 'Arxiv', icon: '📄' },
  { href: '/quizzes', label: 'Sınaqlar', icon: '🧠' },
  { href: '/chat', label: 'Çat', icon: '💬' },
  { href: '/profile', label: 'Kabinet', icon: '👤' }
];

export default function Shell({ children }) {
  const path = usePathname();
  const { user } = useAuth();
  const active = (h) => path === h || path.startsWith(h + '/');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-white">T</span>
            TəhsilHub
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active(n.href) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          {!user && <Link href="/auth" className="btn btn-primary !py-2">Daxil ol</Link>}
          {user && <Link href="/profile" className="btn btn-ghost !py-2">Kabinetim</Link>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 md:pb-10">{children}</main>

      <footer className="hidden border-t border-slate-200 bg-white py-6 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} TəhsilHub</span>
          <div className="flex gap-5">
            <Link href="/legal/privacy" className="hover:text-ink">Məxfilik Siyasəti</Link>
            <Link href="/legal/terms" className="hover:text-ink">İstifadə Şərtləri</Link>
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(n.href) ? 'text-brand' : 'text-slate-500'}`}>
              <span className="text-lg leading-none">{n.icon}</span>{n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
